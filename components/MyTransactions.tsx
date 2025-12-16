// components/MyTransactions.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { ethers, Contract } from 'ethers';
import { History, FileText, Wallet, X, Loader2, ExternalLink, AlertCircle } from 'lucide-react';
import { Token, ZERO_ADDRESS } from '@/lib/tokens';
import { EXCHANGE_ADDRESS, formatAmount, cancelOrder as cancelOrderOnChain } from '@/lib/exchange';
import { EXCHANGE_ABI } from '@/lib/abi';
import { useTradingStore } from '@/lib/store';
import { cancelOrderByHash, getSupabaseClient } from '@/lib/supabase';

interface MyTransactionsProps {
  baseToken: Token;
  quoteToken: Token;
}

interface UserOrder {
  orderHash: string;
  side: 'buy' | 'sell';
  price: number;
  amount: number;
  total: number;
  filled: number;
  filledPercent: number;
  expires: string;
  nonce: string;
  tokenGet: string;
  amountGet: string;
  tokenGive: string;
  amountGive: string;
  v?: number;
  r?: string;
  s?: string;
}

interface UserTrade {
  txHash: string;
  timestamp: number;
  side: 'buy' | 'sell';
  price: number;
  amount: number;
  total: number;
  isMaker: boolean;
}

type Tab = 'trades' | 'orders' | 'funds';

// Format price with 15 decimals for very small prices
function formatPrice15(price: number): string {
  if (price === 0) return '0';
  const absPrice = Math.abs(price);
  if (absPrice >= 1) return price.toFixed(6);
  if (absPrice >= 0.0001) return price.toFixed(8);
  if (absPrice >= 0.000001) return price.toFixed(10);
  if (absPrice >= 0.000000001) return price.toFixed(12);
  return price.toFixed(15);
}

// Format amount with appropriate decimals
function formatAmount15(amount: number): string {
  if (amount === 0) return '0';
  const absAmount = Math.abs(amount);
  if (absAmount >= 1000000) return Math.round(amount).toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (absAmount >= 1000) return amount.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (absAmount >= 1) return amount.toFixed(4);
  if (absAmount >= 0.0001) return amount.toFixed(8);
  return amount.toFixed(15);
}

