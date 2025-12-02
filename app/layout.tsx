// app/layout.tsx
import { Metadata, Viewport } from 'next';
import './globals.css';
import Web3Provider from '@/components/Web3Provider';

export const metadata: Metadata = {
  title: "AfroDex - Africa's Premier Order Book DEX",
  description: 'Decentralized exchange for African and global tokens. Trade any ERC-20 token with self-listing capabilities.',
  keywords: ['DEX', 'decentralized exchange', 'crypto', 'Ethereum', 'ERC-20', 'Africa', 'blockchain', 'order book'],
  authors: [{ name: 'AfroDex Team' }],
  icons: {
    icon: '/afrodex_logo.jpg',
    apple: '/afrodex_logo.jpg',
  },
  openGraph: {
    title: "AfroDex - Africa's Premier Order Book DEX",
    description: 'Trade any ERC-20 token on the most trusted African decentralized exchange.',
    url: 'https://dex.afrox.one',
    siteName: 'AfroDex',
    images: [
      {
        url: '/afrodex_logo.jpg',
        width: 800,
        height: 800,
        alt: 'AfroDex Logo',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "AfroDex - Africa's Premier Order Book DEX",
    description: 'Trade any ERC-20 token on the most trusted African decentralized exchange.',
    images: ['/afrodex_logo.jpg'],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: '#FF8C00',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-afrodex-black antialiased">
        <Web3Provider>{children}</Web3Provider>
      </body>
    </html>
  );
}
