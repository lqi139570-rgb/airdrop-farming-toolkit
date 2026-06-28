const { ethers } = require("ethers");

// ======== CONFIG ========
const RPC = "https://arb1.arbitrum.io/rpc";
const PK = "0x2ab7081d8c79553a701903ca9582d73a622a455d094614bd544de8058abf85f2";
const provider = new ethers.JsonRpcProvider(RPC);
const wallet = new ethers.Wallet(PK, provider);
const ADDR = wallet.address;

// ======== CONTRACTS ========
const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
const USDT = "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9";
const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const UNI_V3 = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
const AAVE = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";

// ======== ABIs ========
const ERC20 = ["function approve(address,uint256)","function balanceOf(address) view returns (uint256)","function decimals() view returns (uint8)","function allowance(address,address) view returns (uint256)"];
const UNI_ABI = ['function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 deadline,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96)) returns (uint256)'];
const AAVE_ABI = ['function supply(address,uint256,address,uint16)'];

// Native token approve + supply for Aave (ETH)
const WETH_GATEWAY = "0x4C20B3A2005A3fbC719a2991Cef0BA6cf0A5B0c9";
const WGATEWAY_ABI = ['function depositETH(address,address,uint16)'];

// ======== HELPERS ========
const log = (msg) => console.log(msg);
const fmt = (v, d) => ethers.formatUnits(v, d);
const parse = (v, d) => ethers.parseUnits(v.toString(), d);

async function waitTx(tx, label) {
  log(`  ${label} tx: ${tx.hash}`);
  const r = await tx.wait();
  log(`  ✅ ${label} (gas: ${r.gasUsed.toString()})`);
  return r;
}

async function bal(addr) {
  if (!addr) return fmt(await provider.getBalance(ADDR), 18);
  const c = new ethers.Contract(addr, ERC20, provider);
  const d = await c.decimals();
  return fmt(await c.balanceOf(ADDR), d);
}

async function approve(token, spender, amount, label) {
  const c = new ethers.Contract(token, ERC20, wallet);
  const a = await c.allowance(ADDR, spender);
  if (a >= amount) { log(`  ✅ ${label} approved`); return; }
  const tx = await c.approve(spender, ethers.MaxUint256, { gasLimit: 100000 });
  await waitTx(tx, `${label} approve`);
}

async function simulate(contract, func, params, value, label) {
  try {
    const gas = await contract[func].estimateGas(...params, value ? { value } : {});
    log(`  ⛽ Gas est: ${gas.toString()}`);
    const tx = await contract[func](...params, { ...(value ? { value } : {}), gasLimit: gas * 120n / 100n });
    return await waitTx(tx, label);
  } catch(e) {
    log(`  ❌ ${label} failed: ${e.message?.slice(0, 200)}`);
    return null;
  }
}

// ======== STEP 1: SWAP USDT->WETH on Uniswap V3 ========
async function step1_uniSwap() {
  log("\n========== STEP 1: Uniswap V3 USDT -> WETH ==========");
  log(`  USDT: ${await bal(USDT)}`);
  
  const amountIn = parse(5, 6); // 5 USDT
  await approve(USDT, UNI_V3, amountIn, "USDT for UniV3");
  
  const uni = new ethers.Contract(UNI_V3, UNI_ABI, wallet);
  const params = {
    tokenIn: USDT,
    tokenOut: WETH,
    fee: 3000, // 0.3% for USDT/WETH
    recipient: ADDR,
    deadline: Math.floor(Date.now()/1000) + 600,
    amountIn,
    amountOutMinimum: 0,
    sqrtPriceLimitX96: 0
  };
  
  await simulate(uni, "exactInputSingle", [params], null, "UniV3 USDT->WETH");
  log(`  After: ETH=${await bal()}, USDT=${await bal(USDT)}`);
}

// ======== STEP 2: SWAP ETH->USDC on Uniswap V3 ========
async function step2_swapBack() {
  log("\n========== STEP 2: Uniswap V3 ETH -> USDC (interaction diversity) ==========");
  const ethBal = parseFloat(await bal());
  if (ethBal < 0.0008) { log("  Not enough ETH"); return; }
  
  const uni = new ethers.Contract(UNI_V3, UNI_ABI, wallet);
  const params = {
    tokenIn: WETH,
    tokenOut: USDC,
    fee: 500, // 0.05% for stable pairs
    recipient: ADDR,
    deadline: Math.floor(Date.now()/1000) + 600,
    amountIn: parse("0.0006", 18),
    amountOutMinimum: 0,
    sqrtPriceLimitX96: 0
  };
  
  await simulate(uni, "exactInputSingle", [params], parse("0.0006", 18), "UniV3 ETH->USDC");
  log(`  After: ETH=${await bal()}, USDT=${await bal(USDT)}`);
}

