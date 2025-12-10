// app/api/returnTicker/route.ts
// Legacy EtherDelta/ForkDelta style returnTicker endpoint
// For backwards compatibility

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
      // Use EtherDelta format: ETH_0xTokenAddress
      const pair = `ETH_${token.address.slice(0, 9)}`;
      
      let last = '0';
      let bid = '0';
      let ask = '0';
      let baseVolume = '0';
      let quoteVolume = '0';

      if (supabase) {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        
        // Get last trade price
        const { data: trades } = await supabase
          .from('trades')
          .select('price, base_amount, quote_amount')
          .eq('base_token', token.address.toLowerCase())
          .eq('quote_token', ZERO_ADDRESS.toLowerCase())
          .gte('created_at', oneDayAgo)
          .order('created_at', { ascending: false })
          .limit(100);

        if (trades && trades.length > 0) {
          last = trades[0].price?.toString() || '0';
          const totalBase = trades.reduce((sum, t) => sum + (t.base_amount || 0), 0);
          const totalQuote = trades.reduce((sum, t) => sum + (t.quote_amount || 0), 0);
          baseVolume = totalBase.toString();
          quoteVolume = totalQuote.toString();
        }

        // Get best bid
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
          bid = buyOrders[0].price?.toString() || '0';
        }

        // Get best ask
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
          ask = sellOrders[0].price?.toString() || '0';
        }
      }

      tickerData[pair] = {
        tokenAddr: token.address,
        quoteVolume,
        baseVolume,
        last,
        bid,
        ask,
        updated: new Date().toISOString(),
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
    console.error('ReturnTicker API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
