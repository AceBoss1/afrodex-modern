// components/TokenInfo.tsx
'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { 
  ExternalLink, 
  Copy, 
  Check, 
  TrendingUp, 
  TrendingDown,
  Globe,
  FileText,
  BarChart3,
} from 'lucide-react';
import { Token } from '@/lib/tokens';
import { useTradingStore } from '@/lib/store';

interface TokenInfoProps {
  token: Token;
}

export default function TokenInfo({ token }: TokenInfoProps) {
  const { trades } = useTradingStore();
  const [copied, setCopied] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Calculate price stats from trades
  const priceStats = (() => {
    if (trades.length === 0) {
      return { currentPrice: 0, priceChange: 0, high24h: 0, low24h: 0, volume24h: 0 };
    }

    const now = Date.now() / 1000;
    const oneDayAgo = now - 24 * 60 * 60;
    const trades24h = trades.filter(t => t.timestamp >= oneDayAgo);

    const currentPrice = trades[0]?.price || 0;
    const oldPrice = trades24h.length > 0 ? trades24h[trades24h.length - 1].price : currentPrice;
    const priceChange = oldPrice > 0 ? ((currentPrice - oldPrice) / oldPrice) * 100 : 0;

    const prices = trades24h.map(t => t.price);
    const high24h = prices.length > 0 ? Math.max(...prices) : 0;
    const low24h = prices.length > 0 ? Math.min(...prices) : 0;
    const volume24h = trades24h.reduce((sum, t) => sum + t.quoteAmount, 0);

    return { currentPrice, priceChange, high24h, low24h, volume24h };
  })();

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(token.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  return (
    <div className="card-neon">
      <div className="flex flex-col lg:flex-row lg:items-start gap-4">
        {/* Token Logo & Basic Info */}
        <div className="flex items-start gap-4 flex-1">
          <div className="relative w-16 h-16 flex-shrink-0">
            <Image
              src={imageError ? '/tokens/empty-token.png' : token.logo}
              alt={token.symbol}
              fill
              className="rounded-2xl object-cover shadow-lg"
              onError={() => setImageError(true)}
              priority
            />
            {token.isCustom && (
              <div className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-afrodex-orange text-[10px] font-bold rounded-md">
                CUSTOM
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-2xl font-display font-bold">{token.symbol}</h2>
              <span className="text-gray-500">/</span>
              <span className="text-lg text-gray-400">ETH</span>
            </div>
            
            <p className="text-sm text-gray-400 mb-2">{token.name}</p>
            
            <p className="text-sm text-gray-500 line-clamp-2 mb-3">
              {token.description}
            </p>

            {/* Contract Address */}
            <div className="flex items-center gap-2">
              <code className="text-xs text-gray-500 font-mono bg-afrodex-black-lighter px-2 py-1 rounded">
                {token.address.slice(0, 10)}...{token.address.slice(-8)}
              </code>
              <button
                onClick={handleCopyAddress}
                className="p-1 hover:bg-white/5 rounded transition-colors"
                title="Copy address"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-green-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-gray-500" />
                )}
              </button>
            </div>

            {/* External Links */}
            <div className="flex flex-wrap gap-2 mt-3">
              {token.website && (
                <a
                  href={token.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-afrodex-orange hover:text-afrodex-orange-light transition-colors"
                >
                  <Globe className="w-3 h-3" />
                  Website
                </a>
              )}
              {token.etherscan && (
                <a
                  href={token.etherscan}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-afrodex-orange hover:text-afrodex-orange-light transition-colors"
                >
                  <FileText className="w-3 h-3" />
                  Etherscan
                </a>
              )}
              {token.tracker && (
                <a
                  href={token.tracker}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-afrodex-orange hover:text-afrodex-orange-light transition-colors"
                >
                  <BarChart3 className="w-3 h-3" />
                  Tracker
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Price Stats */}
        <div className="flex flex-wrap gap-4 lg:gap-6 pt-4 lg:pt-0 lg:border-l lg:border-white/5 lg:pl-6">
          {/* Current Price */}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Price</p>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold font-mono">
                {priceStats.currentPrice > 0 
                  ? priceStats.currentPrice.toFixed(8)
                  : '—'
                }
              </span>
              <span className="text-sm text-gray-500">ETH</span>
            </div>
          </div>

          {/* 24h Change */}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">24h Change</p>
            <div className={`flex items-center gap-1 text-lg font-semibold ${
              priceStats.priceChange >= 0 ? 'text-trade-buy' : 'text-trade-sell'
            }`}>
              {priceStats.priceChange >= 0 ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
              {priceStats.priceChange !== 0 
                ? `${priceStats.priceChange >= 0 ? '+' : ''}${priceStats.priceChange.toFixed(2)}%`
                : '—'
              }
            </div>
          </div>

          {/* 24h High */}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">24h High</p>
            <p className="text-sm font-mono">
              {priceStats.high24h > 0 ? priceStats.high24h.toFixed(8) : '—'}
            </p>
          </div>

          {/* 24h Low */}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">24h Low</p>
            <p className="text-sm font-mono">
              {priceStats.low24h > 0 ? priceStats.low24h.toFixed(8) : '—'}
            </p>
          </div>

          {/* 24h Volume */}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">24h Volume</p>
            <p className="text-sm font-mono">
              {priceStats.volume24h > 0 
                ? `${priceStats.volume24h.toFixed(4)} ETH`
                : '—'
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
