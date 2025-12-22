// components/MyTransactions.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { ethers, Contract } from 'ethers';
import { History, FileText, Wallet, X, Loader2, ExternalLink, AlertCircle, Trash2, ArrowDownLeft, ArrowUpRight, RefreshCw } from 'lucide-react';
import { Token, ZERO_ADDRESS } from '@/lib/tokens';
import { EXCHANGE_ADDRESS, formatAmount, cancelOrder as cancelOrderOnChain } from '@/lib/exchange';
import { EXCHANGE_ABI } from '@/lib/abi';
import { useTradingStore } from '@/lib/store';
import { cancelOrderByHash, getSupabaseClient, deactivateOrderByHash } from '@/lib/supabase';

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

interface FundMovement {
  type: 'deposit' | 'withdraw';
  txHash: string;
  timestamp: number;
  token: string;
  tokenSymbol: string;
  amount: number;
  blockNumber: number;
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

// Known tokens for symbol lookup
const TOKEN_SYMBOLS: Record<string, { symbol: string; decimals: number }> = {
  '0x0000000000000000000000000000000000000000': { symbol: 'ETH', decimals: 18 },
  '0x08130635368aa28b217a4dfb68e1bf8dc525621c': { symbol: 'AfroX', decimals: 4 },
  '0x203f8c9ee75cb6d6e6ce4cf6027b3eb39e92736e': { symbol: 'AFDLT', decimals: 18 },
  '0x1ab43204a195a0fd37edec621482afd3792ef90b': { symbol: 'FARM', decimals: 18 },
  '0xdd1ad9a21ce722c151a836373babe42c868ce9a4': { symbol: 'FREE', decimals: 18 },
  '0x8ca6841d30ba69afbffb5fbccd8e4f5c30e21ee4': { symbol: 'PLAAS', decimals: 18 },
};

export default function MyTransactions({ baseToken, quoteToken }: MyTransactionsProps) {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { buyOrders, sellOrders, setOrders } = useTradingStore();

  const [activeTab, setActiveTab] = useState<Tab>('orders');
  const [userOrders, setUserOrders] = useState<UserOrder[]>([]);
  const [userTrades, setUserTrades] = useState<UserTrade[]>([]);
  const [fundMovements, setFundMovements] = useState<FundMovement[]>([]);
  const [loading, setLoading] = useState(false);
  const [fundsLoading, setFundsLoading] = useState(false);
  const [cancellingOrder, setCancellingOrder] = useState<string | null>(null);
  const [clearingAll, setClearingAll] = useState(false);

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

  // Fetch fund movements (deposits and withdrawals)
  const fetchFundMovements = useCallback(async () => {
    if (!address || !publicClient) {
      setFundMovements([]);
      return;
    }

    setFundsLoading(true);

    try {
      const provider = new ethers.BrowserProvider(publicClient as any);
      const contract = new Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, provider);

      // Get current block
      const currentBlock = await provider.getBlockNumber();
      // Look back ~30 days of blocks (assuming ~12 second blocks)
      const fromBlock = Math.max(0, currentBlock - 216000);

      console.log('Fetching fund movements from block', fromBlock, 'to', currentBlock);

      // Fetch Deposit events for both ETH and tokens
      // Deposit(address indexed token, address indexed user, uint256 amount, uint256 balance)
      const depositFilter = contract.filters.Deposit(null, address);
      const depositEvents = await contract.queryFilter(depositFilter, fromBlock, currentBlock);

      // Fetch Withdraw events for both ETH and tokens
      // Withdraw(address indexed token, address indexed user, uint256 amount, uint256 balance)
      const withdrawFilter = contract.filters.Withdraw(null, address);
      const withdrawEvents = await contract.queryFilter(withdrawFilter, fromBlock, currentBlock);

      console.log('Found', depositEvents.length, 'deposits and', withdrawEvents.length, 'withdrawals');

      // Process deposit events
      const deposits: FundMovement[] = await Promise.all(
        depositEvents.map(async (event: any) => {
          const block = await event.getBlock();
          const tokenAddr = event.args[0].toLowerCase();
          const tokenInfo = TOKEN_SYMBOLS[tokenAddr] || { symbol: 'TOKEN', decimals: 18 };
          
          return {
            type: 'deposit' as const,
            txHash: event.transactionHash,
            timestamp: block?.timestamp || Math.floor(Date.now() / 1000),
            token: tokenAddr,
            tokenSymbol: tokenAddr === ZERO_ADDRESS.toLowerCase() ? 'ETH' : tokenInfo.symbol,
            amount: Number(ethers.formatUnits(event.args[2], tokenInfo.decimals)),
            blockNumber: event.blockNumber,
          };
        })
      );

      // Process withdraw events
      const withdrawals: FundMovement[] = await Promise.all(
        withdrawEvents.map(async (event: any) => {
          const block = await event.getBlock();
          const tokenAddr = event.args[0].toLowerCase();
          const tokenInfo = TOKEN_SYMBOLS[tokenAddr] || { symbol: 'TOKEN', decimals: 18 };
          
          return {
            type: 'withdraw' as const,
            txHash: event.transactionHash,
            timestamp: block?.timestamp || Math.floor(Date.now() / 1000),
            token: tokenAddr,
            tokenSymbol: tokenAddr === ZERO_ADDRESS.toLowerCase() ? 'ETH' : tokenInfo.symbol,
            amount: Number(ethers.formatUnits(event.args[2], tokenInfo.decimals)),
            blockNumber: event.blockNumber,
          };
        })
      );

      // Combine and sort by block number (newest first)
      const allMovements = [...deposits, ...withdrawals].sort((a, b) => b.blockNumber - a.blockNumber);
      
      console.log('Total fund movements:', allMovements.length);
      setFundMovements(allMovements);
    } catch (err) {
      console.error('Error fetching fund movements:', err);
      setFundMovements([]);
    } finally {
      setFundsLoading(false);
    }
  }, [address, publicClient]);

