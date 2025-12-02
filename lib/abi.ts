// lib/abi.ts
// Contract ABIs for AfroDex Exchange (EtherDelta/ForkDelta-style)

/**
 * EtherDelta/ForkDelta Exchange Contract ABI
 * Contract: 0xe8fff15bb5e14095bfdfa8bb85d83cc900c23c56
 */
export const EXCHANGE_ABI = [
  // State variables
  'function admin() view returns (address)',
  'function feeAccount() view returns (address)',
  'function accountLevelsAddr() view returns (address)',
  'function feeMake() view returns (uint256)',
  'function feeTake() view returns (uint256)',
  'function feeRebate() view returns (uint256)',
  
  // Balance Functions
  'function deposit() payable',
  'function withdraw(uint256 amount)',
  'function depositToken(address token, uint256 amount)',
  'function withdrawToken(address token, uint256 amount)',
  'function balanceOf(address token, address user) view returns (uint256)',
  
  // Trading Functions
  'function order(address tokenGet, uint256 amountGet, address tokenGive, uint256 amountGive, uint256 expires, uint256 nonce)',
  'function trade(address tokenGet, uint256 amountGet, address tokenGive, uint256 amountGive, uint256 expires, uint256 nonce, address user, uint8 v, bytes32 r, bytes32 s, uint256 amount)',
  'function cancelOrder(address tokenGet, uint256 amountGet, address tokenGive, uint256 amountGive, uint256 expires, uint256 nonce, uint8 v, bytes32 r, bytes32 s)',
  
  // View Functions
  'function testTrade(address tokenGet, uint256 amountGet, address tokenGive, uint256 amountGive, uint256 expires, uint256 nonce, address user, uint8 v, bytes32 r, bytes32 s, uint256 amount, address sender) view returns (bool)',
  'function availableVolume(address tokenGet, uint256 amountGet, address tokenGive, uint256 amountGive, uint256 expires, uint256 nonce, address user, uint8 v, bytes32 r, bytes32 s) view returns (uint256)',
  'function amountFilled(address tokenGet, uint256 amountGet, address tokenGive, uint256 amountGive, uint256 expires, uint256 nonce, address user, uint8 v, bytes32 r, bytes32 s) view returns (uint256)',
  'function orders(address user, bytes32 hash) view returns (bool)',
  'function orderFills(address user, bytes32 hash) view returns (uint256)',
  
  // Events
  'event Order(address tokenGet, uint256 amountGet, address tokenGive, uint256 amountGive, uint256 expires, uint256 nonce, address user)',
  'event Cancel(address tokenGet, uint256 amountGet, address tokenGive, uint256 amountGive, uint256 expires, uint256 nonce, address user, uint8 v, bytes32 r, bytes32 s)',
  'event Trade(address tokenGet, uint256 amountGet, address tokenGive, uint256 amountGive, address get, address give)',
  'event Deposit(address token, address user, uint256 amount, uint256 balance)',
  'event Withdraw(address token, address user, uint256 amount, uint256 balance)',
] as const;

/**
 * Standard ERC20 Token ABI
 */
export const ERC20_ABI = [
  // Read Functions
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  
  // Write Functions
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) returns (bool)',
  
  // Events
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)',
] as const;

/**
 * Multicall3 ABI for batched calls
 */
export const MULTICALL_ABI = [
  'function aggregate(tuple(address target, bytes callData)[] calls) payable returns (uint256 blockNumber, bytes[] returnData)',
  'function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) payable returns (tuple(bool success, bytes returnData)[] returnData)',
  'function tryAggregate(bool requireSuccess, tuple(address target, bytes callData)[] calls) payable returns (tuple(bool success, bytes returnData)[] returnData)',
] as const;

// Contract addresses
export const MULTICALL_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11'; // Multicall3 on mainnet

export default EXCHANGE_ABI;
