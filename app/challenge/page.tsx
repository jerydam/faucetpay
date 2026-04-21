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
Plus, Trophy, Users, Clock, Loader2,
Gamepad2, Hash, RefreshCw, ChevronRight, Zap, 
Globe, Search
    } from "lucide-react";
    import { toast } from "sonner";
    import { cn } from "@/lib/utils";
    import Loading from "../loading/page";

    const API_BASE_URL = "https://faucetpay-backend.koyeb.app";
    const CELO_CHAIN_ID = 42220;

    interface LobbyChallenge {
code: string;
topic: string;
stake_amount: number;
token_symbol: string;
chain_id: number;
created_at: string;
creator_username: string;
    }

    const STATUS_CONFIG = {
waiting: {
  label: "Join Pool",
  color: "bg-blue-600 text-white border-blue-600",
}
    };

    function QuizChallengeCard({
challenge,
onClick,
loading,
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
"hover:border-blue-600 shadow-sm active:scale-[0.98] lg:hover:-translate-y-1"
    )}
  >
    <div className="p-5 space-y-4">
<div className="flex items-start justify-between gap-3">
  <div className="space-y-1 flex-1 min-w-0">
    <h3 className="font-bold text-slate-900 dark:text-white text-base leading-tight truncate">
{challenge.topic}
    </h3>
    <div className="flex items-center gap-2">
<span className="text-[11px] text-slate-400 flex items-center gap-1">
  <Users className="h-3 w-3" /> @{challenge.creator_username}
</span>
    </div>
  </div>
  <span className={cn("px-2 py-1 rounded text-[10px] font-black uppercase border shrink-0", STATUS_CONFIG.waiting.color)}>
    {STATUS_CONFIG.waiting.label}
  </span>
</div>

<div className="flex items-center justify-between py-4 border-y border-slate-50 dark:border-white/[0.05]">
  <div className="text-center flex-1">
    <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-tight">Entry Stake</span>
    <span className="font-bold text-slate-900 dark:text-white text-sm">{challenge.stake_amount} {challenge.token_symbol}</span>
  </div>
  <div className="w-[1px] h-8 bg-slate-100 dark:bg-white/10" />
  <div className="text-center flex-1">
    <span className="block text-[10px] text-blue-600 font-bold uppercase tracking-tight">Prize Pool</span>
    <span className="font-bold text-blue-600 flex items-center justify-center gap-1 text-sm">
<Trophy className="h-3.5 w-3.5" /> {totalPrize} {challenge.token_symbol}
    </span>
  </div>
</div>

<div className="flex items-center justify-between text-[11px] font-bold">
  <span className="text-slate-300 dark:text-slate-600 flex items-center gap-1 font-mono">
    #{challenge.code}
  </span>
  <div className="text-blue-600 flex items-center gap-1">
    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>CHALLENGE <ChevronRight className="h-3 w-3" /></>}
  </div>
</div>
    </div>
  </button>
);
    }

  export default function QuizListPage() {
  const router = useRouter();
  const { address: userWalletAddress } = useWallet();
  const [tab, setTab] = useState<"lobby" | "history">("lobby");
  const [lobbyChallenges, setLobbyChallenges] = useState<LobbyChallenge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [navigating, setNavigating] = useState<string | null>(null);

  const fetchLobby = async (silent = false) => {
    if (!silent) setIsLoading(true); else setIsRefreshing(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/challenge/lobby`);
      const d = await r.json();
      if (d.success) {
  const celoOnly = (d.challenges as LobbyChallenge[]).filter(c => c.chain_id === CELO_CHAIN_ID);
  setLobbyChallenges(celoOnly);
      }
    } catch {
      toast.error("Failed to sync lobby");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => { fetchLobby(); }, []);

  const handleJoinAction = (code: string) => {
    if (code.length < 4) return;
    setNavigating(code);
    router.push(`/challenge/${code}/pre-lobby`);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      <Header pageTitle="Quiz Arena" />

      <div className="max-w-7xl mx-auto w-full px-4 pt-6 pb-24 space-y-8">

  {/* --- Hero Section (Desktop Grid / Mobile Stack) --- */}
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
    {navigating === codeInput ? <Loader2 className="h-5 w-5 animate-spin" /> : "JOIN"}
  </Button>
      </div>
    </div>
  </div>

  <hr className="border-slate-200 dark:border-white/[0.05]" />

  {/* --- Nav & Controls --- */}
  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
    <div className="flex bg-white dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-white/[0.07] self-start">
      <button
  onClick={() => setTab("lobby")}
  className={cn(
    "px-6 py-2 rounded-xl text-sm font-black transition-all",
    tab === "lobby" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-600"
  )}
      >
  PUBLIC
      </button>
      <button
  onClick={() => setTab("history")}
  className={cn(
    "px-6 py-2 rounded-xl text-sm font-black transition-all",
    tab === "history" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-600"
  )}
      >
  MY WINS
      </button>
    </div>

    <div className="flex items-center gap-2">
      <Button
  variant="outline"
  size="icon"
  onClick={() => fetchLobby(true)}
  className="rounded-full bg-white dark:bg-slate-900"
  disabled={isRefreshing}
      >
  <RefreshCw className={cn("h-4 w-4 text-blue-600", isRefreshing && "animate-spin")} />
      </Button>
      <Button
  onClick={() => router.push("/challenge/create-challenge")}
  className="hidden md:flex bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl px-6"
      >
  <Plus className="mr-2 h-4 w-4" /> Create Challenge
      </Button>
    </div>
  </div>

  {/* --- Challenge Grid --- */}
  <div className="min-h-[400px]">
    {isLoading ? (
      <div className="flex justify-center py-32"><Loading /></div>
    ) : tab === "lobby" ? (
      lobbyChallenges.length === 0 ? (
  <div className="text-center py-24 bg-white dark:bg-slate-900 rounded-3xl border-2 border-dashed border-slate-200 dark:border-white/[0.05]">
    <Gamepad2 className="h-12 w-12 text-slate-200 dark:text-slate-700 mx-auto mb-4" />
    <h3 className="text-slate-900 dark:text-white font-bold text-lg">No active duels</h3>
    <p className="text-slate-500 mb-6">Be the first to create a public challenge on Celo.</p>
    <Button onClick={() => router.push("/challenge/create-challenge")} className="bg-blue-600">Start Duel</Button>
  </div>
      ) : (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6">
    {lobbyChallenges.map((c) => (
      <QuizChallengeCard 
  key={c.code} 
  challenge={c} 
  onClick={() => handleJoinAction(c.code)}
  loading={navigating === c.code}
      />
    ))}
  </div>
      )
    ) : (
      <div className="text-center py-24 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/[0.07]">
  <Trophy className="h-12 w-12 text-blue-100 dark:text-slate-800 mx-auto mb-4" />
  <p className="text-slate-500 font-bold max-w-xs mx-auto">
    Connect your wallet to track your earnings and match history.
  </p>
      </div>
    )}
  </div>
      </div>

      {/* --- Mobile FAB (Visible only on mobile/tablet) --- */}
      <div className="md:hidden fixed bottom-6 right-6 z-50">
  <Button
    onClick={() => router.push("/challenge/create-challenge")}
    className="h-16 w-16 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-2xl border-0 p-0"
  >
    <Plus className="h-8 w-8" />
  </Button>
      </div>
    </div>
  );
      }