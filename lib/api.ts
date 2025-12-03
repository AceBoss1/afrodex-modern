// lib/api.ts
import { ethers, Contract, Provider, Log } from 'ethers';
import { EXCHANGE_ADDRESS, Order, Trade, calculateOrderPrice, formatAmount } from './exchange';
import { EXCHANGE_ABI } from './abi';
import { Token, ZERO_ADDRESS } from './tokens';

// Cache for fetched data
const orderCache = new Map<string, { orders: { buyOrders: Order[]; sellOrders: Order[] }; timestamp: number }>();
const tradeCache = new Map<string, { trades: Trade[]; timestamp: number }>();
const CACHE_DURATION = 30000; // 30 seconds

// Block range to scan (increase for more history)
const ORDER_BLOCK_RANGE = 50000; // ~1 week of blocks
const TRADE_BLOCK_RANGE = 100000; // ~2 weeks of blocks

/**
 * Get cache key for a trading pair
 */
function getCacheKey(baseToken: Token, quoteToken: Token): string {
  return `${baseToken.address.toLowerCase()}-${quoteToken.address.toLowerCase()}`;
}

/**
 * Fetch orders from contract events
 * Note: EtherDelta orders require off-chain signature. This fetches on-chain order events
 * for reference but real order books typically use an off-chain order relay.
 */
export async function fetchOrders(
  provider: Provider,
  baseToken: Token,
  quoteToken: Token,
  useCache: boolean = true
): Promise<{ buyOrders: Order[]; sellOrders: Order[] }> {
  const cacheKey = getCacheKey(baseToken, quoteToken);
  
  // Check cache
  if (useCache) {
    const cached = orderCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.orders;
    }
  }

  try {
    const contract = new Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, provider);
    const currentBlock = await provider.getBlockNumber();
    
    // Fetch Order events (increased range for more history)
    const fromBlock = Math.max(0, currentBlock - ORDER_BLOCK_RANGE);
    
    console.log(`Fetching orders from block ${fromBlock} to ${currentBlock}`);
    
    const orderFilter = contract.filters.Order();
    const orderEvents = await contract.queryFilter(orderFilter, fromBlock, 'latest');
    
    console.log(`Found ${orderEvents.length} order events`);
    
    const buyOrders: Order[] = [];
    const sellOrders: Order[] = [];
    
    for (const event of orderEvents) {
      const log = event as Log & { args?: any };
      if (!log.args) continue;
      
      const tokenGet = log.args[0] as string;
      const amountGet = log.args[1].toString();
      const tokenGive = log.args[2] as string;
      const amountGive = log.args[3].toString();
      const expires = log.args[4].toString();
      const nonce = log.args[5].toString();
      const user = log.args[6] as string;
      
      // Check if this order is for our trading pair
      const isBuyOrder = 
        tokenGet.toLowerCase() === baseToken.address.toLowerCase() &&
        tokenGive.toLowerCase() === quoteToken.address.toLowerCase();
        
      const isSellOrder = 
        tokenGet.toLowerCase() === quoteToken.address.toLowerCase() &&
        tokenGive.toLowerCase() === baseToken.address.toLowerCase();
      
      if (!isBuyOrder && !isSellOrder) continue;
      
      // Check if order has expired (using block number)
      if (parseInt(expires) <= currentBlock) continue;
      
      // Skip orders with zero amounts (invalid)
      if (amountGet === '0' || amountGive === '0') continue;
      
      const order: Order = {
        tokenGet,
        amountGet,
        tokenGive,
        amountGive,
        expires,
        nonce,
        user,
        availableVolume: amountGet, // Simplified - would need signature to get actual available
        side: isBuyOrder ? 'buy' : 'sell',
      };
      
      // Calculate price
      order.price = calculateOrderPrice(
        order,
        baseToken.decimals,
        quoteToken.decimals,
        baseToken.address
      );
      
      if (isBuyOrder) {
        buyOrders.push(order);
      } else {
        sellOrders.push(order);
      }
    }
    
    // Sort orders
    const sortedBuyOrders = buyOrders.sort((a, b) => (b.price || 0) - (a.price || 0));
    const sortedSellOrders = sellOrders.sort((a, b) => (a.price || 0) - (b.price || 0));
    
    console.log(`Processed ${sortedBuyOrders.length} buy orders, ${sortedSellOrders.length} sell orders`);
    
    const result = { buyOrders: sortedBuyOrders, sellOrders: sortedSellOrders };
    
    // Update cache
    orderCache.set(cacheKey, { orders: result, timestamp: Date.now() });
    
    return result;
  } catch (error) {
    console.error('Error fetching orders:', error);
    return { buyOrders: [], sellOrders: [] };
  }
}

