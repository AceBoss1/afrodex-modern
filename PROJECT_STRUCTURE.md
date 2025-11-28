# AfroDex Project Structure

```
afrodex-modern/
├── app/                          # Next.js 14 App Router
│   ├── layout.tsx               # Root layout with Web3 providers
│   ├── page.tsx                 # Home page (redirects to default pair)
│   ├── globals.css              # Global styles with AfroDex theme
│   └── trade/
│       └── [pair]/
│           └── page.tsx         # Dynamic trading page
│
├── components/                   # React components
│   ├── Sidebar.tsx              # Collapsible sidebar with market selector
│   ├── TokenInfo.tsx            # Token information card
│   ├── TradingChart.tsx         # Price chart with timeframes
│   ├── OrderBook.tsx            # Buy/sell order book display
│   ├── TradeHistory.tsx         # Recent trades list
│   ├── TradingPanel.tsx         # Buy/sell order placement
│   └── BalancePanel.tsx         # Deposit/withdraw/balance management
│
├── lib/                         # Core libraries and utilities
│   ├── abi.ts                  # Exchange and ERC20 contract ABIs
│   ├── tokens.ts               # Token registry with metadata
│   ├── exchange.ts             # Exchange contract interactions
│   ├── web3.ts                 # Web3Modal and Wagmi configuration
│   ├── store.ts                # Zustand state management
│   └── api.ts                  # API utilities for orders and trades
│
├── public/                      # Static assets
│   ├── afrodex_logo.jpg        # Main AfroDex logo
│   └── tokens/                 # Token logo images
│       ├── eth.png
│       ├── afrox.png
│       ├── afdlts.png
│       ├── pfarm.png
│       ├── free.png
│       ├── plaas.png
│       ├── lwb.png
│       ├── t1c.png
│       ├── bct.png
│       ├── usdt.png
│       ├── busd.png
│       ├── dai.png
│       ├── weth.png
│       ├── empty-token.png     # Placeholder for unlisted tokens
│       └── README.md
│
├── .env.example                 # Environment variables template
├── .env.local                   # Your local environment (git-ignored)
├── .eslintrc.json              # ESLint configuration
├── .gitignore                  # Git ignore rules
├── next.config.js              # Next.js configuration
├── package.json                # Dependencies and scripts
├── postcss.config.js           # PostCSS configuration
├── tailwind.config.js          # TailwindCSS with AfroDex theme
├── tsconfig.json               # TypeScript configuration
├── setup.sh                    # Quick setup script
├── README.md                   # Main documentation
└── DEPLOYMENT.md               # Deployment guide
```

## Key Files Explained

### App Router (`app/`)

- **layout.tsx**: Root layout that wraps the entire app with Web3 providers (Wagmi, WalletConnect)
- **page.tsx**: Home page that redirects to the default trading pair (AfroX-ETH)
- **trade/[pair]/page.tsx**: Dynamic trading page that handles any TOKEN-ETH pair

### Components (`components/`)

Each component is self-contained and handles a specific part of the UI:

- **Sidebar**: Market selection, wallet connection, custom token addition
- **TokenInfo**: Displays token logo, name, description, and links
- **TradingChart**: Interactive price chart with 1H, 24H, 7D, and ALL timeframes
- **OrderBook**: Real-time buy/sell orders with price levels
- **TradeHistory**: List of recent trades with timestamps and links to Etherscan
- **TradingPanel**: Place buy/sell orders with price and amount inputs
- **BalancePanel**: Manage deposits, withdrawals, and view balances

### Libraries (`lib/`)

Core business logic and utilities:

- **abi.ts**: Contract ABIs for EtherDelta-style exchange and ERC20 tokens
- **tokens.ts**: Official token registry with all supported tokens
- **exchange.ts**: All exchange contract interactions (deposit, withdraw, trade, etc.)
- **web3.ts**: Web3Modal setup with WalletConnect integration
- **store.ts**: Zustand store for global state (orders, trades, balances, UI)
- **api.ts**: Functions to fetch orders and trades from blockchain events

### Styling

- **globals.css**: Custom CSS with neon-orange theme and animations
- **tailwind.config.js**: Extended Tailwind config with AfroDex colors

## Data Flow

### 1. Initial Load
```
User visits URL → Extract trading pair → Fetch token data → Load page
```

### 2. Trading Pair Selection
```
User selects token → Update store → Fetch orders → Fetch trades → Update UI
```

### 3. Placing an Order
```
User enters price/amount → Approve if needed → Place order → Transaction → Update order book
```

### 4. Depositing Funds
```
User enters amount → Approve token → Deposit to exchange → Update balance
```

### 5. Real-time Updates
```
Smart contract event → Web3 listener → Add to store → Update UI
```

## State Management

The app uses Zustand for state management with the following stores:

- **Trading Pair**: Currently selected base and quote tokens
- **Orders**: Buy and sell orders from the order book
- **Trades**: Historical trade data
- **Balances**: Wallet and exchange balances for each token
- **UI State**: Sidebar open/closed, active tab, loading states

## External Dependencies

### Critical
- **Ethers.js**: Ethereum interactions
- **Wagmi**: React hooks for Ethereum
- **WalletConnect**: Wallet connection
- **Next.js**: React framework
- **TailwindCSS**: Styling

### Supporting
- **Recharts**: Charts
- **Zustand**: State management
- **date-fns**: Date formatting
- **Lucide React**: Icons

## Smart Contract Integration

The app integrates with an existing EtherDelta-style exchange contract:

**Contract Address**: `0xe8fff15bb5e14095bfdfa8bb85d83cc900c23c56`

### Key Functions Used:
- `deposit()` - Deposit ETH
- `depositToken(address, uint256)` - Deposit tokens
- `withdraw(uint256)` - Withdraw ETH
- `withdrawToken(address, uint256)` - Withdraw tokens
- `order(...)` - Place order
- `trade(...)` - Execute trade
- `balanceOf(address, address)` - Check balance

### Events Monitored:
- `Order` - New orders placed
- `Trade` - Trades executed
- `Deposit` - Funds deposited
- `Withdraw` - Funds withdrawn

## Development Workflow

1. **Local Development**
   ```bash
   npm run dev
   ```

2. **Build for Production**
   ```bash
   npm run build
   npm start
   ```

3. **Lint Code**
   ```bash
   npm run lint
   ```

## Environment Variables

Required:
- `NEXT_PUBLIC_ALCHEMY_API_KEY` - Alchemy RPC provider
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` - WalletConnect integration
- `NEXT_PUBLIC_EXCHANGE_CONTRACT` - Exchange contract address
- `NEXT_PUBLIC_CHAIN_ID` - Network ID (1 for mainnet)

Optional:
- `NEXT_PUBLIC_SUPABASE_URL` - For analytics
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - For analytics

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Performance Considerations

- Order book updates every 30 seconds
- Balance updates every 10 seconds
- Real-time trade updates via WebSocket
- Image optimization via Next.js
- Code splitting via dynamic imports
- Edge deployment via Vercel

## Security Features

- Client-side only (no backend API keys exposed)
- All sensitive operations require user signature
- No private keys stored
- WalletConnect secure connection
- Environment variables for API keys
- Content Security Policy headers

## Future Enhancements

- [ ] Advanced order types (limit, market, stop-loss)
- [ ] Portfolio tracking
- [ ] Trading analytics dashboard
- [ ] Mobile app (React Native)
- [ ] Multi-language support
- [ ] Advanced charting (TradingView integration)
- [ ] Order book depth charts
- [ ] Price alerts
- [ ] API for third-party integrations
- [ ] Governance token integration
