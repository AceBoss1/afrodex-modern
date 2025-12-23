// lib/wagmi.ts
// Wagmi configuration with Alchemy RPC as primary provider

import { defaultWagmiConfig } from '@web3modal/wagmi/react/config';
import { mainnet } from 'wagmi/chains';
import { http } from 'wagmi';

// Your WalletConnect project ID
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '10edda8e46373f1bd57ba4af4f919fb5';

// Your Alchemy API key
const alchemyApiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || '';

// Alchemy RPC URL (fallback to public if no key)
const alchemyRpcUrl = alchemyApiKey 
  ? `https://eth-mainnet.g.alchemy.com/v2/${alchemyApiKey}`
  : 'https://eth.llamarpc.com'; // Free public fallback

// Metadata for WalletConnect
const metadata = {
  name: 'AfroDex Exchange',
  description: 'Decentralized Token Exchange',
  url: 'https://dex.afrox.one',
  icons: ['https://dex.afrox.one/logo.png'],
};

// Create wagmi config with Alchemy as primary transport
export const config = defaultWagmiConfig({
  chains: [mainnet],
  projectId,
  metadata,
  // Use Alchemy RPC for all read operations (more reliable than WalletConnect relay)
  transports: {
    [mainnet.id]: http(alchemyRpcUrl, {
      timeout: 30_000, // 30 second timeout
      retryCount: 3,
      retryDelay: 1000,
    }),
  },
  // Enable batch calls for efficiency
  batch: {
    multicall: true,
  },
  // SSR support
  ssr: true,
});

// Export for use in other files
export { projectId, alchemyRpcUrl };
