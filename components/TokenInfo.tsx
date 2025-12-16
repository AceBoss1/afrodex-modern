// components/TokenInfo.tsx
'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Copy, Check, Globe, FileText, BarChart3 } from 'lucide-react';
import { Token } from '@/lib/tokens';
import { useTradingStore } from '@/lib/store';
import { formatOrderBookPrice, formatDisplayAmount } from '@/lib/exchange';

interface TokenInfoProps {
  token: Token;
}

export default function TokenInfo({ token }: TokenInfoProps) {
  const { trades, buyOrders, sellOrders } = useTradingStore();
  const [copied, setCopied] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [ethUsdPrice, setEthUsdPrice] = useState<number>(0);

  useEffect(() => {
    setImageError(false);
  }, [token.address]);

  // Fetch ETH/USD price from CoinGecko
  useEffect(() => {
    const fetchEthPrice = async () => {
      try {
        const response = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd'
        );
        const data = await response.json();
        if (data.ethereum?.usd) {
          setEthUsdPrice(data.ethereum.usd);
        }
      } catch (error) {
        console.error('Error fetching ETH price:', error);
        setEthUsdPrice(3500); // Fallback
      }
    };

    fetchEthPrice();
    const interval = setInterval(fetchEthPrice, 60000);
    return () => clearInterval(interval);
  }, []);

  const priceStats = (() => {
    if (trades.length === 0) {
      return { currentPrice: 0, priceChange: 0, volume24h: 0 };
    }

    const now = Date.now() / 1000;
    const oneDayAgo = now - 24 * 60 * 60;
    const trades24h = trades.filter(t => t.timestamp >= oneDayAgo);

    const currentPrice = trades[0]?.price || 0;
    const oldPrice = trades24h.length > 0 ? trades24h[trades24h.length - 1].price : currentPrice;
    const priceChange = oldPrice > 0 ? ((currentPrice - oldPrice) / oldPrice) * 100 : 0;
    const volume24h = trades24h.reduce((sum, t) => sum + t.quoteAmount, 0);

    return { currentPrice, priceChange, volume24h };
  })();

  const depth = (() => {
    const totalBidETH = buyOrders.reduce((sum, o) => sum + (o.price ? parseFloat(o.amountGive) / 1e18 : 0), 0);
    const totalAskETH = sellOrders.reduce((sum, o) => sum + (o.price ? parseFloat(o.amountGet) / 1e18 : 0), 0);
    return { totalBidETH, totalAskETH };
  })();

  const priceUsd = priceStats.currentPrice * ethUsdPrice;
  const volume24hUsd = priceStats.volume24h * ethUsdPrice;

  const formatUsdPrice = (usdValue: number): string => {
    if (usdValue === 0) return '$0.00';
    if (usdValue < 0.000001) return `$${usdValue.toFixed(12)}`;
    if (usdValue < 0.01) return `$${usdValue.toFixed(8)}`;
    if (usdValue < 1) return `$${usdValue.toFixed(6)}`;
    return `$${usdValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatVolumeUsd = (usdValue: number): string => {
    if (usdValue === 0) return '$0.00';
    if (usdValue < 0.01) return `$${usdValue.toFixed(6)}`;
    if (usdValue < 1000) return `$${usdValue.toFixed(2)}`;
    return `$${usdValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

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
      <div className="flex gap-4">
        {/* LEFT SIDE: Token Info */}
        <div className="flex gap-3 w-[280px] flex-shrink-0">
          <div className="relative w-10 h-10 flex-shrink-0">
            <Image
              src={imageError ? '/tokens/empty-token.png' : token.logo}
              alt={token.symbol}
              fill
              className="rounded-xl object-cover"
              onError={() => setImageError(true)}
              priority
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <h2 className="text-base font-display font-bold">{token.symbol}</h2>
              <span className="text-gray-500 text-sm">/</span>
              <span className="text-gray-400 text-xs">ETH</span>
              <span className="text-gray-500 text-xs truncate">{token.name}</span>
            </div>
            
            <p className="text-[10px] text-gray-500 mb-1 line-clamp-2 leading-tight">
              {token.description}
            </p>

            <div className="flex items-center gap-1">
              <code className="text-[10px] text-gray-500 font-mono">
                {token.address.slice(0, 6)}...{token.address.slice(-4)}
              </code>
              <button
                onClick={handleCopyAddress}
                className="p-0.5 hover:bg-white/5 rounded transition-colors"
                title="Copy address"
              >
                {copied ? (
                  <Check className="w-2.5 h-2.5 text-green-400" />
                ) : (
                  <Copy className="w-2.5 h-2.5 text-gray-500" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT SIDE: Analytics - 3 ROWS */}
        <div className="flex-1 border-l border-white/5 pl-4">
          {/* Row 1: Price (USD) | 24H Vol (USD) */}
          <div className="flex items-center gap-6 mb-1">
            <div>
              <span className="text-[10px] text-gray-500 uppercase">Price </span>
              <span className="text-sm font-bold font-mono">
                {priceUsd > 0 ? formatUsdPrice(priceUsd) : '—'}
              </span>
              <span className={`text-[10px] ml-1 ${
                priceStats.priceChange > 0 ? 'text-trade-buy' : 
                priceStats.priceChange < 0 ? 'text-trade-sell' : 'text-gray-400'
              }`}>
                {priceStats.priceChange !== 0 
                  ? `${priceStats.priceChange > 0 ? '+' : ''}${priceStats.priceChange.toFixed(2)}%`
                  : ''}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-gray-500 uppercase">24H Vol </span>
              <span className="text-sm font-bold font-mono">
                {volume24hUsd > 0 ? formatVolumeUsd(volume24hUsd) : '—'}
              </span>
            </div>
          </div>
          
          {/* Row 2: Bid(ETH) | Ask(ETH) */}
          <div className="flex items-center gap-6 mb-1">
            <div>
              <span className="text-[10px] text-gray-500">Bid:</span>
              <span className="text-sm font-mono text-trade-buy ml-1">{formatDisplayAmount(depth.totalBidETH)}</span>
              <span className="text-[10px] text-gray-500 ml-0.5">ETH</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-500">Ask:</span>
              <span className="text-sm font-mono text-trade-sell ml-1">{formatDisplayAmount(depth.totalAskETH)}</span>
              <span className="text-[10px] text-gray-500 ml-0.5">ETH</span>
            </div>
          </div>

          {/* Row 3: Links */}
          <div className="flex items-center gap-4">
            {token.website && (
              <a href={token.website} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-afrodex-orange hover:text-afrodex-orange-light transition-colors">
                <Globe className="w-3 h-3" />Website
              </a>
            )}
            {token.etherscan && (
              <a href={token.etherscan} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-afrodex-orange hover:text-afrodex-orange-light transition-colors">
                <FileText className="w-3 h-3" />Etherscan
              </a>
            )}
            {token.tracker && (
              <a href={token.tracker} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-afrodex-orange hover:text-afrodex-orange-light transition-colors">
                <BarChart3 className="w-3 h-3" />Tracker
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
