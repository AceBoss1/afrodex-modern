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

export interface TradeExecutionInput {
  txHash: string;
  tokenGet: string;
  amountGet: string;
  tokenGive: string;
  amountGive: string;
  maker: string;
  taker: string;
  blockNumber: number;
  blockTimestamp?: string;
  baseToken: string;
  quoteToken: string;
  side: 'buy' | 'sell';
  price: number;
  baseAmount: number;
  quoteAmount: number;
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
 * Deactivate an order by its hash (for off-chain orders)
 */
export async function deactivateOrderByHash(orderHash: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  console.log('Deactivating order by hash:', orderHash);

  const { error } = await supabase
    .from('orders')
    .update({ is_active: false, is_cancelled: false })
    .eq('order_hash', orderHash);

  if (error) {
    console.error('Error deactivating order by hash:', error);
    return false;
  }

  console.log('Order deactivated successfully');
  return true;
}

/**
 * Deactivate an order by nonce and user address
 */
export async function deactivateOrderByNonceAndUser(nonce: string, userAddress: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  console.log('Deactivating order by nonce and user:', nonce, userAddress);

  const { error } = await supabase
    .from('orders')
    .update({ is_active: false, is_cancelled: false })
    .eq('nonce', nonce)
    .eq('user_address', userAddress.toLowerCase());

  if (error) {
    console.error('Error deactivating order by nonce/user:', error);
    return false;
  }

  console.log('Order deactivated by nonce/user successfully');
  return true;
}

/**
 * Update order fill amount
 */
export async function updateOrderFill(orderHash: string, amountFilled: string, isFullyFilled: boolean): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const updates: any = {
    amount_filled: amountFilled,
  };

  if (isFullyFilled) {
    updates.is_active = false;
  }

  const { error } = await supabase
    .from('orders')
    .update(updates)
    .eq('order_hash', orderHash);

  if (error) {
    console.error('Error updating order fill:', error);
    return false;
  }

  return true;
}

/**
 * Get order by hash
 */
export async function getOrderByHash(orderHash: string): Promise<DbOrder | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('order_hash', orderHash)
    .single();

  if (error) {
    console.error('Error fetching order by hash:', error);
    return null;
  }

  return data;
}

/**
 * Get order by nonce and user
 */
export async function getOrderByNonceAndUser(nonce: string, userAddress: string): Promise<DbOrder | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('nonce', nonce)
    .eq('user_address', userAddress.toLowerCase())
    .single();

  if (error) {
    console.error('Error fetching order by nonce/user:', error);
    return null;
  }

  return data;
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

  console.log('=== SAVING ORDER TO SUPABASE ===');
  console.log('v:', order.v, 'type:', typeof order.v);
  console.log('r:', order.r, 'length:', order.r?.length);
  console.log('s:', order.s, 'length:', order.s?.length);
  console.log('hash:', order.order_hash);
  console.log('================================');

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

/**
 * Save a trade after execution - CRITICAL FUNCTION
 * This is called after a trade is successfully executed on-chain
 */
export async function saveTradeAfterExecution(trade: TradeExecutionInput): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error('saveTradeAfterExecution: Supabase not configured');
    return { success: false, error: 'Supabase not configured' };
  }

  console.log('=== SAVING TRADE TO SUPABASE ===');
  console.log('txHash:', trade.txHash);
  console.log('maker:', trade.maker);
  console.log('taker:', trade.taker);
  console.log('price:', trade.price);
  console.log('baseAmount:', trade.baseAmount);
  console.log('quoteAmount:', trade.quoteAmount);
  console.log('side:', trade.side);
  console.log('================================');

  const dbTrade: DbTrade = {
    tx_hash: trade.txHash,
    log_index: 0,
    token_get: trade.tokenGet.toLowerCase(),
    amount_get: trade.amountGet,
    token_give: trade.tokenGive.toLowerCase(),
    amount_give: trade.amountGive,
    maker: trade.maker.toLowerCase(),
    taker: trade.taker.toLowerCase(),
    block_number: trade.blockNumber,
    block_timestamp: trade.blockTimestamp || new Date().toISOString(),
    base_token: trade.baseToken.toLowerCase(),
    quote_token: trade.quoteToken.toLowerCase(),
    side: trade.side,
    price: trade.price,
    base_amount: trade.baseAmount,
    quote_amount: trade.quoteAmount,
  };

  const { error } = await supabase
    .from('trades')
    .upsert(dbTrade, { onConflict: 'tx_hash,log_index' });

  if (error) {
    console.error('Error saving trade after execution:', error);
    return { success: false, error: error.message };
  }

  console.log('Trade saved successfully to Supabase');
  return { success: true };
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

// Test connection (use orders table instead of sync_status)
export async function testConnection(): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const { error } = await supabase.from('orders').select('id').limit(1);
  return !error;
}

/**
 * Delete all orders for a user (useful when signatures are invalid)
 */
export async function deleteUserOrders(userAddress: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const { error } = await supabase
    .from('orders')
    .delete()
    .eq('user_address', userAddress.toLowerCase());

  return !error;
}

/**
 * Delete all active orders (for clearing invalid signatures)
 */
export async function clearAllOrders(): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const { error } = await supabase
    .from('orders')
    .delete()
    .eq('is_active', true);

  return !error;
}