  // Fetch funds when tab changes to funds
  useEffect(() => {
    if (activeTab === 'funds' && address) {
      fetchFundMovements();
    }
  }, [activeTab, address, fetchFundMovements]);

  // Clear ALL orders for user
  const handleClearAll = async () => {
    if (!address) return;
    
    const confirmed = confirm('Delete ALL your orders? You will need to recreate them.');
    if (!confirmed) return;
    
    setClearingAll(true);
    
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        alert('Database not configured');
        return;
      }

      // Delete all user's orders from Supabase
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('user_address', address.toLowerCase())
        .eq('is_active', true);

      if (error) {
        console.error('Error clearing orders:', error);
        alert(`Failed to clear orders: ${error.message}`);
        return;
      }

      // Clear local state
      setUserOrders([]);
      
      // Also update the store to remove user's orders from order book
      const updatedBuyOrders = buyOrders.filter(o => 
        o.user?.toLowerCase() !== address.toLowerCase()
      );
      const updatedSellOrders = sellOrders.filter(o => 
        o.user?.toLowerCase() !== address.toLowerCase()
      );
      setOrders(updatedBuyOrders, updatedSellOrders);
      
      alert('All orders cleared successfully!');
    } catch (err: any) {
      console.error('Error clearing all orders:', err);
      alert(`Failed to clear orders: ${err.message}`);
    } finally {
      setClearingAll(false);
    }
  };

  // Cancel single order
  const handleCancelOrder = async (order: UserOrder) => {
    if (!walletClient || !order.v || !order.r || !order.s) {
      // Off-chain cancel only (no on-chain cancel needed for off-chain orders)
      setCancellingOrder(order.orderHash);
      try {
        const supabase = getSupabaseClient();
        if (supabase) {
          await supabase
            .from('orders')
            .update({ is_cancelled: true, is_active: false })
            .eq('order_hash', order.orderHash);
        }
        setUserOrders(prev => prev.filter(o => o.orderHash !== order.orderHash));
        
        // Update store
        const updatedBuyOrders = buyOrders.filter(o => o.hash !== order.orderHash);
        const updatedSellOrders = sellOrders.filter(o => o.hash !== order.orderHash);
        setOrders(updatedBuyOrders, updatedSellOrders);
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
      
      // Update store
      const updatedBuyOrders = buyOrders.filter(o => o.hash !== order.orderHash);
      const updatedSellOrders = sellOrders.filter(o => o.hash !== order.orderHash);
      setOrders(updatedBuyOrders, updatedSellOrders);
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
                    onClick={handleClearAll}
                    disabled={clearingAll}
                    className="text-xs px-2 py-1 bg-yellow-600/30 hover:bg-yellow-600/50 rounded text-yellow-400 transition-colors flex items-center gap-1 disabled:opacity-50"
                  >
                    {clearingAll ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Clearing...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-3 h-3" />
                        Clear All
                      </>
                    )}
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
          <>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500">Recent deposits & withdrawals</span>
              <button
                onClick={fetchFundMovements}
                disabled={fundsLoading}
                className="p-1 hover:bg-white/10 rounded transition-colors"
                title="Refresh"
              >
                <RefreshCw className={`w-3 h-3 text-gray-400 ${fundsLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {fundsLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-afrodex-orange" />
              </div>
            ) : fundMovements.length === 0 ? (
              <div className="text-center py-6 text-gray-500 text-xs">
                No deposits or withdrawals found
              </div>
            ) : (
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {fundMovements.map((movement, i) => (
                  <div 
                    key={`${movement.txHash}-${i}`} 
                    className="flex items-center justify-between p-2 bg-afrodex-black-lighter rounded text-xs"
                  >
                    <div className="flex items-center gap-2">
                      {movement.type === 'deposit' ? (
                        <ArrowDownLeft className="w-4 h-4 text-trade-buy" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4 text-trade-sell" />
                      )}
                      <div>
                        <span className={`font-semibold ${movement.type === 'deposit' ? 'text-trade-buy' : 'text-trade-sell'}`}>
                          {movement.type === 'deposit' ? 'Deposit' : 'Withdraw'}
                        </span>
                        <span className="text-gray-500 ml-2">{formatTime(movement.timestamp)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono">
                        {movement.type === 'deposit' ? '+' : '-'}
                        {formatAmount15(movement.amount)} {movement.tokenSymbol}
                      </span>
                      <a 
                        href={`https://etherscan.io/tx/${movement.txHash}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-afrodex-orange hover:text-afrodex-orange-light"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
