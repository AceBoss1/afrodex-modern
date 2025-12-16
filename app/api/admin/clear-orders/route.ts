// app/api/admin/clear-orders/route.ts
// Admin endpoint to clear stale orders from database
// Use this when orders show "already filled or cancelled"

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function POST(request: Request) {
  try {
    // Optional: Add authentication here for production
    // const authHeader = request.headers.get('authorization');
    // if (authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const { userAddress, baseToken, clearAll } = body;

    let query = supabase.from('orders').delete();

    if (clearAll) {
      // Clear ALL orders
      query = query.gte('id', 0); // This ensures the delete runs
    } else if (userAddress) {
      // Clear orders for specific user
      query = query.eq('user_address', userAddress.toLowerCase());
    } else if (baseToken) {
      // Clear orders for specific token
      query = query.eq('base_token', baseToken.toLowerCase());
    } else {
      // Default: clear all active orders
      query = query.eq('is_active', true);
    }

    const { error, count } = await query;

    if (error) {
      console.error('Error clearing orders:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Orders cleared successfully',
      count,
    });
  } catch (error: any) {
    console.error('Clear orders error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'POST to this endpoint to clear orders',
    options: {
      clearAll: 'Set to true to clear ALL orders',
      userAddress: 'Clear orders for specific user address',
      baseToken: 'Clear orders for specific token address',
    },
    example: {
      clearAll: true,
    },
  });
}
