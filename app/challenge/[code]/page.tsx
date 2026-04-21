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
  MessageSquare, Send,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Loading from "@/app/loading";
import { ERC20_ABI, QUIZ_HUB_ABI } from "@/lib/abis";
import { BrowserProvider, Contract, parseUnits, keccak256, toUtf8Bytes } from "ethers";
import { useSearchParams } from "next/navigation";
import { WalletConnectButton } from "@/components/wallet-connect";

// ── Config ────────────────────────────────────────────────────────────────────

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://faucetpay-backend.koyeb.app/";

function getWsBaseUrl(): string {
  if (typeof window === "undefined") return "wss://127.0.0.1:8000";
  return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "ws://127.0.0.1:8000"
    : "wss://identical-vivi-faucetdrops-41e9c56b.koyeb.app";
}

const CELO_CHAIN_ID = 42220;
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_STAKE_CONTRACT ?? "0x51fC56257f92FBd94DBC1B39330900285497dFF1";

const TOKEN_ADDRESSES: Record<string, string> = {
  cUSD: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
  USDC: "0xef4229c8c3250C675F21BCefa42f58EfbfF6002a",
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
  A: { bg: "bg-red-500 hover:bg-red-600",       shape: "▲", ring: "ring-red-400" },
  B: { bg: "bg-blue-500 hover:bg-blue-600",     shape: "◆", ring: "ring-blue-400" },
  C: { bg: "bg-yellow-500 hover:bg-yellow-600", shape: "●", ring: "ring-yellow-400" },
  D: { bg: "bg-green-500 hover:bg-green-600",   shape: "■", ring: "ring-green-400" },
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
  if (!tokenAddr) throw new Error(`Unsupported token: ${tokenSymbol}. Only cUSD, USDC, and USDT are accepted.`);

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
  chatBottomRef: React.RefObject<HTMLDivElement>;
  unreadCount: number;
}

