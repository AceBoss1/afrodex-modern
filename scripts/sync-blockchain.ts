// scripts/sync-blockchain.ts
// Run with: npx ts-node scripts/sync-blockchain.ts
// Or add to package.json scripts: "sync": "ts-node scripts/sync-blockchain.ts"

import { ethers, Contract, Provider } from 'ethers';
import { createClient } from '@supabase/supabase-js';

// Configuration
const EXCHANGE_ADDRESS = '0xe8fff15bb5e14095bfdfa8bb85d83cc900c23c56';
const START_BLOCK = 9100009;  // AfroDex deployment block
const END_BLOCK = 11204593;   // End of active trading period
const BATCH_SIZE = 10000;     // Blocks per batch to avoid RPC limits

// Environment variables (set these before running)
const ALCHEMY_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || '';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// ABI for events
const EXCHANGE_ABI = [
  'event Order(address tokenGet, uint256 amountGet, address tokenGive, uint256 amountGive, uint256 expires, uint256 nonce, address user)',
  'event Trade(address tokenGet, uint256 amountGet, address tokenGive, uint256 amountGive, address get, address give)',
  'event Cancel(address tokenGet, uint256 amountGet, address tokenGive, uint256 amountGive, uint256 expires, uint256 nonce, address user, uint8 v, bytes32 r, bytes32 s)',
];

// Token addresses for AfroX pair
const AFROX_ADDRESS = '0x08130635368AA28b217a4dfb68E1bF8dC525621C'.toLowerCase();
const ETH_ADDRESS = '0x0000000000000000000000000000000000000000';
const AFROX_DECIMALS = 18;
const ETH_DECIMALS = 18;

