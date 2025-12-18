// lib/staking.ts
// AfroX Staking integration for TGIF Rewards

import { ethers, Contract, Provider } from 'ethers';

// AfroX token contract (has staking built-in)
export const AFROX_CONTRACT = '0x08130635368AA28b217a4dfb68E1bF8dC525621C';
export const AFROX_DECIMALS = 4;

// Staking ABI (relevant functions)
export const STAKING_ABI = [
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'viewStakeInfoOf',
    outputs: [
      { internalType: 'uint256', name: 'stakeBalance', type: 'uint256' },
      { internalType: 'uint256', name: 'rewardValue', type: 'uint256' },
      { internalType: 'uint256', name: 'lastUnstakeTimestamp', type: 'uint256' },
      { internalType: 'uint256', name: 'lastRewardTimestamp', type: 'uint256' }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'rewardRate',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'minStake',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  }
];

// Badge tier definitions
export const BADGE_TIERS = [
  { name: 'Diamond Custodian', emoji: '❇️', minStake: 10_000_000_000_000, multiplier: 4.0, order: 7 },
  { name: 'Platinum Sentinel', emoji: '💠', minStake: 1_000_000_000_000, multiplier: 3.0, order: 6 },
  { name: 'Marshal', emoji: '〽️', minStake: 500_000_000_000, multiplier: 2.75, order: 5 },
  { name: 'General', emoji: '⭐', minStake: 100_000_000_000, multiplier: 2.5, order: 4 },
  { name: 'Commander', emoji: '⚜️', minStake: 50_000_000_000, multiplier: 2.0, order: 3 },
  { name: 'Captain', emoji: '🔱', minStake: 10_000_000_000, multiplier: 1.5, order: 2 },
  { name: 'Cadet', emoji: '🔰', minStake: 1_000_000_000, multiplier: 1.0, order: 1 },
  { name: 'Starter', emoji: '🔘', minStake: 0, multiplier: 0.0, order: 0 },
];

// Emission schedule (1T AfroX over 52 weeks / 1 year)
export const EMISSION_SCHEDULE = [
  { weekStart: 1, weekEnd: 13, weeklyReward: 25_000_000_000, period: 'Q1' },
  { weekStart: 14, weekEnd: 26, weeklyReward: 22_000_000_000, period: 'Q2' },
  { weekStart: 27, weekEnd: 39, weeklyReward: 18_000_000_000, period: 'Q3' },
  { weekStart: 40, weekEnd: 52, weeklyReward: 15_000_000_000, period: 'Q4' },
];

// Platform fee percentage
export const PLATFORM_FEE_PERCENT = 0.003; // 0.3%

export interface StakeInfo {
  stakeBalance: bigint;
  stakeBalanceFormatted: number;
  rewardValue: bigint;
  rewardValueFormatted: number;
  lastUnstakeTimestamp: number;
  lastRewardTimestamp: number;
}

export interface BadgeTier {
  name: string;
  emoji: string;
  minStake: number;
  multiplier: number;
  order: number;
}

export interface UserRewardInfo {
  walletAddress: string;
  stakeInfo: StakeInfo;
  badge: BadgeTier;
  weeklyFeesPaid: number;
  weightedFees: number;
  estimatedReward: number;
}

/**
 * Get staking info for an address
 */
export async function getStakeInfo(
  provider: Provider,
  walletAddress: string
): Promise<StakeInfo> {
  try {
    const contract = new Contract(AFROX_CONTRACT, STAKING_ABI, provider);
    const info = await contract.viewStakeInfoOf(walletAddress);
    
    const stakeBalance = info[0];
    const rewardValue = info[1];
    const lastUnstakeTimestamp = Number(info[2]);
    const lastRewardTimestamp = Number(info[3]);
    
    return {
      stakeBalance,
      stakeBalanceFormatted: Number(ethers.formatUnits(stakeBalance, AFROX_DECIMALS)),
      rewardValue,
      rewardValueFormatted: Number(ethers.formatUnits(rewardValue, AFROX_DECIMALS)),
      lastUnstakeTimestamp,
      lastRewardTimestamp,
    };
  } catch (error) {
    console.error('Error fetching stake info:', error);
    return {
      stakeBalance: 0n,
      stakeBalanceFormatted: 0,
      rewardValue: 0n,
      rewardValueFormatted: 0,
      lastUnstakeTimestamp: 0,
      lastRewardTimestamp: 0,
    };
  }
}

/**
 * Get badge tier for a given staked amount
 */
export function getBadgeTier(stakedAmount: number): BadgeTier {
  for (const tier of BADGE_TIERS) {
    if (stakedAmount >= tier.minStake) {
      return tier;
    }
  }
  return BADGE_TIERS[BADGE_TIERS.length - 1]; // Starter
}

/**
 * Get badge tier by name
 */
export function getBadgeByName(name: string): BadgeTier | undefined {
  return BADGE_TIERS.find(t => t.name === name);
}

/**
 * Calculate weighted fees (fees × multiplier)
 */
export function calculateWeightedFees(
  feesPaid: number,
  multiplier: number
): number {
  return feesPaid * multiplier;
}

/**
 * Calculate estimated reward for a user
 */
export function calculateReward(
  userWeightedFees: number,
  totalWeightedFees: number,
  weeklyRewardPool: number
): number {
  if (totalWeightedFees === 0) return 0;
  return (userWeightedFees / totalWeightedFees) * weeklyRewardPool;
}

/**
 * Get current week number since program start
 */
export function getCurrentWeekNumber(startDate: Date): number {
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - startDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.ceil(diffDays / 7);
}

/**
 * Get weekly reward pool for a given week number
 */
export function getWeeklyRewardPool(weekNumber: number): number {
  for (const schedule of EMISSION_SCHEDULE) {
    if (weekNumber >= schedule.weekStart && weekNumber <= schedule.weekEnd) {
      return schedule.weeklyReward;
    }
  }
  // After 156 weeks, no more rewards
  return 0;
}

/**
 * Get current week's Friday to Thursday range
 */
export function getCurrentWeekRange(): { start: Date; end: Date } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  
  // Calculate days since last Friday
  const daysSinceFriday = (dayOfWeek + 2) % 7;
  
  const start = new Date(now);
  start.setDate(now.getDate() - daysSinceFriday);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  
  return { start, end };
}

/**
 * Format staked amount with appropriate suffix
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
  return amount.toFixed(0);
}

/**
 * Format reward amount
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
  return [...BADGE_TIERS].reverse(); // Return in ascending order
}

/**
 * Check if user is eligible for rewards (must have staked >= 1B)
 */
export function isEligibleForRewards(stakedAmount: number): boolean {
  return stakedAmount >= 1_000_000_000; // 1B minimum
}

/**
 * Get progress to next badge tier
 */
export function getProgressToNextTier(
  stakedAmount: number
): { currentTier: BadgeTier; nextTier: BadgeTier | null; progress: number } {
  const currentTier = getBadgeTier(stakedAmount);
  
  // Find next tier
  const currentIndex = BADGE_TIERS.findIndex(t => t.name === currentTier.name);
  const nextTier = currentIndex > 0 ? BADGE_TIERS[currentIndex - 1] : null;
  
  if (!nextTier) {
    return { currentTier, nextTier: null, progress: 100 };
  }
  
  const range = nextTier.minStake - currentTier.minStake;
  const progress = ((stakedAmount - currentTier.minStake) / range) * 100;
  
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
