"use client";
/**
 * /app/quiz/page.tsx  — Quiz Hub
 * Refactored to match backend: /api/challenge/* + /api/players/*
 * Backend lobby endpoint: GET /api/challenge/lobby
 * No /api/quiz/list or DELETE endpoint exists — uses lobby + history instead.
 */
import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/hooks/use-wallet";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search, Plus, Trophy, Users, Clock, Loader2,
  Gamepad2, Play, CheckCircle2, Hash, RefreshCw,
  ChevronRight, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Loading from "../loading/page";

const API_BASE_URL = "http://127.0.0.1:8000";

// ── Types matching backend's public_lobby VIEW ──────────────────────────────
// Schema: code, topic, stake_amount, token_symbol, chain_id,
//         created_at, creator_username, creator_wins
interface LobbyChallenge {
  code: string;
  topic: string;           // backend uses "topic" not "title"
  stake_amount: number;
  token_symbol: string;
  chain_id: number;
  created_at: string;
  creator_username: string;
  creator_wins: number;
  // The GET /api/challenge/{code} endpoint returns more detail;
  // these come from the lobby view (waiting + public only).
}

// Full challenge shape from GET /api/challenge/{code}
interface ChallengeDetail {
  id: string;
  code: string;
  topic: string;
  creator: string;           // wallet address
  creatorName: string;
  stake: number;
  token: string;
  chainId: number;
  status: "waiting" | "active" | "finished";
  isPublic: boolean;
  players: Record<string, { username: string; points: number; ready: boolean; txVerified: boolean }>;
  rounds?: any[];            // stripped of correctId server-side
}

const CHAIN_NAMES: Record<number, string> = {
  42220: "Celo",
  8453:  "Base",
  1135:  "Lisk",
};

const STATUS_CONFIG = {
  waiting: {
    label: "Waiting",
    color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20",
    dot:   "bg-blue-500",
  },
  active: {
    label: "Live",
    color: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-200 dark:border-green-500/20 animate-pulse",
    dot:   "bg-green-500",
  },
  finished: {
    label: "Ended",
    color: "bg-slate-100 dark:bg-white/5 text-slate-400 border-slate-200 dark:border-white/10",
    dot:   "bg-slate-300",
  },
};

