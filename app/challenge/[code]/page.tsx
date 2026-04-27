"use client";

import React, {
  useState, useEffect, useRef, useCallback, useMemo,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { useWallet } from "@/hooks/use-wallet";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Loader2, Trophy, Zap, Check, X,
  ArrowLeft, Share2, Home, Plus, Users, ShieldCheck,
  MessageSquare, Send, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Loading from "@/app/loading";
import { ERC20_ABI, QUIZ_HUB_ABI } from "@/lib/abis";
import { BrowserProvider, Contract, parseUnits, keccak256, toUtf8Bytes } from "ethers";
import { useSearchParams } from "next/navigation";
import { WalletConnectButton } from "@/components/wallet-connect";
import { toast as sonnerToast } from "sonner";
import { RematchPopup, RematchInvite } from "@/components/RematchPopup";

const CREATE_QUIZ_FRAGMENT = [{
  inputs: [
    { internalType: "bytes32", name: "quizId",       type: "bytes32" },
    { internalType: "address", name: "tokenAddress", type: "address" },
  ],
  name: "createQuiz", outputs: [], stateMutability: "nonpayable", type: "function",
}];

// ── Config ────────────────────────────────────────────────────────────────────

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://faucetpay-backend.koyeb.app";

function getWsBaseUrl(): string {
  if (typeof window === "undefined") return "wss://127.0.0.1:8000";
  return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "ws://127.0.0.1:8000"
    : "wss://faucetpay-backend.koyeb.app";
}

const CELO_CHAIN_ID = 42220;
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_STAKE_CONTRACT ?? "0xceDC56a09ae64563D3b04cCde4dC2A2E0667Ce8B";

const TOKEN_ADDRESSES: Record<string, string> = {
  USDm: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
  USDC: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C",
  USDT: "0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e",
};

// ── Types ─────────────────────────────────────────────────────────────────────

type GamePhase =
  | "loading"
  | "lobby"
  | "countdown"
  | "question"
  | "reveal"
  | "round_end"
  | "game_over";

interface PlayerState {
  walletAddress: string;
  username: string;
  points: number;
  ready: boolean;
  txVerified: boolean;
  avatarUrl: string; // always a string, never undefined
}

interface QuizOption { id: string; text: string }

interface CurrentQuestion {
  roundIndex: number;
  questionIndex: number;
  totalQuestions: number;
  question: string;
  options: QuizOption[];
  timeLimit: number;
  startedAt: number;
}

interface FinalScore { username: string; points: number }

const OPTION_STYLES: Record<string, { bg: string; shape: string; ring: string }> = {
  A: { bg: "bg-red-500 hover:bg-red-600",     shape: "▲", ring: "ring-red-400"    },
  B: { bg: "bg-blue-500 hover:bg-blue-600",   shape: "◆", ring: "ring-blue-400"   },
  C: { bg: "bg-yellow-500 hover:bg-yellow-600", shape: "●", ring: "ring-yellow-400" },
  D: { bg: "bg-green-500 hover:bg-green-600", shape: "■", ring: "ring-green-400"   },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function LinearTimer({ seconds, total }: { seconds: number; total: number }) {
  const pct   = Math.max(0, (seconds / total) * 100);
  const color = pct > 50 ? "bg-green-500" : pct > 25 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 overflow-hidden shrink-0">
      <div className={cn("h-full transition-all duration-300 ease-linear", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

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

// ── On-Chain Staking ──────────────────────────────────────────────────────────

async function ensureCeloNetwork(): Promise<void> {
  if (!window.ethereum) throw new Error("No wallet detected. Install MetaMask or a Celo wallet.");
  const chainIdHex = await window.ethereum.request({ method: "eth_chainId" });
  if (parseInt(chainIdHex, 16) !== CELO_CHAIN_ID) {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x" + CELO_CHAIN_ID.toString(16) }],
      });
    } catch (switchErr: any) {
      if (switchErr.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: "0x" + CELO_CHAIN_ID.toString(16),
            chainName: "Celo Mainnet",
            nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
            rpcUrls: ["https://forno.celo.org"],
            blockExplorerUrls: ["https://celoscan.io"],
          }],
        });
      } else {
        throw switchErr;
      }
    }
  }
}

async function stakeOnChain(
  challengeCode: string,
  stakeAmount: number,
  tokenSymbol: string,
): Promise<string> {
  await ensureCeloNetwork();
  const tokenAddr = TOKEN_ADDRESSES[tokenSymbol.toUpperCase()];
  if (!tokenAddr) throw new Error(`Unsupported token: ${tokenSymbol}. Only USDm, USDC, and USDT are accepted.`);
  const provider = new BrowserProvider(window.ethereum);
  const signer   = await provider.getSigner();
  const userAddr = await signer.getAddress();
  const quizId   = keccak256(toUtf8Bytes(challengeCode));
  const erc20    = new Contract(tokenAddr, ERC20_ABI, signer);
  const contract = new Contract(CONTRACT_ADDRESS, QUIZ_HUB_ABI, signer);
  const decimals = await erc20.decimals();
  const amount   = parseUnits(stakeAmount.toString(), decimals);
  const balance  = await erc20.balanceOf(userAddr);
  const flatFee  = await contract.getFlatFee(tokenAddr);
  const totalRequired = amount + flatFee;
  if (balance < totalRequired) {
    const needed = Number(totalRequired) / 10 ** Number(decimals);
    const has    = Number(balance)       / 10 ** Number(decimals);
    throw new Error(`Insufficient balance. Need ${needed.toFixed(4)} ${tokenSymbol} (stake + fee), but wallet only has ${has.toFixed(4)}.`);
  }
  const allowance = await erc20.allowance(userAddr, CONTRACT_ADDRESS);
  if (allowance < totalRequired) {
    const approveTx = await erc20.approve(CONTRACT_ADDRESS, totalRequired);
    await approveTx.wait();
  }
  const tx      = await contract.stake(quizId);
  const receipt = await tx.wait();
  return receipt.hash;
}

// ── Floating Chat ─────────────────────────────────────────────────────────────

