// components/BalancePanel.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { ethers } from 'ethers';
import { Token, ZERO_ADDRESS } from '@/lib/tokens';
import {
  getBalances,
  formatAmount,
  parseAmount,
  depositEth,
  withdrawEth,
  depositToken,
  withdrawToken,
  approveToken,
  checkAllowance,
} from '@/lib/exchange';
import { useTradingStore, useUIStore } from '@/lib/store';
import {
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
  RefreshCw,
  AlertCircle,
  Loader2,
  Check,
} from 'lucide-react';

interface BalancePanelProps {
  baseToken: Token;
  quoteToken: Token;
}

export default function BalancePanel({ baseToken, quoteToken }: BalancePanelProps) {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  
  const { balances, setBalance, setLoadingBalances } = useTradingStore();
  const { balanceTab, setBalanceTab } = useUIStore();

  const [selectedToken, setSelectedToken] = useState<Token>(baseToken);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [needsApproval, setNeedsApproval] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Update selected token when pair changes
  useEffect(() => {
    setSelectedToken(baseToken);
  }, [baseToken]);

  // Fetch balances
  const fetchBalances = useCallback(async () => {
    if (!address || !publicClient) return;

    setRefreshing(true);
    setLoadingBalances(true);

    try {
      const alchemyKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
      const provider = new ethers.JsonRpcProvider(
        alchemyKey 
          ? `https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`
          : 'https://eth.llamarpc.com'
      );

      const [baseBalances, quoteBalances] = await Promise.all([
        getBalances(provider, baseToken.address, address),
        getBalances(provider, quoteToken.address, address),
      ]);

      setBalance(baseToken.address, baseBalances.wallet, baseBalances.exchange);
      setBalance(quoteToken.address, quoteBalances.wallet, quoteBalances.exchange);
    } catch (err) {
      console.error('Error fetching balances:', err);
    } finally {
      setRefreshing(false);
      setLoadingBalances(false);
    }
  }, [address, publicClient, baseToken, quoteToken, setBalance, setLoadingBalances]);

  // Fetch balances on mount and periodically
  useEffect(() => {
    fetchBalances();
    const interval = setInterval(fetchBalances, 15000); // Refresh every 15s
    return () => clearInterval(interval);
  }, [fetchBalances]);

  // Check approval status for token deposits
  useEffect(() => {
    const checkApprovalStatus = async () => {
      if (!address || selectedToken.address === ZERO_ADDRESS || balanceTab !== 'deposit') {
        setNeedsApproval(false);
        return;
      }

      if (!amount || parseFloat(amount) <= 0) {
        setNeedsApproval(false);
        return;
      }

      try {
        const alchemyKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
        const provider = new ethers.JsonRpcProvider(
          alchemyKey 
            ? `https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`
            : 'https://eth.llamarpc.com'
        );

        const allowance = await checkAllowance(provider, selectedToken.address, address);
        const requiredAmount = parseAmount(amount, selectedToken.decimals);
        setNeedsApproval(BigInt(allowance) < BigInt(requiredAmount));
      } catch (err) {
        console.error('Error checking allowance:', err);
      }
    };

    checkApprovalStatus();
  }, [address, selectedToken, amount, balanceTab]);

  // Get signer from wallet client
  const getSigner = async () => {
    if (!walletClient) throw new Error('Wallet not connected');
    const provider = new ethers.BrowserProvider(walletClient as any);
    return await provider.getSigner();
  };

  // Handle approve
  const handleApprove = async () => {
    if (!walletClient || !amount) return;

    setLoading(true);
    setError(null);

    try {
      const signer = await getSigner();
      const amountWei = parseAmount(amount, selectedToken.decimals);
      const tx = await approveToken(signer, selectedToken.address, amountWei);
      await tx.wait();
      setNeedsApproval(false);
    } catch (err: any) {
      console.error('Error approving:', err);
      setError(err.message || 'Failed to approve token');
    } finally {
      setLoading(false);
    }
  };

  // Handle deposit
  const handleDeposit = async () => {
    if (!walletClient || !amount) return;

    setLoading(true);
    setError(null);

    try {
      const signer = await getSigner();
      const amountWei = parseAmount(amount, selectedToken.decimals);

      let tx;
      if (selectedToken.address === ZERO_ADDRESS) {
        tx = await depositEth(signer, amountWei);
      } else {
        tx = await depositToken(signer, selectedToken.address, amountWei);
      }

      await tx.wait();
      setAmount('');
      fetchBalances();
      alert('Deposit successful!');
    } catch (err: any) {
      console.error('Error depositing:', err);
      setError(err.message || 'Failed to deposit');
    } finally {
      setLoading(false);
    }
  };

  // Handle withdraw
  const handleWithdraw = async () => {
    if (!walletClient || !amount) return;

    setLoading(true);
    setError(null);

    try {
      const signer = await getSigner();
      const amountWei = parseAmount(amount, selectedToken.decimals);

      let tx;
      if (selectedToken.address === ZERO_ADDRESS) {
        tx = await withdrawEth(signer, amountWei);
      } else {
        tx = await withdrawToken(signer, selectedToken.address, amountWei);
      }

      await tx.wait();
      setAmount('');
      fetchBalances();
      alert('Withdrawal successful!');
    } catch (err: any) {
      console.error('Error withdrawing:', err);
      setError(err.message || 'Failed to withdraw');
    } finally {
      setLoading(false);
    }
  };

  // Get current balances
  const currentBalance = balances[selectedToken.address.toLowerCase()];
  const walletBalance = currentBalance 
    ? parseFloat(formatAmount(currentBalance.wallet, selectedToken.decimals))
    : 0;
  const exchangeBalance = currentBalance 
    ? parseFloat(formatAmount(currentBalance.exchange, selectedToken.decimals))
    : 0;

  // Set max amount
  const setMaxAmount = () => {
    if (balanceTab === 'deposit') {
      // Leave some ETH for gas if depositing ETH
      const maxAmount = selectedToken.address === ZERO_ADDRESS 
        ? Math.max(0, walletBalance - 0.01)
        : walletBalance;
      setAmount(maxAmount.toString());
    } else {
      setAmount(exchangeBalance.toString());
    }
  };

  return (
    <div className="card h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Wallet className="w-4 h-4 text-afrodex-orange" />
          Balances
        </h3>
        <button
          onClick={fetchBalances}
          disabled={refreshing}
          className="p-1.5 hover:bg-white/5 rounded-lg transition-colors"
          title="Refresh balances"
        >
          <RefreshCw className={`w-4 h-4 text-gray-500 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Token Selector */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setSelectedToken(baseToken)}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
            selectedToken.address === baseToken.address
              ? 'bg-afrodex-orange text-white'
              : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
          }`}
        >
          {baseToken.symbol}
        </button>
        <button
          onClick={() => setSelectedToken(quoteToken)}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
            selectedToken.address === quoteToken.address
              ? 'bg-afrodex-orange text-white'
              : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
          }`}
        >
          {quoteToken.symbol}
        </button>
      </div>

      {/* Balance Display */}
      <div className="p-3 bg-afrodex-black-lighter rounded-lg mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-gray-500 flex items-center gap-1">
            <Wallet className="w-3 h-3" />
            Wallet
          </span>
          <span className="text-sm font-mono">
            {walletBalance.toFixed(6)}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-500">Exchange</span>
          <span className="text-sm font-mono font-semibold text-afrodex-orange">
            {exchangeBalance.toFixed(6)}
          </span>
        </div>
      </div>

      {/* Deposit/Withdraw Tabs */}
      <div className="flex gap-1 mb-4 border-b border-white/5">
        <button
          onClick={() => setBalanceTab('deposit')}
          className={`flex-1 py-2 flex items-center justify-center gap-1.5 text-sm transition-all ${
            balanceTab === 'deposit'
              ? 'border-b-2 border-afrodex-orange text-afrodex-orange'
              : 'text-gray-500 hover:text-white'
          }`}
        >
          <ArrowDownToLine className="w-4 h-4" />
          Deposit
        </button>
        <button
          onClick={() => setBalanceTab('withdraw')}
          className={`flex-1 py-2 flex items-center justify-center gap-1.5 text-sm transition-all ${
            balanceTab === 'withdraw'
              ? 'border-b-2 border-afrodex-orange text-afrodex-orange'
              : 'text-gray-500 hover:text-white'
          }`}
        >
          <ArrowUpFromLine className="w-4 h-4" />
          Withdraw
        </button>
      </div>

      {/* Amount Input */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs text-gray-500">Amount</label>
          <button
            onClick={setMaxAmount}
            className="text-xs text-afrodex-orange hover:text-afrodex-orange-light"
          >
            MAX
          </button>
        </div>
        <div className="relative">
          <input
            type="number"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setError(null);
            }}
            placeholder="0.0"
            className="input font-mono text-sm pr-16"
            step="any"
            min="0"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 font-medium">
            {selectedToken.symbol}
          </span>
        </div>
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
          Connect Wallet
        </button>
      ) : needsApproval && balanceTab === 'deposit' ? (
        <button
          onClick={handleApprove}
          disabled={loading || !amount || parseFloat(amount) <= 0}
          className="btn-primary w-full"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Approving...
            </span>
          ) : (
            <>
              <Check className="w-4 h-4" />
              Approve {selectedToken.symbol}
            </>
          )}
        </button>
      ) : (
        <button
          onClick={balanceTab === 'deposit' ? handleDeposit : handleWithdraw}
          disabled={loading || !amount || parseFloat(amount) <= 0}
          className="btn-primary w-full"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Processing...
            </span>
          ) : (
            <>
              {balanceTab === 'deposit' ? (
                <ArrowDownToLine className="w-4 h-4" />
              ) : (
                <ArrowUpFromLine className="w-4 h-4" />
              )}
              {balanceTab === 'deposit' ? 'Deposit' : 'Withdraw'}
            </>
          )}
        </button>
      )}

      {/* Help Text */}
      <p className="mt-3 text-[10px] text-gray-600 text-center">
        {balanceTab === 'deposit'
          ? 'Deposit funds to trade on the exchange'
          : 'Withdraw funds back to your wallet'}
      </p>
    </div>
  );
}
