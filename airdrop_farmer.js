const { ethers } = require("ethers");

// ============================================================
// Airdrop Farmer — 每周跑一次，每次交互一个不同协议
// 用法: node airdrop_farmer.js <week_number>
//       每周只做 1 笔交易，轮流覆盖不同协议
//       Gas 预算: ~$0.30/次
// ============================================================

const RPC = "https://arb1.arbitrum.io/rpc";
const PK = "0x2ab7081d8c79553a701903ca9582d73a622a455d094614bd544de8058abf85f2";
const provider = new ethers.JsonRpcProvider(RPC);
const wallet = new ethers.Wallet(PK, provider);
const ADDR = wallet.address;

// ======== Contract Addresses ========
const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
const USDT = "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9";
const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const ARB = "0x912CE59144191C1204E64559FE8253a0e49E6548";
const UNI_V3 = "0xE592427A0AEce92De3Edee1F18E0157C05861564";

// ======== ABIs ========
const ERC20 = ["function approve(address,uint256)","function balanceOf(address) view returns (uint256)","function decimals() view returns (uint8)","function allowance(address,address) view returns (uint256)"];
const UNI_ABI = ['function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 deadline,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96)) returns (uint256)'];

// ======== Helpers ========
async function bal(addr) {
  if (!addr) return ethers.formatEther(await provider.getBalance(ADDR));
  const c = new ethers.Contract(addr, ERC20, provider);
  return ethers.formatUnits(await c.balanceOf(ADDR), await c.decimals());
}

async function waitTx(tx, label) {
  console.log("  TX: " + tx.hash);
  const r = await tx.wait();
  console.log("  OK (" + label + ") gas=" + r.gasUsed.toString());
  return r;
}

async function approveIfNeeded(token, spender, amount, label) {
  const c = new ethers.Contract(token, ERC20, wallet);
  const a = await c.allowance(ADDR, spender);
  if (a >= amount) { console.log("  Already approved"); return; }
  const tx = await c.approve(spender, ethers.MaxUint256, { gasLimit: 100000 });
  await waitTx(tx, label + " approve");
}

// ======== Weekly Actions ========
// Week 1-12: Rotating through different DeFi protocols
// Each action costs ~$0.20-0.30 in gas

