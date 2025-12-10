// app/api/route.ts
// API documentation and overview endpoint

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const EXCHANGE_ADDRESS = '0xe8fff15bb5e14095bfdfa8bb85d83cc900c23c56';
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://dex.afrox.one';

export async function GET() {
  const documentation = {
    name: 'AfroDex API',
    version: '2.0.0',
    description: 'REST API for AfroDex decentralized exchange. Compatible with CoinMarketCap and CoinGecko.',
    exchange: {
      name: 'AfroDex',
      contract: EXCHANGE_ADDRESS,
      network: 'Ethereum Mainnet',
      chainId: 1,
    },
    endpoints: {
      summary: {
        url: `${BASE_URL}/api/summary`,
        method: 'GET',
        description: 'Overview of market data for all tickers and market pairs',
        response: 'Array of market summary objects',
      },
      assets: {
        url: `${BASE_URL}/api/assets`,
        method: 'GET',
        description: 'Detailed summary for each currency available on the exchange',
        response: 'Object with asset symbols as keys',
      },
      ticker: {
        url: `${BASE_URL}/api/ticker`,
        method: 'GET',
        description: '24-hour pricing and volume summary for each market pair',
        response: 'Object with trading pairs as keys',
      },
      orderbook: {
        url: `${BASE_URL}/api/orderbook/{market_pair}`,
        method: 'GET',
        description: 'Market depth for a trading pair',
        parameters: {
          market_pair: 'Trading pair (e.g., AfroX_ETH)',
          depth: 'Optional. Number of orders (default: 100)',
          level: 'Optional. Order book level (default: 2)',
        },
        example: `${BASE_URL}/api/orderbook/AfroX_ETH`,
      },
      trades: {
        url: `${BASE_URL}/api/trades/{market_pair}`,
        method: 'GET',
        description: 'Recently completed trades for a given market pair (24h)',
        parameters: {
          market_pair: 'Trading pair (e.g., AfroX_ETH)',
        },
        example: `${BASE_URL}/api/trades/AfroX_ETH`,
      },
      returnTicker: {
        url: `${BASE_URL}/api/returnTicker`,
        method: 'GET',
        description: 'Legacy EtherDelta-style ticker data',
        response: 'Object with ETH_0xAddress pairs as keys',
      },
    },
    tradingPairs: [
      'AfroX_ETH',
      'AFDLT_ETH',
      'PFARM_ETH',
      'FREE_ETH',
      'PLAAS_ETH',
      'LWBT_ETH',
      'T1C_ETH',
      'BCT_ETH',
    ],
    fees: {
      maker: '0%',
      taker: '0.3%',
      description: 'Maker orders (off-chain) are free. Taker executes on-chain and pays 0.3% fee + gas.',
    },
    rateLimit: {
      requests: 60,
      period: '1 minute',
      description: 'Please limit requests to a reasonable frequency.',
    },
    support: {
      website: 'https://afrodex.afrox.one',
      documentation: 'https://dex.afrox.one/guide',
    },
  };

  return NextResponse.json(documentation, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
