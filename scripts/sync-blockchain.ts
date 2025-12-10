// scripts/sync-blockchain.ts
// Syncs historical Order and Trade events from AfroDex contract to Supabase
// Run: npx ts-node scripts/sync-blockchain.ts

import { ethers } from 'ethers';
import { createClient } from '@supabase/supabase-js';

// ============================================
// CONFIGURATION
// ============================================
const EXCHANGE_ADDRESS = '0xe8fff15bb5e14095bfdfa8bb85d83cc900c23c56';
const START_BLOCK = 9100009;   // AfroDex deployment
const END_BLOCK = 11204593;    // End of active period
const BATCH_SIZE = 2000;       // Blocks per query
const ETH_ADDRESS = '0x0000000000000000000000000000000000000000';

// Token decimals mapping
const TOKEN_DECIMALS: Record<string, number> = {
  '0x0000000000000000000000000000000000000000': 18, // ETH
  '0x08130635368aa28b217a4dfb68e1bf8dc525621c': 4,  // AfroX
  '0xd8a8843b0a5aba6b030e92b3f4d669fad8a5be50': 4,  // AFDLT
  '0x6a8c66cab4f766e5e30b4e9445582094303cc322': 18, // PFARM
  '0x2f141ce366a2462f02cea3d12cf93e4dca49e4fd': 18, // FREE
  '0x60571e95e12c78cba5223042692908f0649435a5': 18, // PLAAS
  '0xa03c34ee9fa0e8db36dd9bf8d46631bb25f66302': 8,  // LWBT
  '0xa7c71d444bf9af4bfed2ade75595d7512eb4dd39': 16, // T1C
  '0x9ec251401eafb7e98f37a1d911c0aea02cb63a80': 18, // BCT
};

const EXCHANGE_ABI = [
  'event Order(address tokenGet, uint256 amountGet, address tokenGive, uint256 amountGive, uint256 expires, uint256 nonce, address user)',
  'event Trade(address tokenGet, uint256 amountGet, address tokenGive, uint256 amountGive, address get, address give)',
  'event Cancel(address tokenGet, uint256 amountGet, address tokenGive, uint256 amountGive, uint256 expires, uint256 nonce, address user, uint8 v, bytes32 r, bytes32 s)',
];

function getDecimals(address: string): number {
  return TOKEN_DECIMALS[address.toLowerCase()] || 18;
}

