# Airdrop Farming Toolkit — Complete Strategy Guide

## What This Is

A complete, automated system for building wallet history across multiple DeFi protocols. The goal: position this wallet for future airdrops by creating a track record of genuine, diverse, consistent on-chain activity.

## Why This Works

Protocols use airdrops to reward early adopters. The key criteria they look at:

| Factor | Weight | How We Score |
|--------|--------|--------------|
| Number of transactions | Medium | 48+ and counting |
| Unique protocols used | High | 3 so far, targeting 15+ |
| Consistency over time | Very High | Weekly activity for 52 weeks |
| Transaction diversity | High | Swaps, transfers, LP, lending |
| Wallet age | High | Active since June 2026 |

---

## Files in This Toolkit

| File | Purpose |
|------|---------|
| `airdrop_farmer.js` | Main farming script — run weekly with week number |
| `tracker.js` | Check wallet status and progress |
| `dashboard.html` | Visual dashboard (open in browser) |
| `keep_alive.js` | Minimal weekly script (backup) |
| `strategy.md` | Detailed strategy document |
| `setup.bat` | One-click setup for Windows |
| `GUIDE.md` | This file |

## How to Use

### Step 1: Install Dependencies (one-time)
```
cd wallet-bot
npm install ethers@6
```

### Step 2: Run Weekly Farming
```
node airdrop_farmer.js 1   # Week 1
node airdrop_farmer.js 2   # Week 2
...                        # Continue weekly
```

The script automatically:
- Rotates through different transaction types
- Skips actions when balance is too low
- Reports gas usage and remaining balance

### Step 3: Track Progress
```
node tracker.js
```

### Step 4: View Dashboard
Open `dashboard.html` in any browser.

---

## Free Ways to Boost This Wallet

These require only a browser + MetaMask, no additional funds:

1. **ACI Testnet** → https://aci-token.net (June 30 deadline)
2. **Layer3** → https://layer3.xyz — free quests
3. **Galxe** → https://galxe.com — OAT badges
4. **Zealy** → https://zealy.io — social tasks

---

## Technical Details

- **Chain:** Arbitrum One
- **Gas Cost:** ~$0.20-0.30 per swap, ~$0.04 per transfer
- **Total Gas Spent:** $9.58 (48 transactions)
- **Remaining ETH:** 0.000678 (~$1.05, enough for ~30 more transfers)
- **Remaining USDT:** 0.84 (frozen)

## Security Notes

- Private key is hardcoded in scripts for automation
- **The private key has been exposed in this conversation**
- For production use, move funds to a new wallet and use environment variables

---

## License

Free for personal use. No warranty. DYOR.
