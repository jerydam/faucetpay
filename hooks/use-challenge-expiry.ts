/**
 * useChallengeExpiry
 *
 * Single source-of-truth expiry timer for both Pre-Lobby and Lobby pages.
 *
 * - Fetches /api/challenge/{code}/expiry on mount and re-polls every 30 s
 * - Derives a live secondsLeft ticker from the backend `expiresAt` unix timestamp
 *   so all clients converge on the same countdown regardless of local clock drift
 * - Returns everything both pages need to render the timer and cancel button
 */

import { useState, useEffect, useRef, useCallback } from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "https://conscious-adorne-faucetdrops-fc77a861.koyeb.app";

export interface ExpiryData {
  /** Unix seconds when the window closes */
  expiresAt: number;
  /** true = on-chain burn window; false = stale off-chain window */
  onChain: boolean;
  /** QuizHub contract status byte (1 = Registered). Only meaningful when onChain=true */
  contractStatus: number | null;
  /** Whether both players have confirmed their burn (only relevant on-chain) */
  p1Staked: boolean;
  p2Staked: boolean;
  player1: string | null;
  player2: string | null;
  /** Total seconds for the window (used to compute progress bar) */
  windowSeconds: number;
  creator: string | null;
}

export interface UseChallengeExpiryReturn {
  /** Live countdown in seconds, null while loading */
  secondsLeft: number | null;
  /** Parsed backend data, null while loading */
  expiryData: ExpiryData | null;
  /** True when secondsLeft === 0 AND the contract says it's still cancellable */
  isExpired: boolean;
  /** 0–1 progress (1 = full / plenty of time, 0 = expired) */
  progress: number;
  /** Urgency tier for coloring */
  urgency: "ok" | "warning" | "critical" | "expired";
  /** Human-readable H:MM:SS string */
  formatted: string;
  /** Manually re-fetch (e.g. after a cancel attempt) */
  refresh: () => void;
  /** Whether the fetch is in-flight */
  loading: boolean;
}

function secondsToHMS(s: number): string {
  const h   = Math.floor(s / 3600);
  const m   = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/**
 * @param code  Challenge code (uppercased automatically)
 * @param phase Pass the current game phase so we stop polling after "game_over"
 * @param pollMs How often to re-sync with the backend (default 30 000 ms)
 */
export function useChallengeExpiry(
  code: string | null | undefined,
  phase: string,
  pollMs = 30_000,
): UseChallengeExpiryReturn {
  const [expiryData, setExpiryData]   = useState<ExpiryData | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [loading, setLoading]         = useState(false);
  const tickRef                       = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef                       = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchExpiry = useCallback(async () => {
    if (!code) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/challenge/${code.toUpperCase()}/expiry`);
      if (!res.ok) return;
      const d = await res.json();
      if (!d.success) return;

      const data: ExpiryData = {
        expiresAt:      d.expiresAt,
        onChain:        d.onChain ?? false,
        contractStatus: d.status  ?? null,
        p1Staked:       d.p1Staked ?? false,
        p2Staked:       d.p2Staked ?? false,
        player1:        d.player1  ?? null,
        player2:        d.player2  ?? null,
        windowSeconds:  d.windowSeconds ?? (d.onChain ? 9000 : 18000),
        creator:        d.creator  ?? null,
      };
      setExpiryData(data);

      // Immediately sync the ticker to fresh backend time
      const now  = Math.floor(Date.now() / 1000);
      const left = Math.max(0, data.expiresAt - now);
      setSecondsLeft(left);
    } catch {
      // Silently ignore — stale local state is acceptable for a timer
    } finally {
      setLoading(false);
    }
  }, [code]);

  // ── 1-second local ticker ────────────────────────────────────────────────
  useEffect(() => {
    if (!expiryData) return;

    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      const now  = Math.floor(Date.now() / 1000);
      const left = Math.max(0, expiryData.expiresAt - now);
      setSecondsLeft(left);
    }, 1000);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [expiryData]);

  // ── Backend poll ─────────────────────────────────────────────────────────
  useEffect(() => {
    const stopped = phase === "game_over" || phase === "question" || phase === "reveal" || phase === "round_end";
    if (stopped || !code) return;

    fetchExpiry();

    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(fetchExpiry, pollMs);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [code, phase, pollMs, fetchExpiry]);

  // ── Derived values ────────────────────────────────────────────────────────
  const isExpired =
    secondsLeft === 0 &&
    expiryData !== null &&
    (expiryData.onChain ? expiryData.contractStatus === 1 : true);

  const progress =
    expiryData && secondsLeft !== null
      ? Math.max(0, secondsLeft / expiryData.windowSeconds)
      : 1;

  const urgency: "ok" | "warning" | "critical" | "expired" =
    isExpired                    ? "expired"
    : secondsLeft === null       ? "ok"
    : secondsLeft <= 300         ? "critical"   // ≤ 5 min
    : secondsLeft <= 900         ? "warning"    // ≤ 15 min
    : "ok";

  const formatted =
    secondsLeft === null ? "--:--:--"
    : isExpired          ? "Expired"
    : secondsToHMS(secondsLeft);

  return {
    secondsLeft,
    expiryData,
    isExpired,
    progress,
    urgency,
    formatted,
    refresh: fetchExpiry,
    loading,
  };
}