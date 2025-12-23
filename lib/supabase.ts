// lib/supabase.ts
// Supabase integration for AfroDex - Orders, Trades, and TGIF Rewards
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getCurrentWeekRange, getBadgeTier, PROGRAM_START_DATE } from './staking';

// Types
export interface DbOrder {
  order_hash: string;
  tx_hash?: string;  // For off-chain orders, use order_hash as placeholder
  log_index?: number;
  user_address: string;
  token_get: string;
  amount_get: string;
  token_give: string;
  amount_give: string;
  expires: string;
  nonce: string;
  v?: number;
  r?: string;
  s?: string;
  base_token: string;
  quote_token: string;
  side: 'buy' | 'sell';
  price: number;
  base_amount: number;
  quote_amount: number;
  is_active?: boolean;
  is_cancelled?: boolean;
  amount_filled?: string;
  created_at?: string;
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
  block_timestamp?: string;
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

// Singleton Supabase client
let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient;
  
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url || !key) {
    console.warn('Supabase not configured - missing URL or key');
    return null;
  }
  
  supabaseClient = createClient(url, key);
  return supabaseClient;
}

// ============================================
// Order Functions
// ============================================

export async function saveOrder(order: DbOrder): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error('saveOrder: Supabase not configured!');
    return false;
  }

  // CRITICAL: Lowercase all addresses for consistent querying
  const orderWithDefaults = {
    ...order,
    order_hash: order.order_hash.toLowerCase(),
    user_address: order.user_address.toLowerCase(),
    token_get: order.token_get.toLowerCase(),
    token_give: order.token_give.toLowerCase(),
    base_token: order.base_token.toLowerCase(),
    quote_token: order.quote_token.toLowerCase(),
    tx_hash: (order.tx_hash || order.order_hash).toLowerCase(),
    log_index: order.log_index ?? 0,
    is_active: order.is_active ?? true,
    is_cancelled: order.is_cancelled ?? false,
    amount_filled: order.amount_filled ?? '0',
  };

  console.log('saveOrder:', order.side, 'at price', order.price);

  // Check if order already exists
  const { data: existing } = await supabase
    .from('orders')
    .select('order_hash')
    .eq('order_hash', orderWithDefaults.order_hash)
    .maybeSingle();

  let error;
  if (existing) {
    const result = await supabase
      .from('orders')
      .update(orderWithDefaults)
      .eq('order_hash', orderWithDefaults.order_hash);
    error = result.error;
  } else {
    const result = await supabase
      .from('orders')
      .insert(orderWithDefaults);
    error = result.error;
  }

  if (error) {
    console.error('Error saving order:', error);
    return false;
  }
  
  console.log('Order saved successfully');
  return true;
}

export async function getActiveOrders(baseToken: string): Promise<DbOrder[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('base_token', baseToken.toLowerCase())
    .eq('is_active', true)
    .eq('is_cancelled', false)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching orders:', error);
    return [];
  }
  return data || [];
}

export async function cancelOrderByHash(orderHash: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const { error } = await supabase
    .from('orders')
    .update({ is_cancelled: true, is_active: false })
    .eq('order_hash', orderHash);

  return !error;
}

export async function deactivateOrderByHash(orderHash: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const hashLower = orderHash.toLowerCase();
  console.log('Deactivating order in DB:', hashLower);

  const { data, error } = await supabase
    .from('orders')
    .update({ is_active: false })
    .eq('order_hash', hashLower)
    .select();

  if (error) {
    console.error('Error deactivating order:', error);
    return false;
  }
  
  console.log('Deactivate result - rows affected:', data?.length || 0);
  return (data?.length || 0) > 0;
}

export async function updateOrderFilled(
  orderHash: string, 
  amountFilled: string | number,
  fullyFilled: boolean = false
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const hashLower = orderHash.toLowerCase();

  const { error } = await supabase
    .from('orders')
    .update({ 
      amount_filled: String(amountFilled),
      is_active: !fullyFilled
    })
    .eq('order_hash', hashLower);

  return !error;
}

export async function clearAllOrders(): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const { error } = await supabase
    .from('orders')
    .delete()
    .eq('is_active', true);

  return !error;
}

// ============================================
// Trade Functions
// ============================================

