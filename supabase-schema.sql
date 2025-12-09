-- AfroDex Supabase Schema
-- Run this in your Supabase SQL Editor to set up the database

-- ============================================
-- ORDERS TABLE
-- Stores all orders from blockchain events
-- ============================================
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  token_get VARCHAR(42) NOT NULL,
  amount_get TEXT NOT NULL,
  token_give VARCHAR(42) NOT NULL,
  amount_give TEXT NOT NULL,
  expires TEXT NOT NULL,
  nonce TEXT NOT NULL,
  user_address VARCHAR(42) NOT NULL,
  block_number BIGINT NOT NULL,
  tx_hash VARCHAR(66) NOT NULL,
  side VARCHAR(4) NOT NULL, -- 'buy' or 'sell'
  price DECIMAL(38, 18),
  is_active BOOLEAN DEFAULT true,
  amount_filled TEXT DEFAULT '0',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Composite unique constraint
  UNIQUE(token_get, token_give, nonce, user_address)
);

-- Indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_orders_pair ON orders(token_get, token_give);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_address);
CREATE INDEX IF NOT EXISTS idx_orders_active ON orders(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_orders_block ON orders(block_number);
CREATE INDEX IF NOT EXISTS idx_orders_expires ON orders(expires);

-- ============================================
-- TRADES TABLE
-- Stores all executed trades from blockchain events
-- ============================================
CREATE TABLE IF NOT EXISTS trades (
  id SERIAL PRIMARY KEY,
  tx_hash VARCHAR(66) NOT NULL,
  block_number BIGINT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  token_get VARCHAR(42) NOT NULL,
  amount_get TEXT NOT NULL,
  token_give VARCHAR(42) NOT NULL,
  amount_give TEXT NOT NULL,
  maker VARCHAR(42) NOT NULL,
  taker VARCHAR(42) NOT NULL,
  side VARCHAR(4) NOT NULL, -- 'buy' or 'sell'
  price DECIMAL(38, 18) NOT NULL,
  base_amount DECIMAL(38, 18) NOT NULL,
  quote_amount DECIMAL(38, 18) NOT NULL,
  base_token VARCHAR(42) NOT NULL,
  quote_token VARCHAR(42) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint on tx_hash + log index
  UNIQUE(tx_hash, token_get, amount_get, maker)
);

-- Indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_trades_pair ON trades(base_token, quote_token);
CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_trades_block ON trades(block_number);
CREATE INDEX IF NOT EXISTS idx_trades_maker ON trades(maker);
CREATE INDEX IF NOT EXISTS idx_trades_taker ON trades(taker);

-- ============================================
-- SYNC STATUS TABLE
-- Tracks blockchain sync progress
-- ============================================
CREATE TABLE IF NOT EXISTS sync_status (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(20) NOT NULL, -- 'orders' or 'trades'
  last_synced_block BIGINT NOT NULL,
  last_sync_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(event_type)
);

-- Initialize sync status
INSERT INTO sync_status (event_type, last_synced_block) 
VALUES ('orders', 9100009), ('trades', 9100009)
ON CONFLICT (event_type) DO NOTHING;

-- ============================================
-- TOKENS TABLE (Optional - for caching token info)
-- ============================================
CREATE TABLE IF NOT EXISTS tokens (
  address VARCHAR(42) PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL,
  name VARCHAR(100),
  decimals INTEGER NOT NULL DEFAULT 18,
  is_official BOOLEAN DEFAULT false,
  logo_url TEXT,
  website TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- PAIR STATS VIEW
-- Aggregated 24h statistics for trading pairs
-- ============================================
CREATE OR REPLACE VIEW pair_stats_24h AS
SELECT 
  base_token,
  quote_token,
  COUNT(*) as trades_24h,
  SUM(quote_amount) as volume_24h,
  MIN(price) as low_24h,
  MAX(price) as high_24h,
  (ARRAY_AGG(price ORDER BY timestamp DESC))[1] as last_price,
  (ARRAY_AGG(price ORDER BY timestamp ASC))[1] as first_price
FROM trades
WHERE timestamp > NOW() - INTERVAL '24 hours'
GROUP BY base_token, quote_token;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE tokens ENABLE ROW LEVEL SECURITY;

-- Public read access for all tables
CREATE POLICY "Public read access for orders" ON orders FOR SELECT USING (true);
CREATE POLICY "Public read access for trades" ON trades FOR SELECT USING (true);
CREATE POLICY "Public read access for sync_status" ON sync_status FOR SELECT USING (true);
CREATE POLICY "Public read access for tokens" ON tokens FOR SELECT USING (true);

-- Service role can insert/update/delete
CREATE POLICY "Service role full access orders" ON orders FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access trades" ON trades FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access sync_status" ON sync_status FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access tokens" ON tokens FOR ALL USING (auth.role() = 'service_role');

-- Allow anonymous inserts (for frontend syncing)
CREATE POLICY "Anon insert orders" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Anon insert trades" ON trades FOR INSERT WITH CHECK (true);
CREATE POLICY "Anon update sync_status" ON sync_status FOR UPDATE USING (true);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to get active orders for a pair
CREATE OR REPLACE FUNCTION get_active_orders(
  p_base_token VARCHAR(42),
  p_quote_token VARCHAR(42),
  p_current_block BIGINT
)
RETURNS TABLE (
  token_get VARCHAR(42),
  amount_get TEXT,
  token_give VARCHAR(42),
  amount_give TEXT,
  expires TEXT,
  nonce TEXT,
  user_address VARCHAR(42),
  side VARCHAR(4),
  price DECIMAL(38, 18),
  amount_filled TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.token_get,
    o.amount_get,
    o.token_give,
    o.amount_give,
    o.expires,
    o.nonce,
    o.user_address,
    o.side,
    o.price,
    o.amount_filled
  FROM orders o
  WHERE o.is_active = true
    AND o.expires::BIGINT > p_current_block
    AND (
      (o.token_get = p_base_token AND o.token_give = p_quote_token)
      OR (o.token_get = p_quote_token AND o.token_give = p_base_token)
    )
  ORDER BY 
    CASE WHEN o.side = 'buy' THEN o.price END DESC,
    CASE WHEN o.side = 'sell' THEN o.price END ASC;
END;
$$ LANGUAGE plpgsql;

-- Function to get recent trades for a pair
CREATE OR REPLACE FUNCTION get_recent_trades(
  p_base_token VARCHAR(42),
  p_quote_token VARCHAR(42),
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  tx_hash VARCHAR(66),
  block_number BIGINT,
  timestamp TIMESTAMP WITH TIME ZONE,
  side VARCHAR(4),
  price DECIMAL(38, 18),
  base_amount DECIMAL(38, 18),
  quote_amount DECIMAL(38, 18),
  maker VARCHAR(42),
  taker VARCHAR(42)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.tx_hash,
    t.block_number,
    t.timestamp,
    t.side,
    t.price,
    t.base_amount,
    t.quote_amount,
    t.maker,
    t.taker
  FROM trades t
  WHERE t.base_token = p_base_token
    AND t.quote_token = p_quote_token
  ORDER BY t.timestamp DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
