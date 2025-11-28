// components/TokenInfo.tsx
'use client';

import { ExternalLink } from 'lucide-react';
import { Token } from '@/lib/tokens';
import Image from 'next/image';

interface TokenInfoProps {
  token: Token;
}

export default function TokenInfo({ token }: TokenInfoProps) {
  return (
    <div className="card-neon">
      <div className="flex items-start gap-4">
        <Image
          src={token.logo}
          alt={token.symbol}
          width={64}
          height={64}
          className="rounded-full"
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/tokens/empty-token.png';
          }}
        />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-2xl font-bold">{token.symbol}</h2>
            <span className="text-sm text-gray-400">{token.name}</span>
          </div>
          
          <p className="text-sm text-gray-300 mb-3">{token.description}</p>
          
          <div className="text-xs text-gray-400 mb-2">
            <span className="font-mono">{token.address}</span>
          </div>
          
          <div className="flex gap-3">
            {token.etherscan && (
              <a
                href={token.etherscan}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-afrodex-orange hover:text-afrodex-orange-light flex items-center gap-1"
              >
                Etherscan <ExternalLink className="w-3 h-3" />
              </a>
            )}
            {token.tracker && (
              <a
                href={token.tracker}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-afrodex-orange hover:text-afrodex-orange-light flex items-center gap-1"
              >
                Tracker <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
