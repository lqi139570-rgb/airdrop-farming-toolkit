const { ethers } = require("ethers");

const ADDR = "0xed65DE068C8bF4DC668E1a4f670BB87d4961700c";

const chains = {
  "Ethereum": "https://eth.llamarpc.com",
  "Arbitrum": "https://arb1.arbitrum.io/rpc",
  "Optimism": "https://mainnet.optimism.io",
  "Base": "https://mainnet.base.org",
  "Polygon": "https://polygon-rpc.com",
  "BNB Chain": "https://bsc-dataseed1.binance.org",
  "Avalanche": "https://api.avax.network/ext/bc/C/rpc",
};

async function checkChain(name, rpc) {
  try {
    const provider = new ethers.JsonRpcProvider(rpc, undefined, { staticNetwork: true });
    const bal = await provider.getBalance(ADDR);
    const eth = ethers.formatEther(bal);
    if (parseFloat(eth) > 0) {
      console.log("  " + name + ": " + eth + " ETH (~$" + (parseFloat(eth) * 1544).toFixed(2) + ")");
      return true;
    }
    return false;
  } catch(e) {
    console.log("  " + name + ": error");
    return false;
  }
}

async function main() {
  console.log("Checking wallet " + ADDR + " across chains...\n");
  for (const [name, rpc] of Object.entries(chains)) {
    await checkChain(name, rpc);
  }
  console.log("\nDone checking.");
}
main().catch(console.error);
