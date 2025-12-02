// lib/web3.ts
'use client';

import { createWeb3Modal } from '@web3modal/wagmi/react';
import { defaultWagmiConfig } from '@web3modal/wagmi/react/config';
import { mainnet, sepolia } from 'wagmi/chains';
import { cookieStorage, createStorage } from 'wagmi';

// Get project ID from environment
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '';

if (!projectId && typeof window !== 'undefined') {
  console.warn('WalletConnect Project ID is not set. Wallet connection may not work properly.');
}

// Metadata for WalletConnect
const metadata = {
  name: 'AfroDex',
  description: "Africa's Premier Decentralized Order Book Exchange",
  url: 'https://dex.afrox.one',
  icons: ['https://dex.afrox.one/afrodex_logo.jpg'],
};

// Supported chains
const chains = [mainnet, sepolia] as const;

// Create wagmi config
export const config = defaultWagmiConfig({
  chains,
  projectId,
  metadata,
  ssr: true,
  storage: createStorage({
    storage: cookieStorage,
  }),
  enableCoinbase: true,
  enableInjected: true,
  enableWalletConnect: true,
  enableEIP6963: true,
});

// Initialize Web3Modal
let modalInitialized = false;

export function initializeWeb3Modal() {
  if (typeof window === 'undefined' || modalInitialized || !projectId) return;
  
  try {
    createWeb3Modal({
      wagmiConfig: config,
      projectId,
      enableAnalytics: false,
      enableOnramp: false,
      themeMode: 'dark',
      themeVariables: {
        '--w3m-accent': '#FF8C00',
        '--w3m-color-mix': '#0a0a0a',
        '--w3m-color-mix-strength': 20,
        '--w3m-border-radius-master': '8px',
      },
    });
    modalInitialized = true;
  } catch (error) {
    console.error('Failed to initialize Web3Modal:', error);
  }
}

export { mainnet, sepolia };
