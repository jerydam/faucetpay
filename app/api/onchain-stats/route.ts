import { NextResponse } from "next/server";
import { createPublicClient, http, zeroAddress } from "viem";
import { CELO_CONFIG, toViemChain } from "@/lib/chain";
import { QUIZ_HUB_ABI, REDEEM_ABI } from "@/lib/abis";

// Regenerate at most every 10 minutes; stale-while-revalidate serves cached
// data instantly while the next scan runs in the background.
export const revalidate = 600;

// First block containing each contract's bytecode on Celo mainnet, found via
// binary search over eth_getCode (neither contract exposes a deploy-block getter).
const QUIZ_HUB_DEPLOY_BLOCK = 71127962n;
const DROPS_TOKEN_DEPLOY_BLOCK = 71127711n;

// forno.celo.org rejects eth_getLogs ranges wider than 5000 blocks.
const LOG_CHUNK = 5000n;
const CONCURRENCY = 12;

// This Celo L2 produces blocks at a fixed 1s cadence, so day/month windows
// convert directly to block counts without needing per-log timestamp lookups.
const BLOCKS_PER_DAY = 86400n;
const BLOCKS_PER_MONTH = 30n * BLOCKS_PER_DAY;

// Contract/treasury addresses that can legitimately appear as a Transfer
// recipient (e.g. reward-pool funding) — never count these as "users".
const INFRA_ADDRESSES = new Set(
  [
    CELO_CONFIG.contracts.quizHub,
    CELO_CONFIG.contracts.dropsToken,
    CELO_CONFIG.contracts.dropsRedeemPool,
    process.env.NEXT_PUBLIC_BACKEND_WALLET,
  ]
    .filter(Boolean)
    .map((a) => String(a).toLowerCase())
);

interface Range {
  fromBlock: bigint;
  toBlock: bigint;
}

function buildRanges(fromBlock: bigint, latest: bigint): Range[] {
  const ranges: Range[] = [];
  for (let from = fromBlock; from <= latest; from += LOG_CHUNK) {
    const to = from + LOG_CHUNK - 1n > latest ? latest : from + LOG_CHUNK - 1n;
    ranges.push({ fromBlock: from, toBlock: to });
  }
  return ranges;
}

async function scanContract(
  client: ReturnType<typeof createPublicClient>,
  address: `0x${string}`,
  abi: any,
  fromBlock: bigint,
  latest: bigint
) {
  const ranges = buildRanges(fromBlock, latest);
  const logs: { eventName: string; args: Record<string, any>; blockNumber: bigint }[] = [];

  for (let i = 0; i < ranges.length; i += CONCURRENCY) {
    const batch = ranges.slice(i, i + CONCURRENCY);
    const batchLogs = await Promise.all(
      batch.map((r) =>
        client.getContractEvents({ address, abi, fromBlock: r.fromBlock, toBlock: r.toBlock })
      )
    );
    for (const chunkLogs of batchLogs) {
      for (const log of chunkLogs) {
        const { eventName, args, blockNumber } = log as unknown as {
          eventName: string;
          args: Record<string, any>;
          blockNumber: bigint;
        };
        logs.push({ eventName, args, blockNumber });
      }
    }
  }
  return logs;
}

