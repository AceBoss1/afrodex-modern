// lib/api.ts
import { ethers } from 'ethers';
import { EXCHANGE_ADDRESS, Order, Trade, getAvailableVolume, calculatePrice } from './exchange';
import { EXCHANGE_ABI } from './abi';
import { Token } from './tokens';

/**
 * Fetch orders from contract events
 */
export async function fetchOrders(
  provider: ethers.Provider,
  baseToken: Token,
  quoteToken: Token
): Promise<{ buyOrders: Order[]; sellOrders: Order[] }> {
  try {
    const contract = new ethers.Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, provider);
    
    // Get current block number
    const currentBlock = await provider.getBlockNumber();
    
    // Fetch Order events (last 10000 blocks for performance)
    const fromBlock = Math.max(0, currentBlock - 10000);
    
    const orderFilter = contract.filters.Order();
    const orderEvents = await contract.queryFilter(orderFilter, fromBlock, 'latest');
    
    // Process orders
    const orders: Order[] = [];
    
    for (const event of orderEvents) {
      if (!event.args) continue;
      
      const order: Order = {
        tokenGet: event.args.tokenGet,
        amountGet: event.args.amountGet.toString(),
        tokenGive: event.args.tokenGive,
        amountGive: event.args.amountGive.toString(),
        expires: event.args.expires.toString(),
        nonce: event.args.nonce.toString(),
        user: event.args.user,
      };
      
      // Only include orders for this trading pair
      const isBuyOrder = 
        order.tokenGet.toLowerCase() === baseToken.address.toLowerCase() &&
        order.tokenGive.toLowerCase() === quoteToken.address.toLowerCase();
        
      const isSellOrder = 
        order.tokenGet.toLowerCase() === quoteToken.address.toLowerCase() &&
        order.tokenGive.toLowerCase() === baseToken.address.toLowerCase();
      
      if (isBuyOrder || isSellOrder) {
        // Check if order is still valid
        const currentTime = Math.floor(Date.now() / 1000);
        if (parseInt(order.expires) > currentTime) {
          try {
            // Get available volume
            const availableVolume = await getAvailableVolume(provider, order);
            if (BigInt(availableVolume) > 0n) {
              order.availableVolume = availableVolume;
              order.price = calculatePrice(order, baseToken.decimals, quoteToken.decimals);
              orders.push(order);
            }
          } catch (error) {
            // Skip orders that fail validation
            console.warn('Order validation failed:', error);
          }
        }
      }
    }
    
    // Separate buy and sell orders
    const buyOrders = orders.filter(
      o => o.tokenGet.toLowerCase() === baseToken.address.toLowerCase()
    ).sort((a, b) => (b.price || 0) - (a.price || 0)); // Highest bid first
    
    const sellOrders = orders.filter(
      o => o.tokenGet.toLowerCase() === quoteToken.address.toLowerCase()
    ).sort((a, b) => (a.price || 0) - (b.price || 0)); // Lowest ask first
    
    return { buyOrders, sellOrders };
  } catch (error) {
    console.error('Error fetching orders:', error);
    return { buyOrders: [], sellOrders: [] };
  }
}

/**
 * Fetch trade history from contract events
 */
export async function fetchTrades(
  provider: ethers.Provider,
  baseToken: Token,
  quoteToken: Token,
  limit: number = 50
): Promise<Trade[]> {
  try {
    const contract = new ethers.Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, provider);
    
    // Get current block number
    const currentBlock = await provider.getBlockNumber();
    
    // Fetch Trade events (last 10000 blocks)
    const fromBlock = Math.max(0, currentBlock - 10000);
    
    const tradeFilter = contract.filters.Trade();
    const tradeEvents = await contract.queryFilter(tradeFilter, fromBlock, 'latest');
    
    // Process trades
    const trades: Trade[] = [];
    
    for (const event of tradeEvents.reverse()) {
      if (!event.args) continue;
      if (trades.length >= limit) break;
      
      const tokenGet = event.args.tokenGet;
      const tokenGive = event.args.tokenGive;
      
      // Only include trades for this trading pair
      const isRelevant = 
        (tokenGet.toLowerCase() === baseToken.address.toLowerCase() &&
         tokenGive.toLowerCase() === quoteToken.address.toLowerCase()) ||
        (tokenGet.toLowerCase() === quoteToken.address.toLowerCase() &&
         tokenGive.toLowerCase() === baseToken.address.toLowerCase());
      
      if (isRelevant) {
        const block = await provider.getBlock(event.blockNumber);
        
        const amountGet = parseFloat(ethers.formatUnits(event.args.amountGet, baseToken.decimals));
        const amountGive = parseFloat(ethers.formatUnits(event.args.amountGive, quoteToken.decimals));
        
        const isBuy = tokenGet.toLowerCase() === baseToken.address.toLowerCase();
        
        trades.push({
          txHash: event.transactionHash,
          blockNumber: event.blockNumber,
          timestamp: block?.timestamp ? Number(block.timestamp) : 0,
          tokenGet: event.args.tokenGet,
          amountGet: event.args.amountGet.toString(),
          tokenGive: event.args.tokenGive,
          amountGive: event.args.amountGive.toString(),
          get: event.args.get,
          give: event.args.give,
          price: isBuy ? amountGive / amountGet : amountGet / amountGive,
          side: isBuy ? 'buy' : 'sell',
        });
      }
    }
    
    return trades;
  } catch (error) {
    console.error('Error fetching trades:', error);
    return [];
  }
}

/**
 * Subscribe to new trades
 */
export function subscribeToTrades(
  provider: ethers.Provider,
  baseToken: Token,
  quoteToken: Token,
  callback: (trade: Trade) => void
): () => void {
  const contract = new ethers.Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, provider);
  
  const handleTrade = async (
    tokenGet: string,
    amountGet: bigint,
    tokenGive: string,
    amountGive: bigint,
    get: string,
    give: string,
    event: ethers.Log
  ) => {
    // Check if trade is for this pair
    const isRelevant = 
      (tokenGet.toLowerCase() === baseToken.address.toLowerCase() &&
       tokenGive.toLowerCase() === quoteToken.address.toLowerCase()) ||
      (tokenGet.toLowerCase() === quoteToken.address.toLowerCase() &&
       tokenGive.toLowerCase() === baseToken.address.toLowerCase());
    
    if (isRelevant) {
      const block = await provider.getBlock(event.blockNumber);
      const amountGetFormatted = parseFloat(ethers.formatUnits(amountGet, baseToken.decimals));
      const amountGiveFormatted = parseFloat(ethers.formatUnits(amountGive, quoteToken.decimals));
      const isBuy = tokenGet.toLowerCase() === baseToken.address.toLowerCase();
      
      const trade: Trade = {
        txHash: event.transactionHash,
        blockNumber: event.blockNumber,
        timestamp: block?.timestamp ? Number(block.timestamp) : 0,
        tokenGet,
        amountGet: amountGet.toString(),
        tokenGive,
        amountGive: amountGive.toString(),
        get,
        give,
        price: isBuy ? amountGiveFormatted / amountGetFormatted : amountGetFormatted / amountGiveFormatted,
        side: isBuy ? 'buy' : 'sell',
      };
      
      callback(trade);
    }
  };
  
  contract.on('Trade', handleTrade);
  
  return () => {
    contract.off('Trade', handleTrade);
  };
}