const WEEKLY_ACTIONS = {
  1: async () => {  // Week 1: ETH -> USDC swap (refresh interaction)
    const ethBal = parseFloat(await bal());
    if (ethBal < 0.0008) { console.log("SKIP - not enough ETH"); return; }
    const router = new ethers.Contract(UNI_V3, UNI_ABI, wallet);
    const amountIn = ethers.parseEther("0.0004");
    const params = { tokenIn: WETH, tokenOut: USDC, fee: 500, recipient: ADDR,
      deadline: Math.floor(Date.now()/1000)+600, amountIn, amountOutMinimum: 0, sqrtPriceLimitX96: 0 };
    const tx = await router.exactInputSingle(params, { value: amountIn, gasLimit: 300000 });
    await waitTx(tx, "UniV3 ETH->USDC");
  },

  2: async () => {  // Week 2: USDT -> ETH swap (different direction)
    const usdt = parseFloat(await bal(USDT));
    if (usdt < 0.3) { console.log("SKIP - not enough USDT"); return; }
    const router = new ethers.Contract(UNI_V3, UNI_ABI, wallet);
    const amountIn = ethers.parseUnits(Math.min(usdt - 0.1, 0.5).toString(), 6);
    await approveIfNeeded(USDT, UNI_V3, amountIn, "USDT");
    const params = { tokenIn: USDT, tokenOut: WETH, fee: 3000, recipient: ADDR,
      deadline: Math.floor(Date.now()/1000)+600, amountIn, amountOutMinimum: 0, sqrtPriceLimitX96: 0 };
    const tx = await router.exactInputSingle(params, { gasLimit: 300000 });
    await waitTx(tx, "UniV3 USDT->WETH");
  },

  3: async () => {  // Week 3: Send tiny ETH (create tx history)
    const tx = await wallet.sendTransaction({ to: ADDR, value: ethers.parseEther("0.00005"), gasLimit: 50000 });
    await waitTx(tx, "Self-transfer");
  },

  4: async () => {  // Week 4: Swap USDC -> USDT
    const usdc = parseFloat(await bal(USDC));
    if (usdc < 0.1) { console.log("SKIP - not enough USDC"); return; }
    const router = new ethers.Contract(UNI_V3, UNI_ABI, wallet);
    const amountIn = ethers.parseUnits(usdc.toString(), 6);
    await approveIfNeeded(USDC, UNI_V3, amountIn, "USDC");
    const params = { tokenIn: USDC, tokenOut: USDT, fee: 500, recipient: ADDR,
      deadline: Math.floor(Date.now()/1000)+600, amountIn, amountOutMinimum: 0, sqrtPriceLimitX96: 0 };
    const tx = await router.exactInputSingle(params, { gasLimit: 300000 });
    await waitTx(tx, "UniV3 USDC->USDT");
  },

  5: async () => {  // Week 5: ETH self-transfer (2)
    const tx = await wallet.sendTransaction({ to: ADDR, value: ethers.parseEther("0.00003"), gasLimit: 50000 });
    await waitTx(tx, "Self-transfer");
  },

  // Extended cycle: cheap transfers between swaps to stretch gas
  6: async () => { const a = WEEKLY_ACTIONS[1]; await a(); },
  7: async () => { const a = WEEKLY_ACTIONS[2]; await a(); },
  8: async () => { const a = WEEKLY_ACTIONS[3]; await a(); },
  9: async () => { const a = WEEKLY_ACTIONS[4]; await a(); },
  10: async () => { const a = WEEKLY_ACTIONS[5]; await a(); },
  // Gas-saving extended weeks: cheap transfers between swaps
  11: async () => { const a = WEEKLY_ACTIONS[3]; await a(); },
  12: async () => { const a = WEEKLY_ACTIONS[1]; await a(); },
  13: async () => { const a = WEEKLY_ACTIONS[3]; await a(); },
  14: async () => { const a = WEEKLY_ACTIONS[5]; await a(); },
  15: async () => { const a = WEEKLY_ACTIONS[3]; await a(); },
  16: async () => { const a = WEEKLY_ACTIONS[2]; await a(); },
  17: async () => { const a = WEEKLY_ACTIONS[3]; await a(); },
  18: async () => { const a = WEEKLY_ACTIONS[5]; await a(); },
  19: async () => { const a = WEEKLY_ACTIONS[3]; await a(); },
  20: async () => { const a = WEEKLY_ACTIONS[1]; await a(); },
  // Weeks 21-52: Gas-optimized - only cheap self-transfers to stretch ETH
  21: async () => { const a = WEEKLY_ACTIONS[3]; await a(); },
  22: async () => { const a = WEEKLY_ACTIONS[5]; await a(); },
  23: async () => { const a = WEEKLY_ACTIONS[3]; await a(); },
  24: async () => { const a = WEEKLY_ACTIONS[5]; await a(); },
  25: async () => { const a = WEEKLY_ACTIONS[3]; await a(); },
  26: async () => { const a = WEEKLY_ACTIONS[5]; await a(); },
  27: async () => { const a = WEEKLY_ACTIONS[3]; await a(); },
  28: async () => { const a = WEEKLY_ACTIONS[5]; await a(); },
  29: async () => { const a = WEEKLY_ACTIONS[3]; await a(); },
  30: async () => { const a = WEEKLY_ACTIONS[5]; await a(); },
  31: async () => { const a = WEEKLY_ACTIONS[3]; await a(); },
  32: async () => { const a = WEEKLY_ACTIONS[5]; await a(); },
  33: async () => { const a = WEEKLY_ACTIONS[3]; await a(); },
  34: async () => { const a = WEEKLY_ACTIONS[5]; await a(); },
  35: async () => { const a = WEEKLY_ACTIONS[3]; await a(); },
  36: async () => { const a = WEEKLY_ACTIONS[5]; await a(); },
  37: async () => { const a = WEEKLY_ACTIONS[3]; await a(); },
  38: async () => { const a = WEEKLY_ACTIONS[5]; await a(); },
  39: async () => { const a = WEEKLY_ACTIONS[3]; await a(); },
  40: async () => { const a = WEEKLY_ACTIONS[5]; await a(); },
  41: async () => { const a = WEEKLY_ACTIONS[3]; await a(); },
  42: async () => { const a = WEEKLY_ACTIONS[5]; await a(); },
  43: async () => { const a = WEEKLY_ACTIONS[3]; await a(); },
  44: async () => { const a = WEEKLY_ACTIONS[5]; await a(); },
  45: async () => { const a = WEEKLY_ACTIONS[3]; await a(); },
  46: async () => { const a = WEEKLY_ACTIONS[5]; await a(); },
  47: async () => { const a = WEEKLY_ACTIONS[3]; await a(); },
  48: async () => { const a = WEEKLY_ACTIONS[5]; await a(); },
  49: async () => { const a = WEEKLY_ACTIONS[3]; await a(); },
  50: async () => { const a = WEEKLY_ACTIONS[5]; await a(); },
  51: async () => { const a = WEEKLY_ACTIONS[3]; await a(); },
  52: async () => { const a = WEEKLY_ACTIONS[5]; await a(); },
};

// ======== Main ========
async function main() {
  const weekNum = parseInt(process.argv[2] || "1");
  const weekKey = ((weekNum - 1) % 12) + 1;

  console.log("=== Airdrop Farmer Week " + weekNum + " (action #" + weekKey + ") ===");
  console.log("Wallet: " + ADDR);
  console.log("ETH: " + await bal() + " | USDT: " + await bal(USDT) + " | USDC: " + await bal(USDC));
  console.log("");

  const action = WEEKLY_ACTIONS[weekKey];
  if (action) {
    await action();
  } else {
    console.log("No action for week " + weekNum);
  }

  console.log("");
  console.log("Done. Remaining: ETH=" + await bal() + " USDT=" + await bal(USDT) + " USDC=" + await bal(USDC));
  console.log("Run again next week: node airdrop_farmer.js " + (weekNum + 1));
}

main().catch(e => console.log("ERROR: " + e.message));
