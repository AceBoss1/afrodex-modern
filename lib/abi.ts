// ABI for EtherDelta/ForkDelta-style exchange contract
export const EXCHANGE_ABI = [
  // Deposit ETH
  "function deposit() payable",
  
  // Withdraw ETH
  "function withdraw(uint256 amount)",
  
  // Deposit Token
  "function depositToken(address token, uint256 amount)",
  
  // Withdraw Token
  "function withdrawToken(address token, uint256 amount)",
  
  // Get Balance
  "function balanceOf(address token, address user) view returns (uint256)",
  
  // Trade
  "function trade(address tokenGet, uint256 amountGet, address tokenGive, uint256 amountGive, uint256 expires, uint256 nonce, address user, uint8 v, bytes32 r, bytes32 s, uint256 amount)",
  
  // Order
  "function order(address tokenGet, uint256 amountGet, address tokenGive, uint256 amountGive, uint256 expires, uint256 nonce)",
  
  // Cancel Order
  "function cancelOrder(address tokenGet, uint256 amountGet, address tokenGive, uint256 amountGive, uint256 expires, uint256 nonce, uint8 v, bytes32 r, bytes32 s)",
  
  // Test Trade
  "function testTrade(address tokenGet, uint256 amountGet, address tokenGive, uint256 amountGive, uint256 expires, uint256 nonce, address user, uint8 v, bytes32 r, bytes32 s, uint256 amount, address sender) view returns (bool)",
  
  // Available Volume
  "function availableVolume(address tokenGet, uint256 amountGet, address tokenGive, uint256 amountGive, uint256 expires, uint256 nonce, address user, uint8 v, bytes32 r, bytes32 s) view returns (uint256)",
  
  // Amount Filled
  "function amountFilled(address tokenGet, uint256 amountGet, address tokenGive, uint256 amountGive, uint256 expires, uint256 nonce, address user, uint8 v, bytes32 r, bytes32 s) view returns (uint256)",
  
  // Events
  "event Order(address indexed tokenGet, uint256 amountGet, address indexed tokenGive, uint256 amountGive, uint256 expires, uint256 nonce, address indexed user)",
  "event Cancel(address indexed tokenGet, uint256 amountGet, address indexed tokenGive, uint256 amountGive, uint256 expires, uint256 nonce, address indexed user, uint8 v, bytes32 r, bytes32 s)",
  "event Trade(address tokenGet, uint256 amountGet, address tokenGive, uint256 amountGive, address indexed get, address indexed give)",
  "event Deposit(address indexed token, address indexed user, uint256 amount, uint256 balance)",
  "event Withdraw(address indexed token, address indexed user, uint256 amount, uint256 balance)"
] as const;

// ERC20 ABI for token operations
export const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)"
] as const;

export default EXCHANGE_ABI;
