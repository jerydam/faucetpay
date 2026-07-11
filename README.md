# ⚡ PrimeIQ

**A knowledge dueling and quiz platform on Celo — get free DROPS, duel bots or players, join tournaments, win and redeem for $G.**

> Built by [FaucetDrops](https://faucetdrops.io), running natively on [MiniPay](https://minipay.opera.com) on Celo. No deposits. No real money at stake. Just knowledge.

🌐 **Live app:** [minipay.faucetdrops.io](https://minipay.faucetdrops.io)  
📱 **Open in MiniPay:** paste `minipay.faucetdrops.io` in the MiniPay browser  
🐦 **Twitter/X:** [@FaucetDrops](https://x.com/FaucetDrops)  
💬 **Telegram:** [t.me/FaucetDropschat](https://t.me/FaucetDropschat)

---

## What It Does

PrimeIQ has three distinct game modes, all running on Celo:

### /challenge — Duels (1v1)
Two formats:

**Solo** — You vs a bot. Pick any topic and a difficulty tier. Your DROPS entry is burned on-chain, the matching bot entry is burned by the backend, and the winner gets double minted back. The bot's accuracy and speed are calibrated per tier — from 35% accuracy (Droplet) to 90% (Flood). Outcome is immediate and fully on-chain.

**1v1** — You vs another player. Creator posts a challenge (public or invite-only), challenger joins and both burn their DROPS entry. Backend confirms both burns on-chain, game loop runs over WebSocket, winner gets double minted. Optional stake negotiation available once both players have earned their Rematch Badge (10 games played).

### /quiz — Tournaments
Group quiz rooms for 2 or more players. Creator deploys a `QuizReward` contract, funds a prize pool in any allowed token (cUSD, USDT, USDm, or native CELO), and sets a winner distribution (equal split or custom tiers). Players join and compete simultaneously. Backend distributes rewards to the top performers via the on-chain contract at game end. Supports a configurable max participant count and a 48-hour claim window.

---

## DROPS — Two Pouches

Every player has two separate DROPS balances:

### Game Pouch (`game_drops`)
- Used to **enter duels** — DROPS burned from this pouch when you play
- Refilled by: welcome bonus, daily FaucetDrops claim, winning duels, buying with $G, tie refunds
- This is your "playing balance"

### Reward Pouch (`reward_drops`)
- Holds **winnings** from completed games (PvP wins credit here)
- Can only be **redeemed for $G** — not spent on duels directly
- This separation means winnings are ring-fenced and must be intentionally redeemed

> Solo challenge wins credit directly to `game_drops` (instant, since settlement is immediate). PvP wins write a pending claim to `reward_drops` that the player must explicitly claim.

---

## Getting DROPS

### 1. Welcome Bonus (Free — No Purchase)
On first registration, call `DropsToken.welcome()` on-chain. Mints **100 DROPS** to your wallet, credited to your Game Pouch. One-time, one wallet, enforced at the contract level.

### 2. Daily FaucetDrops Claim
Claim from the FaucetDrops faucet daily. Each claim credits **10 DROPS** to your Game Pouch on sync.

### 3. Win Duels
Win more than your opponent → double your entry minted back. For solo mode, credited immediately to Game Pouch. For PvP, credited to Reward Pouch on claim.

### 4. Buy DROPS with $G
If your Game Pouch runs out, buy more DROPS using GoodDollar ($G):

```
1. Enter how many DROPS you want (minimum 10)
2. App calculates $G cost at live price (100 DROPS = $1 USD worth of $G)
3. You transfer $G to the DropsRedeemPool contract on-chain
4. Backend verifies the tx, mints your DROPS via DropsToken.mintTo()
5. DROPS credited to your Game Pouch instantly
```

Rate: **100 DROPS = $1 USD** (priced in $G at live CoinGecko rate, with GeckoTerminal and DexScreener fallbacks).

---

## Redeeming Winnings for $G

When you have DROPS in your Reward Pouch, you can convert them to $G:

```
Total DROPS redeemed splits as:
  75% → paid to you immediately in $G (at live price)
  10% → platform fee (of the 75% share)
  25% → locked in DropsRedeemPool for 30 days, earns APY
```

After 30 days the locked portion matures:
- Principal DROPS returned to your Game Pouch
- APY earnings paid to your wallet in $G (at the live price at claim time)

APY rate scales with how many duels you've played (your tier):

| Tier | Duels Played | APY |
|---|---|---|
| 💧 Droplet | 0–50 | 15% |
| 🌦 Drizzle | 51–150 | 20% |
| 🌧 Downpour | 151–300 | 25% |
| ⛈ Torrent | 301–500 | 30% |
| 🌊 Flood | 500+ | 35% |

The same tier system also governs your leaderboard rank and unlocks higher duel stakes.

---

## Duel Entry Tiers

| Tier | Entry | Questions | Bot Accuracy |
|---|---|---|---|
| 💧 Droplet | 10 DROPS | 15 | 35% |
| 🌦 Drizzle | 20 DROPS | 18 | 50% |
| 🌧 Downpour | 30 DROPS | 21 | 63% |
| ⛈ Torrent | 40 DROPS | 24 | 76% |
| 🌊 Flood | 50 DROPS | 30 | 90% |

New players start at Droplet with their 100 free DROPS — enough for 10 Droplet duels.

---

## Rematch Badge

After playing **10 duels**, you earn the Rematch Badge which unlocks:
- Custom stake amounts in 1v1 challenges (above the 10 DROPS minimum)
- Rematching the same opponent (pre-badge players can only face each other once)
- Stake negotiation — creator and challenger can counter-offer before committing

---

## On-Chain Game Flow

### Solo Duel
```
Frontend → QuizHub.createQuiz(quizId)
Frontend → /api/challenge/single/create (reserve code, generate questions)
Player   → DropsToken.redeem(stakeWei, gameCode)   [burns from wallet]
Backend  → QuizHub.confirmBurn(quizId, player)
Backend  → bot wallet calls DropsToken.redeem(stakeWei, gameCode)
Backend  → QuizHub.confirmBurn(quizId, bot)
Game loop runs over WebSocket (AI questions, bot answers server-side)
Winner determined by score
→ DropsToken.mintTo(winner, stake × 2)
→ QuizHub.setWinner(quizId, winner)  OR  declareTie(quizId)
```

### 1v1 Duel
```
Creator  → QuizHub.createQuiz(quizId)
Backend  → generates questions, challenge goes live
Both     → DropsToken.redeem(stakeWei, gameCode)   [each player burns]
Backend  → QuizHub.registerQuiz(quizId, p1, p2, stakeWei)
Backend  → QuizHub.confirmBurn(quizId, p1)
Backend  → QuizHub.confirmBurn(quizId, p2)
Game loop runs over WebSocket
Backend  → QuizHub.setWinner(quizId, winner)  OR  declareTie(quizId)
Backend  → writes pending claim to DB
Player   → clicks Claim → DropsToken.mintTo(winner, stake × 2)
```

### Tournament (/quiz)
```
Creator  → deploys QuizReward contract via QuizFactory
Creator  → funds prize pool (approves + calls fund())
Players  → join room, answer questions in real-time
Backend  → scores all participants
Backend  → distributes rewards to top N wallets via QuizReward contract
Players  → claim within 48-hour window
```

---

## Architecture

```
MiniPay (Opera Browser)
    │  auto-connect via window.ethereum.isMiniPay
    │  gas paid in cUSD/USDT/USDm (MiniPay fee abstraction)
    ▼
Next.js 15 Frontend (Vercel)
    ├── /challenge  → Solo bot duels + 1v1 player duels
    ├── /quiz       → Tournament rooms (2+ players, prize pool)
    ├── /rank       → Leaderboard by tier (weekly + all-time)
    └── /dashboard  → Game Pouch, Reward Pouch, buy, redeem, stake history
    │
    ▼
FastAPI Backend (Koyeb)
    ├── Quiz generation    → Gemini 2.5 Flash (Groq llama-3.3-70b fallback)
    ├── Game loop          → WebSocket, per-question scoring, round announcements
    ├── Bot engine         → Tier-calibrated accuracy + speed nudge logic
    ├── Resolver wallet    → Signs & broadcasts all on-chain settlements
    ├── Nonce manager      → Per-(chain, signer) serialised tx queue, no collisions
    ├── Pending claims     → Atomic claim-once flow with mint-failure rollback
    └── Weekly reset       → Leaderboard snapshot + counter reset every Sunday
    │
    ▼
Celo Mainnet (Chain ID: 42220)
    ├── DropToken          → Soulbound ERC-20: welcome(), redeem(), mintTo()
    ├── QuizHub            → Duel ledger: createQuiz, confirmBurn, setWinner, declareTie
    ├── DropsRedeemPool    → $G ↔ DROPS: redeemForPlayer(), releaseCapital()
    └── QuizReward (per tournament) → Prize pool: fund(), distribute(), claim()
```

---

## Deployed Contracts (Celo Mainnet)

| Contract | Address |
|---|---|
| DROPS Token (`DropToken`) | `0x9825670865B896738CF8E6c98d093aD5b40F0A11` |
| Quiz Hub (`QuizHub`) | `0xd73170170E002b45eA4AA51e7E93302D61c30173` |
| Drops Redeem Pool | `0x636685bCFeEf6Baeb05872f01e69405077eAF633` |
| GoodDollar ($G) | `0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A` |

All contracts verified on [Celoscan](https://celoscan.io).

---

## DROPS Token Properties

- **Soulbound** — transfers between wallets are blocked at the contract level
- **No market price** — cannot be bought or sold on any DEX or exchange
- **Mint paths** — `welcome()` (once per wallet), `mintTo()` (resolver only), `claim()` (signed faucet)
- **Burn path** — `redeem(amount, gameCode)` emits `PointsRedeemed`, backend processes $G payout
- **100 DROPS = $1 USD** — fixed rate used for buy and redeem calculations

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 15, TypeScript, Tailwind CSS |
| Wallet | ethers.js v6, viem, MiniPay injected provider |
| Smart contracts | Solidity 0.8.23, Foundry |
| Backend | Python 3.12 / FastAPI, Koyeb |
| Database | Supabase (Postgres + Realtime) |
| AI questions | Google Gemini 2.5 Flash (Groq fallback) |
| Price feeds | CoinGecko → GeckoTerminal → DexScreener (3-source fallback) |
| Chain | Celo Mainnet (42220) |

---

## MiniPay Compliance

- ✅ Terms of Service at [/terms](https://minipay.faucetdrops.io/terms)
- ✅ Privacy Policy at [/privacy](https://minipay.faucetdrops.io/privacy)
- ✅ Auto-connect via `window.ethereum.isMiniPay`
- ✅ Stablecoin gas (cUSD / USDT / USDm) via MiniPay fee abstraction
- ✅ 480px mobile-first layout
- ✅ No real money required to play — 100 DROPS free on signup

---

## Local Development

```bash
git clone https://github.com/jerydam/faucetpay
cd faucetpay
pnpm install
cp .env.example .env.local
pnpm dev
```

**Required env vars:**

```env
NEXT_PUBLIC_API_URL=https://your-backend.koyeb.app
NEXT_PUBLIC_DROPS_CONTRACT_CELO=0x9825670865B896738CF8E6c98d093aD5b40F0A11
NEXT_PUBLIC_QUIZ_HUB_CELO=0xd73170170E002b45eA4AA51e7E93302D61c30173
NEXT_PUBLIC_DROPS_REDEEM_POOL_CELO=0x636685bCFeEf6Baeb05872f01e69405077eAF633
```

---

## Contact

- **Email:** drops.faucet@gmail.com
- **Twitter/X:** [@FaucetDrops](https://x.com/FaucetDrops)
- **Telegram:** [t.me/FaucetDropschat](https://t.me/FaucetDropschat)
- **GitHub:** [github.com/jerydam](https://github.com/jerydam)