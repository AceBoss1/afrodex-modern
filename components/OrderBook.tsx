// components/OrderBook.tsx
'use client';

import { useAppStore } from '@/lib/store';
import { formatAmount } from '@/lib/exchange';
import { Token } from '@/lib/tokens';

interface OrderBookProps {
  baseToken: Token;
  quoteToken: Token;
}

export default function OrderBook({ baseToken, quoteToken }: OrderBookProps) {
  const { buyOrders, sellOrders, isLoadingOrders } = useAppStore();

  if (isLoadingOrders) {
    return (
      <div className="card h-full flex items-center justify-center">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="card h-full flex flex-col">
      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
        <span className="neon-text">Order Book</span>
        <span className="text-sm text-gray-400">
          {baseToken.symbol}/{quoteToken.symbol}
        </span>
      </h3>

      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Sell Orders (Asks) */}
        <div className="flex-1 overflow-y-auto mb-2">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-afrodex-black-light">
              <tr>
                <th className="text-left">Price ({quoteToken.symbol})</th>
                <th className="text-right">Amount ({baseToken.symbol})</th>
                <th className="text-right">Total ({quoteToken.symbol})</th>
              </tr>
            </thead>
            <tbody>
              {sellOrders.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center text-gray-500 py-4">
                    No sell orders
                  </td>
                </tr>
              ) : (
                [...sellOrders].reverse().map((order, idx) => {
                  const amount = parseFloat(formatAmount(order.availableVolume || order.amountGet, baseToken.decimals));
                  const price = order.price || 0;
                  const total = amount * price;

                  return (
                    <tr key={idx} className="hover:bg-afrodex-black-lighter cursor-pointer">
                      <td className="text-red-500">{price.toFixed(6)}</td>
                      <td className="text-right">{amount.toFixed(4)}</td>
                      <td className="text-right">{total.toFixed(4)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Spread */}
        <div className="py-2 text-center border-y border-gray-800">
          {sellOrders.length > 0 && buyOrders.length > 0 ? (
            <div className="text-sm">
              <span className="text-gray-400">Spread: </span>
              <span className="text-afrodex-orange font-semibold">
                {((sellOrders[0].price! - buyOrders[0].price!) / buyOrders[0].price! * 100).toFixed(2)}%
              </span>
            </div>
          ) : (
            <div className="text-sm text-gray-500">No spread</div>
          )}
        </div>

        {/* Buy Orders (Bids) */}
        <div className="flex-1 overflow-y-auto mt-2">
          <table className="w-full text-xs">
            <tbody>
              {buyOrders.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center text-gray-500 py-4">
                    No buy orders
                  </td>
                </tr>
              ) : (
                buyOrders.map((order, idx) => {
                  const amount = parseFloat(formatAmount(order.availableVolume || order.amountGet, baseToken.decimals));
                  const price = order.price || 0;
                  const total = amount * price;

                  return (
                    <tr key={idx} className="hover:bg-afrodex-black-lighter cursor-pointer">
                      <td className="text-green-500">{price.toFixed(6)}</td>
                      <td className="text-right">{amount.toFixed(4)}</td>
                      <td className="text-right">{total.toFixed(4)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
