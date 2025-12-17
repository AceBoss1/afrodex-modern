// lib/exchange.ts
// Exchange contract interaction functions for AfroDex (EtherDelta/ForkDelta-style)

import { ethers, Contract, Provider, Signer } from 'ethers';
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

export function formatAmount(amount: string | bigint, decimals: number): string {
  try {
    const value = typeof amount === 'string' ? BigInt(amount) : amount;
    return ethers.formatUnits(value, decimals);
  } catch {
    return '0';
  }
}

export function parseAmount(amount: string, decimals: number): string {
  try {
    return ethers.parseUnits(amount, decimals).toString();
  } catch {
    return '0';
  }
}

export function formatDisplayAmount(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num) || num === 0) return '0';
  
  const absNum = Math.abs(num);
  
  if (absNum >= 1000000) return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (absNum >= 1000) return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (absNum >= 1) return num.toFixed(4);
  if (absNum >= 0.0001) return num.toFixed(8);
  if (absNum >= 0.00000001) return num.toFixed(12);
  return num.toFixed(15);
}

export function formatDisplayPrice(price: number): string {
  if (price === 0) return '0';
  const absPrice = Math.abs(price);
  if (absPrice >= 1) return price.toFixed(6);
  if (absPrice >= 0.0001) return price.toFixed(8);
  if (absPrice >= 0.000001) return price.toFixed(10);
  if (absPrice >= 0.000000001) return price.toFixed(12);
  return price.toFixed(15);
}

export function formatOrderBookPrice(price: number): string {
  if (price === 0) return '0';
  const absPrice = Math.abs(price);
  if (absPrice >= 1) return price.toFixed(6);
  if (absPrice >= 0.0001) return price.toFixed(8);
  if (absPrice >= 0.000001) return price.toFixed(10);
  if (absPrice >= 0.000000001) return price.toFixed(12);
  return price.toFixed(15);
}

export function formatOrderBookAmount(amount: number): string {
  if (amount === 0) return '0';
  const absAmount = Math.abs(amount);
  if (absAmount >= 1000000) return Math.round(amount).toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (absAmount >= 1000) return amount.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (absAmount >= 1) return amount.toFixed(4);
  if (absAmount >= 0.0001) return amount.toFixed(8);
  return amount.toFixed(12);
}

export function formatFullBalance(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num) || num === 0) return '0';
  return num.toFixed(18).replace(/\.?0+$/, '');
}

// ============================================
// Token Info Functions
// ============================================

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

export async function getBalances(
  provider: Provider,
  tokenAddress: string,
  userAddress: string
): Promise<Balance> {
  const exchange = new Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, provider);
  
  let walletBalance: bigint;
  let exchangeBalance: bigint;
  
  if (tokenAddress === ZERO_ADDRESS) {
    walletBalance = await provider.getBalance(userAddress);
    exchangeBalance = await exchange.balanceOf(ZERO_ADDRESS, userAddress);
  } else {
    const token = new Contract(tokenAddress, ERC20_ABI, provider);
    walletBalance = await token.balanceOf(userAddress);
    exchangeBalance = await exchange.balanceOf(tokenAddress, userAddress);
  }
  
  return {
    wallet: walletBalance.toString(),
    exchange: exchangeBalance.toString(),
  };
}

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

export async function approveToken(
  signer: Signer,
  tokenAddress: string,
  amount: string
): Promise<ethers.ContractTransactionResponse> {
  const token = new Contract(tokenAddress, ERC20_ABI, signer);
  return await token.approve(EXCHANGE_ADDRESS, amount);
}

export async function depositEth(
  signer: Signer,
  amount: string
): Promise<ethers.ContractTransactionResponse> {
  const exchange = new Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, signer);
  return await exchange.deposit({ value: amount });
}

export async function withdrawEth(
  signer: Signer,
  amount: string
): Promise<ethers.ContractTransactionResponse> {
  const exchange = new Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, signer);
  return await exchange.withdraw(amount);
}

export async function depositToken(
  signer: Signer,
  tokenAddress: string,
  amount: string
): Promise<ethers.ContractTransactionResponse> {
  const exchange = new Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, signer);
  return await exchange.depositToken(tokenAddress, amount);
}

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

