// app/api/assets/route.ts
// CoinMarketCap/CoinGecko compatible assets endpoint
// Returns detailed summary for each currency available on the exchange

import { NextResponse } from 'next/server';
import { SUPPORTED_TOKENS, ZERO_ADDRESS } from '@/lib/tokens';

export const dynamic = 'force-dynamic';

// Maker fee: 0% (for off-chain orders)
// Taker fee: 0.3% (on-chain execution)
const MAKER_FEE = '0';
const TAKER_FEE = '0.003';

export async function GET() {
  try {
    const assets: Record<string, any> = {};

    for (const [key, token] of Object.entries(SUPPORTED_TOKENS)) {
      // Skip ETH as quote currency
      if (token.address === ZERO_ADDRESS) {
        assets['ETH'] = {
          name: 'Ethereum',
          unified_cryptoasset_id: '1027', // CoinMarketCap ID for ETH
          can_withdraw: 'true',
          can_deposit: 'true',
          min_withdraw: '0.001',
          max_withdraw: '1000',
          maker_fee: MAKER_FEE,
          taker_fee: TAKER_FEE,
        };
        continue;
      }

      assets[token.symbol] = {
        name: token.name,
        unified_cryptoasset_id: token.cmcId || '', // CoinMarketCap ID if available
        can_withdraw: 'true',
        can_deposit: 'true',
        min_withdraw: '1',
        max_withdraw: '1000000000',
        maker_fee: MAKER_FEE,
        taker_fee: TAKER_FEE,
        contractAddressUrl: `https://etherscan.io/token/${token.address}`,
        contractAddress: token.address,
        decimals: token.decimals,
      };
    }

    return NextResponse.json(assets, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (error: any) {
    console.error('Assets API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
