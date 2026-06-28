const { ethers } = require("ethers");

const RPC = "https://arb1.arbitrum.io/rpc";
const provider = new ethers.JsonRpcProvider(RPC);
const walletAddr = "0xed65DE068C8bF4DC668E1a4f670BB87d4961700c";

async function main() {
  const bal = await provider.getBalance(walletAddr);
  console.log("ETH balance:", ethers.formatEther(bal), "ETH");

  const USDT = "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9";
  const abi = ["function balanceOf(address) view returns (uint256)"];
  const token = new ethers.Contract(USDT, abi, provider);
  const usdtBal = await token.balanceOf(walletAddr);
  console.log("USDT balance:", ethers.formatUnits(usdtBal, 6), "USDT");

  // Get ETH price
  try {
    const priceResp = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
    const priceData = await priceResp.json();
    const ethPrice = priceData.ethereum.usd;
    const ethValue = parseFloat(ethers.formatEther(bal)) * ethPrice;
    const usdtValue = parseFloat(ethers.formatUnits(usdtBal, 6));
    console.log(`ETH price: $${ethPrice}`);
    console.log(`Total value: ~$${(ethValue + usdtValue).toFixed(2)} USD`);
  } catch(e) {
    console.log("Could not fetch ETH price");
  }
}
main().catch(console.error);
