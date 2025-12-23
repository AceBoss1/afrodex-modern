// lib/supabase.ts
// Supabase integration for AfroDex - Orders, Trades, and TGIF Rewards
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getCurrentWeekRange, getBadgeTier, PROGRAM_START_DATE } from './staking';

// Types
export interface DbOrder {
  order_hash: string;
  tx_hash?: string;
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

// Singleton client
let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient;
  
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url || !key) {
    console.warn('Supabase credentials not configured');
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
  if (!supabase) return false;

  // Normalize addresses to lowercase
  const normalizedOrder = {
    ...order,
    order_hash: order.order_hash?.toLowerCase(),
    user_address: order.user_address?.toLowerCase(),
    token_get: order.token_get?.toLowerCase(),
    token_give: order.token_give?.toLowerCase(),
    base_token: order.base_token?.toLowerCase(),
    quote_token: order.quote_token?.toLowerCase(),
  };

  const { error } = await supabase
    .from('orders')
    .upsert(normalizedOrder, { onConflict: 'order_hash' });

  if (error) {
    console.error('Error saving order:', error);
    return false;
  }
  return true;
}

export async function saveSignedOrder(
  orderData: {
    tokenGet: string;
    amountGet: string;
    tokenGive: string;
    amountGive: string;
    expires: string;
    nonce: string;
    user: string;
    v: number;
    r: string;
    s: string;
    hash: string;
  },
  baseToken: string,
  quoteToken: string,
  side: 'buy' | 'sell',
  price: number,
  baseAmount: number,
  quoteAmount: number
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  // Normalize all addresses to lowercase for consistent matching
  const orderHashLower = orderData.hash.toLowerCase();
  const userAddressLower = orderData.user.toLowerCase();
  const tokenGetLower = orderData.tokenGet.toLowerCase();
  const tokenGiveLower = orderData.tokenGive.toLowerCase();
  const baseTokenLower = baseToken.toLowerCase();
  const quoteTokenLower = quoteToken.toLowerCase();

  console.log(`saveSignedOrder: ${side} order at price ${price} hash: ${orderHashLower.slice(0, 10)}...`);

  const dbOrder: DbOrder = {
    order_hash: orderHashLower,
    tx_hash: orderHashLower,
    log_index: 0,
    user_address: userAddressLower,
    token_get: tokenGetLower,
    amount_get: orderData.amountGet,
    token_give: tokenGiveLower,
    amount_give: orderData.amountGive,
    expires: orderData.expires,
    nonce: orderData.nonce,
    v: orderData.v,
    r: orderData.r,
    s: orderData.s,
    base_token: baseTokenLower,
    quote_token: quoteTokenLower,
    side,
    price,
    base_amount: baseAmount,
    quote_amount: quoteAmount,
    is_active: true,
    is_cancelled: false,
    amount_filled: '0',
  };

  const { error } = await supabase
    .from('orders')
    .upsert(dbOrder, { onConflict: 'order_hash' });

  if (error) {
    console.error('Error saving signed order:', error);
    return false;
  }
  
  console.log('Order inserted successfully');
  return true;
}

