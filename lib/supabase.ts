// lib/supabase.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface DbOrder {
  id?: number;
  tx_hash: string;
  log_index: number;
  token_get: string;
  amount_get: string;
  token_give: string;
  amount_give: string;
  expires: string;
  nonce: string;
  user_address: string;
  block_number: number;
  base_token: string;
  quote_token: string;
  side: 'buy' | 'sell';
  price: number;
  base_amount: number;
  quote_amount: number;
  is_active: boolean;
  amount_filled: string;
  is_cancelled: boolean;
  // Signature fields for off-chain orders
  order_hash?: string;
  v?: number;
  r?: string;
  s?: string;
}

export interface SignedOrderInput {
  token_get: string;
  amount_get: string;
  token_give: string;
  amount_give: string;
  expires: string;
  nonce: string;
  user_address: string;
  base_token: string;
  quote_token: string;
  side: 'buy' | 'sell';
  price: number;
  base_amount: number;
  quote_amount: number;
  order_hash: string;
  v: number;
  r: string;
  s: string;
}

export interface DbTrade {
  id?: number;
  tx_hash: string;
  log_index: number;
  token_get: string;
  amount_get: string;
  token_give: string;
  amount_give: string;
  maker: string;
  taker: string;
  block_number: number;
  block_timestamp: string | null;
  base_token: string;
  quote_token: string;
  side: 'buy' | 'sell';
  price: number;
  base_amount: number;
  quote_amount: number;
}

let supabaseClient: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return !!(url && key && url.includes('supabase'));
}

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  
  if (!supabaseClient) {
    supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return supabaseClient;
}

// Orders
export async function saveOrders(orders: DbOrder[]): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase || orders.length === 0) return false;

  const { error } = await supabase
    .from('orders')
    .upsert(orders, { onConflict: 'tx_hash,log_index' });

  if (error) console.error('Error saving orders:', error);
  return !error;
}

export async function getOrdersFromDb(baseToken: string, quoteToken: string, limit = 100): Promise<DbOrder[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('base_token', baseToken.toLowerCase())
    .eq('quote_token', quoteToken.toLowerCase())
    .eq('is_active', true)
    .eq('is_cancelled', false)
    .order('block_number', { ascending: false })
    .limit(limit);

  if (error) console.error('Error fetching orders:', error);
  return data || [];
}

export async function deactivateOrder(txHash: string, logIndex = 0): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const { error } = await supabase
    .from('orders')
    .update({ is_active: false })
    .eq('tx_hash', txHash)
    .eq('log_index', logIndex);

  return !error;
}

/**
 * Save a signed order (off-chain, gasless)
 * Uses order_hash as unique identifier instead of tx_hash
 */
export async function saveSignedOrder(order: SignedOrderInput): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Supabase not configured' };
  }

  const dbOrder = {
    tx_hash: order.order_hash, // Use order_hash as tx_hash for off-chain orders
    log_index: 0,
    token_get: order.token_get.toLowerCase(),
    amount_get: order.amount_get,
    token_give: order.token_give.toLowerCase(),
    amount_give: order.amount_give,
    expires: order.expires,
    nonce: order.nonce,
    user_address: order.user_address.toLowerCase(),
    block_number: 0, // Off-chain order, no block
    base_token: order.base_token.toLowerCase(),
    quote_token: order.quote_token.toLowerCase(),
    side: order.side,
    price: order.price,
    base_amount: order.base_amount,
    quote_amount: order.quote_amount,
    is_active: true,
    amount_filled: '0',
    is_cancelled: false,
    order_hash: order.order_hash,
    v: order.v,
    r: order.r,
    s: order.s,
  };

  const { error } = await supabase
    .from('orders')
    .upsert(dbOrder, { onConflict: 'tx_hash,log_index' });

  if (error) {
    console.error('Error saving signed order:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Cancel an order by hash (off-chain)
 */
export async function cancelOrderByHash(orderHash: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const { error } = await supabase
    .from('orders')
    .update({ is_cancelled: true, is_active: false })
    .eq('order_hash', orderHash);

  return !error;
}

// Trades
export async function saveTrades(trades: DbTrade[]): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase || trades.length === 0) return false;

  const { error } = await supabase
    .from('trades')
    .upsert(trades, { onConflict: 'tx_hash,log_index' });

  if (error) console.error('Error saving trades:', error);
  return !error;
}

export async function getTradesFromDb(baseToken: string, quoteToken: string, limit = 100): Promise<DbTrade[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('trades')
    .select('*')
    .eq('base_token', baseToken.toLowerCase())
    .eq('quote_token', quoteToken.toLowerCase())
    .order('block_number', { ascending: false })
    .limit(limit);

  if (error) console.error('Error fetching trades:', error);
  return data || [];
}

// Sync Status
export async function getLastSyncedBlock(eventType: string): Promise<number> {
  const supabase = getSupabaseClient();
  if (!supabase) return 9100009;

  const { data } = await supabase
    .from('sync_status')
    .select('last_synced_block')
    .eq('event_type', eventType)
    .single();

  return data?.last_synced_block || 9100009;
}

export async function updateSyncStatus(eventType: string, lastBlock: number, totalEvents?: number): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const { error } = await supabase
    .from('sync_status')
    .upsert({
      event_type: eventType,
      last_synced_block: lastBlock,
      last_sync_time: new Date().toISOString(),
      total_events: totalEvents,
      status: 'synced'
    }, { onConflict: 'event_type' });

  return !error;
}

// Test connection
export async function testConnection(): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const { error } = await supabase.from('sync_status').select('event_type').limit(1);
  return !error;
}
