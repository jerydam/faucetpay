import { createPublicClient, http, parseAbi, decodeEventLog } from "viem";
import { celo } from "viem/chains";

const client = createPublicClient({ chain: celo, transport: http("https://forno.celo.org") });

const DROPS_TOKEN = "0x9825670865B896738CF8E6c98d093aD5b40F0A11";
const QUIZ_HUB = "0xd73170170E002b45eA4AA51e7E93302D61c30173";
const REDEEM_POOL = "0x636685bCFeEf6Baeb05872f01e69405077eAF633";

const dropsTokenAbi = parseAbi([
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event PointsRedeemed(address indexed user, uint256 amount, string rewardId)",
]);
const quizHubAbi = parseAbi([
  "event QuizCreated(bytes32 indexed quizId, address indexed creator)",
  "event QuizRegistered(bytes32 indexed quizId, address indexed player1, address indexed player2, uint256 stakePerPlayer)",
  "event QuizStarted(bytes32 indexed quizId, address indexed player1, address indexed player2, uint256 stakePerPlayer)",
  "event WinnerSet(bytes32 indexed quizId, address indexed winner, uint256 payout)",
  "event BurnConfirmed(bytes32 indexed quizId, address indexed player)",
  "event TieDeclared(bytes32 indexed quizId, address indexed player1, address indexed player2, uint256 refundEach)",
  "event QuizCancelled(bytes32 indexed quizId)",
]);
const redeemPoolAbi = parseAbi([
  "event GDeposited(address indexed by, uint256 amount)",
  "event GWithdrawn(address indexed by, uint256 amount)",
  "event Redeemed(address indexed player, uint256 stakeDropsWei, uint256 apy, uint256 gToPlayer, uint256 gFee, uint256 indexed stakeId)",
  "event CapitalReleased(uint256 indexed stakeId, address indexed player, uint256 stakeDropsWei, uint256 apyGPaid)",
]);

const CONTRACTS = [
  { name: "DropsToken", address: DROPS_TOKEN, abi: dropsTokenAbi, userFields: { Transfer: ["from", "to"], PointsRedeemed: ["user"] } },
  { name: "QuizHub", address: QUIZ_HUB, abi: quizHubAbi, userFields: {
      QuizCreated: ["creator"], QuizRegistered: ["player1", "player2"], QuizStarted: ["player1", "player2"],
      WinnerSet: ["winner"], BurnConfirmed: ["player"], TieDeclared: ["player1", "player2"], QuizCancelled: [],
    } },
  { name: "DropsRedeemPool", address: REDEEM_POOL, abi: redeemPoolAbi, userFields: {
      GDeposited: ["by"], GWithdrawn: ["by"], Redeemed: ["player"], CapitalReleased: ["player"],
    } },
];

const CHUNK = 5000n;
const CONCURRENCY = 10;

async function fetchLogsChunked(address, abi, fromBlock, toBlock) {
  const ranges = [];
  for (let start = fromBlock; start <= toBlock; start += CHUNK) {
    const end = start + CHUNK - 1n > toBlock ? toBlock : start + CHUNK - 1n;
    ranges.push([start, end]);
  }
  const results = [];
  let i = 0;
  async function worker() {
    while (i < ranges.length) {
      const idx = i++;
      const [from, to] = ranges[idx];
      let attempt = 0;
      while (true) {
        try {
          const logs = await client.getLogs({ address, fromBlock: from, toBlock: to });
          results.push(...logs);
          break;
        } catch (e) {
          attempt++;
          if (attempt > 4) { console.error(`giving up on range ${from}-${to}:`, e.message); break; }
          await new Promise(r => setTimeout(r, 300 * attempt));
        }
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return results;
}

function decodeLogs(logs, abi) {
  const decoded = [];
  for (const log of logs) {
    try {
      const { eventName, args } = decodeEventLog({ abi, data: log.data, topics: log.topics });
      decoded.push({ eventName, args, blockNumber: log.blockNumber, transactionHash: log.transactionHash });
    } catch { /* not one of our known events (e.g. Approval) — skip */ }
  }
  return decoded;
}

async function main() {
  const latest = await client.getBlockNumber();
  const BLOCKS_PER_DAY = 86400n; // measured: exactly 1.000s/block on Celo mainnet right now
  const SCAN_DAYS = 10n; // contracts deployed ~8 days ago; pad to be safe
  const fromBlock = latest - BLOCKS_PER_DAY * SCAN_DAYS;

  console.log(`Scanning blocks ${fromBlock} -> ${latest} (~${SCAN_DAYS} days, ${((latest-fromBlock))} blocks) across 3 contracts...`);

  const allDecoded = [];
  for (const c of CONTRACTS) {
    const t0 = Date.now();
    const logs = await fetchLogsChunked(c.address, c.abi, fromBlock, latest);
    const decoded = decodeLogs(logs, c.abi).map(d => ({ ...d, contract: c.name, userFields: c.userFields[d.eventName] || [] }));
    allDecoded.push(...decoded);
    console.log(`${c.name}: ${logs.length} raw logs, ${decoded.length} decoded, ${((Date.now()-t0)/1000).toFixed(1)}s`);
  }

  // Bucket by day using block number (1.000s/block confirmed)
  const dayOf = (blockNumber) => Number((latest - blockNumber) / BLOCKS_PER_DAY); // 0 = today, 1 = yesterday, ...

  const dauSet = new Set();       // last 24h (day 0)
  const mauSet = new Set();       // whole scan window
  const dailyTxByDay = new Map(); // day -> Set of tx hashes (for 14-day daily-tx threshold)
  let quizCreatedCount = 0;

  for (const d of allDecoded) {
    const day = dayOf(d.blockNumber);
    const addrs = d.userFields.map(f => d.args[f]).filter(Boolean);
    for (const a of addrs) {
      mauSet.add(a.toLowerCase());
      if (day <= 0) dauSet.add(a.toLowerCase());
    }
    if (!dailyTxByDay.has(day)) dailyTxByDay.set(day, new Set());
    dailyTxByDay.get(day).add(d.transactionHash);
    if (d.contract === "QuizHub" && d.eventName === "QuizCreated") quizCreatedCount++;
  }

  console.log("\n=== RESULTS ===");
  console.log("Contract age: ~8 days (all three deployed same day, per Celoscan)");
  console.log("DAU (unique active addresses, last 24h):", dauSet.size);
  console.log("MAU (unique active addresses, full contract lifetime ~8-10 days):", mauSet.size);
  console.log("Quizzes created on-chain (QuizHub.QuizCreated, all-time):", quizCreatedCount);
  console.log("\nDaily unique tx count (day 0 = today, going back):");
  const sortedDays = [...dailyTxByDay.keys()].sort((a, b) => a - b);
  for (const day of sortedDays) {
    console.log(`  day -${day}: ${dailyTxByDay.get(day).size} txs`);
  }
}

main().catch(e => { console.error("FATAL", e); process.exit(1); });
