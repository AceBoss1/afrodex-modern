// lib/exchange.ts
import { ethers, Contract, Provider, Signer, formatUnits, parseUnits, keccak256, solidityPacked } from 'ethers';
import { EXCHANGE_ABI, ERC20_ABI } from './abi';
import { ZERO_ADDRESS } from './tokens';

// Exchange contract address
export const EXCHANGE_ADDRESS = process.env.NEXT_PUBLIC_EXCHANGE_CONTRACT || '0xe8fff15bb5e14095bfdfa8bb85d83cc900c23c56';

// Types
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
  availableVolume?: string;
  amountFilled?: string;
  price?: number;
  side?: 'buy' | 'sell';
}

export interface SignedOrder extends Order {
  v: number;
  r: string;
  s: string;
  hash: string;
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
  price: number;
  side: 'buy' | 'sell';
  baseAmount: number;
  quoteAmount: number;
}

export interface Balance {
  wallet: string;
  exchange: string;
}

// ============================================
// Balance Functions
// ============================================

/**
 * Get exchange balance for a token
 */
export async function getExchangeBalance(
  provider: Provider,
  tokenAddress: string,
  userAddress: string
): Promise<string> {
  const contract = new Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, provider);
  const balance = await contract.balanceOf(tokenAddress, userAddress);
  return balance.toString();
}

/**
 * Get wallet balance for a token
 */
export async function getWalletBalance(
  provider: Provider,
  tokenAddress: string,
  userAddress: string
): Promise<string> {
  if (tokenAddress === ZERO_ADDRESS) {
    const balance = await provider.getBalance(userAddress);
    return balance.toString();
  } else {
    const contract = new Contract(tokenAddress, ERC20_ABI, provider);
    const balance = await contract.balanceOf(userAddress);
    return balance.toString();
  }
}

/**
 * Get both wallet and exchange balances
 */
export async function getBalances(
  provider: Provider,
  tokenAddress: string,
  userAddress: string
): Promise<Balance> {
  const [wallet, exchange] = await Promise.all([
    getWalletBalance(provider, tokenAddress, userAddress),
    getExchangeBalance(provider, tokenAddress, userAddress),
  ]);
  return { wallet, exchange };
}

// ============================================
// Token Info Functions
// ============================================

/**
 * Get token info from contract
 */
export async function getTokenInfo(
  provider: Provider,
  tokenAddress: string
): Promise<{ name: string; symbol: string; decimals: number }> {
  if (tokenAddress === ZERO_ADDRESS) {
    return { name: 'Ethereum', symbol: 'ETH', decimals: 18 };
  }

  try {
    const contract = new Contract(tokenAddress, ERC20_ABI, provider);
    const [name, symbol, decimals] = await Promise.all([
      contract.name().catch(() => 'Unknown Token'),
      contract.symbol().catch(() => 'UNKNOWN'),
      contract.decimals().catch(() => 18),
    ]);
    return { name, symbol, decimals: Number(decimals) };
  } catch (error) {
    console.error('Error fetching token info:', error);
    throw new Error('Invalid token address or not an ERC-20 token');
  }
}

// ============================================
// Approval Functions
// ============================================

/**
 * Check token allowance for exchange
 */
export async function checkAllowance(
  provider: Provider,
  tokenAddress: string,
  userAddress: string
): Promise<string> {
  if (tokenAddress === ZERO_ADDRESS) {
    return ethers.MaxUint256.toString(); // ETH doesn't need approval
  }
  const contract = new Contract(tokenAddress, ERC20_ABI, provider);
  const allowance = await contract.allowance(userAddress, EXCHANGE_ADDRESS);
  return allowance.toString();
}

/**
 * Approve token for exchange
 */
export async function approveToken(
  signer: Signer,
  tokenAddress: string,
  amount: string = ethers.MaxUint256.toString()
): Promise<ethers.ContractTransactionResponse> {
  const contract = new Contract(tokenAddress, ERC20_ABI, signer);
  return await contract.approve(EXCHANGE_ADDRESS, amount);
}

// ============================================
// Deposit/Withdraw Functions
// ============================================

/**
 * Deposit ETH to exchange
 */
export async function depositEth(
  signer: Signer,
  amount: string
): Promise<ethers.ContractTransactionResponse> {
  const contract = new Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, signer);
  return await contract.deposit({ value: amount });
}

/**
 * Withdraw ETH from exchange
 */
export async function withdrawEth(
  signer: Signer,
  amount: string
): Promise<ethers.ContractTransactionResponse> {
  const contract = new Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, signer);
  return await contract.withdraw(amount);
}

/**
 * Deposit token to exchange
 */
export async function depositToken(
  signer: Signer,
  tokenAddress: string,
  amount: string
): Promise<ethers.ContractTransactionResponse> {
  const contract = new Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, signer);
  return await contract.depositToken(tokenAddress, amount);
}

