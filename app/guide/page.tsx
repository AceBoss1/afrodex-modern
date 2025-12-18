// app/guide/page.tsx
'use client';

import Link from 'next/link';
import Image from 'next/image';
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
  Trophy,
  Gift,
  Star,
  TrendingUp,
  Medal,
  Calendar,
  Users,
  Coins,
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

        {/* Table of Contents */}
        <div className="card mb-8">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-afrodex-orange" />
            Table of Contents
          </h2>
          <div className="grid md:grid-cols-2 gap-2 text-sm">
            <a href="#getting-started" className="text-gray-400 hover:text-afrodex-orange transition-colors">1. Getting Started</a>
            <a href="#tgif-rewards" className="text-gray-400 hover:text-afrodex-orange transition-colors">6. 🏆 TGIF Rewards Program</a>
            <a href="#self-list" className="text-gray-400 hover:text-afrodex-orange transition-colors">2. Self-List Tokens</a>
            <a href="#badge-tiers" className="text-gray-400 hover:text-afrodex-orange transition-colors">7. Badge Tiers &amp; Multipliers</a>
            <a href="#deposit" className="text-gray-400 hover:text-afrodex-orange transition-colors">3. Deposit Funds</a>
            <a href="#leaderboard" className="text-gray-400 hover:text-afrodex-orange transition-colors">8. Leaderboard</a>
            <a href="#place-orders" className="text-gray-400 hover:text-afrodex-orange transition-colors">4. Place Orders</a>
            <a href="#staking" className="text-gray-400 hover:text-afrodex-orange transition-colors">9. AfroX Staking</a>
            <a href="#execute-trades" className="text-gray-400 hover:text-afrodex-orange transition-colors">5. Execute Trades</a>
            <a href="#fees" className="text-gray-400 hover:text-afrodex-orange transition-colors">10. Fee Schedule</a>
          </div>
        </div>

        {/* Key Features */}
        <div className="grid md:grid-cols-4 gap-4 mb-12">
          <div className="card-neon text-center p-4">
            <Shield className="w-7 h-7 text-afrodex-orange mx-auto mb-2" />
            <h3 className="font-semibold text-sm mb-1">Non-Custodial</h3>
            <p className="text-xs text-gray-400">Your keys, your coins</p>
          </div>
          <div className="card-neon text-center p-4">
            <Zap className="w-7 h-7 text-afrodex-orange mx-auto mb-2" />
            <h3 className="font-semibold text-sm mb-1">Gasless Orders</h3>
            <p className="text-xs text-gray-400">Sign orders for free</p>
          </div>
          <div className="card-neon text-center p-4">
            <DollarSign className="w-7 h-7 text-afrodex-orange mx-auto mb-2" />
            <h3 className="font-semibold text-sm mb-1">Low Fees</h3>
            <p className="text-xs text-gray-400">Only 0.3% taker fee</p>
          </div>
          <div className="card-neon text-center p-4">
            <Gift className="w-7 h-7 text-yellow-500 mx-auto mb-2" />
            <h3 className="font-semibold text-sm mb-1">TGIF Rewards</h3>
            <p className="text-xs text-gray-400">Earn AfroX weekly</p>
          </div>
        </div>

        {/* Step by Step Guide */}
        <div className="space-y-8">
          
          {/* Step 1: Connect Wallet */}
          <section id="getting-started" className="card">
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
                <li>Click <strong>&ldquo;Connect Wallet&rdquo;</strong> in the sidebar</li>
                <li>Select your wallet provider (MetaMask, WalletConnect, etc.)</li>
                <li>Approve the connection request in your wallet</li>
                <li>Your badge tier will display below your address once connected</li>
              </ol>
              <div className="bg-afrodex-black-lighter rounded-lg p-3 text-sm">
                <strong className="text-afrodex-orange">💡 Tip:</strong> Always verify you&apos;re on the correct URL 
                (<code className="bg-black/30 px-1 rounded">dex.afrox.one</code>) before connecting your wallet.
              </div>
            </div>
          </section>

          {/* Trading Pairs */}
          <section className="card">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-afrodex-orange/20 flex items-center justify-center">
                <ExternalLink className="w-5 h-5 text-afrodex-orange" />
              </div>
              <div>
                <span className="text-xs text-afrodex-orange font-semibold">TRADING PAIRS</span>
                <h2 className="text-xl font-semibold">Access Any Trading Pair via URL</h2>
              </div>
            </div>
            <div className="space-y-3 text-gray-300">
              <p>Navigate directly to any trading pair using the URL format:</p>
              <div className="bg-afrodex-black-lighter rounded-lg p-3 text-sm font-mono space-y-2">
                <div><span className="text-gray-500"># Official tokens:</span></div>
                <div>https://dex.afrox.one/trade/<span className="text-afrodex-orange">AfroX</span>-ETH</div>
                <div>https://dex.afrox.one/trade/<span className="text-afrodex-orange">PFARM</span>-ETH</div>
                <div><span className="text-gray-500"># Custom token by address:</span></div>
                <div>https://dex.afrox.one/trade/<span className="text-afrodex-orange">0x123...</span>-ETH</div>
              </div>
            </div>
          </section>

          {/* Step 2: Self-List Token */}
          <section id="self-list" className="card">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-afrodex-orange/20 flex items-center justify-center">
                <span className="text-afrodex-orange font-bold">+</span>
              </div>
              <div>
                <span className="text-xs text-afrodex-orange font-semibold">STEP 2</span>
                <h2 className="text-xl font-semibold">Self-List Any ERC-20 Token</h2>
              </div>
            </div>
            <div className="space-y-3 text-gray-300">
              <p>Trade any ERC-20 token — even if it&apos;s not officially listed. Just add the token contract address.</p>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>Click <strong>&ldquo;+ Add Custom Token&rdquo;</strong> in the sidebar</li>
                <li>Paste the ERC-20 token&apos;s contract address</li>
                <li>Click <strong>&ldquo;Add Token&rdquo;</strong></li>
                <li>Click the <strong>⭐ star</strong> to add it to your favorites</li>
                <li>Start trading! Your community can access via: <code className="bg-black/30 px-1 rounded text-xs">dex.afrox.one/trade/0x123...-ETH</code></li>
              </ol>
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-sm">
                <strong className="text-yellow-400">⚠️ Warning:</strong> Always verify the contract address from official sources. 
                AfroDex cannot verify unlisted tokens — trade at your own risk.
              </div>
              <div className="bg-afrodex-black-lighter rounded-lg p-3 text-sm">
                <strong className="text-afrodex-orange">📧 List Your Token Officially:</strong> Want your token featured? 
                Email <a href="mailto:support@afrox.one?subject=I%20want%20to%20List%20a%20token%20on%20AfroDex%20Exchange" className="text-afrodex-orange hover:underline">support@afrox.one</a> with subject &ldquo;I want to List a token on AfroDex Exchange&rdquo;
              </div>
            </div>
          </section>

          {/* Step 3: Deposit */}
          <section id="deposit" className="card">
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
                <li>Find the <strong>&ldquo;Balances&rdquo;</strong> section on the right side</li>
                <li>Enter the amount you want to deposit</li>
                <li>Click <strong>&ldquo;Deposit&rdquo;</strong></li>
                <li>Approve the transaction in your wallet (you&apos;ll pay gas fees)</li>
                <li>Wait for the transaction to confirm</li>
              </ol>
              <p className="text-sm">Your balance will appear in the <strong>&ldquo;Exchange Balance&rdquo;</strong> section once confirmed.</p>
            </div>
          </section>

          {/* Step 4: Place Order */}
          <section id="place-orders" className="card">
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
                <li>Go to the <strong>&ldquo;Place Order&rdquo;</strong> section</li>
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
          <section id="execute-trades" className="card">
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
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-sm">
                <strong className="text-yellow-400">🏆 TGIF Eligible:</strong> When you execute trades (as a taker), you earn points toward weekly TGIF rewards!
              </div>
            </div>
          </section>

          {/* ============================================ */}
          {/* TGIF REWARDS SECTION */}
          {/* ============================================ */}
          
          <div className="border-t border-afrodex-orange/30 pt-8 mt-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gradient mb-2">🏆 TGIF Rewards Program</h2>
              <p className="text-gray-400">Thank God It&apos;s Friday — Earn AfroX every week!</p>
            </div>
          </div>

          {/* TGIF Overview */}
          <section id="tgif-rewards" className="card border-afrodex-orange/30">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <Gift className="w-5 h-5 text-yellow-500" />
              </div>
              <div>
                <span className="text-xs text-yellow-500 font-semibold">REWARDS PROGRAM</span>
                <h2 className="text-xl font-semibold">How TGIF Rewards Work</h2>
              </div>
            </div>
            <div className="space-y-4 text-gray-300">
              <p>
                TGIF (Thank God It&apos;s Friday) is our weekly rewards program that distributes <strong className="text-afrodex-orange">1 Trillion AfroX</strong> tokens 
                over 3 years to active traders who stake AfroX.
              </p>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-afrodex-black-lighter rounded-lg p-4">
                  <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-afrodex-orange" />
                    Weekly Cycle
                  </h4>
                  <ul className="text-sm space-y-1">
                    <li>• Week runs <strong>Friday to Thursday</strong></li>
                    <li>• Rewards calculated Friday morning</li>
                    <li>• Distribution every Friday</li>
                    <li>• 156 weeks total (3 years)</li>
                  </ul>
                </div>
                <div className="bg-afrodex-black-lighter rounded-lg p-4">
                  <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                    <Users className="w-4 h-4 text-afrodex-orange" />
                    Who&apos;s Eligible
                  </h4>
                  <ul className="text-sm space-y-1">
                    <li>• <strong>Takers only</strong> (trade executors)</li>
                    <li>• Must stake <strong>≥1B AfroX</strong></li>
                    <li>• Higher stake = higher multiplier</li>
                    <li>• Trade any pair to earn</li>
                  </ul>
                </div>
              </div>

              <div className="bg-afrodex-orange/10 border border-afrodex-orange/30 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-2">📊 Reward Formula</h4>
                <div className="bg-black/30 rounded p-3 font-mono text-sm">
                  <div className="text-gray-400 mb-1">Your Weekly Reward =</div>
                  <div className="text-afrodex-orange">(Your Weighted Fees ÷ Total Weighted Fees) × Weekly Pool</div>
                </div>
                <p className="text-sm mt-2 text-gray-400">
                  <strong>Weighted Fees</strong> = (Gas Fees + Platform Fees) × Your Badge Multiplier
                </p>
              </div>
            </div>
          </section>

          {/* Badge Tiers */}
          <section id="badge-tiers" className="card border-afrodex-orange/30">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <Medal className="w-5 h-5 text-yellow-500" />
              </div>
              <div>
                <span className="text-xs text-yellow-500 font-semibold">BADGE SYSTEM</span>
                <h2 className="text-xl font-semibold">Badge Tiers &amp; Multipliers</h2>
              </div>
            </div>
            <div className="space-y-4 text-gray-300">
              <p>
                Your badge tier is determined by how much AfroX you have staked. Higher tiers earn bigger multipliers on your fees!
              </p>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-3 px-2">Badge</th>
                      <th className="text-left py-3 px-2">Name</th>
                      <th className="text-right py-3 px-2">Min Stake</th>
                      <th className="text-right py-3 px-2">Multiplier</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-white/5 bg-gray-500/10">
                      <td className="py-3 px-2 text-2xl">🔘</td>
                      <td className="py-3 px-2 text-gray-500">Starter</td>
                      <td className="py-3 px-2 text-right font-mono text-gray-500">&lt; 1B</td>
                      <td className="py-3 px-2 text-right font-mono text-gray-500">0.0x</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-3 px-2 text-2xl">🔰</td>
                      <td className="py-3 px-2">Cadet</td>
                      <td className="py-3 px-2 text-right font-mono">≥ 1B</td>
                      <td className="py-3 px-2 text-right font-mono text-green-400">1.0x</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-3 px-2 text-2xl">🔱</td>
                      <td className="py-3 px-2">Captain</td>
                      <td className="py-3 px-2 text-right font-mono">≥ 10B</td>
                      <td className="py-3 px-2 text-right font-mono text-green-400">1.5x</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-3 px-2 text-2xl">⚜️</td>
                      <td className="py-3 px-2">Commander</td>
                      <td className="py-3 px-2 text-right font-mono">≥ 50B</td>
                      <td className="py-3 px-2 text-right font-mono text-green-400">2.0x</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-3 px-2 text-2xl">⭐</td>
                      <td className="py-3 px-2">General</td>
                      <td className="py-3 px-2 text-right font-mono">≥ 100B</td>
                      <td className="py-3 px-2 text-right font-mono text-yellow-400">2.5x</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-3 px-2 text-2xl">〽️</td>
                      <td className="py-3 px-2">Marshal</td>
                      <td className="py-3 px-2 text-right font-mono">≥ 500B</td>
                      <td className="py-3 px-2 text-right font-mono text-yellow-400">2.75x</td>
                    </tr>
                    <tr className="border-b border-white/5 bg-blue-500/10">
                      <td className="py-3 px-2 text-2xl">💠</td>
                      <td className="py-3 px-2 text-blue-400">Platinum Sentinel</td>
                      <td className="py-3 px-2 text-right font-mono">≥ 1T</td>
                      <td className="py-3 px-2 text-right font-mono text-blue-400">3.0x</td>
                    </tr>
                    <tr className="bg-purple-500/10">
                      <td className="py-3 px-2 text-2xl">❇️</td>
                      <td className="py-3 px-2 text-purple-400">Diamond Custodian</td>
                      <td className="py-3 px-2 text-right font-mono">≥ 10T</td>
                      <td className="py-3 px-2 text-right font-mono text-purple-400">4.0x</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm">
                <strong className="text-red-400">⚠️ Important:</strong> Starters (under 1B staked) receive <strong>0x multiplier</strong> and 
                are NOT eligible for TGIF rewards. You must stake at least 1B AfroX to participate.
              </div>

              <div className="bg-afrodex-black-lighter rounded-lg p-4">
                <h4 className="font-semibold text-white mb-2">💡 Example Calculation</h4>
                <div className="text-sm space-y-2">
                  <p>You are a <strong>Commander (⚜️)</strong> with 50B AfroX staked.</p>
                  <p>This week you paid <strong>0.05 ETH</strong> in fees (gas + platform).</p>
                  <p>Your weighted fees = 0.05 × <strong>2.0x</strong> = <strong className="text-afrodex-orange">0.10</strong></p>
                  <p className="text-gray-500">If total weighted fees from all traders is 10.0, and the pool is 15B AfroX:</p>
                  <p>Your reward = (0.10 ÷ 10.0) × 15B = <strong className="text-green-400">150M AfroX</strong></p>
                </div>
              </div>
            </div>
          </section>

          {/* Emission Schedule */}
          <section className="card border-afrodex-orange/30">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <Coins className="w-5 h-5 text-yellow-500" />
              </div>
              <div>
                <span className="text-xs text-yellow-500 font-semibold">EMISSION SCHEDULE</span>
                <h2 className="text-xl font-semibold">Weekly Reward Pools</h2>
              </div>
            </div>
            <div className="space-y-4 text-gray-300">
              <p>
                The reward pool starts high and decreases over time to incentivize early adoption. 
                Total distribution: <strong className="text-afrodex-orange">~1 Trillion AfroX</strong> over 1 year (52 weeks).
              </p>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-2 px-2">Period</th>
                      <th className="text-left py-2 px-2">Weeks</th>
                      <th className="text-right py-2 px-2">Weekly Pool</th>
                      <th className="text-right py-2 px-2">Period Total</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-400">
                    <tr className="border-b border-white/5 bg-green-500/10">
                      <td className="py-2 px-2 text-green-400">Q1</td>
                      <td className="py-2 px-2">1-13</td>
                      <td className="py-2 px-2 text-right font-mono text-green-400">25B</td>
                      <td className="py-2 px-2 text-right font-mono">325B</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2 px-2">Q2</td>
                      <td className="py-2 px-2">14-26</td>
                      <td className="py-2 px-2 text-right font-mono">22B</td>
                      <td className="py-2 px-2 text-right font-mono">286B</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2 px-2">Q3</td>
                      <td className="py-2 px-2">27-39</td>
                      <td className="py-2 px-2 text-right font-mono">18B</td>
                      <td className="py-2 px-2 text-right font-mono">234B</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-2">Q4</td>
                      <td className="py-2 px-2">40-52</td>
                      <td className="py-2 px-2 text-right font-mono">15B</td>
                      <td className="py-2 px-2 text-right font-mono">195B</td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-white/10 font-semibold">
                      <td className="py-2 px-2" colSpan={3}>Total (52 weeks)</td>
                      <td className="py-2 px-2 text-right font-mono text-afrodex-orange">~1,040B</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-sm">
                <strong className="text-green-400">🚀 Early Bird Advantage:</strong> The first 13 weeks offer 
                <strong> 25B AfroX per week</strong> — the highest reward rate! Start trading and staking early to maximize your rewards.
              </div>
            </div>
          </section>

          {/* Leaderboard */}
          <section id="leaderboard" className="card border-afrodex-orange/30">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-yellow-500" />
              </div>
              <div>
                <span className="text-xs text-yellow-500 font-semibold">COMPETITION</span>
                <h2 className="text-xl font-semibold">Leaderboard</h2>
              </div>
            </div>
            <div className="space-y-4 text-gray-300">
              <p>
                Track your ranking and compete with other traders on the leaderboard!
              </p>
              
              <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-afrodex-black-lighter rounded-lg p-4 text-center">
                  <Gift className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
                  <h4 className="font-semibold text-white">TGIF Weekly</h4>
                  <p className="text-xs text-gray-500 mt-1">Current week rankings with estimated rewards</p>
                </div>
                <div className="bg-afrodex-black-lighter rounded-lg p-4 text-center">
                  <Trophy className="w-8 h-8 text-afrodex-orange mx-auto mb-2" />
                  <h4 className="font-semibold text-white">All Time</h4>
                  <p className="text-xs text-gray-500 mt-1">Cumulative volume and total rewards earned</p>
                </div>
                <div className="bg-afrodex-black-lighter rounded-lg p-4 text-center">
                  <Medal className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                  <h4 className="font-semibold text-white">Badge Tiers</h4>
                  <p className="text-xs text-gray-500 mt-1">View all tiers and their multipliers</p>
                </div>
              </div>

              <div className="flex items-center gap-4 justify-center">
                <Link href="/leaderboard" className="btn-primary">
                  <Trophy className="w-4 h-4" />
                  View Leaderboard
                </Link>
              </div>

              <div className="bg-afrodex-black-lighter rounded-lg p-4">
                <h4 className="font-semibold text-white mb-2">📈 How to Climb the Ranks</h4>
                <ul className="text-sm space-y-1">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span>Execute more trades (takers earn, not makers)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span>Stake more AfroX for higher multipliers</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span>Trade consistently throughout the week</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span>Larger trades = more fees = higher weighted score</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Staking */}
          <section id="staking" className="card border-afrodex-orange/30">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <Star className="w-5 h-5 text-yellow-500" />
              </div>
              <div>
                <span className="text-xs text-yellow-500 font-semibold">STAKING</span>
                <h2 className="text-xl font-semibold">AfroX Staking</h2>
              </div>
            </div>
            <div className="space-y-4 text-gray-300">
              <p>
                Stake AfroX tokens to unlock badge tiers and earn TGIF reward multipliers. 
                Staking is done through the AfroX DeFi-Hub.
              </p>
              
              <div className="bg-gradient-to-r from-afrodex-orange/20 to-yellow-600/20 rounded-lg p-4 border border-afrodex-orange/30">
                <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                  <Star className="w-5 h-5 text-yellow-500" />
                  Stake Your AfroX
                </h4>
                <p className="text-sm mb-3">Visit the AfroX DeFi-Hub to stake your tokens and unlock badge multipliers:</p>
                <a 
                  href="https://defi.afrox.one/?ref=CFBD73A1" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="btn-primary inline-flex items-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open AfroX DeFi-Hub
                </a>
              </div>

              <div className="bg-afrodex-black-lighter rounded-lg p-4">
                <h4 className="font-semibold text-white mb-2">AfroX Token Contract</h4>
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="bg-black/30 px-2 py-1 rounded text-xs font-mono text-afrodex-orange">
                    0x08130635368AA28b217a4dfb68E1bF8dC525621C
                  </code>
                  <a 
                    href="https://etherscan.io/token/0x08130635368AA28b217a4dfb68E1bF8dC525621C" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-afrodex-orange hover:underline text-xs"
                  >
                    Etherscan ↗
                  </a>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                  <h4 className="font-semibold text-green-400 mb-2">✓ How Staking Works</h4>
                  <ul className="text-sm space-y-1">
                    <li>• Visit <a href="https://defi.afrox.one/?ref=CFBD73A1" target="_blank" rel="noopener noreferrer" className="text-afrodex-orange hover:underline">defi.afrox.one</a></li>
                    <li>• Connect your wallet and stake AfroX</li>
                    <li>• Your stake is read at weekly snapshot</li>
                    <li>• Higher stake = higher badge tier</li>
                  </ul>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                  <h4 className="font-semibold text-blue-400 mb-2">💡 Tips</h4>
                  <ul className="text-sm space-y-1">
                    <li>• Stake before Friday for that week&apos;s rewards</li>
                    <li>• Your badge shows in the sidebar</li>
                    <li>• Progress bar shows next tier</li>
                    <li>• Buy AfroX on AfroDex to stake!</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* ============================================ */}
          {/* END TGIF REWARDS SECTION */}
          {/* ============================================ */}

          <div className="border-t border-white/10 pt-8 mt-8"></div>

          {/* Step 6: Withdraw */}
          <section className="card">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-afrodex-orange/20 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-afrodex-orange" />
              </div>
              <div>
                <span className="text-xs text-afrodex-orange font-semibold">WITHDRAWALS</span>
                <h2 className="text-xl font-semibold">Withdraw Your Funds</h2>
              </div>
            </div>
            <div className="space-y-3 text-gray-300">
              <p>Withdraw your ETH and tokens back to your wallet at any time.</p>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>Go to the <strong>&ldquo;Balances&rdquo;</strong> section</li>
                <li>Click the <strong>&ldquo;Withdraw&rdquo;</strong> tab</li>
                <li>Enter the amount to withdraw</li>
                <li>Click <strong>&ldquo;Withdraw&rdquo;</strong></li>
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
                <span className="text-xs text-afrodex-orange font-semibold">ORDER MANAGEMENT</span>
                <h2 className="text-xl font-semibold">Cancel Orders</h2>
              </div>
            </div>
            <div className="space-y-3 text-gray-300">
              <p>You can cancel any open order at any time from the &ldquo;My Transactions&rdquo; section.</p>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>Find the <strong>&ldquo;My Transactions&rdquo;</strong> section below Recent Trades</li>
                <li>Click the <strong>&ldquo;Orders&rdquo;</strong> tab to see your open orders</li>
                <li>Each order shows a <strong>fill meter</strong> indicating how much has been executed</li>
                <li>Click the <strong>X</strong> button to cancel an order</li>
                <li>Only the remaining unfilled portion will be cancelled</li>
              </ol>
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-sm">
                <strong className="text-yellow-400">💡 Clear All:</strong> If you see &ldquo;already filled or cancelled&rdquo; errors, 
                use the &ldquo;Clear All&rdquo; button to remove stale orders and recreate them.
              </div>
            </div>
          </section>

          {/* Fee Schedule */}
          <section id="fees" className="card">
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
                    <th className="text-right py-2 text-gray-400 font-medium">TGIF Eligible</th>
                  </tr>
                </thead>
                <tbody className="text-gray-300">
                  <tr className="border-b border-white/5">
                    <td className="py-2">Deposit ETH or Token</td>
                    <td className="py-2 text-right text-green-400 font-semibold">FREE</td>
                    <td className="py-2 text-right text-gray-500">—</td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-2">Withdraw ETH or Token</td>
                    <td className="py-2 text-right text-green-400 font-semibold">FREE</td>
                    <td className="py-2 text-right text-gray-500">—</td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-2">Place Order (Maker)</td>
                    <td className="py-2 text-right text-green-400 font-semibold">FREE</td>
                    <td className="py-2 text-right text-gray-500">No</td>
                  </tr>
                  <tr>
                    <td className="py-2">Execute Order (Taker)</td>
                    <td className="py-2 text-right text-afrodex-orange font-semibold">0.3%</td>
                    <td className="py-2 text-right text-green-400 font-semibold">✓ Yes</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              * Gas fees for on-chain transactions are paid to Ethereum miners, not AfroDex.
              <br />
              * TGIF rewards are calculated from both gas fees and platform fees paid by takers.
            </p>
          </section>

          {/* Smart Contract */}
          <section className="card">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-afrodex-orange/20 flex items-center justify-center">
                <Shield className="w-5 h-5 text-afrodex-orange" />
              </div>
              <h2 className="text-xl font-semibold">Smart Contracts</h2>
            </div>
            <div className="space-y-4 text-gray-300">
              <div className="bg-afrodex-black-lighter rounded-lg p-4">
                <h4 className="font-semibold text-white mb-2">Exchange Contract</h4>
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="bg-black/30 px-2 py-1 rounded text-xs font-mono text-afrodex-orange">
                    0xe8fff15bb5e14095bfdfa8bb85d83cc900c23c56
                  </code>
                  <a 
                    href="https://etherscan.io/address/0xe8fff15bb5e14095bfdfa8bb85d83cc900c23c56" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-afrodex-orange hover:underline text-xs"
                  >
                    View on Etherscan ↗
                  </a>
                </div>
              </div>
              
              <div className="bg-afrodex-black-lighter rounded-lg p-4">
                <h4 className="font-semibold text-white mb-2">AfroX Token (Staking)</h4>
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="bg-black/30 px-2 py-1 rounded text-xs font-mono text-afrodex-orange">
                    0x08130635368AA28b217a4dfb68E1bF8dC525621C
                  </code>
                  <a 
                    href="https://etherscan.io/token/0x08130635368AA28b217a4dfb68E1bF8dC525621C" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-afrodex-orange hover:underline text-xs"
                  >
                    View on Etherscan ↗
                  </a>
                </div>
              </div>

              <p className="text-sm">This is an EtherDelta/ForkDelta-style order book contract with:</p>
              <ul className="space-y-1 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  Off-chain order placement (gasless signatures)
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  On-chain order signing and verification
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  Trustless trade execution
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  Direct peer-to-peer settlement
                </li>
              </ul>
            </div>
          </section>

        </div>

        {/* Footer CTA */}
        <div className="text-center mt-12 pt-8 border-t border-white/5">
          <h3 className="text-xl font-semibold mb-3">Ready to Start Trading?</h3>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link 
              href="/trade/AfroX-ETH" 
              className="btn-primary inline-flex items-center gap-2 px-8 py-3"
            >
              Launch AfroDex
              <ExternalLink className="w-4 h-4" />
            </Link>
            <Link 
              href="/leaderboard" 
              className="btn-secondary inline-flex items-center gap-2 px-8 py-3"
            >
              <Trophy className="w-4 h-4" />
              View Leaderboard
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-6 mt-12">
        <div className="max-w-4xl mx-auto px-4 text-center text-sm text-gray-500">
          <p>© 2019 - Present AfroDex. All rights reserved.</p>
          <p className="mt-1">
            Need help? Join our <a href="https://t.me/afrodex" className="text-afrodex-orange hover:underline">Telegram</a> community.
          </p>
        </div>
      </footer>
    </div>
  );
}
