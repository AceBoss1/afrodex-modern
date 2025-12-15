// components/MyTransactions.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { ethers } from 'ethers';
import { useTradingStore } from '@/lib/store';
import { Token, ZERO_ADDRESS } from '@/lib/tokens';
import { cancelOrderByHash, clearAllOrders, getTradesFromDb } from '@/lib/supabase';
import { 
  ClipboardList, 
  ArrowLeftRight, 
  Wallet, 
  X, 
  ExternalLink,
  Trash2,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { EXCHANGE_ADDRESS, ERC20_ABI, EXCHANGE_ABI } from '@/lib/exchange';

interface MyTransactionsProps {
  baseToken: Token;
  quoteToken: Token;
}

type Tab = 'orders' | 'trades' | 'funds';

// Format with full 15 decimal precision
function formatFull15(value: string | number, decimals: number = 18): string {
  try {
    let numValue: number;
    
    if (typeof value === 'string') {
      // Handle wei values (large integer strings)
      if (value.length > 15 && !value.includes('.')) {
        const formatted = ethers.formatUnits(value, decimals);
        numValue = parseFloat(formatted);
      } else {
        numValue = parseFloat(value);
      }
    } else {
      numValue = value;
    }
    
    if (isNaN(numValue) || !isFinite(numValue)) return '0';
    if (numValue === 0) return '0';
    
    // For very small numbers, show full precision
    if (Math.abs(numValue) < 0.000001) {
      return numValue.toFixed(15).replace(/\.?0+$/, '');
    }
    
    // For small numbers, show up to 15 decimals
    if (Math.abs(numValue) < 1) {
      return numValue.toFixed(15).replace(/\.?0+$/, '');
    }
    
    // For larger numbers, use locale formatting with good precision
    return numValue.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 8,
    });
  } catch {
    return '0';
  }
}

// Format price with 15 decimals - never abbreviate
function formatPrice15(price: number): string {
  if (price === 0) return '0';
  if (isNaN(price) || !isFinite(price)) return '0';
  
  // Always show full precision for prices
  if (Math.abs(price) < 0.000001) {
    return price.toFixed(15).replace(/\.?0+$/, '');
  }
  
  return price.toFixed(15).replace(/\.?0+$/, '');
}

