// lib/supabase.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Order, Trade } from './exchange';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Create Supabase client if configured
export const supabase: SupabaseClient | null = 
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

// Check if Supabase is configured
export function isSupabaseConfigured(): boolean {
  return supabase !== null;
}

// ============================================
// Database Types
// ============================================

export interface DbOrder {
  id?: number;
  token_get: string;
  amount_get: string;
  token_give: string;
  amount_give: string;
  expires: string;
  nonce: string;
  user_address: string;
  block_number: number;
  tx_hash: string;
  side: 'buy' | 'sell';
  price: number;
  is_active: boolean;
  amount_filled: string;
  created_at?: string;
}

export interface DbTrade {
  id?: number;
  tx_hash: string;
  block_number: number;
  timestamp: string;
  token_get: string;
  amount_get: string;
  token_give: string;
  amount_give: string;
  maker: string;
  taker: string;
  side: 'buy' | 'sell';
  price: number;
  base_amount: number;
  quote_amount: number;
  base_token: string;
  quote_token: string;
  created_at?: string;
}

export interface SyncStatus {
  event_type: 'orders' | 'trades';
  last_synced_block: number;
  last_sync_time: string;
}

// ============================================
// Order Functions
// ============================================

/**
 * Save orders to Supabase
 */
export async function saveOrders(orders: DbOrder[]): Promise<void> {
  if (!supabase || orders.length === 0) return;
  
  try {
    const { error } = await supabase
      .from('orders')
      .upsert(orders, { 
        onConflict: 'token_get,token_give,nonce,user_address',
        ignoreDuplicates: true 
      });
    
    if (error) {
      console.error('Error saving orders:', error);
    } else {
      console.log(`Saved ${orders.length} orders to Supabase`);
    }
  } catch (error) {
    console.error('Error saving orders:', error);
  }
}

/**
 * Get active orders for a trading pair from Supabase
 */
export async function getOrdersFromDb(
  baseToken: string,
  quoteToken: string,
  currentBlock: number
): Promise<{ buyOrders: Order[]; sellOrders: Order[] }> {
  if (!supabase) return { buyOrders: [], sellOrders: [] };
  
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('is_active', true)
      .gt('expires', currentBlock.toString())
      .or(`and(token_get.eq.${baseToken},token_give.eq.${quoteToken}),and(token_get.eq.${quoteToken},token_give.eq.${baseToken})`);
    
    if (error) {
      console.error('Error fetching orders from DB:', error);
      return { buyOrders: [], sellOrders: [] };
    }
    
    const buyOrders: Order[] = [];
    const sellOrders: Order[] = [];
    
    for (const dbOrder of (data || [])) {
      const order: Order = {
        tokenGet: dbOrder.token_get,
        amountGet: dbOrder.amount_get,
        tokenGive: dbOrder.token_give,
        amountGive: dbOrder.amount_give,
        expires: dbOrder.expires,
        nonce: dbOrder.nonce,
        user: dbOrder.user_address,
        price: dbOrder.price,
        side: dbOrder.side,
        availableVolume: dbOrder.amount_get,
        amountFilled: dbOrder.amount_filled,
      };
      
      if (dbOrder.side === 'buy') {
        buyOrders.push(order);
      } else {
        sellOrders.push(order);
      }
    }
    
    // Sort orders
    buyOrders.sort((a, b) => (b.price || 0) - (a.price || 0));
    sellOrders.sort((a, b) => (a.price || 0) - (b.price || 0));
    
    return { buyOrders, sellOrders };
  } catch (error) {
    console.error('Error getting orders from DB:', error);
    return { buyOrders: [], sellOrders: [] };
  }
}

/**
 * Mark an order as inactive (filled or cancelled)
 */
export async function deactivateOrder(
  tokenGet: string,
  tokenGive: string,
  nonce: string,
  userAddress: string
): Promise<void> {
  if (!supabase) return;
  
  try {
    await supabase
      .from('orders')
      .update({ is_active: false })
      .eq('token_get', tokenGet)
      .eq('token_give', tokenGive)
      .eq('nonce', nonce)
      .eq('user_address', userAddress);
  } catch (error) {
    console.error('Error deactivating order:', error);
  }
}

// ============================================
// Trade Functions
// ============================================

