const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

// ============================================================
// 进度追踪器 — 查看钱包状态和 farming 进度
// 用法: node tracker.js
// ============================================================

const RPC = "https://arb1.arbitrum.io/rpc";
const ADDR = "0xed65DE068C8bF4DC668E1a4f670BB87d4961700c";
const provider = new ethers.JsonRpcProvider(RPC);

const IMPORTANT_TOKENS = {
  "ETH": null,
  "USDT": "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
  "USDC": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  "ARB": "0x912CE59144191C1204E64559FE8253a0e49E6548",
  "GMX": "0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a",
  "GRAIL": "0x3d9907F9a368ad0a51Be60f7Da3b97cf940982D8",
  "RDNT": "0x3082CC23568eA640225c2467653dB90e9250AaA0",
  "MAGIC": "0x539bdE0d7Dbd336b79148AA742883198BBF60342",
};

const HISTORY_FILE = path.join(__dirname, "progress.json");

async function main() {
  const erc20 = ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"];
  const results = { date: new Date().toISOString(), balances: {} };

  console.log("=== Wallet Progress Tracker ===");
  console.log("Address: " + ADDR);
  console.log("");

  // Get balances
  for (const [sym, addr] of Object.entries(IMPORTANT_TOKENS)) {
    try {
      let bal;
      if (!addr) {
        bal = ethers.formatEther(await provider.getBalance(ADDR));
      } else {
        const c = new ethers.Contract(addr, erc20, provider);
        bal = ethers.formatUnits(await c.balanceOf(ADDR), await c.decimals());
      }
      results.balances[sym] = bal;
      if (parseFloat(bal) > 0) {
        console.log("  " + sym.padEnd(6) + bal);
      }
    } catch(e) { /* ignore */ }
  }

  // Get ETH price
  let ethPrice = 1544;
  try {
    const resp = await (await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd")).json();
    ethPrice = resp.ethereum.usd;
  } catch(e) {}
  results.ethPrice = ethPrice;

  const total = parseFloat(results.balances.ETH || 0) * ethPrice
    + parseFloat(results.balances.USDT || 0)
    + parseFloat(results.balances.USDC || 0);
  results.totalUSD = total;

  console.log("");
  console.log("  TOTAL:  ~$" + total.toFixed(2));
  console.log("  TARGET: $50");
  console.log("  GAP:    $" + (50 - total).toFixed(2) + " (" + ((total/50)*100).toFixed(1) + "%)");
  console.log("");

  // Load history
  let history = [];
  if (fs.existsSync(HISTORY_FILE)) {
    try { history = JSON.parse(fs.readFileSync(HISTORY_FILE, "utf8")); } catch(e) {}
  }
  history.push(results);
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
  console.log("Progress saved to progress.json (" + history.length + " checkpoints)");

  // Show trend
  if (history.length >= 2) {
    const first = history[0];
    const change = total - (parseFloat(first.balances.ETH || 0) * (first.ethPrice || 1544)
      + parseFloat(first.balances.USDT || 0) + parseFloat(first.balances.USDC || 0));
    console.log("  Since start: $" + change.toFixed(2) + " change");
  }

  console.log("");
  console.log("Next: node airdrop_farmer.js <week_number>");
}

main().catch(console.error);
