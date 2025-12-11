// lib/store.ts
import { create } from 'zustand';

export interface Order {
  tokenGet: string;
  amountGet: string;
  tokenGive: string;
  amountGive: string;
  expires: string;
  nonce: string;
  user: string;
  v?: number;
  r?: string;
  s?: string;
  hash?: string;
  price?: number;
  side?: 'buy' | 'sell';
  availableVolume?: string;
  amountFilled?: string;
}

export interface Trade {
  txHash: string;
  blockNumber: number;
  timestamp: number;
  tokenGet: string;
  amountGet: string;
  tokenGive: string;
  amountGive: string;
  maker: string;
  taker: string;
  price?: number;
  side?: 'buy' | 'sell';
  baseAmount?: number;
  quoteAmount?: number;
}

interface TradingState {
  buyOrders: Order[];
  sellOrders: Order[];
  trades: Trade[];
  isLoadingOrders: boolean;
  isLoadingTrades: boolean;
  
  // Actions
  setOrders: (buyOrders: Order[], sellOrders: Order[]) => void;
  setTrades: (trades: Trade[]) => void;
  addTrade: (trade: Trade) => void;
  setLoadingOrders: (loading: boolean) => void;
  setLoadingTrades: (loading: boolean) => void;
  clearAll: () => void;
}

export const useTradingStore = create<TradingState>((set) => ({
  buyOrders: [],
  sellOrders: [],
  trades: [],
  isLoadingOrders: false,
  isLoadingTrades: false,
  
  setOrders: (buyOrders, sellOrders) => set({ buyOrders, sellOrders }),
  
  setTrades: (trades) => set({ trades }),
  
  addTrade: (trade) => set((state) => ({
    trades: [trade, ...state.trades].slice(0, 100), // Keep last 100 trades
  })),
  
  setLoadingOrders: (loading) => set({ isLoadingOrders: loading }),
  
  setLoadingTrades: (loading) => set({ isLoadingTrades: loading }),
  
  clearAll: () => set({
    buyOrders: [],
    sellOrders: [],
    trades: [],
  }),
}));

// UI State store
interface UIState {
  selectedPrice: string;
  selectedAmount: string;
  orderTab: 'buy' | 'sell';
  
  setSelectedPrice: (price: string) => void;
  setSelectedAmount: (amount: string) => void;
  setOrderTab: (tab: 'buy' | 'sell') => void;
}

export const useUIStore = create<UIState>((set) => ({
  selectedPrice: '',
  selectedAmount: '',
  orderTab: 'buy',
  
  setSelectedPrice: (price) => set({ selectedPrice: price }),
  setSelectedAmount: (amount) => set({ selectedAmount: amount }),
  setOrderTab: (tab) => set({ orderTab: tab }),
}));
