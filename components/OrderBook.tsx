// components/OrderBook.tsx
'use client';

import { useMemo, useState } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { ethers } from 'ethers';
import { useTradingStore, useUIStore } from '@/lib/store';
import { formatAmount, formatOrderBookPrice, formatOrderBookAmount, executeTrade, SignedOrder, preTradeCheck } from '@/lib/exchange';
import { Token } from '@/lib/tokens';
import { recordTrade, deactivateOrderByHash } from '@/lib/supabase';
import { ArrowDown, ArrowUp, BookOpen, Loader2 } from 'lucide-react';

interface OrderBookProps {
  baseToken: Token;
  quoteToken: Token;
}

export default function OrderBook({ baseToken, quoteToken }: OrderBookProps) {
  const { buyOrders, sellOrders, isLoadingOrders, trades, setOrders, addTrade } = useTradingStore();
  const { setSelectedPrice, setOrderTab } = useUIStore();
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  
  const [executingOrder, setExecutingOrder] = useState<string | null>(null);
  const [executeError, setExecuteError] = useState<string | null>(null);

  // Process orders for display
  const processedOrders = useMemo(() => {
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

  // Handle clicking on an order - EXECUTE the trade
  const handleOrderClick = async (orderData: typeof processedOrders.buys[0], isSellOrder: boolean) => {
    const order = orderData.order;
    
    console.log('=== ORDER CLICK ===');
    console.log('Order:', order);
    console.log('isSellOrder:', isSellOrder);
    console.log('Order hash:', order.hash);
    
    // If order doesn't have signature, just set price
    if (!order.v || !order.r || !order.s) {
      console.log('No signature found - just setting price');
      setSelectedPrice(orderData.price.toString());
      setOrderTab(isSellOrder ? 'buy' : 'sell');
      setExecuteError('This order has no signature - cannot execute directly');
      setTimeout(() => setExecuteError(null), 3000);
      return;
    }

    // If not connected or no wallet, just set price
    if (!isConnected || !walletClient) {
      console.log('Wallet not connected - just setting price');
      setSelectedPrice(orderData.price.toString());
      setOrderTab(isSellOrder ? 'buy' : 'sell');
      setExecuteError('Connect wallet to execute orders');
      setTimeout(() => setExecuteError(null), 3000);
      return;
    }

    // Don't take your own order
    if (order.user?.toLowerCase() === address?.toLowerCase()) {
      setExecuteError("Can't take your own order");
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

      // Execute full amount available
      const amountToTrade = order.availableVolume || order.amountGet;
      
      // Pre-trade check
      console.log('Running pre-trade check...');
      const preCheck = await preTradeCheck(provider, signedOrder, amountToTrade, address!);
      
      if (!preCheck.canTrade) {
        console.error('Pre-trade check failed:', preCheck.reason);
        setExecuteError(preCheck.reason || 'Trade validation failed');
        setTimeout(() => setExecuteError(null), 8000);
        setExecutingOrder(null);
        return;
      }
      
      console.log('Pre-trade check passed, executing trade...');
      
      const tx = await executeTrade(signer, signedOrder, amountToTrade);
      console.log('Trade tx:', tx.hash);
      
      const receipt = await tx.wait();
      console.log('Trade confirmed!', receipt);

      // Get block info for timestamp
      const block = await provider.getBlock(receipt!.blockNumber);
      const timestamp = block?.timestamp ? Number(block.timestamp) : Math.floor(Date.now() / 1000);

      // Calculate trade details
      const baseAmount = parseFloat(formatAmount(
        isSellOrder ? order.amountGive : order.amountGet,
        baseToken.decimals
      ));
      const quoteAmount = parseFloat(formatAmount(
        isSellOrder ? order.amountGet : order.amountGive,
        quoteToken.decimals
      ));
      const tradePrice = orderData.price;

      // Record trade to Supabase
      console.log('=== RECORDING TRADE ===');
      try {
        const tradeResult = await recordTrade({
          tx_hash: tx.hash,
          log_index: 0,
          token_get: order.tokenGet,
          amount_get: order.amountGet,
          token_give: order.tokenGive,
          amount_give: order.amountGive,
          maker: order.user,
          taker: address!,
          block_number: receipt!.blockNumber,
          block_timestamp: new Date(timestamp * 1000).toISOString(),
          base_token: baseToken.address,
          quote_token: quoteToken.address,
          side: isSellOrder ? 'buy' : 'sell',
          price: tradePrice,
          base_amount: baseAmount,
          quote_amount: quoteAmount,
        });

        if (!tradeResult.success) {
          console.error('Failed to record trade to Supabase:', tradeResult.error);
        } else {
          console.log('Trade recorded to Supabase successfully!');
        }
      } catch (recordErr) {
        console.error('Exception recording trade:', recordErr);
      }

      // Deactivate the order in Supabase
      console.log('=== DEACTIVATING ORDER ===');
      const orderHashToDeactivate = order.hash || signedOrder.hash;
      console.log('Order hash to deactivate:', orderHashToDeactivate);
      
      if (orderHashToDeactivate) {
        try {
          const deactivated = await deactivateOrderByHash(orderHashToDeactivate);
          console.log('Order deactivation result:', deactivated);
        } catch (deactivateErr) {
          console.error('Exception deactivating order:', deactivateErr);
        }
      }

      // Add trade to local state
      addTrade({
        txHash: tx.hash,
        blockNumber: receipt!.blockNumber,
        timestamp,
        tokenGet: order.tokenGet,
        amountGet: order.amountGet,
        tokenGive: order.tokenGive,
        amountGive: order.amountGive,
        maker: order.user,
        taker: address!,
        price: tradePrice,
        side: isSellOrder ? 'buy' : 'sell',
        baseAmount,
        quoteAmount,
      });

      // Remove order from local state immediately
      console.log('=== REMOVING ORDER FROM LOCAL STATE ===');
      console.log('Filtering orders with nonce:', order.nonce, 'expires:', order.expires, 'user:', order.user);
      
      const updatedBuyOrders = buyOrders.filter(o => {
        const shouldKeep = !(o.nonce === order.nonce && o.expires === order.expires && o.user?.toLowerCase() === order.user?.toLowerCase());
        if (!shouldKeep) console.log('Removing buy order:', o);
        return shouldKeep;
      });
      
      const updatedSellOrders = sellOrders.filter(o => {
        const shouldKeep = !(o.nonce === order.nonce && o.expires === order.expires && o.user?.toLowerCase() === order.user?.toLowerCase());
        if (!shouldKeep) console.log('Removing sell order:', o);
        return shouldKeep;
      });
      
      console.log('Orders before:', { buyOrders: buyOrders.length, sellOrders: sellOrders.length });
      console.log('Orders after:', { buyOrders: updatedBuyOrders.length, sellOrders: updatedSellOrders.length });
      
      setOrders(updatedBuyOrders, updatedSellOrders);
      
      console.log('Trade complete!');
      
    } catch (err: any) {
      console.error('Trade execution error:', err);
      if (err.code === 'ACTION_REJECTED') {
        setExecuteError('Transaction rejected');
      } else if (err.reason) {
        setExecuteError(err.reason);
      } else if (err.message?.includes('insufficient')) {
        setExecuteError('Insufficient balance in exchange');
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

      {/* Error message */}
      {executeError && (
        <div className="text-xs text-red-400 bg-red-500/10 p-2 rounded mb-2">
          {executeError}
        </div>
      )}

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
            processedOrders.sells.map((orderData, idx) => {
              const orderKey = orderData.order.hash || `${orderData.order.nonce}-${orderData.order.expires}`;
              const isExecuting = executingOrder === orderKey;
              
              return (
                <div
                  key={`sell-${idx}`}
                  onClick={() => !isExecuting && handleOrderClick(orderData, true)}
                  className={`orderbook-row orderbook-row-sell cursor-pointer ${isExecuting ? 'opacity-50' : ''}`}
                  style={{ '--depth': `${orderData.depth}%` } as React.CSSProperties}
                  title="Click to buy at this price"
                >
                  <span className="text-trade-sell font-mono text-[11px] flex items-center gap-1">
                    {isExecuting && <Loader2 className="w-3 h-3 animate-spin" />}
                    {formatOrderBookPrice(orderData.price)}
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
          processedOrders.buys.map((orderData, idx) => {
            const orderKey = orderData.order.hash || `${orderData.order.nonce}-${orderData.order.expires}`;
            const isExecuting = executingOrder === orderKey;
            
            return (
              <div
                key={`buy-${idx}`}
                onClick={() => !isExecuting && handleOrderClick(orderData, false)}
                className={`orderbook-row orderbook-row-buy cursor-pointer ${isExecuting ? 'opacity-50' : ''}`}
                style={{ '--depth': `${orderData.depth}%` } as React.CSSProperties}
                title="Click to sell at this price"
              >
                <span className="text-trade-buy font-mono text-[11px] flex items-center gap-1">
                  {isExecuting && <Loader2 className="w-3 h-3 animate-spin" />}
                  {formatOrderBookPrice(orderData.price)}
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
