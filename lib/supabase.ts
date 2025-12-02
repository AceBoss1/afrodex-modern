// lib/supabase.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Create Supabase client if configured
export const supabase: SupabaseClient | null = 
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

// Analytics types
export interface TradeAnalytics {
  id?: number;
  tx_hash: string;
  base_token: string;
  quote_token: string;
  price: number;
  amount: number;
  side: 'buy' | 'sell';
  maker: string;
  taker: string;
  timestamp: string;
}

export interface PairStats {
  pair: string;
  volume_24h: number;
  trades_24h: number;
  price_change_24h: number;
  high_24h: number;
  low_24h: number;
  last_price: number;
}

/**
 * Log a trade for analytics
 */
export async function logTrade(trade: TradeAnalytics): Promise<void> {
  if (!supabase) return;
  
  try {
    await supabase.from('trades').insert([trade]);
  } catch (error) {
    console.error('Error logging trade:', error);
  }
}

/**
 * Get 24h stats for a pair
 */
export async function getPairStats(
  baseToken: string,
  quoteToken: string
): Promise<PairStats | null> {
  if (!supabase) return null;
  
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .eq('base_token', baseToken)
      .eq('quote_token', quoteToken)
      .gte('timestamp', oneDayAgo)
      .order('timestamp', { ascending: true });
    
    if (error || !data || data.length === 0) {
      return null;
    }
    
    const prices = data.map((t) => t.price);
    const firstPrice = prices[0];
    const lastPrice = prices[prices.length - 1];
    
    return {
      pair: `${baseToken}-${quoteToken}`,
      volume_24h: data.reduce((sum, t) => sum + t.amount * t.price, 0),
      trades_24h: data.length,
      price_change_24h: firstPrice > 0 ? ((lastPrice - firstPrice) / firstPrice) * 100 : 0,
      high_24h: Math.max(...prices),
      low_24h: Math.min(...prices),
      last_price: lastPrice,
    };
  } catch (error) {
    console.error('Error getting pair stats:', error);
    return null;
  }
}

/**
 * Get recent trades for a pair from Supabase
 */
export async function getRecentTrades(
  baseToken: string,
  quoteToken: string,
  limit: number = 50
): Promise<TradeAnalytics[]> {
  if (!supabase) return [];
  
  try {
    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .eq('base_token', baseToken)
      .eq('quote_token', quoteToken)
      .order('timestamp', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('Error fetching trades:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Error getting recent trades:', error);
    return [];
  }
}

/**
 * Track page view
 */
export async function trackPageView(
  page: string,
  metadata?: Record<string, any>
): Promise<void> {
  if (!supabase) return;
  
  try {
    await supabase.from('page_views').insert([
      {
        page,
        metadata,
        timestamp: new Date().toISOString(),
      },
    ]);
  } catch (error) {
    // Silently fail analytics
  }
}

export default supabase;
