// lib/supabase.ts
// Supabase integration for AfroDex - Orders, Trades, and TGIF Rewards
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getCurrentWeekRange, getBadgeTier, PROGRAM_START_DATE } from './staking';

// ============================================
// Types
// ============================================

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

// ============================================
// Singleton Client
// ============================================

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
): Promise<boolean>;

// Overload for TradingPanel which passes a single object with snake_case fields
export async function saveSignedOrder(
  orderObj: {
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
    v: number;
    r: string;
    s: string;
    order_hash: string;
  }
): Promise<boolean>;

// Implementation
export async function saveSignedOrder(
  orderDataOrObj: any,
  baseToken?: string,
  quoteToken?: string,
  side?: 'buy' | 'sell',
  price?: number,
  baseAmount?: number,
  quoteAmount?: number
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  let dbOrder: DbOrder;

  // Check if called with single object (TradingPanel style) or 7 arguments
  if (baseToken === undefined) {
    // Single object argument with snake_case fields
    const obj = orderDataOrObj;
    dbOrder = {
      order_hash: obj.order_hash?.toLowerCase(),
      tx_hash: obj.order_hash?.toLowerCase(),
      log_index: 0,
      user_address: obj.user_address?.toLowerCase(),
      token_get: obj.token_get?.toLowerCase(),
      amount_get: obj.amount_get,
      token_give: obj.token_give?.toLowerCase(),
      amount_give: obj.amount_give,
      expires: obj.expires,
      nonce: obj.nonce,
      v: obj.v,
      r: obj.r,
      s: obj.s,
      base_token: obj.base_token?.toLowerCase(),
      quote_token: obj.quote_token?.toLowerCase(),
      side: obj.side,
      price: obj.price,
      base_amount: obj.base_amount,
      quote_amount: obj.quote_amount,
      is_active: true,
      is_cancelled: false,
      amount_filled: '0',
    };
    console.log(`saveSignedOrder (single obj): ${obj.side} order at price ${obj.price} hash: ${dbOrder.order_hash?.slice(0, 10)}...`);
  } else {
    // 7 arguments with camelCase orderData
    const orderData = orderDataOrObj;
    const orderHashLower = orderData.hash.toLowerCase();
    const userAddressLower = orderData.user.toLowerCase();
    const tokenGetLower = orderData.tokenGet.toLowerCase();
    const tokenGiveLower = orderData.tokenGive.toLowerCase();
    const baseTokenLower = baseToken.toLowerCase();
    const quoteTokenLower = quoteToken!.toLowerCase();

    console.log(`saveSignedOrder (7 args): ${side} order at price ${price} hash: ${orderHashLower.slice(0, 10)}...`);

    dbOrder = {
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
      side: side!,
      price: price!,
      base_amount: baseAmount!,
      quote_amount: quoteAmount!,
      is_active: true,
      is_cancelled: false,
      amount_filled: '0',
    };
  }

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

export async function cancelOrderByHash(orderHash: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const hashLower = orderHash.toLowerCase();
  console.log('Cancelling order in DB:', hashLower);

  const { data, error } = await supabase
    .from('orders')
    .update({ is_active: false, is_cancelled: true })
    .eq('order_hash', hashLower)
    .select();

  if (error) {
    console.error('Error cancelling order:', error);
    return false;
  }
  
  console.log('Cancel result - rows affected:', data?.length || 0);
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
    const actualGasFee = gasFeeEth ?? 0.0003;
    
    console.log('Taker:', takerLower);
    console.log('Gas fee:', actualGasFee);
    console.log('Platform fee:', volumeEth * 0.003);
    console.log('Volume:', volumeEth);
    
    await recordTradeStats(
      takerLower,
      actualGasFee,
      volumeEth * 0.003,
      volumeEth
    );
    console.log('TGIF stats recorded successfully');
  } catch (statsErr) {
    console.error('Error recording TGIF stats:', statsErr);
  }

  console.log('=== SAVE TRADE COMPLETE ===');
  return true;
}

// ============================================
// TGIF Rewards Functions
// ============================================

async function getStakingInfoFromBlockchain(wallet: string): Promise<{ stakedAmount: number }> {
  try {
    const { getStakeInfo } = await import('./staking');
    const stakeInfo = await getStakeInfo(wallet);
    console.log('Fetched staking balance from blockchain:', stakeInfo.stakedAmount);
    return { stakedAmount: stakeInfo.stakedAmount };
  } catch (err) {
    console.error('Error fetching staking info:', err);
    return { stakedAmount: 0 };
  }
}