export default function MyTransactions({ baseToken, quoteToken }: MyTransactionsProps) {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { buyOrders, sellOrders } = useTradingStore();

  const [activeTab, setActiveTab] = useState<Tab>('orders');
  const [userOrders, setUserOrders] = useState<UserOrder[]>([]);
  const [userTrades, setUserTrades] = useState<UserTrade[]>([]);
  const [loading, setLoading] = useState(false);
  const [cancellingOrder, setCancellingOrder] = useState<string | null>(null);

  // Fetch user's orders
  useEffect(() => {
    if (!address) {
      setUserOrders([]);
      return;
    }

    const fetchUserOrders = async () => {
      const supabase = getSupabaseClient();
      if (!supabase) return;

      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .eq('user_address', address.toLowerCase())
          .eq('base_token', baseToken.address.toLowerCase())
          .eq('is_active', true)
          .eq('is_cancelled', false)
          .order('created_at', { ascending: false });

        if (error) throw error;

        const orders: UserOrder[] = (data || []).map((o: any) => ({
          orderHash: o.order_hash || o.tx_hash,
          side: o.side,
          price: o.price,
          amount: o.base_amount,
          total: o.quote_amount,
          filled: parseFloat(o.amount_filled) || 0,
          filledPercent: o.base_amount > 0 ? (parseFloat(o.amount_filled) / o.base_amount) * 100 : 0,
          expires: o.expires,
          nonce: o.nonce,
          tokenGet: o.token_get,
          amountGet: o.amount_get,
          tokenGive: o.token_give,
          amountGive: o.amount_give,
          v: o.v,
          r: o.r,
          s: o.s,
        }));

        setUserOrders(orders);
      } catch (err) {
        console.error('Error fetching user orders:', err);
      }
    };

    fetchUserOrders();
  }, [address, baseToken.address, buyOrders, sellOrders]);

  // Fetch user's trades
  useEffect(() => {
    if (!address) {
      setUserTrades([]);
      return;
    }

    const fetchUserTrades = async () => {
      const supabase = getSupabaseClient();
      if (!supabase) return;

      try {
        const { data, error } = await supabase
          .from('trades')
          .select('*')
          .eq('base_token', baseToken.address.toLowerCase())
          .or(`maker.eq.${address.toLowerCase()},taker.eq.${address.toLowerCase()}`)
          .order('block_number', { ascending: false })
          .limit(50);

        if (error) throw error;

        const trades: UserTrade[] = (data || []).map((t: any) => ({
          txHash: t.tx_hash,
          timestamp: t.block_timestamp ? new Date(t.block_timestamp).getTime() / 1000 : Date.now() / 1000,
          side: t.side,
          price: t.price,
          amount: t.base_amount,
          total: t.quote_amount,
          isMaker: t.maker.toLowerCase() === address.toLowerCase(),
        }));

        setUserTrades(trades);
      } catch (err) {
        console.error('Error fetching user trades:', err);
      }
    };

    fetchUserTrades();
  }, [address, baseToken.address]);

  // Cancel order
  const handleCancelOrder = async (order: UserOrder) => {
    if (!walletClient || !order.v || !order.r || !order.s) {
      setCancellingOrder(order.orderHash);
      try {
        await cancelOrderByHash(order.orderHash);
        setUserOrders(prev => prev.filter(o => o.orderHash !== order.orderHash));
      } catch (err) {
        console.error('Error cancelling order:', err);
      } finally {
        setCancellingOrder(null);
      }
      return;
    }

    setCancellingOrder(order.orderHash);
    try {
      const provider = new ethers.BrowserProvider(walletClient as any);
      const signer = await provider.getSigner();

      const tx = await cancelOrderOnChain(signer, {
        tokenGet: order.tokenGet,
        amountGet: order.amountGet,
        tokenGive: order.tokenGive,
        amountGive: order.amountGive,
        expires: order.expires,
        nonce: order.nonce,
        user: address!,
        v: order.v,
        r: order.r,
        s: order.s,
        hash: order.orderHash,
      });

      await tx.wait();
      await cancelOrderByHash(order.orderHash);
      setUserOrders(prev => prev.filter(o => o.orderHash !== order.orderHash));
    } catch (err) {
      console.error('Error cancelling order:', err);
    } finally {
      setCancellingOrder(null);
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'orders', label: 'Orders', icon: <FileText className="w-3 h-3" /> },
    { id: 'trades', label: 'Trades', icon: <History className="w-3 h-3" /> },
    { id: 'funds', label: 'Funds', icon: <Wallet className="w-3 h-3" /> },
  ];

  if (!isConnected) {
    return (
      <div className="card">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <History className="w-4 h-4 text-afrodex-orange" />
          My Transactions
        </h3>
        <div className="text-center py-6 text-gray-500 text-sm">
          Connect wallet to view your transactions
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <History className="w-4 h-4 text-afrodex-orange" />
        My Transactions
      </h3>

      <div className="flex gap-1 mb-3 p-1 bg-afrodex-black-lighter rounded-lg">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-1.5 px-2 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1 ${
              activeTab === tab.id
                ? 'bg-afrodex-orange text-white'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div>
        {/* Orders Tab */}
        {activeTab === 'orders' && (
          <>
            {userOrders.length > 0 && (
              <div className="mb-2 p-2 bg-yellow-900/20 border border-yellow-600/30 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-yellow-400">
                    <AlertCircle className="w-3 h-3" />
                    <span>If trades fail, clear old orders and recreate</span>
                  </div>
                  <button
                    onClick={async () => {
                      if (confirm('Delete all your orders? You will need to recreate them.')) {
                        const supabase = getSupabaseClient();
                        if (supabase && address) {
                          await supabase
                            .from('orders')
                            .delete()
                            .eq('user_address', address.toLowerCase());
                          setUserOrders([]);
                        }
                      }
                    }}
                    className="text-xs px-2 py-1 bg-yellow-600/30 hover:bg-yellow-600/50 rounded text-yellow-400 transition-colors"
                  >
                    Clear All
                  </button>
                </div>
              </div>
            )}
            {userOrders.length === 0 ? (
              <div className="text-center py-6 text-gray-500 text-xs">No open orders</div>
            ) : (
              <div className="space-y-2">
                {userOrders.map((order) => (
                  <div key={order.orderHash} className="p-2 bg-afrodex-black-lighter rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-semibold ${order.side === 'buy' ? 'text-trade-buy' : 'text-trade-sell'}`}>
                        {order.side.toUpperCase()} {baseToken.symbol}
                      </span>
                      <button
                        onClick={() => handleCancelOrder(order)}
                        disabled={cancellingOrder === order.orderHash}
                        className="p-1 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
                        title="Cancel order"
                      >
                        {cancellingOrder === order.orderHash ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-gray-500">Price:</span>
                        <span className="ml-1 font-mono">{formatPrice15(order.price)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Amount:</span>
                        <span className="ml-1 font-mono">{formatAmount15(order.amount)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Total:</span>
                        <span className="ml-1 font-mono">{formatPrice15(order.total)} ETH</span>
                      </div>
                    </div>
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-[10px] text-gray-500 mb-0.5">
                        <span>Filled</span>
                        <span>{order.filledPercent.toFixed(1)}%</span>
                      </div>
                      <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
                        <div className={`h-full ${order.side === 'buy' ? 'bg-trade-buy' : 'bg-trade-sell'}`} style={{ width: `${order.filledPercent}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Trades Tab */}
        {activeTab === 'trades' && (
          <>
            {userTrades.length === 0 ? (
              <div className="text-center py-6 text-gray-500 text-xs">No trade history</div>
            ) : (
              <div className="space-y-1">
                {userTrades.map((trade, i) => (
                  <div key={`${trade.txHash}-${i}`} className="flex items-center justify-between p-2 bg-afrodex-black-lighter rounded text-xs">
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold ${trade.side === 'buy' ? 'text-trade-buy' : 'text-trade-sell'}`}>
                        {trade.side.toUpperCase()}
                      </span>
                      <span className="text-gray-500">{formatTime(trade.timestamp)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono">{formatAmount15(trade.amount)} {baseToken.symbol}</span>
                      <span className="text-gray-500">@</span>
                      <span className="font-mono">{formatPrice15(trade.price)}</span>
                      <a href={`https://etherscan.io/tx/${trade.txHash}`} target="_blank" rel="noopener noreferrer"
                        className="text-afrodex-orange hover:text-afrodex-orange-light">
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Funds Tab */}
        {activeTab === 'funds' && (
          <div className="text-center py-6 text-gray-500 text-xs">
            Fund movements will appear here
          </div>
        )}
      </div>
    </div>
  );
}
