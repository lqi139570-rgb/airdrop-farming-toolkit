const { ethers } = require("ethers");
const RPC = "https://arb1.arbitrum.io/rpc";
const provider = new ethers.JsonRpcProvider(RPC);

const CAMELOT_ROUTER = "0xc873fEcbd354f5A56E00E710B90EF4201db2448d";

// Camelot uses modified UniswapV2 with referrer param
// Let's check if our expected function exists by computing its selector
const sigs = [
  // Standard UniswapV2
  "swapExactTokensForTokens(uint256,uint256,address[],address,uint256)",
  "swapExactTokensForTokensSupportingFeeOnTransferTokens(uint256,uint256,address[],address,uint256)",
  // Camelot with referrer
  "swapExactTokensForTokensSupportingFeeOnTransferTokens(uint256,uint256,address[],address,address,uint256)",
  "swapExactTokensForTokens(uint256,uint256,address[],address,address,uint256)",
  // Camelot specific
  "swapExactTokensForTokens(uint256,uint256,address[],address,bool,uint256)",
  "swapExactTokensForTokensSupportingFeeOnTransferTokens(uint256,uint256,address[],address,bool,uint256)",
];

console.log("Expected selectors:");
for (const sig of sigs) {
  const selector = ethers.id(sig).slice(0, 10);
  console.log(`  ${selector} <- ${sig}`);
}

// Let's also try checking via a call to see what the contract responds to
// We can use the eth_call to check if a function exists via the contract's code
async function main() {
  const code = await provider.getCode(CAMELOT_ROUTER);
  console.log("\nContract code length:", code.length);
  console.log("Code exists:", code !== "0x");
  
  // Let's try to read the router's WETH address (common UniswapV2 function)
  const wethIface = new ethers.Interface(["function WETH() view returns (address)"]);
  try {
    const wethAddr = await provider.call({
      to: CAMELOT_ROUTER,
      data: wethIface.getFunction("WETH").selector
    });
    const decoded = ethers.AbiCoder.defaultAbiCoder().decode(["address"], wethAddr);
    console.log("Camelot WETH:", decoded[0]);
  } catch(e) {
    console.log("WETH() not found on Camelot router");
  }
}
main();
