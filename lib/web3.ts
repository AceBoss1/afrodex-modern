// lib/web3.ts
import { createWeb3Modal, defaultWagmiConfig } from '@web3modal/wagmi/react';
import { mainnet, sepolia } from 'viem/chains';

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '';

const metadata = {
  name: 'AfroDex',
  description: "Africa's Biggest Decentralized Exchange",
  url: 'https://dex.afrox.one',
  icons: ['/afrodex_logo.jpg']
};

const chains = [mainnet, sepolia] as const;

export const config = defaultWagmiConfig({
  chains,
  projectId,
  metadata,
});

// Create modal instance
if (typeof window !== 'undefined') {
  createWeb3Modal({
    wagmiConfig: config,
    projectId,
    chains,
    themeMode: 'dark',
    themeVariables: {
      '--w3m-accent': '#FF8C00',
      '--w3m-color-mix': '#0a0a0a',
      '--w3m-color-mix-strength': 20,
    }
  });
}

export { mainnet, sepolia };