async function main() {
  console.log('🚀 Starting AfroDex Historical Sync');
  console.log(`📦 Block range: ${START_BLOCK} to ${END_BLOCK}`);
  console.log(`📊 Total blocks: ${END_BLOCK - START_BLOCK}`);
  
  // Check configuration
  if (!ALCHEMY_KEY) {
    console.error('❌ NEXT_PUBLIC_ALCHEMY_API_KEY not set');
    process.exit(1);
  }
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Supabase credentials not set');
    process.exit(1);
  }
  
  // Initialize provider and Supabase
  const provider = new ethers.JsonRpcProvider(`https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`);
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const contract = new Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, provider);
  
  console.log('✅ Connected to Ethereum and Supabase');
  
  // Get current sync status
  const { data: syncData } = await supabase
    .from('sync_status')
    .select('last_synced_block')
    .eq('event_type', 'trades')
    .single();
  
  const lastSyncedBlock = syncData?.last_synced_block || START_BLOCK;
  console.log(`📍 Last synced block: ${lastSyncedBlock}`);
  
  let currentBlock = lastSyncedBlock;
  let totalOrders = 0;
  let totalTrades = 0;
  let afroxOrders = 0;
  let afroxTrades = 0;
  
  while (currentBlock < END_BLOCK) {
    const endBlock = Math.min(currentBlock + BATCH_SIZE, END_BLOCK);
    console.log(`\n📥 Fetching blocks ${currentBlock} to ${endBlock}...`);
    
    try {
      // Fetch Order events
      const orderFilter = contract.filters.Order();
      const orderEvents = await contract.queryFilter(orderFilter, currentBlock, endBlock);
      
      // Fetch Trade events
      const tradeFilter = contract.filters.Trade();
      const tradeEvents = await contract.queryFilter(tradeFilter, currentBlock, endBlock);
      
      console.log(`   Found ${orderEvents.length} orders, ${tradeEvents.length} trades`);
      
      // Process orders
      const dbOrders = [];
      for (const event of orderEvents) {
        const args = (event as any).args;
        if (!args) continue;
        
        const tokenGet = args[0].toLowerCase();
        const tokenGive = args[2].toLowerCase();
        
        // Check if it's an AfroX/ETH pair
        const isAfroxBuy = tokenGet === AFROX_ADDRESS && tokenGive === ETH_ADDRESS;
        const isAfroxSell = tokenGet === ETH_ADDRESS && tokenGive === AFROX_ADDRESS;
        
        if (isAfroxBuy || isAfroxSell) {
          afroxOrders++;
          
          const amountGet = parseFloat(ethers.formatUnits(args[1].toString(), isAfroxBuy ? AFROX_DECIMALS : ETH_DECIMALS));
          const amountGive = parseFloat(ethers.formatUnits(args[3].toString(), isAfroxBuy ? ETH_DECIMALS : AFROX_DECIMALS));
          const price = isAfroxBuy ? amountGive / amountGet : amountGet / amountGive;
          
          dbOrders.push({
            token_get: tokenGet,
            amount_get: args[1].toString(),
            token_give: tokenGive,
            amount_give: args[3].toString(),
            expires: args[4].toString(),
            nonce: args[5].toString(),
            user_address: args[6].toLowerCase(),
            block_number: event.blockNumber,
            tx_hash: event.transactionHash,
            side: isAfroxBuy ? 'buy' : 'sell',
            price: price,
            is_active: false, // Historical orders are inactive
            amount_filled: '0',
          });
        }
        
        totalOrders++;
      }
      
      // Process trades
      const dbTrades = [];
      for (const event of tradeEvents) {
        const args = (event as any).args;
        if (!args) continue;
        
        const tokenGet = args[0].toLowerCase();
        const tokenGive = args[2].toLowerCase();
        
        // Check if it's an AfroX/ETH pair
        const isAfroxBuy = tokenGet === AFROX_ADDRESS && tokenGive === ETH_ADDRESS;
        const isAfroxSell = tokenGet === ETH_ADDRESS && tokenGive === AFROX_ADDRESS;
        
        if (isAfroxBuy || isAfroxSell) {
          afroxTrades++;
          
          // Get block timestamp
          let timestamp;
          try {
            const block = await provider.getBlock(event.blockNumber);
            timestamp = block?.timestamp ? new Date(Number(block.timestamp) * 1000).toISOString() : new Date().toISOString();
          } catch {
            timestamp = new Date().toISOString();
          }
          
          const baseAmount = parseFloat(ethers.formatUnits(
            isAfroxBuy ? args[1].toString() : args[3].toString(),
            AFROX_DECIMALS
          ));
          const quoteAmount = parseFloat(ethers.formatUnits(
            isAfroxBuy ? args[3].toString() : args[1].toString(),
            ETH_DECIMALS
          ));
          const price = baseAmount > 0 ? quoteAmount / baseAmount : 0;
          
          dbTrades.push({
            tx_hash: event.transactionHash,
            block_number: event.blockNumber,
            timestamp: timestamp,
            token_get: tokenGet,
            amount_get: args[1].toString(),
            token_give: tokenGive,
            amount_give: args[3].toString(),
            maker: args[4].toLowerCase(),
            taker: args[5].toLowerCase(),
            side: isAfroxBuy ? 'buy' : 'sell',
            price: price,
            base_amount: baseAmount,
            quote_amount: quoteAmount,
            base_token: AFROX_ADDRESS,
            quote_token: ETH_ADDRESS,
          });
        }
        
        totalTrades++;
      }
      
      // Save to Supabase
      if (dbOrders.length > 0) {
        const { error: orderError } = await supabase
          .from('orders')
          .upsert(dbOrders, { onConflict: 'token_get,token_give,nonce,user_address', ignoreDuplicates: true });
        
        if (orderError) {
          console.error('   ❌ Error saving orders:', orderError.message);
        } else {
          console.log(`   ✅ Saved ${dbOrders.length} AfroX orders`);
        }
      }
      
      if (dbTrades.length > 0) {
        const { error: tradeError } = await supabase
          .from('trades')
          .upsert(dbTrades, { onConflict: 'tx_hash,token_get,amount_get,maker', ignoreDuplicates: true });
        
        if (tradeError) {
          console.error('   ❌ Error saving trades:', tradeError.message);
        } else {
          console.log(`   ✅ Saved ${dbTrades.length} AfroX trades`);
        }
      }
      
      // Update sync status
      await supabase
        .from('sync_status')
        .upsert({
          event_type: 'trades',
          last_synced_block: endBlock,
          last_sync_time: new Date().toISOString(),
        }, { onConflict: 'event_type' });
      
      await supabase
        .from('sync_status')
        .upsert({
          event_type: 'orders',
          last_synced_block: endBlock,
          last_sync_time: new Date().toISOString(),
        }, { onConflict: 'event_type' });
      
    } catch (error: any) {
      console.error(`   ❌ Error processing batch: ${error.message}`);
      // Wait and retry
      await new Promise(resolve => setTimeout(resolve, 5000));
      continue;
    }
    
    currentBlock = endBlock;
    
    // Rate limiting - wait between batches
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n✅ Sync Complete!');
  console.log(`📊 Total orders processed: ${totalOrders}`);
  console.log(`📊 Total trades processed: ${totalTrades}`);
  console.log(`🔶 AfroX orders: ${afroxOrders}`);
  console.log(`🔶 AfroX trades: ${afroxTrades}`);
}

main().catch(console.error);
