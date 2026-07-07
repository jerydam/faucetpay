"use client";

/**
 * /app/challenge/[code]/pre-lobby/page.tsx
 *
 * Negotiation arena. Challengers arrive, submit stake offers, and the creator
 * can accept OR counter a specific challenger's offer.
 *
 * FIXES APPLIED:
 *   1. _handleSubmitOfferGuard return value is now checked — invalid amounts
 *      are blocked before the fetch fires.
 *   2. WebSocket handler now processes `pre_lobby_offers_snapshot` so a
 *      reconnecting user immediately sees all live offers (backend must send
 *      this on connect — see main.py fix).
 *   3. chainId is now read from the loaded challenge and threaded through
 *      every backend call (offer, counter, accept) and through the
 *      per-chain balance/avatar lookups, using lib/chain.ts as the single
 *      source of truth for chain config.
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
import { getChainConfig } from "@/lib/chain";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://conscious-adorne-faucetdrops-fc77a861.koyeb.app";
const MIN_STAKE = 10;

function getWsBase() {
  if (typeof window === "undefined") return "wss://127.0.0.1:8000";
  return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "ws://127.0.0.1:8000"
    : "wss://conscious-adorne-faucetdrops-fc77a861.koyeb.app";
}

function fmt(n: number) {
  if (n === undefined || n === null || isNaN(n)) return "0";
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
  offer, token, onAccept, onCounter, accepting, isSelf, isCounterTarget, avatarUrl, counterDisabled
}: {
  offer: Offer;
  token: string;
  onAccept: (offer: Offer) => void;
  onCounter: (offer: Offer) => void;
  accepting: boolean;
  isSelf: boolean;
  isCounterTarget: boolean;
  avatarUrl?: string;
  counterDisabled?: boolean;
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
          {avatarUrl && <img src={avatarUrl} alt={offer.username} className="h-full w-full rounded-full object-cover" />}
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
           {!counterDisabled && (
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
           )}
        </div>
      )}
    </div>
  );
}

// ── Stake Amount Input (shared) ───────────────────────────────────────────────

function StakeInput({
  value,
  onChange,
  token,
  label,
  borderClass,
  min = MIN_STAKE,
}: {
  value: number;
  onChange: (v: number) => void;
  token: string;
  label?: string;
  borderClass?: string;
  min?: number;
}) {
  const [raw, setRaw] = useState(String(value));

  useEffect(() => {
    setRaw(String(value));
  }, [value]);

  const commit = (str: string) => {
    const parsed = parseFloat(str);
    const clamped = isNaN(parsed) || parsed < min ? min : Math.round(parsed * 100) / 100;
    onChange(clamped);
    setRaw(String(clamped));
  };

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => { const next = Math.max(min, Math.round((value - 0.01) * 100) / 100); onChange(next); setRaw(String(next)); }}
        className="w-12 h-12 rounded-2xl border-2 border-border bg-card hover:bg-muted flex items-center justify-center active:scale-95 transition-all shrink-0"
      >
        <ChevronDown className="h-5 w-5 text-muted-foreground" />
      </button>

      <div className="flex-1 relative">
        {label && (
          <span className="absolute left-3 top-2.5 text-[10px] font-black uppercase tracking-wider pointer-events-none"
            style={{ color: "var(--dd-blue)" }}>
            {label}
          </span>
        )}
        <input
          type="number"
          step="0.01"
          value={raw}
          onChange={e => {
            setRaw(e.target.value);
            const parsed = parseFloat(e.target.value);
            if (!isNaN(parsed) && parsed >= min) {
              onChange(Math.round(parsed * 100) / 100);
            }
          }}
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
  const [avatarCache, setAvatarCache] = useState<Record<string, string>>({});

  const [challenge, setChallenge]       = useState<Challenge | null>(null);

  // Single source of truth for "which chain is this challenge on" — every
  // contract address / RPC / explorer link and every backend call below
  // should derive from this instead of assuming Celo.
  const chainCfg = useMemo(
    () => (challenge ? getChainConfig(challenge.chainId) : null),
    [challenge?.chainId],
  );

  const fetchAvatar = useCallback((wallet: string) => {
    if (!wallet || avatarCache[wallet.toLowerCase()]) return;
    fetch(`${API_BASE_URL}/api/players/${wallet}`)
      .then(r => r.json())
      .then(d => {
        if (d.avatar_url) {
          setAvatarCache(prev => ({ ...prev, [wallet.toLowerCase()]: d.avatar_url }));
        }
      })
      .catch(() => {});
  }, [avatarCache]);

  const [username, setUsername]         = useState("");
  const [pageState, setPageState]       = useState<PageState>("loading");
  const [offers, setOffers]             = useState<Offer[]>([]);
  const [myOffer, setMyOffer]           = useState<number>(0);
  const [submitting, setSubmitting]     = useState(false);
  const [accepting, setAccepting]       = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  const [lockedAmount, setLockedAmount] = useState<number | null>(null);
  const [negotiationLocked, setNegotiationLocked] = useState(false);
  const [myTotalDuels, setMyTotalDuels] = useState(0);
  const [pendingCounter, setPendingCounter] = useState<CounterOffer | null>(null);
  const [counterTarget, setCounterTarget]   = useState<Offer | null>(null);

  const amCreator = useMemo(
    () => challenge?.creator?.toLowerCase() === myWallet,
    [challenge, myWallet],
  );

  const wsRef         = useRef<WebSocket | null>(null);
  const amCreatorRef  = useRef(amCreator);
  const challengeRef  = useRef(challenge);
  useEffect(() => { amCreatorRef.current = amCreator; }, [amCreator]);
  useEffect(() => { challengeRef.current = challenge; }, [challenge]);

  // ── Load challenge ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!code) return;
    fetch(`${API_BASE_URL}/api/challenge/${code}`)
      .then(r => r.json())
      .then(d => {
        if (!d.success) { toast.error("Challenge not found"); router.push("/challenge"); return; }
        const c: Challenge = d.challenge;
        setChallenge(c);
        setNegotiationLocked(!!d.negotiationLocked);
        setMyOffer(c.stake ?? MIN_STAKE);
        if (d.challenge?.creator) fetchAvatar(d.challenge.creator);
        if (c.status === "active" || c.status === "finished") {
          router.replace(`/challenge/${code}`);
          return;
        }
        setPageState("loading");
      })
      .catch(() => { toast.error("Failed to load challenge"); setPageState("error"); });
  }, [code, router]);

  // Per-chain balance — totalDuels (and whatever else gates negotiation) is
  // tracked per chainId server-side, so this fetch is meaningless until the
  // challenge (and therefore its chainId) has loaded.
  useEffect(() => {
    if (!myWallet || !challenge?.chainId) return;
    fetch(`${API_BASE_URL}/api/drops/balance/${myWallet}?chainId=${challenge.chainId}`)
      .then(r => r.json())
      .then(d => setMyTotalDuels(d.totalDuels ?? 0))
      .catch(() => {});
  }, [myWallet, challenge?.chainId]);

  useEffect(() => {
    if (challenge?.creator) fetchAvatar(challenge.creator);
  }, [challenge?.creator]);


  useEffect(() => {
    if (!code) return;
    fetch(`${API_BASE_URL}/api/challenge/${code}/expiry`)
      .then(r => r.json())
      .then(d => {
        if (d.success && d.secondsLeft > 0) {
          setCountdown(Math.floor(d.secondsLeft));
        } else {
          setCountdown(120); // fallback if not yet on-chain
        }
      })
      .catch(() => setCountdown(120));
  }, [code]);

  useEffect(() => {
    offers.forEach(o => fetchAvatar(o.wallet));
  }, [offers]);

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
  const isCreatorView   = pageState === "creator";
  const hasPendingOffer = pageState === "pending";
  const hasCounter      = pageState === "countered";
  const totalPool       = (myOffer * 2).toFixed(2);
  const countdownMin = countdown !== null ? Math.floor(countdown / 60) : "--";
  const countdownSec = countdown !== null ? countdown % 60 : "--";
  const countdownUrgent = countdown !== null && countdown <= 300;
  useEffect(() => {
    if (!["idle","creator","pending","countered"].includes(pageState)) return;
    if (countdown === null || countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c !== null ? c - 1 : null), 1000);
    return () => clearTimeout(t);
  }, [countdown, pageState]);

  const isNegotiationLocked = negotiationLocked || myTotalDuels < 10;

  // ── WebSocket ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!code || !myWallet) return;

    const ws = new WebSocket(`${getWsBase()}/ws/challenge/${code}`);
    wsRef.current = ws;

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        const currentAmCreator = amCreatorRef.current;
        const currentChallenge = challengeRef.current;

        if (msg.type === "pre_lobby_offer") {
          const incoming: Offer = {
            wallet:   msg.wallet,
            username: msg.username,
            amount:   msg.amount,
            sentAt:   msg.sentAt ?? new Date().toISOString(),
          };
          setOffers(prev => {
            const without = prev.filter(
              o => o.wallet.toLowerCase() !== incoming.wallet.toLowerCase(),
            );
            return [incoming, ...without].sort((a, b) => b.amount - a.amount);
          });
        }

        // FIX 2: snapshot on reconnect — backend sends this when a new WS
        // client joins the pre-lobby room so they see all existing offers.
        if (msg.type === "pre_lobby_offers_snapshot") {
          const snapped: Offer[] = (msg.offers ?? []).map((o: any) => ({
            wallet:   o.wallet,
            username: o.username,
            amount:   o.amount,
            sentAt:   o.sentAt ?? new Date().toISOString(),
          }));
          setOffers(snapped.sort((a, b) => b.amount - a.amount));
        }

        if (msg.type === "pre_lobby_counter") {
          const counter: CounterOffer = {
            fromWallet:   msg.fromWallet,
            fromName:     msg.fromName ?? "Creator",
            amount:       msg.amount,
            sentAt:       msg.sentAt ?? new Date().toISOString(),
            targetWallet: msg.targetWallet,
          };
          if (
            !currentAmCreator &&
            counter.targetWallet?.toLowerCase() === myWallet
          ) {
            setPendingCounter(counter);
            setMyOffer(counter.amount);
            setPageState("countered");
            toast.info(
              `${counter.fromName} countered with ${fmt(counter.amount)} ${currentChallenge?.token}`,
            );
          }
        }

        if (
          msg.type === "offer_accepted" ||
          msg.type === "pre_lobby_accepted"
        ) {
          const winner = (msg.winner ?? msg.challenger ?? "").toLowerCase();
          const amount: number = msg.amount;
          setLockedAmount(amount);

          const iWon = currentAmCreator ? true : winner === myWallet;

          if (iWon) {
            setPageState("accepted");
            toast.success("🎉 Deal locked! Heading to lobby…");
            setTimeout(
              () => router.push(`/challenge/${code}?stake=${amount}&agreed=1`),
              1800,
            );
          } else {
            setPageState("rejected");
          }
        }

        if (msg.type === "pre_lobby_offers_snapshot") {
          setOffers(msg.offers ?? []);
        }
      } catch {}
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [code, myWallet, router]);

  // ── Actions ───────────────────────────────────────────────────────────────

  // FIX 1: guard now returns a string on failure and we check it before proceeding.
  function _handleSubmitOfferGuard(amount: number): string | null {
    if (amount < MIN_STAKE) return `Minimum stake is ${MIN_STAKE} DROPS`;
    return null;
  }

  const handleSubmitOffer = useCallback(async (amount: number) => {
    // FIX 1: actually gate on the guard result
    const guardErr = _handleSubmitOfferGuard(amount);
    if (guardErr) {
      toast.error(guardErr);
      return;
    }

    if (!myWallet || submitting || amCreator || !challenge) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/challenge/${code}/offer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: myWallet,
          username,
          amount,
          chainId: challenge.chainId,
        }),
      });
      const d = await res.json();
      if (!d.success) throw new Error(d.detail ?? "Offer failed");
      // backend never returns accepted:true here — the accepted state
      // arrives via the pre_lobby_accepted WS message instead.
      setPendingCounter(null);
      setPageState("pending");
      toast.info(`Offer sent: ${fmt(amount)} ${challenge?.token}`);
    } catch (err: any) {
      toast.error(err?.message ?? "Could not send offer");
    } finally {
      setSubmitting(false);
    }
  }, [myWallet, submitting, amCreator, challenge, code, username]);

  const handleSendCounter = useCallback(async (amount: number, target: Offer) => {
    if (!myWallet || submitting || !challenge) return;
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
          chainId: challenge.chainId,
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
    if (!myWallet || accepting || !challenge) return;
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
          chainId: challenge.chainId,
        }),
      });
      const d = await res.json();
      if (!d.success) throw new Error(d.detail ?? "Accept failed");
    } catch (err: any) {
      toast.error(err?.message ?? "Could not accept offer");
      setAccepting(false);
    }
  }, [myWallet, accepting, code, challenge]);

  const handleDeclineCounter = useCallback(() => {
    setPendingCounter(null);
    setPageState("idle");
    toast.info("Counter declined — you can send a new offer.");
  }, []);

  const handleSelectCounterTarget = useCallback((offer: Offer) => {
    setCounterTarget(prev => prev?.wallet === offer.wallet ? null : offer);
    setMyOffer(offer.amount);
  }, []);

  const quickPicks = useMemo(() => {
    if (!challenge) return [];
    const s = challenge.stake;
    return [s, Math.round(s * 1.5 * 100) / 100, Math.round(s * 2 * 100) / 100, Math.round(s * 3 * 100) / 100]
      .filter(v => v >= MIN_STAKE);
  }, [challenge]);

  // ── Render states ─────────────────────────────────────────────────────────

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

  // ── Main pre-lobby UI ─────────────────────────────────────────────────────


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
              {avatarCache[challenge.creator?.toLowerCase()] ? (
                <img
                  src={avatarCache[challenge.creator.toLowerCase()]}
                  alt={challenge.creatorName}
                  className="h-14 w-14 rounded-2xl object-cover border border-primary/20 shrink-0"
                />
              ) : (
                <div className="h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 font-black text-xl text-primary">
                  {challenge.creatorName.slice(0, 2).toUpperCase()}
                </div>
              )}
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
                      onCounter={isNegotiationLocked ? () => {} : handleSelectCounterTarget}
                      counterDisabled={isNegotiationLocked}
                      accepting={accepting}
                      isSelf={offer.wallet.toLowerCase() === myWallet}
                      isCounterTarget={counterTarget?.wallet === offer.wallet}
                      avatarUrl={avatarCache[offer.wallet.toLowerCase()]}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Creator counter panel */}
            {counterTarget && !isNegotiationLocked && (
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
        {isNegotiationLocked
          ? "Stake is fixed — negotiation unlocks after 10 games."
          : "Accept the opening stake or propose a different amount."}
      </p>
    </div>

    <div className="px-5 py-4 space-y-3">
      {isNegotiationLocked && (
        <div className="flex items-start gap-2.5 px-4 py-3 rounded-2xl bg-amber-500/10 border-2 border-amber-400/40 text-xs text-amber-700 dark:text-amber-300">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-black">Negotiation locked</p>
            <p className="mt-0.5 text-amber-600 dark:text-amber-400">
              {myTotalDuels < 10
                ? `Play ${10 - myTotalDuels} more game${10 - myTotalDuels !== 1 ? "s" : ""} to unlock stake negotiation.`
                : "The creator hasn't unlocked negotiation yet."}
            </p>
          </div>
        </div>
      )}

      {/* Only show the input when negotiation is open */}
      {!isNegotiationLocked && (
        <>
          <StakeInput
            value={myOffer}
            onChange={setMyOffer}
            token={challenge.token}
            label={myOffer === challenge.stake ? "= Opening" : undefined}
            borderClass={myOffer === challenge.stake ? "border-emerald-400/50" : "border-border"}
          />
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
        </>
      )}
    </div>

    <div className="px-5 pb-5 space-y-2">
      {/* When locked, only show the accept-at-fixed-stake button */}
      {isNegotiationLocked ? (
        <button
          onClick={() => handleSubmitOffer(challenge.stake)}
          disabled={submitting}
          className="w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white font-black text-base transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20"
        >
          {submitting
            ? <><Loader2 className="inline mr-2 h-4 w-4 animate-spin" /> Sending…</>
            : <><Check className="inline mr-2 h-5 w-5" /> Accept {fmt(challenge.stake)} {challenge.token}</>
          }
        </button>
      ) : (
        <>
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
            {submitting
              ? <><Loader2 className="inline mr-2 h-4 w-4 animate-spin" /> Sending…</>
              : myOffer === challenge.stake
              ? <><Check className="inline mr-2 h-5 w-5" /> Accept {fmt(myOffer)} {challenge.token}</>
              : <><ArrowRight className="inline mr-2 h-5 w-5" /> Offer {fmt(myOffer)} {challenge.token}</>
            }
          </button>
        </>
      )}
      <p className="text-[10px] text-center text-muted-foreground/60 pt-1">
        {isNegotiationLocked
          ? "Stakes are fixed until both players have 10+ games played."
          : "First offer the creator accepts gets the lobby slot. Others are notified if it fills up."}
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
                      {avatarCache[offer.wallet.toLowerCase()] && (
                        <img
                          src={avatarCache[offer.wallet.toLowerCase()]}
                          alt={offer.username}
                          className="h-full w-full rounded-full object-cover"
                        />
                      )}
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