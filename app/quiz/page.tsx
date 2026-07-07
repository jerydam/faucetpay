"use client";
/**
 * /app/quiz/page.tsx  –  FaucetDrops Quiz Hub
 * Uses system/semantic Tailwind tokens throughout (no hardcoded colors).
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
  ChevronRight, ChevronLeft, Trash2, AlertTriangle, Zap, Sparkles,
  Flame, Swords, ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Loading from "../loading/page";

const API_BASE_URL = "https://identical-vivi-faucetdrops-41e9c56b.koyeb.app";
const DEFAULT_QUIZ_COVER = "/quiz.jpeg";

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

// Status uses semantic color names that pair with Tailwind's dark/light system
const STATUS_CONFIG = {
  waiting: {
    label: "Soon",
    color: "text-blue-500 dark:text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
    dot: "bg-blue-500 dark:bg-blue-400",
    icon: Clock,
  },
  active: {
    label: "Live",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
    dot: "bg-emerald-500 dark:bg-emerald-400",
    icon: Play,
  },
  finished: {
    label: "Ended",
    color: "text-muted-foreground",
    bg: "bg-muted border-border",
    dot: "bg-muted-foreground/40",
    icon: CheckCircle2,
  },
};

// Shared button-like classes built from system tokens
const pageBtnBase =
  "w-8 h-8 rounded-lg text-xs font-bold transition-all border flex items-center justify-center";
const pageBtnIdle =
  "bg-card text-muted-foreground border-border hover:text-foreground hover:border-border/60 disabled:opacity-20 disabled:cursor-not-allowed";
const pageBtnActive = "bg-primary text-primary-foreground border-primary";

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
  const isEnded = quiz.status === "finished";
  const isFull = quiz.maxParticipants > 0 && quiz.playerCount >= quiz.maxParticipants;

  const ctaLabel = isFull ? "Full" : isEnded ? "Results" : isLive ? "Join Now" : "Enter";

  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative w-full text-left rounded-xl overflow-hidden transition-all duration-200",
        "bg-card border hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-lg",
        isLive ? "border-emerald-500/30" : "border-border"
      )}
    >
      {/* Cover */}
      <div className="relative h-32 overflow-hidden bg-muted">
        <img
          src={quiz.coverImageUrl || DEFAULT_QUIZ_COVER}
          alt=""
          className="w-full h-full object-cover opacity-50 group-hover:opacity-70 group-hover:scale-105 transition-all duration-300"
        />

        {/* Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />

        {/* Top-left badges */}
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
          <span className={cn(
            "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold border backdrop-blur-sm",
            s.bg, s.color
          )}>
            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", s.dot, isLive && "animate-pulse")} />
            {s.label}
          </span>
          {quiz.isAiGenerated && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-violet-500/10 text-violet-500 dark:text-violet-400 border border-violet-500/20 backdrop-blur-sm">
              <Sparkles className="h-2.5 w-2.5" /> AI
            </span>
          )}
        </div>

        {/* Top-right badges */}
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
          {quiz.reward && quiz.reward.poolAmount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 backdrop-blur-sm">
              <Trophy className="h-2.5 w-2.5" /> {quiz.reward.poolAmount} {quiz.reward.tokenSymbol}
            </span>
          )}
          {isCreator && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(e); }}
              className="p-1.5 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors border border-destructive/20 backdrop-blur-sm"
              title="Delete Quiz"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-3.5 space-y-2.5">
        <div>
          <h3 className="font-bold text-foreground text-sm leading-snug group-hover:text-primary transition-colors line-clamp-2">
            {quiz.title}
          </h3>
          {quiz.description && (
            <p className="text-muted-foreground text-xs mt-0.5 line-clamp-1">{quiz.description}</p>
          )}
        </div>

        <div className="flex items-center gap-2.5 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <BookOpen className="h-3 w-3" /> {quiz.totalQuestions}Q
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            <span className="text-foreground/70 font-semibold">{quiz.playerCount}</span>
            {quiz.maxParticipants > 0 && <span>/{quiz.maxParticipants}</span>}
          </span>
          {quiz.reward && (
            <span className="flex items-center gap-1">
              <Trophy className="h-3 w-3 text-amber-500" /> {quiz.reward.totalWinners}W
            </span>
          )}
          <span className="ml-auto text-[10px] truncate max-w-[80px]">
            {quiz.creatorUsername?.trim() || quiz.creatorAddress.slice(0, 6) + "…"}
          </span>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          <span className="font-mono text-[10px] text-muted-foreground/40 flex items-center gap-1">
            <Hash className="h-2.5 w-2.5" />{quiz.code}
          </span>
          <span className={cn(
            "text-[11px] font-bold flex items-center gap-0.5",
            isFull || isEnded
              ? "text-muted-foreground/40"
              : isLive
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-primary group-hover:text-primary/80"
          )}>
            {ctaLabel}
            <ChevronRight className="h-3 w-3" />
          </span>
        </div>
      </div>

      {isLive && (
        <div className="absolute inset-0 rounded-xl ring-1 ring-emerald-500/20 pointer-events-none" />
      )}
    </button>
  );
}

