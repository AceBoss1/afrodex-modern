// lib/exchange.ts
import { ethers, Contract, Provider, Signer, formatUnits, parseUnits, keccak256, solidityPacked } from 'ethers';
import { EXCHANGE_ABI, ERC20_ABI } from './abi';
import { ZERO_ADDRESS } from './tokens';

// Exchange contract address
export const EXCHANGE_ADDRESS = process.env.NEXT_PUBLIC_EXCHANGE_CONTRACT || '0xe8fff15bb5e14095bfdfa8bb85d83cc900c23c56';

// Types
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
  hash?: string;
  availableVolume?: string;
  amountFilled?: string;
  price?: number;
  side?: 'buy' | 'sell';
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
// Balance Functions
// ============================================

/**
 * Get exchange balance for a token
 */
export async function getExchangeBalance(
  provider: Provider,
  tokenAddress: string,
  userAddress: string
): Promise<string> {
  const contract = new Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, provider);
  const balance = await contract.balanceOf(tokenAddress, userAddress);
  return balance.toString();
}

/**
 * Get wallet balance for a token
 */
export async function getWalletBalance(
  provider: Provider,
  tokenAddress: string,
  userAddress: string
): Promise<string> {
  if (tokenAddress === ZERO_ADDRESS) {
    const balance = await provider.getBalance(userAddress);
    return balance.toString();
  } else {
    const contract = new Contract(tokenAddress, ERC20_ABI, provider);
    const balance = await contract.balanceOf(userAddress);
    return balance.toString();
  }
}

/**
 * Get both wallet and exchange balances
 */
export async function getBalances(
  provider: Provider,
  tokenAddress: string,
  userAddress: string
): Promise<Balance> {
  const [wallet, exchange] = await Promise.all([
    getWalletBalance(provider, tokenAddress, userAddress),
    getExchangeBalance(provider, tokenAddress, userAddress),
  ]);
  return { wallet, exchange };
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
): Promise<{ name: string; symbol: string; decimals: number }> {
  if (tokenAddress === ZERO_ADDRESS) {
    return { name: 'Ethereum', symbol: 'ETH', decimals: 18 };
  }

  try {
    const contract = new Contract(tokenAddress, ERC20_ABI, provider);
    const [name, symbol, decimals] = await Promise.all([
      contract.name().catch(() => 'Unknown Token'),
      contract.symbol().catch(() => 'UNKNOWN'),
      contract.decimals().catch(() => 18),
    ]);
    return { name, symbol, decimals: Number(decimals) };
  } catch (error) {
    console.error('Error fetching token info:', error);
    throw new Error('Invalid token address or not an ERC-20 token');
  }
}

// ============================================
// Approval Functions
// ============================================

/**
 * Check token allowance for exchange
 */
export async function checkAllowance(
  provider: Provider,
  tokenAddress: string,
  userAddress: string
): Promise<string> {
  if (tokenAddress === ZERO_ADDRESS) {
    return ethers.MaxUint256.toString(); // ETH doesn't need approval
  }
  const contract = new Contract(tokenAddress, ERC20_ABI, provider);
  const allowance = await contract.allowance(userAddress, EXCHANGE_ADDRESS);
  return allowance.toString();
}

/**
 * Approve token for exchange
 */
export async function approveToken(
  signer: Signer,
  tokenAddress: string,
  amount: string = ethers.MaxUint256.toString()
): Promise<ethers.ContractTransactionResponse> {
  const contract = new Contract(tokenAddress, ERC20_ABI, signer);
  return await contract.approve(EXCHANGE_ADDRESS, amount);
}

// ============================================
// Deposit/Withdraw Functions
// ============================================

/**
 * Deposit ETH to exchange
 */
export async function depositEth(
  signer: Signer,
  amount: string
): Promise<ethers.ContractTransactionResponse> {
  const contract = new Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, signer);
  return await contract.deposit({ value: amount });
}

/**
 * Withdraw ETH from exchange
 */
export async function withdrawEth(
  signer: Signer,
  amount: string
): Promise<ethers.ContractTransactionResponse> {
  const contract = new Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, signer);
  return await contract.withdraw(amount);
}

/**
 * Deposit token to exchange
 */
export async function depositToken(
  signer: Signer,
  tokenAddress: string,
  amount: string
): Promise<ethers.ContractTransactionResponse> {
  const contract = new Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, signer);
  return await contract.depositToken(tokenAddress, amount);
}

/**
 * Withdraw token from exchange
 */
export async function withdrawToken(
  signer: Signer,
  tokenAddress: string,
  amount: string
): Promise<ethers.ContractTransactionResponse> {
  const contract = new Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, signer);
  return await contract.withdrawToken(tokenAddress, amount);
}

// ============================================
// Order Functions
// ============================================

/**
 * Generate order hash for signing
 */
