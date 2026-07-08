"use client";

import React, {
  useState, useEffect, useRef, useCallback, useMemo,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { useWallet } from "@/hooks/use-wallet";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {makePublicClient,makeWalletClient,toViemChain, getChainConfig, CELO_CHAIN_ID} from "@/lib/chain"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Loader2, Trophy, Zap, Check, X,
  ArrowLeft, Share2, Home, Plus, Users, ShieldCheck,
  MessageSquare, Send, RefreshCw, Clock, AlertTriangle,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Loading from "@/app/loading";
import {
  createWalletClient,
  createPublicClient,
  custom,
  http,
  parseUnits,
  keccak256,
  toBytes,
  type Address,
} from "viem";

import { useSearchParams } from "next/navigation";
import { toast as sonnerToast } from "sonner";
import { RematchPopup, RematchInvite } from "@/components/RematchPopup";


// ── Config ────────────────────────────────────────────────────────────────────

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://conscious-adorne-faucetdrops-fc77a861.koyeb.app";

function getWsBaseUrl(): string {
  if (typeof window === "undefined") return "wss://127.0.0.1:8000";
  return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "ws://127.0.0.1:8000"
    : "wss://conscious-adorne-faucetdrops-fc77a861.koyeb.app";
}

const DROPS_DECIMALS = 18;
const DROPS_SYMBOL   = "DROPS";
const BADGE_THRESHOLD = 10;
const STALE_WINDOW_SECONDS = 5 * 3600; // 5 hours — must match backend

const DROPS_REDEEM_ABI = [
  {
    inputs: [
      { internalType: "uint256", name: "amount",   type: "uint256" },
      { internalType: "string",  name: "rewardId", type: "string"  },
    ],
    name: "redeem",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

// ── Types ─────────────────────────────────────────────────────────────────────

type GamePhase =
  | "loading" | "lobby" | "countdown" | "question"
  | "reveal"  | "round_end" | "game_over";

interface PlayerState {
  walletAddress: string;
  username:      string;
  points:        number;
  ready:         boolean;
  txVerified:    boolean;
  avatarUrl:     string;
}
interface BadgeUnlockedPopupProps {
  onDismiss: () => void;
}
interface QuizOption      { id: string; text: string }
interface CurrentQuestion {
  roundIndex: number; questionIndex: number; totalQuestions: number;
  question: string;   options: QuizOption[]; timeLimit: number; startedAt: number;
}
interface FinalScore { username: string; points: number }

const OPTION_STYLES: Record<string, { bg: string; shape: string; ring: string }> = {
  A: { bg: "bg-red-500 hover:bg-red-600",     shape: "▲", ring: "ring-red-400"   },
  B: { bg: "bg-blue-500 hover:bg-blue-600",   shape: "◆", ring: "ring-blue-400"  },
  C: { bg: "bg-blue-500 hover:bg-blue-600",   shape: "●", ring: "ring-blue-400"  },
  D: { bg: "bg-green-500 hover:bg-green-600", shape: "■", ring: "ring-green-400" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function LinearTimer({ seconds, total }: { seconds: number; total: number }) {
  const pct   = Math.max(0, (seconds / total) * 100);
  const color = pct > 50 ? "bg-green-500" : pct > 25 ? "bg-blue-500" : "bg-red-500";
  return (
    <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 overflow-hidden shrink-0">
      <div className={cn("h-full transition-all duration-300 ease-linear", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

function deriveQuizId(code: string): `0x${string}` { return keccak256(toBytes(code)); }

const CONFETTI_COLORS = ["#FFD700","#FF6B6B","#4ECDC4","#45B7D1","#96CEB4","#FFEAA7"];
function Confetti({ active }: { active: boolean }) {
  const particles = useMemo(() =>
    Array.from({ length: 50 }, (_, i) => ({
      id: i, x: Math.random() * 100, delay: Math.random() * 0.8,
      duration: 2 + Math.random() * 2, size: 6 + Math.random() * 8,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    })), []);
  if (!active) return null;
  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {particles.map(p => (
        <div key={p.id} className="absolute rounded-sm" style={{
          left: `${p.x}%`, top: "-10%", width: p.size, height: p.size,
          backgroundColor: p.color,
          animation: `confettiFall ${p.duration}s ease-in ${p.delay}s forwards`,
        }} />
      ))}
      <style>{`@keyframes confettiFall{0%{transform:translateY(0) rotate(0deg);opacity:1}100%{transform:translateY(110vh) rotate(720deg);opacity:0}}`}</style>
    </div>
  );
}

// ── Passive expiry countdown (NO backend calls until expired) ─────────────────
// createdAt is a unix timestamp (seconds). We just count down locally.
// Only when it hits zero do we call the backend to confirm + cancel.
function BadgeUnlockedPopup({ onDismiss }: BadgeUnlockedPopupProps) {
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div
        className="w-full max-w-sm bg-card border border-border rounded-3xl p-6 text-center space-y-4 shadow-2xl"
        style={{ animation: "badgePopIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)" }}
      >
        <div className="text-6xl">🏆</div>
        <div className="space-y-1">
          <h2 className="text-xl font-black text-foreground">Rematch Badge Earned!</h2>
          <p className="text-sm text-muted-foreground">
            You've played 10 games and unlocked the Rematch Badge.
          </p>
        </div>
        <div className="bg-primary/10 border border-primary/20 rounded-2xl p-3 space-y-1">
          <p className="text-xs font-bold text-primary">What's unlocked:</p>
          <ul className="text-xs text-muted-foreground space-y-0.5 text-left list-disc list-inside">
            <li>Request rematches with past opponents</li>
            <li>Stake above the {10} DROPS limit</li>
            <li>Redeem Reward DROPS for $G</li>
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">
          Keep playing to climb tiers and earn higher APY on your DROPS.
        </p>
        <Button className="w-full h-11 font-bold" onClick={onDismiss}>
          Nice! 🎉
        </Button>
      </div>
      <style>{`@keyframes badgePopIn{0%{opacity:0;transform:scale(0.85) translateY(10px)}100%{opacity:1;transform:scale(1) translateY(0)}}`}</style>
    </div>
  );
}

const BURN_WINDOW_SECONDS = 2 * 3600; // 2 hours — matches QuizHub contract
// Keep STALE_WINDOW_SECONDS = 5 * 3600 for DB cleanup only

function usePassiveExpiry(createdAt: number | null, code: string, phase: GamePhase) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [isExpired,   setIsExpired]   = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const calledRef = useRef(false);

  useEffect(() => {
    if (!createdAt) return;
    // Use burn window (2h) for expiry UI, not the 5h stale window
    const expiresAt = createdAt + BURN_WINDOW_SECONDS;
    const remaining = expiresAt - Math.floor(Date.now() / 1000);
    if (remaining <= 0) {
      setSecondsLeft(0);
      setIsExpired(true);
    } else {
      setSecondsLeft(remaining);
    }
  }, [createdAt]);

  useEffect(() => {
    if (secondsLeft === null || secondsLeft <= 0) return;
    if (["question", "reveal", "round_end", "countdown"].includes(phase)) return;
    const t = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev === null || prev <= 1) {
          setIsExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [secondsLeft, phase]);

  const cancelExpired = useCallback(async (walletAddress: string) => {
    if (calledRef.current || isCancelling) return;
    calledRef.current = true;
    setIsCancelling(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/challenge/${code}/cancel-expired`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress }),
      });
      const d = await res.json();
      if (d.success) {
        toast.error("Challenge expired — any staked DROPS have been refunded.");
      }
    } catch {
    } finally {
      setIsCancelling(false);
    }
  }, [code, isCancelling]);

  return { secondsLeft, isExpired, isCancelling, cancelExpired };
}

// ── Expiry Banner (pure countdown display, no polling) ─────────────────────

function ExpiryBanner({
  secondsLeft,
  isExpired,
  isCancelling,
  onCancel,
  players,
  userWalletAddress,
  compact = false,
}: {
  secondsLeft: number | null;
  isExpired: boolean;
  isCancelling: boolean;
  onCancel: () => void;
  players: PlayerState[];
  userWalletAddress?: string | null;
  compact?: boolean;
}) {
  if (secondsLeft === null) return null;

  

  const hrs  = Math.floor(secondsLeft / 3600);
  const mins = Math.floor((secondsLeft % 3600) / 60);
  const secs = secondsLeft % 60;
  const timeStr = hrs > 0
    ? `${hrs}h ${mins}m`
    : mins > 0
    ? `${mins}m ${secs}s`
    : `${secs}s`;

  const p1 = players[0];
  const p2 = players[1];

  // In ExpiryBanner compact mode, color based on 2h window
const urgency = isExpired ? "expired"
  : secondsLeft < 600  ? "critical"   // under 10 min
  : secondsLeft < 1800 ? "warning"    // under 30 min
  : "ok";

if (compact) {
  return (
    <div className={cn(
      "flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-black tabular-nums",
      urgency === "expired" || urgency === "critical"
        ? "border-red-400/50 bg-red-500/10 text-red-500"
        : urgency === "warning"
        ? "border-amber-400/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
        : "border-border bg-muted/30 text-muted-foreground",
    )}>
      <Clock className="h-3 w-3 shrink-0" />
      {isExpired ? "Expired" : timeStr}
    </div>
  );
}

  return (
    <div className={cn(
      "rounded-2xl border p-4 space-y-3",
      isExpired
        ? "bg-red-50 dark:bg-red-950/20 border-red-300 dark:border-red-800"
        : "bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800",
    )}>
      <div className="flex items-center gap-2">
        <AlertTriangle className={cn("h-4 w-4 shrink-0", isExpired ? "text-red-500" : "text-amber-500")} />
        <p className={cn("font-black text-sm", isExpired ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400")}>
          {isExpired ? "Challenge expired" : `Expires in ${timeStr}`}
        </p>
      </div>

      {/* Stake dots */}
      <div className="flex gap-3">
        {[p1, p2].map((p, i) => {
          if (!p && i === 1) return (
            <div key="empty" className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-muted-foreground/20" />
              Waiting for P2
            </div>
          );
          if (!p) return null;
          const isMe = p.walletAddress.toLowerCase() === userWalletAddress?.toLowerCase();
          return (
            <div key={p.walletAddress} className="flex items-center gap-1.5 text-xs">
              <div className={cn(
                "w-2 h-2 rounded-full",
                p.txVerified ? "bg-emerald-500" : "bg-amber-400",
              )} />
              <span className={cn("font-bold", isMe && "text-primary")}>
                {p.username}{isMe ? " (you)" : ""}
              </span>
              <span className="text-muted-foreground">
                {p.txVerified ? "✓ staked" : "not staked"}
              </span>
            </div>
          );
        })}
      </div>

      {isExpired && (
        <Button
          size="sm"
          variant="destructive"
          className="w-full h-9 font-bold"
          onClick={onCancel}
          disabled={isCancelling}
        >
          {isCancelling
            ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Cancelling…</>
            : "Cancel & Refund Stakes"
          }
        </Button>
      )}

      {!isExpired && (
        <p className="text-[10px] text-amber-600 dark:text-amber-500">
          Both players must stake before the timer runs out or the challenge is cancelled.
        </p>
      )}
    </div>
  );
}

// ── Rematch helpers ───────────────────────────────────────────────────────────

export async function sendRematchInvite(params: {
  code: string; userWalletAddress: string;
  setRematchPending: (v: boolean) => void;
  setRematchCountdown: React.Dispatch<React.SetStateAction<number | null>>;
  rematchTimerRef: React.MutableRefObject<ReturnType<typeof setInterval> | null>;
  rematchTimeoutRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
}) {
  const { code, userWalletAddress, setRematchPending, setRematchCountdown, rematchTimerRef, rematchTimeoutRef } = params;
  if (!userWalletAddress) return;
  try {
    const res = await fetch(`${API_BASE_URL}/api/challenge/${code}/rematch-invite`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requesterWallet: userWalletAddress }),
    });
    const d = await res.json();
    if (!d.success) throw new Error(d.detail ?? "Could not send invite");
    setRematchPending(true);
    sonnerToast.info("Rematch invite sent — waiting for opponent…");
    const TIMEOUT = 30;
    setRematchCountdown(TIMEOUT);
    rematchTimerRef.current = setInterval(() => {
      setRematchCountdown(prev => {
        if (prev === null || prev <= 1) { clearInterval(rematchTimerRef.current!); rematchTimerRef.current = null; return 0; }
        return prev - 1;
      });
    }, 1000);
    rematchTimeoutRef.current = setTimeout(() => {
      setRematchPending(false); setRematchCountdown(null);
      sonnerToast.info("Rematch request timed out.");
    }, (TIMEOUT + 1) * 1000);
  } catch (err: any) {
    sonnerToast.error(err?.message ?? "Could not send rematch invite");
  }
}

// ── FloatingChat ──────────────────────────────────────────────────────────────

interface FloatingChatProps {
  messages: any[]; myWallet: string; chatInput: string;
  setChatInput: (v: string) => void; onSend: () => void;
  chatBottomRef: React.RefObject<HTMLDivElement | null>; unreadCount: number;
}

function FloatingChat({ messages, myWallet, chatInput, setChatInput, onSend, chatBottomRef, unreadCount }: FloatingChatProps) {
  const [isOpen, setIsOpen]           = useState(false);
  const [localUnread, setLocalUnread] = useState(0);
  useEffect(() => { if (!isOpen) setLocalUnread(unreadCount); }, [unreadCount, isOpen]);

  return (
    <div className="fixed bottom-6 right-6 z-[200] flex flex-col items-end gap-3">
      {isOpen && (
        <div
          className="w-[calc(100vw-48px)] sm:w-80 flex flex-col bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
          style={{ height: "min(400px, 60vh)", animation: "slideUpFade 0.2s ease-out" }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30 shrink-0">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <p className="font-bold text-sm text-foreground">Lobby Chat</p>
            </div>
            <button onClick={() => setIsOpen(false)} className="w-6 h-6 rounded-full hover:bg-muted flex items-center justify-center transition-colors">
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
                <MessageSquare className="h-8 w-8 text-muted-foreground/20" />
                <p className="text-muted-foreground text-xs">No messages yet. Say hi!</p>
              </div>
            ) : messages.map((m, i) => {
              const isMe = m.wallet?.toLowerCase() === myWallet;
              return (
                <div key={i} className={cn("flex flex-col gap-0.5", isMe ? "items-end" : "items-start")}>
                  {!isMe && <span className="text-[10px] text-muted-foreground px-1 font-semibold">{m.sender}</span>}
                  <div className={cn(
                    "px-3 py-2 rounded-2xl text-xs max-w-[85%] break-words leading-relaxed",
                    isMe ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-muted text-foreground rounded-tl-sm"
                  )}>{m.text}</div>
                </div>
              );
            })}
            <div ref={chatBottomRef} />
          </div>
          <form
            onSubmit={e => { e.preventDefault(); onSend(); }}
            className="flex gap-2 px-3 py-3 border-t border-border shrink-0"
          >
            <input
              type="text" value={chatInput} onChange={e => setChatInput(e.target.value)}
              placeholder="Say something…" maxLength={200}
              className="flex-1 bg-muted/50 border border-border rounded-xl px-3 py-2 text-xs text-foreground outline-none focus:border-primary/50 transition-colors"
            />
            <button
              type="submit" disabled={!chatInput.trim()}
              className="w-8 h-8 rounded-xl bg-primary disabled:bg-muted/50 disabled:text-muted-foreground text-primary-foreground flex items-center justify-center transition-all active:scale-95 shrink-0"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      )}
      <button
        onClick={() => { if (isOpen) setIsOpen(false); else { setIsOpen(true); setLocalUnread(0); } }}
        className={cn(
          "relative w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95",
          isOpen ? "bg-muted text-foreground border border-border" : "bg-primary text-primary-foreground"
        )}
      >
        {isOpen ? <X className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
        {!isOpen && localUnread > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black w-5 h-5 rounded-full border-2 border-background flex items-center justify-center">
            {localUnread > 9 ? "9+" : localUnread}
          </span>
        )}
      </button>
      <style>{`@keyframes slideUpFade{from{opacity:0;transform:translateY(12px) scale(0.97)}to{opacity:1;transform:translateY(0) scale(1)}}`}</style>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ChallengePage() {
  const params  = useParams();
  const router  = useRouter();
  const code    = ((params.code as string) ?? "").toUpperCase();
  const { address: userWalletAddress, getActiveSigner, ensureCorrectNetwork } = useWallet();
  const chainCfg = getChainConfig();
  const myWallet = useMemo(() => userWalletAddress?.toLowerCase() ?? "", [userWalletAddress]);
  const searchParams     = useSearchParams();
  const agreedStake      = searchParams.get("stake");
  const cameFromPreLobby = searchParams.get("agreed") === "1";

  // ── Core state ────────────────────────────────────────────────────────────
  const [phase, setPhase]         = useState<GamePhase>("loading");
  const [challenge, setChallenge] = useState<any>(null);
  const [players, setPlayers]     = useState<PlayerState[]>([]);
  const [username, setUsername]   = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [hasJoined, setHasJoined] = useState(false);
  const [isCreator, setIsCreator] = useState(false);
  const [claimedCodes, setClaimedCodes] = useState<Set<string>>(new Set());
  const DROPS_ADDRESS = chainCfg.contracts.dropsToken;
  // ── Passive expiry (createdAt from challenge load, no backend polling) ────
  const [createdAt, setCreatedAt] = useState<number | null>(null);
  const expiry = usePassiveExpiry(createdAt, code, phase);
  const [showBadgeUnlocked, setShowBadgeUnlocked] = useState(false);
  const badgeUnlockShownRef = useRef(false);
  // ── Staking state ─────────────────────────────────────────────────────────
  const [isStaking, setIsStaking]           = useState(false);
  const [stakeTxHash, setStakeTxHash]       = useState<string | null>(null);
  const [stakeVerifying, setStakeVerifying] = useState(false);
  const [isSyncing, setIsSyncing]           = useState(false);
  const [isRefreshing, setIsRefreshing]     = useState(false);

  // ── Game state ─────────────────────────────────────────────────────────────
  const [countdownVal, setCountdownVal]         = useState(3);
  const [currentQ, setCurrentQ]                 = useState<CurrentQuestion | null>(null);
  const [selectedId, setSelectedId]             = useState<string | null>(null);
  const [hasSubmitted, setHasSubmitted]         = useState(false);
  const [timeLeft, setTimeLeft]                 = useState(0);
  const [revealCorrectId, setRevealCorrectId]   = useState<string | null>(null);
  const [questionScores, setQuestionScores]     = useState<Record<string, number>>({});
  const [totalScores, setTotalScores]           = useState<Record<string, number>>({});
  const [currentRoundName, setCurrentRoundName] = useState("");
  const [roundScores, setRoundScores]           = useState<Record<string, number>>({});
  const [finalScores, setFinalScores]           = useState<Record<string, FinalScore>>({});
  const [gameOutcome, setGameOutcome]           = useState<"winner" | "tie" | null>(null);
  const [winner, setWinner]                     = useState<string | null>(null);
  const [showConfetti, setShowConfetti]         = useState(false);
  const [canRematch, setCanRematch]             = useState(false);

  // ── Badge / rematch eligibility ────────────────────────────────────────────
  const [myTotalDuels, setMyTotalDuels]             = useState<number>(0);
  const [opponentTotalDuels, setOpponentTotalDuels] = useState<number | null>(null);
  const [opponentWallet, setOpponentWallet]         = useState<string | null>(null);

  // ── Claim ──────────────────────────────────────────────────────────────────
  const [pendingClaims, setPendingClaims] = useState<any[]>([]);
  const [isClaiming, setIsClaiming]       = useState(false);

  // ── Chat ───────────────────────────────────────────────────────────────────
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput]       = useState("");
  const [unreadCount, setUnreadCount]   = useState(0);
  const chatBottomRef                   = useRef<HTMLDivElement>(null);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const timerRef          = useRef<ReturnType<typeof setInterval> | null>(null);
  const cdIntervalRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const wsRef             = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const joinCalledRef     = useRef(false);

  const [rematchInvite, setRematchInvite]             = useState<RematchInvite | null>(null);
  const [isRequestingRematch, setIsRequestingRematch] = useState(false);
  const [rematchPending, setRematchPending]           = useState(false);
  const [inviteCountdown, setInviteCountdown]         = useState<number | null>(null);
  const inviteTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const [rematchCountdown, setRematchCountdown]       = useState<number | null>(null);
  const rematchTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const rematchTimeoutRef = useRef<ReturnType<typeof setTimeout>  | null>(null);

  // ── Derived ────────────────────────────────────────────────────────────────
  const myPlayerEntry = players.find(p => p.walletAddress.toLowerCase() === myWallet);
  const myTxVerified  = myPlayerEntry?.txVerified ?? false;
  const myReady       = myPlayerEntry?.ready ?? false;
  const displayStake  = agreedStake ?? challenge?.stake;

  // ── Rematch eligibility ───────────────────────────────────────────────────
  const myBadgeEarned       = myTotalDuels >= BADGE_THRESHOLD;
  const opponentBadgeEarned = opponentTotalDuels === null || opponentTotalDuels >= BADGE_THRESHOLD;
  const rematchAllowed      = canRematch && myBadgeEarned && opponentBadgeEarned;

  const rematchLockReason: string | null = (() => {
    if (!canRematch) return null;
    if (!myBadgeEarned)
      return `Play ${BADGE_THRESHOLD - myTotalDuels} more game${BADGE_THRESHOLD - myTotalDuels !== 1 ? "s" : ""} to unlock rematches.`;
    if (!opponentBadgeEarned && opponentTotalDuels !== null)
      return "Your opponent hasn't earned their Rematch Badge yet.";
    return null;
  })();

  const clearRematchTimers = useCallback(() => {
    if (rematchTimerRef.current)   clearInterval(rematchTimerRef.current);
    if (rematchTimeoutRef.current) clearTimeout(rematchTimeoutRef.current);
    rematchTimerRef.current   = null;
    rematchTimeoutRef.current = null;
  }, []);

  const sendWhenReady = useCallback((payload: object) => {
    const ws = wsRef.current;
    if (!ws) return;
    if (ws.readyState === WebSocket.OPEN) { ws.send(JSON.stringify(payload)); }
    else if (ws.readyState === WebSocket.CONNECTING) {
      const onOpen = () => { ws.send(JSON.stringify(payload)); ws.removeEventListener("open", onOpen); };
      ws.addEventListener("open", onOpen);
    }
  }, []);

  useEffect(() => () => { if (inviteTimerRef.current) clearInterval(inviteTimerRef.current); }, []);
  useEffect(() => () => clearRematchTimers(), [clearRematchTimers]);
  useEffect(() => () => { if (cdIntervalRef.current) clearInterval(cdIntervalRef.current); }, []);

  // ── Profile ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userWalletAddress) return;
    fetch(`${API_BASE_URL}/api/players/${userWalletAddress}`)
      .then(r => r.json())
      .then(d => {
        setUsername(d.username ?? `User${userWalletAddress.slice(-4).toUpperCase()}`);
        setAvatarUrl(d.avatar_url ?? "");
      })
      .catch(() => setUsername(`User${userWalletAddress.slice(-4).toUpperCase()}`));
  }, [userWalletAddress]);

  // ── Load challenge ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!code) return;
    fetch(`${API_BASE_URL}/api/challenge/${code}`)
      .then(r => r.json())
      .then(d => {
        if (!d.success) { toast.error("Challenge not found"); router.push("/challenge"); return; }
        setChallenge(d.challenge);

        // Extract createdAt for passive countdown — no RPC needed
        const raw = d.challenge.created_at ?? d.challenge.createdAt ?? null;
        if (raw) {
          const ts = typeof raw === "number" ? raw : Math.floor(new Date(raw).getTime() / 1000);
          setCreatedAt(ts);
        }

        const entries: PlayerState[] = Object.entries(d.challenge.players ?? {}).map(
          ([wallet, data]: [string, any]) => ({
            walletAddress: wallet, username: data.username, points: data.points,
            ready: data.ready, txVerified: data.txVerified, avatarUrl: data.avatar_url ?? "",
          })
        );
        setPlayers(entries);
        const amCreator = userWalletAddress && d.challenge.creator?.toLowerCase() === userWalletAddress.toLowerCase();
        const alreadyIn = userWalletAddress && Object.keys(d.challenge.players ?? {}).some((w: string) => w.toLowerCase() === userWalletAddress.toLowerCase());
        if (amCreator)      { setIsCreator(true); setHasJoined(true); }
        else if (alreadyIn) { setHasJoined(true); }
        if      (d.challenge.status === "active")   setPhase("question");
        else if (d.challenge.status === "finished") {
          setPhase("game_over");
          const hydratedScores: Record<string, FinalScore> = {};
          Object.entries(d.challenge.players ?? {}).forEach(([wallet, data]: [string, any]) => {
            hydratedScores[wallet] = { username: data.username, points: data.points ?? 0 };
          });
          setFinalScores(hydratedScores);
          const c = d.challenge;
          const rawWinner = c.winner ?? c.winner_address ?? c.winnerAddress ?? null;
          const derivedWinner = (() => {
            if (rawWinner) return rawWinner;
            const sorted = Object.entries(c.players ?? {}).sort(([, a]: any, [, b]: any) => (b.points ?? 0) - (a.points ?? 0)) as any[];
            if (sorted.length < 2) return null;
            return (sorted[0][1].points ?? 0) === (sorted[1][1].points ?? 0) ? null : sorted[0][0];
          })();
          setWinner(derivedWinner);
          setGameOutcome(derivedWinner ? "winner" : "tie");
          setCanRematch(!!c.canRematch);
        }
        else setPhase("lobby");
      })
      .catch(() => toast.error("Failed to load challenge"));
  }, [code, userWalletAddress, router]);

  useEffect(() => {
    if (cameFromPreLobby && agreedStake && userWalletAddress && !hasJoined) setHasJoined(true);
  }, [cameFromPreLobby, agreedStake, userWalletAddress, hasJoined]);

  useEffect(() => {
    if (!cameFromPreLobby || !agreedStake || !userWalletAddress || !challenge || !username) return;
    if (joinCalledRef.current) return;
    if (challenge.creator?.toLowerCase() === userWalletAddress.toLowerCase()) return;
    joinCalledRef.current = true;
    fetch(`${API_BASE_URL}/api/challenge/${code}/join`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress: userWalletAddress, username, txHash: "pre-lobby-agreed" }),
    })
      .then(r => r.json())
      .then(d => {
        setPlayers(prev => {
          if (prev.some(p => p.walletAddress.toLowerCase() === userWalletAddress.toLowerCase())) return prev;
          return [...prev, { walletAddress: userWalletAddress, username, points: 0, ready: false, txVerified: false, avatarUrl: avatarUrl ?? "" }];
        });
        if (d.success) toast.info(`Stake agreed at ${agreedStake} ${DROPS_SYMBOL} — approve the transaction to stake it!`);
      })
      .catch(console.error);
  }, [cameFromPreLobby, agreedStake, userWalletAddress, challenge, code, username]);

  // ── Pending claims + badge data on game over ───────────────────────────────
  // ── New state, alongside other badge/rematch state ──────────────────────

// ── Pending claims + badge data on game over ───────────────────────────────
useEffect(() => {
  if (phase !== "game_over" || !myWallet) return;

  fetch(`${API_BASE_URL}/api/challenge/${myWallet}/pending-claims`)
    .then(r => r.json())
    .then(d => { if (d.success) setPendingClaims(d.claims ?? []); })
    .catch(() => {});

  fetch(`${API_BASE_URL}/api/players/${myWallet}`)
    .then(r => r.json())
    .then(d => {
      const newTotalDuels = d.total_duels ?? 0;
      setMyTotalDuels(newTotalDuels);

      // ── Fire the milestone popup exactly when this game was the 10th ──
      // Checking === BADGE_THRESHOLD (not >=) ensures it only fires once,
      // on the game that pushed them to exactly 10 — not on every game
      // thereafter where total_duels stays >= 10.
      if (newTotalDuels === BADGE_THRESHOLD && !badgeUnlockShownRef.current) {
        badgeUnlockShownRef.current = true;
        setShowBadgeUnlocked(true);
      }
    })
    .catch(() => {});

  const opponentW = Object.keys(finalScores).find(w => w.toLowerCase() !== myWallet) ?? null;
  setOpponentWallet(opponentW);

  if (opponentW) {
    fetch(`${API_BASE_URL}/api/players/${opponentW}`)
      .then(r => r.json())
      .then(d => setOpponentTotalDuels(d.total_duels ?? 0))
      .catch(() => {});
  }
}, [phase, myWallet, finalScores]);

  const handleInviteDismiss = useCallback(() => {
    if (inviteTimerRef.current) clearInterval(inviteTimerRef.current);
    inviteTimerRef.current = null;
    setInviteCountdown(null);
    setRematchInvite(null);
  }, []);

  const startTimer = useCallback((startedAt: number, limit: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    const tick = () => {
      const rem = Math.max(0, limit - (Date.now() - startedAt) / 1000);
      setTimeLeft(rem);
      if (rem <= 0 && timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    };
    tick();
    timerRef.current = setInterval(tick, 200);
  }, []);

  const sendStakeConfirmed = useCallback((txHash: string) => {
    if (!userWalletAddress) return;
    setStakeTxHash(txHash);
    setStakeVerifying(true);
    sendWhenReady({ type: "stake_confirmed", walletAddress: userWalletAddress, txHash });
  }, [userWalletAddress, sendWhenReady]);

  const handleReady = useCallback(() => {
  if (!userWalletAddress) return;
  sendWhenReady({ type: "ready", walletAddress: userWalletAddress });
  setPlayers(prev => prev.map(p =>
    p.walletAddress.toLowerCase() === myWallet ? { ...p, ready: true } : p
  ));
}, [userWalletAddress, myWallet, sendWhenReady]);

  // ── WS refs ───────────────────────────────────────────────────────────────
  const usernameRef = useRef(username);
  const myWalletRef = useRef(myWallet);
  useEffect(() => { usernameRef.current = username; }, [username]);
  useEffect(() => { myWalletRef.current = myWallet; }, [myWallet]);

  // ── WebSocket ──────────────────────────────────────────────────────────────
  const connectWS = useCallback(() => {
    if (!code || !userWalletAddress) return;
    if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) return;
    const ws = new WebSocket(`${getWsBaseUrl()}/ws/challenge/${code}`);
    wsRef.current = ws;
    ws.onopen = () => {
      reconnectAttempts.current = 0;
      if (userWalletAddress) ws.send(JSON.stringify({ type: "rejoin", walletAddress: userWalletAddress, code }));
    };
    ws.onmessage = async (ev) => {
      let msg: any;
      try { msg = JSON.parse(ev.data); } catch { return; }
      const currentMyWallet = myWalletRef.current;
      const currentUsername = usernameRef.current;
      switch (msg.type) {
        case "state_sync": {
          const c = msg.challenge;
          setChallenge(c);
          // Refresh createdAt if available in sync
          const raw = c.created_at ?? c.createdAt ?? null;
          if (raw && !createdAt) {
            const ts = typeof raw === "number" ? raw : Math.floor(new Date(raw).getTime() / 1000);
            setCreatedAt(ts);
          }
          setPlayers(prev => {
            const incoming: PlayerState[] = Object.entries(c.players ?? {}).map(([w, d]: [string, any]) => ({
              walletAddress: w, username: d.username, points: d.points, ready: d.ready,
              txVerified: d.txVerified, avatarUrl: d.avatar_url ?? "",
            }));
            if (prev.length === 0) return incoming;
            return incoming.map(newP => {
              const existing = prev.find(p => p.walletAddress.toLowerCase() === newP.walletAddress.toLowerCase());
              return existing ? { ...newP, txVerified: newP.txVerified || existing.txVerified } : newP;
            });
          });
          if (c.status === "active") setPhase(p => p === "lobby" ? "question" : p);
          break;
        }
        case "player_joined": {
          const p = msg.player;
          setPlayers(prev => {
            if (prev.some(e => e.walletAddress === p.walletAddress)) return prev;
            return [...prev, { walletAddress: p.walletAddress, username: p.username, points: 0, ready: false, txVerified: false, avatarUrl: p.avatar_url ?? "" }];
          });
          toast.info(`${p.username} joined the lobby!`);
          break;
        }
        case "stake_verified": {
          const wallet = msg.wallet.toLowerCase();
          setPlayers(prev => {
            const exists = prev.some(p => p.walletAddress.toLowerCase() === wallet);
            if (!exists) return [...prev, { walletAddress: wallet, username: currentUsername, points: 0, ready: false, txVerified: true, avatarUrl: msg.avatar_url ?? "" }];
            return prev.map(p => p.walletAddress.toLowerCase() === wallet ? { ...p, txVerified: true } : p);
          });
          if (wallet === currentMyWallet) { setStakeVerifying(false); toast.success("Stake verified ✓ — click Ready!"); }
          break;
        }
        case "stake_failed": {
          if (msg.wallet.toLowerCase() === currentMyWallet) { setStakeVerifying(false); toast.error("On-chain stake verification failed. Please retry."); }
          break;
        }
        case "player_ready":
          setPlayers(prev => prev.map(p => p.walletAddress.toLowerCase() === msg.wallet.toLowerCase() ? { ...p, ready: true } : p));
          break;
        case "game_start":
          toast.success(msg.message || "Game starting!");
          break;
        case "round_announce": {
          if (cdIntervalRef.current) { clearInterval(cdIntervalRef.current); cdIntervalRef.current = null; }
          setCurrentRoundName(msg.round); setPhase("countdown"); setCountdownVal(3);
          cdIntervalRef.current = setInterval(() => setCountdownVal(prev => {
            if (prev <= 1) { clearInterval(cdIntervalRef.current!); cdIntervalRef.current = null; return prev; }
            return prev - 1;
          }), 1000);
          break;
        }
        case "question": {
          if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
          if (cdIntervalRef.current) { clearInterval(cdIntervalRef.current); cdIntervalRef.current = null; }
          const localStart = Date.now();
          setCurrentQ({
            roundIndex: msg.roundIndex, questionIndex: msg.questionIndex,
            totalQuestions: msg.totalQuestions, question: msg.data.question,
            options: msg.data.options, timeLimit: msg.data.timeLimit, startedAt: localStart,
          });
          setSelectedId(null); setHasSubmitted(false); setRevealCorrectId(null); setQuestionScores({});
          setPhase("question"); startTimer(localStart, msg.data.timeLimit);
          break;
        }
        case "question_end": {
          if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
          setTimeLeft(0); setRevealCorrectId(msg.correctId);
          setQuestionScores(msg.questionScores ?? {}); setTotalScores(msg.totalScores ?? {});
          setPlayers(prev => prev.map(p => ({ ...p, points: msg.totalScores?.[p.walletAddress] ?? p.points })));
          setPhase("reveal");
          break;
        }
        case "reconnect_countdown": {
          if (msg.wallet?.toLowerCase() !== currentMyWallet)
            toast.warning(
              msg.secondsLeft > 0
                ? `Opponent disconnected — ${msg.secondsLeft}s to reconnect or you win by forfeit`
                : "Opponent ran out of time — awarding forfeit…",
              { id: "reconnect-countdown", duration: 4000 }
            );
          break;
        }
        case "player_rejoined": {
          if (msg.wallet?.toLowerCase() !== currentMyWallet)
            toast.success(`${msg.username} reconnected!`, { id: "reconnect-countdown" });
          break;
        }
        case "round_end": setRoundScores(msg.scores ?? {}); setPhase("round_end"); break;
        case "game_over": {
          setFinalScores(msg.finalScores ?? {}); setGameOutcome(msg.outcome);
          setWinner(msg.winner ?? null); setCanRematch(!!msg.canRematch); setPhase("game_over");
          if (msg.winner === currentMyWallet) { setShowConfetti(true); setTimeout(() => setShowConfetti(false), 6000); }
          break;
        }
        case "challenge_expired": {
          toast.error("Challenge expired — any staked DROPS have been refunded.");
          router.push("/challenge");
          break;
        }
        case "rematch_declined":
          clearRematchTimers(); setRematchPending(false); setRematchCountdown(null);
          toast.error(`${msg.declinerName ?? "Opponent"} declined the rematch.`);
          break;
        case "rematch_timeout":
          clearRematchTimers(); setRematchPending(false); setRematchCountdown(null);
          if (msg.requesterWallet?.toLowerCase() === currentMyWallet) toast.info("Rematch request expired — opponent didn't respond.");
          break;
        case "player_left":
          clearRematchTimers(); setRematchPending(false); setRematchCountdown(null); setRematchInvite(null);
          toast.error(`${msg.username ?? "Opponent"} has left the game.`);
          break;
        case "chat":
          setChatMessages(prev => [...prev, msg]); setUnreadCount(prev => prev + 1);
          break;
        case "rematch_invite": {
          if (msg.requesterWallet?.toLowerCase() !== currentMyWallet) {
            setRematchInvite({
              originalCode: msg.originalCode, topic: msg.topic, stakeAmount: msg.stakeAmount,
              tokenSymbol: msg.tokenSymbol, requesterWallet: msg.requesterWallet, requesterName: msg.requesterName,
            });
            setInviteCountdown(30);
            if (inviteTimerRef.current) clearInterval(inviteTimerRef.current);
            inviteTimerRef.current = setInterval(() => setInviteCountdown(prev => {
              if (prev === null || prev <= 1) { clearInterval(inviteTimerRef.current!); inviteTimerRef.current = null; setRematchInvite(null); return null; }
              return prev - 1;
            }), 1000);
          }
          break;
        }
        case "rematch_invite_accepted": {
          if (msg.acceptorWallet?.toLowerCase() !== currentMyWallet) {
            clearRematchTimers(); setRematchPending(false); setRematchCountdown(null);
            toast.success(`${msg.acceptorName} accepted! Creating the challenge…`);
          }
          break;
        }
        case "rematch_ready": {
          if (msg.requesterWallet?.toLowerCase() !== currentMyWallet) {
            toast.success("Rematch ready! Heading to pre-lobby…");
            router.push(`/challenge/${msg.newCode}/pre-lobby`);
          }
          break;
        }
      }
    };
    ws.onclose = (ev) => {
      // 1000 = normal close, 1001 = going away, 1008 = policy violation — don't retry
      if ([1000, 1001, 1008].includes(ev.code)) return;
      if (reconnectAttempts.current >= 5) { toast.error("Connection lost. Refresh."); return; }
      reconnectAttempts.current += 1;
      setTimeout(() => { if (wsRef.current?.readyState !== WebSocket.OPEN) connectWS(); }, 2000 * reconnectAttempts.current);
    };
  }, [code, userWalletAddress, startTimer, clearRematchTimers, createdAt]);

  useEffect(() => {
    if (!userWalletAddress) return;
    connectWS();
    return () => { wsRef.current?.close(1000); wsRef.current = null; };
  }, [userWalletAddress, connectWS]);

  useEffect(() => { chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

  // ── Handle expiry when timer hits zero in lobby ───────────────────────────
  useEffect(() => {
    if (expiry.isExpired && phase === "lobby" && userWalletAddress) {
      expiry.cancelExpired(userWalletAddress);
    }
  }, [expiry.isExpired, phase, userWalletAddress]);

  // ── Actions ────────────────────────────────────────────────────────────────

  
  const handleSelectAnswer = useCallback((optId: string) => {
    if (!currentQ || timeLeft <= 0 || phase === "reveal") return;
    wsRef.current?.send(JSON.stringify({
      type: "submit_answer", walletAddress: userWalletAddress,
      roundIndex: currentQ.roundIndex, questionIndex: currentQ.questionIndex,
      answerId: optId, timeTaken: currentQ.timeLimit - timeLeft,
    }));
    setSelectedId(optId);
    setHasSubmitted(true);
  }, [currentQ, timeLeft, phase, userWalletAddress]);

  const handleSendChat = useCallback(() => {
    const text = chatInput.trim();
    if (!text || wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: "chat", walletAddress: userWalletAddress, username, text }));
    setChatInput("");
  }, [chatInput, userWalletAddress, username]);

  // ─── PASTE THIS into app/challenge/[code]/page.tsx ───────────────────────────
// Replaces: the entire handleStake useCallback
// Also add these imports at the top of the file:
//   import { ensureChainNetwork, makeWalletClient, makePublicClient, toViemChain } from "@/lib/chain-utils";
// And REMOVE: import { celo } from "viem/chains";
// And REMOVE: the standalone ensureCeloNetwork() helper function
// ─────────────────────────────────────────────────────────────────────────────

const handleStake = useCallback(async () => {
    if (!userWalletAddress || !challenge) return;
    setIsStaking(true);
    const DROPS_ADDRESS = chainCfg.contracts.dropsToken;
    

    try {
      const stakeAmt = agreedStake ? parseFloat(agreedStake) : challenge.stake;
      toast.info(`Staking ${stakeAmt} DROPS — confirm in your wallet…`);

      const switched = await ensureCorrectNetwork();
      if (!switched) throw new Error("Please connect your wallet first.");

      const activeSigner = await getActiveSigner();
      if (!activeSigner) throw new Error("No wallet available. Please reconnect.");
      const { ethers } = await import("ethers");
      const dropsIface = new ethers.Interface([
       "function redeem(uint256 amount, string rewardId)",
     ]);
     const stakeWei = ethers.parseUnits(stakeAmt.toString(), DROPS_DECIMALS);
     const data     = dropsIface.encodeFunctionData("redeem", [stakeWei, code]);
     const tx       = await activeSigner.sendTransaction({ to: DROPS_ADDRESS, data });
     const receipt  = await tx.wait();
     const txHash   = receipt!.hash;

      

      // ── Tx confirmed on-chain — this IS the stake. Trust it now. ──────────
      // Optimistically flip local state so the Ready button appears
      // immediately, instead of waiting on the backend round-trip.
      setPlayers(prev => {
        const already = prev.some(p => p.walletAddress.toLowerCase() === myWallet);
        if (!already) {
          return [...prev, {
            walletAddress: userWalletAddress, username, points: 0,
            ready: false, txVerified: true, avatarUrl: avatarUrl ?? "",
          }];
        }
        return prev.map(p =>
          p.walletAddress.toLowerCase() === myWallet ? { ...p, txVerified: true } : p
        );
      });
      toast.success("DROPS staked! Click Ready to start.");

      // ── Join (if not already in lobby) — still awaited, needed so the
      // backend has a player row at all before we call confirm-burn. ───────
      if (!hasJoined) {
        const res = await fetch(`${API_BASE_URL}/api/challenge/${code}/join`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            walletAddress: userWalletAddress,
            username,
            txHash,
            
          }),
        });
        const d = await res.json();
        if (!d.success) throw new Error(d.detail ?? "Join failed");
        setHasJoined(true);
      }

      // ── Confirm burn on backend — fire in the background. Don't block
      // or gate the UI on this; it's bookkeeping (deduct game_drops,
      // flip server-side txVerified, register on-chain), not a prerequisite
      // for the user to proceed. Retry silently via sync-stake if it fails. ──
      fetch(`${API_BASE_URL}/api/challenge/${code}/confirm-burn`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: userWalletAddress,
          txHash,
          success: true,
        }),
      })
        .then(r => r.json())
        .then(burnData => {
          if (!burnData.success && !burnData.alreadyVerified) {
            console.warn("confirm-burn failed, falling back to sync-stake:", burnData);
            // quiet retry — no toast, no UI interruption
            fetch(`${API_BASE_URL}/api/challenge/${code}/sync-stake`, {
              method:  "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ walletAddress: userWalletAddress }),
            }).catch(() => {});
          }
        })
        .catch(err => console.warn("confirm-burn request failed:", err));

    } catch (err: any) {
      toast.error(err?.message ?? "Stake failed.");
    } finally {
      setIsStaking(false);
    }
  }, [
    userWalletAddress, challenge, hasJoined, code, username,
    agreedStake, myWallet, avatarUrl,
    getActiveSigner, ensureCorrectNetwork
  ]);
 
 
// ─── handleSyncStake ─────────────────────────────────────────────────────────
 
  const handleSyncStake = useCallback(async () => {
    if (!userWalletAddress || !challenge) return;
    setIsSyncing(true);
    const activeChainId = challenge.chainId ?? CELO_CHAIN_ID;
    try {
      const res = await fetch(`${API_BASE_URL}/api/challenge/${code}/sync-stake`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: userWalletAddress, chainId: activeChainId }),
      });
      const d = await res.json();
      if (!d.success && !d.alreadyVerified) {
        toast.error(d.message ?? "No DROPS redeem found on-chain yet.");
        return;
      }
      if (d.alreadyVerified) toast.success("Stake already verified! Click 'I'm Ready'.");
      else toast.success("Stake synced! Click 'I'm Ready'.");
      if (!hasJoined) {
        const joinRes = await fetch(`${API_BASE_URL}/api/challenge/${code}/join`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            walletAddress: userWalletAddress, username,
            txHash: "sync-recovery", chainId: activeChainId,
          }),
        });
        const joinData = await joinRes.json();
        if (!joinData.success) throw new Error(joinData.detail ?? "Join failed");
        setHasJoined(true);
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Could not sync stake.");
    } finally {
      setIsSyncing(false);
    }
  }, [userWalletAddress, challenge, code, username, hasJoined]);
 
 
// ─── handleClaim ─────────────────────────────────────────────────────────────
 
  const handleClaim = useCallback(async (claimCode: string) => {
    if (claimedCodes.has(claimCode)) return;
    setIsClaiming(true);
    const activeChainId = challenge?.chainId ?? CELO_CHAIN_ID;
    try {
      const res = await fetch(`${API_BASE_URL}/api/challenge/claim`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
        code: claimCode, walletAddress: userWalletAddress, chainId: activeChainId,
      }),
      });
      const d = await res.json();
      if (!d.success && !d.alreadyClaimed) throw new Error(d.detail ?? "Claim failed");
      toast.success("DROPS claimed to your wallet! 🏆");
      setClaimedCodes(prev => new Set(prev).add(claimCode));
      setPendingClaims(prev => prev.filter(c => c.code !== claimCode));
    } catch (err: any) {
      toast.error(err?.message ?? "Claim failed");
    } finally {
      setIsClaiming(false);
    }
  }, [userWalletAddress, claimedCodes, challenge?.chainId]);
 
  const handleRefresh = useCallback(async () => {
    if (!code || isRefreshing) return;
    setIsRefreshing(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/challenge/${code}`);
      const d = await r.json();
      if (!d.success) { toast.error("Could not refresh lobby"); return; }
      setChallenge(d.challenge);
      const incoming: PlayerState[] = Object.entries(d.challenge.players ?? {}).map(
        ([wallet, data]: [string, any]) => ({
          walletAddress: wallet, username: data.username, points: data.points,
          ready: data.ready, txVerified: data.txVerified, avatarUrl: data.avatar_url ?? "",
        })
      );
      setPlayers(prev => incoming.map(newP => {
        const existing = prev.find(p => p.walletAddress.toLowerCase() === newP.walletAddress.toLowerCase());
        return existing?.avatarUrl ? { ...newP, avatarUrl: existing.avatarUrl } : newP;
      }));
      toast.success("Lobby refreshed");
    } catch { toast.error("Refresh failed"); }
    finally { setIsRefreshing(false); }
  }, [code, isRefreshing]);

  // ── Avatar hydration ───────────────────────────────────────────────────────
  const avatarKey = players.map(p => `${p.walletAddress}:${p.avatarUrl}`).join("|");
  useEffect(() => {
    if (players.length === 0) return;
    const missing = players.filter(p => !p.avatarUrl);
    if (missing.length === 0) return;
    missing.forEach(p => {
      fetch(`${API_BASE_URL}/api/players/${p.walletAddress}`).then(r => r.json()).then(d => {
        if (d.avatar_url) setPlayers(prev => prev.map(pl =>
          pl.walletAddress.toLowerCase() === p.walletAddress.toLowerCase() ? { ...pl, avatarUrl: d.avatar_url } : pl
        ));
      }).catch(() => {});
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avatarKey]);

  // ── Derived values ─────────────────────────────────────────────────────────
  const myClaim   = pendingClaims.find(c => c.code === code);
  const totalPool = challenge
    ? (agreedStake ? (parseFloat(agreedStake) * 2).toFixed(0) : (challenge.stake * 2).toFixed(0))
    : "0";

  // ── Global overlays ────────────────────────────────────────────────────────
  const globalOverlays = (
    <>
    {showBadgeUnlocked && (
      <BadgeUnlockedPopup onDismiss={() => setShowBadgeUnlocked(false)} />
    )}
      {rematchInvite && (
        <RematchPopup
          invite={rematchInvite} myWallet={myWallet}
          onDismiss={handleInviteDismiss} countdown={inviteCountdown}
        />
      )}
    </>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  //  RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  if (phase === "loading") {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <Header pageTitle="Challenge" />
        <Loading />
      </div>
    );
  }

  // ── Countdown ───────────────────────────────────────────────────────────────
  if (phase === "countdown") {
    return (
      <>
        {globalOverlays}
        <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
          <div className="text-center space-y-4">
            <p className="text-muted-foreground text-xl uppercase tracking-widest font-black">
              Round: {currentRoundName}
            </p>
            <div
              key={countdownVal}
              className="text-[10rem] font-black text-primary leading-none"
              style={{ animation: "zoomFade 0.9s ease-out forwards" }}
            >
              {countdownVal}
            </div>
          </div>
          <style>{`@keyframes zoomFade{0%{transform:scale(1.5);opacity:0}30%{transform:scale(1);opacity:1}80%{opacity:1}100%{transform:scale(0.8);opacity:0}}`}</style>
        </div>
      </>
    );
  }

  // ── Question / Reveal ───────────────────────────────────────────────────────
  if ((phase === "question" || phase === "reveal") && currentQ) {
    const isReveal = phase === "reveal";
    return (
      <div className="fixed inset-0 bg-background flex flex-col overflow-hidden z-40">
        {!isReveal && <LinearTimer seconds={timeLeft} total={currentQ.timeLimit} />}

        <div className="flex items-center justify-between px-4 py-3 bg-card border-b border-border shrink-0">
          <Badge variant="outline" className="font-mono">
            Q{currentQ.questionIndex + 1}/{currentQ.totalQuestions}
          </Badge>
          <span className="text-xs font-bold text-muted-foreground capitalize">
            {currentRoundName} round
          </span>
          <div className="flex items-center gap-1 font-bold text-primary bg-primary/10 px-3 py-1 rounded-full text-sm">
            <Zap className="h-3.5 w-3.5" /> {myPlayerEntry?.points ?? 0}
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-4 overflow-y-auto">
          <h2 className={cn(
            "font-bold text-foreground leading-snug max-w-xl transition-all duration-500",
            isReveal ? "text-xl mb-6" : "text-2xl md:text-3xl"
          )}>
            {currentQ.question}
          </h2>

          {isReveal && (
            <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl mb-6">
                <div className="bg-muted/50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-border">
                  Current Standings
                </div>
                <div className="divide-y divide-border">
                  {[...players].sort((a, b) => b.points - a.points).map((p, i) => (
                    <div key={p.walletAddress} className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-black text-muted-foreground w-4">{i + 1}</span>
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={p.avatarUrl || undefined} />
                          <AvatarFallback className="text-[8px]">{p.username.slice(0, 2)}</AvatarFallback>
                        </Avatar>
                        <span className={cn(
                          "text-sm font-bold",
                          p.walletAddress.toLowerCase() === myWallet ? "text-primary" : "text-foreground"
                        )}>
                          {p.username}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {questionScores[p.walletAddress] > 0 && (
                          <span className="text-[10px] font-black text-emerald-500 animate-bounce">
                            +{questionScores[p.walletAddress]}
                          </span>
                        )}
                        <span className="font-black text-sm">{p.points}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {isReveal && (
          <div className="flex justify-center px-4 pb-4 shrink-0">
            <div className={cn(
              "px-8 py-3 rounded-full font-black text-lg border-2 shadow-lg animate-in zoom-in duration-300",
              selectedId === revealCorrectId
                ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-400"
                : "bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border-red-400"
            )}>
              {selectedId === revealCorrectId ? "✓ Correct!" : "✗ Incorrect"}
            </div>
          </div>
        )}

        <div className="w-full max-w-2xl mx-auto px-4 grid grid-cols-2 gap-3 pb-8 shrink-0">
          {currentQ.options.map(opt => {
            const style      = OPTION_STYLES[opt.id] ?? OPTION_STYLES.A;
            const isSelected = selectedId === opt.id;
            const isCorrect  = isReveal && opt.id === revealCorrectId;
            const isWrong    = isReveal && isSelected && opt.id !== revealCorrectId;
            return (
              <button
                key={opt.id}
                disabled={isReveal || timeLeft <= 0}
                onClick={() => handleSelectAnswer(opt.id)}
                className={cn(
                  "relative flex items-center justify-between rounded-2xl text-white font-bold transition-all duration-150 shadow-md px-3 py-4",
                  style.bg,
                  isSelected && !isReveal && `ring-4 ${style.ring} ring-offset-2 ring-offset-background scale-[1.02] z-10`,
                  isReveal && !isCorrect && !isWrong && "opacity-40 grayscale",
                  isCorrect && "ring-4 ring-white brightness-110",
                  isWrong   && "opacity-70 ring-4 ring-red-400",
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm opacity-90">{style.shape}</span>
                  <span className="leading-tight text-left text-sm">{opt.text}</span>
                </div>
                {isCorrect && <Check className="h-4 w-4 shrink-0" />}
                {isWrong   && <X    className="h-4 w-4 shrink-0" />}
              </button>
            );
          })}
        </div>

        {userWalletAddress && (
          <FloatingChat
            messages={chatMessages} myWallet={myWallet}
            chatInput={chatInput} setChatInput={setChatInput}
            onSend={handleSendChat} chatBottomRef={chatBottomRef}
            unreadCount={unreadCount}
          />
        )}
      </div>
    );
  }

  // ── Round end ───────────────────────────────────────────────────────────────
  if (phase === "round_end") {
    const sorted = Object.entries(roundScores).sort(([, a], [, b]) => b - a);
    return (
      <div className="fixed inset-0 bg-background flex flex-col items-center justify-center z-50 px-4">
        <div className="w-full max-w-sm space-y-4 text-center">
          <div className="text-4xl">📊</div>
          <h2 className="text-2xl font-black text-foreground">Round {currentRoundName} complete</h2>
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            {sorted.map(([wallet, pts], i) => {
              const player = players.find(p => p.walletAddress === wallet);
              const isMe   = wallet.toLowerCase() === myWallet;
              return (
                <div key={wallet} className={cn("flex items-center gap-3 px-4 py-3 border-b border-border last:border-0", isMe && "bg-primary/5")}>
                  <span className="font-black text-muted-foreground w-4">{i + 1}</span>
                  <span className="flex-1 text-left font-bold text-foreground text-sm">
                    {player?.username ?? wallet.slice(0, 8)}
                    {isMe && <Badge className="ml-2 text-[9px] h-4 px-1 bg-primary text-primary-foreground border-0">YOU</Badge>}
                  </span>
                  <span className="font-black text-lg text-foreground">{pts}</span>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground animate-pulse">Next round starting…</p>
        </div>
      </div>
    );
  }

  // ── Game over ───────────────────────────────────────────────────────────────
  if (phase === "game_over") {
    const sortedPlayers = Object.entries(finalScores).sort(([, a], [, b]) => b.points - a.points);
    const isTie    = gameOutcome === "tie";
    const isWinner = winner?.toLowerCase() === myWallet;

    if (sortedPlayers.length === 0) {
      return (
        <div className="flex flex-col min-h-screen bg-background">
          <Header pageTitle="Challenge" />
          <div className="flex flex-col items-center justify-center flex-1 gap-3 px-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground font-medium">Loading results…</p>
          </div>
        </div>
      );
    }

    return (
      <>
        {globalOverlays}
        <div className="fixed inset-0 bg-background flex flex-col overflow-auto">
          <Confetti active={showConfetti} />

          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
            <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
              <button
                onClick={() => router.back()}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm font-bold transition-colors"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              <Badge variant="outline" className="font-mono">{code}</Badge>
            </div>
          </div>

          <div className="max-w-2xl mx-auto w-full px-4 py-8 pb-24 space-y-5">

            <div className="text-center space-y-2">
              <div className="text-6xl">{isTie ? "🤝" : isWinner ? "🏆" : "🎯"}</div>
              <h1 className="text-3xl font-black text-foreground">
                {isTie ? "It's a tie!" : isWinner ? "You won!" : "Game over"}
              </h1>
              <p className="text-muted-foreground text-sm">{challenge?.topic}</p>
              <div className="inline-flex items-center gap-1.5 bg-muted/50 border border-border rounded-full px-3 py-1 text-xs font-bold text-muted-foreground">
                <span className="font-mono">{code}</span>
                <span>·</span>
                <span>{challenge?.stake} {DROPS_SYMBOL} each</span>
                <span>·</span>
                <span className="text-primary">🏆 {totalPool} {DROPS_SYMBOL} pool</span>
              </div>
            </div>

            <div className="bg-card rounded-2xl border border-border overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-blue-500" /> Final Leaderboard
                </h2>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  {sortedPlayers.length} player{sortedPlayers.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="divide-y divide-border">
                {sortedPlayers.map(([wallet, data], i) => {
                  const isMe         = wallet.toLowerCase() === myWallet;
                  const isThisWinner = wallet.toLowerCase() === winner?.toLowerCase();
                  const medals       = ["🥇", "🥈", "🥉"];
                  return (
                    <div key={wallet} className={cn(
                      "flex items-center gap-3 px-4 py-4 transition-colors",
                      isMe && "bg-blue-50 dark:bg-blue-950/20",
                      isThisWinner && !isMe && "bg-blue-50/50 dark:bg-blue-950/10"
                    )}>
                      <div className="text-xl w-8 text-center shrink-0">{medals[i] ?? `${i + 1}`}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-foreground text-sm">{data.username}</p>
                          {isMe && <Badge className="text-[9px] h-4 px-1.5 bg-primary text-primary-foreground border-0">YOU</Badge>}
                          {isThisWinner && <Badge className="text-[9px] h-4 px-1.5 bg-blue-400 text-blue-900 border-0">WINNER</Badge>}
                          {isTie && <Badge variant="outline" className="text-[9px] h-4 px-1.5">TIE</Badge>}
                        </div>
                        <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                          {wallet.slice(0, 6)}…{wallet.slice(-4)}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-black text-2xl text-foreground leading-none">{data.points}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">pts</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {myClaim && (
              <div className={cn(
                "rounded-2xl p-4 space-y-3 border",
                claimedCodes.has(code)
                  ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800"
                  : "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800"
              )}>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{claimedCodes.has(code) ? "✅" : "🏆"}</span>
                  <div>
                    <p className={cn(
                      "font-bold text-sm",
                      claimedCodes.has(code) ? "text-emerald-700 dark:text-emerald-400" : "text-blue-700 dark:text-blue-400"
                    )}>
                      {claimedCodes.has(code) ? "Reward claimed!" : "Reward ready to claim"}
                    </p>
                    <p className={cn(
                      "text-xs",
                      claimedCodes.has(code) ? "text-emerald-600 dark:text-emerald-500" : "text-blue-600 dark:text-blue-500"
                    )}>
                      {myClaim.win_amount} {myClaim.token_symbol} {claimedCodes.has(code) ? "sent to your wallet" : "waiting in pool"}
                    </p>
                  </div>
                </div>
                <Button
                  className="w-full h-11 font-bold border-0 transition-all"
                  onClick={() => handleClaim(code)}
                  disabled={isClaiming || claimedCodes.has(code)}
                  style={claimedCodes.has(code) ? { background: "#16a34a", opacity: 1, cursor: "default" } : {}}
                >
                  {isClaiming
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Claiming…</>
                    : claimedCodes.has(code)
                    ? <><Check className="mr-2 h-4 w-4" /> Reward Claimed</>
                    : "Claim Reward"
                  }
                </Button>
              </div>
            )}

            {isWinner && !myClaim && phase === "game_over" && (
              <div className="bg-muted/50 border border-border rounded-2xl p-4 text-center space-y-1">
                <p className="text-sm font-bold text-foreground">Reward already sent ✓</p>
                <p className="text-xs text-muted-foreground">Your winnings were transferred to your wallet.</p>
              </div>
            )}

            <div className="flex flex-col gap-3">
              {canRematch && (
                <div className="flex flex-col gap-1.5">
                  <button
                    onClick={() =>
                      sendRematchInvite({
                        code, userWalletAddress: userWalletAddress!,
                        setRematchPending, setRematchCountdown,
                        rematchTimerRef, rematchTimeoutRef,
                      })
                    }
                    disabled={!rematchAllowed || isRequestingRematch || rematchPending}
                    title={rematchLockReason ?? undefined}
                    className={cn(
                      "w-full h-14 rounded-2xl font-black text-base transition-all flex items-center justify-center gap-2 shadow-lg active:scale-[0.99]",
                      rematchAllowed
                        ? "bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                        : "bg-muted text-muted-foreground border-2 border-border cursor-not-allowed opacity-60",
                    )}
                  >
                    {rematchPending ? (
                      <><Loader2 className="h-5 w-5 animate-spin" /> Waiting{rematchCountdown !== null && rematchCountdown > 0 ? ` (${rematchCountdown}s)` : "…"}</>
                    ) : isRequestingRematch ? (
                      <><Loader2 className="h-5 w-5 animate-spin" /> Creating challenge…</>
                    ) : rematchAllowed ? (
                      <>🔁 Request Rematch</>
                    ) : (
                      <><ShieldCheck className="h-5 w-5" /> Rematch Locked</>
                    )}
                  </button>
                  {rematchLockReason && !rematchPending && !isRequestingRematch && (
                    <p className="text-[11px] text-center text-muted-foreground px-2">🔒 {rematchLockReason}</p>
                  )}
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 h-12" onClick={() => router.push("/challenge")}>
                  <Home className="mr-2 h-4 w-4" /> Hub
                </Button>
                <Button variant="outline" className="flex-1 h-12" onClick={() => router.push("/challenge/create-challenge")}>
                  <Plus className="mr-2 h-4 w-4" /> New
                </Button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── Lobby guard ─────────────────────────────────────────────────────────────
  const amCreator = challenge && userWalletAddress &&
    challenge.creator?.toLowerCase() === userWalletAddress.toLowerCase();

  if (!hasJoined && !amCreator && phase === "lobby") {
    if (typeof window !== "undefined") router.replace(`/challenge/${code}/pre-lobby`);
    return null;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  //  LOBBY
  // ─────────────────────────────────────────────────────────────────────────────
  const allVerified = players.length >= 2 && players.every(p => p.txVerified);
  const allReady    = allVerified && players.every(p => p.ready);

  return (
    <>
      {rematchInvite && (
        <RematchPopup
          invite={rematchInvite} myWallet={myWallet}
          onDismiss={handleInviteDismiss} countdown={inviteCountdown}
        />
      )}
      <div className="min-h-screen bg-background flex flex-col">

        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b border-border">
          <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => router.push("/challenge")} className="hover:bg-muted p-2 rounded-full transition-colors">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="hover:bg-muted p-2 rounded-full transition-colors disabled:opacity-50"
                title="Refresh lobby"
              >
                <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-black tracking-tighter">{code}</p>
                  <Badge variant="secondary" className="text-[10px] uppercase">{DROPS_SYMBOL}</Badge>
                </div>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">{challenge?.topic}</p>
               
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Compact expiry pill — only shows when under 30 min */}
              <ExpiryBanner
                secondsLeft={expiry.secondsLeft}
                isExpired={expiry.isExpired}
                isCancelling={expiry.isCancelling}
                onCancel={() => userWalletAddress && expiry.cancelExpired(userWalletAddress)}
                players={players}
                userWalletAddress={userWalletAddress}
                compact
              />
              <div className="text-right hidden sm:block">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Per Player</p>
                <p className="font-bold text-sm">{displayStake} {DROPS_SYMBOL}</p>
              </div>
              <div className="bg-primary/10 border border-primary/20 px-4 py-2 rounded-2xl flex flex-col items-center min-w-[90px]">
                <p className="text-[9px] font-black text-primary uppercase leading-none mb-1">Total Pool</p>
                <p className="text-xl font-black text-primary leading-none">
                  {totalPool} <span className="text-xs">{DROPS_SYMBOL}</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto w-full px-4 py-6 pb-32 space-y-5">

          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h2 className="font-bold text-foreground text-sm flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-400" /> Players
              </h2>
              {allReady && (
                <span className="text-xs font-bold text-emerald-500 flex items-center gap-1">
                  <Check className="h-3.5 w-3.5" /> Both ready — starting!
                </span>
              )}
            </div>
            {players.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <Users className="h-8 w-8 text-muted-foreground/20 mb-3" />
                <p className="text-muted-foreground text-sm">Waiting for opponent…</p>
                <p className="text-muted-foreground/60 text-xs mt-1">Share the code above</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 p-4">
                {players.map(p => {
                  const isMe   = p.walletAddress.toLowerCase() === myWallet;
                  const isHost = p.walletAddress.toLowerCase() === challenge?.creator?.toLowerCase();
                  const statusLabel = (() => {
                    if (p.ready)      return { text: "Ready ✓",        cls: "text-emerald-500"     };
                    if (p.txVerified) return { text: "Stake verified",  cls: "text-blue-400"        };
                    if (isHost)       return { text: "Awaiting stake…", cls: "text-blue-500"        };
                    return              { text: "Awaiting stake…",     cls: "text-muted-foreground" };
                  })();
                  return (
                    <div key={p.walletAddress} className={cn(
                      "flex flex-col items-center gap-2 rounded-2xl p-4 border text-center transition-colors",
                      p.ready
                        ? "border-emerald-400/40 bg-emerald-500/5"
                        : p.txVerified
                          ? "border-blue-400/30 bg-blue-500/5"
                          : "border-border bg-muted/20"
                    )}>
                      <Avatar className="h-14 w-14 border-2 border-border">
                        <AvatarImage src={p.avatarUrl || undefined} />
                        <AvatarFallback className="font-bold text-base">
                          {p.username?.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <p className="font-black text-foreground text-sm">{p.username}</p>
                      <p className={cn("text-[10px] font-semibold", statusLabel.cls)}>{statusLabel.text}</p>
                      <div className="flex gap-1 flex-wrap justify-center">
                        {isMe   && <Badge className="text-[9px] h-4 px-1 bg-primary text-primary-foreground border-0">YOU</Badge>}
                        {isHost && <Badge variant="outline" className="text-[9px] h-4 px-1">Host</Badge>}
                      </div>
                    </div>
                  );
                })}
                {players.length < 2 && (
                  <div className="flex flex-col items-center gap-2 rounded-2xl p-4 border border-dashed border-border text-center">
                    <div className="h-14 w-14 rounded-full border-2 border-dashed border-border flex items-center justify-center">
                      <Users className="h-6 w-6 text-muted-foreground/30" />
                    </div>
                    <p className="font-bold text-muted-foreground/50 text-sm">Waiting…</p>
                    <p className="text-[10px] text-muted-foreground/40">Share to invite</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {players.length < 2 && (
            <button
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/challenge/${code}`);
                toast.success("Invite link copied!");
              }}
              className="w-full h-11 rounded-2xl border border-border bg-card text-sm font-bold hover:bg-muted transition-all flex items-center justify-center gap-2 text-foreground"
            >
              <Share2 className="h-4 w-4" /> Copy invite link
            </button>
          )}

          {/* Full expiry banner — only appears under 30min or expired */}
          <ExpiryBanner
            secondsLeft={expiry.secondsLeft}
            isExpired={expiry.isExpired}
            isCancelling={expiry.isCancelling}
            onCancel={() => userWalletAddress && expiry.cancelExpired(userWalletAddress)}
            players={players}
            userWalletAddress={userWalletAddress}
          />

          {hasJoined && (
            <div className="space-y-3 pt-2">
              {!myTxVerified && (
                <>
                  <Button
                    className="w-full h-16 text-lg font-black dd-btn rounded-2xl shadow-[0_4px_0_rgb(30,80,200)] active:translate-y-1 active:shadow-none transition-all"
                    onClick={handleStake}
                    disabled={isStaking || stakeVerifying}
                  >
                    {isStaking ? (
                      <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Staking DROPS…</>
                    ) : stakeVerifying ? (
                      <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Verifying on-chain…</>
                    ) : (
                      <><Zap className="mr-2 h-6 w-6" /> Stake {displayStake} {DROPS_SYMBOL} to Play</>
                    )}
                  </Button>
                  <button
                    onClick={handleSyncStake}
                    disabled={isSyncing}
                    className="w-full text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors py-1"
                  >
                    {isSyncing ? "Checking on-chain…" : "Already staked? Sync my stake"}
                  </button>
                </>
              )}

              {myTxVerified && !myReady && (
                <Button
                  className="w-full h-16 text-lg font-black dd-btn rounded-2xl shadow-[0_4px_0_rgb(16,120,60)] active:translate-y-1 active:shadow-none transition-all"
                  onClick={handleReady}
                >
                  <Check className="mr-2 h-6 w-6" /> I'm Ready
                </Button>
              )}

              {myReady && (
                <div className={cn(
                  "w-full h-16 flex items-center justify-center gap-3 rounded-2xl border-2 border-dashed",
                  allReady ? "bg-emerald-500/10 border-emerald-500/50" : "bg-muted/50 border-border"
                )}>
                  <Loader2 className={cn("h-5 w-5 animate-spin", allReady ? "text-emerald-500" : "text-primary")} />
                  <span className={cn(
                    "font-bold uppercase tracking-widest text-sm",
                    allReady ? "text-emerald-500" : "text-muted-foreground"
                  )}>
                    {allReady ? "Game Starting..." : "Waiting for Opponent..."}
                  </span>
                </div>
              )}

              {!myTxVerified && (
                <div className="flex gap-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 rounded-2xl p-4">
                  <div className="shrink-0 mt-0.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                      <ShieldCheck className="h-4 w-4 text-blue-500" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 min-w-0">
                    <p className="text-xs font-black text-blue-800 dark:text-blue-200 uppercase tracking-wide">
                      Stake-to-Play · Claim-to-Win
                    </p>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-blue-600 dark:text-blue-400">You stake</span>
                        <span className="text-xs font-bold text-blue-800 dark:text-blue-200 font-mono">
                          {displayStake} {DROPS_SYMBOL}
                        </span>
                      </div>
                      <div className="h-px bg-blue-200 dark:bg-blue-800/60" />
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-blue-600 dark:text-blue-400">Winner gets</span>
                        <span className="text-xs font-bold text-blue-800 dark:text-blue-200 font-mono">
                          {totalPool} {DROPS_SYMBOL}
                        </span>
                      </div>
                    </div>
                    <p className="text-[10px] text-blue-500 dark:text-blue-500 leading-relaxed pt-0.5">
                      Drops burned on stake, winner claims the pool — no custody, no platform fee.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {userWalletAddress && phase === "lobby" && (
          <FloatingChat
            messages={chatMessages} myWallet={myWallet}
            chatInput={chatInput} setChatInput={setChatInput}
            onSend={handleSendChat} chatBottomRef={chatBottomRef}
            unreadCount={unreadCount}
          />
        )}
      </div>
    </>
  );
}