/**
 * Withdraw token from exchange
 */
export async function withdrawToken(
  signer: Signer,
  tokenAddress: string,
  amount: string
): Promise<ethers.ContractTransactionResponse> {
  const contract = new Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, signer);
  return await contract.withdrawToken(tokenAddress, amount);
}

// ============================================
// Order Functions
// ============================================

/**
 * Generate order hash for signing (AfroDex uses sha256)
 * Contract: bytes32 hash = sha256(this, tokenGet, amountGet, tokenGive, amountGive, expires, nonce);
 * 
 * In Solidity 0.4.x: sha256(a, b, c, ...) = sha256(abi.encodePacked(a, b, c, ...))
 * - address = 20 bytes
 * - uint256 = 32 bytes
 */
export function getOrderHash(order: Order): string {
  // Use checksummed addresses (case doesn't matter for encoding, just for display)
  const contractAddr = ethers.getAddress(EXCHANGE_ADDRESS);
  const tokenGet = ethers.getAddress(order.tokenGet);
  const tokenGive = ethers.getAddress(order.tokenGive);
  
  // Convert to BigInt for proper uint256 encoding
  const amountGet = BigInt(order.amountGet);
  const amountGive = BigInt(order.amountGive);
  const expires = BigInt(order.expires);
  const nonce = BigInt(order.nonce);
  
  // Use solidityPacked (equivalent to Solidity's abi.encodePacked)
  const packed = solidityPacked(
    ['address', 'address', 'uint256', 'address', 'uint256', 'uint256', 'uint256'],
    [contractAddr, tokenGet, amountGet, tokenGive, amountGive, expires, nonce]
  );
  
  // Use sha256 (same as Solidity)
  const hash = ethers.sha256(packed);
  
  console.log('=== ORDER HASH CALCULATION ===');
  console.log('Contract address:', contractAddr);
  console.log('tokenGet:', tokenGet);
  console.log('amountGet:', amountGet.toString());
  console.log('tokenGive:', tokenGive);
  console.log('amountGive:', amountGive.toString());
  console.log('expires:', expires.toString());
  console.log('nonce:', nonce.toString());
  console.log('Packed bytes:', packed);
  console.log('Packed length:', (packed.length - 2) / 2, 'bytes'); // -2 for '0x', /2 for hex
  console.log('SHA256 hash:', hash);
  console.log('==============================');
  
  return hash;
}

/**
 * Sign an order (AfroDex contract style)
 * 
 * Contract verification:
 * 1. hash = sha256(this, tokenGet, amountGet, tokenGive, amountGive, expires, nonce)
 * 2. ecrecover(sha3("\x19Ethereum Signed Message:\n32", hash), v, r, s) == user
 * 
 * sha3 in old Solidity = keccak256
 */
export async function signOrder(
  signer: Signer,
  order: Order
): Promise<SignedOrder> {
  const hash = getOrderHash(order);
  const signerAddress = await signer.getAddress();
  
  console.log('=== SIGNING ORDER ===');
  console.log('Order hash (sha256):', hash);
  console.log('Signer:', signerAddress);
  
  // Convert hash to bytes for signing
  const hashBytes = ethers.getBytes(hash);
  console.log('Hash bytes length:', hashBytes.length);
  
  // Sign the hash - signMessage adds Ethereum prefix automatically
  // This produces: sign(keccak256("\x19Ethereum Signed Message:\n32" + hashBytes))
  const signature = await signer.signMessage(hashBytes);
  console.log('Full signature:', signature);
  
  // Parse signature components
  const sig = ethers.Signature.from(signature);
  
  // EtherDelta/ForkDelta expects v to be 27 or 28
  let v = sig.v;
  if (v < 27) v += 27;
  
  const r = sig.r;
  const s = sig.s;
  
  console.log('v:', v);
  console.log('r:', r, 'length:', r.length);
  console.log('s:', s, 'length:', s.length);
  
  // Verify we can recover the address locally (same as contract does)
  // Contract: ecrecover(sha3("\x19Ethereum Signed Message:\n32", hash), v, r, s)
  // sha3 = keccak256, and it concatenates the prefix with the hash
  const prefixedHash = ethers.keccak256(
    ethers.concat([
      ethers.toUtf8Bytes('\x19Ethereum Signed Message:\n32'),
      hashBytes
    ])
  );
  console.log('Prefixed hash (what contract computes):', prefixedHash);
  
  // Recover using the prefixed hash (exactly what ecrecover does)
  const sigObj = ethers.Signature.from({ r, s, v });
  const recovered = ethers.recoverAddress(prefixedHash, sigObj);
  console.log('Recovered address:', recovered);
  console.log('Expected signer:', signerAddress);
  console.log('MATCH:', recovered.toLowerCase() === signerAddress.toLowerCase());
  
  // Also verify using ethers built-in (should give same result)
  const recoveredBuiltin = ethers.verifyMessage(hashBytes, signature);
  console.log('Built-in recovery:', recoveredBuiltin);
  console.log('Built-in MATCH:', recoveredBuiltin.toLowerCase() === signerAddress.toLowerCase());
  
  console.log('====================');
  
  if (recovered.toLowerCase() !== signerAddress.toLowerCase()) {
    throw new Error(`Signature verification failed! Recovered ${recovered} but expected ${signerAddress}`);
  }
  
  return {
    ...order,
    hash,
    v,
    r,
    s,
  };
}