interface FloatingChatProps {
  messages: any[];
  myWallet: string;
  chatInput: string;
  setChatInput: (v: string) => void;
  onSend: () => void;
  chatBottomRef: React.RefObject<HTMLDivElement | null>;
  unreadCount: number;
}

function FloatingChat({ messages, myWallet, chatInput, setChatInput, onSend, chatBottomRef, unreadCount }: FloatingChatProps) {
  const [isOpen, setIsOpen]           = useState(false);
  const [localUnread, setLocalUnread] = useState(0);

  useEffect(() => {
    if (!isOpen) setLocalUnread(unreadCount);
  }, [unreadCount, isOpen]);

  
  return (
    // ── FIX: z-[200] so it sits above the z-50 question/reveal overlay ──
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
            ) : (
              messages.map((m, i) => {
                const isMe = m.wallet?.toLowerCase() === myWallet;
                return (
                  <div key={i} className={cn("flex flex-col gap-0.5", isMe ? "items-end" : "items-start")}>
                    {!isMe && <span className="text-[10px] text-muted-foreground px-1 font-semibold">{m.sender}</span>}
                    <div className={cn("px-3 py-2 rounded-2xl text-xs max-w-[85%] break-words leading-relaxed",
                      isMe ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-muted text-foreground rounded-tl-sm"
                    )}>
                      {m.text}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatBottomRef} />
          </div>
          {/* ── FIX: removed duplicate border-t wrapper div that was causing double padding ── */}
          <form
            onSubmit={(e) => { e.preventDefault(); onSend(); }}
            className="flex gap-2 px-3 py-3 border-t border-border shrink-0"
          >
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              placeholder="Say something…"
              maxLength={200}
              className="flex-1 bg-muted/50 border border-border rounded-xl px-3 py-2 text-xs text-foreground outline-none focus:border-primary/50 transition-colors"
            />
            <button
              type="submit"
              disabled={!chatInput.trim()}
              className="w-8 h-8 rounded-xl bg-primary disabled:bg-muted/50 disabled:text-muted-foreground text-primary-foreground flex items-center justify-center transition-all active:scale-95 shrink-0"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      )}
      <button
        onClick={() => { if (isOpen) { setIsOpen(false); } else { setIsOpen(true); setLocalUnread(0); } }}
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

// ── Rematch helpers (module-level, no hooks) ──────────────────────────────────

export async function sendRematchInvite(params: {
  code:                string;
  userWalletAddress:   string;
  setRematchPending:   (v: boolean) => void;
  setRematchCountdown: React.Dispatch<React.SetStateAction<number | null>>;
  rematchTimerRef:     React.MutableRefObject<ReturnType<typeof setInterval> | null>;
  rematchTimeoutRef:   React.MutableRefObject<ReturnType<typeof setTimeout>  | null>;
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

export async function handleRematchCreate(params: {
  code:              string;
  userWalletAddress: string;
  challenge:         any;
  router:            ReturnType<typeof useRouter>;
  setIsRequesting:   (v: boolean) => void;
}) {
  const { code, userWalletAddress, challenge, router, setIsRequesting } = params;
  setIsRequesting(true);
  try {
    const res = await fetch(`${API_BASE_URL}/api/challenge/${code}/rematch`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requesterWallet: userWalletAddress }),
    });
    const d = await res.json();
    if (!d.success) throw new Error(d.detail ?? "Rematch creation failed");
    const newCode: string = d.newCode;
    if (!window.ethereum) throw new Error("No wallet detected");
    const provider  = new BrowserProvider(window.ethereum);
    const signer    = await provider.getSigner();
    const contract  = new Contract(CONTRACT_ADDRESS, CREATE_QUIZ_FRAGMENT, signer);
    const quizId    = keccak256(toUtf8Bytes(newCode));
    const tokenAddr = TOKEN_ADDRESSES[(challenge?.token ?? "USDm").toUpperCase()] ?? TOKEN_ADDRESSES.USDm;
    sonnerToast.info("Confirm quiz creation in your wallet…");
    const tx = await contract.createQuiz(quizId, tokenAddr);
    await tx.wait();
    sonnerToast.success("Challenge created! Heading to pre-lobby…");
    router.push(`/challenge/${newCode}/pre-lobby`);
  } catch (err: any) {
    if (err?.code === 4001 || err?.code === "ACTION_REJECTED") sonnerToast.error("Transaction rejected.");
    else sonnerToast.error(err?.message ?? "Could not create rematch.");
  } finally {
    setIsRequesting(false);
  }
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ChallengePage() {
  const params  = useParams();
  const router  = useRouter();
  const code    = ((params.code as string) ?? "").toUpperCase();

  const { address: userWalletAddress } = useWallet();
  const myWallet = useMemo(() => userWalletAddress?.toLowerCase() ?? "", [userWalletAddress]);

  const searchParams     = useSearchParams();
  const agreedStake      = searchParams.get("stake");
  const cameFromPreLobby = searchParams.get("agreed") === "1";

  // ── Core state ───────────────────────────────────────────────────────────────
  const [phase, setPhase]         = useState<GamePhase>("loading");
  const [challenge, setChallenge] = useState<any>(null);
  const [players, setPlayers]     = useState<PlayerState[]>([]);
  const [username, setUsername]   = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [hasJoined, setHasJoined] = useState(false);
  const [isCreator, setIsCreator] = useState(false);

  // ── Staking state ─────────────────────────────────────────────────────────────
  const [isStaking, setIsStaking]           = useState(false);
  const [stakeTxHash, setStakeTxHash]       = useState<string | null>(null);
  const [stakeVerifying, setStakeVerifying] = useState(false);
  const [isSyncing, setIsSyncing]           = useState(false);
  const [isRefreshing, setIsRefreshing]     = useState(false);

  // ── Game state ────────────────────────────────────────────────────────────────
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

  // ── Claim ─────────────────────────────────────────────────────────────────────
  const [pendingClaims, setPendingClaims] = useState<any[]>([]);
  const [isClaiming, setIsClaiming]       = useState(false);

  // ── Chat ──────────────────────────────────────────────────────────────────────
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput]       = useState("");
  const [unreadCount, setUnreadCount]   = useState(0);
  const chatBottomRef                   = useRef<HTMLDivElement>(null);

  // ── Refs ──────────────────────────────────────────────────────────────────────
  const timerRef          = useRef<ReturnType<typeof setInterval> | null>(null);
  // ── FIX: separate ref for the round countdown so it can be properly cleared ──
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

  // ── Derived (no hooks, safe here) ─────────────────────────────────────────────
  const myPlayerEntry = players.find(p => p.walletAddress.toLowerCase() === myWallet);
  const myTxVerified  = myPlayerEntry?.txVerified ?? false;
  const myReady       = myPlayerEntry?.ready ?? false;
  const displayStake  = agreedStake ?? challenge?.stake;

  // ── Timer cleanup helpers ─────────────────────────────────────────────────────
  const clearRematchTimers = useCallback(() => {
    if (rematchTimerRef.current)   clearInterval(rematchTimerRef.current);
    if (rematchTimeoutRef.current) clearTimeout(rematchTimeoutRef.current);
    rematchTimerRef.current   = null;
    rematchTimeoutRef.current = null;
  }, []);

  // ── sendWhenReady — queues WS sends until socket is OPEN ─────────────────────
  const sendWhenReady = useCallback((payload: object) => {
    const ws = wsRef.current;
    if (!ws) return;
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    } else if (ws.readyState === WebSocket.CONNECTING) {
      const onOpen = () => { ws.send(JSON.stringify(payload)); ws.removeEventListener("open", onOpen); };
      ws.addEventListener("open", onOpen);
    }
  }, []);

  // ── Cleanup on unmount ────────────────────────────────────────────────────────
  useEffect(() => () => { if (inviteTimerRef.current) clearInterval(inviteTimerRef.current); }, []);
  useEffect(() => () => clearRematchTimers(), [clearRematchTimers]);
  useEffect(() => () => { if (cdIntervalRef.current) clearInterval(cdIntervalRef.current); }, []);

  // ── Profile ───────────────────────────────────────────────────────────────────
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

  // ── Load challenge meta ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!code) return;
    fetch(`${API_BASE_URL}/api/challenge/${code}`)
      .then(r => r.json())
      .then(d => {
        if (!d.success) { toast.error("Challenge not found"); router.push("/challenge"); return; }
        setChallenge(d.challenge);
        const playerEntries: PlayerState[] = Object.entries(d.challenge.players ?? {}).map(
          ([wallet, data]: [string, any]) => ({
            walletAddress: wallet,
            username:      data.username,
            points:        data.points,
            ready:         data.ready,
            txVerified:    data.txVerified,
            avatarUrl:     data.avatar_url ?? "",
          })
        );
        setPlayers(playerEntries);
        const amCreator = userWalletAddress &&
          d.challenge.creator?.toLowerCase() === userWalletAddress.toLowerCase();
        if (amCreator) { setIsCreator(true); setHasJoined(true); }
        if (d.challenge.status === "active")        setPhase("question");
        else if (d.challenge.status === "finished") setPhase("game_over");
        else                                        setPhase("lobby");
      })
      .catch(() => toast.error("Failed to load challenge"));
  }, [code, userWalletAddress, router]);

  // ── Optimistically skip pre-join when arriving from pre-lobby ────────────────
  useEffect(() => {
    if (cameFromPreLobby && agreedStake && userWalletAddress && !hasJoined) setHasJoined(true);
  }, [cameFromPreLobby, agreedStake, userWalletAddress, hasJoined]);

  // ── Register challenger via /join in background ───────────────────────────────
  useEffect(() => {
    if (!cameFromPreLobby || !agreedStake || !userWalletAddress || !challenge || !username) return;
    if (joinCalledRef.current) return;
    const isCreatorWallet = challenge.creator?.toLowerCase() === userWalletAddress.toLowerCase();
    if (isCreatorWallet) return;
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
        if (!d.success) console.warn("[auto-join] backend said:", d.detail);
        else toast.info(`Stake agreed at ${agreedStake} ${challenge.token} — approve the transaction to lock it in!`);
      })
      .catch(err => console.error("[auto-join] fetch failed:", err));
  }, [cameFromPreLobby, agreedStake, userWalletAddress, challenge, code, username]);

  const handleInviteDismiss = useCallback(() => {
    if (inviteTimerRef.current) clearInterval(inviteTimerRef.current);
    inviteTimerRef.current = null;
    setInviteCountdown(null);
    setRematchInvite(null);
  }, []);

  // ── Timer ─────────────────────────────────────────────────────────────────────
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

  // ── Stake confirmed ───────────────────────────────────────────────────────────
  const sendStakeConfirmed = useCallback((txHash: string) => {
    if (!userWalletAddress) return;
    setStakeTxHash(txHash);
    setStakeVerifying(true);
    sendWhenReady({ type: "stake_confirmed", walletAddress: userWalletAddress, txHash });
  }, [userWalletAddress, sendWhenReady]);

  const handleReady = useCallback(() => {
    if (!userWalletAddress) return;
    sendWhenReady({ type: "ready", walletAddress: userWalletAddress });
  }, [userWalletAddress, sendWhenReady]);

  // ── WebSocket ─────────────────────────────────────────────────────────────────
  // ── FIX: removed `username` and `myWallet` from deps — they caused WS reconnects
  //         mid-game which reset all in-flight state and caused the freeze/hang.
  //         We capture them via refs instead so the handler always sees latest value.
  const usernameRef = useRef(username);
  const myWalletRef = useRef(myWallet);
  useEffect(() => { usernameRef.current = username; }, [username]);
  useEffect(() => { myWalletRef.current = myWallet; }, [myWallet]);

  const connectWS = useCallback(() => {
    if (!code || !userWalletAddress) return;
    if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) return;

    const ws = new WebSocket(`${getWsBaseUrl()}/ws/challenge/${code}`);
    wsRef.current = ws;
    ws.onopen = () => { reconnectAttempts.current = 0; };

    ws.onmessage = async (ev) => {
      let msg: any;
      try { msg = JSON.parse(ev.data); } catch { return; }

      const currentMyWallet   = myWalletRef.current;
      const currentUsername   = usernameRef.current;

      switch (msg.type) {
        case "state_sync": {
          const c = msg.challenge;
          setChallenge(c);
          setPlayers(prev => {
            const incoming: PlayerState[] = Object.entries(c.players ?? {}).map(([w, d]: [string, any]) => ({
              walletAddress: w,
              username:      d.username,
              points:        d.points,
              ready:         d.ready,
              txVerified:    d.txVerified,
              avatarUrl:     d.avatar_url ?? "",
            }));
            if (prev.length === 0) return incoming;
            return incoming.map(newP => {
              const existing = prev.find(p => p.walletAddress.toLowerCase() === newP.walletAddress.toLowerCase());
              return existing ? { ...newP, txVerified: newP.txVerified || existing.txVerified } : newP;
            });
          });
          break;
        }
        case "player_joined": {
          const p = msg.player;
          setPlayers(prev => {
            if (prev.some(e => e.walletAddress === p.walletAddress)) return prev;
            return [...prev, {
              walletAddress: p.walletAddress,
              username:      p.username,
              points:        0,
              ready:         false,
              txVerified:    false,
              avatarUrl:     p.avatar_url ?? "",
            }];
          });
          toast.info(`${p.username} joined the lobby!`);
          break;
        }
        case "stake_verified": {
          const wallet = msg.wallet.toLowerCase();
          setPlayers(prev => {
            const exists = prev.some(p => p.walletAddress.toLowerCase() === wallet);
            if (!exists) return [...prev, {
              walletAddress: wallet,
              username:      currentUsername,
              points:        0,
              ready:         false,
              txVerified:    true,
              avatarUrl:     msg.avatar_url ?? "",
            }];
            return prev.map(p => p.walletAddress.toLowerCase() === wallet ? { ...p, txVerified: true } : p);
          });
          if (wallet === currentMyWallet) {
            setStakeVerifying(false);
            toast.success("Stake verified ✓ — click Ready!");
          }
          break;
        }
        case "stake_failed": {
          if (msg.wallet.toLowerCase() === currentMyWallet) {
            setStakeVerifying(false);
            toast.error("On-chain stake verification failed. Please retry.");
          }
          break;
        }
        case "player_ready": {
          setPlayers(prev => prev.map(p =>
            p.walletAddress.toLowerCase() === msg.wallet.toLowerCase() ? { ...p, ready: true } : p
          ));
          break;
        }
        case "game_start": {
          toast.success(msg.message || "Game starting!");
          break;
        }
        case "round_announce": {
          // ── FIX: clear any previous countdown interval before starting a new one ──
          if (cdIntervalRef.current) { clearInterval(cdIntervalRef.current); cdIntervalRef.current = null; }
          setCurrentRoundName(msg.round);
          setPhase("countdown");
          setCountdownVal(3);
          cdIntervalRef.current = setInterval(() => {
            setCountdownVal(prev => {
              if (prev <= 1) {
                clearInterval(cdIntervalRef.current!);
                cdIntervalRef.current = null;
                return prev;
              }
              return prev - 1;
            });
          }, 1000);
          break;
        }
        case "question": {
          // ── FIX: clear both the game timer AND the countdown interval ──
          if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
          if (cdIntervalRef.current) { clearInterval(cdIntervalRef.current); cdIntervalRef.current = null; }
          const localStart = Date.now();
          setCurrentQ({
            roundIndex:     msg.roundIndex,
            questionIndex:  msg.questionIndex,
            totalQuestions: msg.totalQuestions,
            question:       msg.data.question,
            options:        msg.data.options,
            timeLimit:      msg.data.timeLimit,
            startedAt:      localStart,
          });
          setSelectedId(null);
          setHasSubmitted(false);
          setRevealCorrectId(null);
          setQuestionScores({});
          setPhase("question");
          startTimer(localStart, msg.data.timeLimit);
          break;
        }
        case "question_end": {
          if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
          setTimeLeft(0);
          setRevealCorrectId(msg.correctId);
          setQuestionScores(msg.questionScores ?? {});
          setTotalScores(msg.totalScores ?? {});
          setPlayers(prev => prev.map(p => ({ ...p, points: msg.totalScores?.[p.walletAddress] ?? p.points })));
          setPhase("reveal");
          break;
        }
        case "reconnect_countdown": {
          const isOpponent = msg.wallet?.toLowerCase() !== myWallet;
          if (isOpponent) {
            toast.warning(
              msg.secondsLeft > 0
                ? `Opponent disconnected — ${msg.secondsLeft}s to reconnect or you win by forfeit`
                : "Opponent ran out of time — awarding forfeit…",
              { id: "reconnect-countdown", duration: 4000 }
            );
          }
          break;
        }
        case "player_rejoined": {
          const isOpponent = msg.wallet?.toLowerCase() !== myWallet;
          if (isOpponent) {
            toast.success(`${msg.username} reconnected!`, { id: "reconnect-countdown" });
          }
          break;
        }
        case "round_end": {
          setRoundScores(msg.scores ?? {});
          setPhase("round_end");
          break;
        }
        case "game_over": {
          setFinalScores(msg.finalScores ?? {});
          setGameOutcome(msg.outcome);
          setWinner(msg.winner ?? null);
          setCanRematch(!!msg.canRematch);
          setPhase("game_over");
          if (msg.winner === currentMyWallet) { setShowConfetti(true); setTimeout(() => setShowConfetti(false), 6000); }
          break;
        }
        case "rematch_declined": {
          clearRematchTimers();
          setRematchPending(false);
          setRematchCountdown(null);
          toast.error(`${msg.declinerName ?? "Opponent"} declined the rematch.`);
          break;
        }
        case "rematch_timeout": {
          clearRematchTimers();
          setRematchPending(false);
          setRematchCountdown(null);
          if (msg.requesterWallet?.toLowerCase() === currentMyWallet)
            toast.info("Rematch request expired — opponent didn't respond.");
          break;
        }
        case "player_left": {
          clearRematchTimers();
          setRematchPending(false);
          setRematchCountdown(null);
          setRematchInvite(null);
          toast.error(`${msg.username ?? "Opponent"} has left the game.`);
          break;
        }
        case "chat": {
          setChatMessages(prev => [...prev, msg]);
          setUnreadCount(prev => prev + 1);
          break;
        }
        case "rematch_invite": {
          if (msg.requesterWallet?.toLowerCase() !== currentMyWallet) {
            setRematchInvite({
              originalCode:    msg.originalCode,
              topic:           msg.topic,
              stakeAmount:     msg.stakeAmount,
              tokenSymbol:     msg.tokenSymbol,
              requesterWallet: msg.requesterWallet,
              requesterName:   msg.requesterName,
            });
            setInviteCountdown(30);
            if (inviteTimerRef.current) clearInterval(inviteTimerRef.current);
            inviteTimerRef.current = setInterval(() => {
              setInviteCountdown(prev => {
                if (prev === null || prev <= 1) {
                  clearInterval(inviteTimerRef.current!);
                  inviteTimerRef.current = null;
                  setRematchInvite(null);
                  return null;
                }
                return prev - 1;
              });
            }, 1000);
          }
          break;
        }
        case "rematch_invite_accepted": {
          if (msg.acceptorWallet?.toLowerCase() !== currentMyWallet) {
            clearRematchTimers();
            setRematchPending(false);
            setRematchCountdown(null);
            toast.success(`${msg.acceptorName} accepted! Creating the challenge…`);
            await handleRematchCreate({
              code,
              userWalletAddress: userWalletAddress!,
              challenge,
              router,
              setIsRequesting: setIsRequestingRematch,
            });
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
      if (ev.code === 1000 || ev.code === 1008) return;
      if (reconnectAttempts.current >= 5) { toast.error("Connection lost. Refresh."); return; }
      reconnectAttempts.current += 1;
      setTimeout(() => { if (wsRef.current?.readyState !== WebSocket.OPEN) connectWS(); }, 2000 * reconnectAttempts.current);
    };
  // ── FIX: username and myWallet removed from deps — they now come via refs ──
  }, [code, userWalletAddress, startTimer, clearRematchTimers]);

  useEffect(() => {
    if (!userWalletAddress) return;
    connectWS();
    return () => { wsRef.current?.close(1000); wsRef.current = null; };
  }, [userWalletAddress, connectWS]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // ── Claim ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "game_over" || !myWallet) return;
    fetch(`${API_BASE_URL}/api/challenge/${myWallet}/pending-claims`)
      .then(r => r.json())
      .then(d => { if (d.success) setPendingClaims(d.claims ?? []); })
      .catch(() => {});
  }, [phase, myWallet]);

  // ── Actions ───────────────────────────────────────────────────────────────────

  const handleStake = useCallback(async () => {
    if (!userWalletAddress || !challenge) return;
    setIsStaking(true);
    try {
      toast.info("Approve the stake transaction in your wallet…");
      const stakeAmt = agreedStake ? parseFloat(agreedStake) : challenge.stake;
      const txHash   = await stakeOnChain(code, stakeAmt, challenge.token);
      if (!hasJoined) {
        const res = await fetch(`${API_BASE_URL}/api/challenge/${code}/join`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress: userWalletAddress, username, txHash }),
        });
        const d = await res.json();
        if (!d.success) throw new Error(d.detail ?? "Join failed");
        setHasJoined(true);
        setPlayers(prev => {
          if (prev.some(p => p.walletAddress.toLowerCase() === myWallet)) return prev;
          return [...prev, { walletAddress: userWalletAddress, username, points: 0, ready: false, txVerified: true, avatarUrl: avatarUrl ?? "" }];
        });
      }
      sendStakeConfirmed(txHash);
      toast.success("Stake confirmed! Click Ready to start.");
    } catch (err: any) {
      toast.error(err?.message ?? "Stake failed.");
    } finally {
      setIsStaking(false);
    }
  }, [userWalletAddress, challenge, hasJoined, code, username, sendStakeConfirmed, agreedStake, myWallet, avatarUrl]);

  const handleSelectAnswer = useCallback((optId: string) => {
    if (!currentQ || timeLeft <= 0 || phase === "reveal") return;
    const timeTaken = currentQ.timeLimit - timeLeft;
    wsRef.current?.send(JSON.stringify({
      type: "submit_answer",
      walletAddress: userWalletAddress,
      roundIndex: currentQ.roundIndex,
      questionIndex: currentQ.questionIndex,
      answerId: optId,
      timeTaken,
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

  const handleClaim = useCallback(async (claimCode: string) => {
    setIsClaiming(true);
    try {
      const provider = new BrowserProvider(window.ethereum);
      const signer   = await provider.getSigner();
      const contract = new Contract(CONTRACT_ADDRESS, QUIZ_HUB_ABI, signer);
      const quizId   = keccak256(toUtf8Bytes(claimCode));
      const tx       = await contract.claimReward(quizId);
      toast.info("Claim transaction sent...");
      await tx.wait();
      toast.success("Funds transferred to your wallet! 🏆");
      await fetch(`${API_BASE_URL}/api/challenge/claim`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: claimCode, walletAddress: userWalletAddress }),
      });
    } catch { toast.error("Claim failed"); }
    finally { setIsClaiming(false); }
  }, [userWalletAddress]);

  const handleSyncStake = useCallback(async () => {
    if (!userWalletAddress || !challenge) return;
    setIsSyncing(true);
    try {
      const GET_QUIZ_ABI = [{
        inputs: [{ internalType: "bytes32", name: "quizId", type: "bytes32" }],
        name: "getQuiz",
        outputs: [{ components: [
          { internalType: "bytes32", name: "id",             type: "bytes32"  },
          { internalType: "address", name: "token",          type: "address"  },
          { internalType: "uint256", name: "stakePerPlayer", type: "uint256"  },
          { internalType: "uint256", name: "totalStaked",    type: "uint256"  },
          { internalType: "address", name: "player1",        type: "address"  },
          { internalType: "address", name: "player2",        type: "address"  },
          { internalType: "address", name: "winner",         type: "address"  },
          { internalType: "bool",    name: "resolved",       type: "bool"     },
          { internalType: "bool",    name: "rewardClaimed",  type: "bool"     },
          { internalType: "uint256", name: "createdAt",      type: "uint256"  },
        ], internalType: "struct QuizHub.Quiz", name: "", type: "tuple" }],
        stateMutability: "view", type: "function",
      }];
      const provider       = new BrowserProvider(window.ethereum);
      const contract       = new Contract(CONTRACT_ADDRESS, GET_QUIZ_ABI, provider);
      const quizId         = keccak256(toUtf8Bytes(code));
      const quiz           = await contract.getQuiz(quizId);
      const stakePerPlayer = quiz[2];
      const totalStaked    = quiz[3];
      const player1        = quiz[4].toLowerCase();
      const player2        = quiz[5].toLowerCase();
      const wallet         = userWalletAddress.toLowerCase();
      let hasStaked = false;
      if (wallet === player1)      hasStaked = totalStaked >= stakePerPlayer;
      else if (wallet === player2) hasStaked = totalStaked >= stakePerPlayer * 2n;
      else                         hasStaked = totalStaked >= stakePerPlayer * 2n;
      if (!hasStaked) { toast.error("No stake found on-chain yet. Complete the stake transaction first."); return; }
      if (!hasJoined) {
        const res = await fetch(`${API_BASE_URL}/api/challenge/${code}/join`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress: userWalletAddress, username, txHash: "sync-recovery" }),
        });
        const d = await res.json();
        if (!d.success) throw new Error(d.detail ?? "Join failed");
        setHasJoined(true);
      }
      sendWhenReady({ type: "stake_confirmed", walletAddress: userWalletAddress, txHash: "sync-recovery" });
      setPlayers(prev => {
        const w      = userWalletAddress.toLowerCase();
        const exists = prev.some(p => p.walletAddress.toLowerCase() === w);
        if (!exists) return [...prev, { walletAddress: userWalletAddress, username, points: 0, ready: false, txVerified: true, avatarUrl: avatarUrl ?? "" }];
        return prev.map(p => p.walletAddress.toLowerCase() === w ? { ...p, txVerified: true } : p);
      });
      toast.success("Stake synced! Click 'I'm Ready' to continue.");
    } catch (err: any) {
      toast.error(err?.message ?? "Could not read on-chain data.");
    } finally {
      setIsSyncing(false);
    }
  }, [userWalletAddress, challenge, code, username, hasJoined, sendWhenReady, avatarUrl]);

  // ── Derived values ────────────────────────────────────────────────────────────
  const myClaim   = pendingClaims.find(c => c.code === code);
  const totalPool = challenge
    ? (agreedStake ? (parseFloat(agreedStake) * 2).toFixed(2) : (challenge.stake * 2).toFixed(2))
    : "0.00";

  // ── Hydrate missing avatars from /api/players ─────────────────────────────────
  useEffect(() => {
    if (players.length === 0) return;
    const missing = players.filter(p => !p.avatarUrl);
    if (missing.length === 0) return;
    missing.forEach(p => {
      fetch(`${API_BASE_URL}/api/players/${p.walletAddress}`)
        .then(r => r.json())
        .then(d => {
          if (d.avatar_url) {
            setPlayers(prev => prev.map(pl =>
              pl.walletAddress.toLowerCase() === p.walletAddress.toLowerCase()
                ? { ...pl, avatarUrl: d.avatar_url }
                : pl
            ));
          }
        })
        .catch(() => {});
    });
  }, [players.length]);

  // ── Lobby refresh ─────────────────────────────────────────────────────────────
 // ── handleRefresh — preserve avatarUrls when re-setting players ──
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
        walletAddress: wallet,
        username:      data.username,
        points:        data.points,
        ready:         data.ready,
        txVerified:    data.txVerified,
        avatarUrl:     data.avatar_url ?? "",
      })
    );
    // ── FIX: preserve existing avatarUrls so they don't flash away ──
    setPlayers(prev =>
      incoming.map(newP => {
        const existing = prev.find(
          p => p.walletAddress.toLowerCase() === newP.walletAddress.toLowerCase()
        );
        return existing?.avatarUrl ? { ...newP, avatarUrl: existing.avatarUrl } : newP;
      })
    );
    toast.success("Lobby refreshed");
  } catch {
    toast.error("Refresh failed");
  } finally {
    setIsRefreshing(false);
  }
}, [code, isRefreshing]);

