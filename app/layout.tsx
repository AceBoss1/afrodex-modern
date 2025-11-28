// app/layout.tsx
'use client';

import './globals.css';
import { WagmiConfig } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config } from '@/lib/web3';

const queryClient = new QueryClient();

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <title>AfroDex - Africa&apos;s Biggest DEX</title>
        <meta name="description" content="Decentralized exchange for African and global tokens" />
        <link rel="icon" href="/afrodex_logo.jpg" />
      </head>
      <body>
        <WagmiConfig config={config as any}>
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        </WagmiConfig>
      </body>
    </html>
  );
}
