// app/api/summary/route.ts
// CoinMarketCap/CoinGecko compatible summary endpoint
// Returns overview of market data for all tickers and market pairs

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SUPPORTED_TOKENS, ZERO_ADDRESS } from '@/lib/tokens';

export const dynamic = 'force-dynamic';
export const revalidate = 60; // Revalidate every 60 seconds

const EXCHANGE_ADDRESS = '0xe8fff15bb5e14095bfdfa8bb85d83cc900c23c56';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET() {
  try {
    const supabase = getSupabase();
    const summaryData: any[] = [];

    // Get all supported tokens except ETH (they're all paired with ETH)
    const tokens = Object.values(SUPPORTED_TOKENS).filter(t => t.address !== ZERO_ADDRESS);

    for (const token of tokens) {
      const pair = `${token.symbol}_ETH`;
      
      let lastPrice = 0;
      let lowestAsk = 0;
      let highestBid = 0;
      let baseVolume = 0;
      let quoteVolume = 0;
      let highestPrice24h = 0;
      let lowestPrice24h = 0;
      let priceChange24h = 0;

      if (supabase) {
        // Get trades from last 24 hours
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        
        const { data: trades } = await supabase
          .from('trades')
          .select('*')
          .eq('base_token', token.address.toLowerCase())
          .eq('quote_token', ZERO_ADDRESS.toLowerCase())
          .gte('created_at', oneDayAgo)
          .order('created_at', { ascending: false });

        if (trades && trades.length > 0) {
          lastPrice = trades[0].price || 0;
          
          const prices = trades.map(t => t.price).filter(p => p > 0);
          if (prices.length > 0) {
            highestPrice24h = Math.max(...prices);
            lowestPrice24h = Math.min(...prices);
          }
          
          baseVolume = trades.reduce((sum, t) => sum + (t.base_amount || 0), 0);
          quoteVolume = trades.reduce((sum, t) => sum + (t.quote_amount || 0), 0);

          // Calculate price change
          if (trades.length > 1) {
            const oldPrice = trades[trades.length - 1].price || lastPrice;
            if (oldPrice > 0) {
              priceChange24h = ((lastPrice - oldPrice) / oldPrice) * 100;
            }
          }
        }

        // Get best ask (lowest sell price)
        const { data: sellOrders } = await supabase
          .from('orders')
          .select('price')
          .eq('base_token', token.address.toLowerCase())
          .eq('quote_token', ZERO_ADDRESS.toLowerCase())
          .eq('side', 'sell')
          .eq('is_active', true)
          .eq('is_cancelled', false)
          .order('price', { ascending: true })
          .limit(1);

        if (sellOrders && sellOrders.length > 0) {
          lowestAsk = sellOrders[0].price;
        }

        // Get best bid (highest buy price)
        const { data: buyOrders } = await supabase
          .from('orders')
          .select('price')
          .eq('base_token', token.address.toLowerCase())
          .eq('quote_token', ZERO_ADDRESS.toLowerCase())
          .eq('side', 'buy')
          .eq('is_active', true)
          .eq('is_cancelled', false)
          .order('price', { ascending: false })
          .limit(1);

        if (buyOrders && buyOrders.length > 0) {
          highestBid = buyOrders[0].price;
        }
      }

      summaryData.push({
        trading_pairs: pair,
        base_currency: token.symbol,
        quote_currency: 'ETH',
        last_price: lastPrice,
        lowest_ask: lowestAsk,
        highest_bid: highestBid,
        base_volume: baseVolume,
        quote_volume: quoteVolume,
        price_change_percent_24h: priceChange24h,
        highest_price_24h: highestPrice24h,
        lowest_price_24h: lowestPrice24h,
      });
    }

    return NextResponse.json(summaryData, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Cache-Control': 'public, max-age=60',
      },
    });
  } catch (error: any) {
    console.error('Summary API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
