// components/Leaderboard.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { ethers } from 'ethers';
import { 
  Trophy, 
  Medal, 
  Star, 
  TrendingUp, 
  Clock, 
  Gift,
  ChevronDown,
  ChevronUp,
  Loader2,
  ExternalLink,
  Info
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
  calculateWeightedFees,
  BadgeTier,
  BADGE_TIERS,
} from '@/lib/staking';
import { getSupabaseClient } from '@/lib/supabase';

interface LeaderboardEntry {
  rank: number;
  wallet_address: string;
  badge_tier: string;
  badge_emoji: string;
  total_volume_eth: number;
  trade_count: number;
  total_fees_paid_eth: number;
  total_rewards_earned: number;
}

interface WeeklyEntry {
  rank: number;
  wallet_address: string;
  badge_tier: string;
  badge_emoji: string;
  volume_eth: number;
  trade_count: number;
  fees_paid_eth: number;
  weighted_fees: number;
  estimated_reward: number;
}

type TabType = 'weekly' | 'alltime' | 'badges';

export default function Leaderboard() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  
  const [activeTab, setActiveTab] = useState<TabType>('weekly');
  const [loading, setLoading] = useState(true);
  const [weeklyData, setWeeklyData] = useState<WeeklyEntry[]>([]);
  const [allTimeData, setAllTimeData] = useState<LeaderboardEntry[]>([]);
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
  const [showBadgeInfo, setShowBadgeInfo] = useState(false);

  // Fetch leaderboard data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const supabase = getSupabaseClient();
      
      let fetchedWeeklyData: WeeklyEntry[] = [];
      let fetchedAllTimeData: LeaderboardEntry[] = [];
      
      try {
        // Get current week range
        const range = getCurrentWeekRange();
        setWeekRange(range);
        
        // Week 1 reward pool (assuming program just started)
        setWeeklyPool(getWeeklyRewardPool(1));
        
        if (supabase) {
          // Fetch all-time leaderboard
          const { data: allTime } = await supabase
            .from('leaderboard')
            .select('*')
            .limit(50);
          
          if (allTime) {
            fetchedAllTimeData = allTime.map((entry, idx) => ({
              rank: idx + 1,
              ...entry,
            }));
            setAllTimeData(fetchedAllTimeData);
          }
          
          // Fetch weekly leaderboard
          const { data: weekly } = await supabase
            .from('weekly_leaderboard')
            .select('*')
            .limit(50);
          
          if (weekly) {
            // Calculate estimated rewards
            const totalWeightedFees = weekly.reduce((sum, e) => sum + (e.weighted_fees || 0), 0);
            const pool = getWeeklyRewardPool(1);
            
            fetchedWeeklyData = weekly.map((entry, idx) => ({
              rank: idx + 1,
              ...entry,
              estimated_reward: totalWeightedFees > 0 
                ? (entry.weighted_fees / totalWeightedFees) * pool 
                : 0,
            }));
            setWeeklyData(fetchedWeeklyData);
          }
        }
        
        // Fetch user's staking info
        if (address && publicClient) {
          const provider = new ethers.BrowserProvider(publicClient as any);
          const stakeInfo = await getStakeInfo(provider, address);
          const badge = getBadgeTier(stakeInfo.stakeBalanceFormatted);
          
          // Find user's ranks using local variables
          const weeklyRank = fetchedWeeklyData.findIndex(e => 
            e.wallet_address.toLowerCase() === address.toLowerCase()
          ) + 1;
          const allTimeRank = fetchedAllTimeData.findIndex(e => 
            e.wallet_address.toLowerCase() === address.toLowerCase()
          ) + 1;
          
          // Get user's weekly fees
          const userWeekly = fetchedWeeklyData.find(e => 
            e.wallet_address.toLowerCase() === address.toLowerCase()
          );
          
          setUserStats({
            staked: stakeInfo.stakeBalanceFormatted,
            badge,
            weeklyFees: userWeekly?.fees_paid_eth || 0,
            weeklyRank: weeklyRank || 0,
            allTimeRank: allTimeRank || 0,
            estimatedReward: userWeekly?.estimated_reward || 0,
          });
        }
      } catch (err) {
        console.error('Error fetching leaderboard:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [address, publicClient]);

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const formatEth = (value: number) => {
    if (value < 0.0001) return '< 0.0001';
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
        {weekRange && (
          <div className="text-xs text-gray-500">
            Week: {weekRange.start.toLocaleDateString()} - {weekRange.end.toLocaleDateString()}
          </div>
        )}
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
                    <span className="text-lg">{entry.badge_emoji}</span>
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
                    <span className="text-lg">{entry.badge_emoji}</span>
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
                  <li>Only trade takers (who pay gas) are eligible</li>
                  <li>Rewards = (Your Weighted Fees / Total Weighted Fees) × Pool</li>
                  <li>Weighted Fees = Fees Paid × Your Multiplier</li>
                  <li>Distributed every Friday!</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
