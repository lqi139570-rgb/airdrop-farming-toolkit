const axios = require('axios');
async function main() {
  try {
    const resp = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=ethereum,arbitrum&vs_currencies=usd', { timeout: 10000 });
    console.log('ETH:', resp.data.ethereum.usd);
    console.log('ARB:', resp.data.arbitrum.usd);
  } catch(e) {
    try {
      const resp = await axios.get('https://min-api.cryptocompare.com/data/price?fsym=ETH&tsyms=USD', { timeout: 10000 });
      console.log('ETH:', resp.data.USD);
    } catch(e2) {
      console.log('Price fetch failed, assuming ~$1900');
    }
  }
}
main();
