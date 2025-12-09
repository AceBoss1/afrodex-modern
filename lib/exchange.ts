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
 * Format amount for display - shows FULL numbers, no abbreviations
 * Large numbers shown with commas for readability
 * Small numbers show appropriate decimals
 */
export function formatDisplayAmount(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(num) || num === 0) return '0';
  
  const absNum = Math.abs(num);
  
  // For very large numbers (>= 1), show as integer with commas (no decimals)
  if (absNum >= 1000000) {
    return Math.round(num).toLocaleString('en-US', { maximumFractionDigits: 0 });
  }
  
  // For numbers >= 1, show up to 4 decimals
  if (absNum >= 1) {
    return num.toLocaleString('en-US', { maximumFractionDigits: 4 });
  }
  
  // For small numbers, show appropriate decimals
  if (absNum >= 0.0001) {
    return num.toFixed(6);
  }
  
  // For very small numbers, show up to 12 decimals
  return num.toFixed(12).replace(/\.?0+$/, '');
}

/**
 * Format price for display - handles very small prices like 0.000000009998
 * Shows ALL significant digits for small prices (up to 18 decimals)
 */
export function formatDisplayPrice(price: number | string): string {
  const num = typeof price === 'string' ? parseFloat(price) : price;
  
  if (isNaN(num) || num === 0) return '0';
  
  const absNum = Math.abs(num);
  
  // For prices >= 1, show reasonable decimals
  if (absNum >= 1) {
    return num.toFixed(4);
  }
  
  // For prices >= 0.0001, show 8 decimals
  if (absNum >= 0.0001) {
    return num.toFixed(8);
  }
  
  // For prices >= 0.000000001 (9 zeros), show 12 decimals
  if (absNum >= 0.000000001) {
    return num.toFixed(12);
  }
  
  // For very small prices, show up to 18 decimals (full ETH precision)
  // Find first significant digit and show all
  const str = num.toFixed(18);
  
  // Remove trailing zeros but keep significant digits
  let trimmed = str.replace(/0+$/, '');
  if (trimmed.endsWith('.')) {
    trimmed = trimmed + '0';
  }
  
  return trimmed;
}

/**
 * Format balance for input display - full precision without abbreviation
 */
export function formatFullBalance(amount: string, decimals: number): string {
  try {
    const formatted = formatUnits(amount, decimals);
    const num = parseFloat(formatted);
    if (num === 0) return '0';
    // Return full precision
    return formatted;
  } catch {
    return '0';
  }
}

/**
 * Format for order book display - needs to fit in column
 * Price: up to 14 decimal places for very small prices
 * Amount: full number with commas, no decimals for large numbers
 */
export function formatOrderBookPrice(price: number): string {
  if (price === 0) return '0';
  
  const absPrice = Math.abs(price);
  
  if (absPrice >= 1) {
    return price.toFixed(6);
  }
  if (absPrice >= 0.000001) {
    return price.toFixed(10);
  }
  // For very small prices like 0.000000009998
  return price.toFixed(14);
}

/**
 * Format order book amount - full numbers, no abbreviations
 * Uses commas for readability on large numbers
 */
export function formatOrderBookAmount(amount: number): string {
  if (amount === 0) return '0';
  
  const absAmount = Math.abs(amount);
  
  // For large numbers, show as integer with commas
  if (absAmount >= 1000) {
    return Math.round(amount).toLocaleString('en-US', { maximumFractionDigits: 0 });
  }
  
  // For numbers >= 1, show up to 2 decimals
  if (absAmount >= 1) {
    return amount.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }
  
  // For small numbers
  return amount.toFixed(6);
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

// ============================================
// Historical Event Fetching
// ============================================

/**
 * Fetch historical Order events from the blockchain
 */
export async function fetchOrderEvents(
  provider: Provider,
  baseTokenAddress: string,
  quoteTokenAddress: string,
  fromBlock: number = 0,
  toBlock: number | 'latest' = 'latest'
): Promise<Order[]> {
  const contract = new Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, provider);
  
  try {
    // Get current block if toBlock is 'latest'
    const currentBlock = await provider.getBlockNumber();
    const endBlock = toBlock === 'latest' ? currentBlock : toBlock;
    
    // Limit range to avoid RPC timeouts (fetch last ~50000 blocks max)
    const startBlock = Math.max(fromBlock, endBlock - 50000);
    
    // Fetch Order events
    const orderFilter = contract.filters.Order();
    const events = await contract.queryFilter(orderFilter, startBlock, endBlock);
    
    const orders: Order[] = [];
    
    for (const event of events) {
      const args = (event as any).args;
      if (!args) continue;
      
      const tokenGet = args.tokenGet?.toLowerCase();
      const tokenGive = args.tokenGive?.toLowerCase();
      const baseAddr = baseTokenAddress.toLowerCase();
      const quoteAddr = quoteTokenAddress.toLowerCase();
      
      // Filter for our trading pair
      const isBuyOrder = tokenGet === baseAddr && tokenGive === quoteAddr;
      const isSellOrder = tokenGet === quoteAddr && tokenGive === baseAddr;
      
      if (!isBuyOrder && !isSellOrder) continue;
      
      const order: Order = {
        tokenGet: args.tokenGet,
        amountGet: args.amountGet.toString(),
        tokenGive: args.tokenGive,
        amountGive: args.amountGive.toString(),
        expires: args.expires.toString(),
        nonce: args.nonce.toString(),
        user: args.user,
        side: isBuyOrder ? 'buy' : 'sell',
      };
      
      // Check if order is still valid (not expired, not fully filled)
      const blockNum = await provider.getBlockNumber();
      if (parseInt(order.expires) > blockNum) {
        // Check available volume
        const filled = await getAmountFilled(provider, order);
        const amountGet = BigInt(order.amountGet);
        const filledAmount = BigInt(filled);
        
        if (filledAmount < amountGet) {
          order.amountFilled = filled;
          order.availableVolume = (amountGet - filledAmount).toString();
          orders.push(order);
        }
      }
    }
    
    return orders;
  } catch (error) {
    console.error('Error fetching order events:', error);
    return [];
  }
}

