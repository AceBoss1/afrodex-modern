// components/OrderBook.tsx
'use client';

import { useMemo, useState } from 'react';
import { useAccount, useWalletClient, usePublicClient } from 'wagmi';
import { ethers } from 'ethers';
import { useTradingStore, useUIStore } from '@/lib/store';
import { formatAmount, formatOrderBookPrice, formatOrderBookAmount, executeTrade, SignedOrder, preTradeCheck } from '@/lib/exchange';
import { Token, ZERO_ADDRESS } from '@/lib/tokens';
import { deactivateOrderByHash, updateOrderFilled, saveTradeAfterExecution } from '@/lib/supabase';
import { ArrowDown, ArrowUp, BookOpen, Loader2 } from 'lucide-react';

interface OrderBookProps {
  baseToken: Token;
  quoteToken: Token;
}

interface OrderData {
  tokenGet: string;
  amountGet: string;
  tokenGive: string;
  amountGive: string;
  expires: string;
  nonce: string;
  user: string;
  side?: 'buy' | 'sell';
  price?: number;
  v?: number;
  r?: string;
  s?: string;
  hash?: string;
  availableVolume?: string;
  amountFilled?: string;
  created_at?: string;
}

interface AggregatedOrder {
  price: number;
  amount: number;
  total: number;
  depth: number;
  orders: OrderData[];
}

