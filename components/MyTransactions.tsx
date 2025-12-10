// components/MyTransactions.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { ethers, Contract } from 'ethers';
import { 
  History, 
  FileText, 
  Wallet,
  X,
  Loader2,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';
import { Token, ZERO_ADDRESS } from '@/lib/tokens';
import { EXCHANGE_ADDRESS, formatAmount, formatDisplayAmount, cancelOrder as cancelOrderOnChain } from '@/lib/exchange';
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

interface FundMovement {
  txHash: string;
  timestamp: number;
  type: 'deposit' | 'withdraw';
  token: string;
  amount: number;
  balance: number;
}

type Tab = 'trades' | 'orders' | 'funds';

export default function MyTransactions({ baseToken, quoteToken }: MyTransactionsProps) {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { buyOrders, sellOrders } = useTradingStore();

  const [activeTab, setActiveTab] = useState<Tab>('orders');
  const [userOrders, setUserOrders] = useState<UserOrder[]>([]);
  const [userTrades, setUserTrades] = useState<UserTrade[]>([]);
  const [fundMovements, setFundMovements] = useState<FundMovement[]>([]);
  const [loading, setLoading] = useState(false);
  const [cancellingOrder, setCancellingOrder] = useState<string | null>(null);

  // Fetch user's orders from the orderbook
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
          filledPercent: o.base_amount > 0 
            ? (parseFloat(o.amount_filled) / o.base_amount) * 100 
            : 0,
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

  // Fetch fund movements (deposits/withdrawals)
  useEffect(() => {
    if (!address || !publicClient) {
      setFundMovements([]);
      return;
    }

    const fetchFundMovements = async () => {
      setLoading(true);
      try {
        const provider = new ethers.BrowserProvider(publicClient as any);
        const contract = new Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, provider);
        
        const currentBlock = await provider.getBlockNumber();
        const fromBlock = Math.max(0, currentBlock - 50000);

        // Fetch Deposit events
        const depositFilter = contract.filters.Deposit(baseToken.address, address);
        const depositEvents = await contract.queryFilter(depositFilter, fromBlock, 'latest');

        // Fetch Withdraw events  
        const withdrawFilter = contract.filters.Withdraw(baseToken.address, address);
        const withdrawEvents = await contract.queryFilter(withdrawFilter, fromBlock, 'latest');

        const movements: FundMovement[] = [];

        for (const event of depositEvents) {
          const log = event as any;
          if (log.args) {
            const block = await provider.getBlock(event.blockNumber);
            movements.push({
              txHash: event.transactionHash,
              timestamp: block?.timestamp ? Number(block.timestamp) : Date.now() / 1000,
              type: 'deposit',
              token: baseToken.symbol,
              amount: parseFloat(formatAmount(log.args[2].toString(), baseToken.decimals)),
              balance: parseFloat(formatAmount(log.args[3].toString(), baseToken.decimals)),
            });
          }
        }

        for (const event of withdrawEvents) {
          const log = event as any;
          if (log.args) {
            const block = await provider.getBlock(event.blockNumber);
            movements.push({
              txHash: event.transactionHash,
              timestamp: block?.timestamp ? Number(block.timestamp) : Date.now() / 1000,
              type: 'withdraw',
              token: baseToken.symbol,
              amount: parseFloat(formatAmount(log.args[2].toString(), baseToken.decimals)),
              balance: parseFloat(formatAmount(log.args[3].toString(), baseToken.decimals)),
            });
          }
        }

        // Sort by timestamp descending
        movements.sort((a, b) => b.timestamp - a.timestamp);
        setFundMovements(movements);
      } catch (err) {
        console.error('Error fetching fund movements:', err);
      } finally {
        setLoading(false);
      }
    };

    if (activeTab === 'funds') {
      fetchFundMovements();
    }
  }, [address, baseToken, publicClient, activeTab]);

  // Cancel order
  const handleCancelOrder = async (order: UserOrder) => {
    if (!walletClient || !order.v || !order.r || !order.s) {
      // Off-chain cancel only (no signature on-chain)
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

      // Cancel on-chain
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
      });

      await tx.wait();

      // Also cancel in Supabase
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
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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

      {/* Tabs */}
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

      {/* Content */}
      <div className="max-h-48 overflow-y-auto">
        {/* Orders Tab */}
        {activeTab === 'orders' && (
          <>
            {userOrders.length === 0 ? (
              <div className="text-center py-6 text-gray-500 text-xs">
                No open orders
              </div>
            ) : (
              <div className="space-y-2">
                {userOrders.map((order) => (
                  <div
                    key={order.orderHash}
                    className="p-2 bg-afrodex-black-lighter rounded-lg"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-semibold ${
                        order.side === 'buy' ? 'text-trade-buy' : 'text-trade-sell'
                      }`}>
                        {order.side.toUpperCase()} {baseToken.symbol}
                      </span>
                      <button
                        onClick={() => handleCancelOrder(order)}
                        disabled={cancellingOrder === order.orderHash}
                        className="p-1 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
                        title="Cancel order"
                      >
                        {cancellingOrder === order.orderHash ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <X className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-gray-500">Price:</span>
                        <span className="ml-1 font-mono">{order.price.toFixed(12)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Amount:</span>
                        <span className="ml-1 font-mono">{formatDisplayAmount(order.amount)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Total:</span>
                        <span className="ml-1 font-mono">{order.total.toFixed(6)} ETH</span>
                      </div>
                    </div>
                    {/* Fill meter */}
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-[10px] text-gray-500 mb-0.5">
                        <span>Filled</span>
                        <span>{order.filledPercent.toFixed(1)}%</span>
                      </div>
                      <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${order.side === 'buy' ? 'bg-trade-buy' : 'bg-trade-sell'}`}
                          style={{ width: `${order.filledPercent}%` }}
                        />
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
              <div className="text-center py-6 text-gray-500 text-xs">
                No trade history
              </div>
            ) : (
              <div className="space-y-1">
                {userTrades.map((trade, i) => (
                  <div
                    key={`${trade.txHash}-${i}`}
                    className="flex items-center justify-between p-2 bg-afrodex-black-lighter rounded text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold ${
                        trade.side === 'buy' ? 'text-trade-buy' : 'text-trade-sell'
                      }`}>
                        {trade.side.toUpperCase()}
                      </span>
                      <span className="text-gray-500">{formatTime(trade.timestamp)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono">{formatDisplayAmount(trade.amount)} {baseToken.symbol}</span>
                      <span className="text-gray-500">@</span>
                      <span className="font-mono">{trade.price.toFixed(10)}</span>
                      <a
                        href={`https://etherscan.io/tx/${trade.txHash}`}
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

        {/* Funds Tab */}
        {activeTab === 'funds' && (
          <>
            {loading ? (
              <div className="text-center py-6">
                <Loader2 className="w-5 h-5 animate-spin mx-auto text-afrodex-orange" />
              </div>
            ) : fundMovements.length === 0 ? (
              <div className="text-center py-6 text-gray-500 text-xs">
                No deposit/withdraw history
              </div>
            ) : (
              <div className="space-y-1">
                {fundMovements.map((movement, i) => (
                  <div
                    key={`${movement.txHash}-${i}`}
                    className="flex items-center justify-between p-2 bg-afrodex-black-lighter rounded text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold ${
                        movement.type === 'deposit' ? 'text-trade-buy' : 'text-trade-sell'
                      }`}>
                        {movement.type.toUpperCase()}
                      </span>
                      <span className="text-gray-500">{formatTime(movement.timestamp)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono">{formatDisplayAmount(movement.amount)} {movement.token}</span>
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