// ── Lobby card — uses LobbyChallenge shape ──────────────────────────────────
function LobbyCard({
  challenge,
  onClick,
}: {
  challenge: LobbyChallenge;
  onClick: () => void;
}) {
  const playerCount = 1; // lobby view doesn't expose player count; challenge has 1 slot taken (creator)
  const chainName   = CHAIN_NAMES[challenge.chain_id] ?? `Chain ${challenge.chain_id}`;

  return (
    <button
      onClick={onClick}
      className={cn(
        "group w-full text-left rounded-2xl overflow-hidden transition-all duration-200",
        "bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.07]",
        "hover:border-blue-400 dark:hover:border-blue-500/40 hover:-translate-y-0.5 shadow-sm hover:shadow-md"
      )}
    >
      {/* Colour strip — use chain colour as accent */}
      <div className="h-2 bg-gradient-to-r from-blue-500/40 to-blue-300/20" />

      <div className="p-4 space-y-3">
        {/* Topic + status */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold text-slate-900 dark:text-white text-sm leading-tight line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex-1">
            {challenge.topic}
          </h3>
          <span className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border shrink-0",
            STATUS_CONFIG.waiting.color
          )}>
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            Waiting
          </span>
        </div>

        {/* Stake + chain */}
        <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
          <span className="flex items-center gap-1">
            <Trophy className="h-3 w-3 text-yellow-500" />
            {challenge.stake_amount} {challenge.token_symbol}
          </span>
          <span className="flex items-center gap-1">
            <Zap className="h-3 w-3" /> {chainName}
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" /> 1/2
          </span>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-white/[0.06]">
          <span className="font-mono text-xs text-slate-300 dark:text-white/20 flex items-center gap-1">
            <Hash className="h-3 w-3" />{challenge.code}
          </span>
          <span className="text-xs font-bold text-blue-600 dark:text-blue-400 group-hover:text-blue-500 flex items-center gap-1">
            Enter Lobby <ChevronRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </button>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function QuizListPage() {
  const router                                         = useRouter();
  const { address: userWalletAddress }                 = useWallet();
  const [lobbyChallenges, setLobbyChallenges]          = useState<LobbyChallenge[]>([]);
  const [historyChallenges, setHistoryChallenges]      = useState<ChallengeDetail[]>([]);
  const [isLoading, setIsLoading]                      = useState(true);
  const [isRefreshing, setIsRefreshing]                = useState(false);
  const [searchQuery, setSearchQuery]                  = useState("");
  const [tab, setTab]                                  = useState<"lobby" | "history">("lobby");
  const [codeInput, setCodeInput]                      = useState("");
  const [isJumping, setIsJumping]                      = useState(false);
  const [lobbyPage, setLobbyPage]                      = useState(0);
  const PAGE_SIZE                                      = 20;

  // ── Fetch public lobby (GET /api/challenge/lobby) ──
  const fetchLobby = async (silent = false) => {
    if (!silent) setIsLoading(true); else setIsRefreshing(true);
    try {
      const r = await fetch(
        `${API_BASE_URL}/api/challenge/lobby?limit=${PAGE_SIZE}&offset=${lobbyPage * PAGE_SIZE}`,
        { cache: "no-store" }
      );
      const d = await r.json();
      if (d.success) setLobbyChallenges(d.challenges ?? []);
    } catch {
      if (!silent) toast.error("Failed to load challenges");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // ── Fetch player history (GET /api/challenge/{wallet}/history) ──
  const fetchHistory = async () => {
    if (!userWalletAddress) return;
    try {
      const r = await fetch(
        `${API_BASE_URL}/api/challenge/${userWalletAddress}/history?limit=20`
      );
      const d = await r.json();
      if (d.success) setHistoryChallenges(d.history ?? []);
    } catch {
      // history is non-critical — fail silently
    }
  };

  useEffect(() => { fetchLobby(); }, [lobbyPage]);
  useEffect(() => {
    if (tab === "history") fetchHistory();
  }, [tab, userWalletAddress]);

  // Auto-refresh lobby every 15 s
  useEffect(() => {
    const t = setInterval(() => {
      if (tab === "lobby") fetchLobby(true);
    }, 15_000);
    return () => clearInterval(t);
  }, [tab, lobbyPage]);

  // ── Jump to code (GET /api/challenge/{code}) ──
  const handleJumpToCode = async () => {
    const code = codeInput.trim().toUpperCase();
    if (code.length < 4) { toast.error("Enter a valid challenge code"); return; }
    setIsJumping(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/challenge/${code}`);
      const d = await r.json();
      if (d.success) {
        router.push(`/quiz/${code}`);
      } else {
        toast.error("Challenge not found");
      }
    } catch {
      toast.error("Failed to check code");
    } finally {
      setIsJumping(false);
    }
  };

  // ── Filtered lobby list ──
  const filteredLobby = useMemo(() => {
    if (!searchQuery) return lobbyChallenges;
    const q = searchQuery.toLowerCase();
    return lobbyChallenges.filter(
      c =>
        c.topic.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.creator_username.toLowerCase().includes(q)
    );
  }, [lobbyChallenges, searchQuery]);

  // ── History status badge ──
  const HistoryStatusBadge = ({ status }: { status: string }) => {
    const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.finished;
    return (
      <span className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border",
        cfg.color
      )}>
        <span className={cn("w-1.5 h-1.5 rounded-full", cfg.dot)} />
        {cfg.label}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      <Header pageTitle="Challenge Hub" />

      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 pb-20 space-y-6 pt-6">

        {/* ── Hero ── */}
        <div className="border border-slate-200 dark:border-white/[0.07] bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="space-y-3 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 flex items-center justify-center shrink-0">
                  <Gamepad2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-blue-600 dark:text-blue-400 font-bold text-xs uppercase tracking-widest">
                  FaucetDrops
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white leading-none">
                Quiz Hub
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm max-w-lg">
                Join a 1v1 quiz challenge, browse open lobbies, or create your own with real token stakes.
              </p>
              {lobbyChallenges.length > 0 && (
                <span className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-sm font-bold">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  {lobbyChallenges.length} open challenge{lobbyChallenges.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            {/* Join by code */}
            <div className="w-full lg:w-auto shrink-0 space-y-2 lg:min-w-[260px]">
              <p className="text-slate-400 dark:text-slate-500 text-xs uppercase font-bold tracking-widest mb-2">
                Join with Code
              </p>
              <div className="flex gap-2">
                <Input
                  value={codeInput}
                  onChange={e => setCodeInput(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === "Enter" && handleJumpToCode()}
                  placeholder="ABC123"
                  maxLength={8}
                  className="font-mono font-black text-base tracking-widest bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white h-11 placeholder:text-slate-300 dark:placeholder:text-white/20 focus-visible:border-blue-500"
                />
                <Button
                  className="h-11 px-4 font-bold bg-blue-600 hover:bg-blue-500 text-white border-0 shrink-0"
                  onClick={handleJumpToCode}
                  disabled={isJumping || codeInput.length < 4}
                >
                  {isJumping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Tabs + Filters ── */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Tab switcher */}
          <div className="flex gap-1 p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.07] rounded-xl">
            {(["lobby", "history"] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "px-4 py-2 rounded-lg text-xs font-bold transition-all capitalize",
                  tab === t
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                {t === "lobby" ? "Open Challenges" : "My History"}
              </button>
            ))}
          </div>

          {tab === "lobby" && (
            <>
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <Input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search by topic, code, or creator..."
                  className="pl-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-white/[0.07] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus-visible:border-blue-500 h-11"
                />
              </div>
              <button
                onClick={() => fetchLobby(true)}
                disabled={isRefreshing}
                className="p-2 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.07] text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all disabled:opacity-30"
              >
                <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
              </button>
            </>
          )}
        </div>

        {/* ── Lobby grid ── */}
        {tab === "lobby" && (
          isLoading ? (
            <div className="flex items-center justify-center py-32">
              <Loading />
            </div>
          ) : filteredLobby.length === 0 ? (
            <div className="border border-dashed border-slate-200 dark:border-white/[0.07] rounded-2xl flex flex-col items-center justify-center py-24 space-y-4">
              <Gamepad2 className="h-10 w-10 text-slate-200 dark:text-white/10" />
              <div className="text-center">
                <h3 className="text-slate-600 dark:text-slate-400 font-bold">No open challenges</h3>
                <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">
                  {searchQuery ? "Try a different search term" : "Be the first to create one!"}
                </p>
              </div>
              {userWalletAddress && (
                <Button
                  onClick={() => router.push("/quiz/create-quiz")}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold border-0"
                >
                  <Plus className="mr-2 h-4 w-4" /> Create Challenge
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredLobby.map((challenge, i) => (
                  <div
                    key={challenge.code}
                    className="animate-in fade-in slide-in-from-bottom-3"
                    style={{ animationDelay: `${i * 40}ms`, animationFillMode: "backwards" }}
                  >
                    <LobbyCard
                      challenge={challenge}
                      onClick={() => router.push(`/quiz/${challenge.code}`)}
                    />
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {(lobbyChallenges.length === PAGE_SIZE || lobbyPage > 0) && (
                <div className="flex items-center justify-center gap-3 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={lobbyPage === 0}
                    onClick={() => setLobbyPage(p => Math.max(0, p - 1))}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-slate-500">Page {lobbyPage + 1}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={lobbyChallenges.length < PAGE_SIZE}
                    onClick={() => setLobbyPage(p => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )
        )}

        {/* ── History list ── */}
        {tab === "history" && (
          !userWalletAddress ? (
            <div className="border border-dashed border-slate-200 dark:border-white/[0.07] rounded-2xl flex flex-col items-center justify-center py-24 space-y-4">
              <p className="text-slate-500 dark:text-slate-400 font-bold">Connect your wallet to see history</p>
            </div>
          ) : historyChallenges.length === 0 ? (
            <div className="border border-dashed border-slate-200 dark:border-white/[0.07] rounded-2xl flex flex-col items-center justify-center py-24 space-y-4">
              <Clock className="h-10 w-10 text-slate-200 dark:text-white/10" />
              <p className="text-slate-500 dark:text-slate-400 font-bold">No past challenges yet</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.07] rounded-2xl overflow-hidden">
              <div className="divide-y divide-slate-100 dark:divide-white/[0.05]">
                {historyChallenges.map(c => {
                  // backend history shape:
                  // code, topic, stake_amount, token_symbol, status, winner_address, created_at, finished_at
                  const isWinner = (c as any).winner_address?.toLowerCase() === userWalletAddress?.toLowerCase();
                  return (
                    <button
                      key={(c as any).code}
                      onClick={() => router.push(`/quiz/${(c as any).code}`)}
                      className="w-full flex items-center gap-4 px-5 py-4 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors text-left"
                    >
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0",
                        isWinner
                          ? "bg-yellow-50 dark:bg-yellow-500/10"
                          : "bg-slate-100 dark:bg-white/5"
                      )}>
                        {isWinner ? "🏆" : "🎯"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-900 dark:text-white font-bold text-sm truncate">
                          {(c as any).topic}
                        </p>
                        <p className="text-slate-400 dark:text-slate-500 text-xs mt-0.5">
                          {(c as any).stake_amount} {(c as any).token_symbol}
                          {(c as any).finished_at && ` · ${new Date((c as any).finished_at).toLocaleDateString()}`}
                        </p>
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        <HistoryStatusBadge status={(c as any).status} />
                        <ChevronRight className="h-4 w-4 text-slate-300 dark:text-white/20" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )
        )}

        {/* ── Create CTA ── */}
        {userWalletAddress && (
          <div className="fixed bottom-6 right-6 z-40">
            <Button
              onClick={() => router.push("/quiz/create-quiz")}
              className="h-14 px-6 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-xl shadow-blue-600/30 border-0 text-base"
            >
              <Plus className="mr-2 h-5 w-5" /> New Challenge
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}