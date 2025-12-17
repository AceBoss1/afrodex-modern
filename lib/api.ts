// lib/api.ts
// API functions for fetching orders and trades from Supabase

import { 
  getOrdersFromDb, 
  getTradesFromDb, 
  DbOrder, 
  DbTrade,
  getSupabaseClient,
} from './supabase';
import { EXCHANGE_ADDRESS, formatAmount, calculateOrderPrice } from './exchange';
import { Token, ZERO_ADDRESS } from './tokens';

export interface ProcessedOrder {
  tokenGet: string;
  amountGet: string;
  tokenGive: string;
  amountGive: string;
  expires: string;
  nonce: string;
  user: string;
  side: 'buy' | 'sell';
  price: number;
  availableVolume?: string;
  amountFilled?: string;
  v?: number;
  r?: string;
  s?: string;
  hash?: string;
}

export interface ProcessedTrade {
  txHash: string;
  blockNumber: number;
  timestamp: number;
  tokenGet: string;
  amountGet: string;
  tokenGive: string;
  amountGive: string;
  maker: string;
  taker: string;
  price: number;
  side: 'buy' | 'sell';
  baseAmount: number;
  quoteAmount: number;
}

/**
 * Fetch orders from Supabase
 */
export async function fetchOrders(
  baseToken: Token,
  quoteToken: Token
): Promise<{ buyOrders: ProcessedOrder[]; sellOrders: ProcessedOrder[] }> {
  console.log('Fetching orders from Supabase...');
  
  const orders = await getOrdersFromDb(baseToken.address, quoteToken.address);
  
  const buyOrders: ProcessedOrder[] = [];
  const sellOrders: ProcessedOrder[] = [];

  for (const order of orders) {
    // Debug logging for signature verification
    console.log('=== LOADING ORDER FROM DB ===');
    console.log('DB v:', order.v, 'type:', typeof order.v);
    console.log('DB r:', order.r, 'length:', order.r?.length);
    console.log('DB s:', order.s, 'length:', order.s?.length);
    console.log('DB hash:', order.order_hash);
    console.log('=============================');

    const processed: ProcessedOrder = {
      tokenGet: order.token_get,
      amountGet: order.amount_get,
      tokenGive: order.token_give,
      amountGive: order.amount_give,
      expires: order.expires,
      nonce: order.nonce,
      user: order.user_address,
      side: order.side,
      price: order.price,
      availableVolume: order.amount_get,
      amountFilled: order.amount_filled,
      v: order.v,
      r: order.r,
      s: order.s,
      hash: order.order_hash,
    };

    if (order.side === 'buy') {
      buyOrders.push(processed);
    } else {
      sellOrders.push(processed);
    }
  }

  console.log(`Got ${buyOrders.length} buy, ${sellOrders.length} sell orders from Supabase`);
  return { buyOrders, sellOrders };
}

/**
 * Fetch trades from Supabase
 */
export async function fetchTrades(
  baseToken: Token,
  quoteToken: Token
): Promise<ProcessedTrade[]> {
  console.log('Fetching trades from Supabase...');
  
  const trades = await getTradesFromDb(baseToken.address, quoteToken.address);
  
  const processed = trades.map((trade: DbTrade) => ({
    txHash: trade.tx_hash,
    blockNumber: trade.block_number,
    timestamp: trade.block_timestamp ? new Date(trade.block_timestamp).getTime() / 1000 : Date.now() / 1000,
    tokenGet: trade.token_get,
    amountGet: trade.amount_get,
    tokenGive: trade.token_give,
    amountGive: trade.amount_give,
    maker: trade.maker,
    taker: trade.taker,
    price: trade.price,
    side: trade.side,
    baseAmount: trade.base_amount,
    quoteAmount: trade.quote_amount,
  }));

  console.log(`Got ${processed.length} trades from Supabase`);
  return processed;
}

/**
 * Subscribe to trades using Supabase realtime (no eth filters)
 */
export function subscribeToTrades(
  baseToken: Token,
  quoteToken: Token,
  callback: (trade: ProcessedTrade) => void
): () => void {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.log('Supabase not configured, skipping trade subscription');
    return () => {};
  }

  const channel = supabase
    .channel('trades-realtime')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'trades',
        filter: `base_token=eq.${baseToken.address.toLowerCase()}`,
      },
      (payload) => {
        const trade = payload.new as DbTrade;
        callback({
          txHash: trade.tx_hash,
          blockNumber: trade.block_number,
          timestamp: trade.block_timestamp ? new Date(trade.block_timestamp).getTime() / 1000 : Date.now() / 1000,
          tokenGet: trade.token_get,
          amountGet: trade.amount_get,
          tokenGive: trade.token_give,
          amountGive: trade.amount_give,
          maker: trade.maker,
          taker: trade.taker,
          price: trade.price,
          side: trade.side,
          baseAmount: trade.base_amount,
          quoteAmount: trade.quote_amount,
        });
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Subscribe to orders using Supabase realtime (no eth filters)
 */
export function subscribeToOrders(
  baseToken: Token,
  quoteToken: Token,
  callback: (order: ProcessedOrder) => void
): () => void {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.log('Supabase not configured, skipping order subscription');
    return () => {};
  }

  const channel = supabase
    .channel('orders-realtime')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'orders',
        filter: `base_token=eq.${baseToken.address.toLowerCase()}`,
      },
      (payload) => {
        const order = payload.new as DbOrder;
        if (!order.v || !order.r || !order.s) return; // Skip invalid orders
        
        callback({
          tokenGet: order.token_get,
          amountGet: order.amount_get,
          tokenGive: order.token_give,
          amountGive: order.amount_give,
          expires: order.expires,
          nonce: order.nonce,
          user: order.user_address,
          side: order.side,
          price: order.price,
          availableVolume: order.amount_get,
          amountFilled: order.amount_filled,
          v: order.v,
          r: order.r,
          s: order.s,
          hash: order.order_hash,
        });
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Poll for order updates (fallback when realtime doesn't work)
 */
export function startOrderPolling(
  baseToken: Token,
  quoteToken: Token,
  onUpdate: (buyOrders: ProcessedOrder[], sellOrders: ProcessedOrder[]) => void,
  intervalMs: number = 10000
): () => void {
  let isActive = true;

  const poll = async () => {
    if (!isActive) return;
    
    try {
      const { buyOrders, sellOrders } = await fetchOrders(baseToken, quoteToken);
      onUpdate(buyOrders, sellOrders);
    } catch (err) {
      console.error('Order polling error:', err);
    }
    
    if (isActive) {
      setTimeout(poll, intervalMs);
    }
  };

  // Start polling
  poll();

  return () => {
    isActive = false;
  };
}

/**
 * Poll for trade updates (fallback when realtime doesn't work)
 */
export function startTradePolling(
  baseToken: Token,
  quoteToken: Token,
  onUpdate: (trades: ProcessedTrade[]) => void,
  intervalMs: number = 15000
): () => void {
  let isActive = true;

  const poll = async () => {
    if (!isActive) return;
    
    try {
      const trades = await fetchTrades(baseToken, quoteToken);
      onUpdate(trades);
    } catch (err) {
      console.error('Trade polling error:', err);
    }
    
    if (isActive) {
      setTimeout(poll, intervalMs);
    }
  };

  // Start polling
  poll();

  return () => {
    isActive = false;
  };
}
