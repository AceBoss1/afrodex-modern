// components/Leaderboard.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { ethers } from 'ethers';
import { 
  Trophy, 
  Medal, 
  Gift,
  Loader2,
  Info,
  RefreshCw
} from 'lucide-react';
import { 
  getStakeInfo, 
  getBadgeTier, 
  formatStakedAmount, 
  formatRewardAmount,
  isEligibleForRewards,
  getProgressToNextTier,
  getAllBadgeTiers,
  getCurrentWeekRange,
  getWeeklyRewardPool,
  BadgeTier,
  BADGE_TIERS,
} from '@/lib/staking';
import { getSupabaseClient } from '@/lib/supabase';

interface WeeklyEntry {
  rank: number;
  wallet_address: string;
  badge_tier?: string;
  badge_emoji?: string;
  volume_eth: number;
  trade_count: number;
  fees_paid_eth: number;
  gas_fees_eth?: number;
  platform_fees_eth?: number;
  multiplier?: number;
  weighted_fees: number;
  estimated_reward: number;
}

interface AllTimeEntry {
  rank: number;
  wallet_address: string;
  badge_tier?: string;
  badge_emoji?: string;
  total_volume_eth: number;
  trade_count: number;
  total_fees_paid_eth: number;
  total_rewards_earned: number;
}

type TabType = 'weekly' | 'alltime' | 'badges';

