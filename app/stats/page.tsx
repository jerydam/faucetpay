"use client";

import React, { useEffect, useState } from "react";
import { formatUnits } from "ethers";
import { Header } from "@/components/header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ERC20_ABI } from "@/lib/abis";
import { CELO_CONFIG, makePublicClient } from "@/lib/chain";
import { ExternalLink, RefreshCw } from "lucide-react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "https://conscious-adorne-faucetdrops-fc77a861.koyeb.app";

// Mirrors chain_config.py's CELO_CHAIN_ID — kept as a literal here so this
// page doesn't depend on @/lib/chain exposing a numeric chainId field.
const CELO_CHAIN_ID = 42220;

interface Player {
  wallet_address: string;
  username: string;
  avatar_url?: string;
  total_wins: number;
  total_duels: number;
  total_earned: number;
  rank: number;
  rank_delta?: number;
}

interface QuizCard {
  code: string;
  status: "waiting" | "active" | "finished";
  isAiGenerated?: boolean;
  reward?: { poolAmount: number; tokenSymbol: string; totalWinners: number };
}

interface OffchainStats {
  totalPlayers: number;
  totalDuels: number;
  totalWins: number;
  totalDropsEarned: number;
  topPlayers: Player[];
  totalQuizzes: number;
  quizzesByStatus: Record<string, number>;
  aiQuizzes: number;
  rewardPoolByToken: Record<string, number>;
}

interface OnchainStats {
  dropsSupply: string;
  poolDropsReserve: string;
  poolNativeReserve: string;
}

interface OnchainActivityStats {
  success: boolean;
  source?: "database" | "onchain";   // "database" = fast Postgres snapshot, replaced by live scan
  approximate?: boolean;
  registeredUsers: number;
  mau30d: number;
  dau24h: number;
  quizzesCreated: number;
  duelsRegistered: number;
  duelsCompleted: number;
  dropsClaims: number;
  dropsRedemptions: number;
  dropsBurns: number;
  scannedFromBlock: string;
  scannedToBlock: string;
  updatedAt: string;
  rateLimited?: boolean;
  retryAfterSecs?: number;
}

