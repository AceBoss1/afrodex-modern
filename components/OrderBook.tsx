// components/OrderBook.tsx
'use client';

import { useMemo } from 'react';
import { useTradingStore, useUIStore } from '@/lib/store';
import { formatAmount, formatOrderBookPrice, formatOrderBookAmount } from '@/lib/exchange';
import { Token } from '@/lib/tokens';
import { ArrowDown, ArrowUp, BookOpen } from 'lucide-react';

interface OrderBookProps {
  baseToken: Token;
  quoteToken: Token;
}

export default function OrderBook({ baseToken, quoteToken }: OrderBookProps) {
  const { buyOrders, sellOrders, isLoadingOrders, trades } = useTradingStore();
  const { setSelectedPrice, setOrderTab } = useUIStore();

  // Process orders for display
  const processedOrders = useMemo(() => {
    // Calculate max total for depth visualization
    const allTotals = [
      ...buyOrders.map(o => parseFloat(formatAmount(o.amountGet, baseToken.decimals)) * (o.price || 0)),
      ...sellOrders.map(o => parseFloat(formatAmount(o.amountGive, baseToken.decimals)) * (o.price || 0)),
    ];
    const maxTotal = Math.max(...allTotals, 0.001);

    const formatOrder = (order: typeof buyOrders[0], isBuy: boolean) => {
      const amount = parseFloat(formatAmount(
        isBuy ? order.amountGet : order.amountGive,
        baseToken.decimals
      ));
      const price = order.price || 0;
      const total = amount * price;
      const depth = (total / maxTotal) * 100;

      return { price, amount, total, depth, order };
    };

    return {
      buys: buyOrders.slice(0, 15).map(o => formatOrder(o, true)),
      sells: sellOrders.slice(0, 15).map(o => formatOrder(o, false)),
    };
  }, [buyOrders, sellOrders, baseToken.decimals]);

  // Get spread info
  const spreadInfo = useMemo(() => {
    if (sellOrders.length === 0 || buyOrders.length === 0) {
      return { spread: 0, spreadPercent: 0, midPrice: 0 };
    }

    const bestAsk = sellOrders[0].price || 0;
    const bestBid = buyOrders[0].price || 0;
    const spread = bestAsk - bestBid;
    const spreadPercent = bestBid > 0 ? (spread / bestBid) * 100 : 0;
    const midPrice = (bestAsk + bestBid) / 2;

    return { spread, spreadPercent, midPrice };
  }, [sellOrders, buyOrders]);

  // Get last trade for mid display
  const lastTrade = trades.length > 0 ? trades[0] : null;

  // Handle clicking on an order
  const handleOrderClick = (price: number, isBuy: boolean) => {
    setSelectedPrice(price.toString());
    setOrderTab(isBuy ? 'sell' : 'buy'); // If clicking buy order, user wants to sell, and vice versa
  };

  if (isLoadingOrders) {
    return (
      <div className="card h-full flex items-center justify-center">
        <div className="text-center">
          <div className="spinner spinner-lg mb-3" />
          <p className="text-sm text-gray-500">Loading order book...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-afrodex-orange" />
          Order Book
        </h3>
        <span className="text-xs text-gray-500">
          {baseToken.symbol}/{quoteToken.symbol}
        </span>
      </div>

      {/* Column Headers */}
      <div className="grid grid-cols-3 text-xs text-gray-500 pb-2 border-b border-white/5">
        <span>Price ({quoteToken.symbol})</span>
        <span className="text-right">Amount ({baseToken.symbol})</span>
        <span className="text-right">Total</span>
      </div>

      {/* Sell Orders (Asks) - Reversed so lowest price is at bottom */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="flex flex-col-reverse">
          {processedOrders.sells.length === 0 ? (
            <div className="py-4 text-center text-gray-600 text-xs">
              No sell orders
            </div>
          ) : (
            processedOrders.sells.map((order, idx) => (
              <div
                key={`sell-${idx}`}
                onClick={() => handleOrderClick(order.price, false)}
                className="orderbook-row orderbook-row-sell cursor-pointer"
                style={{ '--depth': `${order.depth}%` } as React.CSSProperties}
              >
                <span className="text-trade-sell font-mono text-[11px]" title={order.price.toString()}>
                  {formatOrderBookPrice(order.price)}
                </span>
                <span className="text-right font-mono text-gray-300 text-[11px]" title={order.amount.toString()}>
                  {formatOrderBookAmount(order.amount)}
                </span>
                <span className="text-right font-mono text-gray-500 text-[11px]" title={order.total.toString()}>
                  {formatOrderBookAmount(order.total)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Spread / Mid Price */}
      <div className="py-2 border-y border-white/5 bg-afrodex-black-lighter/50">
        <div className="flex items-center justify-center">
          {lastTrade ? (
            <span className={`text-base font-bold font-mono flex items-center gap-1 ${
              lastTrade.side === 'buy' ? 'text-trade-buy' : 'text-trade-sell'
            }`}>
              {lastTrade.side === 'buy' ? (
                <ArrowUp className="w-3 h-3" />
              ) : (
                <ArrowDown className="w-3 h-3" />
              )}
              {formatOrderBookPrice(lastTrade.price)}
            </span>
          ) : (
            <span className="text-gray-500 text-sm">No recent trades</span>
          )}
        </div>
        {spreadInfo.spread > 0 && (
          <div className="text-center text-[10px] text-gray-500 mt-1">
            Spread: {spreadInfo.spreadPercent.toFixed(2)}%
          </div>
        )}
      </div>

      {/* Buy Orders (Bids) */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {processedOrders.buys.length === 0 ? (
          <div className="py-4 text-center text-gray-600 text-xs">
            No buy orders
          </div>
        ) : (
          processedOrders.buys.map((order, idx) => (
            <div
              key={`buy-${idx}`}
              onClick={() => handleOrderClick(order.price, true)}
              className="orderbook-row orderbook-row-buy cursor-pointer"
              style={{ '--depth': `${order.depth}%` } as React.CSSProperties}
            >
              <span className="text-trade-buy font-mono text-[11px]" title={order.price.toString()}>
                {formatOrderBookPrice(order.price)}
              </span>
              <span className="text-right font-mono text-gray-300 text-[11px]" title={order.amount.toString()}>
                {formatOrderBookAmount(order.amount)}
              </span>
              <span className="text-right font-mono text-gray-500 text-[11px]" title={order.total.toString()}>
                {formatOrderBookAmount(order.total)}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Footer Stats */}
      <div className="pt-3 border-t border-white/5 grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-gray-500">Bids: </span>
          <span className="text-trade-buy font-medium">{buyOrders.length}</span>
        </div>
        <div className="text-right">
          <span className="text-gray-500">Asks: </span>
          <span className="text-trade-sell font-medium">{sellOrders.length}</span>
        </div>
      </div>
    </div>
  );
}
