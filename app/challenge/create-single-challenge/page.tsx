"use client";

import React, { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/hooks/use-wallet";
import { Header } from "@/components/header";
import { getActiveSigner } from "@/lib/getSigner";
import { keccak256, toUtf8Bytes } from "ethers";
import {
  Loader2, Zap, ChevronRight, AlertCircle,
  HelpCircle, Swords,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CELO_CHAIN_ID, getChainConfig } from "@/lib/chain";
import { withAttribution, LEGACY_TX } from "@/lib/attribution-tag";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "https://conscious-adorne-faucetdrops-fc77a861.koyeb.app";

// Layout constants — keep the CTA's position and the page's scroll padding
// in sync. If your bottom nav's height changes, only update this one value.
const BOTTOM_NAV_HEIGHT = 64; // px

interface Tier {
  level:         number;
  tierName:      string;
  emoji:         string;
  botUsername:   string;
  stake:         number;
  questionCount: number;
  accuracy:      number;
  label:         string;
  description:   string;
}

const TIERS: Tier[] = [
  {
    level: 1, tierName: "Droplet", emoji: "💧", botUsername: "Droplet 💧",
    stake: 10, questionCount: 15, accuracy: 35,
    label: "Easy", description: "Low stakes warm-up. Short game, easygoing bot.",
  },
  {
    level: 2, tierName: "Drizzle", emoji: "🌦", botUsername: "Drizzle 🌦",
    stake: 20, questionCount: 18, accuracy: 50,
    label: "Normal", description: "Balanced match. Bot answers correctly ~half the time.",
  },
  {
    level: 3, tierName: "Downpour", emoji: "🌧", botUsername: "Downpour 🌧",
    stake: 30, questionCount: 21, accuracy: 63,
    label: "Hard", description: "More questions, sharper opponent. Stay focused.",
  },
  {
    level: 4, tierName: "Torrent", emoji: "⛈", botUsername: "Torrent ⛈",
    stake: 40, questionCount: 24, accuracy: 76,
    label: "Expert", description: "Fast and accurate bot. Expect a real fight.",
  },
  {
    level: 5, tierName: "Flood", emoji: "🌊", botUsername: "Flood 🌊",
    stake: 50, questionCount: 30, accuracy: 90,
    label: "Max", description: "30 Qs. 90% accuracy. No mercy.",
  },
];

const TIER_ACCENT: Record<number, { ring: string; bg: string; text: string; bar: string }> = {
  1: { ring: "border-sky-400 dark:border-sky-500",       bg: "bg-sky-50 dark:bg-sky-950/40",       text: "text-sky-600 dark:text-sky-400",       bar: "bg-sky-400" },
  2: { ring: "border-teal-400 dark:border-teal-500",     bg: "bg-teal-50 dark:bg-teal-950/40",     text: "text-teal-600 dark:text-teal-400",     bar: "bg-teal-400" },
  3: { ring: "border-blue-400 dark:border-blue-500",     bg: "bg-blue-50 dark:bg-blue-950/40",     text: "text-blue-600 dark:text-blue-400",     bar: "bg-blue-400" },
  4: { ring: "border-violet-400 dark:border-violet-500", bg: "bg-violet-50 dark:bg-violet-950/40", text: "text-violet-600 dark:text-violet-400", bar: "bg-violet-400" },
  5: { ring: "border-rose-400 dark:border-rose-500",     bg: "bg-rose-50 dark:bg-rose-950/40",     text: "text-rose-600 dark:text-rose-400",     bar: "bg-rose-400" },
};

function AccuracyBar({ pct, level }: { pct: number; level: number }) {
  const filled = Math.round(pct / 10);
  const { bar } = TIER_ACCENT[level];
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className={cn("h-1 rounded-full flex-1", i < filled ? bar : "bg-muted")} />
      ))}
    </div>
  );
}