export function getOrderHash(order: Order): string {
  return keccak256(
    solidityPacked(
      ['address', 'address', 'uint256', 'address', 'uint256', 'uint256', 'uint256'],
      [
        EXCHANGE_ADDRESS,
        order.tokenGet,
        order.amountGet,
        order.tokenGive,
        order.amountGive,
        order.expires,
        order.nonce,
      ]
    )
  );
}

/**
 * Sign an order
 */
export async function signOrder(
  signer: Signer,
  order: Order
): Promise<SignedOrder> {
  const hash = getOrderHash(order);
  
  // Sign the hash with personal_sign (adds Ethereum prefix)
  const signature = await signer.signMessage(ethers.getBytes(hash));
  const sig = ethers.Signature.from(signature);
  
  return {
    ...order,
    hash,
    v: sig.v,
    r: sig.r,
    s: sig.s,
  };
}

/**
 * Place an order on-chain (emits Order event)
 */
export async function placeOrder(
  signer: Signer,
  tokenGet: string,
  amountGet: string,
  tokenGive: string,
  amountGive: string,
  expires: string,
  nonce: string
): Promise<ethers.ContractTransactionResponse> {
  const contract = new Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, signer);
  return await contract.order(
    tokenGet,
    amountGet,
    tokenGive,
    amountGive,
    expires,
    nonce
  );
}

/**
 * Execute a trade against an existing order
 */
export async function executeTrade(
  signer: Signer,
  order: SignedOrder,
  amount: string
): Promise<ethers.ContractTransactionResponse> {
  const contract = new Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, signer);
  return await contract.trade(
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
 * Cancel an order
 */
export async function cancelOrder(
  signer: Signer,
  order: SignedOrder
): Promise<ethers.ContractTransactionResponse> {
  const contract = new Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, signer);
  return await contract.cancelOrder(
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

// ============================================
// Order Book Functions
// ============================================

/**
 * Check available volume for an order
 */
export async function getAvailableVolume(
  provider: Provider,
  order: SignedOrder
): Promise<string> {
  const contract = new Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, provider);
  try {
    const volume = await contract.availableVolume(
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
  } catch (error) {
    console.warn('Error getting available volume:', error);
    return '0';
  }
}

/**
 * Get filled amount for an order
 */
export async function getAmountFilled(
  provider: Provider,
  order: SignedOrder
): Promise<string> {
  const contract = new Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, provider);
  try {
    const filled = await contract.amountFilled(
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
  } catch (error) {
    return '0';
  }
}

/**
 * Test if a trade would succeed
 */
export async function testTrade(
  provider: Provider,
  order: SignedOrder,
  amount: string,
  senderAddress: string
): Promise<boolean> {
  const contract = new Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, provider);
  try {
    return await contract.testTrade(
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
      senderAddress
    );
  } catch (error) {
    return false;
  }
}

// ============================================
// Utility Functions
// ============================================

/**
 * Format amount from wei with specified decimals
 */
export function formatAmount(amount: string, decimals: number): string {
  try {
    return formatUnits(amount, decimals);
  } catch {
    return '0';
  }
}

/**
 * Parse amount to wei with specified decimals
 */
export function parseAmount(amount: string, decimals: number): string {
  try {
    return parseUnits(amount, decimals).toString();
  } catch {
    return '0';
  }
}

/**
 * Calculate price from order amounts
 * For a buy order (user wants token, gives ETH): price = amountGive / amountGet
 * For a sell order (user wants ETH, gives token): price = amountGet / amountGive
 */
export function calculateOrderPrice(
  order: Order,
  baseDecimals: number,
  quoteDecimals: number,
  baseTokenAddress: string
): number {
  const amountGet = parseFloat(formatAmount(order.amountGet, 
    order.tokenGet.toLowerCase() === baseTokenAddress.toLowerCase() ? baseDecimals : quoteDecimals));
  const amountGive = parseFloat(formatAmount(order.amountGive,
    order.tokenGive.toLowerCase() === baseTokenAddress.toLowerCase() ? baseDecimals : quoteDecimals));

  if (amountGet === 0) return 0;

  // If getting base token (buy order), price is what you give (quote) / what you get (base)
  // If getting quote token (sell order), price is what you get (quote) / what you give (base)
  if (order.tokenGet.toLowerCase() === baseTokenAddress.toLowerCase()) {
    return amountGive / amountGet; // Buy order: ETH/Token
  } else {
    return amountGet / amountGive; // Sell order: ETH/Token
  }
}

/**
 * Generate a random nonce for orders
 */
export function generateNonce(): string {
  return Math.floor(Math.random() * 2147483647).toString();
}

/**
 * Get current block number + offset for order expiration
 */
export async function getExpirationBlock(
  provider: Provider,
  blocksUntilExpiry: number = 10000 // ~1.5 days at 15s blocks
): Promise<string> {
  const currentBlock = await provider.getBlockNumber();
  return (currentBlock + blocksUntilExpiry).toString();
}

export { ZERO_ADDRESS };