/**
 * Fetch trade history from contract events
 */
export async function fetchTrades(
  provider: Provider,
  baseToken: Token,
  quoteToken: Token,
  limit: number = 100,
  useCache: boolean = true
): Promise<Trade[]> {
  const cacheKey = getCacheKey(baseToken, quoteToken);
  
  // Check cache
  if (useCache) {
    const cached = tradeCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.trades;
    }
  }

  try {
    const contract = new Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, provider);
    const currentBlock = await provider.getBlockNumber();
    
    // Fetch Trade events (increased range for more history)
    const fromBlock = Math.max(0, currentBlock - TRADE_BLOCK_RANGE);
    
    console.log(`Fetching trades from block ${fromBlock} to ${currentBlock}`);
    
    const tradeFilter = contract.filters.Trade();
    const tradeEvents = await contract.queryFilter(tradeFilter, fromBlock, 'latest');
    
    console.log(`Found ${tradeEvents.length} trade events`);
    
    const trades: Trade[] = [];
    
    // Process in reverse order (newest first)
    for (const event of [...tradeEvents].reverse()) {
      if (trades.length >= limit) break;
      
      const log = event as Log & { args?: any };
      if (!log.args) continue;
      
      const tokenGet = log.args[0] as string;
      const amountGet = log.args[1].toString();
      const tokenGive = log.args[2] as string;
      const amountGive = log.args[3].toString();
      const maker = log.args[4] as string; // 'get' address
      const taker = log.args[5] as string; // 'give' address
      
      // Check if trade is for our pair
      const isBaseGet = tokenGet.toLowerCase() === baseToken.address.toLowerCase();
      const isQuoteGet = tokenGet.toLowerCase() === quoteToken.address.toLowerCase();
      const isBaseGive = tokenGive.toLowerCase() === baseToken.address.toLowerCase();
      const isQuoteGive = tokenGive.toLowerCase() === quoteToken.address.toLowerCase();
      
      if (!((isBaseGet && isQuoteGive) || (isQuoteGet && isBaseGive))) continue;
      
      try {
        const block = await provider.getBlock(event.blockNumber);
        
        // Determine trade direction and calculate amounts
        const isBuy = isBaseGet; // Buyer gets base token
        
        const baseAmount = parseFloat(formatAmount(
          isBuy ? amountGet : amountGive,
          baseToken.decimals
        ));
        const quoteAmount = parseFloat(formatAmount(
          isBuy ? amountGive : amountGet,
          quoteToken.decimals
        ));
        
        const price = baseAmount > 0 ? quoteAmount / baseAmount : 0;
        
        trades.push({
          txHash: event.transactionHash,
          blockNumber: event.blockNumber,
          timestamp: block?.timestamp ? Number(block.timestamp) : Math.floor(Date.now() / 1000),
          tokenGet,
          amountGet,
          tokenGive,
          amountGive,
          maker,
          taker,
          price,
          side: isBuy ? 'buy' : 'sell',
          baseAmount,
          quoteAmount,
        });
      } catch (blockError) {
        console.warn('Error fetching block:', blockError);
      }
    }
    
    console.log(`Processed ${trades.length} trades for this pair`);
    
    // Update cache
    tradeCache.set(cacheKey, { trades, timestamp: Date.now() });
    
    return trades;
  } catch (error) {
    console.error('Error fetching trades:', error);
    return [];
  }
}

