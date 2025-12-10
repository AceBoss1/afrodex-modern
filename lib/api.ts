// lib/api.ts
import { ethers, Contract, Provider, Log } from 'ethers';
import { EXCHANGE_ADDRESS, Order, Trade, calculateOrderPrice, formatAmount } from './exchange';
import { EXCHANGE_ABI } from './abi';
import { Token, ZERO_ADDRESS } from './tokens';
import { isSupabaseConfigured, getOrdersFromDb, getTradesFromDb, DbOrder, DbTrade } from './supabase';

// Cache for fetched data
const orderCache = new Map<string, { orders: { buyOrders: Order[]; sellOrders: Order[] }; timestamp: number }>();
const tradeCache = new Map<string, { trades: Trade[]; timestamp: number }>();
const CACHE_DURATION = 30000; // 30 seconds

// Block range to scan
const ORDER_BLOCK_RANGE = 50000;
const TRADE_BLOCK_RANGE = 100000;

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
 * Fetch orders - tries Supabase first, falls back to blockchain
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

  // Try Supabase first
  if (isSupabaseConfigured()) {
    try {
      console.log('Fetching orders from Supabase...');
      const dbOrders = await getOrdersFromDb(baseToken.address, ZERO_ADDRESS);
      
      if (dbOrders.length > 0) {
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
      }
    } catch (err) {
      console.error('Supabase order fetch failed, falling back to blockchain:', err);
    }
  }

  // Fallback to blockchain
  try {
    const contract = new Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, provider);
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - ORDER_BLOCK_RANGE);
    
    console.log(`Fetching orders from blockchain blocks ${fromBlock} to ${currentBlock}`);
    
    const orderFilter = contract.filters.Order();
    const orderEvents = await contract.queryFilter(orderFilter, fromBlock, 'latest');
    
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
      
      const isBuyOrder = 
        tokenGet.toLowerCase() === baseToken.address.toLowerCase() &&
        tokenGive.toLowerCase() === quoteToken.address.toLowerCase();
        
      const isSellOrder = 
        tokenGet.toLowerCase() === quoteToken.address.toLowerCase() &&
        tokenGive.toLowerCase() === baseToken.address.toLowerCase();
      
      if (!isBuyOrder && !isSellOrder) continue;
      if (parseInt(expires) <= currentBlock) continue;
      if (amountGet === '0' || amountGive === '0') continue;
      
      const order: Order = {
        tokenGet,
        amountGet,
        tokenGive,
        amountGive,
        expires,
        nonce,
        user,
        availableVolume: amountGet,
        side: isBuyOrder ? 'buy' : 'sell',
      };
      
      order.price = calculateOrderPrice(order, baseToken.decimals, quoteToken.decimals, baseToken.address);
      
      if (isBuyOrder) {
        buyOrders.push(order);
      } else {
        sellOrders.push(order);
      }
    }
    
    const sortedBuyOrders = buyOrders.sort((a, b) => (b.price || 0) - (a.price || 0));
    const sortedSellOrders = sellOrders.sort((a, b) => (a.price || 0) - (b.price || 0));
    
    console.log(`Got ${sortedBuyOrders.length} buy, ${sortedSellOrders.length} sell orders from blockchain`);
    
    const result = { buyOrders: sortedBuyOrders, sellOrders: sortedSellOrders };
    orderCache.set(cacheKey, { orders: result, timestamp: Date.now() });
    
    return result;
  } catch (error) {
    console.error('Error fetching orders:', error);
    return { buyOrders: [], sellOrders: [] };
  }
}

/**
 * Fetch trades - tries Supabase first, falls back to blockchain
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

  // Try Supabase first
  if (isSupabaseConfigured()) {
    try {
      console.log('Fetching trades from Supabase...');
      const dbTrades = await getTradesFromDb(baseToken.address, ZERO_ADDRESS, limit);
      
      if (dbTrades.length > 0) {
        const trades = dbTrades.map(dbTradeToTrade);
        console.log(`Got ${trades.length} trades from Supabase`);
        tradeCache.set(cacheKey, { trades, timestamp: Date.now() });
        return trades;
      }
    } catch (err) {
      console.error('Supabase trade fetch failed, falling back to blockchain:', err);
    }
  }

  // Fallback to blockchain
  try {
    const contract = new Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, provider);
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - TRADE_BLOCK_RANGE);
    
    console.log(`Fetching trades from blockchain blocks ${fromBlock} to ${currentBlock}`);
    
    const tradeFilter = contract.filters.Trade();
    const tradeEvents = await contract.queryFilter(tradeFilter, fromBlock, 'latest');
    
    const trades: Trade[] = [];
    
    for (const event of [...tradeEvents].reverse()) {
      if (trades.length >= limit) break;
      
      const log = event as Log & { args?: any };
      if (!log.args) continue;
      
      const tokenGet = log.args[0] as string;
      const amountGet = log.args[1].toString();
      const tokenGive = log.args[2] as string;
      const amountGive = log.args[3].toString();
      const maker = log.args[4] as string;
      const taker = log.args[5] as string;
      
      const isBaseGet = tokenGet.toLowerCase() === baseToken.address.toLowerCase();
      const isQuoteGet = tokenGet.toLowerCase() === quoteToken.address.toLowerCase();
      const isBaseGive = tokenGive.toLowerCase() === baseToken.address.toLowerCase();
      const isQuoteGive = tokenGive.toLowerCase() === quoteToken.address.toLowerCase();
      
      if (!((isBaseGet && isQuoteGive) || (isQuoteGet && isBaseGive))) continue;
      
      try {
        const block = await provider.getBlock(event.blockNumber);
        const isBuy = isBaseGet;
        
        const baseAmount = parseFloat(formatAmount(isBuy ? amountGet : amountGive, baseToken.decimals));
        const quoteAmount = parseFloat(formatAmount(isBuy ? amountGive : amountGet, quoteToken.decimals));
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
    
    console.log(`Got ${trades.length} trades from blockchain`);
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