/**
 * Create and sign an order off-chain (gasless)
 * Returns signed order to be stored in Supabase
 */
export async function createSignedOrder(
  signer: Signer,
  tokenGet: string,
  amountGet: string,
  tokenGive: string,
  amountGive: string,
  expires: string,
  nonce: string
): Promise<SignedOrder> {
  // Validate amounts
  if (!amountGet || amountGet === '0') {
    throw new Error(`Invalid amountGet: ${amountGet}. Cannot create order with 0 amount.`);
  }
  if (!amountGive || amountGive === '0') {
    throw new Error(`Invalid amountGive: ${amountGive}. Cannot create order with 0 amount.`);
  }
  
  const userAddress = await signer.getAddress();
  
  const order: Order = {
    tokenGet,
    amountGet,
    tokenGive,
    amountGive,
    expires,
    nonce,
    user: userAddress,
  };
  
  console.log('Creating signed order:', order);
  
  // Sign the order (gasless - just a signature)
  const signedOrder = await signOrder(signer, order);
  
  return signedOrder;
}

/**
 * Place an order on-chain (emits Order event) - LEGACY
 * Note: AfroDex uses off-chain orderbook, use createSignedOrder instead
 */
export async function placeOrder(
  signer: Signer,
  tokenGet: string,
  amountGet: string,
  tokenGive: string,
  amountGive: string,
  expires: string,
  nonce: string
): Promise<ethers.ContractTransactionResponse> {
  const contract = new Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, signer);
  return await contract.order(
    tokenGet,
    amountGet,
    tokenGive,
    amountGive,
    expires,
    nonce
  );
}

/**
 * Execute a trade against an existing order
 */
export async function executeTrade(
  signer: Signer,
  order: SignedOrder,
  amount: string
): Promise<ethers.ContractTransactionResponse> {
  const contract = new Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, signer);
  return await contract.trade(
    order.tokenGet,
    order.amountGet,
    order.tokenGive,
    order.amountGive,
    order.expires,
    order.nonce,
    order.user,
    order.v,
    order.r,
    order.s,
    amount
  );
}

/**
 * Verify an order's signature against the contract
 * Returns the available volume (0 if invalid signature or filled)
 */
export async function verifyOrderSignature(
  provider: Provider,
  order: SignedOrder
): Promise<{ valid: boolean; availableVolume: string; reason?: string }> {
  const contract = new Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, provider);
  
  try {
    // Recalculate hash to compare
    const expectedHash = getOrderHash(order);
    const hashMatch = expectedHash === order.hash;
    
    console.log('Verifying order signature:', {
      storedHash: order.hash,
      expectedHash,
      hashMatch,
      user: order.user,
      v: order.v,
    });
    
    if (!hashMatch) {
      return { 
        valid: false, 
        availableVolume: '0',
        reason: `Hash mismatch: stored=${order.hash?.slice(0, 10)}... expected=${expectedHash.slice(0, 10)}...`
      };
    }
    
    const availableVolume = await contract.availableVolume(
      order.tokenGet,
      order.amountGet,
      order.tokenGive,
      order.amountGive,
      order.expires,
      order.nonce,
      order.user,
      order.v,
      order.r,
      order.s
    );
    
    const volumeStr = availableVolume.toString();
    
    if (volumeStr === '0') {
      // Check current block to see if expired
      const currentBlock = await provider.getBlockNumber();
      if (parseInt(order.expires) <= currentBlock) {
        return { valid: false, availableVolume: '0', reason: 'Order expired' };
      }
      
      // Check if order was on-chain submitted
      const orderHash = ethers.sha256(
        solidityPacked(
          ['address', 'address', 'uint256', 'address', 'uint256', 'uint256', 'uint256'],
          [EXCHANGE_ADDRESS, order.tokenGet, BigInt(order.amountGet), order.tokenGive, BigInt(order.amountGive), BigInt(order.expires), BigInt(order.nonce)]
        )
      );
      
      const isOnChain = await contract.orders(order.user, orderHash);
      if (!isOnChain) {
        return { valid: false, availableVolume: '0', reason: 'Invalid signature - order not recognized by contract' };
      }
      
      return { valid: false, availableVolume: '0', reason: 'Order fully filled' };
    }
    
    return { valid: true, availableVolume: volumeStr };
  } catch (error: any) {
    console.error('Error verifying order:', error);
    return { valid: false, availableVolume: '0', reason: error.message };
  }
}

