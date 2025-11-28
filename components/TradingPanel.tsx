// components/TradingPanel.tsx
'use client';

import { useState } from 'react';
import { useWalletClient } from 'wagmi';
import { Token } from '@/lib/tokens';
import { placeOrder, parseAmount } from '@/lib/exchange';
import { ethers } from 'ethers';

interface TradingPanelProps {
  baseToken: Token;
  quoteToken: Token;
}

export default function TradingPanel({ baseToken, quoteToken }: TradingPanelProps) {
  const { data: walletClient } = useWalletClient();
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [price, setPrice] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePlaceOrder = async () => {
    if (!walletClient || !price || !amount) return;

    setLoading(true);
    try {
      const provider = new ethers.BrowserProvider(walletClient as any);
      const signer = await provider.getSigner();

      // Calculate amounts
      const amountBase = parseAmount(amount, baseToken.decimals);
      const total = parseFloat(amount) * parseFloat(price);
      const amountQuote = parseAmount(total.toString(), quoteToken.decimals);

      // Determine order parameters based on side
      const tokenGet = side === 'buy' ? baseToken.address : quoteToken.address;
      const amountGet = side === 'buy' ? amountBase : amountQuote;
      const tokenGive = side === 'buy' ? quoteToken.address : baseToken.address;
      const amountGive = side === 'buy' ? amountQuote : amountBase;

      // Set expiration to 10000 blocks (~1.5 days)
      const currentBlock = await provider.getBlockNumber();
      const expires = (currentBlock + 10000).toString();

      // Generate random nonce
      const nonce = Math.floor(Math.random() * 1000000000).toString();

      // Place order
      const tx = await placeOrder(
        signer,
        tokenGet,
        amountGet,
        tokenGive,
        amountGive,
        expires,
        nonce
      );

      await tx.wait();

      // Clear form
      setPrice('');
      setAmount('');
      alert('Order placed successfully!');
    } catch (error) {
      console.error('Error placing order:', error);
      alert('Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  const total = price && amount ? (parseFloat(price) * parseFloat(amount)).toFixed(6) : '0.000000';

  return (
    <div className="card h-full flex flex-col">
      <h3 className="text-lg font-semibold mb-3 neon-text">Place Order</h3>

      {/* Buy/Sell Toggle */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setSide('buy')}
          className={`flex-1 py-2 rounded font-semibold ${
            side === 'buy'
              ? 'bg-green-600 text-white'
              : 'bg-afrodex-black-lighter text-gray-400 hover:bg-gray-700'
          }`}
        >
          Buy {baseToken.symbol}
        </button>
        <button
          onClick={() => setSide('sell')}
          className={`flex-1 py-2 rounded font-semibold ${
            side === 'sell'
              ? 'bg-red-600 text-white'
              : 'bg-afrodex-black-lighter text-gray-400 hover:bg-gray-700'
          }`}
        >
          Sell {baseToken.symbol}
        </button>
      </div>

      {/* Price Input */}
      <div className="mb-4">
        <label className="block text-sm text-gray-400 mb-2">
          Price ({quoteToken.symbol})
        </label>
        <input
          type="number"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="0.0"
          className="w-full"
          step="any"
        />
      </div>

      {/* Amount Input */}
      <div className="mb-4">
        <label className="block text-sm text-gray-400 mb-2">
          Amount ({baseToken.symbol})
        </label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.0"
          className="w-full"
          step="any"
        />
      </div>

      {/* Total Display */}
      <div className="mb-4 p-3 bg-afrodex-black-lighter rounded">
        <div className="flex justify-between">
          <span className="text-gray-400 text-sm">Total</span>
          <span className="font-semibold">
            {total} {quoteToken.symbol}
          </span>
        </div>
      </div>

      {/* Order Summary */}
      <div className="mb-4 p-3 bg-afrodex-black-lighter rounded text-xs text-gray-400">
        <p className="mb-1">
          {side === 'buy' ? 'You will receive' : 'You will pay'}: {amount || '0'} {baseToken.symbol}
        </p>
        <p>
          {side === 'buy' ? 'You will pay' : 'You will receive'}: {total} {quoteToken.symbol}
        </p>
      </div>

      {/* Action Button */}
      <div className="flex-1"></div>
      <button
        onClick={handlePlaceOrder}
        disabled={loading || !price || !amount || parseFloat(price) <= 0 || parseFloat(amount) <= 0}
        className={`w-full py-3 rounded font-semibold disabled:opacity-50 disabled:cursor-not-allowed ${
          side === 'buy' ? 'btn-buy' : 'btn-sell'
        }`}
      >
        {loading ? 'Placing Order...' : `${side === 'buy' ? 'Buy' : 'Sell'} ${baseToken.symbol}`}
      </button>

      {/* Disclaimer */}
      <p className="mt-3 text-xs text-gray-500 text-center">
        Make sure you have deposited funds to the exchange before placing orders
      </p>
    </div>
  );
}