/**
 * Fetch historical Trade events from the blockchain
 */
export async function fetchTradeEvents(
  provider: Provider,
  baseTokenAddress: string,
  quoteTokenAddress: string,
  baseDecimals: number,
  quoteDecimals: number,
  fromBlock: number = 0,
  toBlock: number | 'latest' = 'latest'
): Promise<Trade[]> {
  const contract = new Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, provider);
  
  try {
    const currentBlock = await provider.getBlockNumber();
    const endBlock = toBlock === 'latest' ? currentBlock : toBlock;
    const startBlock = Math.max(fromBlock, endBlock - 50000);
    
    // Fetch Trade events
    const tradeFilter = contract.filters.Trade();
    const events = await contract.queryFilter(tradeFilter, startBlock, endBlock);
    
    const trades: Trade[] = [];
    
    for (const event of events) {
      const args = (event as any).args;
      if (!args) continue;
      
      const tokenGet = args.tokenGet?.toLowerCase();
      const tokenGive = args.tokenGive?.toLowerCase();
      const baseAddr = baseTokenAddress.toLowerCase();
      const quoteAddr = quoteTokenAddress.toLowerCase();
      
      // Filter for our trading pair
      const isBuyTrade = tokenGet === baseAddr && tokenGive === quoteAddr;
      const isSellTrade = tokenGet === quoteAddr && tokenGive === baseAddr;
      
      if (!isBuyTrade && !isSellTrade) continue;
      
      // Get block timestamp
      const block = await provider.getBlock(event.blockNumber);
      const timestamp = block?.timestamp || Math.floor(Date.now() / 1000);
      
      const amountGet = parseFloat(formatUnits(args.amountGet.toString(), isBuyTrade ? baseDecimals : quoteDecimals));
      const amountGive = parseFloat(formatUnits(args.amountGive.toString(), isBuyTrade ? quoteDecimals : baseDecimals));
      
      const trade: Trade = {
        txHash: event.transactionHash,
        blockNumber: event.blockNumber,
        timestamp: Number(timestamp),
        tokenGet: args.tokenGet,
        amountGet: args.amountGet.toString(),
        tokenGive: args.tokenGive,
        amountGive: args.amountGive.toString(),
        maker: args.get || args.maker || '',
        taker: args.give || args.taker || '',
        side: isBuyTrade ? 'buy' : 'sell',
        price: isBuyTrade ? amountGive / amountGet : amountGet / amountGive,
        baseAmount: isBuyTrade ? amountGet : amountGive,
        quoteAmount: isBuyTrade ? amountGive : amountGet,
      };
      
      trades.push(trade);
    }
    
    // Sort by timestamp descending (most recent first)
    trades.sort((a, b) => b.timestamp - a.timestamp);
    
    return trades;
  } catch (error) {
    console.error('Error fetching trade events:', error);
    return [];
  }
}

/**
 * Get amount already filled for an order
 */
async function getAmountFilled(provider: Provider, order: Order): Promise<string> {
  const contract = new Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, provider);
  
  try {
    // Calculate order hash
    const orderHash = keccak256(
      solidityPacked(
        ['address', 'address', 'uint256', 'address', 'uint256', 'uint256', 'uint256'],
        [
          EXCHANGE_ADDRESS,
          order.tokenGet,
          order.amountGet,
          order.tokenGive,
          order.amountGive,
          order.expires,
          order.nonce
        ]
      )
    );
    
    const filled = await contract.orderFills(order.user, orderHash);
    return filled.toString();
  } catch {
    return '0';
  }
}

export { ZERO_ADDRESS };