export function generateNonce(): string {
  return Math.floor(Math.random() * 1000000000000).toString();
}

export async function getExpirationBlock(
  provider: Provider,
  blockOffset: number = 100000
): Promise<string> {
  const currentBlock = await provider.getBlockNumber();
  return (currentBlock + blockOffset).toString();
}

/**
 * Calculate order hash for EtherDelta-style exchange
 * CRITICAL: EtherDelta uses SHA256, not keccak256!
 */
export function calculateOrderHash(
  tokenGet: string,
  amountGet: string,
  tokenGive: string,
  amountGive: string,
  expires: string,
  nonce: string
): string {
  // EtherDelta hash format: sha256(contractAddress, tokenGet, amountGet, tokenGive, amountGive, expires, nonce)
  const packed = ethers.solidityPacked(
    ['address', 'address', 'uint256', 'address', 'uint256', 'uint256', 'uint256'],
    [EXCHANGE_ADDRESS, tokenGet, amountGet, tokenGive, amountGive, expires, nonce]
  );
  
  // Use SHA256 - this is what EtherDelta contracts use!
  return ethers.sha256(packed);
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
  
  // Calculate order hash using SHA256 (EtherDelta style)
  const hash = calculateOrderHash(
    tokenGet,
    amountGet,
    tokenGive,
    amountGive,
    expires,
    nonce
  );
  
  console.log('=== CREATING SIGNED ORDER ===');
  console.log('Contract:', EXCHANGE_ADDRESS);
  console.log('tokenGet:', tokenGet);
  console.log('amountGet:', amountGet);
  console.log('tokenGive:', tokenGive);
  console.log('amountGive:', amountGive);
  console.log('expires:', expires);
  console.log('nonce:', nonce);
  console.log('Order hash (SHA256):', hash);
  
  // Sign the hash - eth_sign adds the Ethereum message prefix
  const signature = await signer.signMessage(ethers.getBytes(hash));
  const sig = ethers.Signature.from(signature);
  
  console.log('Signature v:', sig.v);
  console.log('Signature r:', sig.r);
  console.log('Signature s:', sig.s);
  console.log('=============================');
  
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

export async function preTradeCheck(
  provider: Provider,
  order: SignedOrder,
  amount: string,
  takerAddress: string
): Promise<{ canTrade: boolean; reason?: string; availableVolume?: string }> {
  try {
    const exchange = new Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, provider);
    
    console.log('=== PRE-TRADE CHECK ===');
    console.log('Order hash:', order.hash);
    console.log('Trade amount:', amount);
    console.log('Taker:', takerAddress);
    
    // First check available volume
    let available: bigint;
    try {
      available = await exchange.availableVolume(
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
      console.log('Available volume:', available.toString());
    } catch (err: any) {
      console.error('availableVolume error:', err);
      return { canTrade: false, reason: 'Failed to check volume: ' + (err.reason || err.message) };
    }
    
    if (available === 0n) {
      return { canTrade: false, reason: 'Order filled/cancelled (0 available)' };
    }
    
    // Check if order is valid using testTrade
    let canTrade: boolean;
    try {
      canTrade = await exchange.testTrade(
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
      console.log('testTrade result:', canTrade);
    } catch (err: any) {
      console.error('testTrade error:', err);
      return { canTrade: false, reason: 'Trade test failed: ' + (err.reason || err.message) };
    }
    
    if (!canTrade) {
      const currentBlock = await provider.getBlockNumber();
      if (BigInt(order.expires) < BigInt(currentBlock)) {
        return { canTrade: false, reason: `Order expired (block ${order.expires} < ${currentBlock})` };
      }
      return { canTrade: false, reason: 'Validation failed - check balances' };
    }
    
    console.log('=== PRE-TRADE CHECK PASSED ===');
    return { canTrade: true, availableVolume: available.toString() };
  } catch (err: any) {
    console.error('Pre-trade check error:', err);
    return { canTrade: false, reason: err.reason || err.message || 'Unknown error' };
  }
}

export async function executeTrade(
  signer: Signer,
  order: SignedOrder,
  amount: string
): Promise<ethers.ContractTransactionResponse> {
  const exchange = new Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, signer);
  
  console.log('=== EXECUTING TRADE ===');
  console.log('Amount:', amount);
  
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