export async function saveTrade(trade: DbTrade): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  // Check if trade already exists
  const { data: existing } = await supabase
    .from('trades')
    .select('tx_hash')
    .eq('tx_hash', trade.tx_hash)
    .eq('log_index', trade.log_index)
    .maybeSingle();

  let error;
  if (existing) {
    // Update existing
    const result = await supabase
      .from('trades')
      .update(trade)
      .eq('tx_hash', trade.tx_hash)
      .eq('log_index', trade.log_index);
    error = result.error;
  } else {
    // Insert new
    const result = await supabase
      .from('trades')
      .insert(trade);
    error = result.error;
  }

  if (error) {
    console.error('Error saving trade:', error);
    return false;
  }
  return true;
}

export async function getRecentTrades(baseToken: string, limit: number = 50): Promise<DbTrade[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('trades')
    .select('*')
    .eq('base_token', baseToken.toLowerCase())
    .order('block_number', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching trades:', error);
    return [];
  }
  return data || [];
}

/**
 * Save a trade after execution - CRITICAL FUNCTION
 * This is called after a trade is successfully executed on-chain
 */
export async function saveTradeAfterExecution(
  trade: TradeExecutionInput,
  gasFeeEth?: number
): Promise<{ success: boolean; error?: string }> {
  console.log('=== SAVE TRADE AFTER EXECUTION ===');
  console.log('txHash:', trade.txHash);
  console.log('taker:', trade.taker);
  console.log('quoteAmount (ETH):', trade.quoteAmount);
  console.log('gasFeeEth:', gasFeeEth);
  
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error('saveTradeAfterExecution: Supabase not configured');
    return { success: false, error: 'Supabase not configured' };
  }

  // CRITICAL: Lowercase all addresses
  const txHashLower = trade.txHash.toLowerCase();
  const dbTrade: DbTrade = {
    tx_hash: txHashLower,
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

  // Step 1: Save trade to trades table
  let tradeSaved = false;
  try {
    const { data: existing } = await supabase
      .from('trades')
      .select('tx_hash')
      .eq('tx_hash', txHashLower)
      .eq('log_index', 0)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('trades')
        .update(dbTrade)
        .eq('tx_hash', txHashLower)
        .eq('log_index', 0);
      
      if (error) {
        console.error('Error updating trade:', error);
      } else {
        console.log('Trade updated in Supabase');
        tradeSaved = true;
      }
    } else {
      const { error } = await supabase
        .from('trades')
        .insert(dbTrade);
      
      if (error) {
        console.error('Error inserting trade:', error);
      } else {
        console.log('Trade inserted to Supabase');
        tradeSaved = true;
      }
    }
  } catch (err) {
    console.error('Trade save error:', err);
  }

  // Step 2: Record TGIF stats (even if trade save had issues)
  // Platform fee is 0.3% of the trade value
  const platformFeeEth = trade.quoteAmount * 0.003;
  const volumeEth = trade.quoteAmount;
  // Use provided gas fee or estimate ~0.0003 ETH for a trade
  const actualGasFee = gasFeeEth || 0.0003;
  
  console.log('Recording TGIF stats...');
  console.log('Taker:', trade.taker.toLowerCase());
  console.log('Gas fee:', actualGasFee);
  console.log('Platform fee:', platformFeeEth);
  console.log('Volume:', volumeEth);
  
  try {
    await recordTradeStats(
      trade.taker,
      actualGasFee,
      platformFeeEth,
      volumeEth
    );
    console.log('TGIF stats recorded successfully');
  } catch (err) {
    console.error('Error recording TGIF stats:', err);
  }
  
  console.log('=== SAVE TRADE COMPLETE ===');
  return { success: tradeSaved };
}

// ============================================
// TGIF Rewards - Fee Tracking Functions
// ============================================

/**
 * Record trading stats for TGIF rewards
 * Called after every trade execution for the TAKER only
 */
