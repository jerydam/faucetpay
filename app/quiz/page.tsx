"use client";
/**
 * /app/quiz/page.tsx  –  FaucetDrops Quiz Hub
 * System theme — works with light/dark toggle
 */
import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/hooks/use-wallet";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search, Plus, Trophy, Users, Clock, Loader2,
  Gamepad2, Play, CheckCircle2, Hash, RefreshCw, BookOpen,
  ChevronRight, Trash2, AlertTriangle, Zap, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Loading from "../loading/page";

const API_BASE_URL = "https://identical-vivi-faucetdrops-41e9c56b.koyeb.app";

interface QuizCard {
  code: string;
  title: string;
  description: string;
  coverImageUrl?: string | null;
  status: "waiting" | "active" | "finished";
  creatorUsername: string;
  creatorAddress: string;
  totalQuestions: number;
  playerCount: number;
  maxParticipants: number;
  createdAt: string;
  startTime?: string | null;
  isAiGenerated?: boolean;
  reward?: { poolAmount: number; tokenSymbol: string; totalWinners: number };
}

const STATUS_CONFIG = {
  waiting: {
    label: "Waiting",
    color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20",
    dot: "bg-blue-500 dark:bg-blue-400",
    icon: Clock,
  },
  active: {
    label: "Live",
    color: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-200 dark:border-green-500/20 animate-pulse",
    dot: "bg-green-500 dark:bg-green-400",
    icon: Play,
  },
  finished: {
    label: "Ended",
    color: "bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-white/10",
    dot: "bg-slate-300 dark:bg-white/20",
    icon: CheckCircle2,
  },
};

