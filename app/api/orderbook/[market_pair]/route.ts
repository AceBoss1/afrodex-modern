// app/api/orderbook/[market_pair]/route.ts
// CoinMarketCap/CoinGecko compatible orderbook endpoint
// Returns market depth for a trading pair

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SUPPORTED_TOKENS, ZERO_ADDRESS, Token } from '@/lib/tokens';

export const dynamic = 'force-dynamic';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function findToken(symbol: string): Token | undefined {
  return Object.values(SUPPORTED_TOKENS).find(
    t => t.symbol.toUpperCase() === symbol.toUpperCase()
  );
}

export async function GET(
  request: Request,
  { params }: { params: { market_pair: string } }
) {
  try {
    const { market_pair } = params;
    const url = new URL(request.url);
    const depth = parseInt(url.searchParams.get('depth') || '100');
    const level = parseInt(url.searchParams.get('level') || '2');

    // Parse market pair (e.g., "AfroX_ETH" or "AFROX-ETH")
    const [baseSymbol, quoteSymbol] = market_pair.replace('-', '_').split('_');
    
    if (!baseSymbol || !quoteSymbol) {
      return NextResponse.json(
        { error: 'Invalid market pair format. Use BASE_QUOTE (e.g., AfroX_ETH)' },
        { status: 400 }
      );
    }

    const baseToken = findToken(baseSymbol);
    const quoteToken = findToken(quoteSymbol);

    if (!baseToken) {
      return NextResponse.json(
        { error: `Token ${baseSymbol} not found` },
        { status: 404 }
      );
    }

    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    const quoteAddress = quoteToken?.address || ZERO_ADDRESS;
    const halfDepth = Math.ceil(depth / 2);

    // Get bids (buy orders) - sorted by price descending
    const { data: buyOrders } = await supabase
      .from('orders')
      .select('price, base_amount')
      .eq('base_token', baseToken.address.toLowerCase())
      .eq('quote_token', quoteAddress.toLowerCase())
      .eq('side', 'buy')
      .eq('is_active', true)
      .eq('is_cancelled', false)
      .order('price', { ascending: false })
      .limit(halfDepth);

    // Get asks (sell orders) - sorted by price ascending
    const { data: sellOrders } = await supabase
      .from('orders')
      .select('price, base_amount')
      .eq('base_token', baseToken.address.toLowerCase())
      .eq('quote_token', quoteAddress.toLowerCase())
      .eq('side', 'sell')
      .eq('is_active', true)
      .eq('is_cancelled', false)
      .order('price', { ascending: true })
      .limit(halfDepth);

    // Format order book
    const bids = (buyOrders || []).map(o => [
      o.price?.toString() || '0',
      o.base_amount?.toString() || '0',
    ]);

    const asks = (sellOrders || []).map(o => [
      o.price?.toString() || '0',
      o.base_amount?.toString() || '0',
    ]);

    return NextResponse.json({
      timestamp: Date.now().toString(),
      bids,
      asks,
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Cache-Control': 'public, max-age=10',
      },
    });
  } catch (error: any) {
    console.error('Orderbook API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
