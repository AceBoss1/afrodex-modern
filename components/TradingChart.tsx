'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { createChart, IChartApi, ISeriesApi, CandlestickData, HistogramData, Time } from 'lightweight-charts';
import { BarChart3, TrendingUp } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// Create Supabase client
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// Token interface (matching your existing Token type)
interface Token {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  logo?: string;
  description?: string;
  website?: string;
  etherscan?: string;
  tracker?: string;
  isCustom?: boolean;
}

interface Trade {
  id?: string;
  price: number;
  amount: number;
  total: number;
  timestamp: number;
  type: 'buy' | 'sell';
  txHash?: string;
}

interface TradingChartProps {
  baseToken: Token;
  quoteToken: Token;
}

type TimeRange = '1M' | '15M' | '1H' | '24H' | '7D' | 'ALL';
type ChartType = 'area' | 'candle';

interface OHLCData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Time range configurations in milliseconds
const TIME_RANGES: Record<TimeRange, { ms: number; bucketMs: number; label: string }> = {
  '1M': { ms: 60 * 1000, bucketMs: 5 * 1000, label: '1 Min' },           // 5 second candles
  '15M': { ms: 15 * 60 * 1000, bucketMs: 30 * 1000, label: '15 Min' },   // 30 second candles
  '1H': { ms: 60 * 60 * 1000, bucketMs: 2 * 60 * 1000, label: '1 Hour' }, // 2 minute candles
  '24H': { ms: 24 * 60 * 60 * 1000, bucketMs: 30 * 60 * 1000, label: '24 Hours' }, // 30 minute candles
  '7D': { ms: 7 * 24 * 60 * 60 * 1000, bucketMs: 4 * 60 * 60 * 1000, label: '7 Days' }, // 4 hour candles
  'ALL': { ms: Infinity, bucketMs: 24 * 60 * 60 * 1000, label: 'All Time' }, // Daily candles
};

