// components/TradeHistory.tsx
'use client';

import { useAppStore } from '@/lib/store';
import { formatAmount } from '@/lib/exchange';
import { Token } from '@/lib/tokens';
import { format } from 'date-fns';
import { ExternalLink } from 'lucide-react';

interface TradeHistoryProps {
  baseToken: Token;
  quoteToken: Token;
}

export default function TradeHistory({ baseToken, quoteToken }: TradeHistoryProps) {
  const { trades, isLoadingTrades } = useAppStore();

  if (isLoadingTrades) {
    return (
      <div className="card h-full flex items-center justify-center">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="card h-full flex flex-col">
      <h3 className="text-lg font-semibold mb-3 neon-text">Trade History</h3>

      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-afrodex-black-light">
            <tr>
              <th className="text-left">Time</th>
              <th className="text-left">Type</th>
              <th className="text-right">Price</th>
              <th className="text-right">Amount</th>
              <th className="text-right">Total</th>
              <th className="text-center">Tx</th>
            </tr>
          </thead>
          <tbody>
            {trades.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center text-gray-500 py-8">
                  No trades yet
                </td>
              </tr>
            ) : (
              trades.map((trade, idx) => {
                const amount = parseFloat(
                  formatAmount(
                    trade.side === 'buy' ? trade.amountGet : trade.amountGive,
                    baseToken.decimals
                  )
                );
                const total = amount * trade.price;

                return (
                  <tr key={idx} className="hover:bg-afrodex-black-lighter">
                    <td className="text-gray-400">
                      {format(new Date(trade.timestamp * 1000), 'HH:mm:ss')}
                    </td>
                    <td>
                      <span className={trade.side === 'buy' ? 'text-green-500' : 'text-red-500'}>
                        {trade.side.toUpperCase()}
                      </span>
                    </td>
                    <td className="text-right">{trade.price.toFixed(6)}</td>
                    <td className="text-right">{amount.toFixed(4)}</td>
                    <td className="text-right">{total.toFixed(4)}</td>
                    <td className="text-center">
                      <a
                        href={`https://etherscan.io/tx/${trade.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-afrodex-orange hover:text-afrodex-orange-light"
                      >
                        <ExternalLink className="w-3 h-3 inline" />
                      </a>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