/**
 * Subscribe to new trades (real-time updates)
 */
export function subscribeToTrades(
  provider: Provider,
  baseToken: Token,
  quoteToken: Token,
  onTrade: (trade: Trade) => void
): () => void {
  const contract = new Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, provider);
  
  const handleTrade = async (
    tokenGet: string,
    amountGet: bigint,
    tokenGive: string,
    amountGive: bigint,
    maker: string,
    taker: string,
    event: any
  ) => {
    // Check if trade is for our pair
    const isBaseGet = tokenGet.toLowerCase() === baseToken.address.toLowerCase();
    const isQuoteGet = tokenGet.toLowerCase() === quoteToken.address.toLowerCase();
    const isBaseGive = tokenGive.toLowerCase() === baseToken.address.toLowerCase();
    const isQuoteGive = tokenGive.toLowerCase() === quoteToken.address.toLowerCase();
    
    if (!((isBaseGet && isQuoteGive) || (isQuoteGet && isBaseGive))) return;
    
    try {
      const block = await provider.getBlock(event.log.blockNumber);
      const isBuy = isBaseGet;
      
      const baseAmount = parseFloat(formatAmount(
        (isBuy ? amountGet : amountGive).toString(),
        baseToken.decimals
      ));
      const quoteAmount = parseFloat(formatAmount(
        (isBuy ? amountGive : amountGet).toString(),
        quoteToken.decimals
      ));
      
      const price = baseAmount > 0 ? quoteAmount / baseAmount : 0;
      
      onTrade({
        txHash: event.log.transactionHash,
        blockNumber: event.log.blockNumber,
        timestamp: block?.timestamp ? Number(block.timestamp) : Math.floor(Date.now() / 1000),
        tokenGet,
        amountGet: amountGet.toString(),
        tokenGive,
        amountGive: amountGive.toString(),
        maker,
        taker,
        price,
        side: isBuy ? 'buy' : 'sell',
        baseAmount,
        quoteAmount,
      });
    } catch (error) {
      console.error('Error processing trade event:', error);
    }
  };
  
  contract.on('Trade', handleTrade);
  
  return () => {
    contract.off('Trade', handleTrade);
  };
}

/**
 * Subscribe to new orders
 */
export function subscribeToOrders(
  provider: Provider,
  baseToken: Token,
  quoteToken: Token,
  onOrder: (order: Order, side: 'buy' | 'sell') => void
): () => void {
  const contract = new Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, provider);
  
  const handleOrder = (
    tokenGet: string,
    amountGet: bigint,
    tokenGive: string,
    amountGive: bigint,
    expires: bigint,
    nonce: bigint,
    user: string
  ) => {
    // Check if order is for our pair
    const isBuyOrder = 
      tokenGet.toLowerCase() === baseToken.address.toLowerCase() &&
      tokenGive.toLowerCase() === quoteToken.address.toLowerCase();
      
    const isSellOrder = 
      tokenGet.toLowerCase() === quoteToken.address.toLowerCase() &&
      tokenGive.toLowerCase() === baseToken.address.toLowerCase();
    
    if (!isBuyOrder && !isSellOrder) return;
    
    const order: Order = {
      tokenGet,
      amountGet: amountGet.toString(),
      tokenGive,
      amountGive: amountGive.toString(),
      expires: expires.toString(),
      nonce: nonce.toString(),
      user,
      availableVolume: amountGet.toString(),
      side: isBuyOrder ? 'buy' : 'sell',
    };
    
    order.price = calculateOrderPrice(
      order,
      baseToken.decimals,
      quoteToken.decimals,
      baseToken.address
    );
    
    onOrder(order, isBuyOrder ? 'buy' : 'sell');
  };
  
  contract.on('Order', handleOrder);
  
  return () => {
    contract.off('Order', handleOrder);
  };
}

/**
 * Clear all caches
 */
export function clearCaches(): void {
  orderCache.clear();
  tradeCache.clear();
}