/**
 * Cancel an order
 */
export async function cancelOrder(
  signer: Signer,
  order: SignedOrder
): Promise<ethers.ContractTransactionResponse> {
  const contract = new Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, signer);
  return await contract.cancelOrder(
    order.tokenGet,
    order.amountGet,
    order.tokenGive,
    order.amountGive,
    order.expires,
    order.nonce,
    order.v,
    order.r,
    order.s
  );
}

// ============================================
// Order Book Functions
// ============================================

/**
 * Test if a trade can be executed (calls contract's testTrade)
 */
export async function testTrade(
  provider: Provider,
  order: SignedOrder,
  amount: string,
  takerAddress: string
): Promise<boolean> {
  const contract = new Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, provider);
  try {
    const canTrade = await contract.testTrade(
      order.tokenGet,
      order.amountGet,
      order.tokenGive,
      order.amountGive,
      order.expires,
      order.nonce,
      order.user,
      order.v,
      order.r,
      order.s,
      amount,
      takerAddress
    );
    return canTrade;
  } catch (error) {
    console.warn('testTrade failed:', error);
    return false;
  }
}

/**
 * Pre-trade validation - checks all conditions and returns reason if trade would fail
 * 
 * IMPORTANT: In EtherDelta/ForkDelta trade function:
 * - The `amount` parameter is how much of `tokenGet` the taker SENDS to the maker
 * - The taker RECEIVES proportional `tokenGive` from the maker
 * - So taker needs balance of tokenGet >= amount
 */
