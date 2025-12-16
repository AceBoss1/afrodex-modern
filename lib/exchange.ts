// lib/exchange.ts
// Exchange contract interaction functions for AfroDex (EtherDelta/ForkDelta-style)

import { ethers, Contract, Provider, Signer, BrowserProvider } from 'ethers';
import { EXCHANGE_ABI, ERC20_ABI } from './abi';
import { ZERO_ADDRESS } from './tokens';

// Exchange contract address
export const EXCHANGE_ADDRESS = '0xe8fff15bb5e14095bfdfa8bb85d83cc900c23c56';

// Types
export interface Order {
  tokenGet: string;
  amountGet: string;
  tokenGive: string;
  amountGive: string;
  expires: string;
  nonce: string;
  user: string;
  availableVolume?: string;
  amountFilled?: string;
  side?: 'buy' | 'sell';
  price?: number;
  v?: number;
  r?: string;
  s?: string;
  hash?: string;
}

export interface SignedOrder extends Order {
  v: number;
  r: string;
  s: string;
  hash: string;
}

export interface Trade {
  txHash: string;
  blockNumber: number;
  timestamp: number;
  tokenGet: string;
  amountGet: string;
  tokenGive: string;
  amountGive: string;
  maker: string;
  taker: string;
  price: number;
  side: 'buy' | 'sell';
  baseAmount: number;
  quoteAmount: number;
}

export interface Balance {
  wallet: string;
  exchange: string;
}

// ============================================
// Formatting Functions
// ============================================

/**
 * Format amount from wei to human readable with full precision
 */
export function formatAmount(amount: string | bigint, decimals: number): string {
  try {
    const value = typeof amount === 'string' ? BigInt(amount) : amount;
    return ethers.formatUnits(value, decimals);
  } catch {
    return '0';
  }
}

/**
 * Parse amount from human readable to wei
 */
export function parseAmount(amount: string, decimals: number): string {
  try {
    return ethers.parseUnits(amount, decimals).toString();
  } catch {
    return '0';
  }
}

/**
 * Format display amount - shows full precision for small numbers
 */
export function formatDisplayAmount(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num) || num === 0) return '0';
  
  const absNum = Math.abs(num);
  
  if (absNum >= 1000000) {
    return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }
  if (absNum >= 1000) {
    return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }
  if (absNum >= 1) {
    return num.toFixed(4);
  }
  if (absNum >= 0.0001) {
    return num.toFixed(8);
  }
  if (absNum >= 0.00000001) {
    return num.toFixed(12);
  }
  return num.toFixed(15);
}

/**
 * Format display price with appropriate decimals
 */
export function formatDisplayPrice(price: number): string {
  if (price === 0) return '0';
  
  const absPrice = Math.abs(price);
  
  if (absPrice >= 1) return price.toFixed(6);
  if (absPrice >= 0.0001) return price.toFixed(8);
  if (absPrice >= 0.000001) return price.toFixed(10);
  if (absPrice >= 0.000000001) return price.toFixed(12);
  return price.toFixed(15);
}

/**
 * Format order book price
 */
export function formatOrderBookPrice(price: number): string {
  if (price === 0) return '0';
  
  const absPrice = Math.abs(price);
  
  if (absPrice >= 1) return price.toFixed(6);
  if (absPrice >= 0.0001) return price.toFixed(8);
  if (absPrice >= 0.000001) return price.toFixed(10);
  if (absPrice >= 0.000000001) return price.toFixed(12);
  return price.toFixed(15);
}

/**
 * Format order book amount
 */
export function formatOrderBookAmount(amount: number): string {
  if (amount === 0) return '0';
  
  const absAmount = Math.abs(amount);
  
  if (absAmount >= 1000000) {
    return Math.round(amount).toLocaleString('en-US', { maximumFractionDigits: 0 });
  }
  if (absAmount >= 1000) {
    return amount.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }
  if (absAmount >= 1) {
    return amount.toFixed(4);
  }
  if (absAmount >= 0.0001) {
    return amount.toFixed(8);
  }
  return amount.toFixed(12);
}

/**
 * Format full balance without abbreviation
 */
export function formatFullBalance(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num) || num === 0) return '0';
  return num.toFixed(18).replace(/\.?0+$/, '');
}

// ============================================
// Token Info Functions
// ============================================

/**
 * Get token info from contract
 */
export async function getTokenInfo(
  provider: Provider,
  tokenAddress: string
): Promise<{ symbol: string; name: string; decimals: number }> {
  const contract = new Contract(tokenAddress, ERC20_ABI, provider);
  
  const [symbol, name, decimals] = await Promise.all([
    contract.symbol().catch(() => 'UNKNOWN'),
    contract.name().catch(() => 'Unknown Token'),
    contract.decimals().catch(() => 18),
  ]);
  
  return { symbol, name, decimals: Number(decimals) };
}

