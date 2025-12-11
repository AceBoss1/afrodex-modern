// components/TokenInfoCard.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Token, ZERO_ADDRESS } from '@/lib/tokens';
import { useTradingStore } from '@/lib/store';
import { 
  TrendingUp, 
  TrendingDown, 
  ExternalLink,
  Globe,
  BarChart3,
  Activity
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface TokenInfoCardProps {
  token: Token;
  quoteToken: Token;
}

// Format number with up to 15 significant digits
function formatPrecise(value: number, maxDecimals: number = 15): string {
  if (value === 0) return '0';
  if (isNaN(value) || !isFinite(value)) return '0';
  
  const absValue = Math.abs(value);
  
  if (absValue >= 1) {
    return value.toLocaleString('en-US', { 
      minimumFractionDigits: 2,
      maximumFractionDigits: Math.min(6, maxDecimals)
    });
  }
  
  // For small numbers, show up to 15 significant digits
  const str = value.toFixed(maxDecimals);
  // Remove trailing zeros but keep at least some precision
  return str.replace(/\.?0+$/, '') || '0';
}

// Format USD value
function formatUSD(value: number): string {
  if (value === 0) return '$0.00';
  if (value < 0.01) {
    return '$' + value.toFixed(8);
  }
  return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Format ETH value with high precision
function formatETH(value: number): string {
  if (value === 0) return '0';
  return formatPrecise(value, 15) + ' ETH';
}

export default function TokenInfoCard({ token, quoteToken }: TokenInfoCardProps) {
  const { trades, buyOrders, sellOrders } = useTradingStore();
  const [ethPrice, setEthPrice] = useState<number>(3500); // Default ETH price in USD
  const [priceChange24h, setPriceChange24h] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch ETH price from CoinGecko
  useEffect(() => {
    const fetchEthPrice = async () => {
      try {
        const response = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd&include_24hr_change=true'
        );
        const data = await response.json();
        if (data.ethereum) {
          setEthPrice(data.ethereum.usd || 3500);
          setPriceChange24h(data.ethereum.usd_24h_change || 0);
        }
      } catch (err) {
        console.error('Failed to fetch ETH price:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEthPrice();
    // Refresh every 60 seconds
    const interval = setInterval(fetchEthPrice, 60000);
    return () => clearInterval(interval);
  }, []);

  // Calculate market data
  const marketData = useMemo(() => {
    // Get best bid and ask
    const bestBid = buyOrders.length > 0 ? buyOrders[0].price || 0 : 0;
    const bestAsk = sellOrders.length > 0 ? sellOrders[0].price || 0 : 0;

    // Get last price from trades
    const lastTrade = trades.length > 0 ? trades[0] : null;
    const lastPrice = lastTrade?.price || bestAsk || bestBid || 0;

    // Calculate 24h volume from trades
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const trades24h = trades.filter(t => (t.timestamp || 0) * 1000 > oneDayAgo);
    
    // Volume in base token (e.g., AFDLT)
    const volume24hBase = trades24h.reduce((sum, t) => sum + (t.baseAmount || 0), 0);
    // Volume in quote token (ETH)
    const volume24hETH = trades24h.reduce((sum, t) => sum + (t.quoteAmount || 0), 0);
    
    // Price in USD
    const priceUSD = lastPrice * ethPrice;
    const volume24hUSD = volume24hETH * ethPrice;

    // Calculate 24h price change
    let change24h = 0;
    if (trades24h.length > 1) {
      const oldestPrice = trades24h[trades24h.length - 1].price || lastPrice;
      if (oldestPrice > 0) {
        change24h = ((lastPrice - oldestPrice) / oldestPrice) * 100;
      }
    }

    return {
      lastPrice,
      priceUSD,
      bestBid,
      bestAsk,
      volume24hETH,
      volume24hUSD,
      change24h,
    };
  }, [trades, buyOrders, sellOrders, ethPrice]);

  // Generate chart data from trades (show price in ETH)
  const chartData = useMemo(() => {
    if (trades.length === 0) {
      // Generate placeholder data
      return Array.from({ length: 24 }, (_, i) => ({
        time: i,
        price: 0.0001 + Math.random() * 0.00005,
      }));
    }

    // Group trades by hour and get average price
    const hourlyData: { [key: number]: { prices: number[]; time: number } } = {};
    
    trades.slice(0, 100).forEach(trade => {
      const timestamp = (trade.timestamp || 0) * 1000;
      const hour = Math.floor(timestamp / (60 * 60 * 1000));
      
      if (!hourlyData[hour]) {
        hourlyData[hour] = { prices: [], time: timestamp };
      }
      hourlyData[hour].prices.push(trade.price || 0);
    });

    const data = Object.entries(hourlyData)
      .map(([_, { prices, time }]) => ({
        time,
        price: prices.reduce((a, b) => a + b, 0) / prices.length,
      }))
      .sort((a, b) => a.time - b.time)
      .slice(-24);

    return data.length > 0 ? data : [{ time: Date.now(), price: marketData.lastPrice }];
  }, [trades, marketData.lastPrice]);

  const isPositive = marketData.change24h >= 0;

  return (
    <div className="card h-full flex flex-col">
      {/* Token Info Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-afrodex-orange to-afrodex-gold flex items-center justify-center text-lg font-bold text-white">
            {token.symbol.charAt(0)}
          </div>
          <div>
            <h3 className="font-semibold text-white">{token.symbol}</h3>
            <p className="text-xs text-gray-500">{token.name}</p>
          </div>
        </div>
        <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
          isPositive ? 'bg-trade-buy/20 text-trade-buy' : 'bg-trade-sell/20 text-trade-sell'
        }`}>
          {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {isPositive ? '+' : ''}{marketData.change24h.toFixed(2)}%
        </div>
      </div>

      {/* Price Chart - Increased height */}
      <div className="h-40 mb-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={isPositive ? '#00C853' : '#ff4444'} stopOpacity={0.3} />
                <stop offset="100%" stopColor={isPositive ? '#00C853' : '#ff4444'} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="time" hide />
            <YAxis 
              hide 
              domain={['dataMin', 'dataMax']}
              tickFormatter={(value) => formatPrecise(value, 15)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              formatter={(value: number) => [formatPrecise(value, 15) + ' ETH', 'Price']}
              labelFormatter={(label) => {
                if (typeof label === 'number' && label > 1000000000) {
                  return new Date(label).toLocaleTimeString();
                }
                return '';
              }}
            />
            <Area
              type="monotone"
              dataKey="price"
              stroke={isPositive ? '#00C853' : '#ff4444'}
              fill="url(#priceGradient)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Analytics - 3 Rows Layout */}
      <div className="space-y-3 flex-1">
        {/* Row 1: Price and 24H Volume in USD */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-xs text-gray-500">Price</span>
            <p className="text-sm font-mono text-white">
              {formatUSD(marketData.priceUSD)}
            </p>
          </div>
          <div>
            <span className="text-xs text-gray-500">24H Vol</span>
            <p className="text-sm font-mono text-white">
              {formatUSD(marketData.volume24hUSD)}
            </p>
          </div>
        </div>

        {/* Row 2: Bid/Ask and 24H Volume in ETH */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex gap-4">
            <div>
              <span className="text-xs text-gray-500">Bid</span>
              <p className="text-sm font-mono text-trade-buy">
                {formatPrecise(marketData.bestBid, 15)}
              </p>
            </div>
            <div>
              <span className="text-xs text-gray-500">Ask</span>
              <p className="text-sm font-mono text-trade-sell">
                {marketData.bestAsk > 0 ? formatPrecise(marketData.bestAsk, 15) : '0'}
              </p>
            </div>
          </div>
          <div>
            <span className="text-xs text-gray-500">24H Vol</span>
            <p className="text-sm font-mono text-gray-300">
              {formatETH(marketData.volume24hETH)}
            </p>
          </div>
        </div>

        {/* Row 3: Links */}
        <div className="flex items-center justify-between pt-2 border-t border-white/5">
          {token.website ? (
            <a
              href={token.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-afrodex-orange transition-colors"
            >
              <Globe className="w-3 h-3" />
              Website
            </a>
          ) : (
            <span className="text-xs text-gray-600">Website</span>
          )}
          
          <a
            href={`https://etherscan.io/token/${token.address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-afrodex-orange transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            Etherscan
          </a>
          
          <a
            href={`https://dexscreener.com/ethereum/${token.address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-afrodex-orange transition-colors"
          >
            <BarChart3 className="w-3 h-3" />
            Tracker
          </a>
        </div>
      </div>
    </div>
  );
}