// ── Avatar hydration — use a stable key that actually changes when avatars go missing ──
const avatarKey = players.map(p => `${p.walletAddress}:${p.avatarUrl}`).join("|");
useEffect(() => {
  if (players.length === 0) return;
  const missing = players.filter(p => !p.avatarUrl);
  if (missing.length === 0) return;
  missing.forEach(p => {
    fetch(`${API_BASE_URL}/api/players/${p.walletAddress}`)
      .then(r => r.json())
      .then(d => {
        if (d.avatar_url) {
          setPlayers(prev => prev.map(pl =>
            pl.walletAddress.toLowerCase() === p.walletAddress.toLowerCase()
              ? { ...pl, avatarUrl: d.avatar_url }
              : pl
          ));
        }
      })
      .catch(() => {});
  });
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [avatarKey]);

  // ── Global overlays (shared across phases) ────────────────────────────────────
  const globalOverlays = (
    <>
      {rematchInvite && (
        <RematchPopup
          invite={rematchInvite}
          myWallet={myWallet}
          onDismiss={handleInviteDismiss}
          countdown={inviteCountdown}
        />
      )}
    </>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  //  RENDER — early returns AFTER all hooks
  // ─────────────────────────────────────────────────────────────────────────────

  if (phase === "loading") {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <Header pageTitle="Challenge" />
        <Loading />
      </div>
    );
  }

  if (phase === "game_over") {
    const sortedPlayers = Object.entries(finalScores).sort(([, a], [, b]) => b.points - a.points);
    const isTie = gameOutcome === "tie";
    return (
      <>
        {globalOverlays}
        <div className="fixed inset-0 bg-background flex flex-col overflow-auto">
          <Confetti active={showConfetti} />
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
            <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
              <button onClick={() => router.back()} className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm font-bold transition-colors">
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              <Badge variant="outline" className="font-mono">{code}</Badge>
            </div>
          </div>
          <div className="max-w-2xl mx-auto w-full px-4 py-8 pb-24 space-y-6">
            <div className="text-center space-y-2">
              <div className="text-6xl">{isTie ? "🤝" : winner === myWallet ? "🏆" : "🎯"}</div>
              <h1 className="text-3xl font-black text-foreground">
                {isTie ? "It's a tie!" : winner === myWallet ? "You won!" : "Game over"}
              </h1>
              <p className="text-muted-foreground text-sm">{challenge?.topic}</p>
            </div>
            <div className="bg-card rounded-2xl border border-border overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-yellow-500" /> Final Scores
                </h2>
              </div>
              <div className="divide-y divide-border">
                {sortedPlayers.map(([wallet, data], i) => {
                  const isMe = wallet.toLowerCase() === myWallet;
                  return (
                    <div key={wallet} className={cn("flex items-center gap-3 px-4 py-3", isMe && "bg-blue-50 dark:bg-blue-950/20")}>
                      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm shrink-0",
                        i === 0 ? "bg-yellow-400 text-yellow-900" : "bg-muted text-muted-foreground"
                      )}>
                        {i === 0 ? "🥇" : "🥈"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-foreground text-sm">{data.username}</p>
                        {isMe && <Badge className="text-[9px] h-4 px-1 bg-primary text-primary-foreground border-0">YOU</Badge>}
                      </div>
                      <p className="font-black text-xl text-foreground">{data.points}</p>
                    </div>
                  );
                })}
              </div>
            </div>
            {myClaim && (
              <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-2xl p-4 space-y-3">
                <p className="font-bold text-yellow-700 dark:text-yellow-400 text-sm">🏆 Reward ready to claim!</p>
                <p className="text-xs text-yellow-600 dark:text-yellow-500">{myClaim.win_amount} {myClaim.token_symbol}</p>
                <Button className="w-full h-11 dd-btn font-bold border-0" onClick={() => handleClaim(code)} disabled={isClaiming}>
                  {isClaiming ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Claiming…</> : "Claim Reward"}
                </Button>
              </div>
            )}
            <div className="flex flex-col gap-3">
              {canRematch && (
                <button
                  onClick={() => sendRematchInvite({ code, userWalletAddress: userWalletAddress!, setRematchPending, setRematchCountdown, rematchTimerRef, rematchTimeoutRef })}
                  disabled={isRequestingRematch || rematchPending}
                  className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-black text-base hover:opacity-90 active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {rematchPending ? (
                    <><Loader2 className="h-5 w-5 animate-spin" /> Waiting{rematchCountdown !== null && rematchCountdown > 0 ? ` (${rematchCountdown}s)` : "…"}</>
                  ) : isRequestingRematch ? (
                    <><Loader2 className="h-5 w-5 animate-spin" /> Creating challenge…</>
                  ) : (
                    <>🔁 Request Rematch</>
                  )}
                </button>
              )}
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 h-12" onClick={() => router.push("/challenge")}>
                  <Home className="mr-2 h-4 w-4" /> Hub
                </Button>
                <Button variant="outline" className="flex-1 h-12" onClick={() => router.push("/challenge/create")}>
                  <Plus className="mr-2 h-4 w-4" /> New
                </Button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (phase === "countdown") {
    return (
      <>
        {globalOverlays}
        <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
          <div className="text-center space-y-4">
            <p className="text-muted-foreground text-xl uppercase tracking-widest font-black">Round: {currentRoundName}</p>
            <div key={countdownVal} className="text-[10rem] font-black text-primary leading-none" style={{ animation: "zoomFade 0.9s ease-out forwards" }}>
              {countdownVal}
            </div>
          </div>
          <style>{`@keyframes zoomFade{0%{transform:scale(1.5);opacity:0}30%{transform:scale(1);opacity:1}80%{opacity:1}100%{transform:scale(0.8);opacity:0}}`}</style>
        </div>
      </>
    );
  }

  if ((phase === "question" || phase === "reveal") && currentQ) {
    const isReveal = phase === "reveal";
    return (
      // ── FIX: z-40 instead of z-50 so FloatingChat at z-[200] renders above it ──
      <div className="fixed inset-0 bg-background flex flex-col overflow-hidden z-40">
        {!isReveal && <LinearTimer seconds={timeLeft} total={currentQ.timeLimit} />}
        <div className="flex items-center justify-between px-4 py-3 bg-card border-b border-border shrink-0">
          <Badge variant="outline" className="font-mono">Q{currentQ.questionIndex + 1}/{currentQ.totalQuestions}</Badge>
          <span className="text-xs font-bold text-muted-foreground capitalize">{currentRoundName} round</span>
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
                        {/* ── FIX: use avatarUrl field (consistently named) ── */}
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={p.avatarUrl || undefined} />
                          <AvatarFallback className="text-[8px]">{p.username.slice(0, 2)}</AvatarFallback>
                        </Avatar>
                        <span className={cn("text-sm font-bold", p.walletAddress.toLowerCase() === myWallet ? "text-primary" : "text-foreground")}>
                          {p.username}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {questionScores[p.walletAddress] > 0 && (
                          <span className="text-[10px] font-black text-emerald-500 animate-bounce">+{questionScores[p.walletAddress]}</span>
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
            <div className={cn("px-8 py-3 rounded-full font-black text-lg border-2 shadow-lg animate-in zoom-in duration-300",
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
            const style     = OPTION_STYLES[opt.id] ?? OPTION_STYLES.A;
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
        
      </div>
    );
  }

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

  const amCreator = challenge && userWalletAddress &&
    challenge.creator?.toLowerCase() === userWalletAddress.toLowerCase();

  if (!hasJoined && !amCreator && phase === "lobby") {
    if (cameFromPreLobby && agreedStake && userWalletAddress) return null;
    if (!challenge) {
      return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
          <div className="w-full max-w-sm space-y-4 text-center animate-pulse">
            <div className="h-28 bg-muted rounded-2xl" />
            <div className="h-6 bg-muted rounded-xl w-3/4 mx-auto" />
            <div className="h-4 bg-muted rounded-xl w-1/2 mx-auto" />
            <div className="h-14 bg-muted rounded-2xl" />
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="inline-flex flex-col items-center gap-1 bg-card border border-border rounded-2xl px-8 py-5 shadow-lg">
            <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest">Challenge Code</p>
            <div className="text-5xl font-black tracking-[0.15em] text-foreground">{code}</div>
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-foreground">{challenge.topic}</h2>
            <p className="text-muted-foreground text-sm">
              Stake: <span className="font-bold text-foreground">{challenge.stake} {challenge.token}</span>
              {" · "}Creator: <span className="font-medium">{challenge.creatorName}</span>
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card border border-border rounded-xl p-3 text-center">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Your Stake</p>
              <p className="font-black text-foreground text-lg">{challenge.stake} <span className="text-sm font-semibold text-muted-foreground">{challenge.token}</span></p>
            </div>
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-center">
              <p className="text-[10px] font-bold text-primary/70 uppercase tracking-wider mb-1">Total Pool</p>
              <p className="font-black text-primary text-lg">{totalPool} <span className="text-sm font-semibold text-primary/70">{challenge.token}</span></p>
            </div>
          </div>
          {!userWalletAddress ? (
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 rounded-xl px-4 py-3 text-blue-700 dark:text-blue-300 text-sm font-medium">
              Connect your wallet to join
              <WalletConnectButton />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3">
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarImage src={avatarUrl || undefined} />
                  <AvatarFallback className="font-bold text-sm">{username?.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 text-left">
                  <p className="font-bold text-foreground text-sm">{username}</p>
                  <p className="text-muted-foreground text-xs">{userWalletAddress?.slice(0, 8)}…</p>
                </div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3 text-left text-xs text-blue-700 dark:text-blue-300 space-y-1">
                <p className="font-bold flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Automatic on-chain stake</p>
                <p>Clicking Join will open your wallet to approve <b>{challenge.stake} {challenge.token}</b> on Celo. The transaction is verified automatically.</p>
              </div>
              <Button className="w-full h-14 text-lg font-bold dd-btn text-primary-foreground rounded-2xl" onClick={handleStake} disabled={isStaking}>
                {isStaking ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Approving stake…</> : <><Zap className="mr-2 h-5 w-5" /> Join &amp; Stake {challenge.stake} {challenge.token}</>}
              </Button>
              <button onClick={handleSyncStake} disabled={isSyncing} className="w-full text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors py-1">
                {isSyncing ? "Checking on-chain…" : "Already staked? Sync my stake"}
              </button>
            </div>
          )}
        </div>
      </div>
    );
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
          invite={rematchInvite}
          myWallet={myWallet}
          onDismiss={handleInviteDismiss}
          countdown={inviteCountdown}
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
                  <Badge variant="secondary" className="text-[10px] uppercase">{challenge?.token}</Badge>
                </div>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">{challenge?.topic}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Per Player</p>
                <p className="font-bold text-sm">{displayStake} {challenge?.token}</p>
              </div>
              <div className="bg-primary/10 border border-primary/20 px-4 py-2 rounded-2xl flex flex-col items-center min-w-[90px]">
                <p className="text-[9px] font-black text-primary uppercase leading-none mb-1">Total Pool</p>
                <p className="text-xl font-black text-primary leading-none">{totalPool} <span className="text-xs">{challenge?.token}</span></p>
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
                    if (p.ready)      return { text: "Ready ✓",        cls: "text-emerald-500"      };
                    if (p.txVerified) return { text: "Stake verified",  cls: "text-blue-400"         };
                    if (isHost)       return { text: "Awaiting stake…", cls: "text-yellow-500"       };
                    return              { text: "Awaiting stake…",     cls: "text-muted-foreground"  };
                  })();
                  return (
                    // ── FIX: removed dd-btn class from the card border — it was causing
                    //         background/size changes when player goes ready ──
                    <div key={p.walletAddress} className={cn(
                      "flex flex-col items-center gap-2 rounded-2xl p-4 border text-center transition-colors",
                      p.ready
                        ? "border-emerald-400/40 bg-emerald-500/5"
                        : p.txVerified
                          ? "border-blue-400/30 bg-blue-500/5"
                          : "border-border bg-muted/20"
                    )}>
                      {/* ── FIX: Avatar uses avatarUrl (string, never undefined) ── */}
                      <Avatar className="h-14 w-14 border-2 border-border">
                        <AvatarImage src={p.avatarUrl || undefined} />
                        <AvatarFallback className="font-bold text-base">{p.username?.slice(0, 2).toUpperCase()}</AvatarFallback>
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
              onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/challenge/${code}`); toast.success("Invite link copied!"); }}
              className="w-full h-11 rounded-2xl border border-border bg-card text-sm font-bold hover:bg-muted transition-all flex items-center justify-center gap-2 text-foreground"
            >
              <Share2 className="h-4 w-4" /> Copy invite link
            </button>
          )}

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
                      <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Confirming…</>
                    ) : stakeVerifying ? (
                      <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Verifying on-chain…</>
                    ) : (
                      <><Zap className="mr-2 h-6 w-6" /> Stake {displayStake} {challenge?.token} to Play</>
                    )}
                  </Button>
                  <button onClick={handleSyncStake} disabled={isSyncing} className="w-full text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors py-1">
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
                  <span className={cn("font-bold uppercase tracking-widest text-sm", allReady ? "text-emerald-500" : "text-muted-foreground")}>
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
                      Secure Escrow
                    </p>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-blue-600 dark:text-blue-400">Your stake</span>
                        <span className="text-xs font-bold text-blue-800 dark:text-blue-200 font-mono">
                          {displayStake} {challenge?.token}
                        </span>
                      </div>
                      <div className="h-px bg-blue-200 dark:bg-blue-800/60" />
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-blue-600 dark:text-blue-400">Winner takes</span>
                        <span className="text-xs font-bold text-blue-800 dark:text-blue-200 font-mono">
                          {totalPool} {challenge?.token}
                        </span>
                      </div>
                    </div>
                    <p className="text-[10px] text-blue-500 dark:text-blue-500 leading-relaxed pt-0.5">
                      Funds are held in a smart contract until the game ends. 
                      Includes a <span className="font-semibold">0.25 {challenge?.token}</span> escrow fee.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
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
    </>
  );
}