function TierCard({
  tier, selected, onSelect,
}: { tier: Tier; selected: boolean; onSelect: (l: number) => void }) {
  const ac = TIER_ACCENT[tier.level];
  return (
    <button
      onClick={() => onSelect(tier.level)}
      className={cn(
        "relative flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all duration-150 text-center w-full",
        selected
          ? cn("border-2", ac.ring, ac.bg, "shadow-sm")
          : "border-border bg-card hover:border-muted-foreground/30 hover:bg-muted/20",
      )}
    >
      {tier.level === 5 && (
        <span className={cn(
          "absolute -top-2 left-1/2 -translate-x-1/2 text-[8px] font-black px-1.5 py-0.5 rounded-full whitespace-nowrap border",
          ac.bg, ac.text, ac.ring,
        )}>
          HARDEST
        </span>
      )}

      <span className="text-2xl leading-none mt-1">{tier.emoji}</span>

      <div>
        <p className={cn("font-black text-xs leading-tight", selected ? ac.text : "text-foreground")}>
          {tier.tierName}
        </p>
        <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">{tier.label}</p>
      </div>

      <div className="w-full space-y-1">
        <AccuracyBar pct={tier.accuracy} level={tier.level} />
        <p className="text-[9px] text-muted-foreground font-bold">{tier.accuracy}% bot</p>
      </div>

      <div className="space-y-0.5 w-full">
        <p className={cn("text-xs font-black", selected ? ac.text : "text-foreground")}>
          {tier.stake} <span className="text-[9px] font-bold text-muted-foreground">DROPS</span>
        </p>
        <p className="text-[9px] text-muted-foreground font-medium">{tier.questionCount} Qs</p>
      </div>

      {selected && (
        <div className={cn("absolute inset-0 rounded-2xl pointer-events-none opacity-10", ac.bar)} />
      )}
    </button>
  );
}

