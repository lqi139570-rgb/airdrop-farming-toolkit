const { ethers } = require("ethers");

// ======== 每周运行一次，保持钱包活跃 ========
const RPC = "https://arb1.arbitrum.io/rpc";
const PK = "0x2ab7081d8c79553a701903ca9582d73a622a455d094614bd544de8058abf85f2";
const provider = new ethers.JsonRpcProvider(RPC);
const wallet = new ethers.Wallet(PK, provider);
const ADDR = wallet.address;

const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const UNI_V3 = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
const ERC20 = ["function approve(address,uint256)","function balanceOf(address) view returns (uint256)","function decimals() view returns (uint8)","function allowance(address,address) view returns (uint256)"];
const UNI_ABI = ['function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 deadline,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96)) returns (uint256)'];

async function bal(addr) {
  if (!addr) return ethers.formatEther(await provider.getBalance(ADDR));
  const c = new ethers.Contract(addr, ERC20, provider);
  return ethers.formatUnits(await c.balanceOf(ADDR), await c.decimals());
}

async function waitTx(tx, label) {
  console.log("  " + label + ": " + tx.hash);
  await tx.wait();
  console.log("  OK");
}

async function main() {
  console.log("=== Weekly Keep-Alive ===");
  console.log("Wallet: " + ADDR);
  console.log("ETH: " + await bal() + ", USDC: " + await bal(USDC));

  // Do a small swap if enough balance
  const ethBal = parseFloat(await bal());
  if (ethBal > 0.0008) {
    const router = new ethers.Contract(UNI_V3, UNI_ABI, wallet);
    const params = {
      tokenIn: WETH, tokenOut: USDC, fee: 500,
      recipient: ADDR, deadline: Math.floor(Date.now()/1000) + 600,
      amountIn: ethers.parseEther("0.0005"),
      amountOutMinimum: 0, sqrtPriceLimitX96: 0
    };
    const gas = await router.exactInputSingle.estimateGas(params, { value: ethers.parseEther("0.0005") });
    const tx = await router.exactInputSingle(params, { value: ethers.parseEther("0.0005"), gasLimit: gas * 120n / 100n });
    await waitTx(tx, "Weekly swap ETH->USDC");
  }

  // Self-transfer
  const tx = await wallet.sendTransaction({ to: ADDR, value: ethers.parseEther("0.00005"), gasLimit: 50000 });
  await waitTx(tx, "Weekly self-transfer");

  console.log("\nRemaining ETH: " + await bal());
  console.log("Done! Run again next week.");
}
main().catch(console.error);
