"use client";

/**
 * /app/challenge/page.tsx — Cross-Platform Quiz Arena
 * Optimized for MiniPay (mobile) and Desktop browsers.
 * Focused on Celo (42220) stake-to-earn mechanics.
 */

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/hooks/use-wallet";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus, Trophy, Users, Loader2, Gamepad2,
  RefreshCw, ChevronRight, Zap, Swords,
  CheckCircle2, XCircle, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Loading from "../loading/page";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://faucetpay-backend.koyeb.app";
const CELO_CHAIN_ID = 42220;

// ── Types ─────────────────────────────────────────────────────────────────────

interface LobbyChallenge {
  code: string;
  topic: string;
  stake_amount: number;
  token_symbol: string;
  chain_id: number;
  created_at: string;
  creator_username: string;
}

interface HistoryChallenge {
  code: string;
  topic: string;
  stake_amount: number;
  token_symbol: string;
  status: "waiting" | "active" | "finished";
  winner_address: string | null;
  created_at: string;
  finished_at: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n % 1 === 0 ? n.toString() : n.toFixed(n < 1 ? 2 : 1);
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ── Lobby card ────────────────────────────────────────────────────────────────

function QuizChallengeCard({
  challenge, onClick, loading,
}: {
  challenge: LobbyChallenge;
  onClick: () => void;
  loading?: boolean;
}) {
  const totalPrize = challenge.stake_amount * 2;
  return (
    <button
      onClick={onClick}
      className={cn(
        "group w-full text-left rounded-2xl overflow-hidden transition-all duration-200",
        "bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.07]",
        "hover:border-blue-600 shadow-sm active:scale-[0.98] lg:hover:-translate-y-1",
      )}
    >
      <div className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 flex-1 min-w-0">
            <h3 className="font-bold text-slate-900 dark:text-white text-base leading-tight truncate">
              {challenge.topic}
            </h3>
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <Users className="h-3 w-3" /> @{challenge.creator_username}
            </span>
          </div>
          <span className="px-2 py-1 rounded text-[10px] font-black uppercase border shrink-0 bg-blue-600 text-white border-blue-600">
            Join Pool
          </span>
        </div>

        <div className="flex items-center justify-between py-4 border-y border-slate-50 dark:border-white/[0.05]">
          <div className="text-center flex-1">
            <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-tight">Entry Stake</span>
            <span className="font-bold text-slate-900 dark:text-white text-sm">
              {fmt(challenge.stake_amount)} {challenge.token_symbol}
            </span>
          </div>
          <div className="w-[1px] h-8 bg-slate-100 dark:bg-white/10" />
          <div className="text-center flex-1">
            <span className="block text-[10px] text-blue-600 font-bold uppercase tracking-tight">Prize Pool</span>
            <span className="font-bold text-blue-600 flex items-center justify-center gap-1 text-sm">
              <Trophy className="h-3.5 w-3.5" /> {fmt(totalPrize)} {challenge.token_symbol}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] font-bold">
          <span className="text-slate-300 dark:text-slate-600 font-mono">#{challenge.code}</span>
          <div className="text-blue-600 flex items-center gap-1">
            {loading
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <>CHALLENGE <ChevronRight className="h-3 w-3" /></>}
          </div>
        </div>
      </div>
    </button>
  );
}

// ── History row ───────────────────────────────────────────────────────────────