export default function OrderBook({ baseToken, quoteToken }: OrderBookProps) {
  const { buyOrders, sellOrders, isLoadingOrders, trades, setOrders, removeOrder, addTrade } = useTradingStore();
  const { setSelectedPrice, setOrderTab } = useUIStore();
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  
  const [executingOrder, setExecutingOrder] = useState<string | null>(null);
  const [executeError, setExecuteError] = useState<string | null>(null);

  // Process and AGGREGATE orders by price for display
  const processedOrders = useMemo(() => {
    // Helper to aggregate orders by price
    const aggregateByPrice = (orders: typeof buyOrders, isBuy: boolean): AggregatedOrder[] => {
      const priceMap = new Map<string, AggregatedOrder>();
      
      // Sort orders by created_at (first come first served)
      const sortedOrders = [...orders].sort((a, b) => {
        const aTime = (a as any).created_at ? new Date((a as any).created_at).getTime() : 0;
        const bTime = (b as any).created_at ? new Date((b as any).created_at).getTime() : 0;
        return aTime - bTime; // Oldest first
      });
      
      sortedOrders.forEach(order => {
        const amount = parseFloat(formatAmount(
          isBuy ? order.amountGet : order.amountGive,
          baseToken.decimals
        ));
        const price = order.price || 0;
        const total = amount * price;
        
        // Use price as key (rounded to avoid floating point issues)
        const priceKey = price.toFixed(18);
        
        if (priceMap.has(priceKey)) {
          const existing = priceMap.get(priceKey)!;
          existing.amount += amount;
          existing.total += total;
          existing.orders.push(order);
        } else {
          priceMap.set(priceKey, {
            price,
            amount,
            total,
            depth: 0,
            orders: [order],
          });
        }
      });
      
      return Array.from(priceMap.values());
    };
    
    const aggregatedBuys = aggregateByPrice(buyOrders, true);
    const aggregatedSells = aggregateByPrice(sellOrders, false);
    
    // Calculate depth percentages
    const allTotals = [
      ...aggregatedBuys.map(o => o.total),
      ...aggregatedSells.map(o => o.total),
    ];
    const maxTotal = Math.max(...allTotals, 0.001);
    
    aggregatedBuys.forEach(o => o.depth = (o.total / maxTotal) * 100);
    aggregatedSells.forEach(o => o.depth = (o.total / maxTotal) * 100);
    
    // Sort: buys descending by price, sells ascending by price
    const sortedBuys = aggregatedBuys.sort((a, b) => b.price - a.price).slice(0, 15);
    const sortedSells = aggregatedSells.sort((a, b) => a.price - b.price).slice(0, 15);

    return {
      buys: sortedBuys,
      sells: sortedSells,
    };
  }, [buyOrders, sellOrders, baseToken.decimals]);

  // Get spread info
  const spreadInfo = useMemo(() => {
    if (processedOrders.sells.length === 0 || processedOrders.buys.length === 0) {
      return { spread: 0, spreadPercent: 0, midPrice: 0 };
    }

    const bestAsk = processedOrders.sells[0].price;
    const bestBid = processedOrders.buys[0].price;
    const spread = bestAsk - bestBid;
    const spreadPercent = bestBid > 0 ? (spread / bestBid) * 100 : 0;
    const midPrice = (bestAsk + bestBid) / 2;

    return { spread, spreadPercent, midPrice };
  }, [processedOrders]);

  const lastTrade = trades.length > 0 ? trades[0] : null;

  // Find the first executable order (not owned by current user)
  const findExecutableOrder = (orders: OrderData[]): OrderData | null => {
    for (const order of orders) {
      // Skip orders without valid signature
      if (!order.v || !order.r || !order.s) continue;
      // Skip user's own orders
      if (order.user?.toLowerCase() === address?.toLowerCase()) continue;
      // Found a valid order
      return order;
    }
    return null;
  };

  // Handle clicking on an aggregated order row
  const handleOrderClick = async (aggregatedOrder: AggregatedOrder, isSellOrder: boolean) => {
    // Find the first executable order at this price level (skipping user's own orders)
    const order = findExecutableOrder(aggregatedOrder.orders);
    
    if (!order) {
      // If all orders at this price are user's own, just set the price for new order
      setSelectedPrice(aggregatedOrder.price.toString());
      setOrderTab(isSellOrder ? 'buy' : 'sell');
      
      // Check if there are only user's own orders
      const hasOwnOrders = aggregatedOrder.orders.some(o => 
        o.user?.toLowerCase() === address?.toLowerCase()
      );
      
      if (hasOwnOrders) {
        setExecuteError("All orders at this price are yours - can't self-trade");
      } else {
        setExecuteError('No executable orders at this price - place a new order');
      }
      setTimeout(() => setExecuteError(null), 3000);
      return;
    }

    if (!isConnected || !walletClient) {
      setSelectedPrice(aggregatedOrder.price.toString());
      setOrderTab(isSellOrder ? 'buy' : 'sell');
      setExecuteError('Connect wallet to execute orders');
      setTimeout(() => setExecuteError(null), 3000);
      return;
    }

    const orderKey = order.hash || `${order.nonce}-${order.expires}`;
    setExecutingOrder(orderKey);
    setExecuteError(null);

    try {
      const provider = new ethers.BrowserProvider(walletClient as any);
      const signer = await provider.getSigner();

      const signedOrder: SignedOrder = {
        tokenGet: order.tokenGet,
        amountGet: order.amountGet,
        tokenGive: order.tokenGive,
        amountGive: order.amountGive,
        expires: order.expires,
        nonce: order.nonce,
        user: order.user,
        v: Number(order.v),
        r: order.r!,
        s: order.s!,
        hash: order.hash || '',
      };

      const amountToTrade = order.availableVolume || order.amountGet;
      
      // Pre-trade validation
      const preCheck = await preTradeCheck(provider, signedOrder, amountToTrade, address!);
      
      if (!preCheck.canTrade) {
        setExecuteError(preCheck.reason || 'Trade validation failed');
        setTimeout(() => setExecuteError(null), 8000);
        setExecutingOrder(null);
        return;
      }
      
      console.log('=== EXECUTING TRADE ===');
      console.log('Order hash:', order.hash);
      console.log('Maker:', order.user);
      console.log('Taker:', address);
      console.log('Amount:', amountToTrade);
      
      // Execute the trade on-chain
      const tx = await executeTrade(signer, signedOrder, amountToTrade);
      console.log('Trade TX sent:', tx.hash);
      
      const receipt = await tx.wait();
      console.log('Trade TX confirmed, block:', receipt?.blockNumber);
      
      // === CRITICAL: Post-trade updates ===
      
      // Calculate gas fee in ETH for TGIF rewards (with fallback)
      let gasFeeEth = 0.0003; // Default estimate for a trade
      try {
        if (receipt && receipt.gasUsed && receipt.gasPrice) {
          gasFeeEth = Number(ethers.formatEther(receipt.gasUsed * receipt.gasPrice));
        } else if (receipt && receipt.gasUsed) {
          // Fallback: use estimated gas price
          try {
            const gasPrice = await provider.getFeeData();
            if (gasPrice.gasPrice) {
              gasFeeEth = Number(ethers.formatEther(receipt.gasUsed * gasPrice.gasPrice));
            }
          } catch (feeErr) {
            console.warn('Could not get fee data, using default');
          }
        }
      } catch (gasErr) {
        console.warn('Gas fee calculation error, using default:', gasErr);
      }
      console.log('Gas fee ETH:', gasFeeEth);
      
      // 1. Deactivate/update the order in Supabase
      const orderHash = order.hash;
      if (orderHash) {
        try {
          console.log('Deactivating order:', orderHash);
          const deactivated = await deactivateOrderByHash(orderHash);
          console.log('Order deactivated:', deactivated);
        } catch (deactErr) {
          console.error('Error deactivating order:', deactErr);
        }
      }
      
      // 2. Remove order from local state immediately
      if (orderHash) {
        removeOrder(orderHash);
      }
      
      // 3. Filter out the executed order from store
      const updatedBuyOrders = buyOrders.filter(o => 
        !(o.nonce === order.nonce && o.user?.toLowerCase() === order.user?.toLowerCase())
      );
      const updatedSellOrders = sellOrders.filter(o => 
        !(o.nonce === order.nonce && o.user?.toLowerCase() === order.user?.toLowerCase())
      );
      setOrders(updatedBuyOrders, updatedSellOrders);
      console.log('Local orders updated');
      
      // 4. Calculate trade amounts for recording
      const baseAmount = parseFloat(formatAmount(
        isSellOrder ? order.amountGive : order.amountGet,
        baseToken.decimals
      ));
      const quoteAmount = parseFloat(formatAmount(
        isSellOrder ? order.amountGet : order.amountGive,
        quoteToken.decimals
      ));
      
      // 5. Save trade to Supabase (this also records TGIF stats)
      console.log('Saving trade to Supabase...');
      try {
        const saveResult = await saveTradeAfterExecution(
          {
            txHash: tx.hash,
            tokenGet: order.tokenGet,
            amountGet: order.amountGet,
            tokenGive: order.tokenGive,
            amountGive: order.amountGive,
            maker: order.user,
            taker: address!,
            blockNumber: receipt?.blockNumber || 0,
            blockTimestamp: new Date().toISOString(),
            baseToken: baseToken.address,
            quoteToken: quoteToken.address,
            side: isSellOrder ? 'buy' : 'sell',
            price: aggregatedOrder.price,
            baseAmount: baseAmount,
            quoteAmount: quoteAmount,
          },
          gasFeeEth  // Pass gas fee for TGIF rewards calculation
        );
        console.log('Trade save result:', saveResult);
      } catch (saveErr) {
        console.error('Error saving trade to Supabase:', saveErr);
      }
      
      // 6. Add trade to local state for immediate UI update
      addTrade({
        txHash: tx.hash,
        blockNumber: receipt?.blockNumber || 0,
        timestamp: Math.floor(Date.now() / 1000),
        tokenGet: order.tokenGet,
        amountGet: order.amountGet,
        tokenGive: order.tokenGive,
        amountGive: order.amountGive,
        maker: order.user,
        taker: address!,
        price: aggregatedOrder.price,
        side: isSellOrder ? 'buy' : 'sell',
        baseAmount: baseAmount,
        quoteAmount: quoteAmount,
      });
      
      console.log('=== TRADE COMPLETE ===');
      
    } catch (err: any) {
      console.error('Trade execution error:', err);
      if (err.code === 'ACTION_REJECTED') {
        setExecuteError('Transaction rejected');
      } else if (err.reason) {
        setExecuteError(err.reason);
      } else if (err.message?.includes('insufficient')) {
        setExecuteError('Insufficient balance');
      } else {
        setExecuteError(err.message || 'Trade failed');
      }
      setTimeout(() => setExecuteError(null), 5000);
    } finally {
      setExecutingOrder(null);
    }
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
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-afrodex-orange" />
          Order Book
        </h3>
        <span className="text-xs text-gray-500">
          {baseToken.symbol}/{quoteToken.symbol}
        </span>
      </div>

      {executeError && (
        <div className="text-xs text-red-400 bg-red-500/10 p-2 rounded mb-2">
          {executeError}
        </div>
      )}

      <div className="grid grid-cols-3 text-xs text-gray-500 pb-2 border-b border-white/5">
        <span>Price ({quoteToken.symbol})</span>
        <span className="text-right">Amount ({baseToken.symbol})</span>
        <span className="text-right">Total</span>
      </div>

      {/* Sell Orders (asks) - displayed in reverse so lowest ask is at bottom near spread */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="flex flex-col-reverse">
          {processedOrders.sells.length === 0 ? (
            <div className="py-4 text-center text-gray-600 text-xs">No sell orders</div>
          ) : (
            processedOrders.sells.map((orderData, idx) => {
              const isExecuting = orderData.orders.some(o => 
                executingOrder === (o.hash || `${o.nonce}-${o.expires}`)
              );
              const hasOwnOrder = orderData.orders.some(o => 
                o.user?.toLowerCase() === address?.toLowerCase()
              );
              const executableOrder = findExecutableOrder(orderData.orders);
              
              return (
                <div
                  key={`sell-${idx}-${orderData.price}`}
                  onClick={() => !isExecuting && handleOrderClick(orderData, true)}
                  className={`orderbook-row orderbook-row-sell cursor-pointer ${isExecuting ? 'opacity-50' : ''} ${hasOwnOrder ? 'border-l-2 border-afrodex-orange' : ''}`}
                  style={{ '--depth': `${orderData.depth}%` } as React.CSSProperties}
                  title={`Click to buy ${formatOrderBookAmount(orderData.amount)} at ${formatOrderBookPrice(orderData.price)} (${orderData.orders.length} order${orderData.orders.length > 1 ? 's' : ''}${hasOwnOrder ? ' - includes your order' : ''})`}
                >
                  <span className="text-trade-sell font-mono text-[11px] flex items-center gap-1">
                    {isExecuting && <Loader2 className="w-3 h-3 animate-spin" />}
                    {formatOrderBookPrice(orderData.price)}
                    {hasOwnOrder && <span className="text-afrodex-orange text-[9px]">•</span>}
                  </span>
                  <span className="text-right font-mono text-gray-300 text-[11px]">
                    {formatOrderBookAmount(orderData.amount)}
                  </span>
                  <span className="text-right font-mono text-gray-500 text-[11px]">
                    {formatOrderBookAmount(orderData.total)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Spread / Last Trade Price */}
      <div className="py-2 border-y border-white/5 bg-afrodex-black-lighter/50">
        <div className="flex items-center justify-center">
          {lastTrade ? (
            <span className={`text-base font-bold font-mono flex items-center gap-1 ${
              lastTrade.side === 'buy' ? 'text-trade-buy' : 'text-trade-sell'
            }`}>
              {lastTrade.side === 'buy' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
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

      {/* Buy Orders (bids) */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {processedOrders.buys.length === 0 ? (
          <div className="py-4 text-center text-gray-600 text-xs">No buy orders</div>
        ) : (
          processedOrders.buys.map((orderData, idx) => {
            const isExecuting = orderData.orders.some(o => 
              executingOrder === (o.hash || `${o.nonce}-${o.expires}`)
            );
            const hasOwnOrder = orderData.orders.some(o => 
              o.user?.toLowerCase() === address?.toLowerCase()
            );
            
            return (
              <div
                key={`buy-${idx}-${orderData.price}`}
                onClick={() => !isExecuting && handleOrderClick(orderData, false)}
                className={`orderbook-row orderbook-row-buy cursor-pointer ${isExecuting ? 'opacity-50' : ''} ${hasOwnOrder ? 'border-l-2 border-afrodex-orange' : ''}`}
                style={{ '--depth': `${orderData.depth}%` } as React.CSSProperties}
                title={`Click to sell ${formatOrderBookAmount(orderData.amount)} at ${formatOrderBookPrice(orderData.price)} (${orderData.orders.length} order${orderData.orders.length > 1 ? 's' : ''}${hasOwnOrder ? ' - includes your order' : ''})`}
              >
                <span className="text-trade-buy font-mono text-[11px] flex items-center gap-1">
                  {isExecuting && <Loader2 className="w-3 h-3 animate-spin" />}
                  {formatOrderBookPrice(orderData.price)}
                  {hasOwnOrder && <span className="text-afrodex-orange text-[9px]">•</span>}
                </span>
                <span className="text-right font-mono text-gray-300 text-[11px]">
                  {formatOrderBookAmount(orderData.amount)}
                </span>
                <span className="text-right font-mono text-gray-500 text-[11px]">
                  {formatOrderBookAmount(orderData.total)}
                </span>
              </div>
            );
          })
        )}
      </div>

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
