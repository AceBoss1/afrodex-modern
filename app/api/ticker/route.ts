// app/api/ticker/route.ts
// CoinMarketCap/CoinGecko compatible ticker endpoint
// Returns 24-hour pricing and volume summary for each market pair

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SUPPORTED_TOKENS, ZERO_ADDRESS } from '@/lib/tokens';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET() {
  try {
    const supabase = getSupabase();
    const tickerData: Record<string, any> = {};

    const tokens = Object.values(SUPPORTED_TOKENS).filter(t => t.address !== ZERO_ADDRESS);

    for (const token of tokens) {
      const pair = `${token.symbol}_ETH`;
      
      let lastPrice = 0;
      let baseVolume = 0;
      let quoteVolume = 0;
      let isFrozen = '0';

      if (supabase) {
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
          baseVolume = trades.reduce((sum, t) => sum + (t.base_amount || 0), 0);
          quoteVolume = trades.reduce((sum, t) => sum + (t.quote_amount || 0), 0);
        }

        // Check if there are any active orders (market not frozen)
        const { data: orders, count } = await supabase
          .from('orders')
          .select('id', { count: 'exact' })
          .eq('base_token', token.address.toLowerCase())
          .eq('is_active', true)
          .limit(1);

        isFrozen = count && count > 0 ? '0' : '1';
      }

      tickerData[pair] = {
        base_id: token.cmcId || '',
        quote_id: '1027', // ETH CoinMarketCap ID
        last_price: lastPrice.toString(),
        base_volume: baseVolume.toString(),
        quote_volume: quoteVolume.toString(),
        isFrozen,
      };
    }

    return NextResponse.json(tickerData, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Cache-Control': 'public, max-age=60',
      },
    });
  } catch (error: any) {
    console.error('Ticker API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