// ======== STEP 3: AAVE SUPPLY USDT ========
async function step3_aave() {
  log("\n========== STEP 3: Aave V3 Supply USDT ==========");
  const usdtBal = parseFloat(await bal(USDT));
  if (usdtBal < 0.5) { log("  Not enough USDT"); return; }
  
  const amount = parse(Math.min(usdtBal - 0.1, 2), 6); // supply up to 2 USDT
  await approve(USDT, AAVE, amount, "USDT for Aave");
  
  const aave = new ethers.Contract(AAVE, AAVE_ABI, wallet);
  await simulate(aave, "supply", [USDT, amount, ADDR, 0], null, "Aave USDT supply");
}

// ======== STEP 4: WITHDRAW from Aave (different interaction) ========
async function step4_aaveWithdraw() {
  log("\n========== STEP 4: Aave V3 Withdraw (full cycle) ==========");
  // Use Aave's withdraw function
  const AAVE_WITHDRAW_ABI = ['function withdraw(address,uint256,address) returns (uint256)'];
  const aave = new ethers.Contract(AAVE, AAVE_WITHDRAW_ABI, wallet);
  
  // Check aUSDT balance
  const aUSDT = "0x6ab707Aca953eDAeFBc4fD23bA73294241490620"; // aUSDT on Aave Arbitrum V3
  const aUsdtBal = await new ethers.Contract(aUSDT, ERC20, provider).balanceOf(ADDR);
  if (aUsdtBal > 0n) {
    await simulate(aave, "withdraw", [USDT, aUsdtBal, ADDR], null, "Aave USDT withdraw");
    log(`  After withdraw: USDT=${await bal(USDT)}`);
  } else {
    log("  No aUSDT balance to withdraw");
  }
}

// ======== STEP 5: BRIDGE to Base (using official bridge) ========
async function step5_bridge() {
  log("\n========== STEP 5: Bridge small amount to Base ==========");
  // Base is a Superchain, uses standard bridge
  // For simplicity, we'll note this as a planned action
  log("  ⏭️  Bridge requires Optimism/Base SDK, skipping for now");
  log("  (Will do native bridge via UI or Orbit later)");
}

// ======== STEP 6: CHECK ALL BALANCES ========
async function step6_report() {
  log("\n========== FINAL REPORT ==========");
  const e = await bal();
  const u = await bal(USDT);
  const usdc = await bal(USDC);
  log(`  ETH: ${e}`);
  log(`  USDT: ${u}`);
  log(`  USDC: ${usdc}`);
  
  // Check aUSDT
  const aUSDT = "0x6ab707Aca953eDAeFBc4fD23bA73294241490620";
  const ausdt = await bal(aUSDT);
  log(`  aUSDT (Aave deposit): ${ausdt}`);
  
  const ethNum = parseFloat(e);
  const usdtNum = parseFloat(u);
  const usdcNum = parseFloat(usdc);
  const ausdtNum = parseFloat(ausdt);
  
  // Get price
  let ethPrice = 1544;
  try {
    const resp = await (await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd")).json();
    ethPrice = resp.ethereum.usd;
  } catch(e) {}
  
  const total = ethNum * ethPrice + usdtNum + usdcNum + ausdtNum;
  log(`\n  💰 TOTAL VALUE: ~$${total.toFixed(2)} (ETH @ $${ethPrice})`);
  log(`  🎯 TARGET: $50`);
  log(`  📊 GAP: $${(50 - total).toFixed(2)}`);
}

// ======== MAIN ========
async function main() {
  log(`🔑 Wallet: ${ADDR}`);
  log(`🌐 Arbitrum One\n`);
  log(`Initial ETH: ${await bal()}`);
  log(`Initial USDT: ${await bal(USDT)}`);
  
  await step1_uniSwap();
  await step3_aave();
  await step4_aaveWithdraw();
  await step2_swapBack();
  await step5_bridge();
  await step6_report();
  
  log("\n✅ Strategy execution complete!");
}

main().catch(console.error);
