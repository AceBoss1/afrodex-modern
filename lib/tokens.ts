// lib/tokens.ts
// Official AfroDex Token Registry

export interface Token {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  logo: string;
  description: string;
  etherscan?: string;
  tracker?: string;
}

export const SUPPORTED_TOKENS: Record<string, Token> = {
  ETH: {
    symbol: 'ETH',
    name: 'Ethereum',
    address: '0x0000000000000000000000000000000000000000',
    decimals: 18,
    logo: '/tokens/eth.png',
    description: 'Ethereum native token',
  },
  AfroX: {
    symbol: 'AfroX',
    name: 'AfroDex',
    address: '0x08130635368AA28b217a4dfb68E1bF8dC525621C',
    decimals: 18,
    logo: '/tokens/afrox.png',
    description:
      'AfroDex serves as a blockchain tech community focused on developing and deploying free or affordable technologies for easier Ethereum and ERC-20 tokens mass adoption.',
    etherscan: 'https://etherscan.io/token/0x08130635368AA28b217a4dfb68E1bF8dC525621C',
    tracker: 'https://coinmarketcap.com/currencies/afrodex/',
  },
  AFDLT: {
    symbol: 'AFDLT',
    name: 'AfroDex Labs Token',
    address: '0xD8a8843b0a5aba6B030E92B3F4d669FaD8A5BE50',
    decimals: 18,
    logo: '/tokens/afdlts.png',
    description:
      'AFDLT powers research, innovation, and decentralized governance across the AfroDex Labs ecosystem.',
    etherscan: 'https://etherscan.io/token/0xD8a8843b0a5aba6B030E92B3F4d669FaD8A5BE50',
    tracker: 'https://coinmarketcap.com/currencies/afrodex-labs-token/',
  },
  PFARM: {
    symbol: 'PFARM',
    name: 'PFARM',
    address: '0x6a8C66Cab4F766E5E30b4e9445582094303cc322',
    decimals: 18,
    logo: '/tokens/pfarm.png',
    description:
      'PFARM is a utility token supporting decentralized agricultural finance and yield optimization.',
    etherscan: 'https://etherscan.io/token/0x6a8C66Cab4F766E5E30b4e9445582094303cc322',
    tracker: 'https://coinmarketcap.com/currencies/farm-defi/',
  },
  FREE: {
    symbol: 'FREE',
    name: 'FREE Coin',
    address: '0x2F141Ce366a2462f02cEA3D12CF93E4DCa49e4Fd',
    decimals: 18,
    logo: '/tokens/free.png',
    description:
      'FREE Coin is one of the largest distributed ERC-20 tokens, designed to fuel global crypto adoption.',
    etherscan: 'https://etherscan.io/token/0x2F141Ce366a2462f02cEA3D12CF93E4DCa49e4Fd',
    tracker: 'https://coinmarketcap.com/currencies/free-coin/',
  },
  PLAAS: {
    symbol: 'PLAAS',
    name: 'PLAAS Farmers Token',
    address: '0x60571E95E12c78CbA5223042692908f0649435a5',
    decimals: 18,
    logo: '/tokens/plaas.png',
    description:
      'PLAAS enables farmers to integrate blockchain for livestock management, logistics, and data analytics.',
    etherscan: 'https://etherscan.io/token/0x60571E95E12c78CbA5223042692908f0649435a5',
    tracker: 'https://coinmarketcap.com/currencies/plaas-farmers-token/',
  },
  LWBT: {
    symbol: 'LWBT',
    name: 'Living Without Borders Token',
    address: '0xA03c34eE9fA0e8db36Dd9bF8D46631Bb25F66302',
    decimals: 18,
    logo: '/tokens/lwb.png',
    description:
      'LWBT powers lifestyle on the Living Without Borders International ecosystem.',
    etherscan: 'https://etherscan.io/token/0xA03c34eE9fA0e8db36Dd9bF8D46631Bb25F66302',
    tracker: 'https://LWBinternational.org/',
  },
  T1C: {
    symbol: 'T1C',
    name: 'Travel1Click',
    address: '0xa7C71d444bf9aF4bfEd2adE75595d7512Eb4DD39',
    decimals: 18,
    logo: '/tokens/t1c.png',
    description:
      'T1C powers research, innovation, and decentralized travel ecosystem.',
    etherscan: 'https://etherscan.io/token/0xa7C71d444bf9aF4bfEd2adE75595d7512Eb4DD39',
    tracker: 'https://coinmarketcap.com/currencies/travel1click/',
  },
  BCT: {
    symbol: 'BCT',
    name: 'Bitcratic Token',
    address: '0x9eC251401eAfB7e98f37A1D911c0AEA02CB63A80',
    decimals: 18,
    logo: '/tokens/bct.png',
    description:
      'BCT empowers decentralized exchange governance and liquidity participation on Bitcratic.',
    etherscan: 'https://etherscan.io/token/0x9eC251401eAfB7e98f37A1D911c0AEA02CB63A80',
    tracker: 'https://coinmarketcap.com/currencies/bitcratic/',
  },
  USDT: {
    symbol: 'USDT',
    name: 'Tether USD',
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    decimals: 6,
    logo: '/tokens/usdt.png',
    description: 'Tether USD stablecoin',
    etherscan: 'https://etherscan.io/token/0xdAC17F958D2ee523a2206206994597C13D831ec7',
    tracker: 'https://coinmarketcap.com/currencies/tether/',
  },
  BUSD: {
    symbol: 'BUSD',
    name: 'Binance USD',
    address: '0x4fabb145d64652a948d72533023f6e7a623c7c53',
    decimals: 6,
    logo: '/tokens/busd.png',
    description: 'Binance USD stablecoin',
    etherscan: 'https://etherscan.io/token/0x4fabb145d64652a948d72533023f6e7a623c7c53',
    tracker: 'https://coinmarketcap.com/currencies/binance-usd/',
  },
  DAI: {
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    decimals: 18,
    logo: '/tokens/dai.png',
    description: 'Dai decentralized stablecoin',
    etherscan: 'https://etherscan.io/token/0x6B175474E89094C44Da98b954EedeAC495271d0F',
    tracker: 'https://coinmarketcap.com/currencies/multi-collateral-dai/',
  },
  WETH: {
    symbol: 'WETH',
    name: 'Wrapped Ether',
    address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    decimals: 18,
    logo: '/tokens/weth.png',
    description: 'Wrapped Ethereum token',
    etherscan: 'https://etherscan.io/token/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    tracker: 'https://coinmarketcap.com/currencies/wrapped-ether/',
  },
};

/**
 * Get token by symbol
 */
export function getToken(symbol: string): Token | null {
  return SUPPORTED_TOKENS[symbol] || null;
}

/**
 * Get all supported tokens as array
 */
export function getAllTokens(): Token[] {
  return Object.values(SUPPORTED_TOKENS);
}

/**
 * Get token by address
 */
export function getTokenByAddress(address: string): Token | null {
  return Object.values(SUPPORTED_TOKENS).find(
    (t) => t.address.toLowerCase() === address.toLowerCase()
  ) || null;
}

/**
 * Check if token is supported
 */
export function isTokenSupported(symbol: string): boolean {
  return symbol in SUPPORTED_TOKENS;
}

export default SUPPORTED_TOKENS;
