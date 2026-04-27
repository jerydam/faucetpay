"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Swords, Check, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://faucetpay-backend.koyeb.app0";
const POPUP_TTL    = 60;

function fmt(n: number) {
  return n % 1 === 0 ? n.toString() : n.toFixed(n < 1 ? 2 : 1);
}

export interface RematchInvite {
  originalCode:    string;
  topic:           string;
  stakeAmount:     number;
  tokenSymbol:     string;
  requesterWallet: string;
  requesterName:   string;
}

interface Props {
  invite:     RematchInvite;
  myWallet:   string;
  onDismiss:  () => void;
  countdown?: number | null; // external countdown from parent (inviteCountdown)
}

export function RematchPopup({ invite, myWallet, onDismiss, countdown }: Props) {
  const router                      = useRouter();
  const [ttl, setTtl]               = useState(POPUP_TTL);
  const [busy, setBusy]             = useState(false);
  const [accepted, setAccepted]     = useState(false);
  const [declining, setDeclining]   = useState(false);
  const timerRef                    = useRef<ReturnType<typeof setInterval> | null>(null);

  // Internal TTL countdown (auto-dismiss safety net)
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTtl(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          onDismiss();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current!);
  }, [onDismiss]);

  // If parent passes an external countdown that hits 0, auto-dismiss
  useEffect(() => {
    if (countdown !== null && countdown !== undefined && countdown <= 0) {
      clearInterval(timerRef.current!);
      onDismiss();
    }
  }, [countdown, onDismiss]);

  // ── Accept ──────────────────────────────────────────────────────────────────
  const handleAccept = useCallback(async () => {
    if (busy) return;
    clearInterval(timerRef.current!);
    setBusy(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/challenge/${invite.originalCode}/rematch-accept-invite`,
        {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            acceptorWallet:  myWallet,
            requesterWallet: invite.requesterWallet,
          }),
        }
      );
      const d = await res.json();
      if (!d.success) throw new Error(d.detail ?? "Accept failed");

      setAccepted(true);
      toast.success("Rematch accepted! Waiting for opponent to set up…");
    } catch (err: any) {
      toast.error(err?.message ?? "Could not accept rematch");
      setBusy(false);
      // Restart internal countdown
      timerRef.current = setInterval(() => {
        setTtl(prev => {
          if (prev <= 1) { clearInterval(timerRef.current!); onDismiss(); return 0; }
          return prev - 1;
        });
      }, 1000);
    }
  }, [busy, invite, myWallet, onDismiss]);

  // ── Decline ─────────────────────────────────────────────────────────────────
  const handleDecline = useCallback(async () => {
    if (busy || declining) return;
    clearInterval(timerRef.current!);
    setDeclining(true);
    try {
      await fetch(
        `${API_BASE_URL}/api/challenge/${invite.originalCode}/rematch-decline`,
        {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            declinerWallet:  myWallet,
            requesterWallet: invite.requesterWallet,
          }),
        }
      );
    } catch {
      // fire and forget — don't block UI
    } finally {
      onDismiss();
    }
  }, [busy, declining, invite, myWallet, onDismiss]);

  // Use external countdown for display if provided, else fall back to internal ttl
  const displaySeconds = countdown !== null && countdown !== undefined ? countdown : ttl;
  const pct    = (displaySeconds / POPUP_TTL) * 100;
  const urgent = displaySeconds <= 15;
  const pool   = fmt(invite.stakeAmount * 2);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", animation: "rmpFadeIn 0.2s ease-out" }}
      onClick={handleDecline}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-[340px] bg-card border-2 border-border rounded-3xl overflow-hidden shadow-2xl"
        style={{ animation: "rmpSlideUp 0.25s cubic-bezier(.22,1,.36,1)" }}
      >
        {/* Progress bar */}
        {!accepted && (
          <div className="h-1 bg-muted overflow-hidden">
            <div
              className={cn("h-full", urgent ? "bg-red-500" : "bg-primary")}
              style={{ width: `${pct}%`, transition: "width 1s linear" }}
            />
          </div>
        )}

        <div className="p-6 space-y-4">

          {/* Header */}
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <Swords className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-foreground text-base leading-tight">
                {invite.requesterName} wants a rematch!
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{invite.topic}</p>
            </div>
            {!accepted && (
              <button
                onClick={handleDecline}
                disabled={declining}
                className="w-7 h-7 rounded-full hover:bg-muted flex items-center justify-center shrink-0"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>

          {/* Stakes */}
          <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-muted/40 border border-border">
            <div className="text-center flex-1">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-0.5">
                Per Player
              </p>
              <p className="font-black text-foreground">
                {fmt(invite.stakeAmount)}{" "}
                <span className="text-xs font-bold text-muted-foreground">{invite.tokenSymbol}</span>
              </p>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center flex-1">
              <p className="text-[10px] font-bold text-primary/70 uppercase tracking-wide mb-0.5">
                Prize Pool
              </p>
              <p className="font-black text-primary">
                {pool}{" "}
                <span className="text-xs font-bold text-primary/70">{invite.tokenSymbol}</span>
              </p>
            </div>
          </div>

          {/* Accepted waiting state */}
          {accepted ? (
            <div className="flex flex-col items-center gap-3 py-2 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-sm font-bold text-foreground">
                {invite.requesterName} is setting up the challenge…
              </p>
              <p className="text-xs text-muted-foreground">
                You'll be routed to the pre-lobby automatically.
              </p>
            </div>
          ) : (
            <>
              <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
                You can negotiate the final stake once in the pre-lobby.
                No transaction needed to accept.
              </p>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleDecline}
                  disabled={busy || declining}
                  className="py-3 rounded-2xl border-2 border-border bg-card text-foreground font-black text-sm hover:bg-muted transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {declining
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : "Decline"}
                </button>
                <button
                  onClick={handleAccept}
                  disabled={busy || declining}
                  className="py-3 rounded-2xl bg-primary text-primary-foreground font-black text-sm hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {busy
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <><Check className="h-4 w-4" /> Accept ({displaySeconds}s)</>}
                </button>
              </div>

              <p className={cn(
                "text-center text-[11px] font-bold tabular-nums",
                urgent ? "text-red-500" : "text-muted-foreground/50",
              )}>
                Auto-dismisses in {displaySeconds}s
              </p>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes rmpFadeIn  { from { opacity:0 } to { opacity:1 } }
        @keyframes rmpSlideUp {
          from { transform:translateY(20px) scale(0.97); opacity:0 }
          to   { transform:translateY(0) scale(1); opacity:1 }
        }
      `}</style>
    </div>
  );
}