function HistoryRow({
  item, myWallet, onClick,
}: {
  item: HistoryChallenge;
  myWallet: string;
  onClick: () => void;
}) {
  const isFinished = item.status === "finished";
  const isWon      = isFinished && item.winner_address?.toLowerCase() === myWallet;
  const isLost     = isFinished && item.winner_address && item.winner_address.toLowerCase() !== myWallet;
  const isActive   = item.status === "active";

  const outcomeIcon = isWon
    ? <Trophy className="h-4 w-4 text-amber-500" />
    : isLost
    ? <XCircle className="h-4 w-4 text-slate-300 dark:text-slate-600" />
    : isActive
    ? <Zap className="h-4 w-4 text-blue-500 animate-pulse" />
    : <Clock className="h-4 w-4 text-slate-300" />;

  const outcomeBadge = isWon
    ? <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-400/30">WON</span>
    : isLost
    ? <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 text-slate-400 border border-slate-200 dark:border-white/10">LOST</span>
    : isActive
    ? <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-400/30 animate-pulse">LIVE</span>
    : <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 text-slate-400 border border-slate-200 dark:border-white/10">PENDING</span>;

  return (
    <button
      onClick={onClick}
      className={cn(
        "group w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border transition-all",
        "bg-white dark:bg-slate-900 border-slate-200 dark:border-white/[0.07]",
        "hover:border-blue-400/50 hover:shadow-sm active:scale-[0.99]",
        isWon && "border-amber-200/50 dark:border-amber-500/20 bg-amber-50/30 dark:bg-amber-500/5",
      )}
    >
      {/* Icon */}
      <div className={cn(
        "w-9 h-9 rounded-xl border flex items-center justify-center shrink-0",
        isWon ? "bg-amber-500/10 border-amber-400/30" : "bg-slate-50 dark:bg-white/5 border-slate-100 dark:border-white/10",
      )}>
        {outcomeIcon}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 text-left">
        <p className="font-bold text-sm text-slate-900 dark:text-white truncate leading-tight">
          {item.topic}
        </p>
        <p className="text-[10px] text-slate-400 font-mono mt-0.5">
          #{item.code}
          {item.finished_at && <span className="ml-2">{timeAgo(item.finished_at)}</span>}
        </p>
      </div>

      {/* Stake + outcome */}
      <div className="flex flex-col items-end gap-1 shrink-0">
        {outcomeBadge}
        <span className="text-[11px] font-bold text-slate-500 tabular-nums">
          {fmt(item.stake_amount)} {item.token_symbol}
        </span>
        {isWon && (
          <span className="text-[10px] font-black text-amber-600 tabular-nums">
            +{fmt(item.stake_amount * 2)} {item.token_symbol}
          </span>
        )}
      </div>

      <ChevronRight className="h-4 w-4 text-slate-200 dark:text-white/10 group-hover:text-blue-400 transition-colors shrink-0" />
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function QuizListPage() {
  const router = useRouter();
  const { address: userWalletAddress } = useWallet();

  const [tab, setTab]                         = useState<"lobby" | "history">("lobby");
  const [lobbyChallenges, setLobbyChallenges] = useState<LobbyChallenge[]>([]);
  const [history, setHistory]                 = useState<HistoryChallenge[]>([]);
  const [isLoading, setIsLoading]             = useState(true);
  const [isRefreshing, setIsRefreshing]       = useState(false);
  const [historyLoading, setHistoryLoading]   = useState(false);
  const [codeInput, setCodeInput]             = useState("");
  const [navigating, setNavigating]           = useState<string | null>(null);
  const [historyTab, setHistoryTab]           = useState<"all" | "won">("all");

  // ── Lobby ─────────────────────────────────────────────────────────────────
  const fetchLobby = async (silent = false) => {
    if (!silent) setIsLoading(true); else setIsRefreshing(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/challenge/lobby`);
      const d = await r.json();
      if (d.success) {
        setLobbyChallenges(
          (d.challenges as LobbyChallenge[]).filter(c => c.chain_id === CELO_CHAIN_ID)
        );
      }
    } catch {
      toast.error("Failed to sync lobby");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // ── History ───────────────────────────────────────────────────────────────
  const fetchHistory = async () => {
    if (!userWalletAddress) return;
    setHistoryLoading(true);
    try {
      const r = await fetch(
        `${API_BASE_URL}/api/challenge/${userWalletAddress.toLowerCase()}/history?limit=50`
      );
      const d = await r.json();
      if (d.success) setHistory(d.history ?? []);
    } catch {
      toast.error("Failed to load match history");
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => { fetchLobby(); }, []);

  useEffect(() => {
    if (tab === "history" && userWalletAddress) fetchHistory();
  }, [tab, userWalletAddress]);

  // Auto-refresh lobby every 15 s
  useEffect(() => {
    if (tab !== "lobby") return;
    const t = setInterval(() => fetchLobby(true), 15_000);
    return () => clearInterval(t);
  }, [tab]);

  // ── Derived history stats ─────────────────────────────────────────────────
  const myWallet = userWalletAddress?.toLowerCase() ?? "";
  const wins     = useMemo(
    () => history.filter(h => h.status === "finished" && h.winner_address?.toLowerCase() === myWallet),
    [history, myWallet],
  );
  const totalWon = useMemo(
    () => wins.reduce((sum, h) => sum + h.stake_amount * 2, 0),
    [wins],
  );
  const filteredHistory = historyTab === "won" ? wins : history;

  // ── Navigation ────────────────────────────────────────────────────────────
  const handleJoinAction = async (code: string) => {
    if (code.length < 4) return;
    setNavigating(code);
    if (!userWalletAddress) {
      router.push(`/challenge/${code}/pre-lobby`);
      return;
    }
    try {
      const res  = await fetch(`${API_BASE_URL}/api/challenge/${code}`);
      const data = await res.json();
      if (data.success && data.challenge) {
        const c           = data.challenge;
        const wallet      = userWalletAddress.toLowerCase();
        const isCreator   = c.creator?.toLowerCase() === wallet;
        const isPlayer    = c.players && Object.keys(c.players).some((w: string) => w.toLowerCase() === wallet);
        const playerCount = Object.keys(c.players || {}).length;

        if (isCreator) {
          router.push(playerCount >= 2 ? `/challenge/${code}` : `/challenge/${code}/pre-lobby`);
        } else {
          router.push(isPlayer ? `/challenge/${code}` : `/challenge/${code}/pre-lobby`);
        }
      } else {
        router.push(`/challenge/${code}/pre-lobby`);
      }
    } catch {
      router.push(`/challenge/${code}/pre-lobby`);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      <Header pageTitle="Duel Arena" />

      <div className="max-w-7xl mx-auto w-full px-4 pt-6 pb-24 space-y-8">

        {/* Hero */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-7 space-y-3 text-center lg:text-left">
            <h1 className="text-3xl lg:text-5xl font-black text-slate-900 dark:text-white leading-none">
              STAKE <span className="text-blue-600">&</span> EARN
            </h1>
            <p className="text-slate-500 text-sm lg:text-base max-w-md mx-auto lg:mx-0">
              Celo-based competitive quizzes. Win the entire prize pool in 1v1 duels.
            </p>
          </div>

          <div className="lg:col-span-5 bg-blue-600 rounded-3xl p-6 lg:p-8 text-white shadow-xl">
          <h2 className="text-lg font-black flex items-center gap-2 mb-4">
            <Zap className="h-5 w-5 fill-white" /> Quick Join
          </h2>
          <div className="flex gap-2">
            <Input
              value={codeInput}
              onChange={e => setCodeInput(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === "Enter" && handleJoinAction(codeInput)}
              placeholder="ROOM CODE"
              className="bg-white/10 border-white/20 text-white placeholder:text-blue-200 font-mono font-bold h-12"
            />
            <Button
              onClick={() => handleJoinAction(codeInput)}
              disabled={!codeInput || navigating !== null}
              className="bg-white text-blue-600 hover:bg-blue-50 font-black px-8 h-12 shrink-0"
            >
              {navigating === codeInput
                ? <Loader2 className="h-5 w-5 animate-spin" />
                : "JOIN"}
            </Button>
          </div>

          {/* ADD THIS ↓ */}
          <Button
            onClick={() => router.push("/challenge/create-challenge")}
            className="w-full h-11 mt-3 bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold"
          >
            <Plus className="mr-2 h-4 w-4" /> Create Challenge
          </Button>
        </div>
        </div>

        <hr className="border-slate-200 dark:border-white/[0.05]" />

        {/* Nav & Controls */}
<div className="space-y-3">
  {/* Create Challenge — full width */}
  <Button
    onClick={() => router.push("/challenge/create-challenge")}
    className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-bold border-0"
  >
    <Plus className="mr-2 h-4 w-4" /> Create Challenge
  </Button>

  {/* Tabs + Refresh on same row */}
  <div className="flex items-center gap-2">
    <div className="flex flex-1 bg-white dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-white/[0.07]">
      <button
        onClick={() => setTab("lobby")}
        className={cn(
          "flex-1 px-6 py-2 rounded-xl text-sm font-black transition-all",
          tab === "lobby" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-600",
        )}
      >
        PUBLIC
      </button>
      <button
        onClick={() => setTab("history")}
        className={cn(
          "flex-1 px-6 py-2 rounded-xl text-sm font-black transition-all",
          tab === "history" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-600",
        )}
      >
        MY WINS
      </button>
    </div>

    <Button
      variant="outline"
      size="icon"
      onClick={() => tab === "lobby" ? fetchLobby(true) : fetchHistory()}
      className="rounded-full bg-white dark:bg-slate-900 shrink-0"
      disabled={isRefreshing || historyLoading}
    >
      <RefreshCw className={cn(
        "h-4 w-4 text-blue-600",
        (isRefreshing || historyLoading) && "animate-spin",
      )} />
    </Button>
  </div>
</div>

        {/* ── LOBBY TAB ── */}
        {tab === "lobby" && (
          <div className="min-h-[400px]">
            {isLoading ? (
              <div className="flex justify-center py-32"><Loading /></div>
            ) : lobbyChallenges.length === 0 ? (
              <div className="text-center py-24 bg-white dark:bg-slate-900 rounded-3xl border-2 border-dashed border-slate-200 dark:border-white/[0.05]">
                <Gamepad2 className="h-12 w-12 text-slate-200 dark:text-slate-700 mx-auto mb-4" />
                <h3 className="text-slate-900 dark:text-white font-bold text-lg">No active duels</h3>
                <p className="text-slate-500 mb-6">Be the first to create a public challenge on Celo.</p>
                <Button
                  onClick={() => router.push("/challenge/create-challenge")}
                  className="bg-blue-600"
                >
                  Start Duel
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6">
                {lobbyChallenges.map(c => (
                  <QuizChallengeCard
                    key={c.code}
                    challenge={c}
                    onClick={() => handleJoinAction(c.code)}
                    loading={navigating === c.code}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── HISTORY TAB ── */}
        {tab === "history" && (
          <div className="space-y-4">

            {/* Must be connected */}
            {!userWalletAddress ? (
              <div className="text-center py-24 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/[0.07]">
                <Trophy className="h-12 w-12 text-blue-100 dark:text-slate-800 mx-auto mb-4" />
                <p className="text-slate-500 font-bold max-w-xs mx-auto">
                  Connect your wallet to see your match history and earnings.
                </p>
              </div>
            ) : historyLoading ? (
              <div className="flex justify-center py-32"><Loading /></div>
            ) : (
              <>
                {/* Stats banner */}
                {history.length > 0 && (
                  <div className="grid grid-cols-3 gap-3">
                    
                    <div className="bg-white dark:bg-slate-900 border border-amber-200/50 dark:border-amber-500/20 rounded-2xl p-4 text-center bg-amber-50/30 dark:bg-amber-500/5">
                      <p className="text-2xl font-black text-amber-600 tabular-nums">{wins.length}</p>
                      <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider mt-0.5">Won</p>
                    </div>
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.07] rounded-2xl p-4 text-center">
                      <p className="text-2xl font-black text-blue-600 tabular-nums">
                        {history.length > 0 ? Math.round((wins.length / history.length) * 100) : 0}%
                      </p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Win Rate</p>
                    </div>
                  </div>
                )}

                

                {/* List */}
                {filteredHistory.length === 0 ? (
                  <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border-2 border-dashed border-slate-200 dark:border-white/[0.05]">
                    {historyTab === "won" ? (
                      <>
                        <Trophy className="h-10 w-10 text-slate-200 dark:text-slate-700 mx-auto mb-3" />
                        <p className="font-bold text-slate-500">No wins yet — keep playing!</p>
                      </>
                    ) : (
                      <>
                        <Swords className="h-10 w-10 text-slate-200 dark:text-slate-700 mx-auto mb-3" />
                        <p className="font-bold text-slate-500">No matches played yet.</p>
                        <Button
                          onClick={() => setTab("lobby")}
                          className="mt-4 bg-blue-600"
                        >
                          Find a Challenge
                        </Button>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredHistory.map(item => (
                      <HistoryRow
                        key={item.code}
                        item={item}
                        myWallet={myWallet}
                        onClick={() => router.push(`/challenge/${item.code}`)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Mobile FAB */}
      
    </div>
  );
}