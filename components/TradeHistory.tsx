// components/TradeHistory.tsx
'use client';

import { useState } from 'react';
import { useTradingStore } from '@/lib/store';
import { Token } from '@/lib/tokens';
import { format } from 'date-fns';
import { ExternalLink, History, ArrowUpRight, ArrowDownRight, ChevronLeft, ChevronRight } from 'lucide-react';

interface TradeHistoryProps {
  baseToken: Token;
  quoteToken: Token;
}

const TRADES_PER_PAGE = 10;

// Format price with 15 decimals for very small prices
function formatPrice15(price: number): string {
  if (price === 0) return '0';
  const absPrice = Math.abs(price);
  if (absPrice >= 1) return price.toFixed(6);
  if (absPrice >= 0.0001) return price.toFixed(8);
  if (absPrice >= 0.000001) return price.toFixed(10);
  if (absPrice >= 0.000000001) return price.toFixed(12);
  return price.toFixed(15);
}

// Format amount with appropriate decimals
function formatAmount15(amount: number): string {
  if (amount === 0) return '0';
  const absAmount = Math.abs(amount);
  if (absAmount >= 1000000) return Math.round(amount).toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (absAmount >= 1000) return amount.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (absAmount >= 1) return amount.toFixed(4);
  if (absAmount >= 0.0001) return amount.toFixed(8);
  return amount.toFixed(15);
}

export default function TradeHistory({ baseToken, quoteToken }: TradeHistoryProps) {
  const { trades, isLoadingTrades } = useTradingStore();
  const [currentPage, setCurrentPage] = useState(0);

  const totalPages = Math.ceil(trades.length / TRADES_PER_PAGE);
  const paginatedTrades = trades.slice(
    currentPage * TRADES_PER_PAGE,
    (currentPage + 1) * TRADES_PER_PAGE
  );

  const goToNextPage = () => {
    if (currentPage < totalPages - 1) setCurrentPage(currentPage + 1);
  };

  const goToPrevPage = () => {
    if (currentPage > 0) setCurrentPage(currentPage - 1);
  };

  if (isLoadingTrades) {
    return (
      <div className="card flex items-center justify-center py-8">
        <div className="text-center">
          <div className="spinner mb-3" />
          <p className="text-sm text-gray-500">Loading trades...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <History className="w-4 h-4 text-afrodex-orange" />
          Recent Trades
        </h3>
        <span className="text-xs text-gray-500">{trades.length} trades</span>
      </div>

      <div className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 text-xs text-gray-500 pb-2 border-b border-white/5">
        <span>Time</span>
        <span>Type</span>
        <span className="text-right">Price</span>
        <span className="text-right">Amount</span>
        <span className="w-6"></span>
      </div>

      <div className="min-h-0">
        {trades.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-gray-500">
            <History className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">No trades yet</p>
            <p className="text-xs text-gray-600 mt-1">Recent trades will appear here</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {paginatedTrades.map((trade, idx) => (
              <div
                key={`${trade.txHash}-${idx}`}
                className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 py-2 items-center text-xs hover:bg-white/5 transition-colors"
              >
                <span className="text-gray-400">
                  {format(new Date(trade.timestamp * 1000), 'HH:mm:ss')}
                </span>

                <span className={`flex items-center gap-1 font-medium ${
                  trade.side === 'buy' ? 'text-trade-buy' : 'text-trade-sell'
                }`}>
                  {trade.side === 'buy' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {trade.side.toUpperCase()}
                </span>

                <span 
                  className={`text-right font-mono text-[11px] ${trade.side === 'buy' ? 'text-trade-buy' : 'text-trade-sell'}`}
                  title={formatPrice15(trade.price)}
                >
                  {formatPrice15(trade.price)}
                </span>

                <span className="text-right font-mono text-gray-300 text-[11px]" title={formatAmount15(trade.baseAmount)}>
                  {formatAmount15(trade.baseAmount)}
                </span>

                <a
                  href={`https://etherscan.io/tx/${trade.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 text-gray-500 hover:text-afrodex-orange transition-colors"
                  title="View on Etherscan"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            ))}
          </div>
        )}
      </div>

      {trades.length > TRADES_PER_PAGE && (
        <div className="flex items-center justify-between pt-2 mt-2 border-t border-white/5">
          <button
            onClick={goToPrevPage}
            disabled={currentPage === 0}
            className="p-1 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs text-gray-500">Page {currentPage + 1} of {totalPages}</span>
          <button
            onClick={goToNextPage}
            disabled={currentPage >= totalPages - 1}
            className="p-1 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {trades.length > 0 && (
        <div className="pt-2 mt-2 border-t border-white/5">
          <div className="flex justify-between text-xs">
            <div>
              <span className="text-gray-500">Bids:</span>
              <span className="ml-1 text-trade-buy font-mono">{trades.filter(t => t.side === 'buy').length}</span>
            </div>
            <div>
              <span className="text-gray-500">Asks:</span>
              <span className="ml-1 text-trade-sell font-mono">{trades.filter(t => t.side === 'sell').length}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
