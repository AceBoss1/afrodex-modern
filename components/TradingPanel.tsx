// components/TradingPanel.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { ethers } from 'ethers';
import { Token, ZERO_ADDRESS } from '@/lib/tokens';
import { 
  createSignedOrder, 
  parseAmount, 
  formatAmount,
  formatDisplayAmount,
  formatDisplayPrice,
  formatFullBalance,
  generateNonce,
  getExpirationBlock,
  executeTrade,
  preTradeCheck,
  SignedOrder,
} from '@/lib/exchange';
import { saveSignedOrder, isSupabaseConfigured, cancelOrderByHash } from '@/lib/supabase';
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
  const { balances, trades, buyOrders, sellOrders } = useTradingStore();
  const { orderTab, setOrderTab, selectedPrice, setSelectedPrice } = useUIStore();

  const [price, setPrice] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Auto-fill price from order book selection
  useEffect(() => {
    if (selectedPrice) {
      setPrice(selectedPrice);
      setSelectedPrice(null);
    }
  }, [selectedPrice, setSelectedPrice]);

  // Auto-fill with last trade price
  useEffect(() => {
    if (!price && trades.length > 0) {
      setPrice(trades[0].price.toFixed(8));
    }
  }, [trades, price]);

  // Get balances
  const baseBalance = balances[baseToken.address.toLowerCase()];
  const quoteBalance = balances[quoteToken.address.toLowerCase()];

  // Calculate total with proper precision for very small numbers
  const calculateTotal = (): string => {
    if (!price || !amount) return '0';
    const priceNum = parseFloat(price);
    const amountNum = parseFloat(amount);
    if (isNaN(priceNum) || isNaN(amountNum)) return '0';
    
    // Use high precision calculation
    const result = priceNum * amountNum;
    // Convert to string without scientific notation
    if (result === 0) return '0';
    if (result < 0.000000000000000001) return '0';
    
    // Format to 18 decimal places max (ETH precision)
    return result.toFixed(18).replace(/\.?0+$/, '');
  };
  
  const totalStr = calculateTotal();
  const totalNum = parseFloat(totalStr) || 0;
  const totalDisplay = formatDisplayPrice(totalNum);

  // Get available balance based on order type
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
  
  // Get available balance string for display (preserves precision)
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

  // Format available balance for display
  const availableDisplay = formatDisplayAmount(getAvailableBalanceStr());

  // Set percentage of available balance
  const setPercentage = (percent: number) => {
    const available = getAvailableBalance();
    if (available <= 0) return;

    if (orderTab === 'buy') {
      // Calculate amount based on available ETH and price
      const priceNum = parseFloat(price) || trades[0]?.price || 0;
      if (priceNum > 0) {
        const maxAmount = (available * percent) / priceNum;
        setAmount(maxAmount.toFixed(6));
      }
    } else {
      // Set amount directly
      setAmount((available * percent).toFixed(6));
    }
  };

  // Find matching orders at a given price
  const findMatchingOrders = (targetPrice: number, isBuyOrder: boolean) => {
    // If placing a buy order, look for sell orders at or below the price
    // If placing a sell order, look for buy orders at or above the price
    const counterOrders = isBuyOrder ? sellOrders : buyOrders;
    
    console.log(`Finding matching orders: ${isBuyOrder ? 'BUY' : 'SELL'} at price ${targetPrice}`);
    console.log(`Counter orders count: ${counterOrders.length}`);
    
    const matched = counterOrders.filter(order => {
      const hasSignature = !!(order.v && order.r && order.s);
      const isOwnOrder = order.user?.toLowerCase() === address?.toLowerCase();
      const orderPrice = order.price || 0;
      const priceMatch = isBuyOrder 
        ? orderPrice <= targetPrice 
        : orderPrice >= targetPrice;
      
      console.log(`Order: price=${orderPrice}, hasSignature=${hasSignature}, isOwnOrder=${isOwnOrder}, priceMatch=${priceMatch}`);
      
      if (!hasSignature) return false;
      if (isOwnOrder) return false;
      return priceMatch;
    }).sort((a, b) => {
      // Sort by best price first
      if (isBuyOrder) {
        return (a.price || 0) - (b.price || 0); // Lowest price first for buys
      } else {
        return (b.price || 0) - (a.price || 0); // Highest price first for sells
      }
    });
    
    console.log(`Matched orders: ${matched.length}`);
    return matched;
  };

  // Handle placing order with smart matching
  const handlePlaceOrder = async () => {
    if (!walletClient || !price || !amount) return;

    const priceNum = parseFloat(price);
    const amountNum = parseFloat(amount);

    if (priceNum <= 0 || amountNum <= 0) {
      setError('Price and amount must be greater than 0');
      return;
    }

    // Check if Supabase is configured
    if (!isSupabaseConfigured()) {
      setError('Order book not configured. Please set up Supabase.');
      return;
    }

    // Check balance
    const available = getAvailableBalance();
    const required = orderTab === 'buy' ? totalNum : amountNum;
    
    if (required > available) {
      setError(`Insufficient ${orderTab === 'buy' ? quoteToken.symbol : baseToken.symbol} balance. You need to deposit first.`);
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const provider = new ethers.BrowserProvider(walletClient as any);
      const signer = await provider.getSigner();

      // Find matching counter-orders
      const matchingOrders = findMatchingOrders(priceNum, orderTab === 'buy');
      let remainingAmount = amountNum;
      let executedTrades = 0;
      let skippedOrders: string[] = [];

      // Execute against matching orders first
      for (const order of matchingOrders) {
        if (remainingAmount <= 0) break;

        const orderAmountAvailable = parseFloat(
          formatAmount(
            order.availableVolume || (orderTab === 'buy' ? order.amountGive : order.amountGet),
            orderTab === 'buy' ? baseToken.decimals : baseToken.decimals
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

          // Calculate the wei amount to trade
          const amountInWei = parseAmount(amountToTake.toString(), baseToken.decimals);
          
          // Pre-check before executing
          const preCheck = await preTradeCheck(provider, signedOrder, amountInWei, address!);
          if (!preCheck.canTrade) {
            console.log(`Skipping order: ${preCheck.reason}`);
            skippedOrders.push(preCheck.reason || 'Unknown');
            continue;
          }
          
          console.log(`Executing trade: ${amountToTake} @ ${order.price}`, signedOrder);
          const tx = await executeTrade(signer, signedOrder, amountInWei);
          await tx.wait();
          
          remainingAmount -= amountToTake;
          executedTrades++;
          console.log(`Trade executed. Remaining: ${remainingAmount}`);
        } catch (err: any) {
          console.error('Error executing trade against order:', err);
          skippedOrders.push(err.reason || err.message || 'Trade failed');
          // Continue to next order
        }
      }

      // If there's remaining amount, place a new order
      if (remainingAmount > 0.0001) { // Dust threshold
        const remainingTotal = remainingAmount * priceNum;
        
        // Calculate amounts in wei for remaining order
        const amountBase = parseAmount(remainingAmount.toString(), baseToken.decimals);
        const amountQuote = parseAmount(remainingTotal.toString(), quoteToken.decimals);
        
        const tokenGet = orderTab === 'buy' ? baseToken.address : quoteToken.address;
        const amountGet = orderTab === 'buy' ? amountBase : amountQuote;
        const tokenGive = orderTab === 'buy' ? quoteToken.address : baseToken.address;
        const amountGive = orderTab === 'buy' ? amountQuote : amountBase;

        const expires = await getExpirationBlock(provider, 10000);
        const nonce = generateNonce();

        console.log('Signing remaining order off-chain...');
        const signedOrder = await createSignedOrder(
          signer,
          tokenGet,
          amountGet,
          tokenGive,
          amountGive,
          expires,
          nonce
        );

        // Save to Supabase
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
          let msg = `Executed ${executedTrades} trade(s), placed order for ${remainingAmount.toFixed(4)} ${baseToken.symbol}`;
          if (skippedOrders.length > 0) {
            msg += ` (${skippedOrders.length} orders skipped)`;
          }
          setSuccess(msg);
        } else if (skippedOrders.length > 0) {
          // No trades executed, show why
          setError(`Could not execute trades: ${skippedOrders[0]}`);
          setSuccess(`Order placed (gasless) - matching orders unavailable`);
        } else {
          setSuccess(`${orderTab === 'buy' ? 'Buy' : 'Sell'} order placed! (Gasless)`);
        }
      } else {
        let msg = `Executed ${executedTrades} trade(s) - order fully filled!`;
        if (skippedOrders.length > 0) {
          msg += ` (${skippedOrders.length} orders skipped)`;
        }
        setSuccess(msg);
      }

      // Clear form
      setPrice('');
      setAmount('');
      setTimeout(() => setSuccess(null), 5000);
      
    } catch (err: any) {
      console.error('Error placing order:', err);
      if (err.code === 'ACTION_REJECTED' || err.message?.includes('rejected')) {
        setError('Transaction rejected. Please try again.');
      } else {
        setError(err.message || 'Failed to place order. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const isBuy = orderTab === 'buy';

  // Check if there are matching orders
  const matchingOrdersCount = price ? findMatchingOrders(parseFloat(price) || 0, isBuy).length : 0;

  return (
    <div className="card flex flex-col">
      {/* Header */}
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <ArrowDownUp className="w-4 h-4 text-afrodex-orange" />
        Place Order
      </h3>

      {/* Buy/Sell Toggle */}
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

      {/* Price Input */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs text-gray-500">
            Price ({quoteToken.symbol})
          </label>
          <span className="text-xs text-gray-500">
            Avail: <span className="text-white">{availableDisplay}</span> {orderTab === 'buy' ? quoteToken.symbol : baseToken.symbol}
          </span>
        </div>
        <input
          type="number"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="0.00000000"
          className="input font-mono"
          step="any"
          min="0"
        />
      </div>

      {/* Amount Input */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs text-gray-500">
            Amount ({baseToken.symbol})
          </label>
          <span className="text-xs text-gray-500">
            Total in:<span className="text-afrodex-orange font-mono ml-1">{totalDisplay}</span> {quoteToken.symbol}
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
        
      {/* Percentage Buttons */}
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

      {/* Matching Orders Indicator */}
      {matchingOrdersCount > 0 && (
        <div className="flex items-center gap-2 p-2 bg-afrodex-orange/10 border border-afrodex-orange/20 rounded-lg mb-3 text-xs text-afrodex-orange">
          <Zap className="w-3 h-3" />
          <span>{matchingOrdersCount} matching order(s) will be executed first</span>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="flex items-start gap-2 p-2 bg-red-500/10 border border-red-500/20 rounded-lg mb-3 text-xs text-red-400">
          <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="flex items-start gap-2 p-2 bg-green-500/10 border border-green-500/20 rounded-lg mb-3 text-xs text-green-400">
          <CheckCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      {/* Action Button */}
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
