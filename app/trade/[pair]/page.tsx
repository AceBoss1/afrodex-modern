// app/trade/[pair]/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { ethers } from 'ethers';
import { useTradingStore } from '@/lib/store';
import { 
  getToken, 
  getTokenByAddress, 
  Token, 
  SUPPORTED_TOKENS,
  isValidAddress,
  createCustomToken,
} from '@/lib/tokens';
import { getTokenInfo } from '@/lib/exchange';
import { fetchOrders, fetchTrades, subscribeToTrades, subscribeToOrders } from '@/lib/api';

import Sidebar from '@/components/Sidebar';
import TokenInfo from '@/components/TokenInfo';
import TradingChart from '@/components/TradingChart';
import OrderBook from '@/components/OrderBook';
import TradeHistory from '@/components/TradeHistory';
import TradingPanel from '@/components/TradingPanel';
import BalancePanel from '@/components/BalancePanel';

export default function TradePage() {
  const params = useParams();
  const {
    baseToken,
    quoteToken,
    setTradingPair,
    setOrders,
    setTrades,
    addTrade,
    addOrder,
    setLoadingOrders,
    setLoadingTrades,
  } = useTradingStore();

  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get provider
  const getProvider = useCallback(() => {
    const alchemyKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
    return new ethers.JsonRpcProvider(
      alchemyKey 
        ? `https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`
        : 'https://eth.llamarpc.com'
    );
  }, []);

  // Parse trading pair from URL and set up tokens
  useEffect(() => {
    const initializePair = async () => {
      if (!params.pair) return;

      const pairStr = params.pair as string;
      const parts = pairStr.split('-');
      
      if (parts.length !== 2) {
        setError('Invalid trading pair format. Use TOKEN-ETH format.');
        return;
      }

      const [baseSymbol, quoteSymbol] = parts;
      
      // Get quote token (usually ETH)
      const quote = getToken(quoteSymbol) || SUPPORTED_TOKENS.ETH;
      
      // Try to get base token by symbol
      let base = getToken(baseSymbol);
      
      // If not found, check if it's a custom address
      if (!base && isValidAddress(baseSymbol)) {
        try {
          const provider = getProvider();
          const tokenInfo = await getTokenInfo(provider, baseSymbol);
          base = createCustomToken(
            baseSymbol,
            tokenInfo.symbol,
            tokenInfo.name,
            tokenInfo.decimals
          );
        } catch (err) {
          console.error('Error loading custom token:', err);
          setError('Failed to load token. Please check the address.');
          return;
        }
      }
      
      if (!base) {
        // Try finding by address in URL
        base = getTokenByAddress(baseSymbol);
      }

      if (!base) {
        setError(`Token "${baseSymbol}" not found. Try adding it by contract address.`);
        return;
      }

      setTradingPair(base, quote);
      setInitialized(true);
      setError(null);
    };

    initializePair();
  }, [params.pair, setTradingPair, getProvider]);

  // Fetch orders and trades when pair is initialized
  useEffect(() => {
    if (!initialized || !baseToken || !quoteToken) return;

    const provider = getProvider();

    const loadData = async () => {
      setLoadingOrders(true);
      setLoadingTrades(true);

      try {
        // Fetch in parallel
        const [ordersData, tradesData] = await Promise.all([
          fetchOrders(provider, baseToken, quoteToken),
          fetchTrades(provider, baseToken, quoteToken),
        ]);

        setOrders(ordersData.buyOrders, ordersData.sellOrders);
        setTrades(tradesData);
      } catch (err) {
        console.error('Error loading data:', err);
      } finally {
        setLoadingOrders(false);
        setLoadingTrades(false);
      }
    };

    loadData();

    // Set up real-time subscriptions
    const unsubTrades = subscribeToTrades(
      provider,
      baseToken,
      quoteToken,
      (trade) => addTrade(trade)
    );

    const unsubOrders = subscribeToOrders(
      provider,
      baseToken,
      quoteToken,
      (order, side) => addOrder(order, side)
    );

    // Refresh orders periodically
    const refreshInterval = setInterval(async () => {
      try {
        const ordersData = await fetchOrders(provider, baseToken, quoteToken, false);
        setOrders(ordersData.buyOrders, ordersData.sellOrders);
      } catch (err) {
        console.error('Error refreshing orders:', err);
      }
    }, 30000);

    return () => {
      unsubTrades();
      unsubOrders();
      clearInterval(refreshInterval);
    };
  }, [
    initialized,
    baseToken,
    quoteToken,
    getProvider,
    setOrders,
    setTrades,
    addTrade,
    addOrder,
    setLoadingOrders,
    setLoadingTrades,
  ]);

  // Loading state
  if (!initialized || !baseToken || !quoteToken) {
    return (
      <div className="flex h-screen bg-afrodex-black">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            {error ? (
              <>
                <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">⚠️</span>
                </div>
                <h2 className="text-xl font-semibold mb-2">Error Loading Pair</h2>
                <p className="text-gray-500 mb-4">{error}</p>
                <a href="/trade/AfroX-ETH" className="btn-primary">
                  Go to Default Pair
                </a>
              </>
            ) : (
              <>
                <div className="spinner spinner-lg mb-4" />
                <p className="text-gray-500">Loading trading pair...</p>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-afrodex-black overflow-hidden">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Side - Token Info + Chart + Recent Trades */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Token Info Header */}
          <div className="p-2 pb-0">
            <TokenInfo token={baseToken} />
          </div>

          {/* Chart + Recent Trades + Order Book Row */}
          <div className="flex-1 grid grid-cols-12 gap-2 p-2 overflow-hidden">
            {/* Chart + Recent Trades Column - Wider */}
            <div className="col-span-12 lg:col-span-8 flex flex-col gap-2 min-h-0">
              {/* Chart */}
              <div className="flex-[2] min-h-[200px]">
                <TradingChart baseToken={baseToken} quoteToken={quoteToken} />
              </div>
              
              {/* Trade History */}
              <div className="flex-1 min-h-[150px]">
                <TradeHistory baseToken={baseToken} quoteToken={quoteToken} />
              </div>
            </div>

            {/* Order Book Column - Narrower */}
            <div className="col-span-12 lg:col-span-4 min-h-0">
              <OrderBook baseToken={baseToken} quoteToken={quoteToken} />
            </div>
          </div>
        </div>

        {/* Right Side - Place Order + Balances (Wider for 12+ decimals) */}
        <div className="w-80 flex-shrink-0 flex flex-col gap-2 p-2 border-l border-white/5 overflow-y-auto">
          {/* Place Order */}
          <div className="flex-shrink-0">
            <TradingPanel baseToken={baseToken} quoteToken={quoteToken} />
          </div>
          
          {/* Balances */}
          <div className="flex-shrink-0">
            <BalancePanel baseToken={baseToken} quoteToken={quoteToken} />
          </div>
        </div>
      </main>
    </div>
  );
}
