// app/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to AfroX-ETH pair by default
    router.push('/trade/AfroX-ETH');
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center bg-afrodex-black">
      <div className="text-center">
        <div className="spinner mb-4"></div>
        <p className="text-gray-400">Loading AfroDex...</p>
      </div>
    </div>
  );
}