function FloatingChat({ messages, myWallet, chatInput, setChatInput, onSend, chatBottomRef, unreadCount }: FloatingChatProps) {
  const [isOpen, setIsOpen]       = useState(false);
  const [localUnread, setLocalUnread] = useState(0);

  useEffect(() => {
    if (!isOpen) setLocalUnread(unreadCount);
  }, [unreadCount, isOpen]);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {isOpen && (
        <div className="w-80 flex flex-col bg-card border border-border rounded-2xl shadow-2xl overflow-hidden" style={{ height: "360px", animation: "slideUpFade 0.2s ease-out" }}>
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
                    <div className={cn("px-3 py-2 rounded-2xl text-xs max-w-[85%] break-words leading-relaxed", isMe ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-muted text-foreground rounded-tl-sm")}>
                      {m.text}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatBottomRef} />
          </div>
          <div className="flex gap-2 px-3 py-3 border-t border-border shrink-0">
            <input
              type="text" value={chatInput} onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && onSend()} placeholder="Say something…" maxLength={200}
              className="flex-1 bg-muted/50 border border-border rounded-xl px-3 py-2 text-xs text-foreground outline-none focus:border-primary/50 transition-colors"
            />
            <button onClick={onSend} disabled={!chatInput.trim()} className="w-8 h-8 rounded-xl bg-primary disabled:bg-muted/50 disabled:text-muted-foreground text-primary-foreground flex items-center justify-center transition-all active:scale-95 shrink-0">
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
      <button
        onClick={() => { if (isOpen) { setIsOpen(false); } else { setIsOpen(true); setLocalUnread(0); } }}
        className={cn("relative w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95", isOpen ? "bg-muted text-foreground border border-border" : "bg-primary text-primary-foreground")}
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

  const { address: userWalletAddress } = useWallet();
  const myWallet = useMemo(() => userWalletAddress?.toLowerCase() ?? "", [userWalletAddress]);

  const searchParams     = useSearchParams();
  const agreedStake      = searchParams.get("stake");
  const cameFromPreLobby = searchParams.get("agreed") === "1";

  // ── Core state ──────────────────────────────────────────────────────────────
  const [phase, setPhase]         = useState<GamePhase>("loading");
  const [challenge, setChallenge] = useState<any>(null);
  const [players, setPlayers]     = useState<PlayerState[]>([]);
  const [username, setUsername]   = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [hasJoined, setHasJoined] = useState(false);
  const [isCreator, setIsCreator] = useState(false);

  // ── Staking state ────────────────────────────────────────────────────────────
  const [isStaking, setIsStaking]           = useState(false);
  const [stakeTxHash, setStakeTxHash]       = useState<string | null>(null);
  const [stakeVerifying, setStakeVerifying] = useState(false);
  const [isSyncing, setIsSyncing]           = useState(false);

  // ── Game state ───────────────────────────────────────────────────────────────
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

  // ── Claim ────────────────────────────────────────────────────────────────────
  const [pendingClaims, setPendingClaims] = useState<any[]>([]);
  const [isClaiming, setIsClaiming]       = useState(false);

  // ── Chat ─────────────────────────────────────────────────────────────────────
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput]       = useState("");
  const [unreadCount, setUnreadCount]   = useState(0);
  const chatBottomRef                   = useRef<HTMLDivElement>(null);

  // ── Refs — ALL at top level ──────────────────────────────────────────────────
  const timerRef          = useRef<ReturnType<typeof setInterval> | null>(null);
  const wsRef             = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const creatorStakedRef  = useRef(false);
  const joinCalledRef     = useRef(false); // prevents double /join call from pre-lobby

  // ── Derived (safe to compute here — no hooks) ────────────────────────────────
  const myPlayerEntry = players.find(p => p.walletAddress.toLowerCase() === myWallet);
  const myTxVerified  = myPlayerEntry?.txVerified ?? false;
  const myReady       = myPlayerEntry?.ready ?? false;
  const displayStake  = agreedStake ?? challenge?.stake;

  // ─────────────────────────────────────────────────────────────────────────────
  //  ALL useEffect / useCallback HOOKS — must be above any early returns
  // ─────────────────────────────────────────────────────────────────────────────

  // ── Profile ──────────────────────────────────────────────────────────────────
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

        const playerEntries = Object.entries(d.challenge.players ?? {}).map(
          ([wallet, data]: [string, any]) => ({
            walletAddress: wallet, username: data.username,
            points: data.points, ready: data.ready, txVerified: data.txVerified,
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
    if (cameFromPreLobby && agreedStake && userWalletAddress && !hasJoined) {
      setHasJoined(true);
    }
  }, [cameFromPreLobby, agreedStake, userWalletAddress, hasJoined]);

  // ── Register challenger via /join in background (once username is ready) ─────
  useEffect(() => {
    if (!cameFromPreLobby || !agreedStake || !userWalletAddress || !challenge || !username) return;
    if (joinCalledRef.current) return;

    const isCreatorWallet = challenge.creator?.toLowerCase() === userWalletAddress.toLowerCase();
    if (isCreatorWallet) return;

    joinCalledRef.current = true;

    fetch(`${API_BASE_URL}/api/challenge/${code}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        walletAddress: userWalletAddress,
        username,
        txHash: "pre-lobby-agreed",
      }),
    })
      .then(r => r.json())
      .then(d => {
        setPlayers(prev => {
          if (prev.some(p => p.walletAddress.toLowerCase() === userWalletAddress.toLowerCase())) return prev;
          return [...prev, { walletAddress: userWalletAddress, username, points: 0, ready: false, txVerified: false }];
        });
        if (!d.success) console.warn("[auto-join] backend said:", d.detail);
        else toast.info(`Stake agreed at ${agreedStake} ${challenge.token} — approve the transaction to lock it in!`);
      })
      .catch(err => console.error("[auto-join] fetch failed:", err));
  }, [cameFromPreLobby, agreedStake, userWalletAddress, challenge, code, username]);

  // ── Timer ─────────────────────────────────────────────────────────────────────
  const startTimer = useCallback((startedAt: number, limit: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    const tick = () => {
      const rem = Math.max(0, limit - (Date.now() - startedAt) / 1000);
      setTimeLeft(rem);
      if (rem <= 0 && timerRef.current) clearInterval(timerRef.current);
    };
    tick();
    timerRef.current = setInterval(tick, 200);
  }, []);

  // ── Send stake_confirmed over WS ──────────────────────────────────────────────
  const sendStakeConfirmed = useCallback((txHash: string) => {
    if (!userWalletAddress) return;
    setStakeTxHash(txHash);
    setStakeVerifying(true);
    wsRef.current?.send(JSON.stringify({ type: "stake_confirmed", walletAddress: userWalletAddress, txHash }));
  }, [userWalletAddress]);

  // ── WebSocket ─────────────────────────────────────────────────────────────────
  const connectWS = useCallback(() => {
    if (!code || !userWalletAddress) return;
    if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) return;

    const ws = new WebSocket(`${getWsBaseUrl()}/ws/challenge/${code}`);
    wsRef.current = ws;
    ws.onopen = () => { reconnectAttempts.current = 0; };

    ws.onmessage = (ev) => {
      let msg: any;
      try { msg = JSON.parse(ev.data); } catch { return; }

      switch (msg.type) {
        case "state_sync": {
          const c = msg.challenge;
          setChallenge(c);
          setPlayers(prev => {
            const incoming = Object.entries(c.players ?? {}).map(([w, d]: [string, any]) => ({
              walletAddress: w, username: d.username, points: d.points, ready: d.ready, txVerified: d.txVerified,
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
            return [...prev, { walletAddress: p.walletAddress, username: p.username, points: 0, ready: false, txVerified: false }];
          });
          toast.info(`${p.username} joined the lobby!`);
          break;
        }
        case "stake_verified": {
          setPlayers(prev => {
            const wallet = msg.wallet.toLowerCase();
            const exists = prev.some(p => p.walletAddress.toLowerCase() === wallet);
            if (!exists) return [...prev, { walletAddress: wallet, username, points: 0, ready: false, txVerified: true }];
            return prev.map(p => p.walletAddress.toLowerCase() === wallet ? { ...p, txVerified: true } : p);
          });
          if (msg.wallet.toLowerCase() === myWallet) {
            setStakeVerifying(false);
            toast.success("Stake verified ✓ — click Ready!");
          }
          break;
        }
        case "stake_failed": {
          if (msg.wallet.toLowerCase() === myWallet) {
            setStakeVerifying(false);
            toast.error("On-chain stake verification failed. Please retry.");
          }
          break;
        }
        case "player_ready": {
          setPlayers(prev => prev.map(p => p.walletAddress === msg.wallet ? { ...p, ready: true } : p));
          break;
        }
        case "game_start": {
          toast.success(msg.message || "Game starting!");
          break;
        }
        case "round_announce": {
          setCurrentRoundName(msg.round);
          setPhase("countdown");
          setCountdownVal(3);
          break;
        }
        case "question": {
          if (timerRef.current) clearInterval(timerRef.current);
          const localStart = Date.now();
          setCurrentQ({
            roundIndex: msg.roundIndex, questionIndex: msg.questionIndex,
            totalQuestions: msg.totalQuestions, question: msg.data.question,
            options: msg.data.options, timeLimit: msg.data.timeLimit, startedAt: localStart,
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
          if (timerRef.current) clearInterval(timerRef.current);
          setTimeLeft(0);
          setRevealCorrectId(msg.correctId);
          setQuestionScores(msg.questionScores ?? {});
          setTotalScores(msg.totalScores ?? {});
          setPlayers(prev => prev.map(p => ({ ...p, points: msg.totalScores?.[p.walletAddress] ?? p.points })));
          setPhase("reveal");
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
          if (msg.winner === myWallet) { setShowConfetti(true); setTimeout(() => setShowConfetti(false), 6000); }
          break;
        }
        case "chat": {
          setChatMessages(prev => [...prev, msg]);
          setUnreadCount(prev => prev + 1);
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
  }, [code, userWalletAddress, myWallet, startTimer, username]);

  useEffect(() => {
    if (!userWalletAddress) return;
    connectWS();
    return () => { wsRef.current?.close(); wsRef.current = null; };
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
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress: userWalletAddress, username, txHash }),
        });
        const d = await res.json();
        if (!d.success) throw new Error(d.detail ?? "Join failed");
        setHasJoined(true);
        setPlayers(prev => {
          if (prev.some(p => p.walletAddress.toLowerCase() === myWallet)) return prev;
          return [...prev, { walletAddress: userWalletAddress, username, points: 0, ready: false, txVerified: true }];
        });
      }

      sendStakeConfirmed(txHash);
      toast.success("Stake confirmed! Click Ready to start.");
    } catch (err: any) {
      toast.error(err?.message ?? "Stake failed.");
    } finally {
      setIsStaking(false);
    }
  }, [userWalletAddress, challenge, hasJoined, code, username, sendStakeConfirmed, agreedStake, myWallet]);

  const handleReady = useCallback(() => {
    if (!userWalletAddress) return;
    wsRef.current?.send(JSON.stringify({ type: "ready", walletAddress: userWalletAddress }));
  }, [userWalletAddress]);

  const handleSelectAnswer = useCallback((optId: string) => {
    if (!currentQ || timeLeft <= 0 || hasSubmitted) return;
    const timeTaken = currentQ.timeLimit - timeLeft;
    wsRef.current?.send(JSON.stringify({
      type: "submit_answer", walletAddress: userWalletAddress,
      roundIndex: currentQ.roundIndex, questionIndex: currentQ.questionIndex,
      answerId: optId, timeTaken,
    }));
    setSelectedId(optId);
    setHasSubmitted(true);
  }, [currentQ, timeLeft, hasSubmitted, userWalletAddress]);

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
          { internalType: "bytes32",  name: "id",             type: "bytes32"  },
          { internalType: "address",  name: "token",          type: "address"  },
          { internalType: "uint256",  name: "stakePerPlayer", type: "uint256"  },
          { internalType: "uint256",  name: "totalStaked",    type: "uint256"  },
          { internalType: "address",  name: "player1",        type: "address"  },
          { internalType: "address",  name: "player2",        type: "address"  },
          { internalType: "address",  name: "winner",         type: "address"  },
          { internalType: "bool",     name: "resolved",       type: "bool"     },
          { internalType: "bool",     name: "rewardClaimed",  type: "bool"     },
          { internalType: "uint256",  name: "createdAt",      type: "uint256"  },
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
      if (wallet === player1)       hasStaked = totalStaked >= stakePerPlayer;
      else if (wallet === player2)  hasStaked = totalStaked >= stakePerPlayer * 2n;
      else                          hasStaked = totalStaked >= stakePerPlayer * 2n;

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

      wsRef.current?.send(JSON.stringify({ type: "stake_confirmed", walletAddress: userWalletAddress, txHash: "sync-recovery" }));

      setPlayers(prev => {
        const w      = userWalletAddress.toLowerCase();
        const exists = prev.some(p => p.walletAddress.toLowerCase() === w);
        if (!exists) return [...prev, { walletAddress: userWalletAddress, username, points: 0, ready: false, txVerified: true }];
        return prev.map(p => p.walletAddress.toLowerCase() === w ? { ...p, txVerified: true } : p);
      });

      toast.success("Stake synced! Click 'I'm Ready' to continue.");
    } catch (err: any) {
      toast.error(err?.message ?? "Could not read on-chain data.");
    } finally {
      setIsSyncing(false);
    }
  }, [userWalletAddress, challenge, code, username, hasJoined]);

  const handleRematch = useCallback(async () => {
    if (!userWalletAddress) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/challenge/${code}/rematch`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requesterWallet: userWalletAddress }),
      });
      const d = await res.json();
      if (d.success) { toast.success(`Rematch! Code: ${d.newCode}`); router.push(`/challenge/${d.newCode}`); }
      else toast.error(d.detail || "Rematch failed");
    } catch { toast.error("Could not start rematch"); }
  }, [userWalletAddress, code, router]);

  // ── Derived values (no hooks, safe after all hooks) ───────────────────────────
  const myClaim   = pendingClaims.find(c => c.code === code);
  const totalPool = challenge
    ? (agreedStake ? (parseFloat(agreedStake) * 2).toFixed(2) : (challenge.stake * 2).toFixed(2))
    : "0.00";

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
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm shrink-0", i === 0 ? "bg-yellow-400 text-yellow-900" : "bg-muted text-muted-foreground")}>
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
              <Button className="w-full h-11 bg-yellow-500 hover:bg-yellow-400 text-yellow-950 font-bold border-0" onClick={() => handleClaim(code)} disabled={isClaiming}>
                {isClaiming ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Claiming…</> : "Claim Reward"}
              </Button>
            </div>
          )}
          <div className="flex flex-col gap-3">
            {canRematch && (
              <Button className="h-12 bg-primary text-primary-foreground font-bold border-0" onClick={handleRematch}>
                🔁 Request Rematch
              </Button>
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
    );
  }

  if (phase === "countdown") {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground text-xl uppercase tracking-widest font-black">Round: {currentRoundName}</p>
          <div key={countdownVal} className="text-[10rem] font-black text-primary leading-none" style={{ animation: "zoomFade 0.9s ease-out forwards" }}>
            {countdownVal}
          </div>
        </div>
        <style>{`@keyframes zoomFade{0%{transform:scale(1.5);opacity:0}30%{transform:scale(1);opacity:1}80%{opacity:1}100%{transform:scale(0.8);opacity:0}}`}</style>
      </div>
    );
  }

  if ((phase === "question" || phase === "reveal") && currentQ) {
    const isReveal = phase === "reveal";
    return (
      <div className="fixed inset-0 bg-background flex flex-col overflow-hidden z-50">
        {!isReveal && <LinearTimer seconds={timeLeft} total={currentQ.timeLimit} />}
        <div className="flex items-center justify-between px-4 py-3 bg-card border-b border-border shrink-0">
          <Badge variant="outline" className="font-mono">Q{currentQ.questionIndex + 1}/{currentQ.totalQuestions}</Badge>
          <span className="text-xs font-bold text-muted-foreground capitalize">{currentRoundName} round</span>
          <div className="flex items-center gap-1 font-bold text-primary bg-primary/10 px-3 py-1 rounded-full text-sm">
            <Zap className="h-3.5 w-3.5" /> {myPlayerEntry?.points ?? 0}
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center px-4 py-6 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground leading-snug max-w-xl">{currentQ.question}</h2>
        </div>
        {isReveal && selectedId && (
          <div className="flex justify-center px-4 pb-2 shrink-0">
            <div className={cn("px-8 py-3 rounded-full font-black text-lg border-2",
              selectedId === revealCorrectId
                ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-400"
                : "bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border-red-400"
            )}>
              {selectedId === revealCorrectId ? `✓ Correct! +${questionScores[myWallet] ?? 0}` : "✗ Incorrect"}
            </div>
          </div>
        )}
        <div className="w-full max-w-2xl mx-auto px-4 grid grid-cols-1 md:grid-cols-2 gap-3 pb-8 shrink-0">
          {currentQ.options.map(opt => {
            const style      = OPTION_STYLES[opt.id] ?? OPTION_STYLES.A;
            const isSelected = selectedId === opt.id;
            const isCorrect  = isReveal && opt.id === revealCorrectId;
            const isWrong    = isReveal && isSelected && opt.id !== revealCorrectId;
            return (
              <button key={opt.id} disabled={isReveal || timeLeft <= 0 || hasSubmitted} onClick={() => handleSelectAnswer(opt.id)}
                className={cn("relative flex items-center justify-between px-6 py-5 rounded-2xl text-white font-bold text-lg transition-all duration-150 active:scale-[0.98] shadow-md", style.bg,
                  isSelected && !isReveal && `ring-4 ${style.ring} ring-offset-2 ring-offset-background`,
                  isReveal && !isCorrect && !isWrong && "opacity-40 grayscale",
                  isCorrect && "ring-4 ring-white brightness-110",
                  isWrong   && "opacity-70 ring-4 ring-red-400",
                )}>
                <div className="flex items-center gap-4">
                  <span className="text-2xl opacity-90">{style.shape}</span>
                  <span className="leading-snug">{opt.text}</span>
                </div>
                {isCorrect  && <Check className="h-6 w-6 shrink-0" />}
                {isWrong    && <X     className="h-6 w-6 shrink-0" />}
                {isSelected && !isReveal && (
                  <div className="w-7 h-7 rounded-full bg-white/30 flex items-center justify-center shrink-0">
                    <Check className="h-4 w-4" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
        <FloatingChat messages={chatMessages} myWallet={myWallet} chatInput={chatInput} setChatInput={setChatInput} onSend={handleSendChat} chatBottomRef={chatBottomRef} unreadCount={unreadCount} />
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

  // ─────────────────────────────────────────────────────────────────────────────
  //  PRE-JOIN — only for non-creator joiners arriving directly (not from pre-lobby)
  // ─────────────────────────────────────────────────────────────────────────────
  const amCreator = challenge && userWalletAddress &&
    challenge.creator?.toLowerCase() === userWalletAddress.toLowerCase();

  if (!hasJoined && !amCreator && phase === "lobby") {
    // Coming from pre-lobby — optimistic effect hasn't fired yet, return null for one tick
    if (cameFromPreLobby && agreedStake && userWalletAddress) {
      return null;
    }

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
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 rounded-xl px-4 py-3 text-amber-700 dark:text-amber-300 text-sm font-medium">
              Connect your wallet to join
              <WalletConnectButton/>
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
                <p className="font-bold flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" /> Automatic on-chain stake
                </p>
                <p>Clicking Join will open your wallet to approve <b>{challenge.stake} {challenge.token}</b> on Celo. The transaction is verified automatically.</p>
              </div>
              <Button className="w-full h-14 text-lg font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl" onClick={handleStake} disabled={isStaking}>
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
    <div className="min-h-screen bg-background flex flex-col">
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/challenge")} className="hover:bg-muted p-2 rounded-full transition-colors">
              <ArrowLeft className="h-5 w-5" />
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
                  if (p.ready)      return { text: "Ready ✓",        cls: "text-emerald-500" };
                  if (p.txVerified) return { text: "Stake verified", cls: "text-blue-400" };
                  if (isHost)       return { text: "Awaiting stake…", cls: "text-yellow-500" };
                  return              { text: "Awaiting stake…",     cls: "text-muted-foreground" };
                })();
                return (
                  <div key={p.walletAddress} className={cn("flex flex-col items-center gap-2 rounded-2xl p-4 border text-center transition-all",
                    p.ready ? "border-emerald-400/40 bg-emerald-500/5" : p.txVerified ? "border-blue-400/30 bg-blue-500/5" : "border-border bg-muted/20"
                  )}>
                    <Avatar className="h-14 w-14 border-2 border-border">
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
                  className="w-full h-16 text-lg font-black bg-yellow-500 hover:bg-yellow-400 text-yellow-950 rounded-2xl shadow-[0_4px_0_rgb(161,120,0)] active:translate-y-1 active:shadow-none transition-all"
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
                className="w-full h-16 text-lg font-black bg-emerald-500 hover:bg-emerald-400 text-white rounded-2xl shadow-[0_4px_0_rgb(16,120,60)] active:translate-y-1 active:shadow-none transition-all"
                onClick={handleReady}
              >
                <Check className="mr-2 h-6 w-6" /> I'm Ready
              </Button>
            )}

            {myReady && (
              <div className="w-full h-16 flex items-center justify-center gap-3 rounded-2xl bg-muted/50 border-2 border-dashed border-border">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="font-bold text-muted-foreground uppercase tracking-widest text-sm">Waiting for Opponent…</span>
              </div>
            )}

            {!myTxVerified && (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900">
                <ShieldCheck className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                  Your wallet will prompt you to approve <strong>{displayStake} {challenge?.token}</strong> on Celo.
                  The contract holds funds until the game ends — winner takes the pool of <strong>{totalPool} {challenge?.token}</strong>.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {hasJoined && (
        <FloatingChat messages={chatMessages} myWallet={myWallet} chatInput={chatInput} setChatInput={setChatInput} onSend={handleSendChat} chatBottomRef={chatBottomRef} unreadCount={unreadCount} />
      )}
    </div>
  );
}