function QuizCardItem({
  quiz,
  onClick,
  isCreator,
  onDelete,
}: {
  quiz: QuizCard;
  onClick: () => void;
  isCreator: boolean;
  onDelete: (e: React.MouseEvent) => void;
}) {
  const s = STATUS_CONFIG[quiz.status];
  const isLive = quiz.status === "active";
  const isFull = quiz.maxParticipants > 0 && quiz.playerCount >= quiz.maxParticipants;

  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative w-full text-left rounded-2xl overflow-hidden transition-all duration-200",
        "bg-white dark:bg-slate-900 border hover:border-blue-400 dark:hover:border-blue-500/40 hover:-translate-y-0.5 shadow-sm hover:shadow-md",
        isLive
          ? "border-green-300 dark:border-green-500/20"
          : "border-slate-200 dark:border-white/[0.07]"
      )}
    >
      {/* Cover strip */}
      <div className="relative h-28 overflow-hidden">
        {quiz.coverImageUrl ? (
          <img
            src={quiz.coverImageUrl}
            alt=""
            className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity"
          />
        ) : (
          <div className="w-full h-full bg-slate-100 dark:bg-slate-950 flex items-center justify-center">
            <Gamepad2 className="h-12 w-12 text-slate-200 dark:text-white/5" />
          </div>
        )}

        <div className="absolute top-3 left-3">
          <span className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border backdrop-blur",
            s.color
          )}>
            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", s.dot)} />
            {s.label}
          </span>
        </div>

        <div className="absolute top-3 right-3 flex items-center gap-2">
          {quiz.isAiGenerated && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 backdrop-blur">
              <Sparkles className="h-3 w-3" /> AI
            </span>
          )}
          {isCreator && (
            <div
              onClick={(e) => { e.stopPropagation(); onDelete(e); }}
              className="p-1.5 rounded-full bg-red-50 dark:bg-red-500/20 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/30 transition-colors border border-red-200 dark:border-red-500/30 backdrop-blur"

              title="Delete Quiz"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </div>
          )}
        </div>

        {quiz.reward && quiz.reward.poolAmount > 0 && (
          <div className="absolute bottom-3 right-3">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-yellow-50 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-500/20 backdrop-blur">
              <Trophy className="h-3 w-3" /> {quiz.reward.poolAmount} {quiz.reward.tokenSymbol}
            </span>
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="p-4 space-y-3">
        <div>
          <h3 className="font-bold text-slate-900 dark:text-white text-sm leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2">
            {quiz.title}
          </h3>
          {quiz.description && (
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 line-clamp-2">{quiz.description}</p>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
          <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" /> {quiz.totalQuestions}Q</span>
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {quiz.playerCount}{quiz.maxParticipants > 0 && `/${quiz.maxParticipants}`}
          </span>
          {quiz.reward && (
            <span className="flex items-center gap-1">
              <Trophy className="h-3 w-3 text-yellow-500" /> {quiz.reward.totalWinners}W
            </span>
          )}
          <span className="ml-auto text-[10px]">
            by {quiz.creatorUsername?.trim() || quiz.creatorAddress.slice(0, 6) + "…"}
           </span>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-white/[0.06]">
          <span className="font-mono text-xs text-slate-300 dark:text-white/20 flex items-center gap-1">
            <Hash className="h-3 w-3" />{quiz.code}
          </span>
          <span className={cn(
            "text-xs font-bold flex items-center gap-1 transition-colors",
            isFull
              ? "text-slate-300 dark:text-white/20"
              : isLive
              ? "text-green-600 dark:text-green-400"
              : quiz.status === "finished"
              ? "text-slate-300 dark:text-white/20"
              : "text-blue-600 dark:text-blue-400 group-hover:text-blue-500 dark:group-hover:text-blue-300"
          )}>
            {isFull ? "Full" : quiz.status === "finished" ? "View Results" : isLive ? "Join Now" : "Enter Lobby"}
            <ChevronRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>

      {isLive && (
        <div className="absolute inset-0 rounded-2xl border border-green-400/20 dark:border-green-500/10 pointer-events-none animate-pulse" />
      )}
    </button>
  );
}

export default function QuizListPage() {
  const router = useRouter();
  const { address: userWalletAddress } = useWallet();
  const [quizzes, setQuizzes] = useState<QuizCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "waiting" | "active" | "finished">("all");
  const [codeInput, setCodeInput] = useState("");
  const [isJumping, setIsJumping] = useState(false);
  const [quizToDelete, setQuizToDelete] = useState<QuizCard | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchQuizzes = async (silent = false) => {
    if (!silent) setIsLoading(true); else setIsRefreshing(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/quiz/list?t=${Date.now()}`, { cache: "no-store" });
      const d = await r.json();
      if (d.success) setQuizzes(d.quizzes || []);
    } catch { if (!silent) toast.error("Failed to load quizzes"); }
    finally { setIsLoading(false); setIsRefreshing(false); }
  };

  useEffect(() => { fetchQuizzes(); }, []);
  useEffect(() => {
    const t = setInterval(() => fetchQuizzes(true), 15000);
    return () => clearInterval(t);
  }, []);

  const initiateDelete = (quiz: QuizCard) => {
    setQuizToDelete(quiz);
    setDeleteConfirmText("");
  };

  const confirmDelete = async () => {
    if (!quizToDelete || deleteConfirmText !== quizToDelete.code) return;
    setIsDeleting(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/quiz/${quizToDelete.code}?walletAddress=${userWalletAddress}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (data.success) {
        toast.success("Quiz deleted successfully");
        setQuizzes(prev => prev.filter(q => q.code !== quizToDelete.code));
        setQuizToDelete(null);
      } else {
        toast.error(data.detail || "Failed to delete quiz");
      }
    } catch { toast.error("Error deleting quiz"); }
    finally { setIsDeleting(false); }
  };

  const handleJumpToCode = async () => {
    const code = codeInput.trim().toUpperCase();
    if (code.length < 4) { toast.error("Enter a valid quiz code"); return; }
    setIsJumping(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/quiz/${code}`);
      const d = await r.json();
      if (d.success) router.push(`/quiz/${code}`);
      else toast.error("Quiz not found");
    } catch { toast.error("Failed to check code"); }
    finally { setIsJumping(false); }
  };

  const filtered = useMemo(() => {
    return quizzes.filter(q => {
      const matchStatus = statusFilter === "all" || q.status === statusFilter;
      const matchSearch = !searchQuery ||
        q.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.creatorUsername?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchStatus && matchSearch;
    }).sort((a, b) => {
      const order = { active: 0, waiting: 1, finished: 2 };
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [quizzes, statusFilter, searchQuery]);

  const liveCount    = quizzes.filter(q => q.status === "active").length;
  const waitingCount = quizzes.filter(q => q.status === "waiting").length;
  const endedCount   = quizzes.filter(q => q.status === "finished").length;

  const filterTabs = [
    { key: "all",      label: "All",      count: quizzes.length },
    { key: "active",   label: "Active",   count: liveCount },
    { key: "waiting",  label: "Upcoming", count: waitingCount },
    { key: "finished", label: "Ended",    count: endedCount },
  ] as const;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      <Header pageTitle="Quiz Hub" />

      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 pb-20 space-y-6 pt-6">

        {/* ── Hero ── */}
        <div className="border border-slate-200 dark:border-white/[0.07] bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="space-y-3 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 flex items-center justify-center shrink-0">
                  <Gamepad2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-blue-600 dark:text-blue-400 font-bold text-xs uppercase tracking-widest">FaucetDrops Quiz</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white leading-none">
                Quiz Hub
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm max-w-lg">
                Join a live quiz, browse upcoming games, or create your own — with real token rewards for winners.
              </p>
              <div className="flex flex-wrap items-center gap-4 pt-1">
                {liveCount > 0 && (
                  <span className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm font-bold">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    {liveCount} Live Now
                  </span>
                )}
                {waitingCount > 0 && (
                  <span className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-sm font-bold">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    {waitingCount} Starting Soon
                  </span>
                )}
              </div>
            </div>

            <div className="w-full lg:w-auto shrink-0 space-y-2 lg:min-w-[260px]">
              <p className="text-slate-400 dark:text-slate-500 text-xs uppercase font-bold tracking-widest mb-2">Join with Code</p>
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

        {/* ── Filters ── */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by title, code, or creator..."
              className="pl-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-white/[0.07] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus-visible:border-blue-500 h-11"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {filterTabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold transition-all border",
                  statusFilter === tab.key
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/[0.07] hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-white/20"
                )}
              >
                {tab.label}
                <span className={cn(
                  "text-[10px] font-mono px-1 py-0.5 rounded-full",
                  statusFilter === tab.key
                    ? "bg-white/20 text-white"
                    : "bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-slate-500"
                )}>
                  {tab.count}
                </span>
              </button>
            ))}

            <button
              onClick={() => fetchQuizzes(true)}
              disabled={isRefreshing}
              className="p-2 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.07] text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all disabled:opacity-30"
            >
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            </button>
          </div>
        </div>

        {/* ── Grid ── */}
        {isLoading ? (
          <div className="flex items-center justify-center py-32">
            <Loading/>
          </div>
        ) : filtered.length === 0 ? (
          <div className="border border-dashed border-slate-200 dark:border-white/[0.07] rounded-2xl flex flex-col items-center justify-center py-24 space-y-4">
            <Gamepad2 className="h-10 w-10 text-slate-200 dark:text-white/10" />
            <div className="text-center">
              <h3 className="text-slate-600 dark:text-slate-400 font-bold">No quizzes found</h3>
              <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">
                {searchQuery ? "Try a different search term" : "Be the first to create one!"}
              </p>
            </div>
            {userWalletAddress && (
              <Button
                onClick={() => router.push("/quiz/create-quiz")}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold border-0"
              >
                <Plus className="mr-2 h-4 w-4" /> Create Quiz
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((quiz, i) => (
              <div
                key={quiz.code}
                className="animate-in fade-in slide-in-from-bottom-3"
                style={{ animationDelay: `${i * 40}ms`, animationFillMode: "backwards" }}
              >
                <QuizCardItem
                  quiz={quiz}
                  onClick={() => router.push(`/quiz/${quiz.code}`)}
                  isCreator={userWalletAddress?.toLowerCase() === quiz.creatorAddress.toLowerCase()}
                  onDelete={() => initiateDelete(quiz)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Delete Confirmation Modal ── */}
      {quizToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.07] rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">

            <div className="flex items-center gap-4 mb-5">
              <div className="w-11 h-11 rounded-full bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-500 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">Delete Quiz?</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">This action cannot be undone.</p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07] rounded-xl p-4 mb-5">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                Type the quiz code to confirm:{" "}
                <strong className="text-slate-900 dark:text-white select-none">{quizToDelete.code}</strong>
              </p>
              <Input
                value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value.toUpperCase())}
                onPaste={e => { e.preventDefault(); toast.warning("Pasting disabled. Please type the code."); }}
                placeholder="Type code here..."
                className="h-11 font-mono font-bold text-center tracking-widest uppercase bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus-visible:border-red-500 placeholder:text-slate-300 dark:placeholder:text-white/20"
              />
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-11 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-transparent"
                onClick={() => setQuizToDelete(null)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 h-11 bg-red-600 hover:bg-red-500 text-white font-bold border-0 disabled:opacity-40"
                disabled={deleteConfirmText !== quizToDelete.code || isDeleting}
                onClick={confirmDelete}
              >
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete Forever"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}