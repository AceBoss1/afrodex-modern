# AfroDex - Modern Order Book DEX

![AfroDex Banner](public/afrodex_logo.jpg)

**Africa's Premier Decentralized Order Book Exchange** - A modern, responsive order book exchange built on Ethereum, featuring real-time trading, deposits, withdrawals, and self-listing capabilities.

## 🌟 Features

### Core Trading
- ✅ **Order Book Exchange** - EtherDelta/ForkDelta-style on-chain order matching
- ✅ **Real-time Updates** - Live order book and trade feed via WebSocket
- ✅ **Self-Listing** - Trade any ERC-20 token by entering its contract address
- ✅ **Interactive Charts** - Price charts with multiple timeframes (1H, 24H, 7D, ALL)
- ✅ **Trade History** - Complete historical trades from blockchain

### Wallet & Balance
- ✅ **WalletConnect v2** - Connect any Web3 wallet
- ✅ **Deposit/Withdraw** - Seamless fund management
- ✅ **Token Approval** - ERC-20 approval flow
- ✅ **Real-time Balances** - Auto-refreshing balance display

### User Experience
- ✅ **Modern UI** - Dark theme with neon orange accents
- ✅ **Responsive Design** - Works on desktop, tablet, and mobile
- ✅ **Token Info Cards** - Display token logos and metadata
- ✅ **Favorites** - Save your frequently traded tokens
- ✅ **Custom Tokens** - Add and persist unlisted tokens

## 🛠️ Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | TailwindCSS |
| Web3 | ethers.js v6, wagmi v2, viem |
| Wallet | WalletConnect v4 |
| State | Zustand |
| Charts | Recharts |
| Analytics | Supabase (optional) |
| RPC | Alchemy |
| Deployment | Vercel |

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Alchemy API key
- WalletConnect Project ID

### 1. Clone & Install

```bash
git clone https://github.com/your-username/afrodex-modern.git
cd afrodex-modern
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_ALCHEMY_API_KEY=your_alchemy_key
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_id
NEXT_PUBLIC_EXCHANGE_CONTRACT=0xe8fff15bb5e14095bfdfa8bb85d83cc900c23c56
NEXT_PUBLIC_CHAIN_ID=1
```

### 3. Add Token Logos

Place token images in `public/tokens/`:
- `afrodex_logo.jpg` - Main logo (in public/)
- Token logos (eth.png, afrox.png, etc.)
- `empty-token.png` - Fallback for unlisted tokens

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 📁 Project Structure

```
afrodex-modern/
├── app/
│   ├── layout.tsx          # Root layout with providers
│   ├── page.tsx            # Home (redirects to default pair)
│   ├── globals.css         # Global styles
│   └── trade/[pair]/
│       └── page.tsx        # Dynamic trading page
├── components/
│   ├── Web3Provider.tsx    # Wagmi + WalletConnect setup
│   ├── Sidebar.tsx         # Market selector
│   ├── TokenInfo.tsx       # Token details card
│   ├── TradingChart.tsx    # Price chart
│   ├── OrderBook.tsx       # Buy/sell orders
│   ├── TradeHistory.tsx    # Recent trades
│   ├── TradingPanel.tsx    # Place orders
│   └── BalancePanel.tsx    # Deposit/withdraw
├── lib/
│   ├── tokens.ts           # Token registry
│   ├── abi.ts              # Contract ABIs
│   ├── exchange.ts         # Contract interactions
│   ├── web3.ts             # Web3Modal config
│   ├── store.ts            # Zustand stores
│   ├── api.ts              # Order/trade fetching
│   └── supabase.ts         # Analytics (optional)
└── public/
    ├── afrodex_logo.jpg
    └── tokens/             # Token logos
```

## 🔧 Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_ALCHEMY_API_KEY` | Yes | Alchemy API key for RPC |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Yes | WalletConnect Cloud project ID |
| `NEXT_PUBLIC_EXCHANGE_CONTRACT` | Yes | Exchange contract address |
| `NEXT_PUBLIC_CHAIN_ID` | Yes | Network ID (1 = mainnet) |
| `NEXT_PUBLIC_SUPABASE_URL` | No | Supabase URL for analytics |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No | Supabase anonymous key |

### Adding New Tokens

Edit `lib/tokens.ts`:

```typescript
NEWTOKEN: {
  symbol: 'NEWTOKEN',
  name: 'New Token Name',
  address: '0x...',
  decimals: 18,
  logo: '/tokens/newtoken.png',
  description: 'Token description',
  etherscan: 'https://etherscan.io/token/0x...',
},
```

### Customizing Theme

Edit `tailwind.config.js` to change colors:

```javascript
colors: {
  afrodex: {
    orange: '#FF8C00',      // Primary brand color
    'orange-light': '#FFA540',
    'orange-dark': '#E67A00',
    black: '#0a0a0a',       // Background
  },
  trade: {
    buy: '#00D26A',         // Buy/bullish
    sell: '#FF4757',        // Sell/bearish
  },
}
```

## 🚢 Deployment

### Deploy to Vercel

1. Push to GitHub
2. Import in Vercel
3. Add environment variables
4. Deploy!

```bash
# Or use Vercel CLI
npm i -g vercel
vercel
```

### Environment Variables in Vercel

Add these in Project Settings → Environment Variables:
- `NEXT_PUBLIC_ALCHEMY_API_KEY`
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`
- `NEXT_PUBLIC_EXCHANGE_CONTRACT`
- `NEXT_PUBLIC_CHAIN_ID`

## 📖 Usage

### Trading Pairs

Access any pair via URL:
```
https://dex.afrox.one/trade/AfroX-ETH
https://dex.afrox.one/trade/PFARM-ETH
https://dex.afrox.one/trade/0x123...-ETH  # Custom token by address
```

### Self-Listing Tokens

1. Click "Add custom token" in sidebar
2. Paste the ERC-20 contract address
3. Click "Add Token"
4. Start trading!

### Placing Orders

1. Connect wallet
2. Deposit funds (ETH or tokens) to exchange
3. Set price and amount
4. Click Buy or Sell
5. Approve transaction in wallet

## 🔐 Smart Contract

**Exchange Contract:** `0xe8fff15bb5e14095bfdfa8bb85d83cc900c23c56`

This is an EtherDelta/ForkDelta-style order book contract with:
- On-chain order placement
- Off-chain order signing
- Trustless trade execution
- Direct settlement

### Key Functions

| Function | Description |
|----------|-------------|
| `deposit()` | Deposit ETH |
| `depositToken(token, amount)` | Deposit ERC-20 |
| `withdraw(amount)` | Withdraw ETH |
| `withdrawToken(token, amount)` | Withdraw ERC-20 |
| `order(...)` | Place order on-chain |
| `trade(...)` | Execute trade |
| `cancelOrder(...)` | Cancel order |

## 🐛 Troubleshooting

### Orders not appearing?
- Ensure connected to Ethereum Mainnet
- Check Alchemy API key is valid
- Wait for order events to be indexed

### Can't deposit tokens?
- Approve token first (automatic prompt)
- Check wallet has ETH for gas
- Verify token contract is valid

### Wallet won't connect?
- Check WalletConnect Project ID
- Try refreshing the page
- Clear browser cache

## 📄 License

MIT License - see [LICENSE](LICENSE)

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open Pull Request

## 🌍 About AfroDex

AfroDex is a blockchain tech community focused on developing and deploying free or affordable technologies for easier Ethereum and ERC-20 tokens mass adoption. Established in 2019, AfroDex has been facilitating decentralized trading for African and global tokens.

---

**Built with ❤️ for the decentralized future**