export async function GET() {
  try {
    const client = createPublicClient({
      chain: toViemChain(),
      transport: http(CELO_CONFIG.rpcUrl),
    });

    const latest = await client.getBlockNumber();
    const monthCutoff = latest > BLOCKS_PER_MONTH ? latest - BLOCKS_PER_MONTH : 0n;
    const dayCutoff = latest > BLOCKS_PER_DAY ? latest - BLOCKS_PER_DAY : 0n;

    const [hubLogs, dropsLogs] = await Promise.all([
      scanContract(client, CELO_CONFIG.contracts.quizHub, QUIZ_HUB_ABI, QUIZ_HUB_DEPLOY_BLOCK, latest),
      scanContract(client, CELO_CONFIG.contracts.dropsToken, REDEEM_ABI, DROPS_TOKEN_DEPLOY_BLOCK, latest),
    ]);

    // Every address that ever took a duel or DROPS action, tagged with the
    // block it happened at — lets us derive all-time / MAU(30d) / DAU(24h)
    // from one pass instead of three separate scans. Infra addresses (the
    // contracts themselves, the backend wallet) are excluded here even
    // though the raw event counts below still include them.
    const activity: { addr: string; block: bigint }[] = [];
    const recordActivity = (addr: string, block: bigint) => {
      if (!INFRA_ADDRESSES.has(addr)) activity.push({ addr, block });
    };

    let quizzesCreated = 0;
    let duelsRegistered = 0;
    let duelsStarted = 0;
    let duelsCompleted = 0;
    let duelsCancelled = 0;

    for (const { eventName, args, blockNumber } of hubLogs) {
      switch (eventName) {
        case "QuizCreated":
          quizzesCreated++;
          if (args.creator) recordActivity(String(args.creator).toLowerCase(), blockNumber);
          break;
        case "QuizRegistered":
          duelsRegistered++;
          if (args.player1) recordActivity(String(args.player1).toLowerCase(), blockNumber);
          if (args.player2) recordActivity(String(args.player2).toLowerCase(), blockNumber);
          break;
        case "QuizStarted":
          duelsStarted++;
          if (args.player1) recordActivity(String(args.player1).toLowerCase(), blockNumber);
          if (args.player2) recordActivity(String(args.player2).toLowerCase(), blockNumber);
          break;
        case "WinnerSet":
          duelsCompleted++;
          if (args.winner) recordActivity(String(args.winner).toLowerCase(), blockNumber);
          break;
        case "TieDeclared":
          duelsCompleted++;
          if (args.player1) recordActivity(String(args.player1).toLowerCase(), blockNumber);
          if (args.player2) recordActivity(String(args.player2).toLowerCase(), blockNumber);
          break;
        case "QuizCancelled":
          duelsCancelled++;
          break;
      }
    }

    let dropsClaims = 0;
    let dropsRedemptions = 0;
    let dropsBurns = 0;

    for (const { eventName, args, blockNumber } of dropsLogs) {
      if (eventName === "Transfer") {
        const from = args.from ? String(args.from).toLowerCase() : undefined;
        const to = args.to ? String(args.to).toLowerCase() : undefined;
        if (from === zeroAddress && to) {
          // Minted straight to a wallet — this is what claim() does under the hood.
          dropsClaims++;
          recordActivity(to, blockNumber);
        } else if (to === zeroAddress && from) {
          // Burned by a wallet — the duel-stake burn flow (confirmBurn).
          dropsBurns++;
          recordActivity(from, blockNumber);
        }
      } else if (eventName === "PointsRedeemed") {
        dropsRedemptions++;
        if (args.user) recordActivity(String(args.user).toLowerCase(), blockNumber);
      }
    }

    const allTimeUsers = new Set<string>();
    const mau30d = new Set<string>();
    const dau24h = new Set<string>();
    for (const { addr, block } of activity) {
      allTimeUsers.add(addr);
      if (block >= monthCutoff) mau30d.add(addr);
      if (block >= dayCutoff) dau24h.add(addr);
    }

    return NextResponse.json({
      success: true,
      source: "onchain",
      contracts: {
        quizHub: CELO_CONFIG.contracts.quizHub,
        dropsToken: CELO_CONFIG.contracts.dropsToken,
      },
      registeredUsers: allTimeUsers.size,
      mau30d: mau30d.size,
      dau24h: dau24h.size,
      quizzesCreated,
      duelsRegistered,
      duelsStarted,
      duelsCompleted,
      duelsCancelled,
      dropsClaims,
      dropsRedemptions,
      dropsBurns,
      scannedFromBlock: DROPS_TOKEN_DEPLOY_BLOCK.toString(),
      scannedToBlock: latest.toString(),
      updatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("On-chain stats scan failed:", err);
    return NextResponse.json(
      { success: false, error: err?.message ?? "scan failed" },
      { status: 500 }
    );
  }
}