export async function getOrdersFromDb(
  baseToken: string,
  quoteToken: string
): Promise<{ buyOrders: DbOrder[]; sellOrders: DbOrder[] }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { buyOrders: [], sellOrders: [] };

  // Normalize to lowercase for query
  const baseTokenLower = baseToken.toLowerCase();
  const quoteTokenLower = quoteToken.toLowerCase();

  console.log('getOrdersFromDb: Fetching active orders for', baseTokenLower);

  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('base_token', baseTokenLower)
    .eq('quote_token', quoteTokenLower)
    .eq('is_active', true)
    .eq('is_cancelled', false);

  if (error) {
    console.error('Error fetching orders:', error);
    return { buyOrders: [], sellOrders: [] };
  }

  const orders = data || [];
  console.log(`getOrdersFromDb: Found ${orders.length} active orders for ${baseTokenLower}`);
  
  const buyOrders = orders.filter(o => o.side === 'buy');
  const sellOrders = orders.filter(o => o.side === 'sell');

  // Log signature info for debugging
  orders.forEach(order => {
    console.log('=== LOADING ORDER FROM DB ===');
    console.log('DB v:', order.v, 'type:', typeof order.v);
    console.log('DB r:', order.r, 'length:', order.r?.length);
    console.log('DB s:', order.s, 'length:', order.s?.length);
    console.log('DB hash:', order.order_hash);
    console.log('=============================');
  });

  return { buyOrders, sellOrders };
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

  // Normalize addresses
  const normalizedTrade = {
    ...trade,
    tx_hash: trade.tx_hash?.toLowerCase(),
    token_get: trade.token_get?.toLowerCase(),
    token_give: trade.token_give?.toLowerCase(),
    maker: trade.maker?.toLowerCase(),
    taker: trade.taker?.toLowerCase(),
    base_token: trade.base_token?.toLowerCase(),
    quote_token: trade.quote_token?.toLowerCase(),
  };

  const { error } = await supabase
    .from('trades')
    .upsert(normalizedTrade, { onConflict: 'tx_hash,log_index' });

  if (error) {
    console.error('Error saving trade:', error);
    return false;
  }
  return true;
}

export async function getTradesFromDb(
  baseToken: string,
  quoteToken: string,
  limit: number = 100
): Promise<DbTrade[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const baseTokenLower = baseToken.toLowerCase();
  const quoteTokenLower = quoteToken.toLowerCase();

  const { data, error } = await supabase
    .from('trades')
    .select('*')
    .eq('base_token', baseTokenLower)
    .eq('quote_token', quoteTokenLower)
    .order('block_number', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching trades:', error);
    return [];
  }

  return data || [];
}

/**
 * Save trade after on-chain execution and record TGIF stats
 */
export async function saveTradeAfterExecution(
  tradeData: {
    txHash: string;
    tokenGet: string;
    amountGet: string;
    tokenGive: string;
    amountGive: string;
    maker: string;
    taker: string;
    blockNumber: number;
    blockTimestamp: string;
    baseToken: string;
    quoteToken: string;
    side: 'buy' | 'sell';
    price: number;
    baseAmount: number;
    quoteAmount: number;
  },
  gasFeeEth?: number
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  console.log('=== SAVE TRADE AFTER EXECUTION ===');
  console.log('txHash:', tradeData.txHash);
  console.log('taker:', tradeData.taker);
  console.log('quoteAmount (ETH):', tradeData.quoteAmount);
  console.log('gasFeeEth:', gasFeeEth);

  // Normalize addresses
  const normalizedTrade: DbTrade = {
    tx_hash: tradeData.txHash.toLowerCase(),
    log_index: 0,
    token_get: tradeData.tokenGet.toLowerCase(),
    amount_get: tradeData.amountGet,
    token_give: tradeData.tokenGive.toLowerCase(),
    amount_give: tradeData.amountGive,
    maker: tradeData.maker.toLowerCase(),
    taker: tradeData.taker.toLowerCase(),
    block_number: tradeData.blockNumber,
    block_timestamp: tradeData.blockTimestamp,
    base_token: tradeData.baseToken.toLowerCase(),
    quote_token: tradeData.quoteToken.toLowerCase(),
    side: tradeData.side,
    price: tradeData.price,
    base_amount: tradeData.baseAmount,
    quote_amount: tradeData.quoteAmount,
  };

  // Save trade
  const { error } = await supabase
    .from('trades')
    .upsert(normalizedTrade, { onConflict: 'tx_hash,log_index' });

  if (error) {
    console.error('Error saving trade:', error);
    return false;
  }
  
  console.log('Trade inserted to Supabase');

  // Record TGIF stats for the taker
  try {
    console.log('Recording TGIF stats...');
    const takerLower = tradeData.taker.toLowerCase();
    const volumeEth = tradeData.quoteAmount;
    const actualGasFee = gasFeeEth ?? 0.0003; // Default gas estimate
    
    console.log('Taker:', takerLower);
    console.log('Gas fee:', actualGasFee);
    console.log('Platform fee:', volumeEth * 0.003);
    console.log('Volume:', volumeEth);
    
    await recordTradeStats(
      takerLower,
      actualGasFee,
      volumeEth * 0.003, // 0.3% platform fee
      volumeEth
    );
    console.log('TGIF stats recorded successfully');
  } catch (statsErr) {
    console.error('Error recording TGIF stats:', statsErr);
    // Don't fail the trade save if stats fail
  }

  console.log('=== SAVE TRADE COMPLETE ===');
  return true;
}