export async function recordTradeStats(
  wallet: string,
  gasFeeEth: number,
  platformFeeEth: number,
  volumeEth: number
): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return false;

    const { weekStartStr } = getCurrentWeekRange();

    console.log('=== RECORDING TGIF TRADE STATS ===');
    console.log('Wallet:', wallet);
    console.log('Week start:', weekStartStr);
    console.log('Gas fee:', gasFeeEth);
    console.log('Platform fee:', platformFeeEth);
    console.log('Volume:', volumeEth);

    const { stakedAmount: actualStakedAmount } = await getStakingInfoFromBlockchain(wallet);
    
    const badge = getBadgeTier(actualStakedAmount);
    const multiplier = badge.multiplier;
    const badgeTier = badge.name;
    const badgeEmoji = badge.emoji;

    console.log('Badge tier:', badgeTier, 'Multiplier:', multiplier);
    console.log('Staked amount:', actualStakedAmount);

    const totalFees = gasFeeEth + platformFeeEth;
    const weightedFees = totalFees * multiplier;
    console.log('Total fees:', totalFees, 'Weighted fees:', weightedFees);

    // Update weekly_trading_stats
    await recordTradeStatsDirect(wallet, gasFeeEth, platformFeeEth, volumeEth, multiplier, badgeTier, badgeEmoji, weekStartStr);
    
    // Update user profile
    await updateUserProfile(wallet, actualStakedAmount, badgeTier, badgeEmoji, volumeEth, totalFees);

    console.log('=== TGIF STATS RECORDED ===');
    return true;
  } catch (err) {
    console.error('recordTradeStats error:', err);
    return false;
  }
}

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

  const weekStart = new Date(weekStartStr);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const weekEndStr = weekEnd.toISOString().split('T')[0];

  try {
    const { data: existing } = await supabase
      .from('weekly_trading_stats')
      .select('*')
      .eq('wallet_address', wallet)
      .eq('week_start', weekStartStr)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('weekly_trading_stats')
        .update({
          gas_fees_eth: (existing.gas_fees_eth || 0) + gasFeeEth,
          platform_fees_eth: (existing.platform_fees_eth || 0) + platformFeeEth,
          volume_eth: (existing.volume_eth || 0) + volumeEth,
          trade_count: (existing.trade_count || 0) + 1,
          weighted_fees: (existing.weighted_fees || 0) + weightedFees,
          multiplier: multiplier,
          badge_tier: badgeTier,
          badge_emoji: badgeEmoji,
        })
        .eq('wallet_address', wallet)
        .eq('week_start', weekStartStr);

      if (error) {
        console.error('Error updating weekly_trading_stats:', error.message);
      } else {
        console.log('Updated existing weekly_trading_stats record');
      }
    } else {
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
          badge_tier: badgeTier,
          badge_emoji: badgeEmoji,
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
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('wallet_address', wallet)
      .maybeSingle();

    if (profile) {
      // Update only columns that exist
      const { error } = await supabase
        .from('user_profiles')
        .update({
          staked_amount: stakedAmount,
          badge_tier: badgeTier,
          badge_emoji: badgeEmoji,
        })
        .eq('wallet_address', wallet);
        
      if (error) {
        console.error('Error updating user_profiles:', error.message);
      } else {
        console.log('Updated user profile:', wallet, badgeTier);
      }
    } else {
      const { error } = await supabase
        .from('user_profiles')
        .insert({
          wallet_address: wallet,
          staked_amount: stakedAmount,
          badge_tier: badgeTier,
          badge_emoji: badgeEmoji,
        });
        
      if (error) {
        console.error('Error creating user_profiles:', error.message);
      } else {
        console.log('Created new user profile:', wallet, badgeTier);
      }
    }
  } catch (err) {
    console.error('updateUserProfile exception:', err);
  }
}

// ============================================
// Leaderboard Functions
// ============================================

