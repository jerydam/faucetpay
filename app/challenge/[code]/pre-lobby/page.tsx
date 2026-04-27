"use client";

/**
 * /app/challenge/[code]/pre-lobby/page.tsx
 *
 * Negotiation arena. Challengers arrive, submit stake offers, and the creator
 * can accept OR counter a specific challenger's offer.
 */

import React, {
  useState, useEffect, useRef, useCallback, useMemo,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { useWallet } from "@/hooks/use-wallet";
import { Header } from "@/components/header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, ArrowLeft, Zap, Users, ChevronUp, ChevronDown,
  Check, Trophy, Clock, Lock, Swords, Crown, X,
  AlertCircle, ArrowRight, MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://faucetpay-backend.koyeb.app";

function getWsBase() {
  if (typeof window === "undefined") return "wss://127.0.0.1:8000";
  return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "ws://127.0.0.1:8000"
    : "wss://faucetpay-backend.koyeb.app";
}

function fmt(n: number) {
  return n % 1 === 0 ? n.toString() : n.toFixed(n < 1 ? 2 : 1);
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Challenge {
  code: string;
  topic: string;
  creator: string;
  creatorName: string;
  stake: number;
  token: string;
  chainId: number;
  status: string;
  isPublic: boolean;
}

interface Offer {
  wallet: string;
  username: string;
  amount: number;
  sentAt: string;
}

interface CounterOffer {
  fromWallet: string;
  fromName: string;
  amount: number;
  sentAt: string;
  targetWallet: string;
}

type PageState =
  | "loading"
  | "idle"
  | "pending"
  | "countered"
  | "accepted"
  | "rejected"
  | "creator"
  | "error";

// ── Animated pulse ────────────────────────────────────────────────────────────

function Pulse({ children }: { children: React.ReactNode }) {
  const [bump, setBump] = useState(false);
  useEffect(() => {
    setBump(true);
    const t = setTimeout(() => setBump(false), 300);
    return () => clearTimeout(t);
  }, [children]);
  return (
    <span className={cn("inline-block transition-transform duration-150", bump && "scale-110 text-primary")}>
      {children}
    </span>
  );
}

// ── Counter-offer banner ──────────────────────────────────────────────────────

function CounterOfferBanner({
  counter, token, onAccept, onDecline, submitting,
}: {
  counter: CounterOffer;
  token: string;
  onAccept: (amount: number) => void;
  onDecline: () => void;
  submitting: boolean;
}) {
  return (
    <div className="bg-blue-500/10 border-2 border-blue-400/50 rounded-3xl overflow-hidden">
      <div className="px-5 pt-4 pb-3 border-b border-blue-400/20">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-blue-500" />
          <p className="text-sm font-black text-foreground">Counter Offer from {counter.fromName}</p>
          <span className="ml-auto text-[10px] text-muted-foreground">{timeAgo(counter.sentAt)}</span>
        </div>
      </div>
      <div className="px-5 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground font-bold">Proposed stake</span>
          <span className="font-black text-2xl text-foreground tabular-nums">
            <Pulse>{fmt(counter.amount)}</Pulse>
            <span className="text-sm ml-1 font-bold text-muted-foreground">{token}</span>
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onDecline}
            disabled={submitting}
            className="flex-1 py-3 rounded-2xl border-2 border-border bg-card text-foreground font-black text-sm hover:bg-muted transition-all active:scale-[0.99] disabled:opacity-50"
          >
            <X className="inline mr-1.5 h-4 w-4" /> Decline
          </button>
          <button
            onClick={() => onAccept(counter.amount)}
            disabled={submitting}
            className="flex-2 flex-1 py-3 rounded-2xl bg-blue-500 hover:bg-blue-400 text-white font-black text-sm transition-all active:scale-[0.99] disabled:opacity-50"
          >
            {submitting
              ? <Loader2 className="inline h-4 w-4 animate-spin" />
              : <><Check className="inline mr-1.5 h-4 w-4" /> Accept {fmt(counter.amount)} {token}</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Offer Card ────────────────────────────────────────────────────────────────

function OfferCard({
  offer, token, onAccept, onCounter, accepting, isSelf, isCounterTarget,
}: {
  offer: Offer;
  token: string;
  onAccept: (offer: Offer) => void;
  onCounter: (offer: Offer) => void;
  accepting: boolean;
  isSelf: boolean;
  isCounterTarget: boolean;
}) {
  return (
    <div className={cn(
      "flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 rounded-2xl border transition-all duration-200",
      "bg-card border-border hover:border-primary/40 shadow-sm",
      isSelf && "opacity-50 pointer-events-none",
      isCounterTarget && "border-blue-400/60 bg-blue-500/5",
    )}>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Avatar className="h-9 w-9 shrink-0">
          <AvatarFallback className="text-xs font-black bg-primary/10 text-primary">
            {offer.username.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-foreground truncate">
            {offer.username}
            {isSelf && <span className="ml-2 text-[10px] text-muted-foreground">(you)</span>}
            {isCounterTarget && (
              <span className="ml-2 text-[10px] font-black text-blue-500 uppercase tracking-wider">Countering</span>
            )}
          </p>
          <p className="text-[10px] text-muted-foreground font-mono truncate">
            {offer.wallet.slice(0, 6)}…{offer.wallet.slice(-4)}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-black text-lg text-foreground tabular-nums">
            <Pulse>{fmt(offer.amount)}</Pulse>
            <span className="text-xs font-bold text-muted-foreground ml-1">{token}</span>
          </p>
          <p className="text-[10px] text-muted-foreground">{timeAgo(offer.sentAt)}</p>
        </div>
      </div>
      {!isSelf && (
        <div className="flex sm:flex-col gap-1.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border sm:ml-2">
          <button
            onClick={() => onAccept(offer)}
            disabled={accepting}
            className={cn(
              "flex-1 flex items-center justify-center gap-1 px-3 py-2 sm:py-1.5 rounded-xl text-xs font-black transition-all",
              "bg-emerald-500 hover:bg-emerald-400 text-white active:scale-95",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            )}
          >
            {accepting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            Lock In
          </button>
          <button
            onClick={() => onCounter(offer)}
            disabled={accepting}
            className={cn(
              "flex-1 flex items-center justify-center gap-1 px-3 py-2 sm:py-1.5 rounded-xl text-xs font-black transition-all",
              isCounterTarget
                ? "bg-blue-500 hover:bg-blue-400 text-white"
                : "border-2 border-blue-400/50 text-blue-500 hover:bg-blue-500/10",
              "active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed",
            )}
          >
            <Zap className="h-3 w-3" /> Counter
          </button>
        </div>
      )}
    </div>
  );
}

// ── Stake Amount Input (shared) ───────────────────────────────────────────────
// Free-type input that clamps on blur, with +/- buttons stepping by 0.01

function StakeInput({
  value,
  onChange,
  token,
  label,
  borderClass,
}: {
  value: number;
  onChange: (v: number) => void;
  token: string;
  label?: string;
  borderClass?: string;
}) {
  const [raw, setRaw] = useState(String(value));

  // Keep raw in sync when value changes externally (e.g. quick-pick)
  useEffect(() => {
    setRaw(String(value));
  }, [value]);

  const commit = (str: string) => {
    const parsed = parseFloat(str);
    const clamped = isNaN(parsed) || parsed < 0.01 ? 0.01 : Math.round(parsed * 100) / 100;
    onChange(clamped);
    setRaw(String(clamped));
  };

  return (
    <div className="flex items-center gap-3">
      {/* Decrement */}
      <button
        onClick={() => { const next = Math.max(0.01, Math.round((value - 0.01) * 100) / 100); onChange(next); setRaw(String(next)); }}
        className="w-12 h-12 rounded-2xl border-2 border-border bg-card hover:bg-muted flex items-center justify-center active:scale-95 transition-all shrink-0"
      >
        <ChevronDown className="h-5 w-5 text-muted-foreground" />
      </button>

      {/* Input */}
      <div className="flex-1 relative">
        {label && (
          <span className="absolute left-3 top-2.5 text-[10px] font-black uppercase tracking-wider pointer-events-none"
            style={{ color: "var(--dd-blue)" }}>
            {label}
          </span>
        )}
        <input
          type="number"
          min="0.01"
          step="0.01"
          value={raw}
          onChange={e => setRaw(e.target.value)}
          onBlur={e => commit(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") commit((e.target as HTMLInputElement).value); }}
          className={cn(
            "w-full h-16 rounded-2xl border-2 bg-background text-center",
            "text-3xl font-black text-foreground outline-none transition-colors focus:border-primary/60",
            borderClass ?? "border-border",
            label && "pt-4",
          )}
        />
        <span className="absolute right-4 bottom-3 text-sm font-bold text-muted-foreground pointer-events-none">
          {token}
        </span>
      </div>

      {/* Increment */}
      <button
        onClick={() => { const next = Math.round((value + 0.01) * 100) / 100; onChange(next); setRaw(String(next)); }}
        className="w-12 h-12 rounded-2xl border-2 border-border bg-card hover:bg-muted flex items-center justify-center active:scale-95 transition-all shrink-0"
      >
        <ChevronUp className="h-5 w-5 text-muted-foreground" />
      </button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PreLobbyPage() {
  const params = useParams();
  const router = useRouter();
  const code   = ((params.code as string) ?? "").toUpperCase();
  const { address: userWalletAddress } = useWallet();
  const myWallet = useMemo(() => userWalletAddress?.toLowerCase() ?? "", [userWalletAddress]);

  const [challenge, setChallenge]     = useState<Challenge | null>(null);
  const [username, setUsername]       = useState("");
  const [pageState, setPageState]     = useState<PageState>("loading");
  const [offers, setOffers]           = useState<Offer[]>([]);
  const [myOffer, setMyOffer]         = useState<number>(0);
  const [submitting, setSubmitting]   = useState(false);
  const [accepting, setAccepting]     = useState(false);
  const [countdown, setCountdown]     = useState(120);
  const [lockedAmount, setLockedAmount] = useState<number | null>(null);

  const [pendingCounter, setPendingCounter] = useState<CounterOffer | null>(null);
  const [counterTarget, setCounterTarget]   = useState<Offer | null>(null);

  const wsRef = useRef<WebSocket | null>(null);

  const amCreator = useMemo(
    () => challenge?.creator?.toLowerCase() === myWallet,
    [challenge, myWallet],
  );

  // ── Load challenge ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!code) return;
    fetch(`${API_BASE_URL}/api/challenge/${code}`)
      .then(r => r.json())
      .then(d => {
        if (!d.success) { toast.error("Challenge not found"); router.push("/challenge"); return; }
        const c: Challenge = d.challenge;
        setChallenge(c);
        setMyOffer(c.stake);
        if (c.status === "active" || c.status === "finished") {
          router.replace(`/challenge/${code}`);
          return;
        }
        setPageState("loading");
      })
      .catch(() => { toast.error("Failed to load challenge"); setPageState("error"); });
  }, [code, router]);

  // ── Username ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userWalletAddress) return;
    fetch(`${API_BASE_URL}/api/players/${userWalletAddress}`)
      .then(r => r.json())
      .then(d => setUsername(d.username ?? `User${userWalletAddress.slice(-4).toUpperCase()}`))
      .catch(() => setUsername(`User${userWalletAddress.slice(-4).toUpperCase()}`));
  }, [userWalletAddress]);

  // ── Resolve page state ───────────────────────────────────────────────────
  useEffect(() => {
    if (!challenge || !myWallet) return;
    if (pageState !== "loading") return;
    setPageState(amCreator ? "creator" : "idle");
  }, [challenge, myWallet, amCreator, pageState]);

  // ── Countdown ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!["idle","creator","pending","countered"].includes(pageState)) return;
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, pageState]);

  // ── WebSocket ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!code || !myWallet) return;
    const ws = new WebSocket(`${getWsBase()}/ws/challenge/${code}`);
    wsRef.current = ws;

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);

        if (msg.type === "pre_lobby_offer") {
          const incoming: Offer = {
            wallet:   msg.wallet,
            username: msg.username,
            amount:   msg.amount,
            sentAt:   msg.sentAt ?? new Date().toISOString(),
          };
          setOffers(prev => {
            const without = prev.filter(o => o.wallet.toLowerCase() !== incoming.wallet.toLowerCase());
            return [incoming, ...without].sort((a, b) => b.amount - a.amount);
          });
        }

        if (msg.type === "pre_lobby_counter") {
          const counter: CounterOffer = {
            fromWallet:   msg.fromWallet,
            fromName:     msg.fromName ?? "Creator",
            amount:       msg.amount,
            sentAt:       msg.sentAt ?? new Date().toISOString(),
            targetWallet: msg.targetWallet,
          };
          if (!amCreator && counter.targetWallet?.toLowerCase() === myWallet) {
            setPendingCounter(counter);
            setMyOffer(counter.amount);
            setPageState("countered");
            toast.info(`${counter.fromName} countered with ${fmt(counter.amount)} ${challenge?.token}`);
          }
        }

        if (msg.type === "offer_accepted" || msg.type === "pre_lobby_accepted") {
          const winner = (msg.winner ?? msg.challenger ?? "").toLowerCase();
          const amount: number = msg.amount;
          setLockedAmount(amount);
          const iWon = amCreator ? true : winner === myWallet;
          if (iWon) {
            setPageState("accepted");
            toast.success("🎉 Deal locked! Heading to lobby…");
            setTimeout(() => router.push(`/challenge/${code}?stake=${amount}&agreed=1`), 1800);
          } else {
            setPageState("rejected");
          }
        }

        if (msg.type === "pre_lobby_offers_snapshot") {
          setOffers(msg.offers ?? []);
        }
      } catch {}
    };

    return () => { ws.close(); wsRef.current = null; };
  }, [code, myWallet, amCreator, challenge, router]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleSubmitOffer = useCallback(async (amount: number) => {
    if (!myWallet || submitting || amCreator) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/challenge/${code}/offer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: myWallet, username, amount }),
      });
      const d = await res.json();
      if (!d.success) throw new Error(d.detail ?? "Offer failed");
      if (d.accepted) {
        setLockedAmount(d.amount);
        setPageState("accepted");
        toast.success(`✅ Deal at ${fmt(d.amount)} ${challenge?.token}!`);
        setTimeout(() => router.push(`/challenge/${code}?stake=${d.amount}&agreed=1`), 1800);
      } else {
        setPendingCounter(null);
        setPageState("pending");
        toast.info(`Offer sent: ${fmt(amount)} ${challenge?.token}`);
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Could not send offer");
    } finally {
      setSubmitting(false);
    }
  }, [myWallet, submitting, amCreator, challenge, code, username, router]);

  const handleSendCounter = useCallback(async (amount: number, target: Offer) => {
    if (!myWallet || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/challenge/${code}/counter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creatorWallet: myWallet,
          creatorName:   username,
          targetWallet:  target.wallet,
          amount,
        }),
      });
      const d = await res.json();
      if (!d.success) throw new Error(d.detail ?? "Counter failed");
      toast.info(`Counter sent to ${target.username}: ${fmt(amount)} ${challenge?.token}`);
    } catch (err: any) {
      toast.error(err?.message ?? "Could not send counter");
    } finally {
      setSubmitting(false);
    }
  }, [myWallet, submitting, challenge, code, username]);

  const handleAcceptOffer = useCallback(async (offer: Offer) => {
    if (!myWallet || accepting) return;
    if (offer.wallet.toLowerCase() === myWallet) { toast.error("You can't accept your own offer."); return; }
    setAccepting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/challenge/${code}/pre-lobby-accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creatorWallet:    myWallet,
          challengerWallet: offer.wallet,
          amount:           offer.amount,
        }),
      });
      const d = await res.json();
      if (!d.success) throw new Error(d.detail ?? "Accept failed");
    } catch (err: any) {
      toast.error(err?.message ?? "Could not accept offer");
      setAccepting(false);
    }
  }, [myWallet, accepting, code]);

  const handleDeclineCounter = useCallback(() => {
    setPendingCounter(null);
    setPageState("idle");
    toast.info("Counter declined — you can send a new offer.");
  }, []);

  const handleSelectCounterTarget = useCallback((offer: Offer) => {
    setCounterTarget(prev => prev?.wallet === offer.wallet ? null : offer);
    setMyOffer(offer.amount);
  }, []);

  // ── Quick pick amounts — never show values below min stake ────────────────
  const quickPicks = useMemo(() => {
    if (!challenge) return [];
    const s = challenge.stake;
    return [s, Math.round(s * 1.5 * 100) / 100, Math.round(s * 2 * 100) / 100, Math.round(s * 3 * 100) / 100]
      .filter(v => v >= 0.01);
  }, [challenge]);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER STATES
  // ─────────────────────────────────────────────────────────────────────────

  if (pageState === "loading" || !challenge) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <Header pageTitle="Pre-Lobby" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (pageState === "error") {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <Header pageTitle="Pre-Lobby" />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <p className="text-foreground font-bold text-lg">Challenge not found</p>
          <button onClick={() => router.back()} className="text-sm text-primary underline underline-offset-2">
            Back to Hub
          </button>
        </div>
      </div>
    );
  }

  if (pageState === "rejected") {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <Header pageTitle="Pre-Lobby" />
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4 text-center">
          <div className="text-6xl">😤</div>
          <div>
            <h2 className="text-2xl font-black text-foreground">Slot Taken</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Another challenger was accepted for {challenge.topic}.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => router.push("/challenge")}
              className="px-5 py-3 rounded-2xl border-2 border-border bg-card font-bold text-sm text-foreground hover:bg-muted transition-all"
            >
              Browse Hub
            </button>
            <button
              onClick={() => router.push("/challenge/create-quiz")}
              className="px-5 py-3 rounded-2xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition-all"
            >
              Create Your Own
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (pageState === "accepted") {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <Header pageTitle="Pre-Lobby" />
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4 text-center">
          <div className="text-7xl animate-bounce">🎉</div>
          <div>
            <h2 className="text-2xl font-black text-foreground">Deal Locked!</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Stake agreed at{" "}
              <strong className="text-foreground">{fmt(lockedAmount ?? 0)} {challenge.token}</strong>.
              Heading to the lobby…
            </p>
          </div>
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MAIN PRE-LOBBY UI
  // ─────────────────────────────────────────────────────────────────────────

  const isCreatorView   = pageState === "creator";
  const hasPendingOffer = pageState === "pending";
  const hasCounter      = pageState === "countered";
  const totalPool       = (myOffer * 2).toFixed(2);
  const countdownMin    = Math.floor(countdown / 60);
  const countdownSec    = countdown % 60;
  const countdownUrgent = countdown <= 30;

  return (
    <div className="min-h-screen bg-background">

      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
          <button
            onClick={() => router.push("/challenge")}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors font-bold text-sm"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono font-black">{code}</Badge>
            <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/30 text-[10px] font-bold">
              PRE-LOBBY
            </Badge>
          </div>

          <div className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-black tabular-nums transition-colors",
            countdownUrgent
              ? "border-red-400/40 bg-red-500/10 text-red-500"
              : "border-border bg-muted/50 text-muted-foreground",
          )}>
            <Clock className="h-3.5 w-3.5" />
            {String(countdownMin).padStart(2, "0")}:{String(countdownSec).padStart(2, "0")}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5 pb-28">

        {/* Challenge info card */}
        <div className="bg-card border-2 border-border rounded-3xl overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-primary/60 via-primary to-primary/60" />
          <div className="p-5">
            <div className="flex items-start gap-4">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 text-2xl">
                🧠
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="font-black text-xl text-foreground leading-tight line-clamp-2">
                  {challenge.topic}
                </h1>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <Crown className="h-3.5 w-3.5 text-blue-500" />
                    <span className="text-xs font-bold text-muted-foreground">{challenge.creatorName}</span>
                  </div>
                  <span className="text-muted-foreground/30">·</span>
                  <Badge variant="secondary" className="text-[10px]">{challenge.token}</Badge>
                  {!challenge.isPublic && (
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <Lock className="h-2.5 w-2.5" /> Private
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between px-4 py-3 rounded-2xl bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-blue-500" />
                <span className="text-xs font-bold text-muted-foreground">Opening stake</span>
              </div>
              <div className="text-right">
                <span className="font-black text-lg text-foreground">{fmt(challenge.stake)}</span>
                <span className="text-xs text-muted-foreground ml-1">{challenge.token} per player</span>
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            CREATOR VIEW
        ═══════════════════════════════════════════════════════════════════ */}
        {isCreatorView && (
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-black text-foreground flex items-center gap-2">
                  <Swords className="h-4 w-4 text-primary" />
                  Incoming Challengers
                  {offers.length > 0 && (
                    <span className="ml-1 bg-primary text-primary-foreground text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center">
                      {offers.length}
                    </span>
                  )}
                </h2>
                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                  Accept or counter
                </span>
              </div>

              {offers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 border-2 border-dashed border-border rounded-3xl">
                  <Users className="h-10 w-10 text-muted-foreground/20" />
                  <div className="text-center">
                    <p className="font-bold text-muted-foreground">Waiting for challengers…</p>
                    <p className="text-muted-foreground/60 text-xs mt-1">
                      Anyone who clicks your notification link arrives here
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {offers.map(offer => (
                    <OfferCard
                      key={offer.wallet}
                      offer={offer}
                      token={challenge.token}
                      onAccept={handleAcceptOffer}
                      onCounter={handleSelectCounterTarget}
                      accepting={accepting}
                      isSelf={offer.wallet.toLowerCase() === myWallet}
                      isCounterTarget={counterTarget?.wallet === offer.wallet}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Creator counter panel */}
            {counterTarget && (
              <div className="bg-card border-2 border-blue-500/40 rounded-3xl overflow-hidden">
                <div className="px-5 pt-4 pb-2 border-b border-border">
                  <div className="flex items-center justify-between">
                    <h3 className="font-black text-foreground text-sm flex items-center gap-2">
                      <Zap className="h-4 w-4 text-blue-500" />
                      Counter to <span className="text-blue-500">{counterTarget.username}</span>
                    </h3>
                    <button onClick={() => setCounterTarget(null)} className="text-muted-foreground hover:text-foreground transition-colors">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Only {counterTarget.username} will see this counter
                  </p>
                </div>

                <div className="px-5 py-4 space-y-3">
                  <StakeInput
                    value={myOffer}
                    onChange={setMyOffer}
                    token={challenge.token}
                    label={myOffer === counterTarget.amount ? "= Their offer" : undefined}
                    borderClass="border-blue-400/50"
                  />

                  {/* Quick picks */}
                  <div className="flex gap-1.5 flex-wrap">
                    {quickPicks.map(v => (
                      <button
                        key={v}
                        onClick={() => setMyOffer(v)}
                        className={cn(
                          "flex-1 min-w-[70px] py-2 rounded-xl border-2 text-xs font-black transition-all",
                          myOffer === v
                            ? "border-blue-500 bg-blue-500/10 text-blue-500"
                            : "border-border text-muted-foreground hover:border-blue-400/40",
                        )}
                      >
                        {v === challenge.stake ? `${fmt(v)} ✓` : fmt(v)}
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAcceptOffer(counterTarget)}
                      disabled={accepting || submitting}
                      className="flex-1 py-3 rounded-2xl border-2 border-emerald-400/50 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 font-black text-sm hover:bg-emerald-500/10 transition-all active:scale-[0.99] disabled:opacity-50"
                    >
                      <Check className="inline mr-1.5 h-4 w-4" />
                      Accept {fmt(counterTarget.amount)}
                    </button>
                    <button
                      onClick={() => handleSendCounter(myOffer, counterTarget)}
                      disabled={submitting || myOffer === counterTarget.amount}
                      className="flex-1 py-3 rounded-2xl bg-blue-500 hover:bg-blue-400 text-white font-black text-sm transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {submitting
                        ? <><Loader2 className="inline mr-2 h-4 w-4 animate-spin" /> Sending…</>
                        : <><Zap className="inline mr-2 h-4 w-4" /> Counter {fmt(myOffer)} {challenge.token}</>
                      }
                    </button>
                  </div>
                </div>
              </div>
            )}

            <p className="text-[10px] text-center text-muted-foreground/60">
              Accepting locks in that challenger — countering sends a private offer only to them
            </p>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            CHALLENGER — COUNTER RECEIVED
        ═══════════════════════════════════════════════════════════════════ */}
        {hasCounter && pendingCounter && (
          <div className="space-y-4">
            <CounterOfferBanner
              counter={pendingCounter}
              token={challenge.token}
              onAccept={(amount) => handleSubmitOffer(amount)}
              onDecline={handleDeclineCounter}
              submitting={submitting}
            />

            <div className="bg-card border-2 border-border rounded-3xl overflow-hidden">
              <div className="px-5 pt-4 pb-2 border-b border-border">
                <p className="text-sm font-black text-foreground">Or propose a different amount</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Adjust and send your own counter back to {challenge.creatorName}
                </p>
              </div>
              <div className="px-5 py-4 space-y-3">
                <StakeInput
                  value={myOffer}
                  onChange={setMyOffer}
                  token={challenge.token}
                />
                <button
                  onClick={() => handleSubmitOffer(myOffer)}
                  disabled={submitting || myOffer === pendingCounter.amount}
                  className="w-full py-3 rounded-2xl bg-primary hover:opacity-90 text-primary-foreground font-black text-sm transition-all active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {submitting
                    ? <><Loader2 className="inline mr-2 h-4 w-4 animate-spin" /> Sending…</>
                    : <><ArrowRight className="inline mr-2 h-4 w-4" /> Counter with {fmt(myOffer)} {challenge.token}</>
                  }
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            CHALLENGER — PENDING
        ═══════════════════════════════════════════════════════════════════ */}
        {hasPendingOffer && (
          <div className="flex flex-col items-center gap-4 py-8 px-4 rounded-3xl border-2 border-primary/20 bg-primary/5 text-center">
            <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            <div>
              <p className="font-black text-foreground text-lg">Offer Sent!</p>
              <p className="text-muted-foreground text-sm mt-1">
                Waiting for <strong>{challenge.creatorName}</strong> to accept or counter…
              </p>
              <p className="text-muted-foreground/60 text-xs mt-2">
                You offered <strong className="text-foreground">{fmt(myOffer)} {challenge.token}</strong> per player
              </p>
            </div>
            <button
              onClick={() => setPageState("idle")}
              className="text-xs text-primary underline underline-offset-2 hover:opacity-70 transition-opacity"
            >
              Change offer
            </button>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            CHALLENGER — IDLE
        ═══════════════════════════════════════════════════════════════════ */}
        {pageState === "idle" && !isCreatorView && (
          <div className="bg-card border-2 border-border rounded-3xl overflow-hidden">
            <div className="px-5 pt-5 pb-2">
              <h2 className="font-black text-foreground text-base flex items-center gap-2 mb-1">
                <Zap className="h-4 w-4 text-primary" />
                Your Stake Offer
              </h2>
              <p className="text-xs text-muted-foreground">
                Accept the opening stake or propose a different amount.
              </p>
            </div>

            <div className="px-5 py-4 space-y-3">
              {/* Free-type input with clamped step */}
              <StakeInput
                value={myOffer}
                onChange={setMyOffer}
                token={challenge.token}
                label={myOffer === challenge.stake ? "= Opening" : undefined}
                borderClass={myOffer === challenge.stake ? "border-emerald-400/50" : "border-border"}
              />

              {/* Quick picks: opening, 1.5×, 2×, 3× — all ≥ 0.01 */}
              <div className="flex gap-1.5 flex-wrap">
                {quickPicks.map(v => (
                  <button
                    key={v}
                    onClick={() => setMyOffer(v)}
                    className={cn(
                      "flex-1 min-w-[70px] py-2 rounded-xl border-2 text-xs font-black transition-all",
                      myOffer === v
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40",
                    )}
                  >
                    {v === challenge.stake ? `${fmt(v)} ✓` : fmt(v)}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-muted/30 border border-border text-xs">
                <span className="text-muted-foreground font-bold">Total pool if accepted</span>
                <span className="font-black text-foreground">
                  {totalPool} <span className="text-muted-foreground font-normal">{challenge.token}</span>
                </span>
              </div>
            </div>

            <div className="px-5 pb-5 space-y-2">
              {myOffer !== challenge.stake && (
                <button
                  onClick={() => handleSubmitOffer(challenge.stake)}
                  disabled={submitting}
                  className="w-full py-3 rounded-2xl border-2 border-emerald-400/50 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 font-black text-sm hover:bg-emerald-500/10 transition-all active:scale-[0.99]"
                >
                  <Check className="inline mr-2 h-4 w-4" />
                  Accept Opening Stake ({fmt(challenge.stake)} {challenge.token})
                </button>
              )}

              <button
                onClick={() => handleSubmitOffer(myOffer)}
                disabled={submitting}
                className={cn(
                  "w-full py-4 rounded-2xl font-black text-base transition-all active:scale-[0.99]",
                  myOffer === challenge.stake
                    ? "bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20"
                    : "bg-primary hover:opacity-90 text-primary-foreground shadow-lg shadow-primary/20",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                )}
              >
                {submitting ? (
                  <><Loader2 className="inline mr-2 h-4 w-4 animate-spin" /> Sending…</>
                ) : myOffer === challenge.stake ? (
                  <><Check className="inline mr-2 h-5 w-5" /> Accept {fmt(myOffer)} {challenge.token}</>
                ) : (
                  <><ArrowRight className="inline mr-2 h-5 w-5" /> Offer {fmt(myOffer)} {challenge.token}</>
                )}
              </button>

              <p className="text-[10px] text-center text-muted-foreground/60 pt-1">
                First offer the creator accepts gets the lobby slot. Others are notified if it fills up.
              </p>
            </div>
          </div>
        )}

        {/* Other challengers list */}
        {!isCreatorView && offers.length > 0 && pageState !== "countered" && (
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <Users className="h-3.5 w-3.5" /> Other challengers ({offers.filter(o => o.wallet.toLowerCase() !== myWallet).length})
            </h3>
            <div className="space-y-1.5">
              {offers
                .filter(o => o.wallet.toLowerCase() !== myWallet)
                .map(offer => (
                  <div
                    key={offer.wallet}
                    className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-border bg-muted/20 text-sm"
                  >
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarFallback className="text-[10px] font-black">
                        {offer.username.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="flex-1 font-bold text-muted-foreground truncate">{offer.username}</span>
                    <span className="font-black text-foreground tabular-nums">
                      {fmt(offer.amount)}{" "}
                      <span className="text-xs font-normal text-muted-foreground">{challenge.token}</span>
                    </span>
                  </div>
                ))}
            </div>
            <p className="text-[10px] text-muted-foreground/60 text-center">
              You're competing for the same slot — higher offers may attract the creator's attention.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}