export async function recordTradeStats(
  takerAddress: string,
  gasFeeEth: number,
  platformFeeEth: number,
  volumeEth: number,
  stakedAmount?: number
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error('recordTradeStats: Supabase not configured');
    return false;
  }

  try {
    const wallet = takerAddress.toLowerCase();
    const { weekStartStr } = getCurrentWeekRange();
    
    console.log('=== RECORDING TGIF TRADE STATS ===');
    console.log('Wallet:', wallet);
    console.log('Week start:', weekStartStr);
    console.log('Gas fee:', gasFeeEth);
    console.log('Platform fee:', platformFeeEth);
    console.log('Volume:', volumeEth);
    
    // Get the taker's badge for multiplier
    let multiplier = 1;
    let badgeTier = 'Starter';
    let badgeEmoji = '🌱';
    let actualStakedAmount = stakedAmount ?? 0;
    
    // If stakedAmount not provided, fetch from blockchain
    if (stakedAmount === undefined || stakedAmount === 0) {
      try {
        // Dynamic import to avoid circular dependencies
        const { getStakeInfo } = await import('./staking');
        const stakeInfo = await getStakeInfo(wallet);
        actualStakedAmount = stakeInfo.stakedAmount;
        console.log('Fetched staking balance from blockchain:', actualStakedAmount);
      } catch (err) {
        console.log('Could not fetch staking balance, checking profile:', err);
        // Fallback to profile
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('staked_amount, badge_tier, badge_emoji')
          .eq('wallet_address', wallet)
          .maybeSingle();
        
        if (profile && profile.staked_amount) {
          actualStakedAmount = profile.staked_amount;
        }
      }
    }
    
    // Calculate badge based on actual staked amount
    if (actualStakedAmount > 0) {
      const badge = getBadgeTier(actualStakedAmount);
      multiplier = badge.multiplier;
      badgeTier = badge.name;
      badgeEmoji = badge.emoji;
    }
    
    const totalFees = gasFeeEth + platformFeeEth;
    const weightedFees = totalFees * multiplier;
    
    console.log('Badge tier:', badgeTier, 'Multiplier:', multiplier);
    console.log('Staked amount:', actualStakedAmount);
    console.log('Total fees:', totalFees, 'Weighted fees:', weightedFees);

    // First try RPC function
    const { error: rpcError } = await supabase.rpc('update_trade_stats', {
      p_wallet: wallet,
      p_gas_fee_eth: gasFeeEth,
      p_platform_fee_eth: platformFeeEth,
      p_volume_eth: volumeEth,
    });

    if (rpcError) {
      console.log('RPC update_trade_stats failed, using direct upsert:', rpcError.message);
      // Fallback: Direct upsert
      await recordTradeStatsDirect(
        wallet, 
        gasFeeEth, 
        platformFeeEth, 
        volumeEth,
        multiplier,
        badgeTier,
        badgeEmoji,
        weekStartStr
      );
    } else {
      console.log('RPC update_trade_stats succeeded');
    }
    
    // Always update user profile with staking info
    await updateUserProfileWithStaking(wallet, actualStakedAmount, badgeTier, badgeEmoji, gasFeeEth, platformFeeEth, volumeEth);

    console.log('=== TGIF STATS RECORDED ===');
    return true;
  } catch (err) {
    console.error('recordTradeStats error:', err);
    return false;
  }
}

/**
 * Direct upsert for trade stats (fallback if RPC fails)
 */
async function recordTradeStatsDirect(
  wallet: string,
  gasFeeEth: number,
  platformFeeEth: number,
  volumeEth: number,
  multiplier: number,
  badgeTier: string,
  badgeEmoji: string,
  weekStartStr: string
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const totalFees = gasFeeEth + platformFeeEth;
  const weightedFees = totalFees * multiplier;

  // Check if record exists for this week
  const { data: existing } = await supabase
    .from('weekly_trading_stats')
    .select('*')
    .eq('wallet_address', wallet)
    .eq('week_start', weekStartStr)
    .maybeSingle();

  if (existing) {
    // Update existing record - DO NOT include badge_tier/badge_emoji (columns may not exist)
    const { error } = await supabase
      .from('weekly_trading_stats')
      .update({
        gas_fees_eth: (existing.gas_fees_eth || 0) + gasFeeEth,
        platform_fees_eth: (existing.platform_fees_eth || 0) + platformFeeEth,
        volume_eth: (existing.volume_eth || 0) + volumeEth,
        trade_count: (existing.trade_count || 0) + 1,
        weighted_fees: (existing.weighted_fees || 0) + weightedFees,
        multiplier: multiplier,
        updated_at: new Date().toISOString(),
      })
      .eq('wallet_address', wallet)
      .eq('week_start', weekStartStr);

    if (error) {
      console.error('Error updating weekly_trading_stats:', error);
    } else {
      console.log('Updated existing weekly_trading_stats record');
    }
  } else {
    // Insert new record - DO NOT include badge_tier/badge_emoji (columns may not exist)
    // Calculate week_end (6 days after week_start)
    const weekStart = new Date(weekStartStr);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const weekEndStr = weekEnd.toISOString().split('T')[0];
    
    const { error } = await supabase
      .from('weekly_trading_stats')
      .insert({
        wallet_address: wallet,
        week_start: weekStartStr,
        week_end: weekEndStr,
        gas_fees_eth: gasFeeEth,
        platform_fees_eth: platformFeeEth,
        volume_eth: volumeEth,
        trade_count: 1,
        weighted_fees: weightedFees,
        multiplier: multiplier,
      });

    if (error) {
      console.error('Error inserting weekly_trading_stats:', error);
    } else {
      console.log('Inserted new weekly_trading_stats record');
    }
  }

  // Also update user_profiles total stats
  await updateUserProfileStats(wallet, gasFeeEth, platformFeeEth, volumeEth);
}

