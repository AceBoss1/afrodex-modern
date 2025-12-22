// lib/staking.ts
// AfroX Staking Integration for TGIF Rewards System
import { ethers } from 'ethers';

// AfroX Token Contract (also handles staking)
export const AFROX_CONTRACT = '0x08130635368AA28b217a4dfb68E1bF8dC525621C';
export const AFROX_DECIMALS = 4; // AfroX uses 4 decimals

// Staking ABI - only the functions we need
export const STAKING_ABI = [
  'function viewStakeInfoOf(address) view returns (uint256 stakedAmount, uint256 stakingTimestamp, uint256 reward, bool isExist)',
  'function viewStakeInfo() view returns (uint256 stakedAmount, uint256 stakingTimestamp, uint256 reward, bool isExist)',
];

// TGIF Program Start Date - Friday, December 19, 2025
// This is when week 1 begins
export const PROGRAM_START_DATE = new Date('2025-12-19T00:00:00Z');

// Badge Tiers with staking requirements and multipliers
export interface BadgeTier {
  name: string;
  emoji: string;
  minStake: number; // In AfroX tokens (human-readable)
  multiplier: number;
  color: string;
}

export const BADGE_TIERS: BadgeTier[] = [
  { name: 'Starter', emoji: '🌱', minStake: 0, multiplier: 0, color: '#6b7280' },
  { name: 'Cadet', emoji: '🔰', minStake: 1_000_000_000, multiplier: 1.0, color: '#10b981' },
  { name: 'Captain', emoji: '🔱', minStake: 10_000_000_000, multiplier: 1.5, color: '#3b82f6' },
  { name: 'Commander', emoji: '⚜️', minStake: 50_000_000_000, multiplier: 2.0, color: '#8b5cf6' },
  { name: 'General', emoji: '⭐', minStake: 100_000_000_000, multiplier: 2.5, color: '#f59e0b' },
  { name: 'Marshal', emoji: '〽️', minStake: 500_000_000_000, multiplier: 2.75, color: '#ef4444' },
  { name: 'Platinum Sentinel', emoji: '💠', minStake: 1_000_000_000_000, multiplier: 3.0, color: '#06b6d4' },
  { name: 'Diamond Custodian', emoji: '❇️', minStake: 10_000_000_000_000, multiplier: 4.0, color: '#22d3ee' },
];

// Emission Schedule - 1 Trillion AfroX over ~3 years (156 weeks)
// Quarter 1 (Weeks 1-13): 25B/week = 325B total
// Quarter 2 (Weeks 14-26): 22B/week = 286B total
// Quarter 3 (Weeks 27-39): 18B/week = 234B total
// Quarter 4 (Weeks 40-52): 15B/week = 195B total = ~1.04T Year 1
// Year 2 (Weeks 53-104): 5B/week = 260B total
// Year 3 (Weeks 105-156): 2B/week = 104B total
export const EMISSION_SCHEDULE = [
  { weekStart: 1, weekEnd: 13, weeklyReward: 25_000_000_000 },   // Q1: 25B/week
  { weekStart: 14, weekEnd: 26, weeklyReward: 22_000_000_000 },  // Q2: 22B/week
  { weekStart: 27, weekEnd: 39, weeklyReward: 18_000_000_000 },  // Q3: 18B/week
  { weekStart: 40, weekEnd: 52, weeklyReward: 15_000_000_000 },  // Q4: 15B/week
  { weekStart: 53, weekEnd: 104, weeklyReward: 5_000_000_000 },  // Year 2: 5B/week
  { weekStart: 105, weekEnd: 156, weeklyReward: 2_000_000_000 }, // Year 3: 2B/week
];

// Platform fee percentage (0.3% = 0.003)
export const PLATFORM_FEE_PERCENT = 0.003;

/**
 * Get staking info for an address
 */
export async function getStakeInfo(
  address: string,
  provider?: ethers.Provider
): Promise<{ stakedAmount: number; isStaking: boolean }> {
  try {
    const rpcProvider = provider || new ethers.JsonRpcProvider(
      process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL
    );
    
    const contract = new ethers.Contract(AFROX_CONTRACT, STAKING_ABI, rpcProvider);
    const [stakedAmount, , , isExist] = await contract.viewStakeInfoOf(address);
    
    // Convert from 4 decimals to human-readable
    const stakedHuman = Number(ethers.formatUnits(stakedAmount, AFROX_DECIMALS));
    
    return {
      stakedAmount: stakedHuman,
      isStaking: isExist && stakedHuman > 0,
    };
  } catch (error) {
    console.error('Error getting stake info:', error);
    return { stakedAmount: 0, isStaking: false };
  }
}

/**
 * Get badge tier based on staked amount
 */
export function getBadgeTier(stakedAmount: number): BadgeTier {
  // Find the highest tier the user qualifies for
  for (let i = BADGE_TIERS.length - 1; i >= 0; i--) {
    if (stakedAmount >= BADGE_TIERS[i].minStake) {
      return BADGE_TIERS[i];
    }
  }
  return BADGE_TIERS[0]; // Default to Starter
}

/**
 * Get badge tier by name
 */
export function getBadgeByName(name: string): BadgeTier {
  return BADGE_TIERS.find(t => t.name === name) || BADGE_TIERS[0];
}