export default function TradingChart({ baseToken, quoteToken }: TradingChartProps) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>('24H');
  const [chartType, setChartType] = useState<ChartType>('area');
  const [isLoading, setIsLoading] = useState(true);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  // Fetch trades from Supabase
  useEffect(() => {
    const supabase = getSupabase();
    
    const fetchTrades = async () => {
      setIsLoading(true);
      try {
        if (!supabase) {
          console.warn('Supabase not configured');
          return;
        }
        
        const { data, error } = await supabase
          .from('trades')
          .select('*')
          .eq('token_address', baseToken.address.toLowerCase())
          .order('timestamp', { ascending: true });

        if (error) {
          console.error('Error fetching trades:', error);
          return;
        }

        if (data) {
          const formattedTrades: Trade[] = data.map((t) => ({
            id: t.id,
            price: parseFloat(t.price),
            amount: parseFloat(t.amount),
            total: parseFloat(t.total),
            timestamp: new Date(t.timestamp).getTime(),
            type: t.side as 'buy' | 'sell',
            txHash: t.tx_hash,
          }));
          setTrades(formattedTrades);
        }
      } catch (err) {
        console.error('Failed to fetch trades:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTrades();

    // Subscribe to real-time updates
    if (!supabase) return;
    
    const channel = supabase
      .channel(`trades-${baseToken.address}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'trades',
          filter: `token_address=eq.${baseToken.address.toLowerCase()}`,
        },
        (payload) => {
          const newTrade: Trade = {
            id: payload.new.id,
            price: parseFloat(payload.new.price),
            amount: parseFloat(payload.new.amount),
            total: parseFloat(payload.new.total),
            timestamp: new Date(payload.new.timestamp).getTime(),
            type: payload.new.side as 'buy' | 'sell',
            txHash: payload.new.tx_hash,
          };
          setTrades((prev) => [...prev, newTrade].sort((a, b) => a.timestamp - b.timestamp));
        }
      )
      .subscribe();

    return () => {
      if (supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [baseToken.address]);

  // Filter trades by time range
  const filteredTrades = useMemo(() => {
    if (!trades.length) return [];
    
    const now = Date.now();
    const range = TIME_RANGES[timeRange];
    
    if (range.ms === Infinity) {
      return [...trades].sort((a, b) => a.timestamp - b.timestamp);
    }
    
    const cutoff = now - range.ms;
    return trades
      .filter(t => t.timestamp >= cutoff)
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [trades, timeRange]);

  // Generate OHLC data from trades
  const ohlcData = useMemo((): OHLCData[] => {
    if (!filteredTrades.length) return [];

    const range = TIME_RANGES[timeRange];
    const bucketMs = range.bucketMs;
    const buckets: Map<number, Trade[]> = new Map();

    // Group trades into time buckets
    filteredTrades.forEach(trade => {
      const bucketTime = Math.floor(trade.timestamp / bucketMs) * bucketMs;
      if (!buckets.has(bucketTime)) {
        buckets.set(bucketTime, []);
      }
      buckets.get(bucketTime)!.push(trade);
    });

    // Convert buckets to OHLC
    const ohlc: OHLCData[] = [];
    const sortedTimes = Array.from(buckets.keys()).sort((a, b) => a - b);

    sortedTimes.forEach(time => {
      const bucketTrades = buckets.get(time)!;
      const prices = bucketTrades.map(t => t.price);
      const volumes = bucketTrades.reduce((sum, t) => sum + t.amount, 0);

      ohlc.push({
        time: Math.floor(time / 1000), // Convert to seconds for lightweight-charts
        open: prices[0],
        high: Math.max(...prices),
        low: Math.min(...prices),
        close: prices[prices.length - 1],
        volume: volumes,
      });
    });

    return ohlc;
  }, [filteredTrades, timeRange]);

  // Generate area chart data (simple price over time)
  const areaChartData = useMemo(() => {
    if (!filteredTrades.length) return [];

    const range = TIME_RANGES[timeRange];
    const bucketMs = range.bucketMs;
    const buckets: Map<number, number[]> = new Map();

    filteredTrades.forEach(trade => {
      const bucketTime = Math.floor(trade.timestamp / bucketMs) * bucketMs;
      if (!buckets.has(bucketTime)) {
        buckets.set(bucketTime, []);
      }
      buckets.get(bucketTime)!.push(trade.price);
    });

    return Array.from(buckets.entries())
      .sort(([a], [b]) => a - b)
      .map(([time, prices]) => ({
        time,
        price: prices.reduce((a, b) => a + b, 0) / prices.length,
        displayTime: formatTime(time, timeRange),
      }));
  }, [filteredTrades, timeRange]);

  // Initialize and update Lightweight Charts
  useEffect(() => {
    if (chartType !== 'candle' || !chartContainerRef.current) return;

    // Clean up existing chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    // Create new chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: 'transparent' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: '#f97316',
          width: 1,
          style: 2,
          labelBackgroundColor: '#f97316',
        },
        horzLine: {
          color: '#f97316',
          width: 1,
          style: 2,
          labelBackgroundColor: '#f97316',
        },
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        scaleMargins: {
          top: 0.1,
          bottom: 0.25, // Leave room for volume
        },
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        timeVisible: true,
        secondsVisible: timeRange === '1M' || timeRange === '15M',
      },
      handleScroll: {
        vertTouchDrag: false,
      },
    });

    // Add candlestick series
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    // Add volume series
    const volumeSeries = chart.addHistogramSeries({
      color: '#f97316',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '',
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.85,
        bottom: 0,
      },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [chartType, timeRange]);

  // Update chart data
  useEffect(() => {
    if (chartType !== 'candle' || !candleSeriesRef.current || !volumeSeriesRef.current) return;

    if (ohlcData.length === 0) {
      candleSeriesRef.current.setData([]);
      volumeSeriesRef.current.setData([]);
      return;
    }

    // Format data for lightweight-charts
    const candleData: CandlestickData[] = ohlcData.map(d => ({
      time: d.time as Time,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));

    const volumeData: HistogramData[] = ohlcData.map(d => ({
      time: d.time as Time,
      value: d.volume,
      color: d.close >= d.open ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)',
    }));

    candleSeriesRef.current.setData(candleData);
    volumeSeriesRef.current.setData(volumeData);

    // Fit content
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [ohlcData, chartType]);

  // Calculate price statistics
  const priceStats = useMemo(() => {
    if (!filteredTrades.length) {
      return { current: 0, change: 0, changePercent: 0, high: 0, low: 0 };
    }

    const prices = filteredTrades.map(t => t.price);
    const current = prices[prices.length - 1];
    const first = prices[0];
    const change = current - first;
    const changePercent = first > 0 ? (change / first) * 100 : 0;

    return {
      current,
      change,
      changePercent,
      high: Math.max(...prices),
      low: Math.min(...prices),
    };
  }, [filteredTrades]);

  // Format price with appropriate precision (15 decimals for micro-prices)
  const formatPrice = (price: number): string => {
    if (price === 0) return '0';
    if (price < 0.000000001) return price.toExponential(4);
    if (price < 0.00000001) return price.toFixed(15);
    if (price < 0.0000001) return price.toFixed(14);
    if (price < 0.000001) return price.toFixed(12);
    if (price < 0.00001) return price.toFixed(10);
    if (price < 0.0001) return price.toFixed(8);
    if (price < 0.01) return price.toFixed(6);
    if (price < 1) return price.toFixed(4);
    return price.toFixed(2);
  };

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">
            {baseToken.symbol}/{quoteToken.symbol}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xl font-bold text-white">
              {formatPrice(priceStats.current)}
            </span>
            <span className={`text-sm font-medium ${
              priceStats.change >= 0 ? 'text-green-500' : 'text-red-500'
            }`}>
              {priceStats.change >= 0 ? '+' : ''}{formatPrice(priceStats.change)} ({priceStats.changePercent.toFixed(2)}%)
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Chart Type Toggle */}
          <div className="flex bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setChartType('area')}
              className={`p-2 rounded transition-colors ${
                chartType === 'area'
                  ? 'bg-orange-500 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
              title="Area Chart"
            >
              <TrendingUp className="w-4 h-4" />
            </button>
            <button
              onClick={() => setChartType('candle')}
              className={`p-2 rounded transition-colors ${
                chartType === 'candle'
                  ? 'bg-orange-500 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
              title="Candlestick Chart"
            >
              <BarChart3 className="w-4 h-4" />
            </button>
          </div>

          {/* Time Range Selector */}
          <div className="flex bg-gray-800 rounded-lg p-1">
            {(['1M', '15M', '1H', '24H', '7D', 'ALL'] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  timeRange === range
                    ? 'bg-orange-500 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Price Stats Bar */}
      <div className="flex gap-4 text-xs text-gray-400 mb-4">
        <span>H: <span className="text-green-500">{formatPrice(priceStats.high)}</span></span>
        <span>L: <span className="text-red-500">{formatPrice(priceStats.low)}</span></span>
        <span>Trades: <span className="text-white">{filteredTrades.length}</span></span>
      </div>

      {/* Chart Container */}
      <div className="flex-1 min-h-[300px] relative">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center text-gray-500">
            <div className="animate-pulse">Loading chart data...</div>
          </div>
        ) : filteredTrades.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-gray-500">
            No trades in selected time range
          </div>
        ) : chartType === 'area' ? (
          /* Area Chart (Recharts) */
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={areaChartData}>
              <defs>
                <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="displayTime"
                stroke="#6b7280"
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                tickLine={{ stroke: '#374151' }}
                axisLine={{ stroke: '#374151' }}
              />
              <YAxis
                stroke="#6b7280"
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                tickLine={{ stroke: '#374151' }}
                axisLine={{ stroke: '#374151' }}
                tickFormatter={(value) => formatPrice(value)}
                domain={['auto', 'auto']}
                width={80}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  padding: '8px 12px',
                }}
                labelStyle={{ color: '#9ca3af', marginBottom: '4px' }}
                formatter={(value: number) => [formatPrice(value), 'Price']}
              />
              <Area
                type="monotone"
                dataKey="price"
                stroke="#f97316"
                strokeWidth={2}
                fill="url(#priceGradient)"
                dot={false}
                activeDot={{ r: 4, fill: '#f97316' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          /* Candlestick Chart (Lightweight Charts) */
          <div ref={chartContainerRef} className="w-full h-full" />
        )}
      </div>

      {/* Legend */}
      {chartType === 'candle' && filteredTrades.length > 0 && (
        <div className="flex items-center justify-center gap-6 mt-4 text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-sm"></div>
            <span>Bullish</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-sm"></div>
            <span>Bearish</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-orange-500/50 rounded-sm"></div>
            <span>Volume</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper function to format time for area chart display
function formatTime(timestamp: number, range: TimeRange): string {
  const date = new Date(timestamp);
  
  switch (range) {
    case '1M':
    case '15M':
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    case '1H':
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    case '24H':
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    case '7D':
      return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit' });
    case 'ALL':
    default:
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
}