// Format timestamp
function formatTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function MyTransactions({ baseToken, quoteToken }: MyTransactionsProps) {
  const [activeTab, setActiveTab] = useState<Tab>('orders');
  const { address, isConnected } = useAccount();
  const { buyOrders, sellOrders, trades, setOrders, setTrades } = useTradingStore();
  
  const [balances, setBalances] = useState({
    baseWallet: '0',
    baseExchange: '0',
    quoteWallet: '0',
    quoteExchange: '0',
  });
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);
  const [cancellingOrder, setCancellingOrder] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Get user's orders
  const myOrders = useMemo(() => {
    if (!address) return [];
    
    const allOrders = [...buyOrders, ...sellOrders];
    return allOrders
      .filter(o => o.user?.toLowerCase() === address.toLowerCase())
      .sort((a, b) => parseInt(b.expires) - parseInt(a.expires));
  }, [buyOrders, sellOrders, address]);

  // Get user's trades
  const myTrades = useMemo(() => {
    if (!address) return [];
    
    return trades
      .filter(t => 
        t.maker?.toLowerCase() === address.toLowerCase() ||
        t.taker?.toLowerCase() === address.toLowerCase()
      )
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }, [trades, address]);

  // Fetch balances
  useEffect(() => {
    const fetchBalances = async () => {
      if (!address || !isConnected || typeof window === 'undefined') return;
      
      setIsLoadingBalances(true);
      
      try {
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const exchangeContract = new ethers.Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, provider);
        
        // Fetch ETH balances
        const ethWallet = await provider.getBalance(address);
        const ethExchange = await exchangeContract.balanceOf(ZERO_ADDRESS, address);
        
        // Fetch token balances
        let tokenWallet = BigInt(0);
        let tokenExchange = BigInt(0);
        
        if (baseToken.address !== ZERO_ADDRESS) {
          const tokenContract = new ethers.Contract(baseToken.address, ERC20_ABI, provider);
          tokenWallet = await tokenContract.balanceOf(address);
          tokenExchange = await exchangeContract.balanceOf(baseToken.address, address);
        }
        
        setBalances({
          baseWallet: tokenWallet.toString(),
          baseExchange: tokenExchange.toString(),
          quoteWallet: ethWallet.toString(),
          quoteExchange: ethExchange.toString(),
        });
      } catch (err) {
        console.error('Error fetching balances:', err);
      } finally {
        setIsLoadingBalances(false);
      }
    };

    fetchBalances();
    const interval = setInterval(fetchBalances, 15000);
    return () => clearInterval(interval);
  }, [address, isConnected, baseToken.address]);

  // Fetch trades from Supabase on mount
  useEffect(() => {
    const fetchTrades = async () => {
      console.log('Fetching trades from Supabase...');
      const dbTrades = await getTradesFromDb(baseToken.address, quoteToken.address, 100);
      
      console.log('Fetched trades:', dbTrades.length);
      
      if (dbTrades.length > 0) {
        const formattedTrades = dbTrades.map(t => ({
          txHash: t.tx_hash,
          blockNumber: t.block_number,
          timestamp: t.block_timestamp ? Math.floor(new Date(t.block_timestamp).getTime() / 1000) : 0,
          tokenGet: t.token_get,
          amountGet: t.amount_get,
          tokenGive: t.token_give,
          amountGive: t.amount_give,
          maker: t.maker,
          taker: t.taker,
          price: t.price,
          side: t.side as 'buy' | 'sell',
          baseAmount: t.base_amount,
          quoteAmount: t.quote_amount,
        }));
        
        setTrades(formattedTrades);
      }
    };

    fetchTrades();
  }, [baseToken.address, quoteToken.address, setTrades]);

  // Cancel order
  const handleCancelOrder = async (order: typeof myOrders[0]) => {
    const orderHash = order.hash;
    if (!orderHash) {
      console.error('No order hash for cancellation');
      return;
    }

    setCancellingOrder(orderHash);
    
    try {
      const success = await cancelOrderByHash(orderHash);
      
      if (success) {
        const updatedBuys = buyOrders.filter(o => o.hash !== orderHash);
        const updatedSells = sellOrders.filter(o => o.hash !== orderHash);
        setOrders(updatedBuys, updatedSells);
      }
    } catch (err) {
      console.error('Error cancelling order:', err);
    } finally {
      setCancellingOrder(null);
    }
  };

  // Clear all orders
  const handleClearAll = async () => {
    if (!confirm('Clear all your active orders?')) return;
    
    setIsClearing(true);
    
    try {
      await clearAllOrders();
      setOrders([], []);
    } catch (err) {
      console.error('Error clearing orders:', err);
    } finally {
      setIsClearing(false);
    }
  };

  // Refresh trades from Supabase
  const handleRefreshTrades = async () => {
    setIsRefreshing(true);
    
    try {
      console.log('Refreshing trades...');
      const dbTrades = await getTradesFromDb(baseToken.address, quoteToken.address, 100);
      
      console.log('Refreshed trades:', dbTrades.length);
      
      if (dbTrades.length > 0) {
        const formattedTrades = dbTrades.map(t => ({
          txHash: t.tx_hash,
          blockNumber: t.block_number,
          timestamp: t.block_timestamp ? Math.floor(new Date(t.block_timestamp).getTime() / 1000) : 0,
          tokenGet: t.token_get,
          amountGet: t.amount_get,
          tokenGive: t.token_give,
          amountGive: t.amount_give,
          maker: t.maker,
          taker: t.taker,
          price: t.price,
          side: t.side as 'buy' | 'sell',
          baseAmount: t.base_amount,
          quoteAmount: t.quote_amount,
        }));
        
        setTrades(formattedTrades);
      }
    } catch (err) {
      console.error('Error refreshing trades:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const tabs = [
    { id: 'orders' as Tab, label: 'Orders', icon: ClipboardList, count: myOrders.length },
    { id: 'trades' as Tab, label: 'Trades', icon: ArrowLeftRight, count: myTrades.length },
    { id: 'funds' as Tab, label: 'Funds', icon: Wallet },
  ];

  if (!isConnected) {
    return (
      <div className="card h-full flex items-center justify-center">
        <p className="text-gray-500 text-sm">Connect wallet to view transactions</p>
      </div>
    );
  }

  return (
    <div className="card h-full flex flex-col">
      {/* Tabs */}
      <div className="flex border-b border-white/10 mb-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors relative ${
              activeTab === tab.id
                ? 'text-afrodex-orange'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="bg-afrodex-orange/20 text-afrodex-orange text-xs px-1.5 rounded">
                {tab.count}
              </span>
            )}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-afrodex-orange" />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Orders Tab */}
        {activeTab === 'orders' && (
          <div>
            {myOrders.length > 0 && (
              <div className="flex justify-end mb-2">
                <button
                  onClick={handleClearAll}
                  disabled={isClearing}
                  className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                >
                  {isClearing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                  Clear All
                </button>
              </div>
            )}
            
            {myOrders.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                No open orders
              </div>
            ) : (
              <div className="space-y-2">
                {myOrders.map((order, idx) => {
                  const isBuy = order.tokenGet?.toLowerCase() === baseToken.address.toLowerCase();
                  const amount = isBuy
                    ? formatFull15(order.amountGet, baseToken.decimals)
                    : formatFull15(order.amountGive, baseToken.decimals);
                  const filled = formatFull15(order.amountFilled || '0', baseToken.decimals);
                  const isCancelling = cancellingOrder === order.hash;
                  
                  return (
                    <div
                      key={idx}
                      className="bg-afrodex-black-lighter rounded-lg p-3 border border-white/5"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                          isBuy ? 'bg-trade-buy/20 text-trade-buy' : 'bg-trade-sell/20 text-trade-sell'
                        }`}>
                          {isBuy ? 'BUY' : 'SELL'}
                        </span>
                        <button
                          onClick={() => handleCancelOrder(order)}
                          disabled={isCancelling}
                          className="text-gray-500 hover:text-red-400 transition-colors disabled:opacity-50"
                        >
                          {isCancelling ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <X className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <span className="text-gray-500">Price</span>
                          <p className="font-mono text-white break-all">{formatPrice15(order.price || 0)}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Amount</span>
                          <p className="font-mono text-white break-all">{amount}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Filled</span>
                          <p className="font-mono text-gray-400 break-all">{filled}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Trades Tab */}
        {activeTab === 'trades' && (
          <div>
            <div className="flex justify-end mb-2">
              <button
                onClick={handleRefreshTrades}
                disabled={isRefreshing}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-300 disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
            
            {myTrades.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                No trade history
              </div>
            ) : (
              <div className="space-y-2">
                {myTrades.map((trade, idx) => {
                  const isMaker = trade.maker?.toLowerCase() === address?.toLowerCase();
                  const isBuy = trade.side === 'buy';
                  
                  return (
                    <div
                      key={idx}
                      className="bg-afrodex-black-lighter rounded-lg p-3 border border-white/5"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                            isBuy ? 'bg-trade-buy/20 text-trade-buy' : 'bg-trade-sell/20 text-trade-sell'
                          }`}>
                            {isBuy ? 'BUY' : 'SELL'}
                          </span>
                          <span className="text-xs text-gray-500">
                            {isMaker ? 'Maker' : 'Taker'}
                          </span>
                        </div>
                        <a
                          href={`https://etherscan.io/tx/${trade.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-500 hover:text-afrodex-orange"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <span className="text-gray-500">Price</span>
                          <p className="font-mono text-white break-all">{formatPrice15(trade.price || 0)}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Amount</span>
                          <p className="font-mono text-white break-all">{formatFull15(trade.baseAmount || 0, 0)}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Total</span>
                          <p className="font-mono text-gray-400 break-all">{formatFull15(trade.quoteAmount || 0, 0)} ETH</p>
                        </div>
                      </div>
                      
                      <div className="mt-2 text-xs text-gray-600">
                        {trade.timestamp ? formatTime(trade.timestamp) : 'Unknown time'}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Funds Tab */}
        {activeTab === 'funds' && (
          <div className="space-y-4">
            {isLoadingBalances ? (
              <div className="text-center py-8">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-afrodex-orange" />
                <p className="text-gray-500 text-sm mt-2">Loading balances...</p>
              </div>
            ) : (
              <>
                {/* ETH Balances */}
                <div className="bg-afrodex-black-lighter rounded-lg p-4 border border-white/5">
                  <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-xs">Ξ</div>
                    {quoteToken.symbol}
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs text-gray-500">Wallet</span>
                      <p className="font-mono text-white text-sm break-all">
                        {formatFull15(balances.quoteWallet, 18)}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">Exchange</span>
                      <p className="font-mono text-afrodex-orange text-sm break-all">
                        {formatFull15(balances.quoteExchange, 18)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Token Balances */}
                <div className="bg-afrodex-black-lighter rounded-lg p-4 border border-white/5">
                  <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-afrodex-orange/20 flex items-center justify-center text-xs">
                      {baseToken.symbol.charAt(0)}
                    </div>
                    {baseToken.symbol}
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs text-gray-500">Wallet</span>
                      <p className="font-mono text-white text-sm break-all">
                        {formatFull15(balances.baseWallet, baseToken.decimals)}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">Exchange</span>
                      <p className="font-mono text-afrodex-orange text-sm break-all">
                        {formatFull15(balances.baseExchange, baseToken.decimals)}
                      </p>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-gray-600 text-center">
                  Deposit funds to exchange to place orders.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
