"use client";

import React, { useEffect, useState } from "react";
import { formatUnits } from "ethers";
import { Header } from "@/components/header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ERC20_ABI } from "@/lib/abis";
import { CELO_CONFIG, makePublicClient } from "@/lib/chain";
import { ExternalLink } from "lucide-react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "https://conscious-adorne-faucetdrops-fc77a861.koyeb.app";

interface Player {
  wallet_address: string;
  username: string;
  total_wins: number;
  total_duels: number;
  total_earned: number;
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
  registeredUsers: number;
  mau30d: number;
  dau24h: number;
  quizzesCreated: number;
  duelsRegistered: number;
  duelsStarted: number;
  duelsCompleted: number;
  duelsCancelled: number;
  dropsClaims: number;
  dropsRedemptions: number;
  dropsBurns: number;
  scannedFromBlock: string;
  scannedToBlock: string;
  updatedAt: string;
}

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

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [ranksRes, quizRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/ranks`).then((r) => r.json()).catch(() => null),
          fetch(`${API_BASE_URL}/api/quiz/list`).then((r) => r.json()).catch(() => null),
        ]);

        // Registered users, MAU/DAU, quizzes created, duels played, and DROPS
        // claim/redeem/burn activity — read directly from QuizHub + DROPS
        // token event logs on Celo mainnet, not the backend DB.
        fetch(`/api/onchain-stats`)
          .then((r) => r.json())
          .then((hubRes) => {
            if (cancelled) return;
            if (hubRes?.success) setHub(hubRes);
            else setHubError(hubRes?.error ?? "On-chain scan unavailable");
          })
          .catch((e) => { if (!cancelled) setHubError(String(e)); });

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
          topPlayers: [...players].sort((a, b) => (b.total_wins || 0) - (a.total_wins || 0)).slice(0, 5),
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
              <h2 className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                Active users — on-chain
              </h2>
              {hub ? (
                <>
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
                    <StatTile label="Duels completed" value={String(hub.duelsCompleted)} sub={`${hub.duelsStarted} started · ${hub.duelsCancelled} cancelled`} />
                    <StatTile label="Duels (quizzes) created" value={String(hub.quizzesCreated)} />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Scanned block {Number(hub.scannedFromBlock).toLocaleString()}–{Number(hub.scannedToBlock).toLocaleString()},
                    updated {new Date(hub.updatedAt).toLocaleString()}.
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
                  {off && off.topPlayers.length > 0 ? off.topPlayers.map((p, i) => (
                    <div key={p.wallet_address} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span className="w-5 text-muted-foreground font-mono">{i + 1}.</span>
                        <span className="font-medium">{p.username || `${p.wallet_address.slice(0, 6)}…`}</span>
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
