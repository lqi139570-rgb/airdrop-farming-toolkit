const { ethers } = require("ethers");

const RPC = "https://arb1.arbitrum.io/rpc";
const PK = "0x2ab7081d8c79553a701903ca9582d73a622a455d094614bd544de8058abf85f2";
const provider = new ethers.JsonRpcProvider(RPC);
const wallet = new ethers.Wallet(PK, provider);
const ADDR = wallet.address;

const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
const USDT = "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9";
const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";

const ERC20 = ["function approve(address,uint256)","function balanceOf(address) view returns (uint256)","function decimals() view returns (uint8)","function allowance(address,address) view returns (uint256)"];
const UNI_ABI = ['function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 deadline,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96)) returns (uint256)'];

async function waitTx(tx, label) {
  console.log("  " + label + ": " + tx.hash);
  const r = await tx.wait();
  console.log("  OK " + label);
  return r;
}

async function bal(addr) {
  if (!addr) return ethers.formatEther(await provider.getBalance(ADDR));
  const c = new ethers.Contract(addr, ERC20, provider);
  const d = await c.decimals();
  return ethers.formatUnits(await c.balanceOf(ADDR), d);
}

async function main() {
  console.log("Wallet: " + ADDR);
  console.log("ETH: " + await bal() + ", USDT: " + await bal(USDT) + ", USDC: " + await bal(USDC));
  
  const UNI_V3 = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
  
  // STEP 1: Swap USDC -> USDT on UniV3
  console.log("\n--- R2 STEP 1: UniV3 USDC -> USDT ---");
  const usdcBal = parseFloat(await bal(USDC));
  if (usdcBal > 0.1) {
    const usdcC = new ethers.Contract(USDC, ERC20, wallet);
    const amountIn = ethers.parseUnits(Math.min(usdcBal - 0.05, 0.7).toString(), 6);
    const allowance = await usdcC.allowance(ADDR, UNI_V3);
    if (allowance < amountIn) {
      const tx = await usdcC.approve(UNI_V3, ethers.MaxUint256, { gasLimit: 100000 });
      await waitTx(tx, "USDC approve");
    }
    const router = new ethers.Contract(UNI_V3, UNI_ABI, wallet);
    const params = {
      tokenIn: USDC, tokenOut: USDT, fee: 500,
      recipient: ADDR, deadline: Math.floor(Date.now()/1000) + 600,
      amountIn, amountOutMinimum: 0, sqrtPriceLimitX96: 0
    };
    const gas = await router.exactInputSingle.estimateGas(params);
    const tx = await router.exactInputSingle(params, { gasLimit: (gas * 120n / 100n) });
    await waitTx(tx, "UniV3 USDC->USDT");
  } else {
    console.log("  Not enough USDC");
  }
  
  // STEP 2: Try Camelot
  console.log("\n--- R2 STEP 2: Camelot DEX USDT -> WETH ---");
  const CAMELOT = "0xc873fEcbd354f5A56E00E710B90EF4201db2448d";
  const usdtBal = parseFloat(await bal(USDT));
  if (usdtBal > 0.5) {
    const usdtC = new ethers.Contract(USDT, ERC20, wallet);
    const amountIn = ethers.parseUnits("0.5", 6);
    const allowance = await usdtC.allowance(ADDR, CAMELOT);
    if (allowance < amountIn) {
      const tx = await usdtC.approve(CAMELOT, ethers.MaxUint256, { gasLimit: 100000 });
      await waitTx(tx, "USDT approve Camelot");
    }
    
    try {
      const v2ABI = ["function swapExactTokensForTokens(uint256,uint256,address[],address,uint256) returns (uint256[])"];
      const camelotV2 = new ethers.Contract(CAMELOT, v2ABI, wallet);
      const gas = await camelotV2.swapExactTokensForTokens.estimateGas(
        amountIn, 0, [USDT, WETH], ADDR, Math.floor(Date.now()/1000) + 600
      );
      const tx = await camelotV2.swapExactTokensForTokens(
        amountIn, 0, [USDT, WETH], ADDR, Math.floor(Date.now()/1000) + 600,
        { gasLimit: (gas * 120n / 100n) }
      );
      await waitTx(tx, "Camelot V2 swap");
    } catch(e) {
      console.log("  Camelot V2 failed");
      try {
        const v2refABI = ["function swapExactTokensForTokens(uint256,uint256,address[],address,address,uint256) returns (uint256[])"];
        const camelotRef = new ethers.Contract(CAMELOT, v2refABI, wallet);
        const tx = await camelotRef.swapExactTokensForTokens(
          amountIn, 0, [USDT, WETH], ADDR, ethers.ZeroAddress, Math.floor(Date.now()/1000) + 600,
          { gasLimit: 500000 }
        );
        await waitTx(tx, "Camelot ref swap");
      } catch(e2) {
        console.log("  Camelot ref failed too: " + e2.message.slice(0, 100));
      }
    }
  } else {
    console.log("  Not enough USDT");
  }
  
  // STEP 3: Self-transfer
  console.log("\n--- R2 STEP 3: ETH self-transfer ---");
  const ethBal = parseFloat(await bal());
  if (ethBal > 0.0005) {
    const tx = await wallet.sendTransaction({
      to: ADDR,
      value: ethers.parseEther("0.0001"),
      gasLimit: 50000
    });
    await waitTx(tx, "Self-transfer");
  }
  
  // FINAL REPORT
  console.log("\n========== FINAL STATE ==========");
  const e = await bal();
  const u = await bal(USDT);
  const usdc = await bal(USDC);
  
  let ethPrice = 1544;
  try {
    const resp = await (await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd")).json();
    ethPrice = resp.ethereum.usd;
  } catch(e) {}
  
  const total = parseFloat(e) * ethPrice + parseFloat(u) + parseFloat(usdc);
  console.log("  ETH: " + e + " ($" + (parseFloat(e) * ethPrice).toFixed(2) + ")");
  console.log("  USDT: " + u);
  console.log("  USDC: " + usdc);
  console.log("\n  TOTAL: ~$" + total.toFixed(2));
  console.log("  TARGET: $50");
  console.log("  GAP: $" + (50 - total).toFixed(2));
  
  console.log("\n  FREE next steps (no capital needed):");
  console.log("  >> ACI testnet airdrop (ends June 30):");
  console.log("     1. Get Sepolia ETH: https://www.alchemy.com/faucets/ethereum-sepolia");
  console.log("     2. Go to ACI testnet app, connect MetaMask");
  console.log("     3. Swap Sepolia ETH -> ACI -> Stake -> Missions");
  console.log("  >> Layer3: https://layer3.xyz (free quests)");
  console.log("  >> Galxe: https://galxe.com (OAT badges)");
  console.log("  >> Zealy: https://zealy.io (social tasks)");
}

main().catch(console.error);
