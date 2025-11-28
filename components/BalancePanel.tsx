// components/BalancePanel.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { useAppStore } from '@/lib/store';
import { Token } from '@/lib/tokens';
import {
  getWalletBalance,
  getExchangeBalance,
  formatAmount,
  parseAmount,
  depositEth,
  withdrawEth,
  depositToken,
  withdrawToken,
  approveToken,
  checkAllowance,
  ZERO_ADDRESS,
} from '@/lib/exchange';
import { Wallet, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight } from 'lucide-react';
import { ethers } from 'ethers';

interface BalancePanelProps {
  baseToken: Token;
  quoteToken: Token;
}

export default function BalancePanel({ baseToken, quoteToken }: BalancePanelProps) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { activeTab, setActiveTab, balances, setBalance } = useAppStore();

  const [selectedToken, setSelectedToken] = useState<Token>(baseToken);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [needsApproval, setNeedsApproval] = useState(false);

  // Fetch balances
  useEffect(() => {
    if (!address || !publicClient) return;

    const fetchBalances = async () => {
      try {
        const [baseWallet, baseExchange, quoteWallet, quoteExchange] = await Promise.all([
          getWalletBalance(publicClient as any, baseToken.address, address),
          getExchangeBalance(publicClient as any, baseToken.address, address),
          getWalletBalance(publicClient as any, quoteToken.address, address),
          getExchangeBalance(publicClient as any, quoteToken.address, address),
        ]);

        setBalance(baseToken.address, baseWallet, baseExchange);
        setBalance(quoteToken.address, quoteWallet, quoteExchange);
      } catch (error) {
        console.error('Error fetching balances:', error);
      }
    };

    fetchBalances();
    const interval = setInterval(fetchBalances, 10000); // Refresh every 10s

    return () => clearInterval(interval);
  }, [address, publicClient, baseToken, quoteToken, setBalance]);

  // Check approval for deposits
  useEffect(() => {
    if (!address || !publicClient || selectedToken.address === ZERO_ADDRESS || activeTab !== 'deposit') {
      setNeedsApproval(false);
      return;
    }

    const checkApproval = async () => {
      try {
        if (!amount || parseFloat(amount) <= 0) {
          setNeedsApproval(false);
          return;
        }

        const allowance = await checkAllowance(publicClient as any, selectedToken.address, address);
        const requiredAmount = parseAmount(amount, selectedToken.decimals);
        setNeedsApproval(BigInt(allowance) < BigInt(requiredAmount));
      } catch (error) {
        console.error('Error checking allowance:', error);
      }
    };

    checkApproval();
  }, [address, publicClient, selectedToken, amount, activeTab]);

  const handleApprove = async () => {
    if (!walletClient || !amount) return;

    setLoading(true);
    try {
      const signer = await getSigner(walletClient);
      const amountToApprove = parseAmount(amount, selectedToken.decimals);
      const tx = await approveToken(signer, selectedToken.address, amountToApprove);
      await tx.wait();
      setNeedsApproval(false);
    } catch (error) {
      console.error('Error approving token:', error);
      alert('Failed to approve token');
    } finally {
      setLoading(false);
    }
  };

  const handleDeposit = async () => {
    if (!walletClient || !amount) return;

    setLoading(true);
    try {
      const signer = await getSigner(walletClient);
      const amountWei = parseAmount(amount, selectedToken.decimals);

      let tx;
      if (selectedToken.address === ZERO_ADDRESS) {
        tx = await depositEth(signer, amountWei);
      } else {
        tx = await depositToken(signer, selectedToken.address, amountWei);
      }

      await tx.wait();
      setAmount('');
      alert('Deposit successful!');
    } catch (error) {
      console.error('Error depositing:', error);
      alert('Failed to deposit');
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!walletClient || !amount) return;

    setLoading(true);
    try {
      const signer = await getSigner(walletClient);
      const amountWei = parseAmount(amount, selectedToken.decimals);

      let tx;
      if (selectedToken.address === ZERO_ADDRESS) {
        tx = await withdrawEth(signer, amountWei);
      } else {
        tx = await withdrawToken(signer, selectedToken.address, amountWei);
      }

      await tx.wait();
      setAmount('');
      alert('Withdrawal successful!');
    } catch (error) {
      console.error('Error withdrawing:', error);
      alert('Failed to withdraw');
    } finally {
      setLoading(false);
    }
  };

  const getSigner = async (walletClient: any) => {
    const provider = new ethers.BrowserProvider(walletClient);
    return await provider.getSigner();
  };

  const balance = balances[selectedToken.address] || { wallet: '0', exchange: '0' };
  const walletBalance = formatAmount(balance.wallet, selectedToken.decimals);
  const exchangeBalance = formatAmount(balance.exchange, selectedToken.decimals);

  return (
    <div className="card h-full flex flex-col">
      <h3 className="text-lg font-semibold mb-3 neon-text">Balances</h3>

      {/* Token Selector */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setSelectedToken(baseToken)}
          className={`flex-1 py-2 px-3 rounded ${
            selectedToken.address === baseToken.address
              ? 'bg-afrodex-orange text-white'
              : 'bg-afrodex-black-lighter text-gray-400 hover:bg-gray-700'
          }`}
        >
          {baseToken.symbol}
        </button>
        <button
          onClick={() => setSelectedToken(quoteToken)}
          className={`flex-1 py-2 px-3 rounded ${
            selectedToken.address === quoteToken.address
              ? 'bg-afrodex-orange text-white'
              : 'bg-afrodex-black-lighter text-gray-400 hover:bg-gray-700'
          }`}
        >
          {quoteToken.symbol}
        </button>
      </div>

      {/* Balance Display */}
      <div className="mb-4 p-3 bg-afrodex-black-lighter rounded">
        <div className="flex justify-between mb-2">
          <span className="text-gray-400 text-sm flex items-center gap-1">
            <Wallet className="w-4 h-4" /> Wallet
          </span>
          <span className="font-semibold">{parseFloat(walletBalance).toFixed(4)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400 text-sm">Exchange</span>
          <span className="font-semibold">{parseFloat(exchangeBalance).toFixed(4)}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-800">
        <button
          onClick={() => setActiveTab('deposit')}
          className={`flex-1 py-2 flex items-center justify-center gap-2 ${
            activeTab === 'deposit'
              ? 'border-b-2 border-afrodex-orange text-afrodex-orange'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <ArrowDownToLine className="w-4 h-4" />
          Deposit
        </button>
        <button
          onClick={() => setActiveTab('withdraw')}
          className={`flex-1 py-2 flex items-center justify-center gap-2 ${
            activeTab === 'withdraw'
              ? 'border-b-2 border-afrodex-orange text-afrodex-orange'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <ArrowUpFromLine className="w-4 h-4" />
          Withdraw
        </button>
      </div>

      {/* Amount Input */}
      <div className="mb-4">
        <label className="block text-sm text-gray-400 mb-2">Amount</label>
        <div className="relative">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
            className="w-full pr-16"
            step="any"
          />
          <button
            onClick={() => {
              const maxBalance = activeTab === 'deposit' ? walletBalance : exchangeBalance;
              setAmount(maxBalance);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-afrodex-orange hover:text-afrodex-orange-light"
          >
            MAX
          </button>
        </div>
      </div>

      {/* Action Button */}
      <div className="flex-1"></div>
      {needsApproval && activeTab === 'deposit' ? (
        <button
          onClick={handleApprove}
          disabled={loading || !amount || parseFloat(amount) <= 0}
          className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Approving...' : 'Approve'}
        </button>
      ) : (
        <button
          onClick={activeTab === 'deposit' ? handleDeposit : handleWithdraw}
          disabled={loading || !amount || parseFloat(amount) <= 0}
          className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Processing...' : activeTab === 'deposit' ? 'Deposit' : 'Withdraw'}
        </button>
      )}
    </div>
  );
}
