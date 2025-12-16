// components/TradingPanel.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { ethers } from 'ethers';
import { Token, ZERO_ADDRESS } from '@/lib/tokens';
import { 
  createSignedOrder, 
  parseAmount, 
  formatAmount,
  formatDisplayAmount,
  formatDisplayPrice,
  generateNonce,
  getExpirationBlock,
  executeTrade,
  preTradeCheck,
  SignedOrder,
} from '@/lib/exchange';
import { 
  saveSignedOrder, 
  isSupabaseConfigured, 
  deactivateOrderByHash,
  deactivateOrderByNonceAndUser,
  saveTradeAfterExecution,
} from '@/lib/supabase';
import { useTradingStore, useUIStore } from '@/lib/store';
import { ArrowDownUp, AlertCircle, Loader2, CheckCircle, Zap } from 'lucide-react';

interface TradingPanelProps {
  baseToken: Token;
  quoteToken: Token;
}

export default function TradingPanel({ baseToken, quoteToken }: TradingPanelProps) {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { balances, trades, buyOrders, sellOrders, setOrders, removeOrder, addTrade } = useTradingStore();
  const { orderTab, setOrderTab, selectedPrice, setSelectedPrice } = useUIStore();

  const [price, setPrice] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (selectedPrice) {
      setPrice(selectedPrice);
      setSelectedPrice(null);
    }
  }, [selectedPrice, setSelectedPrice]);

  useEffect(() => {
    if (!price && trades.length > 0) {
      setPrice(trades[0].price.toFixed(15));
    }
  }, [trades, price]);

  const baseBalance = balances[baseToken.address.toLowerCase()];
  const quoteBalance = balances[quoteToken.address.toLowerCase()];

  const calculateTotal = (): string => {
    if (!price || !amount) return '0';
    const priceNum = parseFloat(price);
    const amountNum = parseFloat(amount);
    if (isNaN(priceNum) || isNaN(amountNum)) return '0';
    const result = priceNum * amountNum;
    if (result === 0) return '0';
    return result.toFixed(18).replace(/\.?0+$/, '');
  };
  
  const totalStr = calculateTotal();
  const totalNum = parseFloat(totalStr) || 0;
  const totalDisplay = formatDisplayPrice(totalNum);

  const getAvailableBalance = () => {
    if (orderTab === 'buy') {
      return quoteBalance?.exchange 
        ? parseFloat(formatAmount(quoteBalance.exchange, quoteToken.decimals))
        : 0;
    } else {
      return baseBalance?.exchange 
        ? parseFloat(formatAmount(baseBalance.exchange, baseToken.decimals))
        : 0;
    }
  };
  
  const getAvailableBalanceStr = () => {
    if (orderTab === 'buy') {
      return quoteBalance?.exchange 
        ? formatAmount(quoteBalance.exchange, quoteToken.decimals)
        : '0';
    } else {
      return baseBalance?.exchange 
        ? formatAmount(baseBalance.exchange, baseToken.decimals)
        : '0';
    }
  };

  const availableDisplay = formatDisplayAmount(getAvailableBalanceStr());

  const setPercentage = (percent: number) => {
    const available = getAvailableBalance();
    if (available <= 0) return;

    if (orderTab === 'buy') {
      const priceNum = parseFloat(price) || trades[0]?.price || 0;
      if (priceNum > 0) {
        const maxAmount = (available * percent) / priceNum;
        setAmount(maxAmount.toFixed(6));
      }
    } else {
      setAmount((available * percent).toFixed(6));
    }
  };

  const findMatchingOrders = (targetPrice: number, isBuyOrder: boolean) => {
    const counterOrders = isBuyOrder ? sellOrders : buyOrders;
    
    const matched = counterOrders.filter(order => {
      const hasSignature = !!(order.v && order.r && order.s);
      const isOwnOrder = order.user?.toLowerCase() === address?.toLowerCase();
      const orderPrice = order.price || 0;
      const priceMatch = isBuyOrder 
        ? orderPrice <= targetPrice 
        : orderPrice >= targetPrice;
      
      if (!hasSignature) return false;
      if (isOwnOrder) return false;
      return priceMatch;
    }).sort((a, b) => {
      if (isBuyOrder) {
        return (a.price || 0) - (b.price || 0);
      } else {
        return (b.price || 0) - (a.price || 0);
      }
    });
    
    return matched;
  };

  const handlePlaceOrder = async () => {
    if (!walletClient || !price || !amount) return;

    const priceNum = parseFloat(price);
    const amountNum = parseFloat(amount);

    if (priceNum <= 0 || amountNum <= 0) {
      setError('Price and amount must be greater than 0');
      return;
    }

    if (!isSupabaseConfigured()) {
      setError('Order book not configured. Please set up Supabase.');
      return;
    }

    const available = getAvailableBalance();
    const required = orderTab === 'buy' ? totalNum : amountNum;
    
    if (required > available) {
      setError(`Insufficient ${orderTab === 'buy' ? quoteToken.symbol : baseToken.symbol} balance. Deposit first.`);
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const provider = new ethers.BrowserProvider(walletClient as any);
      const signer = await provider.getSigner();

      const matchingOrders = findMatchingOrders(priceNum, orderTab === 'buy');
      let remainingAmount = amountNum;
      let executedTrades = 0;
      let skippedOrders: string[] = [];

      for (const order of matchingOrders) {
        if (remainingAmount <= 0) break;

        const orderAmountAvailable = parseFloat(
          formatAmount(
            order.availableVolume || (orderTab === 'buy' ? order.amountGive : order.amountGet),
            baseToken.decimals
          )
        );

        const amountToTake = Math.min(remainingAmount, orderAmountAvailable);
        if (amountToTake <= 0) continue;

        try {
          const signedOrder: SignedOrder = {
            tokenGet: order.tokenGet,
            amountGet: order.amountGet,
            tokenGive: order.tokenGive,
            amountGive: order.amountGive,
            expires: order.expires,
            nonce: order.nonce,
            user: order.user,
            v: Number(order.v),
            r: order.r!,
            s: order.s!,
            hash: order.hash || '',
          };

          const amountInWei = parseAmount(amountToTake.toString(), baseToken.decimals);
          
          const preCheck = await preTradeCheck(provider, signedOrder, amountInWei, address!);
          if (!preCheck.canTrade) {
            skippedOrders.push(preCheck.reason || 'Unknown');
            continue;
          }
          
          const tx = await executeTrade(signer, signedOrder, amountInWei);
          const receipt = await tx.wait();
          
          // Deactivate order in Supabase
          if (order.hash) {
            await deactivateOrderByHash(order.hash);
          } else if (order.nonce && order.user) {
            await deactivateOrderByNonceAndUser(order.nonce, order.user);
          }
          
          if (order.hash) {
            removeOrder(order.hash);
          }
          
          const tradeBaseAmount = amountToTake;
          const tradeQuoteAmount = amountToTake * (order.price || priceNum);
          
          // Record the trade in Supabase
          await saveTradeAfterExecution({
            txHash: tx.hash,
            tokenGet: order.tokenGet,
            amountGet: order.amountGet,
            tokenGive: order.tokenGive,
            amountGive: order.amountGive,
            maker: order.user,
            taker: address!,
            blockNumber: receipt?.blockNumber || 0,
            blockTimestamp: new Date().toISOString(),
            baseToken: baseToken.address,
            quoteToken: quoteToken.address,
            side: orderTab,
            price: order.price || priceNum,
            baseAmount: tradeBaseAmount,
            quoteAmount: tradeQuoteAmount,
          });
          
          addTrade({
            txHash: tx.hash,
            blockNumber: receipt?.blockNumber || 0,
            timestamp: Math.floor(Date.now() / 1000),
            tokenGet: order.tokenGet,
            amountGet: order.amountGet,
            tokenGive: order.tokenGive,
            amountGive: order.amountGive,
            maker: order.user,
            taker: address!,
            price: order.price || priceNum,
            side: orderTab,
            baseAmount: tradeBaseAmount,
            quoteAmount: tradeQuoteAmount,
          });
          
          remainingAmount -= amountToTake;
          executedTrades++;
        } catch (err: any) {
          console.error('Error executing trade:', err);
          skippedOrders.push(err.reason || err.message || 'Trade failed');
        }
      }

      // Refresh order list
      if (executedTrades > 0) {
        const executedOrderNonces = matchingOrders.slice(0, executedTrades).map(o => o.nonce);
        const updatedBuyOrders = buyOrders.filter(o => !executedOrderNonces.includes(o.nonce));
        const updatedSellOrders = sellOrders.filter(o => !executedOrderNonces.includes(o.nonce));
        setOrders(updatedBuyOrders, updatedSellOrders);
      }

      // Place remaining as new order
      if (remainingAmount > 0.0001) {
        const remainingTotal = remainingAmount * priceNum;
        const amountBase = parseAmount(remainingAmount.toString(), baseToken.decimals);
        const amountQuote = parseAmount(remainingTotal.toString(), quoteToken.decimals);
        
        const tokenGet = orderTab === 'buy' ? baseToken.address : quoteToken.address;
        const amountGet = orderTab === 'buy' ? amountBase : amountQuote;
        const tokenGive = orderTab === 'buy' ? quoteToken.address : baseToken.address;
        const amountGive = orderTab === 'buy' ? amountQuote : amountBase;

        if (amountGet === '0' || amountGive === '0') {
          setError(`Invalid order: amounts cannot be 0. Try a higher price or amount.`);
          setLoading(false);
          return;
        }

        const expires = await getExpirationBlock(provider, 10000);
        const nonce = generateNonce();

        const signedOrder = await createSignedOrder(
          signer,
          tokenGet,
          amountGet,
          tokenGive,
          amountGive,
          expires,
          nonce
        );

        await saveSignedOrder({
          token_get: tokenGet,
          amount_get: amountGet,
          token_give: tokenGive,
          amount_give: amountGive,
          expires,
          nonce,
          user_address: signedOrder.user,
          base_token: baseToken.address,
          quote_token: quoteToken.address,
          side: orderTab,
          price: priceNum,
          base_amount: remainingAmount,
          quote_amount: remainingTotal,
          order_hash: signedOrder.hash!,
          v: signedOrder.v!,
          r: signedOrder.r!,
          s: signedOrder.s!,
        });

        if (executedTrades > 0) {
          setSuccess(`Executed ${executedTrades} trade(s), placed order for ${remainingAmount.toFixed(4)} ${baseToken.symbol}`);
        } else {
          setSuccess(`${orderTab === 'buy' ? 'Buy' : 'Sell'} order placed! (Gasless)`);
        }
      } else {
        setSuccess(`Executed ${executedTrades} trade(s) - order fully filled!`);
      }

      setPrice('');
      setAmount('');
      setTimeout(() => setSuccess(null), 5000);
      
    } catch (err: any) {
      console.error('Error placing order:', err);
      setError(err.message || 'Failed to place order.');
    } finally {
      setLoading(false);
    }
  };

  const isBuy = orderTab === 'buy';
  const matchingOrdersCount = price ? findMatchingOrders(parseFloat(price) || 0, isBuy).length : 0;

  return (
    <div className="card flex flex-col">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <ArrowDownUp className="w-4 h-4 text-afrodex-orange" />
        Place Order
      </h3>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setOrderTab('buy')}
          className={`flex-1 py-2.5 rounded-lg font-medium text-sm transition-all ${
            orderTab === 'buy' 
              ? 'bg-trade-buy text-black' 
              : 'bg-transparent text-gray-400 hover:text-white'
          }`}
        >
          Buy
        </button>
        <button
          onClick={() => setOrderTab('sell')}
          className={`flex-1 py-2.5 rounded-lg font-medium text-sm transition-all ${
            orderTab === 'sell' 
              ? 'bg-trade-sell text-white' 
              : 'bg-transparent text-gray-400 hover:text-white'
          }`}
        >
          Sell
        </button>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs text-gray-500">Price ({quoteToken.symbol})</label>
          <span className="text-xs text-gray-500">
            Avail: <span className="text-white">{availableDisplay}</span> {orderTab === 'buy' ? quoteToken.symbol : baseToken.symbol}
          </span>
        </div>
        <input
          type="number"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="0.000000000000000"
          className="input font-mono"
          step="any"
          min="0"
        />
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs text-gray-500">Amount ({baseToken.symbol})</label>
          <span className="text-xs text-gray-500">
            Total:<span className="text-afrodex-orange font-mono ml-1">{totalDisplay}</span> {quoteToken.symbol}
          </span>
        </div>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.0000"
          className="input font-mono"
          step="any"
          min="0"
        />
      </div>
        
      <div className="flex gap-2 mb-4">
        {[0.25, 0.5, 0.75, 1].map((pct) => (
          <button
            key={pct}
            onClick={() => setPercentage(pct)}
            className="flex-1 py-1.5 text-xs text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
          >
            {pct * 100}%
          </button>
        ))}
      </div>

      {matchingOrdersCount > 0 && (
        <div className="flex items-center gap-2 p-2 bg-afrodex-orange/10 border border-afrodex-orange/20 rounded-lg mb-3 text-xs text-afrodex-orange">
          <Zap className="w-3 h-3" />
          <span>{matchingOrdersCount} matching order(s) will be executed first</span>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 p-2 bg-red-500/10 border border-red-500/20 rounded-lg mb-3 text-xs text-red-400">
          <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-2 p-2 bg-green-500/10 border border-green-500/20 rounded-lg mb-3 text-xs text-green-400">
          <CheckCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      {!isConnected ? (
        <button className="w-full py-3 rounded-lg font-semibold text-sm bg-gray-700 text-gray-400" disabled>
          Connect Wallet
        </button>
      ) : (
        <button
          onClick={handlePlaceOrder}
          disabled={loading || !price || !amount || parseFloat(price) <= 0 || parseFloat(amount) <= 0}
          className={`w-full py-3 rounded-lg font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
            isBuy 
              ? 'bg-trade-buy/90 hover:bg-trade-buy text-black' 
              : 'bg-trade-sell/90 hover:bg-trade-sell text-white'
          }`}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              {matchingOrdersCount > 0 ? 'Executing...' : 'Placing...'}
            </span>
          ) : (
            `${isBuy ? 'Buy' : 'Sell'} ${baseToken.symbol}`
          )}
        </button>
      )}
    </div>
  );
}
