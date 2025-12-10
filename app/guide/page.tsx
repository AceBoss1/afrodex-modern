// app/guide/page.tsx
'use client';

import Link from 'next/link';
import { 
  ArrowLeft, 
  Wallet, 
  ArrowDownUp, 
  DollarSign, 
  History,
  X,
  Settings,
  ExternalLink,
  Shield,
  Zap,
  BookOpen,
  CheckCircle,
} from 'lucide-react';

export default function GuidePage() {
  return (
    <div className="min-h-screen bg-afrodex-black">
      {/* Header */}
      <header className="border-b border-white/5 bg-afrodex-black-light sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link 
            href="/trade/AfroX-ETH" 
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Trading
          </Link>
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-afrodex-orange" />
            <span className="font-display font-bold">AfroDex User Guide</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-display font-bold mb-4">
            How to Trade on <span className="text-afrodex-orange">AfroDex</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            AfroDex is an Ethereum-based Decentralized Exchange. No registration required — 
            just connect your wallet and start trading any ERC-20 token instantly.
          </p>
        </div>

        {/* Key Features */}
        <div className="grid md:grid-cols-3 gap-4 mb-12">
          <div className="card-neon text-center p-6">
            <Shield className="w-8 h-8 text-afrodex-orange mx-auto mb-3" />
            <h3 className="font-semibold mb-2">Non-Custodial</h3>
            <p className="text-sm text-gray-400">Your keys, your coins. Funds stay in your wallet until traded.</p>
          </div>
          <div className="card-neon text-center p-6">
            <Zap className="w-8 h-8 text-afrodex-orange mx-auto mb-3" />
            <h3 className="font-semibold mb-2">Gasless Orders</h3>
            <p className="text-sm text-gray-400">Place orders for free with off-chain signatures.</p>
          </div>
          <div className="card-neon text-center p-6">
            <DollarSign className="w-8 h-8 text-afrodex-orange mx-auto mb-3" />
            <h3 className="font-semibold mb-2">Low Fees</h3>
            <p className="text-sm text-gray-400">Only 0.3% taker fee. Makers trade free.</p>
          </div>
        </div>

        {/* Step by Step Guide */}
        <div className="space-y-8">
          
          {/* Step 1: Connect Wallet */}
          <section className="card">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-afrodex-orange/20 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-afrodex-orange" />
              </div>
              <div>
                <span className="text-xs text-afrodex-orange font-semibold">STEP 1</span>
                <h2 className="text-xl font-semibold">Connect Your Wallet</h2>
              </div>
            </div>
            <div className="space-y-3 text-gray-300">
              <p>Connect your Ethereum wallet to start trading. We support MetaMask, WalletConnect, and other popular wallets.</p>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>Visit <a href="https://dex.afrox.one" className="text-afrodex-orange hover:underline">dex.afrox.one</a></li>
                <li>Click <strong>"Connect Wallet"</strong> in the top right corner</li>
                <li>Select your wallet provider (MetaMask, WalletConnect, etc.)</li>
                <li>Approve the connection request in your wallet</li>
                <li>Verify the connected address is correct</li>
              </ol>
              <div className="bg-afrodex-black-lighter rounded-lg p-3 text-sm">
                <strong className="text-afrodex-orange">💡 Tip:</strong> Always verify you're on the correct URL 
                (<code className="bg-black/30 px-1 rounded">dex.afrox.one</code>) before connecting your wallet.
              </div>
            </div>
          </section>

          {/* Step 2: Add Custom Token */}
          <section className="card">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-afrodex-orange/20 flex items-center justify-center">
                <span className="text-afrodex-orange font-bold">+</span>
              </div>
              <div>
                <span className="text-xs text-afrodex-orange font-semibold">STEP 2</span>
                <h2 className="text-xl font-semibold">Access Any ERC-20 Token</h2>
              </div>
            </div>
            <div className="space-y-3 text-gray-300">
              <p>Trade any ERC-20 token — even if it's not officially listed. Just add the token contract address.</p>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>Click <strong>"+ Add Custom Token"</strong> in the sidebar</li>
                <li>Paste the token's contract address</li>
                <li>The token info will be automatically loaded</li>
                <li>Click the <strong>⭐ star</strong> to add it to your favorites</li>
              </ol>
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-sm">
                <strong className="text-yellow-400">⚠️ Warning:</strong> Always verify the contract address from official sources. 
                AfroDex cannot verify unlisted tokens — trade at your own risk.
              </div>
            </div>
          </section>

          {/* Step 3: Deposit */}
          <section className="card">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-afrodex-orange/20 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-afrodex-orange" />
              </div>
              <div>
                <span className="text-xs text-afrodex-orange font-semibold">STEP 3</span>
                <h2 className="text-xl font-semibold">Deposit ETH/Tokens to Exchange</h2>
              </div>
            </div>
            <div className="space-y-3 text-gray-300">
              <p>Before trading, you need to deposit funds to the AfroDex smart contract.</p>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>Find the <strong>"Balances"</strong> section on the right side</li>
                <li>Enter the amount you want to deposit</li>
                <li>Click <strong>"Deposit"</strong></li>
                <li>Approve the transaction in your wallet (you'll pay gas fees)</li>
                <li>Wait for the transaction to confirm</li>
              </ol>
              <p className="text-sm">Your balance will appear in the <strong>"Exchange Balance"</strong> section once confirmed.</p>
            </div>
          </section>

          {/* Step 4: Place Order */}
          <section className="card">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-afrodex-orange/20 flex items-center justify-center">
                <ArrowDownUp className="w-5 h-5 text-afrodex-orange" />
              </div>
              <div>
                <span className="text-xs text-afrodex-orange font-semibold">STEP 4</span>
                <h2 className="text-xl font-semibold">Place Buy/Sell Orders</h2>
              </div>
            </div>
            <div className="space-y-3 text-gray-300">
              <p>Create limit orders to buy or sell tokens at your desired price.</p>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>Go to the <strong>"Place Order"</strong> section</li>
                <li>Select <span className="text-trade-buy font-semibold">BUY</span> or <span className="text-trade-sell font-semibold">SELL</span></li>
                <li>Enter your desired <strong>price</strong> (in ETH)</li>
                <li>Enter the <strong>amount</strong> of tokens</li>
                <li>Click the action button to place your order</li>
                <li>Sign the message in your wallet (no gas fee!)</li>
              </ol>
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-sm">
                <strong className="text-green-400">✓ Gasless:</strong> Placing orders only requires a signature — no gas fees! 
                You only pay gas when a trade is executed.
              </div>
            </div>
          </section>

          {/* Step 5: Execute Trades */}
          <section className="card">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-afrodex-orange/20 flex items-center justify-center">
                <Zap className="w-5 h-5 text-afrodex-orange" />
              </div>
              <div>
                <span className="text-xs text-afrodex-orange font-semibold">STEP 5</span>
                <h2 className="text-xl font-semibold">Execute Instant Trades</h2>
              </div>
            </div>
            <div className="space-y-3 text-gray-300">
              <p>Take existing orders from the order book for instant execution.</p>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>Look at the <strong>Order Book</strong> section</li>
                <li><span className="text-trade-sell">Red orders</span> = Sell orders (you can buy from these)</li>
                <li><span className="text-trade-buy">Green orders</span> = Buy orders (you can sell to these)</li>
                <li>Click on any order to fill it</li>
                <li>Adjust the amount if needed</li>
                <li>Confirm the trade in your wallet</li>
              </ol>
              <div className="bg-afrodex-black-lighter rounded-lg p-3 text-sm">
                <strong className="text-afrodex-orange">💡 Smart Matching:</strong> When you place an order at a price that matches 
                existing counter-orders, the system will automatically execute against them first, then place the remaining 
                amount as a new order.
              </div>
            </div>
          </section>

          {/* Step 6: Withdraw */}
          <section className="card">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-afrodex-orange/20 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-afrodex-orange" />
              </div>
              <div>
                <span className="text-xs text-afrodex-orange font-semibold">STEP 6</span>
                <h2 className="text-xl font-semibold">Withdraw Your Funds</h2>
              </div>
            </div>
            <div className="space-y-3 text-gray-300">
              <p>Withdraw your ETH and tokens back to your wallet at any time.</p>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>Go to the <strong>"Balances"</strong> section</li>
                <li>Enter the amount to withdraw</li>
                <li>Click <strong>"Withdraw"</strong></li>
                <li>Confirm the transaction in your wallet</li>
              </ol>
              <p className="text-sm">You can also <strong>Transfer</strong> tokens directly to any ERC-20 wallet address.</p>
            </div>
          </section>

          {/* Step 7: Cancel Orders */}
          <section className="card">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-afrodex-orange/20 flex items-center justify-center">
                <X className="w-5 h-5 text-afrodex-orange" />
              </div>
              <div>
                <span className="text-xs text-afrodex-orange font-semibold">STEP 7</span>
                <h2 className="text-xl font-semibold">Cancel Orders</h2>
              </div>
            </div>
            <div className="space-y-3 text-gray-300">
              <p>You can cancel any open order at any time from the "My Transactions" section.</p>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>Find the <strong>"My Transactions"</strong> section below Recent Trades</li>
                <li>Click the <strong>"Orders"</strong> tab to see your open orders</li>
                <li>Each order shows a <strong>fill meter</strong> indicating how much has been executed</li>
                <li>Click the <strong>X</strong> button to cancel an order</li>
                <li>Only the remaining unfilled portion will be cancelled</li>
              </ol>
            </div>
          </section>

          {/* Step 8: Gas Fees */}
          <section className="card">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-afrodex-orange/20 flex items-center justify-center">
                <Settings className="w-5 h-5 text-afrodex-orange" />
              </div>
              <div>
                <span className="text-xs text-afrodex-orange font-semibold">STEP 8</span>
                <h2 className="text-xl font-semibold">Managing Gas Fees</h2>
              </div>
            </div>
            <div className="space-y-3 text-gray-300">
              <p>Gas fees are paid directly to Ethereum miners, not to AfroDex.</p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400 mt-0.5" />
                  <span>Always check current gas prices before confirming transactions</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400 mt-0.5" />
                  <span>You can adjust gas settings in your wallet's approval window</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400 mt-0.5" />
                  <span>Consider trading during low-gas periods for lower fees</span>
                </li>
              </ul>
            </div>
          </section>

          {/* Fee Schedule */}
          <section className="card">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-afrodex-orange/20 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-afrodex-orange" />
              </div>
              <h2 className="text-xl font-semibold">AfroDex Fee Schedule</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-2 text-gray-400 font-medium">Action</th>
                    <th className="text-right py-2 text-gray-400 font-medium">Fee</th>
                  </tr>
                </thead>
                <tbody className="text-gray-300">
                  <tr className="border-b border-white/5">
                    <td className="py-2">Deposit ETH or Token</td>
                    <td className="py-2 text-right text-green-400 font-semibold">FREE</td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-2">Withdraw ETH or Token</td>
                    <td className="py-2 text-right text-green-400 font-semibold">FREE</td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-2">Place Order (Maker)</td>
                    <td className="py-2 text-right text-green-400 font-semibold">FREE</td>
                  </tr>
                  <tr>
                    <td className="py-2">Execute Order (Taker)</td>
                    <td className="py-2 text-right text-afrodex-orange font-semibold">0.3%</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              * Gas fees for on-chain transactions (deposits, withdrawals, trades) are paid to Ethereum miners, not AfroDex.
            </p>
          </section>

        </div>

        {/* Footer CTA */}
        <div className="text-center mt-12 pt-8 border-t border-white/5">
          <h3 className="text-xl font-semibold mb-3">Ready to Start Trading?</h3>
          <Link 
            href="/trade/AfroX-ETH" 
            className="btn-primary inline-flex items-center gap-2 px-8 py-3"
          >
            Launch AfroDex
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-6 mt-12">
        <div className="max-w-4xl mx-auto px-4 text-center text-sm text-gray-500">
          <p>© 2024 AfroDex. All rights reserved.</p>
          <p className="mt-1">
            Need help? Join our <a href="https://t.me/afrodex" className="text-afrodex-orange hover:underline">Telegram</a> community.
          </p>
        </div>
      </footer>
    </div>
  );
}