// ============================================
// TGIF Rewards Functions
// ============================================

/**
 * Get staking info from blockchain
 */
async function getStakingInfoFromBlockchain(wallet: string): Promise<{ stakedAmount: number }> {
  try {
    // Dynamic import to avoid SSR issues
    const { getStakeInfo } = await import('./staking');
    const stakeInfo = await getStakeInfo(wallet);
    console.log('Fetched staking balance from blockchain:', stakeInfo.stakedAmount);
    return { stakedAmount: stakeInfo.stakedAmount };
  } catch (err) {
    console.error('Error fetching staking info:', err);
    return { stakedAmount: 0 };
  }
}

/**
 * Record trade statistics for TGIF rewards
 */
export async function recordTradeStats(
  wallet: string,
  gasFeeEth: number,
  platformFeeEth: number,
  volumeEth: number
): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return false;

    // Get current week info
    const { weekStartStr } = getCurrentWeekRange();

    console.log('=== RECORDING TGIF TRADE STATS ===');
    console.log('Wallet:', wallet);
    console.log('Week start:', weekStartStr);
    console.log('Gas fee:', gasFeeEth);
    console.log('Platform fee:', platformFeeEth);
    console.log('Volume:', volumeEth);

    // Get actual staking info from blockchain
    const { stakedAmount: actualStakedAmount } = await getStakingInfoFromBlockchain(wallet);
    
    // Get badge tier based on staked amount
    const badge = getBadgeTier(actualStakedAmount);
    const multiplier = badge.multiplier;
    const badgeTier = badge.name;
    const badgeEmoji = badge.emoji;

    console.log('Badge tier:', badgeTier, 'Multiplier:', multiplier);
    console.log('Staked amount:', actualStakedAmount);

    const totalFees = gasFeeEth + platformFeeEth;
    const weightedFees = totalFees * multiplier;
    console.log('Total fees:', totalFees, 'Weighted fees:', weightedFees);

    // Direct upsert to weekly_trading_stats (simplified - no RPC needed)
    await recordTradeStatsDirect(
      wallet, 
      gasFeeEth, 
      platformFeeEth, 
      volumeEth,
      multiplier,
      weekStartStr
    );
    
    // Update user profile separately
    await updateUserProfile(wallet, actualStakedAmount, badgeTier, badgeEmoji, volumeEth, totalFees);

    console.log('=== TGIF STATS RECORDED ===');
    return true;
  } catch (err) {
    console.error('recordTradeStats error:', err);
    return false;
  }
}

/**
 * Direct upsert for trade stats - MINIMAL COLUMNS ONLY
 */
async function recordTradeStatsDirect(
  wallet: string,
  gasFeeEth: number,
  platformFeeEth: number,
  volumeEth: number,
  multiplier: number,
  weekStartStr: string
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const totalFees = gasFeeEth + platformFeeEth;
  const weightedFees = totalFees * multiplier;

  // Calculate week_end (6 days after week_start)
  const weekStart = new Date(weekStartStr);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const weekEndStr = weekEnd.toISOString().split('T')[0];

  try {
    // Check if record exists for this week
    const { data: existing } = await supabase
      .from('weekly_trading_stats')
      .select('gas_fees_eth, platform_fees_eth, volume_eth, trade_count, weighted_fees')
      .eq('wallet_address', wallet)
      .eq('week_start', weekStartStr)
      .maybeSingle();

    if (existing) {
      // Update existing record - ONLY use columns that exist
      const { error } = await supabase
        .from('weekly_trading_stats')
        .update({
          gas_fees_eth: (existing.gas_fees_eth || 0) + gasFeeEth,
          platform_fees_eth: (existing.platform_fees_eth || 0) + platformFeeEth,
          volume_eth: (existing.volume_eth || 0) + volumeEth,
          trade_count: (existing.trade_count || 0) + 1,
          weighted_fees: (existing.weighted_fees || 0) + weightedFees,
          multiplier: multiplier,
        })
        .eq('wallet_address', wallet)
        .eq('week_start', weekStartStr);

      if (error) {
        console.error('Error updating weekly_trading_stats:', error.message);
      } else {
        console.log('Updated existing weekly_trading_stats record');
      }
    } else {
      // Insert new record - ONLY use columns that exist
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
        console.error('Error inserting weekly_trading_stats:', error.message);
      } else {
        console.log('Inserted new weekly_trading_stats record');
      }
    }
  } catch (err) {
    console.error('recordTradeStatsDirect exception:', err);
  }
}