export default function Leaderboard() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  
  const [activeTab, setActiveTab] = useState<TabType>('weekly');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [weeklyData, setWeeklyData] = useState<WeeklyEntry[]>([]);
  const [allTimeData, setAllTimeData] = useState<AllTimeEntry[]>([]);
  const [userStats, setUserStats] = useState<{
    staked: number;
    badge: BadgeTier;
    weeklyFees: number;
    weeklyRank: number;
    allTimeRank: number;
    estimatedReward: number;
  } | null>(null);
  const [weekRange, setWeekRange] = useState<{ start: Date; end: Date } | null>(null);
  const [weeklyPool, setWeeklyPool] = useState(0);
  const [totalWeightedFees, setTotalWeightedFees] = useState(0);

  // Calculate week number since program start
  const getWeekNumber = useCallback(() => {
    const programStart = new Date('2024-12-20'); // Program start date (first Friday)
    const now = new Date();
    const diffTime = now.getTime() - programStart.getTime();
    const diffWeeks = Math.floor(diffTime / (7 * 24 * 60 * 60 * 1000));
    return Math.max(1, diffWeeks + 1);
  }, []);

  // Fetch user's staking info and badge
  const fetchUserBadge = useCallback(async (walletAddress: string): Promise<{ badge: BadgeTier; staked: number }> => {
    try {
      if (publicClient) {
        const provider = new ethers.BrowserProvider(publicClient as any);
        const stakeInfo = await getStakeInfo(provider, walletAddress);
        const badge = getBadgeTier(stakeInfo.stakeBalanceFormatted);
        return { badge, staked: stakeInfo.stakeBalanceFormatted };
      }
    } catch (err) {
      console.error('Error fetching stake info for', walletAddress, err);
    }
    // Default to Starter if can't fetch
    return { badge: BADGE_TIERS[0], staked: 0 };
  }, [publicClient]);

  // Fetch leaderboard data
  const fetchData = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    else setRefreshing(true);
    
    const supabase = getSupabaseClient();
    
    try {
      // Get current week range
      const range = getCurrentWeekRange();
      setWeekRange(range);
      
      // Get week number and reward pool
      const weekNum = getWeekNumber();
      const pool = getWeeklyRewardPool(weekNum);
      setWeeklyPool(pool);
      
      if (supabase) {
        // Fetch weekly trading stats for current week
        const weekStartStr = range.start.toISOString().split('T')[0];
        
        const { data: weeklyStats, error: weeklyError } = await supabase
          .from('weekly_trading_stats')
          .select('*')
          .eq('week_start', weekStartStr)
          .order('volume_eth', { ascending: false });
        
        if (weeklyError) {
          console.error('Error fetching weekly stats:', weeklyError);
        }

        if (weeklyStats && weeklyStats.length > 0) {
          // Calculate weighted fees for each trader in real-time
          const entriesWithRewards: WeeklyEntry[] = [];
          let totalWeighted = 0;

          for (const entry of weeklyStats) {
            // Get badge info for multiplier
            let multiplier = entry.multiplier || 1;
            let badgeEmoji = entry.badge_emoji || '🌱';
            let badgeTier = entry.badge_tier || 'Starter';
            
            // If no cached badge info, try to fetch from profile or use defaults
            if (!entry.multiplier || entry.multiplier === 0) {
              const { data: profile } = await supabase
                .from('user_profiles')
                .select('badge_tier, badge_emoji, staked_amount')
                .eq('wallet_address', entry.wallet_address)
                .single();
              
              if (profile) {
                const badge = getBadgeTier(profile.staked_amount || 0);
                multiplier = badge.multiplier;
                badgeEmoji = badge.emoji;
                badgeTier = badge.name;
              }
            }

            // Calculate total fees paid (gas + platform)
            const totalFees = (entry.gas_fees_eth || 0) + (entry.platform_fees_eth || 0);
            
            // Calculate weighted fees = fees × multiplier
            const weightedFees = totalFees * multiplier;
            totalWeighted += weightedFees;

            entriesWithRewards.push({
              rank: 0, // Will set after sorting
              wallet_address: entry.wallet_address,
              badge_tier: badgeTier,
              badge_emoji: badgeEmoji,
              volume_eth: entry.volume_eth || 0,
              trade_count: entry.trade_count || 0,
              fees_paid_eth: totalFees,
              gas_fees_eth: entry.gas_fees_eth || 0,
              platform_fees_eth: entry.platform_fees_eth || 0,
              multiplier: multiplier,
              weighted_fees: weightedFees,
              estimated_reward: 0, // Will calculate after we have total
            });
          }

          setTotalWeightedFees(totalWeighted);

          // Calculate estimated rewards based on share of total weighted fees
          const finalEntries = entriesWithRewards
            .sort((a, b) => b.weighted_fees - a.weighted_fees) // Sort by weighted fees
            .map((entry, idx) => ({
              ...entry,
              rank: idx + 1,
              estimated_reward: totalWeighted > 0
                ? (entry.weighted_fees / totalWeighted) * pool
                : 0,
            }));

          setWeeklyData(finalEntries);

          // Update user stats if connected
          if (address) {
            const userEntry = finalEntries.find(e => 
              e.wallet_address.toLowerCase() === address.toLowerCase()
            );

            if (userEntry) {
              const { badge, staked } = await fetchUserBadge(address);
              setUserStats({
                staked,
                badge,
                weeklyFees: userEntry.fees_paid_eth,
                weeklyRank: userEntry.rank,
                allTimeRank: 0,
                estimatedReward: userEntry.estimated_reward,
              });
            } else {
              // User hasn't traded this week
              const { badge, staked } = await fetchUserBadge(address);
              setUserStats({
                staked,
                badge,
                weeklyFees: 0,
                weeklyRank: 0,
                allTimeRank: 0,
                estimatedReward: 0,
              });
            }
          }
        } else {
          setWeeklyData([]);
          // Still fetch user badge even if no trades
          if (address) {
            const { badge, staked } = await fetchUserBadge(address);
            setUserStats({
              staked,
              badge,
              weeklyFees: 0,
              weeklyRank: 0,
              allTimeRank: 0,
              estimatedReward: 0,
            });
          }
        }

        // Fetch all-time leaderboard from user_profiles
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('*')
          .order('total_volume_eth', { ascending: false })
          .limit(50);
        
        if (profiles) {
          setAllTimeData(profiles.map((entry, idx) => ({
            rank: idx + 1,
            wallet_address: entry.wallet_address,
            badge_tier: entry.badge_tier,
            badge_emoji: entry.badge_emoji,
            total_volume_eth: entry.total_volume_eth || 0,
            trade_count: entry.trade_count || 0,
            total_fees_paid_eth: (entry.total_gas_fees_eth || 0) + (entry.total_platform_fees_eth || 0),
            total_rewards_earned: entry.total_rewards_earned || 0,
          })));
        }
      }
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [address, publicClient, fetchUserBadge, getWeekNumber]);

  useEffect(() => {
    fetchData();
    
    // Refresh every 30 seconds
    const interval = setInterval(() => fetchData(false), 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const formatEth = (value: number) => {
    if (value === 0) return '0';
    if (value < 0.00000001) return value.toExponential(2);
    if (value < 0.0001) return value.toFixed(8);
    return value.toFixed(4);
  };

  const tabs = [
    { id: 'weekly' as TabType, label: 'TGIF Weekly', icon: <Gift className="w-4 h-4" /> },
    { id: 'alltime' as TabType, label: 'All Time', icon: <Trophy className="w-4 h-4" /> },
    { id: 'badges' as TabType, label: 'Badge Tiers', icon: <Medal className="w-4 h-4" /> },
  ];

  if (loading) {
    return (
      <div className="card flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-afrodex-orange" />
      </div>
    );
  }

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Trophy className="w-5 h-5 text-afrodex-orange" />
          TGIF Leaderboard
        </h2>
        <div className="flex items-center gap-2">
          {weekRange && (
            <div className="text-xs text-gray-500">
              Week: {weekRange.start.toLocaleDateString()} - {weekRange.end.toLocaleDateString()}
            </div>
          )}
          <button
            onClick={() => fetchData(false)}
            disabled={refreshing}
            className="p-1 rounded hover:bg-white/10 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 text-gray-400 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* User Stats Card (if connected and staking) */}
      {isConnected && userStats && (
        <div className="mb-4 p-4 bg-gradient-to-r from-afrodex-orange/20 to-yellow-600/20 rounded-lg border border-afrodex-orange/30">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{userStats.badge.emoji}</span>
              <div>
                <div className="font-bold text-white">{userStats.badge.name}</div>
                <div className="text-xs text-gray-400">
                  Staked: {formatStakedAmount(userStats.staked)} AfroX
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-400">Multiplier</div>
              <div className="text-xl font-bold text-afrodex-orange">
                {userStats.badge.multiplier}x
              </div>
            </div>
          </div>
          
          {!isEligibleForRewards(userStats.staked) ? (
            <div className="text-center py-2 bg-yellow-600/20 rounded text-yellow-400 text-sm">
              ⚠️ Stake at least 1B AfroX to earn TGIF rewards!
              <a 
                href="https://defi.afrox.one/?ref=CFBD73A1" 
                target="_blank" 
                rel="noopener noreferrer"
                className="block mt-1 text-afrodex-orange hover:underline"
              >
                Stake at AfroX DeFi-Hub →
              </a>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-xs text-gray-500">Weekly Rank</div>
                <div className="font-bold text-white">
                  {userStats.weeklyRank > 0 ? `#${userStats.weeklyRank}` : '-'}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Fees Paid</div>
                <div className="font-bold text-white">
                  {formatEth(userStats.weeklyFees)} ETH
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Est. Reward</div>
                <div className="font-bold text-trade-buy">
                  {formatRewardAmount(userStats.estimatedReward)} AfroX
                </div>
              </div>
            </div>
          )}
          
          {/* Progress to next tier */}
          {userStats.badge.name !== 'Diamond Custodian' && (
            <div className="mt-3">
              {(() => {
                const progress = getProgressToNextTier(userStats.staked);
                if (!progress.nextTier) return null;
                return (
                  <div>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Progress to {progress.nextTier.emoji} {progress.nextTier.name}</span>
                      <span>{progress.progress.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-afrodex-orange transition-all"
                        style={{ width: `${progress.progress}%` }}
                      />
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* Reward Pool Info */}
      <div className="mb-4 p-3 bg-afrodex-black-lighter rounded-lg flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gift className="w-5 h-5 text-yellow-500" />
          <span className="text-sm text-gray-400">This Week&apos;s Reward Pool:</span>
        </div>
        <span className="font-bold text-yellow-500">
          {formatRewardAmount(weeklyPool)} AfroX
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 p-1 bg-afrodex-black-lighter rounded-lg">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-1 ${
              activeTab === tab.id
                ? 'bg-afrodex-orange text-white'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Weekly Leaderboard */}
      {activeTab === 'weekly' && (
        <div className="space-y-2">
          {weeklyData.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No trades this week yet. Be the first!
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="grid grid-cols-12 gap-2 text-xs text-gray-500 px-2 pb-2 border-b border-white/5">
                <span className="col-span-1">#</span>
                <span className="col-span-4">Trader</span>
                <span className="col-span-2 text-right">Volume</span>
                <span className="col-span-2 text-right">Fees</span>
                <span className="col-span-3 text-right">Est. Reward</span>
              </div>
              
              {/* Entries */}
              {weeklyData.slice(0, 20).map((entry) => (
                <div 
                  key={entry.wallet_address}
                  className={`grid grid-cols-12 gap-2 items-center p-2 rounded-lg text-sm ${
                    entry.wallet_address.toLowerCase() === address?.toLowerCase()
                      ? 'bg-afrodex-orange/20 border border-afrodex-orange/30'
                      : 'bg-afrodex-black-lighter hover:bg-white/5'
                  }`}
                >
                  <span className="col-span-1 font-bold">
                    {entry.rank <= 3 ? ['🥇', '🥈', '🥉'][entry.rank - 1] : entry.rank}
                  </span>
                  <div className="col-span-4 flex items-center gap-2">
                    <span className="text-lg">{entry.badge_emoji || '🌱'}</span>
                    <span className="font-mono text-xs">
                      {formatAddress(entry.wallet_address)}
                    </span>
                  </div>
                  <span className="col-span-2 text-right font-mono text-xs">
                    {formatEth(entry.volume_eth)} ETH
                  </span>
                  <span className="col-span-2 text-right font-mono text-xs text-gray-400">
                    {formatEth(entry.fees_paid_eth)}
                  </span>
                  <span className="col-span-3 text-right font-mono text-xs text-trade-buy">
                    {formatRewardAmount(entry.estimated_reward)}
                  </span>
                </div>
              ))}

              {/* Pool share info */}
              {totalWeightedFees > 0 && (
                <div className="mt-4 p-2 bg-gray-800/50 rounded text-xs text-gray-400 text-center">
                  Total Pool Share Points: {totalWeightedFees.toFixed(6)} • 
                  Higher badge = Higher multiplier = More rewards!
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* All-Time Leaderboard */}
      {activeTab === 'alltime' && (
        <div className="space-y-2">
          {allTimeData.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No trading history yet.
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="grid grid-cols-12 gap-2 text-xs text-gray-500 px-2 pb-2 border-b border-white/5">
                <span className="col-span-1">#</span>
                <span className="col-span-4">Trader</span>
                <span className="col-span-2 text-right">Volume</span>
                <span className="col-span-2 text-right">Trades</span>
                <span className="col-span-3 text-right">Total Rewards</span>
              </div>
              
              {/* Entries */}
              {allTimeData.slice(0, 20).map((entry) => (
                <div 
                  key={entry.wallet_address}
                  className={`grid grid-cols-12 gap-2 items-center p-2 rounded-lg text-sm ${
                    entry.wallet_address.toLowerCase() === address?.toLowerCase()
                      ? 'bg-afrodex-orange/20 border border-afrodex-orange/30'
                      : 'bg-afrodex-black-lighter hover:bg-white/5'
                  }`}
                >
                  <span className="col-span-1 font-bold">
                    {entry.rank <= 3 ? ['🥇', '🥈', '🥉'][entry.rank - 1] : entry.rank}
                  </span>
                  <div className="col-span-4 flex items-center gap-2">
                    <span className="text-lg">{entry.badge_emoji || '🌱'}</span>
                    <span className="font-mono text-xs">
                      {formatAddress(entry.wallet_address)}
                    </span>
                  </div>
                  <span className="col-span-2 text-right font-mono text-xs">
                    {formatEth(entry.total_volume_eth)} ETH
                  </span>
                  <span className="col-span-2 text-right font-mono text-xs text-gray-400">
                    {entry.trade_count}
                  </span>
                  <span className="col-span-3 text-right font-mono text-xs text-trade-buy">
                    {formatRewardAmount(entry.total_rewards_earned)}
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Badge Tiers */}
      {activeTab === 'badges' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-400 mb-4">
            Stake AfroX to unlock higher tiers and earn more rewards!
          </p>
          
          {getAllBadgeTiers().map((tier) => (
            <div 
              key={tier.name}
              className={`p-3 rounded-lg border ${
                userStats?.badge.name === tier.name
                  ? 'bg-afrodex-orange/20 border-afrodex-orange/50'
                  : 'bg-afrodex-black-lighter border-white/5'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{tier.emoji}</span>
                  <div>
                    <div className="font-semibold text-white">{tier.name}</div>
                    <div className="text-xs text-gray-500">
                      {tier.minStake === 0 
                        ? 'No minimum stake' 
                        : `≥ ${formatStakedAmount(tier.minStake)} AfroX`
                      }
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-lg font-bold ${
                    tier.multiplier === 0 ? 'text-gray-500' : 'text-afrodex-orange'
                  }`}>
                    {tier.multiplier}x
                  </div>
                  <div className="text-xs text-gray-500">multiplier</div>
                </div>
              </div>
            </div>
          ))}
          
          <div className="mt-4 p-3 bg-yellow-600/10 border border-yellow-600/30 rounded-lg">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-yellow-500 mt-0.5" />
              <div className="text-xs text-yellow-400">
                <strong>How TGIF Rewards Work:</strong>
                <ul className="mt-1 space-y-1 list-disc list-inside text-yellow-400/80">
                  <li>Trade takers who pay fees are eligible</li>
                  <li>Rewards = (Your Weighted Fees / Total Weighted Fees) × Pool</li>
                  <li>Weighted Fees = Fees Paid × Your Multiplier</li>
                  <li>Distributed every Friday!</li>
                </ul>
                <a 
                  href="https://defi.afrox.one/?ref=CFBD73A1" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-block mt-2 text-afrodex-orange hover:underline"
                >
                  Stake at AfroX DeFi-Hub →
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
