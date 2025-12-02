// components/TradeHistory.tsx
'use client';

import { useTradingStore } from '@/lib/store';
import { Token } from '@/lib/tokens';
import { format } from 'date-fns';
import { ExternalLink, History, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface TradeHistoryProps {
  baseToken: Token;
  quoteToken: Token;
}

export default function TradeHistory({ baseToken, quoteToken }: TradeHistoryProps) {
  const { trades, isLoadingTrades } = useTradingStore();

  if (isLoadingTrades) {
    return (
      <div className="card h-full flex items-center justify-center">
        <div className="text-center">
          <div className="spinner mb-3" />
          <p className="text-sm text-gray-500">Loading trades...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <History className="w-4 h-4 text-afrodex-orange" />
          Recent Trades
        </h3>
        <span className="text-xs text-gray-500">
          {trades.length} trades
        </span>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 text-xs text-gray-500 pb-2 border-b border-white/5">
        <span>Time</span>
        <span>Type</span>
        <span className="text-right">Price</span>
        <span className="text-right">Amount</span>
        <span className="w-6"></span>
      </div>

      {/* Trade List */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {trades.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <History className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">No trades yet</p>
            <p className="text-xs text-gray-600 mt-1">Recent trades will appear here</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {trades.map((trade, idx) => (
              <div
                key={`${trade.txHash}-${idx}`}
                className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 py-2 items-center text-xs hover:bg-white/5 transition-colors"
              >
                {/* Time */}
                <span className="text-gray-400">
                  {format(new Date(trade.timestamp * 1000), 'HH:mm:ss')}
                </span>

                {/* Type */}
                <span className={`flex items-center gap-1 font-medium ${
                  trade.side === 'buy' ? 'text-trade-buy' : 'text-trade-sell'
                }`}>
                  {trade.side === 'buy' ? (
                    <ArrowUpRight className="w-3 h-3" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3" />
                  )}
                  {trade.side.toUpperCase()}
                </span>

                {/* Price */}
                <span className={`text-right font-mono ${
                  trade.side === 'buy' ? 'text-trade-buy' : 'text-trade-sell'
                }`}>
                  {trade.price.toFixed(8)}
                </span>

                {/* Amount */}
                <span className="text-right font-mono text-gray-300">
                  {trade.baseAmount.toFixed(4)}
                </span>

                {/* Etherscan Link */}
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

      {/* Summary Stats */}
      {trades.length > 0 && (
        <div className="pt-3 mt-2 border-t border-white/5">
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <span className="text-gray-500">Buy Vol:</span>
              <span className="ml-1 text-trade-buy font-mono">
                {trades
                  .filter(t => t.side === 'buy')
                  .reduce((sum, t) => sum + t.baseAmount, 0)
                  .toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Sell Vol:</span>
              <span className="ml-1 text-trade-sell font-mono">
                {trades
                  .filter(t => t.side === 'sell')
                  .reduce((sum, t) => sum + t.baseAmount, 0)
                  .toFixed(2)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-gray-500">Trades:</span>
              <span className="ml-1 font-medium">{trades.length}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