// Last successful hub payload, persisted so returning visitors see numbers
// instantly instead of skeletons while fresh data loads.
const HUB_LS_KEY = "fd_stats_hub_v1";

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-2xl font-black tabular-nums mt-1">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function StatsPage() {
  const [off, setOff] = useState<OffchainStats | null>(null);
  const [onchain, setOnchain] = useState<OnchainStats | null>(null);
  const [hub, setHub] = useState<OnchainActivityStats | null>(null);
  const [hubError, setHubError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [retryAfter, setRetryAfter] = useState(0);

  // ── Three-layer load ──────────────────────────────────────────────────────
  // 1. localStorage  — last successful payload from a previous visit (instant)
  // 2. /api/stats/db — fast Postgres snapshot of already-synced data (~100ms)
  // 3. /api/stats/onchain — live event-log scan (slow on cold cache) replaces
  //    everything when it lands.
  // A fresher source never gets overwritten by a staler one, and once we have
  // ANY data on screen a failed live scan never blanks the page — it just
  // keeps showing the snapshot.

  function persistHub(data: OnchainActivityStats) {
    try { localStorage.setItem(HUB_LS_KEY, JSON.stringify(data)); } catch { /* private mode etc. */ }
  }

  // Mirror of `hub` readable synchronously inside async loaders — lets us
  // check "has the live scan already landed?" without impure setState updaters.
  const hubRef = React.useRef<OnchainActivityStats | null>(null);

  function applyHub(data: OnchainActivityStats) {
    hubRef.current = data;
    setHub(data);
    persistHub(data);
  }

  // Fast DB snapshot — reads challenge_player_balances / player_activity_log,
  // no RPC. Only applied if the live on-chain scan hasn't already landed.
  async function loadDbSnapshot() {
    try {
      const res = await fetch(`${API_BASE_URL}/api/stats/db?chain_id=${CELO_CHAIN_ID}`);
      const dbRes = await res.json();
      if (dbRes?.success && hubRef.current?.source !== "onchain") {
        applyHub({ ...dbRes, source: "database" });
        setHubError(null);
      }
    } catch {
      /* snapshot is best-effort — the live scan below is the real source */
    }
  }

  // Live event-log scan. Backend caches 10 min; force=true bypasses (30s/chain
  // server-side cooldown), used by the Refresh button.
  async function loadHub(force: boolean) {
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/stats/onchain?chain_id=${CELO_CHAIN_ID}${force ? "&force=true" : ""}`
      );
      const hubRes = await res.json();
      if (hubRes?.success) {
        applyHub({ ...hubRes, source: "onchain" });
        setHubError(null);
        setRetryAfter(hubRes.rateLimited ? Math.ceil(hubRes.retryAfterSecs || 0) : 0);
      } else if (!hubRef.current) {
        // Only surface the error if we have nothing to show — otherwise keep
        // the DB/localStorage snapshot on screen.
        setHubError(hubRes?.detail ?? hubRes?.error ?? "On-chain scan unavailable");
      }
    } catch (e) {
      if (!hubRef.current) setHubError(String(e));
    }
  }

  async function handleRefresh() {
    if (refreshing || retryAfter > 0) return;
    setRefreshing(true);
    try {
      // Kick off the real backend sync (scans + upserts new wallets to
      // Supabase) — public, no admin secret, rate-limited server-side to
      // once per chain per 5 min. Fire-and-forget: it can take a while on
      // a big block range, so we don't block the UI on it.
      fetch(`${API_BASE_URL}/api/sync/onchain-users?chain=celo`, { method: "POST" }).catch(() => {});
      // Then refresh the lighter display-stats scan (its own 30s cooldown)
      // so the numbers on this page update right away.
      await loadHub(true);
    } finally {
      setRefreshing(false);
    }
  }

  // Countdown the rate-limit cooldown so the button re-enables itself.
  useEffect(() => {
    if (retryAfter <= 0) return;
    const t = setInterval(() => setRetryAfter((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [retryAfter]);

  useEffect(() => {
    let cancelled = false;

    // Layer 1: last visit's payload from localStorage — paints before any fetch.
    try {
      const cached = localStorage.getItem(HUB_LS_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as OnchainActivityStats;
        if (parsed?.success) {
          hubRef.current = { ...parsed, source: "database" };
          setHub(hubRef.current);
        }
      }
    } catch { /* ignore corrupt cache */ }

    // Layer 2 + 3: DB snapshot (fast) and live scan (slow) race safely —
    // loadDbSnapshot never overwrites a landed on-chain result.
    loadDbSnapshot();
    loadHub(false);

    async function load() {
      try {
        // Everything below is read straight from the FastAPI backend
        // (Supabase-backed ranks/quizzes + a live on-chain event scan it
        // caches for 10 min) — no local Next.js API route in between.
        const [ranksRes, quizRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/ranks?limit=10`).then((r) => r.json()).catch(() => null),
          fetch(`${API_BASE_URL}/api/quiz/list`).then((r) => r.json()).catch(() => null),
        ]);

        const players: Player[] = ranksRes?.success ? ranksRes.players ?? [] : [];
        const quizzes: QuizCard[] = quizRes?.success ? quizRes.quizzes ?? [] : [];

        const quizzesByStatus: Record<string, number> = {};
        const rewardPoolByToken: Record<string, number> = {};
        let aiQuizzes = 0;
        for (const q of quizzes) {
          quizzesByStatus[q.status] = (quizzesByStatus[q.status] ?? 0) + 1;
          if (q.isAiGenerated) aiQuizzes++;
          if (q.reward?.tokenSymbol) {
            rewardPoolByToken[q.reward.tokenSymbol] =
              (rewardPoolByToken[q.reward.tokenSymbol] ?? 0) + (q.reward.poolAmount || 0);
          }
        }

        const offStats: OffchainStats = {
          totalPlayers: players.length,
          totalDuels: players.reduce((s, p) => s + (p.total_duels || 0), 0) / 2, // each duel counted on both sides
          totalWins: players.reduce((s, p) => s + (p.total_wins || 0), 0),
          totalDropsEarned: players.reduce((s, p) => s + (p.total_earned || 0), 0),
          // Backend already returns players ordered by rank (total_wins desc,
          // total_duels desc) with a `rank`/`rank_delta` on each row — just take
          // the top 5 as-is instead of re-sorting on the client.
          topPlayers: players.slice(0, 5),
          totalQuizzes: quizzes.length,
          quizzesByStatus,
          aiQuizzes,
          rewardPoolByToken,
        };
        if (!cancelled) setOff(offStats);

        // On-chain reserves — direct reads, no indexer required.
        try {
          const provider = makePublicClient();
          const dropsAddr = CELO_CONFIG.contracts.dropsToken;
          const poolAddr = CELO_CONFIG.contracts.dropsRedeemPool;

          const [supply, poolDrops, poolNative] = await Promise.all([
            provider.readContract({ address: dropsAddr, abi: ERC20_ABI as any, functionName: "totalSupply" }),
            provider.readContract({ address: dropsAddr, abi: ERC20_ABI as any, functionName: "balanceOf", args: [poolAddr] }),
            provider.getBalance({ address: poolAddr }),
          ]);

          if (!cancelled) {
            setOnchain({
              dropsSupply: formatUnits(supply as bigint, 18),
              poolDropsReserve: formatUnits(poolDrops as bigint, 18),
              poolNativeReserve: formatUnits(poolNative as bigint, 18),
            });
          }
        } catch (chainErr) {
          console.error("On-chain stats read failed:", chainErr);
        }
      } catch (err) {
        console.error("Failed to load stats:", err);
        if (!cancelled) setError("Could not load stats right now.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-background pb-24">
      <Header pageTitle="Stats" />
      <div className="flex-1 max-w-2xl w-full mx-auto p-4 space-y-6">

        <div>
          <h1 className="text-xl font-black tracking-tight">FaucetDrops — Public Stats</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Read-only. No wallet required. Registered users, MAU/DAU, quizzes created, duels played,
            and DROPS claim/redeem activity are read directly from the QuizHub and DROPS token
            contracts&apos; event logs on Celo mainnet — not the backend DB. Usernames, leaderboard, and
            reward-pool breakdowns still come from the FaucetDrops backend since those aren&apos;t
            stored on-chain.
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : error ? (
          <p className="text-sm text-red-500">{error}</p>
        ) : (
          <>
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                  Active users — on-chain
                </h2>
                <button
                  onClick={handleRefresh}
                  disabled={refreshing || retryAfter > 0}
                  className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-primary disabled:text-muted-foreground disabled:cursor-not-allowed"
                  title="Re-scan QuizHub + DROPS token events now"
                >
                  <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
                  {refreshing ? "Refreshing…" : retryAfter > 0 ? `Wait ${retryAfter}s` : "Refresh"}
                </button>
              </div>
              {hub ? (
                <>
                  {hub.source === "database" && (
                    <p className="text-[11px] text-amber-500 flex items-center gap-1">
                      <RefreshCw className="h-3 w-3 animate-spin" />
                      Showing saved data from the database — live on-chain scan updating…
                    </p>
                  )}
                  <div className="grid grid-cols-3 gap-3">
                    <StatTile label="All-time users" value={String(hub.registeredUsers)} sub="ever, all-time" />
                    <StatTile label="MAU" value={String(hub.mau30d)} sub="active last 30 days" />
                    <StatTile label="DAU" value={String(hub.dau24h)} sub="active last 24h" />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    A wallet counts as active if it created/joined/won a QuizHub duel, or claimed/redeemed/
                    staked DROPS, within the window. Unique addresses across the QuizHub and DROPS token
                    event logs.
                  </p>
                </>
              ) : hubError ? (
                <p className="text-sm text-red-500">On-chain scan failed: {hubError}</p>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
                </div>
              )}
            </section>

            <section className="space-y-2">
              <h2 className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                Duels — QuizHub on-chain
              </h2>
              {hub ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <StatTile label="Duels completed" value={String(hub.duelsCompleted)} sub={`${hub.duelsRegistered} registered`} />
                    <StatTile label="Duels (quizzes) created" value={String(hub.quizzesCreated)} />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {hub.source === "database" ? (
                      <>Database snapshot · synced to block {Number(hub.scannedToBlock).toLocaleString()} · {new Date(hub.updatedAt).toLocaleString()}</>
                    ) : (
                      <>Scanned block {Number(hub.scannedFromBlock).toLocaleString()}–{Number(hub.scannedToBlock).toLocaleString()},
                      updated {new Date(hub.updatedAt).toLocaleString()}.</>
                    )}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <a
                      href={`${CELO_CONFIG.explorerUrl}/address/${CELO_CONFIG.contracts.quizHub}`}
                      target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      View QuizHub contract on {CELO_CONFIG.explorerName} <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </>
              ) : hubError ? (
                <p className="text-sm text-red-500">QuizHub on-chain scan failed: {hubError}</p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
                </div>
              )}
            </section>

            <section className="space-y-2">
              <h2 className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                DROPS token — on-chain activity
              </h2>
              {hub ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <StatTile label="Claims" value={String(hub.dropsClaims)} sub="minted to a wallet" />
                    <StatTile label="Redeemed / staked" value={String(hub.dropsRedemptions)} sub="redeem() calls — burns the stake" />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    redeem() burns the same amount it redeems in one call, so the on-chain burn count
                    ({hub.dropsBurns}) matches redemptions 1:1 — not a separate user action.
                  </p>
                </>
              ) : hubError ? (
                <p className="text-sm text-red-500">On-chain scan failed: {hubError}</p>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
                </div>
              )}
            </section>

            <section className="space-y-2">
              <h2 className="text-xs font-black uppercase tracking-wider text-muted-foreground">Quiz games — backend</h2>
              <div className="grid grid-cols-2 gap-3">
                <StatTile label="Quiz games created" value={String(off?.totalQuizzes ?? 0)} sub={`${off?.aiQuizzes ?? 0} AI-generated`} />
                <StatTile
                  label="Quiz games live"
                  value={String(off?.quizzesByStatus.active ?? 0)}
                  sub={`${off?.quizzesByStatus.finished ?? 0} finished · ${off?.quizzesByStatus.waiting ?? 0} waiting`}
                />
              </div>
            </section>

            <section className="space-y-2">
              <h2 className="text-xs font-black uppercase tracking-wider text-muted-foreground">Reward pools by stablecoin</h2>
              <Card>
                <CardContent className="p-4 space-y-2">
                  {off && Object.keys(off.rewardPoolByToken).length > 0 ? (
                    Object.entries(off.rewardPoolByToken).map(([symbol, amount]) => (
                      <div key={symbol} className="flex items-center justify-between text-sm">
                        <span className="font-medium">{symbol}</span>
                        <span className="font-bold tabular-nums">{amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No funded reward pools yet.</p>
                  )}
                </CardContent>
              </Card>
            </section>

            <section className="space-y-2">
              <h2 className="text-xs font-black uppercase tracking-wider text-muted-foreground">Top players</h2>
              <Card>
                <CardContent className="p-4 space-y-3">
                  {off && off.topPlayers.length > 0 ? off.topPlayers.map((p) => (
                    <div key={p.wallet_address} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span className="w-5 text-muted-foreground font-mono">{p.rank}.</span>
                        <span className="font-medium">{p.username || `${p.wallet_address.slice(0, 6)}…`}</span>
                        {typeof p.rank_delta === "number" && p.rank_delta !== 0 && (
                          <span className={`text-[10px] font-bold ${p.rank_delta > 0 ? "text-green-500" : "text-red-500"}`}>
                            {p.rank_delta > 0 ? `▲${p.rank_delta}` : `▼${Math.abs(p.rank_delta)}`}
                          </span>
                        )}
                      </span>
                      <span className="font-bold tabular-nums">{p.total_wins} wins</span>
                    </div>
                  )) : (
                    <p className="text-sm text-muted-foreground">No players yet.</p>
                  )}
                </CardContent>
              </Card>
            </section>

            <section className="space-y-2">
              <h2 className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                On-chain reserves — Celo mainnet
              </h2>
              {onchain ? (
                <div className="grid grid-cols-1 gap-3">
                  <StatTile label="DROPS total supply" value={Number(onchain.dropsSupply).toLocaleString(undefined, { maximumFractionDigits: 0 })} />
                  <StatTile
                    label="Redeem pool reserves"
                    value={`${Number(onchain.poolDropsReserve).toLocaleString(undefined, { maximumFractionDigits: 0 })} DROPS`}
                    sub={`${Number(onchain.poolNativeReserve).toFixed(4)} CELO (network-fee buffer)`}
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">On-chain read unavailable right now.</p>
              )}
              <a
                href={`${CELO_CONFIG.explorerUrl}/address/${CELO_CONFIG.contracts.dropsToken}`}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                View DROPS contract on {CELO_CONFIG.explorerName} <ExternalLink className="h-3 w-3" />
              </a>
            </section>

            <section>
              <Card className="border-dashed">
                <CardContent className="p-4 space-y-1.5">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Not yet live</p>
                  <p className="text-sm text-muted-foreground">
                    All-time users, MAU, DAU, quizzes/duels, and DROPS claim/redeem/burn counts above
                    are read live from the QuizHub and DROPS token event logs (block time on this chain
                    is a fixed 1s, so day/month windows are exact block-count cutoffs — no indexer
                    needed). Retention cohorts, network fees paid, and failed-tx rate still need a
                    proper indexer (subgraph / Dune / Goldsky) — wiring that up is the next step.
                  </p>
                </CardContent>
              </Card>
            </section>
          </>
        )}
      </div>
    </div>
  );
}