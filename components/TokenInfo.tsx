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
  AlertTriangle,
} from 'lucide-react';
import { Token } from '@/lib/tokens';
import { useTradingStore } from '@/lib/store';
import { formatOrderBookPrice, formatDisplayAmount } from '@/lib/exchange';

interface TokenInfoProps {
  token: Token;
}

export default function TokenInfo({ token }: TokenInfoProps) {
  const { trades } = useTradingStore();
  const [copied, setCopied] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Reset image error when token changes
  useEffect(() => {
    setImageError(false);
  }, [token.address]);

  // Calculate price stats from trades
  const priceStats = (() => {
    if (trades.length === 0) {
      return { currentPrice: 0, priceChange: 0, high24h: 0, low24h: 0, volume24h: 0, trades24h: 0 };
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

    return { currentPrice, priceChange, high24h, low24h, volume24h, trades24h: trades24h.length };
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
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <div className="relative w-14 h-14 flex-shrink-0">
            <Image
              src={imageError ? '/tokens/empty-token.png' : token.logo}
              alt={token.symbol}
              fill
              className="rounded-xl object-cover shadow-lg"
              onError={() => setImageError(true)}
              priority
            />
            {token.isCustom && (
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-3 h-3 text-black" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl font-display font-bold">{token.symbol}</h2>
              <span className="text-gray-500">/</span>
              <span className="text-gray-400">ETH</span>
              {token.isCustom && (
                <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 text-[10px] font-bold rounded">
                  UNLISTED
                </span>
              )}
            </div>
            
            <p className="text-sm text-gray-400 mb-1">{token.name}</p>
            
            {/* Description - with warning style for custom tokens */}
            <p className={`text-xs mb-2 line-clamp-3 ${
              token.isCustom ? 'text-yellow-400/80' : 'text-gray-500'
            }`}>
              {token.description}
            </p>

            {/* Contract Address & Links Row */}
            <div className="flex items-center flex-wrap gap-x-4 gap-y-1">
              <div className="flex items-center gap-1">
                <code className="text-xs text-gray-500 font-mono bg-afrodex-black-lighter px-2 py-0.5 rounded">
                  {token.address.slice(0, 6)}...{token.address.slice(-4)}
                </code>
                <button
                  onClick={handleCopyAddress}
                  className="p-1 hover:bg-white/5 rounded transition-colors"
                  title="Copy address"
                >
                  {copied ? (
                    <Check className="w-3 h-3 text-green-400" />
                  ) : (
                    <Copy className="w-3 h-3 text-gray-500" />
                  )}
                </button>
              </div>
              
              {token.website && (
                <a
                  href={token.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-afrodex-orange hover:text-afrodex-orange-light transition-colors"
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
                  className="flex items-center gap-1 text-xs text-afrodex-orange hover:text-afrodex-orange-light transition-colors"
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
                  className="flex items-center gap-1 text-xs text-afrodex-orange hover:text-afrodex-orange-light transition-colors"
                >
                  <BarChart3 className="w-3 h-3" />
                  Tracker
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Price Stats - Compact 2-Row Grid */}
        <div className="lg:border-l lg:border-white/5 lg:pl-4 flex-shrink-0">
          {/* Row 1: Price & Volume */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-2">
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Price</p>
              <p className="text-sm font-bold font-mono" title={priceStats.currentPrice.toString()}>
                {priceStats.currentPrice > 0 ? formatOrderBookPrice(priceStats.currentPrice) : '—'}
                <span className="text-xs text-gray-500 ml-1">ETH</span>
              </p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">24h Volume</p>
              <p className="text-sm font-bold font-mono" title={priceStats.volume24h.toString()}>
                {priceStats.volume24h > 0 ? formatDisplayAmount(priceStats.volume24h) : '—'}
                <span className="text-xs text-gray-500 ml-1">ETH</span>
              </p>
            </div>
          </div>
          
          {/* Row 2: Change, High, Low, Trades */}
          <div className="grid grid-cols-4 gap-x-2">
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">24h Change</p>
              <p className={`text-xs font-semibold flex items-center gap-1 ${
                priceStats.priceChange > 0 ? 'text-trade-buy' : 
                priceStats.priceChange < 0 ? 'text-trade-sell' : 'text-gray-400'
              }`}>
                {priceStats.priceChange !== 0 && (
                  priceStats.priceChange > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />
                )}
                {priceStats.priceChange !== 0 
                  ? `${priceStats.priceChange > 0 ? '+' : ''}${priceStats.priceChange.toFixed(2)}%`
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">24h High</p>
              <p className="text-xs font-mono" title={priceStats.high24h.toString()}>
                {priceStats.high24h > 0 ? formatOrderBookPrice(priceStats.high24h) : '—'}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">24h Low</p>
              <p className="text-xs font-mono" title={priceStats.low24h.toString()}>
                {priceStats.low24h > 0 ? formatOrderBookPrice(priceStats.low24h) : '—'}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Trades</p>
              <p className="text-xs font-mono">
                {priceStats.trades24h > 0 ? priceStats.trades24h : '—'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
