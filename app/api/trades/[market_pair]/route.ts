// app/api/trades/[market_pair]/route.ts
// CoinMarketCap/CoinGecko compatible trades endpoint
// Returns recently completed trades for a given market pair

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
    
    // Get trades from last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: trades } = await supabase
      .from('trades')
      .select('*')
      .eq('base_token', baseToken.address.toLowerCase())
      .eq('quote_token', quoteAddress.toLowerCase())
      .gte('created_at', oneDayAgo)
      .order('created_at', { ascending: false })
      .limit(200);

    // Format trades for CMC/CoinGecko
    const formattedTrades = (trades || []).map((trade, index) => ({
      trade_id: trade.id || index + 1,
      price: trade.price?.toString() || '0',
      base_volume: trade.base_amount?.toString() || '0',
      quote_volume: trade.quote_amount?.toString() || '0',
      timestamp: trade.block_timestamp 
        ? new Date(trade.block_timestamp).getTime().toString()
        : trade.created_at 
          ? new Date(trade.created_at).getTime().toString()
          : Date.now().toString(),
      type: trade.side || 'buy',
    }));

    return NextResponse.json(formattedTrades, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Cache-Control': 'public, max-age=30',
      },
    });
  } catch (error: any) {
    console.error('Trades API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
