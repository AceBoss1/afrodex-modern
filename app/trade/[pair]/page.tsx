// app/trade/[pair]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { usePublicClient } from 'wagmi';
import { useAppStore } from '@/lib/store';
import { getToken, getTokenByAddress, SUPPORTED_TOKENS } from '@/lib/tokens';
import { fetchOrders, fetchTrades, subscribeToTrades } from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import TokenInfo from '@/components/TokenInfo';
import TradingChart from '@/components/TradingChart';
import OrderBook from '@/components/OrderBook';
import TradeHistory from '@/components/TradeHistory';
import TradingPanel from '@/components/TradingPanel';
import BalancePanel from '@/components/BalancePanel';

export default function TradePage() {
  const params = useParams();
  const publicClient = usePublicClient();
  const {
    baseToken,
    quoteToken,
    setTradingPair,
    setOrders,
    setTrades,
    addTrade,
    setLoadingOrders,
    setLoadingTrades,
  } = useAppStore();

  const [initialized, setInitialized] = useState(false);

  // Initialize trading pair from URL
  useEffect(() => {
    if (!params.pair) return;

    const pairStr = params.pair as string;
    const [baseSymbol, quoteSymbol] = pairStr.split('-');

    const base = getToken(baseSymbol);
    const quote = getToken(quoteSymbol) || SUPPORTED_TOKENS.ETH;

    if (base) {
      setTradingPair(base, quote);
      setInitialized(true);
    }
  }, [params.pair, setTradingPair]);

  // Fetch orders and trades when pair changes
  useEffect(() => {
    if (!publicClient || !baseToken || !quoteToken) return;

    const loadData = async () => {
      setLoadingOrders(true);
      setLoadingTrades(true);

      try {
        const [ordersData, tradesData] = await Promise.all([
          fetchOrders(publicClient as any, baseToken, quoteToken),
          fetchTrades(publicClient as any, baseToken, quoteToken),
        ]);

        setOrders(ordersData.buyOrders, ordersData.sellOrders);
        setTrades(tradesData);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoadingOrders(false);
        setLoadingTrades(false);
      }
    };

    loadData();

    // Subscribe to new trades
    const unsubscribe = subscribeToTrades(
      publicClient as any,
      baseToken,
      quoteToken,
      (trade) => {
        addTrade(trade);
      }
    );

    // Refresh orders every 30 seconds
    const interval = setInterval(async () => {
      const ordersData = await fetchOrders(publicClient as any, baseToken, quoteToken);
      setOrders(ordersData.buyOrders, ordersData.sellOrders);
    }, 30000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [publicClient, baseToken, quoteToken, setOrders, setTrades, addTrade, setLoadingOrders, setLoadingTrades]);

  if (!initialized || !baseToken || !quoteToken) {
    return (
      <div className="flex h-screen items-center justify-center bg-afrodex-black">
        <div className="text-center">
          <div className="spinner mb-4"></div>
          <p className="text-gray-400">Loading trading pair...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-afrodex-black overflow-hidden">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Token Info */}
        <div className="p-4 border-b border-gray-800">
          <TokenInfo token={baseToken} />
        </div>

        {/* Trading Interface */}
        <div className="flex-1 grid grid-cols-12 gap-4 p-4 overflow-hidden">
          {/* Left Column - Chart + Trade History */}
          <div className="col-span-7 flex flex-col gap-4 overflow-hidden">
            <div className="flex-[2] min-h-0">
              <TradingChart baseToken={baseToken} quoteToken={quoteToken} />
            </div>
            <div className="flex-1 min-h-0">
              <TradeHistory baseToken={baseToken} quoteToken={quoteToken} />
            </div>
          </div>

          {/* Middle Column - Order Book */}
          <div className="col-span-3 overflow-hidden">
            <OrderBook baseToken={baseToken} quoteToken={quoteToken} />
          </div>

          {/* Right Column - Trading + Balance */}
          <div className="col-span-2 flex flex-col gap-4 overflow-hidden">
            <div className="flex-1 min-h-0">
              <TradingPanel baseToken={baseToken} quoteToken={quoteToken} />
            </div>
            <div className="flex-1 min-h-0">
              <BalancePanel baseToken={baseToken} quoteToken={quoteToken} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