export async function getWeeklyLeaderboard(weekStart?: string): Promise<WeeklyLeaderboardEntry[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  // If no weekStart provided, get current week
  const effectiveWeekStart = weekStart || getCurrentWeekRange().weekStartStr;
  console.log('Fetching weekly leaderboard for week:', effectiveWeekStart);

  const { data, error } = await supabase
    .from('weekly_trading_stats')
    .select('*')
    .eq('week_start', effectiveWeekStart)
    .order('weighted_fees', { ascending: false });

  if (error) {
    console.error('Error fetching leaderboard:', error);
    return [];
  }

  console.log('Weekly leaderboard entries:', data?.length || 0);
  console.log('Weekly entries from DB:', data?.length || 0);

  // Calculate total weighted fees for logging
  const totalWeightedFees = (data || []).reduce((sum, row) => sum + (row.weighted_fees || 0), 0);
  console.log('Total weighted fees:', totalWeightedFees);

  const entries: WeeklyLeaderboardEntry[] = (data || []).map(row => ({
    wallet_address: row.wallet_address,
    volume_eth: row.volume_eth || 0,
    trade_count: row.trade_count || 0,
    gas_fees_eth: row.gas_fees_eth || 0,
    platform_fees_eth: row.platform_fees_eth || 0,
    weighted_fees: row.weighted_fees || 0,
    multiplier: row.multiplier || 0,
    badge_tier: row.badge_tier || 'Starter',
    badge_emoji: row.badge_emoji || '🌱',
  }));

  return entries;
}

export async function getAllTimeLeaderboard(): Promise<AllTimeLeaderboardEntry[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  console.log('Fetching all-time leaderboard...');

  // Aggregate all weekly stats by wallet
  const { data, error } = await supabase
    .from('weekly_trading_stats')
    .select('wallet_address, volume_eth, trade_count, gas_fees_eth, platform_fees_eth, badge_tier, badge_emoji, multiplier');

  if (error) {
    console.error('Error fetching all-time leaderboard:', error);
    return [];
  }

  // Aggregate by wallet address
  const walletMap = new Map<string, AllTimeLeaderboardEntry>();

  for (const row of (data || [])) {
    const wallet = row.wallet_address.toLowerCase();
    const existing = walletMap.get(wallet);
    
    if (existing) {
      existing.total_volume_eth += row.volume_eth || 0;
      existing.trade_count += row.trade_count || 0;
      existing.total_fees_paid_eth += (row.gas_fees_eth || 0) + (row.platform_fees_eth || 0);
      // Keep the latest badge info
      if (row.badge_tier) {
        existing.badge_tier = row.badge_tier;
        existing.badge_emoji = row.badge_emoji || '🌱';
      }
    } else {
      walletMap.set(wallet, {
        wallet_address: wallet,
        total_volume_eth: row.volume_eth || 0,
        trade_count: row.trade_count || 0,
        total_fees_paid_eth: (row.gas_fees_eth || 0) + (row.platform_fees_eth || 0),
        total_rewards_earned: 0,
        badge_tier: row.badge_tier || 'Starter',
        badge_emoji: row.badge_emoji || '🌱',
        staked_amount: 0,
      });
    }
  }

  // Sort by total volume
  const entries = Array.from(walletMap.values())
    .sort((a, b) => b.total_volume_eth - a.total_volume_eth);

  console.log('All-time leaderboard entries:', entries.length);
  return entries;
}

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

  return {
    wallet_address: data.wallet_address,
    volume_eth: data.volume_eth || 0,
    trade_count: data.trade_count || 0,
    gas_fees_eth: data.gas_fees_eth || 0,
    platform_fees_eth: data.platform_fees_eth || 0,
    weighted_fees: data.weighted_fees || 0,
    multiplier: data.multiplier || 0,
    badge_tier: data.badge_tier || 'Starter',
    badge_emoji: data.badge_emoji || '🌱',
  };
}

export async function getUserProfile(wallet: string): Promise<{
  wallet_address: string;
  badge_tier: string;
  badge_emoji: string;
  staked_amount: number;
} | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const walletLower = wallet.toLowerCase();

  const { data, error } = await supabase
    .from('user_profiles')
    .select('wallet_address, badge_tier, badge_emoji, staked_amount')
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
  };
}

// ============================================
// Partial Fill Support
// ============================================

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
  const baseDecimals = 4;
  const quoteDecimals = 18;
  
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
  cancelOrderByHash,
  updateOrderFilled,
  clearAllOrders,
  saveTrade,
  getTradesFromDb,
  saveTradeAfterExecution,
  recordTradeStats,
  getWeeklyLeaderboard,
  getAllTimeLeaderboard,
  getUserWeeklyStats,
  getUserProfile,
  savePartialFillOrder,
};

export default supabaseExports;