export async function preTradeCheck(
  provider: Provider,
  order: SignedOrder,
  amount: string,
  takerAddress: string
): Promise<{ canTrade: boolean; reason?: string }> {
  const contract = new Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, provider);
  
  console.log('preTradeCheck - Contract address:', EXCHANGE_ADDRESS);
  console.log('preTradeCheck - Order details:', {
    tokenGet: order.tokenGet,
    amountGet: order.amountGet,
    tokenGive: order.tokenGive,
    amountGive: order.amountGive,
    expires: order.expires,
    nonce: order.nonce,
    user: order.user,
    v: order.v,
    r: order.r,
    s: order.s,
    hash: order.hash,
  });
  console.log('preTradeCheck - Trade amount:', amount);
  console.log('preTradeCheck - Taker address:', takerAddress);
  
  try {
    // 0. Check for invalid order amounts (common bug!)
    if (!order.amountGet || order.amountGet === '0') {
      return { 
        canTrade: false, 
        reason: `Invalid order: amountGet is 0. This order was created with incorrect amounts and cannot be executed. Delete it.` 
      };
    }
    if (!order.amountGive || order.amountGive === '0') {
      return { 
        canTrade: false, 
        reason: `Invalid order: amountGive is 0. This order was created with incorrect amounts and cannot be executed. Delete it.` 
      };
    }
    
    // 1. Check if order is expired
    const currentBlock = await provider.getBlockNumber();
    console.log('Current block:', currentBlock, 'Order expires:', order.expires);
    
    if (parseInt(order.expires) <= currentBlock) {
      return { canTrade: false, reason: `Order expired (block ${order.expires} < current ${currentBlock})` };
    }

    // 2. Check available volume (also validates signature)
    let availableVolume;
    try {
      console.log('=== SIGNATURE VERIFICATION (matching contract logic) ===');
      
      // Ensure v is a valid number (27 or 28)
      const v = Number(order.v);
      console.log('v:', v, '(valid:', v === 27 || v === 28, ')');
      
      if (v !== 27 && v !== 28) {
        return { canTrade: false, reason: `Invalid v value: ${v} (must be 27 or 28)` };
      }
      
      // Ensure r and s are proper hex strings
      console.log('r:', order.r, 'length:', order.r?.length);
      console.log('s:', order.s, 'length:', order.s?.length);
      
      if (!order.r || !order.s || order.r.length !== 66 || order.s.length !== 66) {
        return { canTrade: false, reason: `Invalid r/s: r=${order.r?.length} chars, s=${order.s?.length} chars (need 66 each)` };
      }
      
      // Step 1: Recalculate the sha256 hash (same as contract)
      const expectedHash = getOrderHash(order);
      console.log('Computed hash:', expectedHash);
      console.log('Stored hash:', order.hash);
      console.log('Hash match:', expectedHash === order.hash);
      
      // Step 2: Compute prefixed hash (same as contract)
      const hashBytes = ethers.getBytes(expectedHash);
      const prefixedHash = ethers.keccak256(
        ethers.concat([
          ethers.toUtf8Bytes('\x19Ethereum Signed Message:\n32'),
          hashBytes
        ])
      );
      console.log('Prefixed hash:', prefixedHash);
      
      // Step 3: Recover signer (same as contract's ecrecover)
      try {
        const sigObj = ethers.Signature.from({ r: order.r, s: order.s, v: v });
        const recoveredAddress = ethers.recoverAddress(prefixedHash, sigObj);
        console.log('Recovered address:', recoveredAddress);
        console.log('Order user:', order.user);
        console.log('SIGNATURE VALID:', recoveredAddress.toLowerCase() === order.user.toLowerCase());
        
        if (recoveredAddress.toLowerCase() !== order.user.toLowerCase()) {
          console.log('!!! SIGNATURE MISMATCH - This is why the contract rejects it !!!');
          return { 
            canTrade: false, 
            reason: `Signature invalid: recovered ${recoveredAddress.slice(0,10)}... but order is from ${order.user.slice(0,10)}...` 
          };
        }
      } catch (recoverError: any) {
        console.error('Signature recovery failed:', recoverError);
        return { canTrade: false, reason: `Signature recovery error: ${recoverError.message}` };
      }
      
      console.log('=== END SIGNATURE VERIFICATION ===');
      
      // Now call the contract
      console.log('Calling contract.availableVolume...');
      availableVolume = await contract.availableVolume(
        order.tokenGet,
        order.amountGet,
        order.tokenGive,
        order.amountGive,
        order.expires,
        order.nonce,
        order.user,
        v,
        order.r,
        order.s
      );
      console.log('Contract availableVolume result:', availableVolume.toString());
    } catch (err: any) {
      console.error('availableVolume call failed:', err);
      return { canTrade: false, reason: `Contract call failed: ${err.message}` };
    }
    
    if (availableVolume.toString() === '0') {
      // Check if maker has deposited tokens
      const makerBalance = await contract.balanceOf(order.tokenGive, order.user);
      console.log('Maker balance of tokenGive:', makerBalance.toString());
      
      if (makerBalance.toString() === '0') {
        return { canTrade: false, reason: `Maker has not deposited tokens (balance: 0)` };
      }
      
      // Recalculate hash to verify
      const recalculatedHash = getOrderHash(order);
      console.log('Recalculated hash:', recalculatedHash);
      console.log('Stored hash:', order.hash);
      console.log('Hash match:', recalculatedHash === order.hash);
      
      return { 
        canTrade: false, 
        reason: `Invalid signature or order filled. Hash match: ${recalculatedHash === order.hash}. Delete and create new order.` 
      };
    }

    const amountBigInt = BigInt(amount);
    if (amountBigInt > availableVolume) {
      return { canTrade: false, reason: `Amount exceeds available (${amount} > ${availableVolume})` };
    }

    // 3. FIXED: Check taker's balance of tokenGet (what taker SENDS to maker)
    // In EtherDelta trade:
    // - `amount` is how much of tokenGet the taker sends to maker
    // - Taker receives proportional tokenGive from maker
    // So taker needs tokenGet balance >= amount
    const takerBalanceTokenGet = await contract.balanceOf(order.tokenGet, takerAddress);
    console.log('Taker balance of tokenGet:', takerBalanceTokenGet.toString());
    console.log('Amount taker needs to send:', amount);
    
    if (BigInt(takerBalanceTokenGet) < amountBigInt) {
      // Provide helpful error message based on token type
      const tokenGetIsETH = order.tokenGet.toLowerCase() === ZERO_ADDRESS.toLowerCase();
      const tokenName = tokenGetIsETH ? 'ETH' : 'tokens';
      return { 
        canTrade: false, 
        reason: `Insufficient ${tokenName} in exchange: need ${amount} but have ${takerBalanceTokenGet.toString()}. Deposit more ${tokenName} to the exchange first.` 
      };
    }

    // 4. Also verify maker has enough tokenGive to fulfill
    const makerBalanceTokenGive = await contract.balanceOf(order.tokenGive, order.user);
    // Calculate how much tokenGive maker needs to send for this trade amount
    const tokenGiveNeeded = (amountBigInt * BigInt(order.amountGive)) / BigInt(order.amountGet);
    console.log('Maker balance of tokenGive:', makerBalanceTokenGive.toString());
    console.log('TokenGive needed from maker:', tokenGiveNeeded.toString());
    
    if (BigInt(makerBalanceTokenGive) < tokenGiveNeeded) {
      return { 
        canTrade: false, 
        reason: `Maker has insufficient balance: needs ${tokenGiveNeeded.toString()} but has ${makerBalanceTokenGive.toString()}` 
      };
    }

    // 5. Final test with contract
    const canTrade = await contract.testTrade(
      order.tokenGet,
      order.amountGet,
      order.tokenGive,
      order.amountGive,
      order.expires,
      order.nonce,
      order.user,
      order.v,
      order.r,
      order.s,
      amount,
      takerAddress
    );

    if (!canTrade) {
      return { canTrade: false, reason: 'Contract testTrade returned false (check balances or signature)' };
    }

    return { canTrade: true };
  } catch (error: any) {
    return { canTrade: false, reason: error.message || 'Pre-trade check failed' };
  }
}

