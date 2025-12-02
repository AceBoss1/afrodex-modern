// components/TradingChart.tsx
'use client';

import { useMemo, useState } from 'react';
import { useTradingStore } from '@/lib/store';
import { Token } from '@/lib/tokens';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';
import { TrendingUp, TrendingDown, BarChart2 } from 'lucide-react';

interface TradingChartProps {
  baseToken: Token;
  quoteToken: Token;
}

type Timeframe = '1H' | '24H' | '7D' | 'ALL';

export default function TradingChart({ baseToken, quoteToken }: TradingChartProps) {
  const { trades, isLoadingTrades } = useTradingStore();
  const [timeframe, setTimeframe] = useState<Timeframe>('24H');

  // Filter and process trades for chart
  const chartData = useMemo(() => {
    if (trades.length === 0) return [];

    const now = Date.now() / 1000;
    const intervals: Record<Timeframe, number> = {
      '1H': 60 * 60,
      '24H': 24 * 60 * 60,
      '7D': 7 * 24 * 60 * 60,
      'ALL': Infinity,
    };

    const timeLimit = now - intervals[timeframe];
    const filteredTrades = trades.filter(t => 
      timeframe === 'ALL' || t.timestamp >= timeLimit
    );

    if (filteredTrades.length === 0) return [];

    // Group trades into buckets for smoother chart
    const bucketCount = Math.min(filteredTrades.length, 100);
    const bucketSize = Math.max(1, Math.ceil(filteredTrades.length / bucketCount));
    
    const data: { time: string; price: number; timestamp: number }[] = [];

    for (let i = filteredTrades.length - 1; i >= 0; i -= bucketSize) {
      const endIdx = Math.max(0, i - bucketSize + 1);
      const bucket = filteredTrades.slice(endIdx, i + 1);
      
      if (bucket.length > 0) {
        const avgPrice = bucket.reduce((sum, t) => sum + t.price, 0) / bucket.length;
        const timestamp = bucket[0].timestamp;
        
        data.push({
          time: format(new Date(timestamp * 1000), timeframe === '1H' ? 'HH:mm' : 'MMM dd HH:mm'),
          price: avgPrice,
          timestamp,
        });
      }
    }

    return data;
  }, [trades, timeframe]);

  // Calculate price change
  const priceChange = useMemo(() => {
    if (chartData.length < 2) return { value: 0, percent: 0 };
    const first = chartData[0].price;
    const last = chartData[chartData.length - 1].price;
    const change = last - first;
    const percent = first > 0 ? (change / first) * 100 : 0;
    return { value: change, percent };
  }, [chartData]);

  const currentPrice = trades.length > 0 ? trades[0].price : 0;
  const isPositive = priceChange.percent >= 0;

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    return (
      <div className="bg-afrodex-black-card border border-white/10 rounded-lg p-3 shadow-xl">
        <p className="text-xs text-gray-400 mb-1">{label}</p>
        <p className="text-sm font-mono font-semibold">
          {payload[0].value.toFixed(8)} {quoteToken.symbol}
        </p>
      </div>
    );
  };

  if (isLoadingTrades) {
    return (
      <div className="card h-full flex items-center justify-center">
        <div className="text-center">
          <div className="spinner spinner-lg mb-3" />
          <p className="text-sm text-gray-500">Loading chart data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-xl font-display font-bold">
              {baseToken.symbol}/{quoteToken.symbol}
            </h3>
            <span className={`flex items-center gap-1 text-sm font-medium ${
              isPositive ? 'text-trade-buy' : 'text-trade-sell'
            }`}>
              {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {isPositive ? '+' : ''}{priceChange.percent.toFixed(2)}%
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono">
              {currentPrice > 0 ? currentPrice.toFixed(8) : '0.00000000'}
            </span>
            <span className="text-sm text-gray-500">{quoteToken.symbol}</span>
          </div>
        </div>

        {/* Timeframe Selector */}
        <div className="flex gap-1 bg-afrodex-black-lighter rounded-lg p-1">
          {(['1H', '24H', '7D', 'ALL'] as Timeframe[]).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                timeframe === tf
                  ? 'bg-afrodex-orange text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0">
        {chartData.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-500">
            <BarChart2 className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">No trade data available for this timeframe</p>
            <p className="text-xs text-gray-600 mt-1">Trades will appear here once activity begins</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop 
                    offset="0%" 
                    stopColor={isPositive ? '#00D26A' : '#FF4757'} 
                    stopOpacity={0.3} 
                  />
                  <stop 
                    offset="100%" 
                    stopColor={isPositive ? '#00D26A' : '#FF4757'} 
                    stopOpacity={0} 
                  />
                </linearGradient>
              </defs>
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="rgba(255,255,255,0.05)" 
                vertical={false}
              />
              <XAxis
                dataKey="time"
                stroke="#666"
                tick={{ fill: '#666', fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: 'rgba(255,255,255,0.05)' }}
              />
              <YAxis
                stroke="#666"
                tick={{ fill: '#666', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                domain={['dataMin', 'dataMax']}
                tickFormatter={(value) => value.toFixed(6)}
                width={80}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="price"
                stroke={isPositive ? '#00D26A' : '#FF4757'}
                strokeWidth={2}
                fill="url(#priceGradient)"
                dot={false}
                activeDot={{
                  r: 4,
                  fill: isPositive ? '#00D26A' : '#FF4757',
                  stroke: '#fff',
                  strokeWidth: 2,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Stats Footer */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-white/5">
          <div>
            <p className="text-xs text-gray-500 mb-1">24h Trades</p>
            <p className="text-sm font-semibold">
              {trades.filter(t => t.timestamp >= Date.now() / 1000 - 24 * 60 * 60).length}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">24h High</p>
            <p className="text-sm font-mono">
              {chartData.length > 0 
                ? Math.max(...chartData.map(d => d.price)).toFixed(8)
                : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">24h Low</p>
            <p className="text-sm font-mono">
              {chartData.length > 0 
                ? Math.min(...chartData.map(d => d.price)).toFixed(8)
                : '—'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
