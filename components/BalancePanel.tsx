// components/BalancePanel.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { ethers } from 'ethers';
import { Token, ZERO_ADDRESS } from '@/lib/tokens';
import {
  getBalances,
  formatAmount,
  formatDisplayAmount,
  formatFullBalance,
  parseAmount,
  depositEth,
  withdrawEth,
  depositToken,
  withdrawToken,
  approveToken,
  checkAllowance,
} from '@/lib/exchange';
import { useTradingStore } from '@/lib/store';
import {
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
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
  
  // Use local state for tab to avoid TypeScript issues with store
  const [balanceTab, setBalanceTab] = useState<'deposit' | 'withdraw' | 'transfer'>('deposit');

  const [selectedToken, setSelectedToken] = useState<Token>(baseToken);
  const [amount, setAmount] = useState('');
  const [transferAddress, setTransferAddress] = useState('');
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

  // Handle transfer
  const handleTransfer = async () => {
    if (!walletClient || !address || !amount || !transferAddress) return;

    // Validate address
    if (!ethers.isAddress(transferAddress)) {
      setError('Invalid recipient address');
      return;
    }

    if (transferAddress.toLowerCase() === address.toLowerCase()) {
      setError('Cannot transfer to yourself');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const provider = new ethers.BrowserProvider(walletClient as any);
      const signer = await provider.getSigner();
      const amountWei = parseAmount(amount, selectedToken.decimals);

      let tx;
      if (selectedToken.address === ZERO_ADDRESS) {
        // Transfer ETH
        tx = await signer.sendTransaction({
          to: transferAddress,
          value: amountWei,
        });
      } else {
        // Transfer ERC20 token
        const tokenContract = new ethers.Contract(
          selectedToken.address,
          ['function transfer(address to, uint256 amount) returns (bool)'],
          signer
        );
        tx = await tokenContract.transfer(transferAddress, amountWei);
      }

      await tx.wait();
      setAmount('');
      setTransferAddress('');
      fetchBalances();
      alert('Transfer successful!');
    } catch (err: any) {
      console.error('Error transferring:', err);
      setError(err.message || 'Failed to transfer');
    } finally {
      setLoading(false);
    }
  };

  // Get current balances - keep as strings for display precision
  const currentBalance = balances[selectedToken.address.toLowerCase()];
  const walletBalanceStr = currentBalance 
    ? formatAmount(currentBalance.wallet, selectedToken.decimals)
    : '0';
  const exchangeBalanceStr = currentBalance 
    ? formatAmount(currentBalance.exchange, selectedToken.decimals)
    : '0';
  
  // Parse to numbers for calculations
  const walletBalanceNum = parseFloat(walletBalanceStr);
  const exchangeBalanceNum = parseFloat(exchangeBalanceStr);
  
  // Formatted for display - pass string to preserve large number precision
  const walletBalanceDisplay = formatDisplayAmount(walletBalanceStr);
  const exchangeBalanceDisplay = formatDisplayAmount(exchangeBalanceStr);

  // Set max amount
  const setMaxAmount = () => {
    if (balanceTab === 'deposit') {
      // Leave some ETH for gas if depositing ETH
      const maxAmount = selectedToken.address === ZERO_ADDRESS 
        ? Math.max(0, walletBalanceNum - 0.01)
        : walletBalanceNum;
      setAmount(maxAmount.toString());
    } else if (balanceTab === 'withdraw') {
      setAmount(exchangeBalanceStr);
    } else {
      // Transfer - use wallet balance
      const maxAmount = selectedToken.address === ZERO_ADDRESS 
        ? Math.max(0, walletBalanceNum - 0.01)
        : walletBalanceNum;
      setAmount(maxAmount.toString());
    }
  };

  return (
    <div className="card flex flex-col">
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
          <span className="text-sm font-mono" title={walletBalanceStr}>
            {walletBalanceDisplay}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-500">Exchange</span>
          <span className="text-sm font-mono font-semibold text-afrodex-orange" title={exchangeBalanceStr}>
            {exchangeBalanceDisplay}
          </span>
        </div>
      </div>

      {/* Deposit/Withdraw/Transfer Tabs */}
      <div className="flex gap-1 mb-4 border-b border-white/5">
        <button
          onClick={() => setBalanceTab('deposit')}
          className={`flex-1 py-2 flex items-center justify-center gap-1 text-xs transition-all ${
            balanceTab === 'deposit'
              ? 'border-b-2 border-afrodex-orange text-afrodex-orange'
              : 'text-gray-500 hover:text-white'
          }`}
        >
          <ArrowDownToLine className="w-3 h-3" />
          Deposit
        </button>
        <button
          onClick={() => setBalanceTab('withdraw')}
          className={`flex-1 py-2 flex items-center justify-center gap-1 text-xs transition-all ${
            balanceTab === 'withdraw'
              ? 'border-b-2 border-afrodex-orange text-afrodex-orange'
              : 'text-gray-500 hover:text-white'
          }`}
        >
          <ArrowUpFromLine className="w-3 h-3" />
          Withdraw
        </button>
        <button
          onClick={() => setBalanceTab('transfer')}
          className={`flex-1 py-2 flex items-center justify-center gap-1 text-xs transition-all ${
            balanceTab === 'transfer'
              ? 'border-b-2 border-afrodex-orange text-afrodex-orange'
              : 'text-gray-500 hover:text-white'
          }`}
        >
          <ArrowLeftRight className="w-3 h-3" />
          Transfer
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

      {/* Transfer Address Input - Only show for transfer tab */}
      {balanceTab === 'transfer' && (
        <div className="mb-4">
          <label className="text-xs text-gray-500 mb-1.5 block">Recipient Address</label>
          <input
            type="text"
            value={transferAddress}
            onChange={(e) => {
              setTransferAddress(e.target.value);
              setError(null);
            }}
            placeholder="0x..."
            className="input font-mono text-xs"
          />
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="flex items-start gap-2 p-2 bg-red-500/10 border border-red-500/20 rounded-lg mb-3 text-xs text-red-400">
          <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Action Button */}
      {!isConnected ? (
        <button className="btn-secondary w-full py-2 text-sm" disabled>
          Connect Wallet
        </button>
      ) : balanceTab === 'transfer' ? (
        <button
          disabled={loading || !amount || parseFloat(amount) <= 0 || !transferAddress || !ethers.isAddress(transferAddress)}
          className="btn-primary w-full py-2 text-sm"
          onClick={handleTransfer}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" />
              Transferring...
            </span>
          ) : (
            <>
              <ArrowLeftRight className="w-3 h-3" />
              Transfer {selectedToken.symbol}
            </>
          )}
        </button>
      ) : needsApproval && balanceTab === 'deposit' ? (
        <button
          onClick={handleApprove}
          disabled={loading || !amount || parseFloat(amount) <= 0}
          className="btn-primary w-full py-2 text-sm"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" />
              Approving...
            </span>
          ) : (
            <>
              <Check className="w-3 h-3" />
              Approve {selectedToken.symbol}
            </>
          )}
        </button>
      ) : (
        <button
          onClick={balanceTab === 'deposit' ? handleDeposit : handleWithdraw}
          disabled={loading || !amount || parseFloat(amount) <= 0}
          className="btn-primary w-full py-2 text-sm"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" />
              Processing...
            </span>
          ) : (
            <>
              {balanceTab === 'deposit' ? (
                <ArrowDownToLine className="w-3 h-3" />
              ) : (
                <ArrowUpFromLine className="w-3 h-3" />
              )}
              {balanceTab === 'deposit' ? 'Deposit' : 'Withdraw'}
            </>
          )}
        </button>
      )}
    </div>
  );
}