/**
 * Calculate weighted fees (fees × multiplier)
 */
export function calculateWeightedFees(totalFeesEth: number, multiplier: number): number {
  return totalFeesEth * multiplier;
}

/**
 * Calculate user's reward share
 * reward = (userWeightedFees / totalWeightedFees) × weeklyPool
 */
export function calculateReward(
  userWeightedFees: number,
  totalWeightedFees: number,
  weeklyPool: number
): number {
  if (totalWeightedFees === 0) return 0;
  return (userWeightedFees / totalWeightedFees) * weeklyPool;
}

/**
 * Get current week number since program start
 * Week 1 starts on PROGRAM_START_DATE (Friday, Dec 19, 2025)
 */
export function getCurrentWeekNumber(): number {
  const now = new Date();
  const diffTime = now.getTime() - PROGRAM_START_DATE.getTime();
  
  // If program hasn't started yet, return week 1
  if (diffTime < 0) return 1;
  
  const diffWeeks = Math.floor(diffTime / (7 * 24 * 60 * 60 * 1000));
  return Math.max(1, diffWeeks + 1); // Week 1 is the first week
}

/**
 * Get weekly reward pool based on week number
 */
export function getWeeklyRewardPool(weekNumber?: number): number {
  const week = weekNumber ?? getCurrentWeekNumber();
  
  for (const schedule of EMISSION_SCHEDULE) {
    if (week >= schedule.weekStart && week <= schedule.weekEnd) {
      return schedule.weeklyReward;
    }
  }
  
  // After week 156, program ends or minimal rewards
  return 0;
}

/**
 * Get current week's date range (Friday to Thursday)
 * Returns { start: Date, end: Date, weekStartStr: string }
 */
export function getCurrentWeekRange(): { start: Date; end: Date; weekStartStr: string } {
  const now = new Date();
  
  // Find the most recent Friday (or today if it's Friday)
  const dayOfWeek = now.getUTCDay(); // 0 = Sunday, 5 = Friday
  const daysSinceFriday = (dayOfWeek + 2) % 7; // Days since last Friday
  
  const weekStart = new Date(now);
  weekStart.setUTCDate(now.getUTCDate() - daysSinceFriday);
  weekStart.setUTCHours(0, 0, 0, 0);
  
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
  weekEnd.setUTCHours(23, 59, 59, 999);
  
  // Format as YYYY-MM-DD for database queries
  const weekStartStr = weekStart.toISOString().split('T')[0];
  
  return { start: weekStart, end: weekEnd, weekStartStr };
}

/**
 * Format staked amount for display
 */
export function formatStakedAmount(amount: number): string {
  if (amount >= 1_000_000_000_000) {
    return `${(amount / 1_000_000_000_000).toFixed(2)}T`;
  }
  if (amount >= 1_000_000_000) {
    return `${(amount / 1_000_000_000).toFixed(2)}B`;
  }
  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(2)}M`;
  }
  if (amount >= 1_000) {
    return `${(amount / 1_000).toFixed(2)}K`;
  }
  return amount.toFixed(2);
}

/**
 * Format reward amount for display (uses same logic)
 */
export function formatRewardAmount(amount: number): string {
  return formatStakedAmount(amount);
}

/**
 * Calculate platform fee from trade value
 */
export function calculatePlatformFee(tradeValueEth: number): number {
  return tradeValueEth * PLATFORM_FEE_PERCENT;
}

/**
 * Get all badge tiers for display
 */
export function getAllBadgeTiers(): BadgeTier[] {
  return BADGE_TIERS;
}

/**
 * Check if user is eligible for rewards (must have multiplier > 0)
 */
export function isEligibleForRewards(badge: BadgeTier): boolean {
  return badge.multiplier > 0;
}

/**
 * Get progress to next tier
 */
export function getProgressToNextTier(stakedAmount: number): {
  currentTier: BadgeTier;
  nextTier: BadgeTier | null;
  progress: number;
} {
  const currentTier = getBadgeTier(stakedAmount);
  const currentIndex = BADGE_TIERS.findIndex(t => t.name === currentTier.name);
  const nextTier = currentIndex < BADGE_TIERS.length - 1 
    ? BADGE_TIERS[currentIndex + 1] 
    : null;
  
  if (!nextTier) {
    return { currentTier, nextTier: null, progress: 100 };
  }
  
  const range = nextTier.minStake - currentTier.minStake;
  const progress = range > 0 
    ? ((stakedAmount - currentTier.minStake) / range) * 100 
    : 0;
  
  return {
    currentTier,
    nextTier,
    progress: Math.min(Math.max(progress, 0), 100),
  };
}

export default {
  AFROX_CONTRACT,
  AFROX_DECIMALS,
  STAKING_ABI,
  BADGE_TIERS,
  EMISSION_SCHEDULE,
  PLATFORM_FEE_PERCENT,
  PROGRAM_START_DATE,
  getStakeInfo,
  getBadgeTier,
  getBadgeByName,
  calculateWeightedFees,
  calculateReward,
  getCurrentWeekNumber,
  getWeeklyRewardPool,
  getCurrentWeekRange,
  formatStakedAmount,
  formatRewardAmount,
  calculatePlatformFee,
  getAllBadgeTiers,
  isEligibleForRewards,
  getProgressToNextTier,
};
