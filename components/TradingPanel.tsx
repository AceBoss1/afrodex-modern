// components/TradingPanel.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAccount, useWalletClient, usePublicClient } from 'wagmi';
import { ethers } from 'ethers';
import { useTradingStore, useUIStore } from '@/lib/store';
import { 
  parseAmount, 
  formatAmount, 
  formatDisplayAmount,
  formatDisplayPrice,
  getExpirationBlock, 
  generateNonce, 
  createSignedOrder,
  preTradeCheck,
  executeTrade,
  SignedOrder,
} from '@/lib/exchange';
import { Token, ZERO_ADDRESS } from '@/lib/tokens';
import { saveSignedOrder, deactivateOrderByHash, saveTradeAfterExecution } from '@/lib/supabase';
import { ArrowDownUp, Loader2, TrendingUp, TrendingDown } from 'lucide-react';

interface TradingPanelProps {
  baseToken: Token;
  quoteToken: Token;
}

export default function TradingPanel({ baseToken, quoteToken }: TradingPanelProps) {
  const { selectedPrice, orderTab, setOrderTab, setSelectedPrice } = useUIStore();
  const { buyOrders, sellOrders, addOrder, removeOrder, setOrders, addTrade } = useTradingStore();
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const [price, setPrice] = useState('');
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Update price when selected from order book
  useEffect(() => {
    if (selectedPrice) {
      setPrice(selectedPrice);
    }
  }, [selectedPrice]);

  // Calculate total
  const total = useMemo(() => {
    const p = parseFloat(price) || 0;
    const a = parseFloat(amount) || 0;
    return p * a;
  }, [price, amount]);

  // Get best prices from order book
  const bestPrices = useMemo(() => {
    const bestAsk = sellOrders.length > 0 
      ? Math.min(...sellOrders.map(o => o.price || Infinity))
      : null;
    const bestBid = buyOrders.length > 0
      ? Math.max(...buyOrders.map(o => o.price || 0))
      : null;
    return { bestAsk, bestBid };
  }, [buyOrders, sellOrders]);

  const handleSubmit = async () => {
    if (!isConnected || !walletClient || !publicClient) {
      setError('Please connect your wallet');
      return;
    }

    const priceNum = parseFloat(price);
    const amountNum = parseFloat(amount);

    if (isNaN(priceNum) || priceNum <= 0) {
      setError('Please enter a valid price');
      return;
    }

    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    // Calculate order value in ETH
    const orderValue = priceNum * amountNum;
    
    // FIXED: Only check minimum if orderValue is actually 0 or negative
    // Very small values like 0.0001 ETH are valid
    if (orderValue <= 0) {
      setError('Order value must be greater than 0');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const provider = new ethers.BrowserProvider(walletClient as any);
      const signer = await provider.getSigner();

      // For BUY orders: tokenGet = base token (what we want), tokenGive = ETH (what we pay)
      // For SELL orders: tokenGet = ETH (what we want), tokenGive = base token (what we pay)
      const isBuy = orderTab === 'buy';

      const baseAmountWei = parseAmount(amountNum.toString(), baseToken.decimals);
      const quoteAmountWei = parseAmount(orderValue.toString(), quoteToken.decimals);

      // Validate parsed amounts
      if (baseAmountWei === '0' || quoteAmountWei === '0') {
        setError('Amount too small to process');
        setIsSubmitting(false);
        return;
      }

      const tokenGet = isBuy ? baseToken.address : ZERO_ADDRESS;
      const amountGet = isBuy ? baseAmountWei : quoteAmountWei;
      const tokenGive = isBuy ? ZERO_ADDRESS : baseToken.address;
      const amountGive = isBuy ? quoteAmountWei : baseAmountWei;

      console.log('Creating order:', {
        side: orderTab,
        tokenGet,
        amountGet,
        tokenGive,
        amountGive,
        price: priceNum,
        amount: amountNum,
        total: orderValue,
      });

      // Check if there's a matching order to execute immediately
      const matchingOrders = isBuy 
        ? sellOrders.filter(o => (o.price || 0) <= priceNum && o.v && o.r && o.s)
        : buyOrders.filter(o => (o.price || 0) >= priceNum && o.v && o.r && o.s);

      if (matchingOrders.length > 0) {
        // Execute against best matching order
        const bestMatch = isBuy
          ? matchingOrders.reduce((best, o) => (o.price || 0) < (best.price || 0) ? o : best)
          : matchingOrders.reduce((best, o) => (o.price || 0) > (best.price || 0) ? o : best);

        // Can't trade against your own order
        if (bestMatch.user?.toLowerCase() === address?.toLowerCase()) {
          // Place as new order instead
        } else {
          console.log('Found matching order, executing trade...');
          
          const signedOrder: SignedOrder = {
            tokenGet: bestMatch.tokenGet,
            amountGet: bestMatch.amountGet,
            tokenGive: bestMatch.tokenGive,
            amountGive: bestMatch.amountGive,
            expires: bestMatch.expires,
            nonce: bestMatch.nonce,
            user: bestMatch.user,
            v: Number(bestMatch.v),
            r: bestMatch.r!,
            s: bestMatch.s!,
            hash: bestMatch.hash || '',
          };

          // Use the order's amountGet for the trade
          const tradeAmount = bestMatch.amountGet;

          const preCheck = await preTradeCheck(provider, signedOrder, tradeAmount, address!);
          
          if (preCheck.canTrade) {
            const tx = await executeTrade(signer, signedOrder, tradeAmount);
            const receipt = await tx.wait();
            
            // Deactivate the matched order
            if (bestMatch.hash) {
              await deactivateOrderByHash(bestMatch.hash);
            }
            
            // Remove from local state
            const updatedBuyOrders = buyOrders.filter(o => o.hash !== bestMatch.hash);
            const updatedSellOrders = sellOrders.filter(o => o.hash !== bestMatch.hash);
            setOrders(updatedBuyOrders, updatedSellOrders);
            
            // Record trade
            await saveTradeAfterExecution({
              txHash: tx.hash,
              tokenGet: bestMatch.tokenGet,
              amountGet: bestMatch.amountGet,
              tokenGive: bestMatch.tokenGive,
              amountGive: bestMatch.amountGive,
              maker: bestMatch.user,
              taker: address!,
              blockNumber: receipt?.blockNumber || 0,
              blockTimestamp: new Date().toISOString(),
              baseToken: baseToken.address,
              quoteToken: quoteToken.address,
              side: isBuy ? 'buy' : 'sell',
              price: bestMatch.price || priceNum,
              baseAmount: amountNum,
              quoteAmount: orderValue,
            });
            
            // Add to local trades
            addTrade({
              txHash: tx.hash,
              blockNumber: receipt?.blockNumber || 0,
              timestamp: Math.floor(Date.now() / 1000),
              tokenGet: bestMatch.tokenGet,
              amountGet: bestMatch.amountGet,
              tokenGive: bestMatch.tokenGive,
              amountGive: bestMatch.amountGive,
              maker: bestMatch.user,
              taker: address!,
              price: bestMatch.price || priceNum,
              side: isBuy ? 'buy' : 'sell',
              baseAmount: amountNum,
              quoteAmount: orderValue,
            });
            
            setSuccess(`Trade executed! TX: ${tx.hash.slice(0, 10)}...`);
            setPrice('');
            setAmount('');
            setSelectedPrice('');
            setIsSubmitting(false);
            setTimeout(() => setSuccess(null), 5000);
            return;
          } else {
            console.log('Pre-trade check failed:', preCheck.reason);
            // Fall through to create new order
          }
        }
      }

      // Create a new order (off-chain, gasless)
      const expires = await getExpirationBlock(provider, 100000);
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

      // Save to Supabase
      const result = await saveSignedOrder({
        token_get: signedOrder.tokenGet,
        amount_get: signedOrder.amountGet,
        token_give: signedOrder.tokenGive,
        amount_give: signedOrder.amountGive,
        expires: signedOrder.expires,
        nonce: signedOrder.nonce,
        user_address: signedOrder.user,
        base_token: baseToken.address,
        quote_token: quoteToken.address,
        side: orderTab,
        price: priceNum,
        base_amount: amountNum,
        quote_amount: orderValue,
        order_hash: signedOrder.hash,
        v: signedOrder.v,
        r: signedOrder.r,
        s: signedOrder.s,
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to save order');
      }

      // Add to local state
      addOrder({
        tokenGet: signedOrder.tokenGet,
        amountGet: signedOrder.amountGet,
        tokenGive: signedOrder.tokenGive,
        amountGive: signedOrder.amountGive,
        expires: signedOrder.expires,
        nonce: signedOrder.nonce,
        user: signedOrder.user,
        side: orderTab,
        price: priceNum,
        v: signedOrder.v,
        r: signedOrder.r,
        s: signedOrder.s,
        hash: signedOrder.hash,
      });

      setSuccess('Order placed successfully!');
      setPrice('');
      setAmount('');
      setSelectedPrice('');
      setTimeout(() => setSuccess(null), 5000);

    } catch (err: any) {
      console.error('Order error:', err);
      if (err.code === 'ACTION_REJECTED') {
        setError('Transaction rejected by user');
      } else {
        setError(err.reason || err.message || 'Failed to place order');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetBestPrice = (type: 'bid' | 'ask') => {
    if (type === 'bid' && bestPrices.bestBid) {
      setPrice(formatDisplayPrice(bestPrices.bestBid));
    } else if (type === 'ask' && bestPrices.bestAsk) {
      setPrice(formatDisplayPrice(bestPrices.bestAsk));
    }
  };

  return (
    <div className="card">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <ArrowDownUp className="w-4 h-4 text-afrodex-orange" />
        Place Order
      </h3>

      {/* Buy/Sell Tabs */}
      <div className="flex gap-1 mb-4 p-1 bg-afrodex-black-lighter rounded-lg">
        <button
          onClick={() => setOrderTab('buy')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-1 ${
            orderTab === 'buy'
              ? 'bg-trade-buy text-white'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Buy
        </button>
        <button
          onClick={() => setOrderTab('sell')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-1 ${
            orderTab === 'sell'
              ? 'bg-trade-sell text-white'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <TrendingDown className="w-4 h-4" />
          Sell
        </button>
      </div>

      {/* Price Input */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Price ({quoteToken.symbol})</span>
          <div className="flex gap-2">
            {bestPrices.bestBid && (
              <button
                onClick={() => handleSetBestPrice('bid')}
                className="text-trade-buy hover:underline"
              >
                Bid: {formatDisplayPrice(bestPrices.bestBid)}
              </button>
            )}
            {bestPrices.bestAsk && (
              <button
                onClick={() => handleSetBestPrice('ask')}
                className="text-trade-sell hover:underline"
              >
                Ask: {formatDisplayPrice(bestPrices.bestAsk)}
              </button>
            )}
          </div>
        </div>
        <input
          type="text"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="0.0"
          className="input-field w-full font-mono"
        />
      </div>

      {/* Amount Input */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Amount ({baseToken.symbol})</span>
        </div>
        <input
          type="text"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.0"
          className="input-field w-full font-mono"
        />
      </div>

      {/* Total */}
      <div className="mb-4 p-3 bg-afrodex-black-lighter rounded-lg">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Total</span>
          <span className="font-mono text-white">
            {formatDisplayAmount(total)} {quoteToken.symbol}
          </span>
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="mb-3 p-2 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-xs">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-3 p-2 bg-green-500/10 border border-green-500/20 rounded text-green-400 text-xs">
          {success}
        </div>
      )}

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={!isConnected || isSubmitting || !price || !amount}
        className={`w-full py-3 rounded-lg font-semibold text-white transition-all flex items-center justify-center gap-2 ${
          orderTab === 'buy'
            ? 'bg-trade-buy hover:bg-trade-buy/80 disabled:bg-trade-buy/30'
            : 'bg-trade-sell hover:bg-trade-sell/80 disabled:bg-trade-sell/30'
        } disabled:cursor-not-allowed`}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Processing...
          </>
        ) : !isConnected ? (
          'Connect Wallet'
        ) : (
          `${orderTab === 'buy' ? 'Buy' : 'Sell'} ${baseToken.symbol}`
        )}
      </button>

      {/* Info */}
      <p className="text-[10px] text-gray-600 mt-2 text-center">
        Orders are signed off-chain (gasless) and stored for matching
      </p>
    </div>
  );
}