/**
 * Update user profile - separate function with error handling
 */
async function updateUserProfile(
  wallet: string,
  stakedAmount: number,
  badgeTier: string,
  badgeEmoji: string,
  volumeEth: number,
  totalFees: number
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  try {
    // Check if profile exists
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('total_volume_eth, total_fees_paid_eth, trade_count')
      .eq('wallet_address', wallet)
      .maybeSingle();

    if (profile) {
      // Update existing profile - ONLY use columns that exist, NO updated_at
      const { error } = await supabase
        .from('user_profiles')
        .update({
          staked_amount: stakedAmount,
          badge_tier: badgeTier,
          badge_emoji: badgeEmoji,
          total_volume_eth: (profile.total_volume_eth || 0) + volumeEth,
          total_fees_paid_eth: (profile.total_fees_paid_eth || 0) + totalFees,
          trade_count: (profile.trade_count || 0) + 1,
        })
        .eq('wallet_address', wallet);
        
      if (error) {
        console.error('Error updating user_profiles:', error.message);
      } else {
        console.log('Updated user profile:', wallet, badgeTier, stakedAmount);
      }
    } else {
      // Create new profile
      const { error } = await supabase
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
        
      if (error) {
        console.error('Error creating user_profiles:', error.message);
      } else {
        console.log('Created new user profile:', wallet, badgeTier, stakedAmount);
      }
    }
  } catch (err) {
    console.error('updateUserProfile exception:', err);
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

/**
 * Get weekly leaderboard data
 */
export async function getWeeklyLeaderboard(weekStart: string): Promise<WeeklyLeaderboardEntry[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  console.log('Fetching weekly leaderboard for week:', weekStart);

  const { data, error } = await supabase
    .from('weekly_trading_stats')
    .select('*')
    .eq('week_start', weekStart)
    .order('weighted_fees', { ascending: false });

  if (error) {
    console.error('Error fetching leaderboard:', error);
    return [];
  }

  console.log('Weekly leaderboard entries:', data?.length || 0);

  // Enrich with badge info from user_profiles
  const entries: WeeklyLeaderboardEntry[] = [];
  
  for (const row of (data || [])) {
    // Get badge info from user_profiles
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('badge_tier, badge_emoji')
      .eq('wallet_address', row.wallet_address)
      .maybeSingle();

    entries.push({
      wallet_address: row.wallet_address,
      volume_eth: row.volume_eth || 0,
      trade_count: row.trade_count || 0,
      gas_fees_eth: row.gas_fees_eth || 0,
      platform_fees_eth: row.platform_fees_eth || 0,
      weighted_fees: row.weighted_fees || 0,
      multiplier: row.multiplier || 0,
      badge_tier: profile?.badge_tier || 'Starter',
      badge_emoji: profile?.badge_emoji || '🌱',
    });
  }

  return entries;
}

/**
 * Get user's weekly stats
 */
export async function getUserWeeklyStats(
  wallet: string,
  weekStart: string
): Promise<WeeklyLeaderboardEntry | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const walletLower = wallet.toLowerCase();

  const { data, error } = await supabase
    .from('weekly_trading_stats')
    .select('*')
    .eq('wallet_address', walletLower)
    .eq('week_start', weekStart)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  // Get badge info
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('badge_tier, badge_emoji')
    .eq('wallet_address', walletLower)
    .maybeSingle();

  return {
    wallet_address: data.wallet_address,
    volume_eth: data.volume_eth || 0,
    trade_count: data.trade_count || 0,
    gas_fees_eth: data.gas_fees_eth || 0,
    platform_fees_eth: data.platform_fees_eth || 0,
    weighted_fees: data.weighted_fees || 0,
    multiplier: data.multiplier || 0,
    badge_tier: profile?.badge_tier || 'Starter',
    badge_emoji: profile?.badge_emoji || '🌱',
  };
}

/**
 * Get user profile
 */
export async function getUserProfile(wallet: string): Promise<{
  wallet_address: string;
  badge_tier: string;
  badge_emoji: string;
  staked_amount: number;
  total_volume_eth: number;
  total_fees_paid_eth: number;
  trade_count: number;
} | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const walletLower = wallet.toLowerCase();

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('wallet_address', walletLower)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    wallet_address: data.wallet_address,
    badge_tier: data.badge_tier || 'Starter',
    badge_emoji: data.badge_emoji || '🌱',
    staked_amount: data.staked_amount || 0,
    total_volume_eth: data.total_volume_eth || 0,
    total_fees_paid_eth: data.total_fees_paid_eth || 0,
    trade_count: data.trade_count || 0,
  };
}