async function main() {
  console.log('🚀 AfroDex Historical Sync');
  console.log(`📦 Blocks: ${START_BLOCK} → ${END_BLOCK} (${END_BLOCK - START_BLOCK} blocks)`);

  // Check env vars
  const ALCHEMY_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!ALCHEMY_KEY) {
    console.error('❌ Set NEXT_PUBLIC_ALCHEMY_API_KEY');
    process.exit(1);
  }
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(`https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`);
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const contract = new ethers.Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, provider);

  // Test connections
  try {
    await provider.getBlockNumber();
    console.log('✅ Connected to Ethereum');
  } catch (e) {
    console.error('❌ Cannot connect to Ethereum');
    process.exit(1);
  }

  try {
    await supabase.from('sync_status').select('event_type').limit(1);
    console.log('✅ Connected to Supabase');
  } catch (e) {
    console.error('❌ Cannot connect to Supabase');
    process.exit(1);
  }

  // Get last synced block
  const { data: syncData } = await supabase
    .from('sync_status')
    .select('last_synced_block')
    .eq('event_type', 'orders')
    .single();

  let currentBlock = syncData?.last_synced_block || START_BLOCK;
  console.log(`📍 Starting from block ${currentBlock}`);

  let totalOrders = 0;
  let totalTrades = 0;

  while (currentBlock < END_BLOCK) {
    const toBlock = Math.min(currentBlock + BATCH_SIZE, END_BLOCK);
    console.log(`\n📥 Blocks ${currentBlock} → ${toBlock}`);

    try {
      // Fetch Order events
      const orderEvents = await contract.queryFilter(
        contract.filters.Order(),
        currentBlock,
        toBlock
      );

      // Fetch Trade events
      const tradeEvents = await contract.queryFilter(
        contract.filters.Trade(),
        currentBlock,
        toBlock
      );

      console.log(`   Found ${orderEvents.length} orders, ${tradeEvents.length} trades`);

      // Process orders
      if (orderEvents.length > 0) {
        const dbOrders = [];
        
        for (const event of orderEvents) {
          const args = (event as any).args;
          if (!args) continue;

          const tokenGet = args[0].toLowerCase();
          const tokenGive = args[2].toLowerCase();
          const amountGet = args[1].toString();
          const amountGive = args[3].toString();

          // Determine base/quote and side
          let baseToken: string, quoteToken: string, side: 'buy' | 'sell';
          let baseAmount: number, quoteAmount: number;

          if (tokenGive === ETH_ADDRESS) {
            // Buying token with ETH
            baseToken = tokenGet;
            quoteToken = ETH_ADDRESS;
            side = 'buy';
            baseAmount = parseFloat(ethers.formatUnits(amountGet, getDecimals(tokenGet)));
            quoteAmount = parseFloat(ethers.formatUnits(amountGive, 18));
          } else if (tokenGet === ETH_ADDRESS) {
            // Selling token for ETH
            baseToken = tokenGive;
            quoteToken = ETH_ADDRESS;
            side = 'sell';
            baseAmount = parseFloat(ethers.formatUnits(amountGive, getDecimals(tokenGive)));
            quoteAmount = parseFloat(ethers.formatUnits(amountGet, 18));
          } else {
            continue; // Skip non-ETH pairs for now
          }

          const price = baseAmount > 0 ? quoteAmount / baseAmount : 0;

          dbOrders.push({
            tx_hash: event.transactionHash,
            log_index: event.index || 0,
            token_get: tokenGet,
            amount_get: amountGet,
            token_give: tokenGive,
            amount_give: amountGive,
            expires: args[4].toString(),
            nonce: args[5].toString(),
            user_address: args[6].toLowerCase(),
            block_number: event.blockNumber,
            base_token: baseToken,
            quote_token: quoteToken,
            side,
            price,
            base_amount: baseAmount,
            quote_amount: quoteAmount,
            is_active: false, // Historical orders
            amount_filled: '0',
            is_cancelled: false,
          });
        }

        if (dbOrders.length > 0) {
          const { error } = await supabase
            .from('orders')
            .upsert(dbOrders, { onConflict: 'tx_hash,log_index' });

          if (error) {
            console.error('   ❌ Order save error:', error.message);
          } else {
            console.log(`   ✅ Saved ${dbOrders.length} orders`);
            totalOrders += dbOrders.length;
          }
        }
      }

      // Process trades
      if (tradeEvents.length > 0) {
        const dbTrades = [];

        for (const event of tradeEvents) {
          const args = (event as any).args;
          if (!args) continue;

          const tokenGet = args[0].toLowerCase();
          const tokenGive = args[2].toLowerCase();
          const amountGet = args[1].toString();
          const amountGive = args[3].toString();

          let baseToken: string, quoteToken: string, side: 'buy' | 'sell';
          let baseAmount: number, quoteAmount: number;

          if (tokenGive === ETH_ADDRESS) {
            baseToken = tokenGet;
            quoteToken = ETH_ADDRESS;
            side = 'buy';
            baseAmount = parseFloat(ethers.formatUnits(amountGet, getDecimals(tokenGet)));
            quoteAmount = parseFloat(ethers.formatUnits(amountGive, 18));
          } else if (tokenGet === ETH_ADDRESS) {
            baseToken = tokenGive;
            quoteToken = ETH_ADDRESS;
            side = 'sell';
            baseAmount = parseFloat(ethers.formatUnits(amountGive, getDecimals(tokenGive)));
            quoteAmount = parseFloat(ethers.formatUnits(amountGet, 18));
          } else {
            continue;
          }

          const price = baseAmount > 0 ? quoteAmount / baseAmount : 0;

          // Get block timestamp
          let timestamp: string | null = null;
          try {
            const block = await provider.getBlock(event.blockNumber);
            if (block?.timestamp) {
              timestamp = new Date(Number(block.timestamp) * 1000).toISOString();
            }
          } catch (e) {
            // Skip timestamp if we can't get it
          }

          dbTrades.push({
            tx_hash: event.transactionHash,
            log_index: event.index || 0,
            token_get: tokenGet,
            amount_get: amountGet,
            token_give: tokenGive,
            amount_give: amountGive,
            maker: args[4].toLowerCase(),
            taker: args[5].toLowerCase(),
            block_number: event.blockNumber,
            block_timestamp: timestamp,
            base_token: baseToken,
            quote_token: quoteToken,
            side,
            price,
            base_amount: baseAmount,
            quote_amount: quoteAmount,
          });
        }

        if (dbTrades.length > 0) {
          const { error } = await supabase
            .from('trades')
            .upsert(dbTrades, { onConflict: 'tx_hash,log_index' });

          if (error) {
            console.error('   ❌ Trade save error:', error.message);
          } else {
            console.log(`   ✅ Saved ${dbTrades.length} trades`);
            totalTrades += dbTrades.length;
          }
        }
      }

      // Update sync status
      await supabase
        .from('sync_status')
        .upsert({
          event_type: 'orders',
          last_synced_block: toBlock,
          last_sync_time: new Date().toISOString(),
          total_events: totalOrders,
          status: 'syncing'
        }, { onConflict: 'event_type' });

      await supabase
        .from('sync_status')
        .upsert({
          event_type: 'trades',
          last_synced_block: toBlock,
          last_sync_time: new Date().toISOString(),
          total_events: totalTrades,
          status: 'syncing'
        }, { onConflict: 'event_type' });

    } catch (error: any) {
      console.error(`   ❌ Error: ${error.message}`);
      // Wait and retry
      await new Promise(r => setTimeout(r, 5000));
      continue;
    }

    currentBlock = toBlock;
    
    // Rate limit
    await new Promise(r => setTimeout(r, 500));
  }

  // Mark sync complete
  await supabase.from('sync_status').upsert([
    { event_type: 'orders', last_synced_block: END_BLOCK, status: 'complete', total_events: totalOrders },
    { event_type: 'trades', last_synced_block: END_BLOCK, status: 'complete', total_events: totalTrades }
  ], { onConflict: 'event_type' });

  console.log('\n✅ Sync Complete!');
  console.log(`📊 Total Orders: ${totalOrders}`);
  console.log(`📊 Total Trades: ${totalTrades}`);
}

main().catch(console.error);