/**
 * Check available volume for an order
 */
export async function getAvailableVolume(
  provider: Provider,
  order: SignedOrder
): Promise<string> {
  const contract = new Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, provider);
  try {
    const volume = await contract.availableVolume(
      order.tokenGet,
      order.amountGet,
      order.tokenGive,
      order.amountGive,
      order.expires,
      order.nonce,
      order.user,
      order.v,
      order.r,
      order.s
    );
    return volume.toString();
  } catch (error) {
    console.warn('Error getting available volume:', error);
    return '0';
  }
}

/**
 * Get filled amount for an order
 */
export async function getAmountFilled(
  provider: Provider,
  order: SignedOrder
): Promise<string> {
  const contract = new Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, provider);
  try {
    const filled = await contract.amountFilled(
      order.tokenGet,
      order.amountGet,
      order.tokenGive,
      order.amountGive,
      order.expires,
      order.nonce,
      order.user,
      order.v,
      order.r,
      order.s
    );
    return filled.toString();
  } catch (error) {
    return '0';
  }
}

// ============================================
// Utility Functions
// ============================================

/**
 * Format amount from wei with specified decimals
 */
export function formatAmount(amount: string, decimals: number): string {
  try {
    return formatUnits(amount, decimals);
  } catch {
    return '0';
  }
}

/**
 * Format amount for display - shows FULL numbers, no abbreviations
 * Large numbers shown with commas for readability
 * Small numbers show appropriate decimals
 */
export function formatDisplayAmount(amount: number | string): string {
  // Handle string input (might be very large number from formatUnits)
  if (typeof amount === 'string') {
    const num = parseFloat(amount);
    if (isNaN(num) || num === 0) return '0';
    
    // For very large numbers, parse the string directly to avoid precision loss
    if (num >= 1e15) {
      // Split at decimal point
      const parts = amount.split('.');
      const intPart = parts[0];
      // Add commas to integer part
      return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
    
    return formatDisplayAmount(num);
  }
  
  const num = amount;
  if (isNaN(num) || num === 0) return '0';
  
  const absNum = Math.abs(num);
  
  // For very large numbers (>= 1 million), show as integer with commas
  if (absNum >= 1000000) {
    return Math.round(num).toLocaleString('en-US', { maximumFractionDigits: 0 });
  }
  
  // For numbers >= 1, show up to 4 decimals
  if (absNum >= 1) {
    return num.toLocaleString('en-US', { maximumFractionDigits: 4 });
  }
  
  // For small numbers, show appropriate decimals
  if (absNum >= 0.0001) {
    return num.toFixed(6);
  }
  
  // For very small numbers, show up to 12 decimals
  return num.toFixed(12).replace(/\.?0+$/, '');
}

/**
 * Format price for display - handles very small prices like 0.000000009998
 * Shows ALL significant digits for small prices (up to 18 decimals)
 */
export function formatDisplayPrice(price: number | string): string {
  const num = typeof price === 'string' ? parseFloat(price) : price;
  
  if (isNaN(num) || num === 0) return '0';
  
  const absNum = Math.abs(num);
  
  // For prices >= 1, show reasonable decimals
  if (absNum >= 1) {
    return num.toFixed(4);
  }
  
  // For prices >= 0.0001, show 8 decimals
  if (absNum >= 0.0001) {
    return num.toFixed(8);
  }
  
  // For prices >= 0.000000001 (9 zeros), show 12 decimals
  if (absNum >= 0.000000001) {
    return num.toFixed(12);
  }
  
  // For very small prices, show up to 18 decimals (full ETH precision)
  // Find first significant digit and show all
  const str = num.toFixed(18);
  
  // Remove trailing zeros but keep significant digits
  let trimmed = str.replace(/0+$/, '');
  if (trimmed.endsWith('.')) {
    trimmed = trimmed + '0';
  }
  
  return trimmed;
}

/**
 * Format balance for input display - full precision without abbreviation
 */
export function formatFullBalance(amount: string, decimals: number): string {
  try {
    const formatted = formatUnits(amount, decimals);
    const num = parseFloat(formatted);
    if (num === 0) return '0';
    // Return full precision
    return formatted;
  } catch {
    return '0';
  }
}

/**
 * Format for order book display - needs to fit in column
 * Price: up to 15 decimal places for very small prices like AfroX
 * Amount: full number with commas, no decimals for large numbers
 */
export function formatOrderBookPrice(price: number): string {
  if (price === 0) return '0';
  
  const absPrice = Math.abs(price);
  
  if (absPrice >= 1) {
    return price.toFixed(6);
  }
  if (absPrice >= 0.0001) {
    return price.toFixed(8);
  }
  if (absPrice >= 0.000001) {
    return price.toFixed(10);
  }
  if (absPrice >= 0.000000001) {
    return price.toFixed(12);
  }
  // For very small prices like 0.000000000003239 (AfroX)
  return price.toFixed(15);
}

/**
 * Format order book amount - full numbers, no abbreviations
 * Uses commas for readability on large numbers
 */
export function formatOrderBookAmount(amount: number): string {
  if (amount === 0) return '0';
  
  const absAmount = Math.abs(amount);
  
  // For large numbers, show as integer with commas
  if (absAmount >= 1000) {
    return Math.round(amount).toLocaleString('en-US', { maximumFractionDigits: 0 });
  }
  
  // For numbers >= 1, show up to 2 decimals
  if (absAmount >= 1) {
    return amount.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }
  
  // For small numbers
  return amount.toFixed(6);
}

/**
 * Parse amount to wei with specified decimals
 * Handles floating point precision issues for very small amounts
 */
export function parseAmount(amount: string, decimals: number): string {
  try {
    // Handle scientific notation and very small numbers
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) {
      console.warn('parseAmount: invalid or zero amount:', amount);
      return '0';
    }
    
    // For very small numbers, use fixed notation to avoid scientific notation issues
    const fixedAmount = num.toFixed(decimals);
    const result = parseUnits(fixedAmount, decimals).toString();
    
    console.log(`parseAmount(${amount}, ${decimals}) = ${result}`);
    return result;
  } catch (error) {
    console.error('parseAmount error:', error, 'amount:', amount, 'decimals:', decimals);
    return '0';
  }
}

