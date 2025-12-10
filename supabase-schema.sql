-- ============================================
-- AfroDex Supabase Database Schema
-- Run this in Supabase SQL Editor
-- ============================================
-- AfroDex uses OFF-CHAIN orderbook with ON-CHAIN settlement
-- Orders are signed (gasless) and stored here
-- Trades execute on-chain when orders are matched

-- Drop existing tables if they exist (for clean setup)
DROP TABLE IF EXISTS trades CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS sync_status CASCADE;
DROP TABLE IF EXISTS tokens CASCADE;

-- ============================================
-- TOKENS TABLE
-- ============================================
CREATE TABLE tokens (
  id SERIAL PRIMARY KEY,
  address TEXT NOT NULL UNIQUE,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  decimals INTEGER NOT NULL DEFAULT 18,
  logo_url TEXT,
  is_official BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert official tokens with CORRECT decimals
INSERT INTO tokens (address, symbol, name, decimals, is_official) VALUES
  ('0x0000000000000000000000000000000000000000', 'ETH', 'Ethereum', 18, true),
  ('0x08130635368aa28b217a4dfb68e1bf8dc525621c', 'AfroX', 'AfroDex', 4, true),
  ('0xd8a8843b0a5aba6b030e92b3f4d669fad8a5be50', 'AFDLT', 'AfroDex Labs Token', 4, true),
  ('0x6a8c66cab4f766e5e30b4e9445582094303cc322', 'PFARM', 'PFARM', 18, true),
  ('0x2f141ce366a2462f02cea3d12cf93e4dca49e4fd', 'FREE', 'FREE Coin', 18, true),
  ('0x60571e95e12c78cba5223042692908f0649435a5', 'PLAAS', 'PLAAS Farmers Token', 18, true),
  ('0xa03c34ee9fa0e8db36dd9bf8d46631bb25f66302', 'LWBT', 'Living Without Borders Token', 8, true),
  ('0xa7c71d444bf9af4bfed2ade75595d7512eb4dd39', 'T1C', 'Travel1Click', 16, true),
  ('0x9ec251401eafb7e98f37a1d911c0aea02cb63a80', 'BCT', 'Bitcratic Token', 18, true)
ON CONFLICT (address) DO NOTHING;

-- ============================================
-- ORDERS TABLE (Off-chain orderbook)
-- ============================================
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  tx_hash TEXT NOT NULL,           -- For off-chain orders, this is the order_hash
  log_index INTEGER DEFAULT 0,
  token_get TEXT NOT NULL,
  amount_get TEXT NOT NULL,
  token_give TEXT NOT NULL,
  amount_give TEXT NOT NULL,
  expires TEXT NOT NULL,
  nonce TEXT NOT NULL,
  user_address TEXT NOT NULL,
  block_number BIGINT DEFAULT 0,   -- 0 for off-chain orders
  base_token TEXT NOT NULL,
  quote_token TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
  price DOUBLE PRECISION,
  base_amount DOUBLE PRECISION,
  quote_amount DOUBLE PRECISION,
  is_active BOOLEAN DEFAULT true,
  amount_filled TEXT DEFAULT '0',
  is_cancelled BOOLEAN DEFAULT false,
  -- Signature fields for off-chain orders
  order_hash TEXT,                 -- keccak256 hash of order
  v INTEGER,                       -- signature v
  r TEXT,                          -- signature r
  s TEXT,                          -- signature s
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tx_hash, log_index)
);

CREATE INDEX idx_orders_pair ON orders(base_token, quote_token);
CREATE INDEX idx_orders_active ON orders(is_active) WHERE is_active = true;
CREATE INDEX idx_orders_block ON orders(block_number DESC);
CREATE INDEX idx_orders_user ON orders(user_address);
CREATE INDEX idx_orders_hash ON orders(order_hash);

-- ============================================
-- TRADES TABLE
-- ============================================
CREATE TABLE trades (
  id SERIAL PRIMARY KEY,
  tx_hash TEXT NOT NULL,
  log_index INTEGER DEFAULT 0,
  token_get TEXT NOT NULL,
  amount_get TEXT NOT NULL,
  token_give TEXT NOT NULL,
  amount_give TEXT NOT NULL,
  maker TEXT NOT NULL,
  taker TEXT NOT NULL,
  block_number BIGINT NOT NULL,
  block_timestamp TIMESTAMPTZ,
  base_token TEXT NOT NULL,
  quote_token TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
  price DOUBLE PRECISION,
  base_amount DOUBLE PRECISION,
  quote_amount DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tx_hash, log_index)
);

CREATE INDEX idx_trades_pair ON trades(base_token, quote_token);
CREATE INDEX idx_trades_block ON trades(block_number DESC);
CREATE INDEX idx_trades_timestamp ON trades(block_timestamp DESC);

-- ============================================
-- SYNC STATUS TABLE
-- ============================================
CREATE TABLE sync_status (
  id SERIAL PRIMARY KEY,
  event_type TEXT NOT NULL UNIQUE,
  last_synced_block BIGINT NOT NULL DEFAULT 0,
  last_sync_time TIMESTAMPTZ DEFAULT NOW(),
  total_events INTEGER DEFAULT 0,
  status TEXT DEFAULT 'idle'
);

INSERT INTO sync_status (event_type, last_synced_block) VALUES
  ('orders', 9100009),
  ('trades', 9100009)
ON CONFLICT (event_type) DO NOTHING;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read tokens" ON tokens FOR SELECT USING (true);
CREATE POLICY "Anyone can read orders" ON orders FOR SELECT USING (true);
CREATE POLICY "Anyone can read trades" ON trades FOR SELECT USING (true);
CREATE POLICY "Anyone can read sync" ON sync_status FOR SELECT USING (true);

CREATE POLICY "Anon can insert orders" ON orders FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update orders" ON orders FOR UPDATE TO anon USING (true);
CREATE POLICY "Anon can insert trades" ON trades FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update sync" ON sync_status FOR UPDATE TO anon USING (true);
CREATE POLICY "Anon can insert sync" ON sync_status FOR INSERT TO anon WITH CHECK (true);
