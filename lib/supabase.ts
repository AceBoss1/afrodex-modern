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
