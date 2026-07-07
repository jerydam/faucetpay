"use client";

/**
 * ChallengeExpiryBanner
 *
 * Drop-in banner that shows the burn-window countdown in both Pre-Lobby and
 * Lobby. It accepts the return value of `useChallengeExpiry` directly, so the
 * parent owns the hook and can also drive other UI from the same data.
 *
 * Usage (Lobby / Pre-Lobby):
 *
 *   const expiry = useChallengeExpiry(code, phase);
 *   ...
 *   <ChallengeExpiryBanner
 *     expiry={expiry}
 *     userWalletAddress={userWalletAddress}
 *     code={code}
 *     onCancelled={() => router.push("/challenge")}
 *   />
 */

import React, { useState, useCallback } from "react";
import { Loader2, AlertTriangle, Clock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { UseChallengeExpiryReturn } from "@/hooks/use-challenge-expiry";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "https://conscious-adorne-faucetdrops-fc77a861.koyeb.app";

// ── Progress arc (SVG ring) ───────────────────────────────────────────────────

function RingTimer({
  progress,
  urgency,
  label,
}: {
  progress: number;
  urgency: "ok" | "warning" | "critical" | "expired";
  label: string;
}) {
  const R   = 22;
  const C   = 2 * Math.PI * R;
  const dash = C * (1 - progress);

  const stroke =
    urgency === "expired"  ? "#ef4444"
    : urgency === "critical" ? "#ef4444"
    : urgency === "warning"  ? "#f59e0b"
    : "#22c55e";

  return (
    <div className="relative w-14 h-14 shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 56 56">
        <circle cx="28" cy="28" r={R} fill="none" strokeWidth="4"
          className="stroke-muted/40" />
        <circle
          cx="28" cy="28" r={R} fill="none" strokeWidth="4"
          stroke={stroke}
          strokeDasharray={C}
          strokeDashoffset={dash}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.8s linear, stroke 0.4s" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <Clock className="h-5 w-5" style={{ color: stroke }} />
      </div>
    </div>
  );
}

// ── Banner ────────────────────────────────────────────────────────────────────

export interface ChallengeExpiryBannerProps {
  expiry: UseChallengeExpiryReturn;
  userWalletAddress: string | undefined | null;
  code: string;
  /** Called after a successful cancel+refund so the parent can navigate away */
  onCancelled?: (refunded: string[]) => void;
  /** Show a more compact version in the sticky header (pre-lobby) */
  compact?: boolean;
}

export function ChallengeExpiryBanner({
  expiry,
  userWalletAddress,
  code,
  onCancelled,
  compact = false,
}: ChallengeExpiryBannerProps) {
  const [isCancelling, setIsCancelling] = useState(false);

  const { secondsLeft, isExpired, urgency, progress, formatted, expiryData } = expiry;

  const handleCancel = useCallback(async () => {
    if (!userWalletAddress) return;
    setIsCancelling(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/challenge/${code}/cancel-expired`,
        {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ walletAddress: userWalletAddress }),
        },
      );
      const d = await res.json();
      if (!d.success) throw new Error(d.detail ?? "Could not cancel challenge");
      toast.success(
        d.refunded?.length
          ? "Challenge cancelled — your stake was refunded."
          : "Challenge cancelled.",
      );
      onCancelled?.(d.refunded ?? []);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to cancel challenge");
    } finally {
      setIsCancelling(false);
    }
  }, [userWalletAddress, code, onCancelled]);

  // ── Nothing to show until backend data arrives ───────────────────────────
  if (secondsLeft === null || !expiryData) return null;

  // ── Compact mode: just a pill for the sticky header ──────────────────────
  if (compact) {
    return (
      <div
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-black tabular-nums transition-colors",
          urgency === "expired" || urgency === "critical"
            ? "border-red-400/40 bg-red-500/10 text-red-500"
            : urgency === "warning"
            ? "border-amber-400/40 bg-amber-500/10 text-amber-500"
            : "border-border bg-muted/50 text-muted-foreground",
        )}
        title={isExpired ? "Stake window expired" : `Stake window: ${formatted} remaining`}
      >
        <Clock className="h-3.5 w-3.5 shrink-0" />
        <span>{isExpired ? "Expired" : formatted}</span>
      </div>
    );
  }

  // ── Full banner ───────────────────────────────────────────────────────────
  const wrapperClass = cn(
    "rounded-2xl border px-4 py-3 space-y-3 transition-colors",
    isExpired || urgency === "critical"
      ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
      : urgency === "warning"
      ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"
      : "bg-muted/40 border-border",
  );

  const labelColor = cn(
    "text-xs font-bold uppercase tracking-wide",
    isExpired || urgency === "critical"
      ? "text-red-600 dark:text-red-400"
      : urgency === "warning"
      ? "text-amber-600 dark:text-amber-400"
      : "text-muted-foreground",
  );

  const timeColor = cn(
    "font-mono font-black text-sm tabular-nums",
    isExpired || urgency === "critical"
      ? "text-red-600 dark:text-red-400"
      : urgency === "warning"
      ? "text-amber-600 dark:text-amber-400"
      : "text-foreground",
  );

  // Stake progress indicators (on-chain only)
  const showStakeProgress = expiryData.onChain && (expiryData.p1Staked || expiryData.p2Staked);

  return (
    <div className={wrapperClass}>
      {/* Top row: ring + label + time */}
      <div className="flex items-center gap-3">
        <RingTimer progress={progress} urgency={urgency} label={formatted} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className={labelColor}>
              {isExpired
                ? "⏰ Stake window expired"
                : urgency === "critical"
                ? "⚠️ Time almost up"
                : urgency === "warning"
                ? "⏳ Window closing"
                : "⏳ Stake window"}
            </p>
            {!isExpired && <span className={timeColor}>{formatted}</span>}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
            {isExpired
              ? "Both players didn't stake in time. Cancel to recover your DROPS."
              : urgency === "critical"
              ? "Stake now before the window closes."
              : "Both players must stake before this window closes."}
          </p>
        </div>
      </div>

      {/* Stake confirmation dots (on-chain burn window) */}
      {showStakeProgress && (
        <div className="flex items-center gap-3 px-2 py-2 rounded-xl bg-background/60 border border-border">
          <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <div className="flex gap-4 text-xs">
            <span className={cn("font-bold", expiryData.p1Staked ? "text-emerald-500" : "text-muted-foreground")}>
              {expiryData.p1Staked ? "✓" : "○"} Player 1
            </span>
            <span className={cn("font-bold", expiryData.p2Staked ? "text-emerald-500" : "text-muted-foreground")}>
              {expiryData.p2Staked ? "✓" : "○"} Player 2
            </span>
          </div>
        </div>
      )}

      {/* Cancel button (expired only) */}
      {isExpired && (
        <button
          onClick={handleCancel}
          disabled={isCancelling || !userWalletAddress}
          className={cn(
            "w-full h-11 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2",
            "bg-red-500 hover:bg-red-400 text-white",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "active:scale-[0.99]",
          )}
        >
          {isCancelling ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Cancelling…</>
          ) : (
            <><AlertTriangle className="h-4 w-4" /> Cancel & Refund Stake</>
          )}
        </button>
      )}
    </div>
  );
}