export default function CreateSinglePage() {
  const router = useRouter();
  const { address, chainId } = useWallet();
  const [topic,      setTopic]      = useState("");
  const [difficulty, setDifficulty] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const selectedTier = TIERS.find(t => t.level === difficulty) ?? null;
  const username     = address ? `User${address.slice(-4).toUpperCase()}` : null;

  const canSubmit =
    topic.trim().length >= 3 &&
    difficulty !== null &&
    !!address &&
    !submitting;

  const handleCreate = async () => {
  if (!address || !selectedTier) return
  setSubmitting(true)
  setError(null)

  try {
    // Step 1: reserve a code from backend
    const reserveRes = await fetch(`${API_BASE_URL}/api/challenge/single/reserve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creatorAddress: address}),
    })
    const { code } = await reserveRes.json()
    if (!code) throw new Error("Failed to reserve challenge code")

    // Step 2: creator calls createQuiz(quizId) on-chain
    toast.info("Confirm quiz creation in your wallet…")
    const activeSigner = await getActiveSigner()
    if (!activeSigner) throw new Error("No signer available")

    const quizId = keccak256(toUtf8Bytes(code))
    const { Interface } = await import("ethers")
    const iface    = new Interface(["function createQuiz(bytes32 quizId)"])
    const calldata = iface.encodeFunctionData("createQuiz", [quizId])
    const chainCfg = getChainConfig()

    const tx      = await activeSigner.sendTransaction({ to: chainCfg.contracts.quizHub, data: withAttribution(calldata), ...LEGACY_TX })
    toast.loading("Waiting for confirmation…", { id: "sp-create" })
    const receipt = await tx.wait()
    if (!receipt || receipt.status !== 1) throw new Error("createQuiz tx reverted")
    toast.success("Quiz created on-chain!", { id: "sp-create" })

    // Step 3: send to backend with createTxHash
    const res = await fetch(`${API_BASE_URL}/api/challenge/single/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic:           topic.trim(),
        creatorAddress:  address,
        creatorUsername: username ?? `User${address.slice(-4).toUpperCase()}`,
        difficulty,
        chainId:         CELO_CHAIN_ID,
        createTxHash:    receipt.hash,
        reservedCode:    code,   // backend uses this exact code
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.detail ?? "Failed to create challenge")

    toast.success(`${selectedTier.tierName} challenge created — entering lobby…`)
    router.push(`/challenge/${data.code}`)

  } catch (err: any) {
    const msg = err?.message ?? "Something went wrong"
    setError(msg)
    toast.error(msg)
  } finally {
    setSubmitting(false)
  }
}
  return (
    <div className="min-h-screen bg-background">

      <Header pageTitle="Create Solo Challenge" />

      <div
        className="max-w-2xl mx-auto px-4 py-6 space-y-6 overflow-y-auto"
        style={{ paddingBottom: BOTTOM_NAV_HEIGHT + 116 }}
      >

        {/* Heading */}
        <div>
          <h1 className="font-black text-xl text-foreground">Pick your challenge</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Play solo against a bot. Win earnings go straight to your game wallet.
          </p>
        </div>

        {/* Topic */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-black text-foreground uppercase tracking-wider">
            Topic
          </label>
          <div className="relative">
            <input
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="e.g. Web3 fundamentals, African history, Solidity…"
              maxLength={120}
              className={cn(
                "w-full bg-card border-2 border-border rounded-xl px-4 py-3 pr-14",
                "text-sm font-medium text-foreground placeholder:text-muted-foreground/50",
                "focus:outline-none focus:border-primary/60 transition-colors",
                topic.trim().length < 3 && topic.length > 0 && "border-red-400/60",
              )}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground pointer-events-none">
              {topic.length}/120
            </span>
          </div>
          {topic.length > 0 && topic.trim().length < 3 && (
            <p className="text-[11px] text-red-500 font-medium flex items-center gap-1">
              <AlertCircle className="h-3 w-3" /> At least 3 characters
            </p>
          )}
        </div>

        {/* Difficulty */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-black text-foreground uppercase tracking-wider">
              Difficulty
            </label>
            <span className="text-[10px] text-muted-foreground font-bold flex items-center gap-1">
              <HelpCircle className="h-3 w-3" /> Stake &amp; questions fixed per tier
            </span>
          </div>

          {/* Row 1: 3 cards */}
          <div className="grid grid-cols-3 gap-2">
            {TIERS.slice(0, 3).map(tier => (
              <TierCard
                key={tier.level}
                tier={tier}
                selected={difficulty === tier.level}
                onSelect={setDifficulty}
              />
            ))}
          </div>

          {/* Row 2: 2 cards centered */}
          <div className="grid grid-cols-2 gap-2">
            {TIERS.slice(3).map(tier => (
              <TierCard
                key={tier.level}
                tier={tier}
                selected={difficulty === tier.level}
                onSelect={setDifficulty}
              />
            ))}
          </div>

          {/* Selected tier description */}
          {selectedTier && (
            <p className="text-xs text-muted-foreground bg-muted/40 rounded-xl px-3 py-2 leading-relaxed border border-border">
              <span className="font-black text-foreground">
                {selectedTier.emoji} {selectedTier.tierName}:
              </span>{" "}
              {selectedTier.description}
            </p>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-600 dark:text-red-400 font-medium">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {/* Summary card */}
        {selectedTier && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className={cn("h-0.5", TIER_ACCENT[selectedTier.level].bar)} />
            <div className="p-4 grid grid-cols-2 gap-y-3">
              {(
                [
                  ["Opponent",   selectedTier.botUsername],
                  ["Stake",      `${selectedTier.stake} DROPS`],
                  ["Questions",  selectedTier.questionCount.toString()],
                  ["Win payout", `${selectedTier.stake * 2} DROPS`],
                ] as [string, string][]
              ).map(([label, value], i) => (
                <div key={label}>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide">
                    {label}
                  </p>
                  <p className={cn(
                    "text-sm font-black mt-0.5",
                    i === 3 ? "text-green-500 dark:text-green-400" : "text-foreground",
                  )}>
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Wallet warning */}
        {!address && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-sm text-amber-600 dark:text-amber-400 font-medium">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Connect your wallet to start
          </div>
        )}
      </div>

      {/* Fixed CTA — sits above the bottom nav, page content scrolls beneath it */}
      <div
        className="fixed left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-md"
        style={{ bottom: BOTTOM_NAV_HEIGHT }}
      >
        <div className="max-w-2xl mx-auto px-4 py-3">
          <button
            disabled={!canSubmit}
            onClick={handleCreate}
            className={cn(
              "w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-black text-sm transition-all",
              canSubmit
                ? "bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98]"
                : "bg-muted text-muted-foreground cursor-not-allowed",
            )}
          >
            {submitting ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</>
            ) : (
              <>
                <Zap className="h-4 w-4" />
                {selectedTier ? `Start ${selectedTier.tierName} Challenge` : "Select a difficulty"}
                {selectedTier && <ChevronRight className="h-4 w-4" />}
              </>
            )}
          </button>
          {selectedTier && (
            <p className="text-center text-[10px] text-muted-foreground font-bold mt-1.5">
              {selectedTier.stake} DROPS deducted from your game wallet
            </p>
          )}
        </div>
      </div>
    </div>
  );
}