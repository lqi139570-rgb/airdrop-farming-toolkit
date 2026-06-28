const { ethers } = require("ethers");
const RPC = "https://arb1.arbitrum.io/rpc";
const provider = new ethers.JsonRpcProvider(RPC);

const CAMELOT_ROUTER = "0xc873fEcbd354f5A56E00E710B90EF4201db2448d";
const UNISWAP_V3_ROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564";

async function main() {
  // Check Camelot router code
  const code = await provider.getCode(CAMELOT_ROUTER);
  console.log("Camelot Router has code:", code.length > 100);

  // Check Uniswap V3 router
  const code2 = await provider.getCode(UNISWAP_V3_ROUTER);
  console.log("Uniswap V3 Router has code:", code2.length > 100);

  // Try to detect interface
  const iface = new ethers.Interface([
    "function swapExactTokensForTokens(uint256,uint256,address[],address,uint256) returns (uint256[])",
    "function swapExactTokensForTokensSupportingFeeOnTransferTokens(uint256,uint256,address[],address,uint256) returns (uint256[])"
  ]);

  // Check if Camelot supports these selectors
  for (const func of ["swapExactTokensForTokens(uint256,uint256,address[],address,uint256)", 
                      "swapExactTokensForTokensSupportingFeeOnTransferTokens(uint256,uint256,address[],address,uint256)"]) {
    const selector = ethers.id(func).slice(0, 10);
    console.log(`Selector ${func.slice(0,30)}... ${selector}`);
  }
}
main();