// ============================================
// Balance Functions
// ============================================

/**
 * Get wallet and exchange balances for a token
 */
export async function getBalances(
  provider: Provider,
  tokenAddress: string,
  userAddress: string
): Promise<Balance> {
  const exchange = new Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, provider);
  
  let walletBalance: bigint;
  let exchangeBalance: bigint;
  
  if (tokenAddress === ZERO_ADDRESS) {
    // ETH balances
    walletBalance = await provider.getBalance(userAddress);
    exchangeBalance = await exchange.balanceOf(ZERO_ADDRESS, userAddress);
  } else {
    // Token balances
    const token = new Contract(tokenAddress, ERC20_ABI, provider);
    walletBalance = await token.balanceOf(userAddress);
    exchangeBalance = await exchange.balanceOf(tokenAddress, userAddress);
  }
  
  return {
    wallet: walletBalance.toString(),
    exchange: exchangeBalance.toString(),
  };
}

/**
 * Check token allowance for exchange
 */
export async function checkAllowance(
  provider: Provider,
  tokenAddress: string,
  userAddress: string
): Promise<string> {
  if (tokenAddress === ZERO_ADDRESS) return ethers.MaxUint256.toString();
  
  const token = new Contract(tokenAddress, ERC20_ABI, provider);
  const allowance = await token.allowance(userAddress, EXCHANGE_ADDRESS);
  return allowance.toString();
}

// ============================================
// Deposit/Withdraw Functions
// ============================================

/**
 * Approve token for exchange
 */
export async function approveToken(
  signer: Signer,
  tokenAddress: string,
  amount: string
): Promise<ethers.ContractTransactionResponse> {
  const token = new Contract(tokenAddress, ERC20_ABI, signer);
  return await token.approve(EXCHANGE_ADDRESS, amount);
}

/**
 * Deposit ETH to exchange
 */
export async function depositEth(
  signer: Signer,
  amount: string
): Promise<ethers.ContractTransactionResponse> {
  const exchange = new Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, signer);
  return await exchange.deposit({ value: amount });
}

/**
 * Withdraw ETH from exchange
 */
export async function withdrawEth(
  signer: Signer,
  amount: string
): Promise<ethers.ContractTransactionResponse> {
  const exchange = new Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, signer);
  return await exchange.withdraw(amount);
}

/**
 * Deposit token to exchange
 */
export async function depositToken(
  signer: Signer,
  tokenAddress: string,
  amount: string
): Promise<ethers.ContractTransactionResponse> {
  const exchange = new Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, signer);
  return await exchange.depositToken(tokenAddress, amount);
}

/**
 * Withdraw token from exchange
 */
export async function withdrawToken(
  signer: Signer,
  tokenAddress: string,
  amount: string
): Promise<ethers.ContractTransactionResponse> {
  const exchange = new Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, signer);
  return await exchange.withdrawToken(tokenAddress, amount);
}

// ============================================
// Order Functions
// ============================================

/**
 * Generate a random nonce for orders
 */
export function generateNonce(): string {
  return Math.floor(Math.random() * 1000000000000).toString();
}

/**
 * Get expiration block (current block + offset)
 */
export async function getExpirationBlock(
  provider: Provider,
  blockOffset: number = 10000
): Promise<string> {
  const currentBlock = await provider.getBlockNumber();
  return (currentBlock + blockOffset).toString();
}

/**
 * Calculate order hash for EtherDelta-style exchange
 */
export function calculateOrderHash(
  tokenGet: string,
  amountGet: string,
  tokenGive: string,
  amountGive: string,
  expires: string,
  nonce: string,
  user: string
): string {
  return ethers.solidityPackedKeccak256(
    ['address', 'address', 'uint256', 'address', 'uint256', 'uint256', 'uint256'],
    [EXCHANGE_ADDRESS, tokenGet, amountGet, tokenGive, amountGive, expires, nonce]
  );
}

/**
 * Create and sign an order (off-chain, gasless)
 */
export async function createSignedOrder(
  signer: Signer,
  tokenGet: string,
  amountGet: string,
  tokenGive: string,
  amountGive: string,
  expires: string,
  nonce: string
): Promise<SignedOrder> {
  const user = await signer.getAddress();
  
  // Calculate order hash
  const hash = calculateOrderHash(
    tokenGet,
    amountGet,
    tokenGive,
    amountGive,
    expires,
    nonce,
    user
  );
  
  // Sign the hash with eth_sign (prefixed message)
  const signature = await signer.signMessage(ethers.getBytes(hash));
  const sig = ethers.Signature.from(signature);
  
  return {
    tokenGet,
    amountGet,
    tokenGive,
    amountGive,
    expires,
    nonce,
    user,
    v: sig.v,
    r: sig.r,
    s: sig.s,
    hash,
  };
}

