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
  getCurrentWeekNumber,
  getWeeklyRewardPool,
  BadgeTier,
  BADGE_TIERS,
  PROGRAM_START_DATE,
} from '@/lib/staking';
import { 
  getSupabaseClient, 
  getWeeklyLeaderboard, 
  getAllTimeLeaderboard,
  WeeklyLeaderboardEntry,
  AllTimeLeaderboardEntry,
} from '@/lib/supabase';

interface WeeklyEntry extends WeeklyLeaderboardEntry {
  rank: number;
  estimated_reward: number;
}

interface AllTimeEntry extends AllTimeLeaderboardEntry {
  rank: number;
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
  const [weekNumber, setWeekNumber] = useState(1);

  // Fetch user's staking info
  const fetchUserStaking = useCallback(async () => {
    if (!address || !publicClient) return null;
    
    try {
      const provider = new ethers.BrowserProvider(publicClient as any);
      const stakeInfo = await getStakeInfo(address, provider);
      const badge = getBadgeTier(stakeInfo.stakedAmount);
      
      return { staked: stakeInfo.stakedAmount, badge };
    } catch (err) {
      console.error('Error fetching staking info:', err);
      return null;
    }
  }, [address, publicClient]);

  // Fetch all data
  const fetchData = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    
    try {
      // Get current week info
      const currentWeekNum = getCurrentWeekNumber();
      const { start, end, weekStartStr } = getCurrentWeekRange();
      const pool = getWeeklyRewardPool(currentWeekNum);
      
      console.log('=== LEADERBOARD DATA FETCH ===');
      console.log('Program start:', PROGRAM_START_DATE.toISOString());
      console.log('Current week number:', currentWeekNum);
      console.log('Week start:', weekStartStr);
      console.log('Week range:', start.toISOString(), '-', end.toISOString());
      console.log('Weekly pool:', pool);
      
      setWeekNumber(currentWeekNum);
      setWeekRange({ start, end });
      setWeeklyPool(pool);

      // Fetch weekly leaderboard
      const weeklyRaw = await getWeeklyLeaderboard();
      console.log('Weekly entries from DB:', weeklyRaw.length);

      // Calculate total weighted fees and estimated rewards
      let totalWeighted = 0;
      for (const entry of weeklyRaw) {
        // Calculate weighted fees on the fly if not set
        const fees = (entry.gas_fees_eth || 0) + (entry.platform_fees_eth || 0);
        const mult = entry.multiplier || 1;
        const weighted = entry.weighted_fees || (fees * mult);
        totalWeighted += weighted;
      }
      
      console.log('Total weighted fees:', totalWeighted);
      setTotalWeightedFees(totalWeighted);

      // Map to WeeklyEntry with ranks and estimated rewards
      const weeklyEntries: WeeklyEntry[] = weeklyRaw.map((entry, index) => {
        const fees = (entry.gas_fees_eth || 0) + (entry.platform_fees_eth || 0);
        const mult = entry.multiplier || 1;
        const weighted = entry.weighted_fees || (fees * mult);
        const estimatedReward = totalWeighted > 0 
          ? (weighted / totalWeighted) * pool 
          : 0;

        return {
          ...entry,
          rank: index + 1,
          weighted_fees: weighted,
          estimated_reward: estimatedReward,
        };
      });

      setWeeklyData(weeklyEntries);

      // Fetch all-time leaderboard
      const allTimeRaw = await getAllTimeLeaderboard();
      const allTimeEntries: AllTimeEntry[] = allTimeRaw.map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }));
      setAllTimeData(allTimeEntries);

      // Fetch user stats if connected
      if (address) {
        const stakingInfo = await fetchUserStaking();
        
        // Find user in weekly data
        const userWeeklyEntry = weeklyEntries.find(
          e => e.wallet_address.toLowerCase() === address.toLowerCase()
        );
        const userAllTimeEntry = allTimeEntries.find(
          e => e.wallet_address.toLowerCase() === address.toLowerCase()
        );

        if (stakingInfo) {
          const userFees = userWeeklyEntry 
            ? (userWeeklyEntry.gas_fees_eth || 0) + (userWeeklyEntry.platform_fees_eth || 0)
            : 0;
          const userWeighted = userWeeklyEntry?.weighted_fees || 0;
          const userEstReward = userWeeklyEntry?.estimated_reward || 0;

          setUserStats({
            staked: stakingInfo.staked,
            badge: stakingInfo.badge,
            weeklyFees: userFees,
            weeklyRank: userWeeklyEntry?.rank || 0,
            allTimeRank: userAllTimeEntry?.rank || 0,
            estimatedReward: userEstReward,
          });
        }
      }

      console.log('=== LEADERBOARD DATA FETCH COMPLETE ===');
    } catch (error) {
      console.error('Error fetching leaderboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [address, fetchUserStaking]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchData(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <span className="text-xl">🥇</span>;
    if (rank === 2) return <span className="text-xl">🥈</span>;
    if (rank === 3) return <span className="text-xl">🥉</span>;
    return <span className="text-gray-500 font-mono text-sm">#{rank}</span>;
  };

  const tabs = [
    { id: 'weekly' as const, label: 'TGIF Weekly', icon: <Gift className="w-4 h-4" /> },
    { id: 'alltime' as const, label: 'All Time', icon: <Trophy className="w-4 h-4" /> },
    { id: 'badges' as const, label: 'Badge Tiers', icon: <Medal className="w-4 h-4" /> },
  ];

  return (
    <div className="card">
      {/* Header */}
      <div className="text-center mb-4">
        <h2 className="text-2xl font-bold text-afrodex-orange flex items-center justify-center gap-2">
          <Trophy className="w-6 h-6" />
          TGIF Leaderboard
        </h2>
        <p className="text-gray-400 text-sm">Trade, stake, and earn rewards every Friday!</p>
      </div>

      {/* User Stats Card */}
      {isConnected && userStats && (
        <div className="mb-4 p-4 bg-gradient-to-r from-afrodex-orange/20 to-transparent border border-afrodex-orange/30 rounded-lg">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-afrodex-orange/20 rounded-lg">
              <span className="text-2xl">{userStats.badge.emoji}</span>
            </div>
            <div>
              <div className="font-semibold text-white">{userStats.badge.name}</div>
              <div className="text-sm text-gray-400">
                Staked: {formatStakedAmount(userStats.staked)} AfroX
              </div>
            </div>
            <div className="ml-auto text-right">
              <div className="text-sm text-gray-400">Multiplier</div>
              <div className="text-xl font-bold text-afrodex-orange">
                {userStats.badge.multiplier}x
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-xs text-gray-500">Weekly Rank</div>
              <div className="text-lg font-semibold text-white">
                {userStats.weeklyRank > 0 ? `#${userStats.weeklyRank}` : '-'}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Fees Paid</div>
              <div className="text-lg font-semibold text-white">
                {userStats.weeklyFees.toFixed(6)} ETH
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Est. Reward</div>
              <div className="text-lg font-semibold text-trade-buy">
                {formatRewardAmount(userStats.estimatedReward)} AfroX
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Week Info & Pool */}
      <div className="flex items-center justify-between mb-4 p-3 bg-afrodex-black-lighter rounded-lg">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-afrodex-orange" />
          <span className="text-sm text-gray-400">TGIF Leaderboard</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {weekRange && (
            <span className="text-gray-400">
              Week: {formatDate(weekRange.start)} - {formatDate(weekRange.end)}
            </span>
          )}
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="p-1 hover:bg-white/10 rounded transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 text-gray-400 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Weekly Pool Display */}
      <div className="flex items-center justify-between mb-4 p-3 bg-afrodex-black-lighter rounded-lg">
        <div className="flex items-center gap-2">
          <Gift className="w-4 h-4 text-afrodex-orange" />
          <span className="text-sm text-gray-400">This Week's Reward Pool:</span>
        </div>
        <span className="text-lg font-bold text-trade-buy">
          {formatRewardAmount(weeklyPool)} AfroX
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 p-1 bg-afrodex-black-lighter rounded-lg">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${
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

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-afrodex-orange" />
        </div>
      ) : (
        <>
          {/* Weekly Tab */}
          {activeTab === 'weekly' && (
            <div>
              {weeklyData.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No trades this week yet. Be the first!
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Header */}
                  <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs text-gray-500 border-b border-gray-700">
                    <div className="col-span-1">#</div>
                    <div className="col-span-4">Trader</div>
                    <div className="col-span-3 text-right">Volume</div>
                    <div className="col-span-2 text-center">Trades</div>
                    <div className="col-span-2 text-right">Total Rewards</div>
                  </div>

                  {/* Entries */}
                  {weeklyData.map((entry) => {
                    const isCurrentUser = address?.toLowerCase() === entry.wallet_address.toLowerCase();
                    
                    return (
                      <div
                        key={entry.wallet_address}
                        className={`grid grid-cols-12 gap-2 px-3 py-2 rounded-lg ${
                          isCurrentUser 
                            ? 'bg-afrodex-orange/20 border border-afrodex-orange/30' 
                            : 'bg-afrodex-black-lighter hover:bg-white/5'
                        }`}
                      >
                        <div className="col-span-1 flex items-center">
                          {getRankIcon(entry.rank)}
                        </div>
                        <div className="col-span-4 flex items-center gap-2">
                          <span className="text-lg">{entry.badge_emoji || '🔘'}</span>
                          <span className={`font-mono text-sm ${isCurrentUser ? 'text-afrodex-orange' : 'text-gray-300'}`}>
                            {formatAddress(entry.wallet_address)}
                          </span>
                        </div>
                        <div className="col-span-3 text-right font-mono text-sm">
                          {entry.volume_eth.toFixed(4)} ETH
                        </div>
                        <div className="col-span-2 text-center text-sm text-gray-400">
                          {entry.trade_count}
                        </div>
                        <div className="col-span-2 text-right font-mono text-sm text-trade-buy">
                          {formatRewardAmount(entry.estimated_reward)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* All Time Tab */}
          {activeTab === 'alltime' && (
            <div>
              {allTimeData.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No trading history yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Header */}
                  <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs text-gray-500 border-b border-gray-700">
                    <div className="col-span-1">#</div>
                    <div className="col-span-4">Trader</div>
                    <div className="col-span-3 text-right">Volume</div>
                    <div className="col-span-2 text-center">Trades</div>
                    <div className="col-span-2 text-right">Total Rewards</div>
                  </div>

                  {/* Entries */}
                  {allTimeData.map((entry) => {
                    const isCurrentUser = address?.toLowerCase() === entry.wallet_address.toLowerCase();
                    
                    return (
                      <div
                        key={entry.wallet_address}
                        className={`grid grid-cols-12 gap-2 px-3 py-2 rounded-lg ${
                          isCurrentUser 
                            ? 'bg-afrodex-orange/20 border border-afrodex-orange/30' 
                            : 'bg-afrodex-black-lighter hover:bg-white/5'
                        }`}
                      >
                        <div className="col-span-1 flex items-center">
                          {getRankIcon(entry.rank)}
                        </div>
                        <div className="col-span-4 flex items-center gap-2">
                          <span className="text-lg">{entry.badge_emoji || '🔘'}</span>
                          <span className={`font-mono text-sm ${isCurrentUser ? 'text-afrodex-orange' : 'text-gray-300'}`}>
                            {formatAddress(entry.wallet_address)}
                          </span>
                        </div>
                        <div className="col-span-3 text-right font-mono text-sm">
                          {entry.total_volume_eth.toFixed(4)} ETH
                        </div>
                        <div className="col-span-2 text-center text-sm text-gray-400">
                          {entry.trade_count}
                        </div>
                        <div className="col-span-2 text-right font-mono text-sm text-trade-buy">
                          {entry.total_rewards_earned > 0 
                            ? formatRewardAmount(entry.total_rewards_earned)
                            : '0'
                          }
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Badge Tiers Tab */}
          {activeTab === 'badges' && (
            <div className="space-y-2">
              {getAllBadgeTiers().map((tier) => {
                const isCurrentTier = userStats?.badge.name === tier.name;
                
                return (
                  <div
                    key={tier.name}
                    className={`p-3 rounded-lg ${
                      isCurrentTier 
                        ? 'bg-afrodex-orange/20 border border-afrodex-orange/30' 
                        : 'bg-afrodex-black-lighter'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{tier.emoji}</span>
                        <div>
                          <div className="font-semibold" style={{ color: tier.color }}>
                            {tier.name}
                          </div>
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
                );
              })}
              
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
        </>
      )}
    </div>
  );
}