/**
 * Save trades to Supabase
 */
export async function saveTrades(trades: DbTrade[]): Promise<void> {
  if (!supabase || trades.length === 0) return;
  
  try {
    const { error } = await supabase
      .from('trades')
      .upsert(trades, { 
        onConflict: 'tx_hash,token_get,amount_get,maker',
        ignoreDuplicates: true 
      });
    
    if (error) {
      console.error('Error saving trades:', error);
    } else {
      console.log(`Saved ${trades.length} trades to Supabase`);
    }
  } catch (error) {
    console.error('Error saving trades:', error);
  }
}

/**
 * Get trades for a trading pair from Supabase
 */
export async function getTradesFromDb(
  baseToken: string,
  quoteToken: string,
  limit: number = 100
): Promise<Trade[]> {
  if (!supabase) return [];
  
  try {
    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .eq('base_token', baseToken.toLowerCase())
      .eq('quote_token', quoteToken.toLowerCase())
      .order('timestamp', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('Error fetching trades from DB:', error);
      return [];
    }
    
    return (data || []).map((dbTrade): Trade => ({
      txHash: dbTrade.tx_hash,
      blockNumber: dbTrade.block_number,
      timestamp: new Date(dbTrade.timestamp).getTime() / 1000,
      tokenGet: dbTrade.token_get,
      amountGet: dbTrade.amount_get,
      tokenGive: dbTrade.token_give,
      amountGive: dbTrade.amount_give,
      maker: dbTrade.maker,
      taker: dbTrade.taker,
      side: dbTrade.side,
      price: dbTrade.price,
      baseAmount: dbTrade.base_amount,
      quoteAmount: dbTrade.quote_amount,
    }));
  } catch (error) {
    console.error('Error getting trades from DB:', error);
    return [];
  }
}

// ============================================
// Sync Status Functions
// ============================================

/**
 * Get last synced block for a specific event type
 */
export async function getLastSyncedBlock(eventType: 'orders' | 'trades'): Promise<number> {
  if (!supabase) return 9100009; // Default start block
  
  try {
    const { data, error } = await supabase
      .from('sync_status')
      .select('last_synced_block')
      .eq('event_type', eventType)
      .single();
    
    if (error || !data) {
      return 9100009; // Default start block
    }
    
    return data.last_synced_block;
  } catch (error) {
    return 9100009;
  }
}

/**
 * Update last synced block
 */
export async function updateSyncStatus(eventType: 'orders' | 'trades', blockNumber: number): Promise<void> {
  if (!supabase) return;
  
  try {
    await supabase
      .from('sync_status')
      .upsert({
        event_type: eventType,
        last_synced_block: blockNumber,
        last_sync_time: new Date().toISOString(),
      }, { onConflict: 'event_type' });
  } catch (error) {
    console.error('Error updating sync status:', error);
  }
}

// ============================================
// Pair Statistics
// ============================================

export interface PairStats {
  pair: string;
  volume_24h: number;
  trades_24h: number;
  price_change_24h: number;
  high_24h: number;
  low_24h: number;
  last_price: number;
}

/**
 * Get 24h stats for a pair
 */
export async function getPairStats(
  baseToken: string,
  quoteToken: string
): Promise<PairStats | null> {
  if (!supabase) return null;
  
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .eq('base_token', baseToken.toLowerCase())
      .eq('quote_token', quoteToken.toLowerCase())
      .gte('timestamp', oneDayAgo)
      .order('timestamp', { ascending: true });
    
    if (error || !data || data.length === 0) {
      return null;
    }
    
    const prices = data.map((t) => t.price);
    const firstPrice = prices[0];
    const lastPrice = prices[prices.length - 1];
    
    return {
      pair: `${baseToken}-${quoteToken}`,
      volume_24h: data.reduce((sum, t) => sum + t.quote_amount, 0),
      trades_24h: data.length,
      price_change_24h: firstPrice > 0 ? ((lastPrice - firstPrice) / firstPrice) * 100 : 0,
      high_24h: Math.max(...prices),
      low_24h: Math.min(...prices),
      last_price: lastPrice,
    };
  } catch (error) {
    console.error('Error getting pair stats:', error);
    return null;
  }
}

export default supabase;