/**
 * Update user_profiles with cumulative stats AND staking info
 */
async function updateUserProfileWithStaking(
  wallet: string,
  stakedAmount: number,
  badgeTier: string,
  badgeEmoji: string,
  gasFeeEth: number,
  platformFeeEth: number,
  volumeEth: number
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const totalFees = gasFeeEth + platformFeeEth;

  // Check if profile exists
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('wallet_address', wallet)
    .maybeSingle();

  if (profile) {
    // Update existing profile with staking info and trade stats
    await supabase
      .from('user_profiles')
      .update({
        staked_amount: stakedAmount,
        badge_tier: badgeTier,
        badge_emoji: badgeEmoji,
        total_volume_eth: (profile.total_volume_eth || 0) + volumeEth,
        total_fees_paid_eth: (profile.total_fees_paid_eth || 0) + totalFees,
        trade_count: (profile.trade_count || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('wallet_address', wallet);
      
    console.log('Updated user profile with staking info:', wallet, badgeTier, stakedAmount);
  } else {
    // Create new profile with staking info
    await supabase
      .from('user_profiles')
      .insert({
        wallet_address: wallet,
        staked_amount: stakedAmount,
        badge_tier: badgeTier,
        badge_emoji: badgeEmoji,
        total_volume_eth: volumeEth,
        total_fees_paid_eth: totalFees,
        trade_count: 1,
      });
      
    console.log('Created new user profile with staking info:', wallet, badgeTier, stakedAmount);
  }
}

/**
 * Update user_profiles with cumulative stats (legacy - called by recordTradeStatsDirect)
 */
async function updateUserProfileStats(
  wallet: string,
  gasFeeEth: number,
  platformFeeEth: number,
  volumeEth: number
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const totalFees = gasFeeEth + platformFeeEth;

  // Check if profile exists
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('wallet_address', wallet)
    .maybeSingle();

  if (profile) {
    // Update existing profile
    await supabase
      .from('user_profiles')
      .update({
        total_volume_eth: (profile.total_volume_eth || 0) + volumeEth,
        total_fees_paid_eth: (profile.total_fees_paid_eth || 0) + totalFees,
        trade_count: (profile.trade_count || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('wallet_address', wallet);
  } else {
    // Create new profile
    await supabase
      .from('user_profiles')
      .insert({
        wallet_address: wallet,
        total_volume_eth: volumeEth,
        total_fees_paid_eth: totalFees,
        trade_count: 1,
      });
  }
}

// ============================================
// Leaderboard Functions
// ============================================

export interface WeeklyLeaderboardEntry {
  wallet_address: string;
  volume_eth: number;
  trade_count: number;
  gas_fees_eth: number;
  platform_fees_eth: number;
  weighted_fees: number;
  multiplier: number;
  badge_tier: string;
  badge_emoji: string;
}

export interface AllTimeLeaderboardEntry {
  wallet_address: string;
  total_volume_eth: number;
  trade_count: number;
  total_fees_paid_eth: number;
  total_rewards_earned: number;
  badge_tier: string;
  badge_emoji: string;
  staked_amount: number;
}

export async function getWeeklyLeaderboard(): Promise<WeeklyLeaderboardEntry[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { weekStartStr } = getCurrentWeekRange();
  console.log('Fetching weekly leaderboard for week:', weekStartStr);

  const { data, error } = await supabase
    .from('weekly_trading_stats')
    .select('*')
    .eq('week_start', weekStartStr)
    .order('volume_eth', { ascending: false })
    .limit(100);

  if (error) {
    console.error('Error fetching weekly leaderboard:', error);
    return [];
  }

  console.log('Weekly leaderboard entries:', data?.length || 0);
  return data || [];
}

export async function getAllTimeLeaderboard(): Promise<AllTimeLeaderboardEntry[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .gt('total_volume_eth', 0)
    .order('total_volume_eth', { ascending: false })
    .limit(100);

  if (error) {
    console.error('Error fetching all-time leaderboard:', error);
    return [];
  }

  return data || [];
}

// ============================================
// Additional Order/Trade Functions (for compatibility)
// ============================================

/**
 * Deactivate order by nonce and user address
 */
export async function deactivateOrderByNonceAndUser(
  nonce: string,
  userAddress: string
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const { error } = await supabase
    .from('orders')
    .update({ is_active: false })
    .eq('nonce', nonce)
    .eq('user_address', userAddress.toLowerCase());

  return !error;
}

/**
 * Save a signed order to the database
 */
export async function saveSignedOrder(order: DbOrder): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error('saveSignedOrder: Supabase not configured!');
    return { success: false, error: 'Supabase not configured' };
  }

  // CRITICAL: Lowercase all addresses for consistent querying
  const orderWithDefaults = {
    ...order,
    order_hash: order.order_hash.toLowerCase(),
    user_address: order.user_address.toLowerCase(),
    token_get: order.token_get.toLowerCase(),
    token_give: order.token_give.toLowerCase(),
    base_token: order.base_token.toLowerCase(),
    quote_token: order.quote_token.toLowerCase(),
    tx_hash: (order.tx_hash || order.order_hash).toLowerCase(),
    log_index: order.log_index ?? 0,
    is_active: order.is_active ?? true,
    is_cancelled: order.is_cancelled ?? false,
    amount_filled: order.amount_filled ?? '0',
  };

  console.log('saveSignedOrder:', order.side, 'order at price', order.price, 'hash:', orderWithDefaults.order_hash.slice(0, 10) + '...');

  // Check if order already exists
  const { data: existing } = await supabase
    .from('orders')
    .select('order_hash')
    .eq('order_hash', orderWithDefaults.order_hash)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('orders')
      .update(orderWithDefaults)
      .eq('order_hash', orderWithDefaults.order_hash);

    if (error) {
      console.error('Error updating signed order:', error);
      return { success: false, error: error.message };
    }
    console.log('Order updated successfully');
  } else {
    const { error } = await supabase
      .from('orders')
      .insert(orderWithDefaults);

    if (error) {
      console.error('Error inserting signed order:', error);
      return { success: false, error: error.message };
    }
    console.log('Order inserted successfully');
  }
  
  return { success: true };
}

/**
 * Get orders from database (alias for getActiveOrders with more flexibility)
 */
export async function getOrdersFromDb(
  baseToken: string,
  quoteToken?: string
): Promise<DbOrder[]> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error('getOrdersFromDb: Supabase not configured!');
    return [];
  }

  const baseTokenLower = baseToken.toLowerCase();
  
  let query = supabase
    .from('orders')
    .select('*')
    .eq('base_token', baseTokenLower)
    .eq('is_active', true)
    .eq('is_cancelled', false)
    .order('created_at', { ascending: false });

  // Don't filter by quote_token if it's ETH (zero address)
  if (quoteToken && quoteToken !== '0x0000000000000000000000000000000000000000') {
    query = query.eq('quote_token', quoteToken.toLowerCase());
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching orders from db:', error);
    return [];
  }
  
  console.log(`getOrdersFromDb: Found ${data?.length || 0} active orders for ${baseTokenLower}`);
  return data || [];
}

/**
 * Get trades from database
 */
export async function getTradesFromDb(
  baseToken: string,
  quoteToken?: string,
  limit: number = 50
): Promise<DbTrade[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  let query = supabase
    .from('trades')
    .select('*')
    .eq('base_token', baseToken.toLowerCase())
    .order('block_number', { ascending: false })
    .limit(limit);

  if (quoteToken) {
    query = query.eq('quote_token', quoteToken.toLowerCase());
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching trades from db:', error);
    return [];
  }
  return data || [];
}

const supabaseExports = {
  getSupabaseClient,
  saveOrder,
  getActiveOrders,
  cancelOrderByHash,
  deactivateOrderByHash,
  updateOrderFilled,
  clearAllOrders,
  saveTrade,
  getRecentTrades,
  saveTradeAfterExecution,
  recordTradeStats,
  getWeeklyLeaderboard,
  getAllTimeLeaderboard,
  deactivateOrderByNonceAndUser,
  saveSignedOrder,
  getOrdersFromDb,
  getTradesFromDb,
};

export default supabaseExports;
