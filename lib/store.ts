// lib/store.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Token, SUPPORTED_TOKENS, ZERO_ADDRESS } from './tokens';
import { Order, Trade, Balance } from './exchange';

// ============================================
// Trading Store
// ============================================

interface TradingState {
  // Selected trading pair
  baseToken: Token | null;
  quoteToken: Token;
  
  // Order book
  buyOrders: Order[];
  sellOrders: Order[];
  
  // Trade history
  trades: Trade[];
  
  // Balances
  balances: Record<string, Balance>;
  
  // Loading states
  isLoadingOrders: boolean;
  isLoadingTrades: boolean;
  isLoadingBalances: boolean;
  
  // Actions
  setTradingPair: (base: Token, quote: Token) => void;
  setOrders: (buy: Order[], sell: Order[]) => void;
  addOrder: (order: Order, side: 'buy' | 'sell') => void;
  removeOrder: (orderHash: string) => void;
  setTrades: (trades: Trade[]) => void;
  addTrade: (trade: Trade) => void;
  setBalance: (tokenAddress: string, wallet: string, exchange: string) => void;
  setLoadingOrders: (loading: boolean) => void;
  setLoadingTrades: (loading: boolean) => void;
  setLoadingBalances: (loading: boolean) => void;
  clearTradingData: () => void;
}

export const useTradingStore = create<TradingState>((set, get) => ({
  // Initial state
  baseToken: null,
  quoteToken: SUPPORTED_TOKENS.ETH,
  buyOrders: [],
  sellOrders: [],
  trades: [],
  balances: {},
  isLoadingOrders: false,
  isLoadingTrades: false,
  isLoadingBalances: false,

  // Actions
  setTradingPair: (base, quote) => {
    set({
      baseToken: base,
      quoteToken: quote,
      buyOrders: [],
      sellOrders: [],
      trades: [],
    });
  },

  setOrders: (buy, sell) => {
    set({ buyOrders: buy, sellOrders: sell });
  },

  addOrder: (order, side) => {
    set((state) => {
      if (side === 'buy') {
        const orders = [...state.buyOrders, order].sort(
          (a, b) => (b.price || 0) - (a.price || 0)
        );
        return { buyOrders: orders };
      } else {
        const orders = [...state.sellOrders, order].sort(
          (a, b) => (a.price || 0) - (b.price || 0)
        );
        return { sellOrders: orders };
      }
    });
  },

  removeOrder: (orderHash) => {
    set((state) => ({
      buyOrders: state.buyOrders.filter((o) => o.hash !== orderHash),
      sellOrders: state.sellOrders.filter((o) => o.hash !== orderHash),
    }));
  },

  setTrades: (trades) => {
    set({ trades });
  },

  addTrade: (trade) => {
    set((state) => ({
      trades: [trade, ...state.trades].slice(0, 100), // Keep last 100 trades
    }));
  },

  setBalance: (tokenAddress, wallet, exchange) => {
    set((state) => ({
      balances: {
        ...state.balances,
        [tokenAddress.toLowerCase()]: { wallet, exchange },
      },
    }));
  },

  setLoadingOrders: (loading) => set({ isLoadingOrders: loading }),
  setLoadingTrades: (loading) => set({ isLoadingTrades: loading }),
  setLoadingBalances: (loading) => set({ isLoadingBalances: loading }),

  clearTradingData: () => {
    set({
      buyOrders: [],
      sellOrders: [],
      trades: [],
    });
  },
}));

// ============================================
// UI Store
// ============================================

interface UIState {
  // Sidebar
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  
  // Active tabs
  orderTab: 'buy' | 'sell';
  balanceTab: 'deposit' | 'withdraw';
  setOrderTab: (tab: 'buy' | 'sell') => void;
  setBalanceTab: (tab: 'deposit' | 'withdraw') => void;
  
  // Selected price (when clicking order book)
  selectedPrice: string | null;
  setSelectedPrice: (price: string | null) => void;
  
  // Notifications
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
}

interface Notification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message?: string;
  duration?: number;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  orderTab: 'buy',
  balanceTab: 'deposit',
  selectedPrice: null,
  notifications: [],

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  
  setOrderTab: (tab) => set({ orderTab: tab }),
  setBalanceTab: (tab) => set({ balanceTab: tab }),
  
  setSelectedPrice: (price) => set({ selectedPrice: price }),

  addNotification: (notification) => {
    const id = Math.random().toString(36).substring(7);
    set((state) => ({
      notifications: [...state.notifications, { ...notification, id }],
    }));
    
    // Auto-remove after duration
    if (notification.duration !== 0) {
      setTimeout(() => {
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        }));
      }, notification.duration || 5000);
    }
  },

  removeNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  },
}));

// ============================================
// Custom Tokens Store (persisted)
// ============================================

interface CustomTokensState {
  customTokens: Token[];
  addCustomToken: (token: Token) => void;
  removeCustomToken: (address: string) => void;
  getCustomToken: (address: string) => Token | undefined;
}

export const useCustomTokensStore = create<CustomTokensState>()(
  persist(
    (set, get) => ({
      customTokens: [],

      addCustomToken: (token) => {
        set((state) => {
          // Don't add duplicates
          if (state.customTokens.find(
            (t) => t.address.toLowerCase() === token.address.toLowerCase()
          )) {
            return state;
          }
          return { customTokens: [...state.customTokens, token] };
        });
      },

      removeCustomToken: (address) => {
        set((state) => ({
          customTokens: state.customTokens.filter(
            (t) => t.address.toLowerCase() !== address.toLowerCase()
          ),
        }));
      },

      getCustomToken: (address) => {
        return get().customTokens.find(
          (t) => t.address.toLowerCase() === address.toLowerCase()
        );
      },
    }),
    {
      name: 'afrodex-custom-tokens',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

// ============================================
// Favorites Store (persisted)
// ============================================

interface FavoritesState {
  favorites: string[]; // Token addresses
  addFavorite: (address: string) => void;
  removeFavorite: (address: string) => void;
  isFavorite: (address: string) => boolean;
}

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      favorites: [],

      addFavorite: (address) => {
        set((state) => {
          if (state.favorites.includes(address.toLowerCase())) {
            return state;
          }
          return { favorites: [...state.favorites, address.toLowerCase()] };
        });
      },

      removeFavorite: (address) => {
        set((state) => ({
          favorites: state.favorites.filter(
            (f) => f !== address.toLowerCase()
          ),
        }));
      },

      isFavorite: (address) => {
        return get().favorites.includes(address.toLowerCase());
      },
    }),
    {
      name: 'afrodex-favorites',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

// Legacy export for compatibility
export const useAppStore = useTradingStore;