/**
 * Calculate order price from amounts
 */
export function calculateOrderPrice(
  order: Order,
  baseDecimals: number,
  quoteDecimals: number,
  baseTokenAddress: string
): number {
  const isBaseGet = order.tokenGet.toLowerCase() === baseTokenAddress.toLowerCase();
  
  const baseAmount = parseFloat(
    formatAmount(isBaseGet ? order.amountGet : order.amountGive, baseDecimals)
  );
  const quoteAmount = parseFloat(
    formatAmount(isBaseGet ? order.amountGive : order.amountGet, quoteDecimals)
  );
  
  if (baseAmount === 0) return 0;
  return quoteAmount / baseAmount;
}

// ============================================
// Trade Functions
// ============================================

/**
 * Pre-trade check - verify order can be executed
 */
export async function preTradeCheck(
  provider: Provider,
  order: SignedOrder,
  amount: string,
  takerAddress: string
): Promise<{ canTrade: boolean; reason?: string }> {
  try {
    const exchange = new Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, provider);
    
    // Check if order is valid using testTrade
    const canTrade = await exchange.testTrade(
      order.tokenGet,
      order.amountGet,
      order.tokenGive,
      order.amountGive,
      order.expires,
      order.nonce,
      order.user,
      order.v,
      order.r,
      order.s,
      amount,
      takerAddress
    );
    
    if (!canTrade) {
      // Check available volume
      const available = await exchange.availableVolume(
        order.tokenGet,
        order.amountGet,
        order.tokenGive,
        order.amountGive,
        order.expires,
        order.nonce,
        order.user,
        order.v,
        order.r,
        order.s
      );
      
      if (BigInt(available) === 0n) {
        return { canTrade: false, reason: 'Order already filled or cancelled' };
      }
      
      return { canTrade: false, reason: 'Trade validation failed' };
    }
    
    return { canTrade: true };
  } catch (err: any) {
    console.error('Pre-trade check error:', err);
    return { canTrade: false, reason: err.reason || err.message || 'Unknown error' };
  }
}

/**
 * Execute a trade against an existing order
 */
export async function executeTrade(
  signer: Signer,
  order: SignedOrder,
  amount: string
): Promise<ethers.ContractTransactionResponse> {
  const exchange = new Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, signer);
  
  return await exchange.trade(
    order.tokenGet,
    order.amountGet,
    order.tokenGive,
    order.amountGive,
    order.expires,
    order.nonce,
    order.user,
    order.v,
    order.r,
    order.s,
    amount
  );
}

/**
 * Cancel an order on-chain
 */
export async function cancelOrder(
  signer: Signer,
  order: SignedOrder
): Promise<ethers.ContractTransactionResponse> {
  const exchange = new Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, signer);
  
  return await exchange.cancelOrder(
    order.tokenGet,
    order.amountGet,
    order.tokenGive,
    order.amountGive,
    order.expires,
    order.nonce,
    order.v,
    order.r,
    order.s
  );
}

/**
 * Get available volume for an order
 */
export async function getAvailableVolume(
  provider: Provider,
  order: SignedOrder
): Promise<string> {
  const exchange = new Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, provider);
  
  const volume = await exchange.availableVolume(
    order.tokenGet,
    order.amountGet,
    order.tokenGive,
    order.amountGive,
    order.expires,
    order.nonce,
    order.user,
    order.v,
    order.r,
    order.s
  );
  
  return volume.toString();
}

/**
 * Get amount filled for an order
 */
export async function getAmountFilled(
  provider: Provider,
  order: SignedOrder
): Promise<string> {
  const exchange = new Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, provider);
  
  const filled = await exchange.amountFilled(
    order.tokenGet,
    order.amountGet,
    order.tokenGive,
    order.amountGive,
    order.expires,
    order.nonce,
    order.user,
    order.v,
    order.r,
    order.s
  );
  
  return filled.toString();
}

export default {
  EXCHANGE_ADDRESS,
  formatAmount,
  parseAmount,
  formatDisplayAmount,
  formatDisplayPrice,
  formatOrderBookPrice,
  formatOrderBookAmount,
  formatFullBalance,
  getTokenInfo,
  getBalances,
  checkAllowance,
  approveToken,
  depositEth,
  withdrawEth,
  depositToken,
  withdrawToken,
  generateNonce,
  getExpirationBlock,
  calculateOrderHash,
  createSignedOrder,
  calculateOrderPrice,
  preTradeCheck,
  executeTrade,
  cancelOrder,
  getAvailableVolume,
  getAmountFilled,
};
