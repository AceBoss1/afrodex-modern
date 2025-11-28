// components/Sidebar.tsx
'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { useWeb3Modal } from '@web3modal/wagmi/react';
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { getAllTokens, getTokenByAddress, Token, SUPPORTED_TOKENS } from '@/lib/tokens';
import Image from 'next/image';

export default function Sidebar() {
  const { address, isConnected } = useAccount();
  const { open } = useWeb3Modal();
  const { sidebarOpen, toggleSidebar, setTradingPair } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [customAddress, setCustomAddress] = useState('');
  const [showCustomToken, setShowCustomToken] = useState(false);

  const allTokens = getAllTokens();
  const filteredTokens = allTokens.filter(
    token =>
      token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      token.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      token.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectPair = (token: Token) => {
    // Always pair with ETH
    setTradingPair(token, SUPPORTED_TOKENS.ETH);
  };

  const handleCustomToken = async () => {
    if (!customAddress || !/^0x[a-fA-F0-9]{40}$/.test(customAddress)) {
      alert('Please enter a valid Ethereum address');
      return;
    }

    // Check if token already exists
    const existingToken = getTokenByAddress(customAddress);
    if (existingToken) {
      handleSelectPair(existingToken);
      setShowCustomToken(false);
      setCustomAddress('');
      return;
    }

    // Create custom token entry
    const customToken: Token = {
      symbol: 'CUSTOM',
      name: 'Custom Token',
      address: customAddress,
      decimals: 18,
      logo: '/tokens/empty-token.png',
      description: 'Custom unlisted token',
    };

    setTradingPair(customToken, SUPPORTED_TOKENS.ETH);
    setShowCustomToken(false);
    setCustomAddress('');
  };

  if (!sidebarOpen) {
    return (
      <button
        onClick={toggleSidebar}
        className="fixed left-0 top-1/2 -translate-y-1/2 bg-afrodex-orange p-2 rounded-r-lg shadow-neon z-50"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    );
  }

  return (
    <div className="w-80 bg-afrodex-black-light border-r border-gray-800 h-screen flex flex-col relative">
      {/* Header */}
      <div className="p-4 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image
            src="/afrodex_logo.jpg"
            alt="AfroDex"
            width={40}
            height={40}
            className="rounded"
          />
          <div>
            <h1 className="text-xl font-bold neon-text">AfroDex</h1>
            <p className="text-xs text-gray-400">Africa&apos;s Biggest DEX</p>
          </div>
        </div>
        <button
          onClick={toggleSidebar}
          className="p-1 hover:bg-afrodex-black-lighter rounded"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      </div>

      {/* Wallet Connection */}
      <div className="p-4 border-b border-gray-800">
        {isConnected ? (
          <div className="card-neon">
            <p className="text-xs text-gray-400 mb-1">Connected Wallet</p>
            <p className="text-sm font-mono">
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </p>
          </div>
        ) : (
          <button
            onClick={() => open()}
            className="btn-primary w-full"
          >
            Connect Wallet
          </button>
        )}
      </div>

      {/* Market Search */}
      <div className="p-4 border-b border-gray-800">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="search"
            placeholder="Search tokens or paste address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-3 py-2"
          />
        </div>
        
        {/* Custom Token Button */}
        <button
          onClick={() => setShowCustomToken(!showCustomToken)}
          className="mt-2 text-sm text-afrodex-orange hover:text-afrodex-orange-light w-full text-left"
        >
          + Add custom token by address
        </button>

        {showCustomToken && (
          <div className="mt-2 p-3 bg-afrodex-black-lighter rounded">
            <input
              type="text"
              placeholder="0x..."
              value={customAddress}
              onChange={(e) => setCustomAddress(e.target.value)}
              className="w-full mb-2"
            />
            <div className="flex gap-2">
              <button
                onClick={handleCustomToken}
                className="btn-primary flex-1 text-sm py-1"
              >
                Add
              </button>
              <button
                onClick={() => {
                  setShowCustomToken(false);
                  setCustomAddress('');
                }}
                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Token List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-2">
          {filteredTokens.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No tokens found
            </div>
          ) : (
            filteredTokens.map((token) => (
              <button
                key={token.address}
                onClick={() => handleSelectPair(token)}
                className="w-full p-3 hover:bg-afrodex-black-lighter rounded flex items-center gap-3 mb-1 transition-colors"
              >
                <Image
                  src={token.logo}
                  alt={token.symbol}
                  width={32}
                  height={32}
                  className="rounded-full"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/tokens/empty-token.png';
                  }}
                />
                <div className="text-left flex-1">
                  <div className="font-semibold">{token.symbol}/ETH</div>
                  <div className="text-xs text-gray-400">{token.name}</div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-800 text-xs text-gray-500 text-center">
        Order Book Exchange • Est. 2019
      </div>
    </div>
  );
}