export default function QuizListPage() {
  const router = useRouter();
  const { address: userWalletAddress } = useWallet();
  const [quizzes, setQuizzes]             = useState<QuizCard[]>([]);
  const [isLoading, setIsLoading]         = useState(true);
  const [isRefreshing, setIsRefreshing]   = useState(false);
  const [searchQuery, setSearchQuery]     = useState("");
  const [statusFilter, setStatusFilter]   = useState<"all" | "waiting" | "active" | "finished">("all");
  const [codeInput, setCodeInput]         = useState("");
  const [isJumping, setIsJumping]         = useState(false);
  const [quizToDelete, setQuizToDelete]   = useState<QuizCard | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting]       = useState(false);
  const [currentPage, setCurrentPage]     = useState(1);
  const [itemsPerPage, setItemsPerPage]   = useState(3);

  useEffect(() => {
    const update = () => setItemsPerPage(window.innerWidth >= 640 ? 8 : 3);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => { setCurrentPage(1); }, [statusFilter, searchQuery, itemsPerPage]);

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
        toast.success("Quiz deleted");
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

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated  = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const liveCount    = quizzes.filter(q => q.status === "active").length;
  const waitingCount = quizzes.filter(q => q.status === "waiting").length;
  const endedCount   = quizzes.filter(q => q.status === "finished").length;
  const totalPlayers = quizzes.reduce((sum, q) => sum + q.playerCount, 0);

  const filterTabs = [
    { key: "all",      label: "All",      count: quizzes.length },
    { key: "active",   label: "Live",     count: liveCount },
    { key: "waiting",  label: "Upcoming", count: waitingCount },
    { key: "finished", label: "Ended",    count: endedCount },
  ] as const;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header pageTitle="Quiz Hub" />

      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 pb-20 space-y-5 pt-6">

        {/* ── Hero ── */}
        <div className="relative rounded-2xl overflow-hidden border border-border bg-card">
          {/* Dot grid texture */}
          <div
            className="absolute inset-0 opacity-[0.025] dark:opacity-[0.04]"
            style={{ backgroundImage: "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)", backgroundSize: "24px 24px" }}
          />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

          <div className="relative p-5 sm:p-8">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">

              {/* Left */}
              <div className="space-y-4 flex-1 min-w-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <Gamepad2 className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-primary font-bold text-xs uppercase tracking-[0.15em]">FaucetDrops Quiz</span>
                </div>

                <div>
                  <h1 className="text-3xl sm:text-4xl font-black text-foreground leading-none tracking-tight">
                    Quiz Hub
                  </h1>
                  <p className="text-muted-foreground text-sm mt-2 max-w-md leading-relaxed">
                    Join live games, compete for token rewards, or host your own trivia battle.
                  </p>
                </div>

                {/* Live stats + mobile create */}
                <div className="flex flex-wrap items-center gap-3 sm:gap-5">
                  {liveCount > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                      <span className="text-emerald-600 dark:text-emerald-400 text-sm font-bold">{liveCount} Live</span>
                    </div>
                  )}
                  {waitingCount > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-primary" />
                      <span className="text-primary text-sm font-bold">{waitingCount} Starting Soon</span>
                    </div>
                  )}
                  {totalPlayers > 0 && (
                    <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
                      <Users className="h-3.5 w-3.5" />
                      <span>{totalPlayers.toLocaleString()} players</span>
                    </div>
                  )}

                  {/* Mobile create — only when wallet connected */}
                  {userWalletAddress && (
                    <Button
                      onClick={() => router.push("/quiz/create-quiz")}
                      size="sm"
                      className="lg:hidden h-8 px-3 text-xs font-bold ml-auto"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Create Quiz
                    </Button>
                  )}
                </div>
              </div>

              {/* Right — code input + desktop create */}
              <div className="w-full lg:w-auto lg:min-w-[280px] space-y-3">
                <p className="text-muted-foreground text-[11px] uppercase font-bold tracking-[0.12em]">Jump to quiz</p>
                <div className="flex gap-2">
                  <Input
                    value={codeInput}
                    onChange={e => setCodeInput(e.target.value.toUpperCase())}
                    onKeyDown={e => e.key === "Enter" && handleJumpToCode()}
                    placeholder="QUIZ CODE"
                    maxLength={8}
                    className="font-mono font-black text-base tracking-[0.2em] h-11 placeholder:text-muted-foreground/30 focus-visible:ring-0"
                  />
                  <Button
                    className="h-11 px-4 font-bold shrink-0"
                    onClick={handleJumpToCode}
                    disabled={isJumping || codeInput.length < 4}
                  >
                    {isJumping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  </Button>
                </div>
                {userWalletAddress && (
                  <Button
                    onClick={() => router.push("/quiz/create-quiz")}
                    variant="outline"
                    className="hidden lg:flex w-full h-10 font-bold text-xs uppercase tracking-widest"
                  >
                    <Plus className="h-4 w-4 mr-2" /> Create a Quiz
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Challenge Arena Banner ── */}
        <div
          className="relative rounded-xl overflow-hidden border border-border bg-card group cursor-pointer hover:border-border/60 transition-colors"
          onClick={() => router.push("/challenge")}
        >
          {/* Left accent bar */}
          <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-amber-400 to-orange-500" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-amber-500/30 via-transparent to-transparent" />

          <div className="pl-6 pr-5 py-5 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                <Swords className="h-5 w-5 text-amber-500 dark:text-amber-400" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest">1v1 Duel</span>
                  <span className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                    Live duels
                  </span>
                </div>
                <p className="text-foreground font-bold text-sm">Challenge a friend. Winner takes the pot.</p>
                <p className="text-muted-foreground text-xs mt-0.5 truncate hidden sm:block">
                  Pick a topic, stake DROPS, race AI-generated questions.
                </p>
              </div>
            </div>

            {/* Steps */}
            <div className="hidden md:flex items-center gap-px">
              {[
                { icon: Sparkles, label: "Create" },
                { icon: Flame, label: "Stake" },
                { icon: Trophy, label: "Win" },
              ].map(({ icon: Icon, label }, idx) => (
                <React.Fragment key={label}>
                  {idx > 0 && <ChevronRight className="h-3 w-3 text-border mx-1" />}
                  <div className="flex flex-col items-center gap-1 px-3">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{label}</span>
                  </div>
                </React.Fragment>
              ))}
            </div>

            <ArrowRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all shrink-0 hidden sm:block" />
          </div>
        </div>

        {/* ── Filter Bar ── */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search title, code, or creator..."
              className="pl-10 h-10 focus-visible:ring-0"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {filterTabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
                  statusFilter === tab.key
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-border/60"
                )}
              >
                {tab.label}
                <span className={cn(
                  "text-[10px] font-mono px-1 py-0.5 rounded",
                  statusFilter === tab.key
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}>
                  {tab.count}
                </span>
              </button>
            ))}

            <button
              onClick={() => fetchQuizzes(true)}
              disabled={isRefreshing}
              className="p-2 rounded-lg bg-card border border-border text-muted-foreground hover:text-foreground transition-all disabled:opacity-30 ml-1"
              title="Refresh"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
            </button>
          </div>
        </div>

        {/* ── Grid ── */}
        {isLoading ? (
          <div className="flex items-center justify-center py-32">
            <Loading />
          </div>
        ) : filtered.length === 0 ? (
          <div className="border border-dashed border-border rounded-xl flex flex-col items-center justify-center py-24 space-y-4 bg-muted/20">
            <Gamepad2 className="h-12 w-12 text-muted-foreground/20" />
            <div className="text-center">
              <h3 className="text-muted-foreground font-bold">No quizzes found</h3>
              <p className="text-muted-foreground/60 text-sm mt-1">
                {searchQuery ? "Try a different search term" : "Be the first to create one!"}
              </p>
            </div>
            {userWalletAddress && (
              <Button onClick={() => router.push("/quiz/create-quiz")}>
                <Plus className="mr-2 h-4 w-4" /> Create Quiz
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {paginated.map((quiz, i) => (
                <div
                  key={quiz.code}
                  className="animate-in fade-in slide-in-from-bottom-2"
                  style={{ animationDelay: `${i * 35}ms`, animationFillMode: "backwards" }}
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

            {/* ── Pagination ── */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-1">
                <p className="text-xs text-muted-foreground">
                  {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, filtered.length)} of {filtered.length}
                </p>

                <div className="flex items-center gap-1">
                  {/* ← Prev */}
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className={cn(pageBtnBase, pageBtnIdle, "gap-1 px-2 w-auto")}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline text-[11px]">Prev</span>
                  </button>

                  {/* Page 1 */}
                  <button
                    onClick={() => setCurrentPage(1)}
                    className={cn(pageBtnBase, currentPage === 1 ? pageBtnActive : pageBtnIdle)}
                  >
                    1
                  </button>

                  {/* Current page (only shown when not first or last) */}
                  {currentPage !== 1 && currentPage !== totalPages && (
                    <button className={cn(pageBtnBase, pageBtnActive)}>
                      {currentPage}
                    </button>
                  )}

                  {/* Last page */}
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    className={cn(pageBtnBase, currentPage === totalPages ? pageBtnActive : pageBtnIdle)}
                  >
                    {totalPages}
                  </button>

                  {/* Next → */}
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className={cn(pageBtnBase, pageBtnIdle, "gap-1 px-2 w-auto")}
                  >
                    <span className="hidden sm:inline text-[11px]">Next</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Delete Modal ── */}
      {quizToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <h3 className="text-base font-black text-foreground">Delete Quiz?</h3>
                <p className="text-sm text-muted-foreground mt-0.5">This cannot be undone.</p>
              </div>
            </div>

            <div className="bg-muted/40 border border-border rounded-xl p-4 mb-5 space-y-3">
              <p className="text-sm text-muted-foreground">
                Type <strong className="text-foreground select-none">{quizToDelete.code}</strong> to confirm
              </p>
              <Input
                value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value.toUpperCase())}
                onPaste={e => { e.preventDefault(); toast.warning("Please type the code."); }}
                placeholder="Type code here..."
                className="h-11 font-mono font-bold text-center tracking-[0.2em] uppercase focus-visible:ring-0 focus-visible:border-destructive placeholder:text-muted-foreground/30"
              />
            </div>

            <div className="flex gap-2.5">
              <Button
                variant="outline"
                className="flex-1 h-10"
                onClick={() => setQuizToDelete(null)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1 h-10 font-bold disabled:opacity-30"
                disabled={deleteConfirmText !== quizToDelete.code || isDeleting}
                onClick={confirmDelete}
              >
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}