/**
 * Calculate price from order amounts
 * For a buy order (user wants token, gives ETH): price = amountGive / amountGet
 * For a sell order (user wants ETH, gives token): price = amountGet / amountGive
 */
export function calculateOrderPrice(
  order: Order,
  baseDecimals: number,
  quoteDecimals: number,
  baseTokenAddress: string
): number {
  const amountGet = parseFloat(formatAmount(order.amountGet, 
    order.tokenGet.toLowerCase() === baseTokenAddress.toLowerCase() ? baseDecimals : quoteDecimals));
  const amountGive = parseFloat(formatAmount(order.amountGive,
    order.tokenGive.toLowerCase() === baseTokenAddress.toLowerCase() ? baseDecimals : quoteDecimals));

  if (amountGet === 0) return 0;

  // If getting base token (buy order), price is what you give (quote) / what you get (base)
  // If getting quote token (sell order), price is what you get (quote) / what you give (base)
  if (order.tokenGet.toLowerCase() === baseTokenAddress.toLowerCase()) {
    return amountGive / amountGet; // Buy order: ETH/Token
  } else {
    return amountGet / amountGive; // Sell order: ETH/Token
  }
}

/**
 * Generate a random nonce for orders
 */
export function generateNonce(): string {
  return Math.floor(Math.random() * 2147483647).toString();
}

/**
 * Get current block number + offset for order expiration
 */
export async function getExpirationBlock(
  provider: Provider,
  blocksUntilExpiry: number = 10000 // ~1.5 days at 15s blocks
): Promise<string> {
  const currentBlock = await provider.getBlockNumber();
  return (currentBlock + blocksUntilExpiry).toString();
}

// ============================================
// Historical Event Fetching
// ============================================

/**
 * Fetch historical Order events from the blockchain
 */
export async function fetchOrderEvents(
  provider: Provider,
  baseTokenAddress: string,
  quoteTokenAddress: string,
  fromBlock: number = 0,
  toBlock: number | 'latest' = 'latest'
): Promise<Order[]> {
  const contract = new Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, provider);
  
  try {
    // Get current block if toBlock is 'latest'
    const currentBlock = await provider.getBlockNumber();
    const endBlock = toBlock === 'latest' ? currentBlock : toBlock;
    
    // Limit range to avoid RPC timeouts (fetch last ~50000 blocks max)
    const startBlock = Math.max(fromBlock, endBlock - 50000);
    
    // Fetch Order events
    const orderFilter = contract.filters.Order();
    const events = await contract.queryFilter(orderFilter, startBlock, endBlock);
    
    const orders: Order[] = [];
    
    for (const event of events) {
      const args = (event as any).args;
      if (!args) continue;
      
      const tokenGet = args.tokenGet?.toLowerCase();
      const tokenGive = args.tokenGive?.toLowerCase();
      const baseAddr = baseTokenAddress.toLowerCase();
      const quoteAddr = quoteTokenAddress.toLowerCase();
      
      // Filter for our trading pair
      const isBuyOrder = tokenGet === baseAddr && tokenGive === quoteAddr;
      const isSellOrder = tokenGet === quoteAddr && tokenGive === baseAddr;
      
      if (!isBuyOrder && !isSellOrder) continue;
      
      const order: Order = {
        tokenGet: args.tokenGet,
        amountGet: args.amountGet.toString(),
        tokenGive: args.tokenGive,
        amountGive: args.amountGive.toString(),
        expires: args.expires.toString(),
        nonce: args.nonce.toString(),
        user: args.user,
        side: isBuyOrder ? 'buy' : 'sell',
      };
      
      // Check if order is still valid (not expired, not fully filled)
      const blockNum = await provider.getBlockNumber();
      if (parseInt(order.expires) > blockNum) {
        // Check available volume
        const filled = await getOrderFillAmount(provider, order);
        const amountGet = BigInt(order.amountGet);
        const filledAmount = BigInt(filled);
        
        if (filledAmount < amountGet) {
          order.amountFilled = filled;
          order.availableVolume = (amountGet - filledAmount).toString();
          orders.push(order);
        }
      }
    }
    
    return orders;
  } catch (error) {
    console.error('Error fetching order events:', error);
    return [];
  }
}

