# AfroDex - Modern Order Book DEX

![AfroDex Logo](public/afrodex_logo.jpg)

**Africa's Biggest Decentralized Exchange** - A modern, responsive order book exchange built on Ethereum, featuring real-time trading, deposits, withdrawals, and self-listing capabilities.

## 🌟 Features

### Core Trading Features
- ✅ **Order Book Exchange** - ForkDelta/EtherDelta style on-chain order matching
- ✅ **Real-time Trading** - Live order book updates and trade execution
- ✅ **Self-Listing** - Any token can be listed by searching its contract address
- ✅ **Trading Charts** - Interactive price charts with multiple timeframes
- ✅ **Trade History** - Complete historical trade data from blockchain
- ✅ **Market Depth** - Visualize buy and sell order books

### Wallet & Balance Management
- ✅ **WalletConnect Integration** - Connect any Web3 wallet
- ✅ **Deposit/Withdraw** - Move funds between wallet and exchange
- ✅ **Balance Display** - Real-time wallet and exchange balances
- ✅ **Token Approval** - Seamless ERC-20 approval flow

### UI/UX
- ✅ **Responsive Design** - Works on desktop, tablet, and mobile
- ✅ **Neon Orange Theme** - Distinctive AfroDex branding with dark mode
- ✅ **Collapsible Sidebar** - Market selector with search functionality
- ✅ **Token Info Cards** - Display token logos and metadata

## 🏗️ Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: TailwindCSS with custom AfroDex theme
- **Web3**: Ethers.js v6, Wagmi, WalletConnect
- **Charts**: Recharts
- **State**: Zustand
- **Deployment**: Vercel
- **Backend**: Alchemy (Ethereum RPC), Supabase (optional analytics)

## 📋 Prerequisites

Before you begin, ensure you have:
- Node.js 18+ installed
- An Alchemy API key ([Get one here](https://www.alchemy.com/))
- A WalletConnect Project ID ([Get one here](https://cloud.walletconnect.com/))
- (Optional) Supabase account for analytics

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/afrodex-modern.git
cd afrodex-modern
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env.local` file in the root directory:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials:

```env
# Alchemy API Key (Required)
NEXT_PUBLIC_ALCHEMY_API_KEY=your_alchemy_key_here

# WalletConnect Project ID (Required)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id

# Exchange Contract (Pre-configured)
NEXT_PUBLIC_EXCHANGE_CONTRACT=0xe8fff15bb5e14095bfdfa8bb85d83cc900c23c56

# Network (1 = Ethereum Mainnet)
NEXT_PUBLIC_CHAIN_ID=1

# Supabase (Optional - for analytics)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
```

### 4. Add Assets

Place the following files in the `public` directory:

```
public/
├── afrodex_logo.jpg          # Main AfroDex logo
└── tokens/
    ├── eth.png               # Ethereum logo
    ├── afrox.png             # AfroX token logo
    ├── afdlts.png            # AFDLT logo
    ├── pfarm.png             # PFARM logo
    ├── free.png              # FREE logo
    ├── plaas.png             # PLAAS logo
    ├── lwb.png               # LWBT logo
    ├── t1c.png               # T1C logo
    ├── bct.png               # BCT logo
    ├── usdt.png              # USDT logo
    ├── busd.png              # BUSD logo
    ├── dai.png               # DAI logo
    ├── weth.png              # WETH logo
    └── empty-token.png       # Placeholder for unlisted tokens
```

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📱 Usage

### Trading a Token Pair

1. **Connect Wallet**: Click "Connect Wallet" in the sidebar
2. **Select Market**: Search for a token in the sidebar or paste a contract address
3. **View Market**: See order book, chart, and recent trades
4. **Deposit Funds**: Use the Balance panel to deposit ETH or tokens
5. **Place Order**: Enter price and amount, then click Buy/Sell
6. **Execute Trades**: Your order appears in the order book for others to fill

### Self-Listing a Token

1. Click "+ Add custom token by address" in the sidebar
2. Paste the ERC-20 token contract address
3. Click "Add"
4. The token pair (TOKEN/ETH) will be available for trading

### URL Structure

Access any trading pair directly:
```
https://dex.afrox.one/trade/AfroX-ETH
https://dex.afrox.one/trade/PFARM-ETH
https://dex.afrox.one/trade/CUSTOM-ETH
```

## 🔧 Contract Information

- **Exchange Contract**: `0xe8fff15bb5e14095bfdfa8bb85d83cc900c23c56`
- **Type**: EtherDelta/ForkDelta style order book
- **Network**: Ethereum Mainnet
- **Active Since**: 2019

### Contract Functions

- `deposit()` - Deposit ETH
- `depositToken(address, uint256)` - Deposit ERC-20 tokens
- `withdraw(uint256)` - Withdraw ETH
- `withdrawToken(address, uint256)` - Withdraw ERC-20 tokens
- `order(...)` - Place a new order
- `trade(...)` - Execute a trade against an existing order
- `cancelOrder(...)` - Cancel your order

## 📦 Build for Production

```bash
npm run build
npm start
```

## 🚢 Deploy to Vercel

1. Push your code to GitHub
2. Import project in Vercel
3. Add environment variables in Vercel dashboard
4. Deploy!

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-username/afrodex-modern)

## 🎨 Customization

### Adding New Tokens

Edit `lib/tokens.ts`:

```typescript
export const SUPPORTED_TOKENS: Record<string, Token> = {
  // ... existing tokens
  NEWTOKEN: {
    symbol: 'NEWTOKEN',
    name: 'New Token Name',
    address: '0x...',
    decimals: 18,
    logo: '/tokens/newtoken.png',
    description: 'Token description',
    etherscan: 'https://etherscan.io/token/0x...',
    tracker: 'https://coinmarketcap.com/currencies/newtoken/',
  },
};
```

### Changing Theme Colors

Edit `tailwind.config.js`:

```javascript
colors: {
  afrodex: {
    orange: '#FF8C00',        // Main brand color
    'orange-light': '#FFA500',
    'orange-dark': '#FF6600',
    black: '#0a0a0a',         // Background
    'black-light': '#1a1a1a',
    'black-lighter': '#2a2a2a',
  },
}
```

## 🔍 Troubleshooting

### Orders not appearing?
- Ensure you're connected to Ethereum Mainnet
- Check that the exchange contract has existing orders for this pair
- Verify your Alchemy API key is working

### Can't deposit tokens?
- Make sure you approve the token first
- Check your wallet balance
- Ensure you have ETH for gas fees

### Trades not executing?
- Verify you have deposited funds to the exchange
- Check that the order is still valid (not expired)
- Ensure you have sufficient exchange balance

## 📚 Resources

- [EtherDelta Documentation](https://github.com/etherdelta/etherdelta.github.io)
- [Ethers.js Docs](https://docs.ethers.org/)
- [WalletConnect Docs](https://docs.walletconnect.com/)
- [Next.js Docs](https://nextjs.org/docs)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License - see LICENSE file for details

## 🌍 About AfroDex

AfroDex serves as a blockchain tech community focused on developing and deploying free or affordable technologies for easier Ethereum and ERC-20 tokens mass adoption. Established in 2019, AfroDex has been facilitating decentralized trading for African and global tokens.

---

**Built with ❤️ for the decentralized future**
