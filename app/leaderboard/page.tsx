// app/leaderboard/page.tsx
'use client';

import Leaderboard from '@/components/Leaderboard';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function LeaderboardPage() {
  return (
    <div className="min-h-screen bg-afrodex-black p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Back Link */}
        <Link 
          href="/trade/AfroX-ETH"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-afrodex-orange mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Trading
        </Link>
        
        {/* Page Title */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gradient mb-2">🏆 TGIF Leaderboard</h1>
          <p className="text-gray-400">
            Trade, stake, and earn rewards every Friday!
          </p>
        </div>
        
        {/* Leaderboard Component */}
        <Leaderboard />
        
        {/* Info Section */}
        <div className="mt-8 grid md:grid-cols-2 gap-4">
          <div className="card">
            <h3 className="font-semibold text-white mb-2">📈 How to Climb the Ranks</h3>
            <ul className="text-sm text-gray-400 space-y-1">
              <li>• Execute trades (takers earn rewards)</li>
              <li>• Stake more AfroX for higher multipliers</li>
              <li>• Trade consistently throughout the week</li>
            </ul>
          </div>
          <div className="card">
            <h3 className="font-semibold text-white mb-2">🎁 TGIF Rewards</h3>
            <ul className="text-sm text-gray-400 space-y-1">
              <li>• Rewards distributed every Friday</li>
              <li>• Based on fees paid × badge multiplier</li>
              <li>• Must stake ≥1B AfroX to qualify</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