/**
 * Fetch historical Trade events from the blockchain
 */
export async function fetchTradeEvents(
  provider: Provider,
  baseTokenAddress: string,
  quoteTokenAddress: string,
  baseDecimals: number,
  quoteDecimals: number,
  fromBlock: number = 0,
  toBlock: number | 'latest' = 'latest'
): Promise<Trade[]> {
  const contract = new Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, provider);
  
  try {
    const currentBlock = await provider.getBlockNumber();
    const endBlock = toBlock === 'latest' ? currentBlock : toBlock;
    const startBlock = Math.max(fromBlock, endBlock - 50000);
    
    // Fetch Trade events
    const tradeFilter = contract.filters.Trade();
    const events = await contract.queryFilter(tradeFilter, startBlock, endBlock);
    
    const trades: Trade[] = [];
    
    for (const event of events) {
      const args = (event as any).args;
      if (!args) continue;
      
      const tokenGet = args.tokenGet?.toLowerCase();
      const tokenGive = args.tokenGive?.toLowerCase();
      const baseAddr = baseTokenAddress.toLowerCase();
      const quoteAddr = quoteTokenAddress.toLowerCase();
      
      // Filter for our trading pair
      const isBuyTrade = tokenGet === baseAddr && tokenGive === quoteAddr;
      const isSellTrade = tokenGet === quoteAddr && tokenGive === baseAddr;
      
      if (!isBuyTrade && !isSellTrade) continue;
      
      // Get block timestamp
      const block = await provider.getBlock(event.blockNumber);
      const timestamp = block?.timestamp || Math.floor(Date.now() / 1000);
      
      const amountGet = parseFloat(formatUnits(args.amountGet.toString(), isBuyTrade ? baseDecimals : quoteDecimals));
      const amountGive = parseFloat(formatUnits(args.amountGive.toString(), isBuyTrade ? quoteDecimals : baseDecimals));
      
      const trade: Trade = {
        txHash: event.transactionHash,
        blockNumber: event.blockNumber,
        timestamp: Number(timestamp),
        tokenGet: args.tokenGet,
        amountGet: args.amountGet.toString(),
        tokenGive: args.tokenGive,
        amountGive: args.amountGive.toString(),
        maker: args.get || args.maker || '',
        taker: args.give || args.taker || '',
        side: isBuyTrade ? 'buy' : 'sell',
        price: isBuyTrade ? amountGive / amountGet : amountGet / amountGive,
        baseAmount: isBuyTrade ? amountGet : amountGive,
        quoteAmount: isBuyTrade ? amountGive : amountGet,
      };
      
      trades.push(trade);
    }
    
    // Sort by timestamp descending (most recent first)
    trades.sort((a, b) => b.timestamp - a.timestamp);
    
    return trades;
  } catch (error) {
    console.error('Error fetching trade events:', error);
    return [];
  }
}

/**
 * Get amount already filled for an unsigned order (used in historical fetching)
 */
async function getOrderFillAmount(provider: Provider, order: Order): Promise<string> {
  const contract = new Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, provider);
  
  try {
    // Calculate order hash
    const orderHash = keccak256(
      solidityPacked(
        ['address', 'address', 'uint256', 'address', 'uint256', 'uint256', 'uint256'],
        [
          EXCHANGE_ADDRESS,
          order.tokenGet,
          order.amountGet,
          order.tokenGive,
          order.amountGive,
          order.expires,
          order.nonce
        ]
      )
    );
    
    const filled = await contract.orderFills(order.user, orderHash);
    return filled.toString();
  } catch {
    return '0';
  }
}

export { ZERO_ADDRESS };
