// components/TradingChart.tsx
'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { Token } from '@/lib/tokens';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

interface TradingChartProps {
  baseToken: Token;
  quoteToken: Token;
}

export default function TradingChart({ baseToken, quoteToken }: TradingChartProps) {
  const { trades } = useAppStore();
  const [chartData, setChartData] = useState<any[]>([]);
  const [timeframe, setTimeframe] = useState<'1H' | '24H' | '7D' | 'ALL'>('24H');

  useEffect(() => {
    if (trades.length === 0) {
      setChartData([]);
      return;
    }

    // Group trades by time intervals
    const now = Date.now();
    const intervals: { [key: string]: number } = {
      '1H': 60 * 60 * 1000,
      '24H': 24 * 60 * 60 * 1000,
      '7D': 7 * 24 * 60 * 60 * 1000,
      'ALL': Infinity,
    };

    const timeLimit = now - intervals[timeframe];
    const filteredTrades = trades.filter(t => t.timestamp * 1000 >= timeLimit);

    if (filteredTrades.length === 0) {
      setChartData([]);
      return;
    }

    // Create candlestick-like data points (simplified for line chart)
    const bucketSize = Math.max(1, Math.floor(filteredTrades.length / 50));
    const buckets: any[] = [];

    for (let i = 0; i < filteredTrades.length; i += bucketSize) {
      const bucket = filteredTrades.slice(i, i + bucketSize);
      const avgPrice = bucket.reduce((sum, t) => sum + t.price, 0) / bucket.length;
      const timestamp = bucket[bucket.length - 1].timestamp;

      buckets.push({
        time: format(new Date(timestamp * 1000), 'MMM dd HH:mm'),
        price: avgPrice,
      });
    }

    setChartData(buckets);
  }, [trades, timeframe]);

  const currentPrice = trades.length > 0 ? trades[0].price : 0;
  const priceChange = trades.length > 1 ? ((trades[0].price - trades[trades.length - 1].price) / trades[trades.length - 1].price) * 100 : 0;

  return (
    <div className="card h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-2xl font-bold neon-text">
            {baseToken.symbol}/{quoteToken.symbol}
          </h3>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xl font-semibold">
              {currentPrice.toFixed(6)} {quoteToken.symbol}
            </span>
            <span className={`text-sm ${priceChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Timeframe Selector */}
        <div className="flex gap-1">
          {(['1H', '24H', '7D', 'ALL'] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-3 py-1 rounded text-sm ${
                timeframe === tf
                  ? 'bg-afrodex-orange text-white'
                  : 'bg-afrodex-black-lighter text-gray-400 hover:bg-gray-700'
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
          <div className="h-full flex items-center justify-center text-gray-500">
            No trade data available for this timeframe
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis
                dataKey="time"
                stroke="#666"
                tick={{ fill: '#999', fontSize: 11 }}
              />
              <YAxis
                stroke="#666"
                tick={{ fill: '#999', fontSize: 11 }}
                domain={['auto', 'auto']}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #FF8C00',
                  borderRadius: '4px',
                }}
                labelStyle={{ color: '#FF8C00' }}
              />
              <Line
                type="monotone"
                dataKey="price"
                stroke="#FF8C00"
                strokeWidth={2}
                dot={false}
                name="Price"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-800">
        <div>
          <p className="text-xs text-gray-400">24h Volume</p>
          <p className="text-sm font-semibold">
            {trades.length > 0
              ? trades
                  .filter(t => t.timestamp * 1000 > Date.now() - 24 * 60 * 60 * 1000)
                  .length
              : 0}{' '}
            trades
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-400">24h High</p>
          <p className="text-sm font-semibold">
            {trades.length > 0
              ? Math.max(
                  ...trades
                    .filter(t => t.timestamp * 1000 > Date.now() - 24 * 60 * 60 * 1000)
                    .map(t => t.price)
                ).toFixed(6)
              : '0.000000'}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-400">24h Low</p>
          <p className="text-sm font-semibold">
            {trades.length > 0
              ? Math.min(
                  ...trades
                    .filter(t => t.timestamp * 1000 > Date.now() - 24 * 60 * 60 * 1000)
                    .map(t => t.price)
                ).toFixed(6)
              : '0.000000'}
          </p>
        </div>
      </div>
    </div>
  );
}
