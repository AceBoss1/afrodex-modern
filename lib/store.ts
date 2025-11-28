// lib/store.ts
import { create } from 'zustand';
import { Token } from './tokens';
import { Order, Trade } from './exchange';

interface AppState {
  // Selected trading pair
  baseToken: Token | null;
  quoteToken: Token | null;
  setTradingPair: (base: Token, quote: Token) => void;
  
  // Orders
  buyOrders: Order[];
  sellOrders: Order[];
  setOrders: (buy: Order[], sell: Order[]) => void;
  
  // Trades
  trades: Trade[];
  setTrades: (trades: Trade[]) => void;
  addTrade: (trade: Trade) => void;
  
  // User balances
  balances: Record<string, { wallet: string; exchange: string }>;
  setBalance: (tokenAddress: string, wallet: string, exchange: string) => void;
  
  // UI state
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  activeTab: 'deposit' | 'withdraw' | 'transfer';
  setActiveTab: (tab: 'deposit' | 'withdraw' | 'transfer') => void;
  
  // Loading states
  isLoadingOrders: boolean;
  isLoadingTrades: boolean;
  setLoadingOrders: (loading: boolean) => void;
  setLoadingTrades: (loading: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Trading pair
  baseToken: null,
  quoteToken: null,
  setTradingPair: (base, quote) => set({ baseToken: base, quoteToken: quote }),
  
  // Orders
  buyOrders: [],
  sellOrders: [],
  setOrders: (buy, sell) => set({ buyOrders: buy, sellOrders: sell }),
  
  // Trades
  trades: [],
  setTrades: (trades) => set({ trades }),
  addTrade: (trade) => set((state) => ({ trades: [trade, ...state.trades] })),
  
  // Balances
  balances: {},
  setBalance: (tokenAddress, wallet, exchange) => 
    set((state) => ({
      balances: { ...state.balances, [tokenAddress]: { wallet, exchange } }
    })),
  
  // UI
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  activeTab: 'deposit',
  setActiveTab: (tab) => set({ activeTab: tab }),
  
  // Loading
  isLoadingOrders: false,
  isLoadingTrades: false,
  setLoadingOrders: (loading) => set({ isLoadingOrders: loading }),
  setLoadingTrades: (loading) => set({ isLoadingTrades: loading }),
}));
