// components/Web3Provider.tsx
'use client';

import { ReactNode, useEffect, useState } from 'react';
import { WagmiProvider, State } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config, initializeWeb3Modal } from '@/lib/web3';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

interface Web3ProviderProps {
  children: ReactNode;
  initialState?: State;
}

export default function Web3Provider({ children, initialState }: Web3ProviderProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    initializeWeb3Modal();
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <WagmiProvider config={config} initialState={initialState}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
