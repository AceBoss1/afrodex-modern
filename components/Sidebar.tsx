// components/Sidebar.tsx
'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { useWeb3Modal } from '@web3modal/wagmi/react';
import Image from 'next/image';
import {
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  Plus,
  Star,
  Wallet,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';
import { useUIStore, useCustomTokensStore, useFavoritesStore, useTradingStore } from '@/lib/store';
import {
  getAllTokens,
  getTokenByAddress,
  Token,
  SUPPORTED_TOKENS,
  isValidAddress,
  createCustomToken,
} from '@/lib/tokens';
import { getTokenInfo } from '@/lib/exchange';
import { usePublicClient } from 'wagmi';
import { ethers } from 'ethers';

export default function Sidebar() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { open } = useWeb3Modal();
  const publicClient = usePublicClient();
  
  const { sidebarOpen, toggleSidebar } = useUIStore();
  const { baseToken, setTradingPair } = useTradingStore();
  const { customTokens, addCustomToken } = useCustomTokensStore();
  const { favorites, addFavorite, removeFavorite, isFavorite } = useFavoritesStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddToken, setShowAddToken] = useState(false);
  const [customAddress, setCustomAddress] = useState('');
  const [isLoadingToken, setIsLoadingToken] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'favorites'>('all');

  // Combine official and custom tokens
  const allTokens = useMemo(() => {
    const official = getAllTokens();
    return [...official, ...customTokens];
  }, [customTokens]);

  // Filter tokens based on search
  const filteredTokens = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    
    if (!query) {
      if (activeTab === 'favorites') {
        return allTokens.filter(t => isFavorite(t.address));
      }
      return allTokens;
    }

    // Check if query is an address
    if (isValidAddress(query)) {
      const existing = allTokens.find(
        t => t.address.toLowerCase() === query
      );
      if (existing) return [existing];
      
      // Show add token prompt
      return [];
    }

    // Search by symbol or name
    return allTokens.filter(
      t =>
        t.symbol.toLowerCase().includes(query) ||
        t.name.toLowerCase().includes(query)
    );
  }, [allTokens, searchQuery, activeTab, isFavorite]);

  // Check if search is a valid address that's not in our list
  const isSearchingNewAddress = useMemo(() => {
    if (!searchQuery.trim()) return false;
    const query = searchQuery.toLowerCase().trim();
    if (!isValidAddress(query)) return false;
    return !allTokens.find(t => t.address.toLowerCase() === query);
  }, [searchQuery, allTokens]);

  // Handle selecting a trading pair
  const handleSelectPair = useCallback((token: Token) => {
    setTradingPair(token, SUPPORTED_TOKENS.ETH);
    // Use address for custom/unlisted tokens, symbol for official tokens
    const pairIdentifier = token.isCustom ? token.address : token.symbol;
    router.push(`/trade/${pairIdentifier}-ETH`);
    setSearchQuery('');
  }, [setTradingPair, router]);

  // Handle adding custom token
  const handleAddCustomToken = async () => {
    const addressToAdd = customAddress.trim() || searchQuery.trim();
    
    if (!isValidAddress(addressToAdd)) {
      setTokenError('Please enter a valid Ethereum address');
      return;
    }

    // Check if already exists
    const existing = getTokenByAddress(addressToAdd) || 
      customTokens.find(t => t.address.toLowerCase() === addressToAdd.toLowerCase());
    
    if (existing) {
      handleSelectPair(existing);
      setShowAddToken(false);
      setCustomAddress('');
      setTokenError(null);
      return;
    }

    setIsLoadingToken(true);
    setTokenError(null);

    try {
      // Get provider from publicClient
      const alchemyKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
      const provider = new ethers.JsonRpcProvider(
        alchemyKey 
          ? `https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`
          : 'https://eth.llamarpc.com'
      );

      const tokenInfo = await getTokenInfo(provider, addressToAdd);
      
      const newToken = createCustomToken(
        addressToAdd,
        tokenInfo.symbol,
        tokenInfo.name,
        tokenInfo.decimals
      );

      addCustomToken(newToken);
      handleSelectPair(newToken);
      setShowAddToken(false);
      setCustomAddress('');
      setSearchQuery('');
    } catch (error) {
      console.error('Error adding token:', error);
      setTokenError('Failed to fetch token info. Make sure this is a valid ERC-20 token.');
    } finally {
      setIsLoadingToken(false);
    }
  };

  // Toggle favorite
  const handleToggleFavorite = (e: React.MouseEvent, token: Token) => {
    e.stopPropagation();
    if (isFavorite(token.address)) {
      removeFavorite(token.address);
    } else {
      addFavorite(token.address);
    }
  };

  // Collapsed sidebar
  if (!sidebarOpen) {
    return (
      <button
        onClick={toggleSidebar}
        className="fixed left-0 top-1/2 -translate-y-1/2 z-50 bg-afrodex-orange hover:bg-afrodex-orange-light p-2 rounded-r-lg shadow-neon transition-all"
        aria-label="Open sidebar"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    );
  }

  return (
    <aside className="w-72 bg-afrodex-black-light border-r border-white/5 h-screen flex flex-col relative z-40">
      {/* Header */}
      <div className="p-4 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10">
              <Image
                src="/afrodex_logo.jpg"
                alt="AfroDex"
                fill
                className="rounded-lg object-cover"
                priority
              />
            </div>
            <div>
              <h1 className="text-lg font-display font-bold text-gradient">AfroDex</h1>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Africa&apos;s Premier DEX</p>
            </div>
          </div>
          <button
            onClick={toggleSidebar}
            className="p-1.5 hover:bg-white/5 rounded-lg transition-colors"
            aria-label="Close sidebar"
          >
            <ChevronLeft className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Wallet Connection */}
      <div className="p-4 border-b border-white/5">
        {isConnected && address ? (
          <button
            onClick={() => open()}
            className="w-full p-3 bg-afrodex-black-lighter rounded-xl border border-white/5 hover:border-afrodex-orange/30 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-afrodex-orange to-afrodex-orange-dark flex items-center justify-center">
                <Wallet className="w-4 h-4" />
              </div>
              <div className="text-left flex-1">
                <p className="text-[10px] text-gray-500 uppercase">Connected</p>
                <p className="text-sm font-mono">
                  {address.slice(0, 6)}...{address.slice(-4)}
                </p>
              </div>
              <ExternalLink className="w-4 h-4 text-gray-500 group-hover:text-afrodex-orange transition-colors" />
            </div>
          </button>
        ) : (
          <button onClick={() => open()} className="btn-primary w-full">
            <Wallet className="w-4 h-4" />
            Connect Wallet
          </button>
        )}
      </div>

      {/* Market Search */}
      <div className="p-4 border-b border-white/5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search token or paste address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-10 pr-10 text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => setActiveTab('all')}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              activeTab === 'all'
                ? 'bg-afrodex-orange text-white'
                : 'bg-white/5 text-gray-400 hover:text-white'
            }`}
          >
            All Markets
          </button>
          <button
            onClick={() => setActiveTab('favorites')}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1 ${
              activeTab === 'favorites'
                ? 'bg-afrodex-orange text-white'
                : 'bg-white/5 text-gray-400 hover:text-white'
            }`}
          >
            <Star className="w-3 h-3" />
            Favorites
          </button>
        </div>

        {/* Add Custom Token */}
        {!showAddToken && (
          <button
            onClick={() => setShowAddToken(true)}
            className="mt-3 text-xs text-afrodex-orange hover:text-afrodex-orange-light flex items-center gap-1 transition-colors"
          >
            <Plus className="w-3 h-3" />
            Add custom token
          </button>
        )}

        {/* Custom Token Form */}
        {showAddToken && (
          <div className="mt-3 p-3 bg-afrodex-black-lighter rounded-xl border border-white/5 animate-slide-down">
            <input
              type="text"
              placeholder="Token contract address (0x...)"
              value={customAddress}
              onChange={(e) => {
                setCustomAddress(e.target.value);
                setTokenError(null);
              }}
              className="input text-sm mb-2"
            />
            {tokenError && (
              <div className="flex items-center gap-2 text-xs text-red-400 mb-2">
                <AlertCircle className="w-3 h-3" />
                {tokenError}
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleAddCustomToken}
                disabled={isLoadingToken}
                className="btn-primary flex-1 text-sm py-2"
              >
                {isLoadingToken ? (
                  <span className="spinner spinner-sm" />
                ) : (
                  'Add Token'
                )}
              </button>
              <button
                onClick={() => {
                  setShowAddToken(false);
                  setCustomAddress('');
                  setTokenError(null);
                }}
                className="btn-secondary px-3 py-2"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Token List */}
      <div className="flex-1 overflow-y-auto">
        {/* Show add prompt if searching for unknown address */}
        {isSearchingNewAddress && (
          <div className="p-4">
            <div className="p-4 bg-afrodex-black-lighter rounded-xl border border-afrodex-orange/30">
              <p className="text-sm text-gray-400 mb-3">
                Token not found. Would you like to add it?
              </p>
              <button
                onClick={handleAddCustomToken}
                disabled={isLoadingToken}
                className="btn-primary w-full text-sm"
              >
                {isLoadingToken ? (
                  <span className="spinner spinner-sm" />
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Add {searchQuery.slice(0, 6)}...{searchQuery.slice(-4)}
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Token Items */}
        <div className="p-2">
          {filteredTokens.length === 0 && !isSearchingNewAddress ? (
            <div className="text-center py-8 text-gray-500">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No tokens found</p>
            </div>
          ) : (
            filteredTokens.map((token) => (
              <button
                key={token.address}
                onClick={() => handleSelectPair(token)}
                className={`w-full p-3 rounded-xl flex items-center gap-3 mb-1 transition-all group ${
                  baseToken?.address === token.address
                    ? 'bg-afrodex-orange/10 border border-afrodex-orange/30'
                    : 'hover:bg-white/5 border border-transparent'
                }`}
              >
                <div className="relative w-9 h-9">
                  <Image
                    src={token.logo}
                    alt={token.symbol}
                    fill
                    className="rounded-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/tokens/empty-token.png';
                    }}
                  />
                  {token.isCustom && (
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-afrodex-orange rounded-full flex items-center justify-center">
                      <span className="text-[8px] font-bold">C</span>
                    </div>
                  )}
                </div>
                <div className="text-left flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{token.symbol}</span>
                    <span className="text-gray-500">/</span>
                    <span className="text-gray-400 text-sm">ETH</span>
                  </div>
                  <p className="text-xs text-gray-500 truncate">{token.name}</p>
                </div>
                <button
                  onClick={(e) => handleToggleFavorite(e, token)}
                  className={`p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all ${
                    isFavorite(token.address)
                      ? 'text-yellow-400 opacity-100'
                      : 'text-gray-500 hover:text-yellow-400'
                  }`}
                >
                  <Star
                    className="w-4 h-4"
                    fill={isFavorite(token.address) ? 'currentColor' : 'none'}
                  />
                </button>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-white/5">
        <a 
          href="/guide"
          className="flex items-center gap-2 text-xs text-gray-400 hover:text-afrodex-orange transition-colors mb-3"
        >
          <span>📖</span>
          User Guide
        </a>
        <div className="flex items-center justify-between text-xs text-gray-500">
          <a 
            href="https://afrox.one" 
            target="_blank" 
            rel="noopener noreferrer"
            className="hover:text-afrodex-orange transition-colors"
          >
            Powered by Community of Trust
          </a>
          <span>Est. 2019</span>
        </div>
      </div>
    </aside>
  );
}
