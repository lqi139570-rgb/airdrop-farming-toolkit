const { ethers } = require("ethers");

// ======== CONFIG ========
const RPC = "https://arb1.arbitrum.io/rpc";
const PRIVATE_KEY = process.env.WALLET_PK || "0x2ab7081d8c79553a701903ca9582d73a622a455d094614bd544de8058abf85f2";
const provider = new ethers.JsonRpcProvider(RPC);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const ADDR = wallet.address;

// ======== CONTRACT ADDRESSES ========
const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
const USDT = "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9";
const CAMELOT_ROUTER = "0xc873fEcbd354f5A56E00E710B90EF4201db2448d";
const UNISWAP_V3_ROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
const AAVE_POOL = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";
const ARB = "0x912CE59144191C1204E64559FE8253a0e49E6548";

// ======== ABIs ========
const ERC20_ABI = ["function approve(address spender, uint256 amount) returns (bool)",
                    "function balanceOf(address) view returns (uint256)",
                    "function decimals() view returns (uint8)",
                    "function allowance(address, address) view returns (uint256)"];

const CAMELOT_ABI = ["function swapExactTokensForTokensSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] path, address to, address referrer, uint deadline) returns (uint[] memory)"];

const UNISWAP_V3_ABI = ["function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external returns (uint256 amountOut)"];

const AAVE_ABI = ["function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)"];

// ======== HELPERS ========
async function waitTx(tx, label) {
  console.log(`  ⏳ ${label} tx: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`  ✅ ${label} gasUsed: ${(receipt.gasUsed * receipt.gasPrice / 1n).toString()}`);
  return receipt;
}

async function getBalance(tokenAddr) {
  if (tokenAddr === "native") return ethers.formatEther(await provider.getBalance(ADDR));
  const token = new ethers.Contract(tokenAddr, ERC20_ABI, provider);
  const decimals = await token.decimals();
  return ethers.formatUnits(await token.balanceOf(ADDR), decimals);
}

async function approveIfNeeded(tokenAddr, spender, amount, label) {
  const token = new ethers.Contract(tokenAddr, ERC20_ABI, wallet);
  const allowance = await token.allowance(ADDR, spender);
  if (allowance < amount) {
    console.log(`  Approving ${label}...`);
    const tx = await token.approve(spender, ethers.MaxUint256);
    await waitTx(tx, `${label} approve`);
  } else {
    console.log(`  ✅ ${label} already approved`);
  }
}

// ======== STEP 1: Swap USDT -> WETH on Camelot ========
async function step1_swapUSDTtoWETH() {
  console.log("\n========== STEP 1: Swap USDT -> WETH on Camelot ==========");
  const usdtBal = await getBalance(USDT);
  console.log(`  USDT balance: ${usdtBal}`);

  // Swap 5 USDT -> WETH
  const amountIn = ethers.parseUnits("5.0", 6);
  const amountOutMin = 0n; // accept any amount

  await approveIfNeeded(USDT, CAMELOT_ROUTER, amountIn, "USDT for Camelot");

  const camelot = new ethers.Contract(CAMELOT_ROUTER, CAMELOT_ABI, wallet);
  const deadline = Math.floor(Date.now() / 1000) + 600;

  const path = [USDT, WETH];
  console.log("  Executing swap...");
  const tx = await camelot.swapExactTokensForTokensSupportingFeeOnTransferTokens(
    amountIn, amountOutMin, path, ADDR, ethers.ZeroAddress, deadline,
    { gasLimit: 500000 }
  );
  await waitTx(tx, "Camelot USDT->WETH");

  const newEth = await getBalance("native");
  const newUsdt = await getBalance(USDT);
  console.log(`  After swap: ETH=${newEth}, USDT=${newUsdt}`);
}

// ======== STEP 2: Swap small ETH on Uniswap V3 ========
async function step2_swapETHonUniswap() {
  console.log("\n========== STEP 2: Swap ETH -> USDC on Uniswap V3 ==========");
  const ethBal = await getBalance("native");
  console.log(`  ETH balance: ${ethBal}`);

  const USDC_ARB = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
  const amountIn = ethers.parseEther("0.0005");
  console.log(`  Swapping 0.0005 ETH -> USDC...`);

  const uniswap = new ethers.Contract(UNISWAP_V3_ROUTER, UNISWAP_V3_ABI, wallet);

  const params = {
    tokenIn: WETH,
    tokenOut: USDC_ARB,
    fee: 500, // 0.05% fee tier
    recipient: ADDR,
    deadline: Math.floor(Date.now() / 1000) + 600,
    amountIn: amountIn,
    amountOutMinimum: 0,
    sqrtPriceLimitX96: 0
  };

  const tx = await uniswap.exactInputSingle(params, {
    value: amountIn,
    gasLimit: 500000
  });
  await waitTx(tx, "Uniswap V3 ETH->USDC");

  console.log(`  After Uniswap: ETH=${await getBalance("native")}`);
}

// ======== STEP 3: Provide LP on Camelot Stable Pool ========
async function step3_camelotLP() {
  console.log("\n========== STEP 3: Camelot LP (coming soon) ==========");
  // Camelot uses a non-standard factory/pair system
  // For simplicity, skip the LP step or do a simple deposit
  console.log("  (Skipping complex LP - gas optimization)");
}

// ======== STEP 4: Aave Deposit ========
async function step4_aaveDeposit() {
  console.log("\n========== STEP 4: Deposit into Aave V3 ==========");
  const usdtBal = await getBalance(USDT);
  const usdtNum = parseFloat(usdtBal);
  console.log(`  USDT balance: ${usdtBal}`);

  if (usdtNum < 0.5) {
    console.log("  Not enough USDT to deposit on Aave, skipping");
    return;
  }

  const depositAmount = ethers.parseUnits("2.0", 6); // deposit 2 USDT
  await approveIfNeeded(USDT, AAVE_POOL, depositAmount, "USDT for Aave");

  const aave = new ethers.Contract(AAVE_POOL, AAVE_ABI, wallet);
  const tx = await aave.supply(USDT, depositAmount, ADDR, 0, { gasLimit: 500000 });
  await waitTx(tx, "Aave USDT supply");
  console.log(`  Aave deposit complete!`);
}

// ======== STEP 5: Swap some ARB if we have any ========
async function step5_arbSwap() {
  console.log("\n========== STEP 5: Check/swap ARB ==========");
  const arbToken = new ethers.Contract(ARB, ERC20_ABI, provider);
  const arbBal = await arbToken.balanceOf(ADDR);
  console.log(`  ARB balance: ${ethers.formatEther(arbBal)}`);
}

// ======== MAIN ========
async function main() {
  console.log(`Wallet: ${ADDR}`);
  console.log(`Chain: Arbitrum One`);
  console.log(`Initial ETH: ${await getBalance("native")}`);
  console.log(`Initial USDT: ${await getBalance(USDT)}`);

  await step1_swapUSDTtoWETH();
  await step2_swapETHonUniswap();
  await step4_aaveDeposit();
  await step5_arbSwap();

  console.log("\n========== FINAL BALANCE ==========");
  console.log(`ETH: ${await getBalance("native")}`);
  console.log(`USDT: ${await getBalance(USDT)}`);
}

main().catch(console.error);
