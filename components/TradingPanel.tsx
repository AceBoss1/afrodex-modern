// components/TradingPanel.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { ethers } from 'ethers';
import { Token } from '@/lib/tokens';
import { 
  placeOrder, 
  parseAmount, 
  formatAmount,
  generateNonce,
  getExpirationBlock,
  ZERO_ADDRESS,
} from '@/lib/exchange';
import { useTradingStore, useUIStore } from '@/lib/store';
import { ArrowDownUp, AlertCircle, Loader2 } from 'lucide-react';

interface TradingPanelProps {
  baseToken: Token;
  quoteToken: Token;
}

export default function TradingPanel({ baseToken, quoteToken }: TradingPanelProps) {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { balances, trades } = useTradingStore();
  const { orderTab, setOrderTab, selectedPrice, setSelectedPrice } = useUIStore();

  const [price, setPrice] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Calculate total
  const total = price && amount 
    ? (parseFloat(price) * parseFloat(amount)).toFixed(8)
    : '0.00000000';

  // Get available balance based on order type
  const getAvailableBalance = () => {
    if (orderTab === 'buy') {
      // Buying base token, need quote token (ETH)
      return quoteBalance?.exchange 
        ? parseFloat(formatAmount(quoteBalance.exchange, quoteToken.decimals))
        : 0;
    } else {
      // Selling base token, need base token
      return baseBalance?.exchange 
        ? parseFloat(formatAmount(baseBalance.exchange, baseToken.decimals))
        : 0;
    }
  };

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

  // Handle placing order
  const handlePlaceOrder = async () => {
    if (!walletClient || !price || !amount) return;

    const priceNum = parseFloat(price);
    const amountNum = parseFloat(amount);

    if (priceNum <= 0 || amountNum <= 0) {
      setError('Price and amount must be greater than 0');
      return;
    }

    // Check balance
    const available = getAvailableBalance();
    const required = orderTab === 'buy' ? priceNum * amountNum : amountNum;
    
    if (required > available) {
      setError(`Insufficient ${orderTab === 'buy' ? quoteToken.symbol : baseToken.symbol} balance. You need to deposit first.`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create provider and signer
      const provider = new ethers.BrowserProvider(walletClient as any);
      const signer = await provider.getSigner();

      // Calculate amounts in wei
      const amountBase = parseAmount(amount, baseToken.decimals);
      const amountQuote = parseAmount(total, quoteToken.decimals);

      // Determine order parameters based on side
      // Buy order: want base token, give quote token (ETH)
      // Sell order: want quote token (ETH), give base token
      const tokenGet = orderTab === 'buy' ? baseToken.address : quoteToken.address;
      const amountGet = orderTab === 'buy' ? amountBase : amountQuote;
      const tokenGive = orderTab === 'buy' ? quoteToken.address : baseToken.address;
      const amountGive = orderTab === 'buy' ? amountQuote : amountBase;

      // Get expiration (10000 blocks ≈ 1.5 days)
      const expires = await getExpirationBlock(provider, 10000);
      const nonce = generateNonce();

      // Place order on-chain
      const tx = await placeOrder(
        signer,
        tokenGet,
        amountGet,
        tokenGive,
        amountGive,
        expires,
        nonce
      );

      // Wait for confirmation
      await tx.wait();

      // Clear form
      setPrice('');
      setAmount('');
      
      // Show success (you could use a toast notification here)
      alert(`${orderTab === 'buy' ? 'Buy' : 'Sell'} order placed successfully!`);
    } catch (err: any) {
      console.error('Error placing order:', err);
      setError(err.message || 'Failed to place order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isBuy = orderTab === 'buy';

  return (
    <div className="card h-full flex flex-col">
      {/* Header */}
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <ArrowDownUp className="w-4 h-4 text-afrodex-orange" />
        Place Order
      </h3>

      {/* Buy/Sell Toggle */}
      <div className="tabs mb-4">
        <button
          onClick={() => setOrderTab('buy')}
          className={`tab ${orderTab === 'buy' ? 'tab-active !bg-trade-buy' : ''}`}
        >
          Buy
        </button>
        <button
          onClick={() => setOrderTab('sell')}
          className={`tab ${orderTab === 'sell' ? 'tab-active !bg-trade-sell' : ''}`}
        >
          Sell
        </button>
      </div>

      {/* Price Input */}
      <div className="mb-3">
        <label className="block text-xs text-gray-500 mb-1.5">
          Price ({quoteToken.symbol})
        </label>
        <input
          type="number"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="0.00000000"
          className="input font-mono text-sm"
          step="any"
          min="0"
        />
      </div>

      {/* Amount Input */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs text-gray-500">
            Amount ({baseToken.symbol})
          </label>
          <span className="text-xs text-gray-500">
            Avail: {getAvailableBalance().toFixed(4)} {isBuy ? quoteToken.symbol : baseToken.symbol}
          </span>
        </div>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.0000"
          className="input font-mono text-sm"
          step="any"
          min="0"
        />
        
        {/* Percentage Buttons */}
        <div className="flex gap-1 mt-2">
          {[0.25, 0.5, 0.75, 1].map((pct) => (
            <button
              key={pct}
              onClick={() => setPercentage(pct)}
              className="flex-1 py-1 text-xs bg-white/5 hover:bg-white/10 rounded transition-colors"
            >
              {pct * 100}%
            </button>
          ))}
        </div>
      </div>

      {/* Total */}
      <div className="p-3 bg-afrodex-black-lighter rounded-lg mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Total</span>
          <span className="font-mono font-medium">
            {total} {quoteToken.symbol}
          </span>
        </div>
      </div>

      {/* Order Summary */}
      <div className="p-3 bg-afrodex-black-lighter/50 rounded-lg mb-4 text-xs text-gray-500">
        <p className="mb-1">
          {isBuy ? 'You will receive' : 'You will pay'}: {amount || '0'} {baseToken.symbol}
        </p>
        <p>
          {isBuy ? 'You will pay' : 'You will receive'}: {total} {quoteToken.symbol}
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg mb-4 text-xs text-red-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Action Button */}
      {!isConnected ? (
        <button className="btn-secondary w-full" disabled>
          Connect Wallet to Trade
        </button>
      ) : (
        <button
          onClick={handlePlaceOrder}
          disabled={loading || !price || !amount || parseFloat(price) <= 0 || parseFloat(amount) <= 0}
          className={`w-full py-3 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
            isBuy ? 'btn-buy' : 'btn-sell'
          }`}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Placing Order...
            </span>
          ) : (
            `${isBuy ? 'Buy' : 'Sell'} ${baseToken.symbol}`
          )}
        </button>
      )}

      {/* Disclaimer */}
      <p className="mt-3 text-[10px] text-gray-600 text-center">
        Ensure you have deposited funds to the exchange before placing orders
      </p>
    </div>
  );
}
