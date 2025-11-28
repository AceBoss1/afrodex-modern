// lib/exchange.ts
import { ethers } from 'ethers';
import { EXCHANGE_ABI, ERC20_ABI } from './abi';

export const EXCHANGE_ADDRESS = process.env.NEXT_PUBLIC_EXCHANGE_CONTRACT || '0xe8fff15bb5e14095bfdfa8bb85d83cc900c23c56';
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export interface Order {
  tokenGet: string;
  amountGet: string;
  tokenGive: string;
  amountGive: string;
  expires: string;
  nonce: string;
  user: string;
  v?: number;
  r?: string;
  s?: string;
  availableVolume?: string;
  amountFilled?: string;
  price?: number;
}

export interface Trade {
  txHash: string;
  blockNumber: number;
  timestamp: number;
  tokenGet: string;
  amountGet: string;
  tokenGive: string;
  amountGive: string;
  get: string;
  give: string;
  price: number;
  side: 'buy' | 'sell';
}

export interface Balance {
  wallet: string;
  exchange: string;
}

/**
 * Get user's balance on exchange
 */
export async function getExchangeBalance(
  provider: ethers.Provider,
  tokenAddress: string,
  userAddress: string
): Promise<string> {
  const contract = new ethers.Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, provider);
  const balance = await contract.balanceOf(tokenAddress, userAddress);
  return balance.toString();
}

/**
 * Get user's wallet balance
 */
export async function getWalletBalance(
  provider: ethers.Provider,
  tokenAddress: string,
  userAddress: string
): Promise<string> {
  if (tokenAddress === ZERO_ADDRESS) {
    // ETH balance
    const balance = await provider.getBalance(userAddress);
    return balance.toString();
  } else {
    // ERC20 token balance
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const balance = await contract.balanceOf(userAddress);
    return balance.toString();
  }
}

/**
 * Get token info from contract
 */
export async function getTokenInfo(
  provider: ethers.Provider,
  tokenAddress: string
): Promise<{ name: string; symbol: string; decimals: number }> {
  if (tokenAddress === ZERO_ADDRESS) {
    return { name: 'Ethereum', symbol: 'ETH', decimals: 18 };
  }
  
  try {
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const [name, symbol, decimals] = await Promise.all([
      contract.name(),
      contract.symbol(),
      contract.decimals(),
    ]);
    return { name, symbol, decimals: Number(decimals) };
  } catch (error) {
    console.error('Error fetching token info:', error);
    throw new Error('Invalid token address');
  }
}

/**
 * Approve token for exchange
 */
export async function approveToken(
  signer: ethers.Signer,
  tokenAddress: string,
  amount: string
): Promise<ethers.ContractTransactionResponse> {
  const contract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
  return await contract.approve(EXCHANGE_ADDRESS, amount);
}

/**
 * Check token allowance
 */
export async function checkAllowance(
  provider: ethers.Provider,
  tokenAddress: string,
  userAddress: string
): Promise<string> {
  const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  const allowance = await contract.allowance(userAddress, EXCHANGE_ADDRESS);
  return allowance.toString();
}

/**
 * Deposit ETH to exchange
 */
export async function depositEth(
  signer: ethers.Signer,
  amount: string
): Promise<ethers.ContractTransactionResponse> {
  const contract = new ethers.Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, signer);
  return await contract.deposit({ value: amount });
}

/**
 * Withdraw ETH from exchange
 */
export async function withdrawEth(
  signer: ethers.Signer,
  amount: string
): Promise<ethers.ContractTransactionResponse> {
  const contract = new ethers.Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, signer);
  return await contract.withdraw(amount);
}

/**
 * Deposit token to exchange
 */
export async function depositToken(
  signer: ethers.Signer,
  tokenAddress: string,
  amount: string
): Promise<ethers.ContractTransactionResponse> {
  const contract = new ethers.Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, signer);
  return await contract.depositToken(tokenAddress, amount);
}

/**
 * Withdraw token from exchange
 */
export async function withdrawToken(
  signer: ethers.Signer,
  tokenAddress: string,
  amount: string
): Promise<ethers.ContractTransactionResponse> {
  const contract = new ethers.Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, signer);
  return await contract.withdrawToken(tokenAddress, amount);
}

/**
 * Place an order on the exchange
 */
export async function placeOrder(
  signer: ethers.Signer,
  tokenGet: string,
  amountGet: string,
  tokenGive: string,
  amountGive: string,
  expires: string,
  nonce: string
): Promise<ethers.ContractTransactionResponse> {
  const contract = new ethers.Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, signer);
  return await contract.order(tokenGet, amountGet, tokenGive, amountGive, expires, nonce);
}

/**
 * Execute a trade
 */
export async function executeTrade(
  signer: ethers.Signer,
  order: Order,
  amount: string
): Promise<ethers.ContractTransactionResponse> {
  const contract = new ethers.Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, signer);
  return await contract.trade(
    order.tokenGet,
    order.amountGet,
    order.tokenGive,
    order.amountGive,
    order.expires,
    order.nonce,
    order.user,
    order.v!,
    order.r!,
    order.s!,
    amount
  );
}

/**
 * Cancel an order
 */
export async function cancelOrder(
  signer: ethers.Signer,
  order: Order
): Promise<ethers.ContractTransactionResponse> {
  const contract = new ethers.Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, signer);
  return await contract.cancelOrder(
    order.tokenGet,
    order.amountGet,
    order.tokenGive,
    order.amountGive,
    order.expires,
    order.nonce,
    order.v!,
    order.r!,
    order.s!
  );
}

/**
 * Get available volume for an order
 */
export async function getAvailableVolume(
  provider: ethers.Provider,
  order: Order
): Promise<string> {
  const contract = new ethers.Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, provider);
  const volume = await contract.availableVolume(
    order.tokenGet,
    order.amountGet,
    order.tokenGive,
    order.amountGive,
    order.expires,
    order.nonce,
    order.user,
    order.v!,
    order.r!,
    order.s!
  );
  return volume.toString();
}

/**
 * Format amount with decimals
 */
export function formatAmount(amount: string, decimals: number): string {
  return ethers.formatUnits(amount, decimals);
}

/**
 * Parse amount to wei
 */
export function parseAmount(amount: string, decimals: number): string {
  return ethers.parseUnits(amount, decimals).toString();
}

/**
 * Calculate price from order
 */
export function calculatePrice(order: Order, tokenGetDecimals: number, tokenGiveDecimals: number): number {
  const amountGet = parseFloat(formatAmount(order.amountGet, tokenGetDecimals));
  const amountGive = parseFloat(formatAmount(order.amountGive, tokenGiveDecimals));
  return amountGive / amountGet;
}
