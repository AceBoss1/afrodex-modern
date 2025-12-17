// app/api/tgif/route.ts
// TGIF Rewards API - Calculate and distribute weekly rewards

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';
import { 
  getBadgeTier, 
  calculateWeightedFees, 
  getWeeklyRewardPool,
  getCurrentWeekRange,
  STAKING_ABI,
  AFROX_CONTRACT,
  AFROX_DECIMALS,
} from '@/lib/staking';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET - Get current week's leaderboard and stats
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const wallet = searchParams.get('wallet');
    
    const weekRange = getCurrentWeekRange();
    
    if (action === 'user' && wallet) {
      // Get specific user's stats
      const { data: weeklyStats } = await supabase
        .from('weekly_trading_stats')
        .select('*')
        .eq('wallet_address', wallet.toLowerCase())
        .eq('week_start', weekRange.start.toISOString().split('T')[0])
        .single();
      
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('wallet_address', wallet.toLowerCase())
        .single();
      
      return NextResponse.json({
        success: true,
        data: {
          profile,
          weeklyStats,
          weekRange: {
            start: weekRange.start.toISOString(),
            end: weekRange.end.toISOString(),
          },
        },
      });
    }
    
    if (action === 'leaderboard') {
      // Get weekly leaderboard
      const { data: weekly } = await supabase
        .from('weekly_leaderboard')
        .select('*')
        .limit(100);
      
      // Calculate total weighted fees
      const totalWeightedFees = (weekly || []).reduce(
        (sum, e) => sum + (e.weighted_fees || 0), 
        0
      );
      
      const weekNumber = 1; // TODO: Calculate actual week number
      const rewardPool = getWeeklyRewardPool(weekNumber);
      
      // Add estimated rewards
      const leaderboard = (weekly || []).map((entry, idx) => ({
        rank: idx + 1,
        ...entry,
        estimated_reward: totalWeightedFees > 0 
          ? (entry.weighted_fees / totalWeightedFees) * rewardPool 
          : 0,
      }));
      
      return NextResponse.json({
        success: true,
        data: {
          leaderboard,
          totalWeightedFees,
          rewardPool,
          weekRange: {
            start: weekRange.start.toISOString(),
            end: weekRange.end.toISOString(),
          },
          participants: leaderboard.length,
        },
      });
    }
    
    if (action === 'alltime') {
      // Get all-time leaderboard
      const { data } = await supabase
        .from('leaderboard')
        .select('*')
        .limit(100);
      
      return NextResponse.json({
        success: true,
        data: (data || []).map((entry, idx) => ({
          rank: idx + 1,
          ...entry,
        })),
      });
    }
    
    // Default: return overview
    const { data: distributions } = await supabase
      .from('tgif_distributions')
      .select('*')
      .order('week_number', { ascending: false })
      .limit(10);
    
    return NextResponse.json({
      success: true,
      data: {
        recentDistributions: distributions,
        currentWeek: weekRange,
        currentRewardPool: getWeeklyRewardPool(1),
      },
    });
    
  } catch (error: any) {
    console.error('TGIF API error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST - Admin actions (calculate/distribute rewards)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, weekNumber, adminKey } = body;
    
    // Simple admin key check (in production, use proper auth)
    const expectedKey = process.env.TGIF_ADMIN_KEY;
    if (expectedKey && adminKey !== expectedKey) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    if (action === 'snapshot') {
      // Take snapshot of staking balances and calculate weighted fees
      return await takeWeeklySnapshot(weekNumber);
    }
    
    if (action === 'calculate') {
      // Calculate rewards for the week
      return await calculateWeeklyRewards(weekNumber);
    }
    
    if (action === 'distribute') {
      // Mark distribution as complete (actual token transfer is manual)
      return await markDistributed(weekNumber, body.txHash);
    }
    
    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
    
  } catch (error: any) {
    console.error('TGIF POST error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

async function takeWeeklySnapshot(weekNumber: number) {
  const weekRange = getCurrentWeekRange();
  const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL);
  const stakingContract = new ethers.Contract(AFROX_CONTRACT, STAKING_ABI, provider);
  
  // Get all users with weekly stats
  const { data: weeklyStats } = await supabase
    .from('weekly_trading_stats')
    .select('wallet_address, gas_fees_eth, platform_fees_eth')
    .eq('week_start', weekRange.start.toISOString().split('T')[0]);
  
  if (!weeklyStats || weeklyStats.length === 0) {
    return NextResponse.json({
      success: true,
      message: 'No trades this week',
      participants: 0,
    });
  }
  
  // Update each user's staking snapshot
  for (const user of weeklyStats) {
    try {
      // Get staking balance from contract
      const stakeInfo = await stakingContract.viewStakeInfoOf(user.wallet_address);
      const stakedAmount = Number(ethers.formatUnits(stakeInfo[0], AFROX_DECIMALS));
      
      // Get badge tier
      const badge = getBadgeTier(stakedAmount);
      
      // Calculate weighted fees
      const totalFees = (user.gas_fees_eth || 0) + (user.platform_fees_eth || 0);
      const weightedFees = calculateWeightedFees(totalFees, badge.multiplier);
      
      // Update weekly stats with snapshot
      await supabase
        .from('weekly_trading_stats')
        .update({
          staked_at_snapshot: stakedAmount,
          badge_at_snapshot: badge.name,
          multiplier: badge.multiplier,
          weighted_fees: weightedFees,
        })
        .eq('wallet_address', user.wallet_address)
        .eq('week_start', weekRange.start.toISOString().split('T')[0]);
      
      // Update user profile
      await supabase
        .from('user_profiles')
        .upsert({
          wallet_address: user.wallet_address,
          staked_amount: stakedAmount,
          badge_tier: badge.name,
          badge_emoji: badge.emoji,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'wallet_address' });
      
    } catch (err) {
      console.error(`Error processing ${user.wallet_address}:`, err);
    }
  }
  
  return NextResponse.json({
    success: true,
    message: 'Snapshot taken',
    participants: weeklyStats.length,
  });
}

async function calculateWeeklyRewards(weekNumber: number) {
  const weekRange = getCurrentWeekRange();
  const rewardPool = getWeeklyRewardPool(weekNumber);
  
  // Get all weekly stats with weighted fees
  const { data: weeklyStats } = await supabase
    .from('weekly_trading_stats')
    .select('*')
    .eq('week_start', weekRange.start.toISOString().split('T')[0])
    .gt('weighted_fees', 0);
  
  if (!weeklyStats || weeklyStats.length === 0) {
    return NextResponse.json({
      success: true,
      message: 'No eligible participants',
      totalRewards: 0,
    });
  }
  
  // Calculate total weighted fees
  const totalWeightedFees = weeklyStats.reduce(
    (sum, u) => sum + (u.weighted_fees || 0), 
    0
  );
  
  // Create distribution record
  const { data: distribution, error: distError } = await supabase
    .from('tgif_distributions')
    .upsert({
      week_number: weekNumber,
      week_start: weekRange.start.toISOString().split('T')[0],
      week_end: weekRange.end.toISOString().split('T')[0],
      reward_pool: rewardPool,
      total_weighted_fees: totalWeightedFees,
      total_participants: weeklyStats.length,
    }, { onConflict: 'week_number' })
    .select()
    .single();
  
  if (distError) throw distError;
  
  // Calculate and store individual rewards
  const rewards = [];
  for (const user of weeklyStats) {
    const share = user.weighted_fees / totalWeightedFees;
    const reward = share * rewardPool;
    
    rewards.push({
      distribution_id: distribution.id,
      wallet_address: user.wallet_address,
      reward_amount: reward,
      weighted_fees: user.weighted_fees,
      percentage_share: share * 100,
    });
    
    // Update weekly stats with reward
    await supabase
      .from('weekly_trading_stats')
      .update({ reward_earned: reward })
      .eq('wallet_address', user.wallet_address)
      .eq('week_start', weekRange.start.toISOString().split('T')[0]);
    
    // Update user's total rewards
    await supabase.rpc('increment_rewards', {
      p_wallet: user.wallet_address,
      p_amount: reward,
    });
  }
  
  // Insert reward claims
  await supabase.from('reward_claims').insert(rewards);
  
  return NextResponse.json({
    success: true,
    message: 'Rewards calculated',
    weekNumber,
    rewardPool,
    totalWeightedFees,
    participants: weeklyStats.length,
    rewards: rewards.slice(0, 10), // Top 10 preview
  });
}

async function markDistributed(weekNumber: number, txHash: string) {
  await supabase
    .from('tgif_distributions')
    .update({
      distributed: true,
      distribution_tx: txHash,
      distributed_at: new Date().toISOString(),
    })
    .eq('week_number', weekNumber);
  
  return NextResponse.json({
    success: true,
    message: 'Distribution marked complete',
    txHash,
  });
}