/**
 * Save a partial fill remainder order
 * When taker's order is larger than maker's order, save the remainder
 */
export async function savePartialFillOrder(
  originalOrder: {
    tokenGet: string;
    amountGet: string;
    tokenGive: string;
    amountGive: string;
    expires: string;
    user: string;
    v: number;
    r: string;
    s: string;
    hash: string;
  },
  remainderAmountGet: string,
  remainderAmountGive: string,
  newNonce: string,
  newHash: string,
  newV: number,
  newR: string,
  newS: string,
  baseToken: string,
  quoteToken: string,
  side: 'buy' | 'sell',
  price: number
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  // Calculate amounts based on side
  const baseDecimals = 4; // AfroX uses 4 decimals
  const quoteDecimals = 18; // ETH uses 18 decimals
  
  let baseAmount: number;
  let quoteAmount: number;
  
  if (side === 'buy') {
    baseAmount = Number(remainderAmountGet) / Math.pow(10, baseDecimals);
    quoteAmount = Number(remainderAmountGive) / Math.pow(10, quoteDecimals);
  } else {
    baseAmount = Number(remainderAmountGive) / Math.pow(10, baseDecimals);
    quoteAmount = Number(remainderAmountGet) / Math.pow(10, quoteDecimals);
  }

  console.log('=== SAVING PARTIAL FILL REMAINDER ===');
  console.log('Original hash:', originalOrder.hash);
  console.log('New hash:', newHash);
  console.log('Remainder base amount:', baseAmount);
  console.log('Remainder quote amount:', quoteAmount);

  return saveSignedOrder(
    {
      tokenGet: originalOrder.tokenGet,
      amountGet: remainderAmountGet,
      tokenGive: originalOrder.tokenGive,
      amountGive: remainderAmountGive,
      expires: originalOrder.expires,
      nonce: newNonce,
      user: originalOrder.user,
      v: newV,
      r: newR,
      s: newS,
      hash: newHash,
    },
    baseToken,
    quoteToken,
    side,
    price,
    baseAmount,
    quoteAmount
  );
}

// ============================================
// Exports
// ============================================

const supabaseExports = {
  getSupabaseClient,
  saveOrder,
  saveSignedOrder,
  getOrdersFromDb,
  deactivateOrderByHash,
  updateOrderFilled,
  clearAllOrders,
  saveTrade,
  getTradesFromDb,
  saveTradeAfterExecution,
  recordTradeStats,
  getWeeklyLeaderboard,
  getUserWeeklyStats,
  getUserProfile,
  savePartialFillOrder,
};

export default supabaseExports;
