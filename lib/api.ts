// lib/api.ts
import { ethers, Contract, Provider } from 'ethers';
import { EXCHANGE_ADDRESS, Order, Trade, calculateOrderPrice, formatAmount } from './exchange';
import { EXCHANGE_ABI } from './abi';
import { Token, ZERO_ADDRESS } from './tokens';
import { isSupabaseConfigured, getOrdersFromDb, getTradesFromDb, DbOrder, DbTrade } from './supabase';

// Cache for fetched data
const orderCache = new Map<string, { orders: { buyOrders: Order[]; sellOrders: Order[] }; timestamp: number }>();
const tradeCache = new Map<string, { trades: Trade[]; timestamp: number }>();
const CACHE_DURATION = 30000; // 30 seconds

function getCacheKey(baseToken: Token, quoteToken: Token): string {
  return `${baseToken.address.toLowerCase()}-${quoteToken.address.toLowerCase()}`;
}

/**
 * Convert DB order to Order type
 */
function dbOrderToOrder(dbOrder: DbOrder, baseToken: Token, quoteToken: Token): Order {
  return {
    tokenGet: dbOrder.token_get,
    amountGet: dbOrder.amount_get,
    tokenGive: dbOrder.token_give,
    amountGive: dbOrder.amount_give,
    expires: dbOrder.expires,
    nonce: dbOrder.nonce,
    user: dbOrder.user_address,
    availableVolume: dbOrder.amount_get,
    amountFilled: dbOrder.amount_filled || '0',
    side: dbOrder.side,
    price: dbOrder.price,
    // Include signature fields for trade execution (ensure proper types)
    v: dbOrder.v !== undefined ? Number(dbOrder.v) : undefined,
    r: dbOrder.r || undefined,
    s: dbOrder.s || undefined,
    hash: dbOrder.order_hash || undefined,
  };
}

/**
 * Convert DB trade to Trade type
 */
function dbTradeToTrade(dbTrade: DbTrade): Trade {
  return {
    txHash: dbTrade.tx_hash,
    blockNumber: dbTrade.block_number,
    timestamp: dbTrade.block_timestamp ? new Date(dbTrade.block_timestamp).getTime() / 1000 : Date.now() / 1000,
    tokenGet: dbTrade.token_get,
    amountGet: dbTrade.amount_get,
    tokenGive: dbTrade.token_give,
    amountGive: dbTrade.amount_give,
    maker: dbTrade.maker,
    taker: dbTrade.taker,
    price: dbTrade.price,
    side: dbTrade.side,
    baseAmount: dbTrade.base_amount,
    quoteAmount: dbTrade.quote_amount,
  };
}

/**
 * Fetch orders from Supabase (off-chain orderbook - no blockchain fallback)
 */
export async function fetchOrders(
  provider: Provider,
  baseToken: Token,
  quoteToken: Token,
  useCache: boolean = true
): Promise<{ buyOrders: Order[]; sellOrders: Order[] }> {
  const cacheKey = getCacheKey(baseToken, quoteToken);
  
  if (useCache) {
    const cached = orderCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.orders;
    }
  }

  // Off-chain orderbook - only use Supabase
  if (isSupabaseConfigured()) {
    try {
      console.log('Fetching orders from Supabase...');
      const dbOrders = await getOrdersFromDb(baseToken.address, ZERO_ADDRESS);
      
      const buyOrders: Order[] = [];
      const sellOrders: Order[] = [];
      
      for (const dbOrder of dbOrders) {
        const order = dbOrderToOrder(dbOrder, baseToken, quoteToken);
        if (dbOrder.side === 'buy') {
          buyOrders.push(order);
        } else {
          sellOrders.push(order);
        }
      }
      
      const sortedBuyOrders = buyOrders.sort((a, b) => (b.price || 0) - (a.price || 0));
      const sortedSellOrders = sellOrders.sort((a, b) => (a.price || 0) - (b.price || 0));
      
      console.log(`Got ${sortedBuyOrders.length} buy, ${sortedSellOrders.length} sell orders from Supabase`);
      
      const result = { buyOrders: sortedBuyOrders, sellOrders: sortedSellOrders };
      orderCache.set(cacheKey, { orders: result, timestamp: Date.now() });
      return result;
    } catch (err) {
      console.error('Error fetching orders from Supabase:', err);
    }
  } else {
    console.log('Supabase not configured - no orders available');
  }

  // Return empty if Supabase fails (off-chain orderbook doesn't use blockchain)
  return { buyOrders: [], sellOrders: [] };
}

/**
 * Fetch trades from Supabase (no blockchain fallback - saves RPC calls)
 */
export async function fetchTrades(
  provider: Provider,
  baseToken: Token,
  quoteToken: Token,
  limit: number = 100,
  useCache: boolean = true
): Promise<Trade[]> {
  const cacheKey = getCacheKey(baseToken, quoteToken);
  
  if (useCache) {
    const cached = tradeCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.trades;
    }
  }

  // Use Supabase for trade history (no blockchain fallback to avoid RPC limits)
  if (isSupabaseConfigured()) {
    try {
      console.log('Fetching trades from Supabase...');
      const dbTrades = await getTradesFromDb(baseToken.address, ZERO_ADDRESS, limit);
      
      const trades = dbTrades.map(dbTradeToTrade);
      console.log(`Got ${trades.length} trades from Supabase`);
      tradeCache.set(cacheKey, { trades, timestamp: Date.now() });
      return trades;
    } catch (err) {
      console.error('Error fetching trades from Supabase:', err);
    }
  } else {
    console.log('Supabase not configured - no trade history available');
  }

  // Return empty if Supabase fails (avoids RPC rate limits)
  return [];
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
