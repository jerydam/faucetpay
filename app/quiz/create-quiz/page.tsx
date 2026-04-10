"use client";

import React, { useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/hooks/use-wallet";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, Trash2, Sparkles, Loader2, CheckCircle2, ChevronUp, ChevronDown,
  Clock, Users, Trophy, Zap, Edit3, Eye, ArrowLeft, Copy, BookOpen,
  Lightbulb, Check, Coins, Gift, Info, Crown, Award, Medal,
  Equal, Percent, AlertCircle, Upload, ImageIcon, X as XIcon, Link, Timer,
  ChevronRight, ChevronLeft, Star, Flame, Target, Rocket, PartyPopper,
  FileText
} from "lucide-react";
import {
  deployQuizReward,
  type QuizRewardConfig,
} from "@/lib/quiz";
import { BrowserProvider } from "ethers";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useWallets } from "@privy-io/react-auth";
import { getNetworkByChainId } from "@/hooks/use-network";
// ── On-chain error parser ──────────────────────────────────────
function parseOnchainError(err: any): string {
  // User rejected the transaction in their wallet
  if (
    err?.code === 4001 ||
    err?.code === "ACTION_REJECTED" ||
    err?.info?.error?.code === 4001 ||
    err?.message?.toLowerCase().includes("user rejected") ||
    err?.message?.toLowerCase().includes("user denied")
  ) {
    return "Transaction cancelled — you rejected it in your wallet.";
  }

  // Insufficient funds for gas
  if (
    err?.message?.toLowerCase().includes("insufficient funds") ||
    err?.message?.toLowerCase().includes("insufficient balance")
  ) {
    return "Insufficient balance to cover this transaction + gas fees.";
  }

  // Contract revert with a reason string
  if (err?.reason && typeof err.reason === "string" && err.reason.trim()) {
    return `Contract error: ${err.reason}`;
  }

  // ethers v6 nested revert data
  if (err?.info?.error?.message) {
    const inner = err.info.error.message as string;
    // Strip verbose RPC prefixes like "execution reverted: "
    const cleaned = inner.replace(/^execution reverted:\s*/i, "").trim();
    if (cleaned) return `Contract error: ${cleaned}`;
  }

  // Network / RPC issues
  if (
    err?.message?.toLowerCase().includes("network") ||
    err?.message?.toLowerCase().includes("could not detect network")
  ) {
    return "Network error — check your connection and try again.";
  }

  // Gas estimation failed (usually means the tx would revert)
  if (
    err?.message?.toLowerCase().includes("cannot estimate gas") ||
    err?.message?.toLowerCase().includes("gas required exceeds")
  ) {
    return "Transaction would fail on-chain — check your balance and allowance.";
  }

  // Nonce issues
  if (err?.message?.toLowerCase().includes("nonce")) {
    return "Transaction nonce conflict — please reset your wallet activity and retry.";
  }

  // Fallback: trim long raw messages
  const raw: string = err?.message || "Unknown error";
  return raw.length > 120 ? raw.slice(0, 120) + "…" : raw;
}
const API_BASE_URL = "https://identical-vivi-faucetdrops-41e9c56b.koyeb.app";

interface QuizOption { id: "A" | "B" | "C" | "D"; text: string }
interface QuizQuestion {
  id: string; question: string; options: QuizOption[];
  correctId: "A" | "B" | "C" | "D"; timeLimit: number;
}
type DistributionType = "equal" | "custom";
interface RewardConfig {
  poolAmount: string; tokenAddress: string; tokenSymbol: string;
  tokenDecimals: number; tokenLogoUrl: string; totalWinners: number;
  distributionType: DistributionType; customTiers: Record<number, string>;
  claimWindowDuration: number;
}


const MAX_FILE_SIZE_MB = 5;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"];

const CLAIM_WINDOW_OPTIONS = [
  { label: "7 Hours", value: 7 * 3600 },
  { label: "24 Hours", value: 24 * 3600 },
  { label: "48 Hours", value: 48 * 3600 },
  { label: "7 Days", value: 7 * 24 * 3600 },
  { label: "30 Days", value: 30 * 24 * 3600 },
];

interface TokenConfiguration {
  address: string; name: string; symbol: string; decimals: number;
  isNative?: boolean; logoUrl: string; description: string;
}

const ALL_TOKENS_BY_CHAIN: Record<number, TokenConfiguration[]> = {
  42220: [
    { address: "0x471EcE3750Da237f93B8E339c536989b8978a438", name: "Celo", symbol: "CELO", decimals: 18, isNative: true, logoUrl: "/celo.jpeg", description: "Native Celo token" },
    { address: "0x765DE816845861e75A25fCA122bb6898B8B1282a", name: "Celo Dollar", symbol: "cUSD", decimals: 18, logoUrl: "/cusd.png", description: "USD-pegged stablecoin" },
    { address: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e", name: "Tether", symbol: "USDT", decimals: 6, logoUrl: "/usdt.jpg", description: "Tether USD stablecoin" },
    { address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C", name: "USD Coin", symbol: "USDC", decimals: 6, logoUrl: "/usdc.jpg", description: "USD Coin stablecoin" },
  ],
  1135: [
    { address: "0x0000000000000000000000000000000000000000", name: "Ethereum", symbol: "ETH", decimals: 18, isNative: true, logoUrl: "/ether.jpeg", description: "Native Ethereum" },
    { address: "0xac485391EB2d7D88253a7F1eF18C37f4242D1A24", name: "Lisk", symbol: "LSK", decimals: 18, logoUrl: "/lsk.png", description: "Lisk native token" },
  ],
  42161: [
    { address: "0x0000000000000000000000000000000000000000", name: "Ethereum", symbol: "ETH", decimals: 18, isNative: true, logoUrl: "/ether.jpeg", description: "Native Ethereum" },
    { address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", name: "USD Coin", symbol: "USDC", decimals: 6, logoUrl: "/usdc.jpg", description: "Native USD Coin" },
  ],
  8453: [
    { address: "0x0000000000000000000000000000000000000000", name: "Ethereum", symbol: "ETH", decimals: 18, isNative: true, logoUrl: "/ether.jpeg", description: "Native Ethereum" },
    { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", name: "USD Coin", symbol: "USDC", decimals: 6, logoUrl: "/usdc.jpg", description: "Native USD Coin" },
  ],
  56: [
    { address: "0x0000000000000000000000000000000000000000", name: "BNB", symbol: "BNB", decimals: 18, isNative: true, logoUrl: "/bnb.png", description: "Native BNB" },
    { address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", name: "USD Coin", symbol: "USDC", decimals: 18, logoUrl: "/usdc.jpg", description: "Binance-Peg USD Coin" },
    { address: "0x55d398326f99059fF775485246999027B3197955", name: "Tether USD", symbol: "USDT", decimals: 18, logoUrl: "/usdt.jpg", description: "Binance-Peg BSC-USD" },
    { address: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56", name: "BUSD", symbol: "BUSD", decimals: 18, logoUrl: "/busd.png", description: "Binance-Peg BUSD Token" },
    { address: "0x33A3d962955A3862C8093D1273344719f03cA17C", name: "SPORE", symbol: "SPR", decimals: 9, logoUrl: "/spore.png", description: "Binance meme Token" },
  ],
};

const COINGECKO_IDS: Record<string, string> = {
  CELO: "celo", cUSD: "celo-dollar", USDT: "tether", USDC: "usd-coin",
  ETH: "ethereum", LSK: "lisk", BNB: "binance-coin", BUSD: "binance-usd",
};
const CHAIN_NAMES: Record<number, string> = {
  42220: "Celo", 1135: "Lisk", 42161: "Arbitrum", 8453: "Base", 56: "BNB Chain",
};

// Kahoot-inspired option colors — bright and fun
const OPTION_COLORS: Record<string, { bg: string; hover: string; ring: string; light: string }> = {
  A: { bg: "bg-[#e21b3c]", hover: "hover:bg-[#c4172f]", ring: "ring-[#e21b3c]", light: "bg-[#fde8ec]" },
  B: { bg: "bg-[#1368ce]", hover: "hover:bg-[#0e57ad]", ring: "ring-[#1368ce]", light: "bg-[#e8f0fb]" },
  C: { bg: "bg-[#d89e00]", hover: "hover:bg-[#b88400]", ring: "ring-[#d89e00]", light: "bg-[#fdf6e3]" },
  D: { bg: "bg-[#26890c]", hover: "hover:bg-[#1e6e09]", ring: "ring-[#26890c]", light: "bg-[#e8f5e3]" },
};
const OPTION_SHAPES: Record<string, string> = { A: "▲", B: "◆", C: "●", D: "■" };
const RANK_ICONS = [Crown, Medal, Award, Trophy, Trophy, Trophy, Trophy, Trophy, Trophy, Trophy];
const RANK_COLORS = [
  "text-yellow-500", "text-slate-400", "text-amber-600",
  "text-indigo-400", "text-indigo-400", "text-indigo-400",
  "text-indigo-400", "text-indigo-400", "text-indigo-400", "text-indigo-400",
];

// Wizard steps — Questions step is only for manual mode
const WIZARD_STEPS_MANUAL = [
  { id: "details", label: "Setup", emoji: "🎯", desc: "Name your quiz" },
  { id: "questions", label: "Questions", emoji: "🧠", desc: "Build the challenge" },
  { id: "rewards", label: "Rewards", emoji: "💰", desc: "Set the prize pool" },
  { id: "launch", label: "Launch", emoji: "🚀", desc: "Go live!" },
];
const WIZARD_STEPS_AI = [
  { id: "details", label: "Setup", emoji: "🎯", desc: "Name your quiz" },
  { id: "rewards", label: "Rewards", emoji: "💰", desc: "Set the prize pool" },
  { id: "launch", label: "Launch", emoji: "🚀", desc: "Go live!" },
];

const blankQuestion = (): QuizQuestion => ({
  id: crypto.randomUUID(),
  question: "",
  options: [{ id: "A", text: "" }, { id: "B", text: "" }, { id: "C", text: "" }, { id: "D", text: "" }],
  correctId: "A",
  timeLimit: 30,
});

function calcDistribution(config: RewardConfig) {
  const pool = parseFloat(config.poolAmount) || 0;
  const n = config.totalWinners;
  if (n === 0 || pool === 0) return [];
  const rows: { rank: number; pct: number; amount: number }[] = [];
  if (config.distributionType === "equal") {
    const share = 100 / n;
    for (let i = 1; i <= n; i++) rows.push({ rank: i, pct: share, amount: (pool * share) / 100 });
  } else {
    const defaultPct = 100 / n;
    for (let i = 1; i <= n; i++) {
      const pct = parseFloat(config.customTiers[i] ?? String(defaultPct)) || 0;
      rows.push({ rank: i, pct, amount: (pool * pct) / 100 });
    }
  }
  return rows;
}

function customTierTotal(config: RewardConfig): number {
  return Array.from({ length: config.totalWinners }, (_, i) =>
    parseFloat(config.customTiers[i + 1] ?? "0") || 0
  ).reduce((a, b) => a + b, 0);
}

// ── Step Progress Bar ──────────────────────────────────────────
function WizardProgress({
  currentStep, setStep, steps
}: {
  currentStep: number;
  setStep: (n: number) => void;
  steps: typeof WIZARD_STEPS_MANUAL;
}) {
  return (
    <div className="relative flex items-center justify-between w-full max-w-lg mx-auto px-2 mb-8">
      {/* connector line */}
      <div className="absolute top-5 left-8 right-8 h-1 bg-border rounded-full z-0" />
      <div
        className="absolute top-5 left-8 h-1 rounded-full z-0 transition-all duration-500 bg-primary"
        style={{ width: `calc(${(currentStep / (steps.length - 1)) * 100}% - 0px)` }}
      />

      {steps.map((step, idx) => {
        const isDone = idx < currentStep;
        const isActive = idx === currentStep;
        return (
          <button
            key={step.id}
            onClick={() => idx < currentStep && setStep(idx)}
            disabled={idx > currentStep}
            className="relative z-10 flex flex-col items-center gap-1.5 group"
          >
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold border-[3px] transition-all duration-300 shadow-sm",
              isDone
                ? "bg-primary border-primary text-primary-foreground scale-95"
                : isActive
                ? "bg-card border-primary text-primary scale-110 shadow-lg"
                : "bg-card border-border text-muted-foreground"
            )}>
              {isDone ? <Check className="h-4 w-4" /> : step.emoji}
            </div>
            <span className={cn(
              "text-[10px] font-bold hidden sm:block transition-colors",
              isActive ? "text-primary" : isDone ? "text-muted-foreground" : "text-muted-foreground/40"
            )}>
              {step.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── Fun Question Card ──────────────────────────────────────────
function QuestionCard({
  question, index, isActive, total,
  onEdit, onDelete, onMoveUp, onMoveDown
}: {
  question: QuizQuestion; index: number; isActive: boolean; total: number;
  onEdit: () => void; onDelete: () => void; onMoveUp: () => void; onMoveDown: () => void;
}) {
  const isComplete = question.question.trim() && question.options.every(o => o.text.trim());

  return (
    <button
      onClick={onEdit}
      className={cn(
        "w-full text-left rounded-2xl border-2 p-3 transition-all duration-200 group relative overflow-hidden",
        isActive
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-border bg-card hover:border-primary/30 hover:shadow-sm"
      )}
    >
      {isActive && (
        <div className="absolute inset-0 bg-primary/5 pointer-events-none" />
      )}
      <div className="flex items-center gap-3">
        <div className={cn(
          "w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shrink-0 transition-all",
          isComplete
            ? "bg-emerald-500 text-white"
            : isActive
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground"
        )}>
          {isComplete && !isActive ? "✓" : index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn(
            "text-xs font-bold truncate",
            isActive ? "text-primary" : "text-foreground"
          )}>
            {question.question || <span className="italic opacity-50">Untitled question</span>}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{question.timeLimit}s · 4 options</p>
        </div>
        {isActive && (
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={(e) => { e.stopPropagation(); onMoveUp(); }} disabled={index === 0}
              className="w-6 h-6 rounded-lg bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-primary disabled:opacity-30 transition-colors">
              <ChevronUp className="h-3 w-3" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onMoveDown(); }} disabled={index === total - 1}
              className="w-6 h-6 rounded-lg bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-primary disabled:opacity-30 transition-colors">
              <ChevronDown className="h-3 w-3" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="w-6 h-6 rounded-lg bg-destructive/10 border border-destructive/30 flex items-center justify-center text-destructive hover:bg-destructive/20 transition-colors">
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    </button>
  );
}

// ── Floating emoji burst (CSS-only decoration) ─────────────────
function FloatyEmojis() {
  const emojis = ["🎯", "🧠", "💡", "⚡", "🏆", "🎲", "🌟", "🔥"];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {emojis.map((e, i) => (
        <span
          key={i}
          className="absolute text-2xl opacity-[0.06] dark:opacity-[0.04] select-none"
          style={{
            top: `${10 + i * 11}%`,
            left: `${5 + i * 12}%`,
            transform: `rotate(${i * 15 - 30}deg)`,
            fontSize: `${1.2 + (i % 3) * 0.4}rem`,
          }}
        >
          {e}
        </span>
      ))}
    </div>
  );
}

// ── Answer Option Button ───────────────────────────────────────

function AnswerOptionButton({
  opt, isCorrect, text, onChange, onMarkCorrect
}: {
  opt: QuizOption; isCorrect: boolean; text: string;
  onChange: (v: string) => void; onMarkCorrect: () => void;
}) {
  const colors = OPTION_COLORS[opt.id];
  return (
    <div className={cn(
      "rounded-2xl border-2 transition-all duration-200 overflow-hidden",
      isCorrect
        ? `${colors.ring} ring-2 ring-offset-2 ring-offset-background border-transparent shadow-sm`
        : "border-border hover:border-border/80"
    )}>
      <div className={cn(
        "flex items-center",
        isCorrect ? colors.light + " dark:bg-muted/60" : "bg-card"
      )}>
        <button
          type="button"
          onClick={onMarkCorrect}
          className={cn(
            "flex items-center justify-center w-12 h-12 text-white text-base font-black shrink-0 transition-all duration-200 relative",
            colors.bg, colors.hover
          )}
          title="Mark as correct answer"
        >
          {isCorrect ? (
            <Check className="h-5 w-5 drop-shadow" />
          ) : (
            <span className="drop-shadow opacity-90">{OPTION_SHAPES[opt.id]}</span>
          )}
        </button>
        <Input
          value={text}
          onChange={e => onChange(e.target.value)}
          placeholder={`Option ${opt.id}`}
          className="flex-1 h-12 px-3 text-sm font-medium bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none text-foreground placeholder:text-muted-foreground/50"
        />
        {isCorrect && (
          <div className="pr-3 shrink-0">
            <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
              <Check className="h-3 w-3 text-white" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Image Uploader ─────────────────────────────────────────────
type CoverInputMode = "upload" | "url";
interface ImageUploaderProps {
  value: string; onChange: (url: string) => void;
  isUploading: boolean; setIsUploading: (v: boolean) => void;
}
function ImageUploader({ value, onChange, isUploading, setIsUploading }: ImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [mode, setMode] = useState<CoverInputMode>("upload");
  const [urlInput, setUrlInput] = useState(value.startsWith("http") ? value : "");
 

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) { toast.error("Unsupported file type."); return; }
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) { toast.error(`Max size is ${MAX_FILE_SIZE_MB}MB.`); return; }
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_BASE_URL}/api/upload-image`, { method: "POST", body: formData });
      const data = await res.json();
      if (data.url) { onChange(data.url); toast.success("🎨 Cover image uploaded!"); }
      else throw new Error(data.detail || "Upload failed");
    } catch (err: any) {
      toast.error(err?.message || "Failed to upload image");
    } finally { setIsUploading(false); }
  }, [onChange, setIsUploading]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleUrlApply = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) { onChange(""); return; }
    if (!/^https?:\/\//i.test(trimmed)) { toast.error("URL must start with http:// or https://"); return; }
    onChange(trimmed); toast.success("Cover image set!");
  };

  const clear = () => { onChange(""); setUrlInput(""); if (fileInputRef.current) fileInputRef.current.value = ""; };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {(["upload", "url"] as const).map(m => (
          <button key={m} type="button" onClick={() => setMode(m)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all",
              mode === m
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-card text-muted-foreground border-border hover:border-primary/50"
            )}>
            {m === "upload" ? <><Upload className="h-3.5 w-3.5" /> Upload</> : <><Link className="h-3.5 w-3.5" /> URL</>}
          </button>
        ))}
      </div>

      {value ? (
        <div className="relative rounded-2xl overflow-hidden border-2 border-border h-40 shadow-sm">
          <img src={value} alt="Cover" className="w-full h-full object-cover" onError={() => { toast.error("Could not load image"); onChange(""); }} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <button onClick={clear}
            className="absolute top-2 right-2 px-2.5 py-1 rounded-full bg-red-500 hover:bg-red-600 text-white text-xs font-bold shadow-lg transition-all flex items-center gap-1">
            <XIcon className="h-3 w-3" /> Remove
          </button>
          <div className="absolute bottom-2 left-3 flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-white text-xs font-bold drop-shadow">Cover set ✓</span>
          </div>
          {isUploading && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-white" />
            </div>
          )}
        </div>
      ) : mode === "upload" ? (
        <>
          <input ref={fileInputRef} type="file" accept={ACCEPTED_IMAGE_TYPES.join(",")} className="hidden"
            onChange={e => handleFiles(e.target.files)} />
          <div
            onClick={() => !isUploading && fileInputRef.current?.click()}
            onDrop={onDrop}
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            className={cn(
              "relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed cursor-pointer transition-all h-40 select-none group",
              isDragging
                ? "border-primary bg-primary/5 scale-[1.01]"
                : "border-border bg-muted/30 hover:border-primary/50 hover:bg-primary/5",
              isUploading && "pointer-events-none opacity-60"
            )}>
            {isUploading ? (
              <><Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-xs text-muted-foreground font-medium">Uploading…</p></>
            ) : (
              <>
                <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center text-3xl transition-all",
                  isDragging ? "bg-primary/10 scale-110" : "bg-card group-hover:scale-110 shadow-sm border border-border")}>
                  {isDragging ? "🖼️" : "📸"}
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-foreground">
                    {isDragging ? "Drop it!" : "Add a cover image"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Drag & drop · JPG, PNG, GIF, WebP · max {MAX_FILE_SIZE_MB}MB</p>
                </div>
              </>
            )}
          </div>
        </>
      ) : (
        <div className="flex gap-2">
          <Input value={urlInput} onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleUrlApply()}
            placeholder="https://example.com/image.jpg"
            className="flex-1 h-11 rounded-xl" />
          <Button onClick={handleUrlApply} disabled={!urlInput.trim()} className="shrink-0 rounded-xl">Apply</Button>
        </div>
      )}
    </div>
  );
}

// ── Reward Preview ─────────────────────────────────────────────
function RewardPreview({ config }: { config: RewardConfig }) {
  const rows = useMemo(() => calcDistribution(config), [config]);
  if (rows.length === 0) return null;
  const podiumEmoji = ["🥇", "🥈", "🥉"];
  return (
    <div className="space-y-2">
      <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">Prize Breakdown</p>
      <div className="space-y-1.5">
        {rows.map(row => {
          const emoji = podiumEmoji[row.rank - 1] ?? "🏅";
          return (
            <div key={row.rank} className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 border",
              row.rank === 1 ? "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800" :
              row.rank === 2 ? "bg-muted/30 border-border" :
              row.rank === 3 ? "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800" :
              "bg-muted/20 border-border"
            )}>
              <span className="text-lg">{emoji}</span>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full",
                    row.rank === 1 ? "bg-yellow-500" : row.rank === 2 ? "bg-muted-foreground/50" : row.rank === 3 ? "bg-amber-500" : "bg-primary"
                  )}
                  style={{ width: `${row.pct}%` }}
                />
              </div>
              <span className="text-xs font-black text-foreground tabular-nums">
                {row.amount.toFixed(4)} <span className="text-muted-foreground font-medium">{config.tokenSymbol || "TKN"}</span>
              </span>
              <span className="text-[10px] text-muted-foreground w-9 text-right">{row.pct.toFixed(1)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Deploy Progress ────────────────────────────────────────────
type DeployStep = "idle" | "deploying" | "saving" | "done" | "error";

export function DeployProgress({ step, contractAddress, error }: {
  step: DeployStep; contractAddress?: string; error?: string;
}) {
  if (step === "idle") return null;
  const steps = [
    { key: "deploying" as DeployStep, label: "Deploy Contract", emoji: "⛓️", desc: "Deploying QuizReward contract on-chain" },
    { key: "saving" as DeployStep, label: "Save Quiz", emoji: "💾", desc: "Storing quiz + contract on backend" },
    { key: "done" as DeployStep, label: "All Done!", emoji: "🎉", desc: "Head to lobby to fund & start" },
  ];
  const order: DeployStep[] = ["deploying", "saving", "done"];
  const currentIdx = order.indexOf(step);

  return (
    <div className="rounded-2xl border-2 border-primary/20 bg-primary/5 p-5 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-center gap-2">
        {step === "error" ? <span className="text-xl">❌</span>
          : step === "done" ? <span className="text-xl">🎊</span>
          : <Loader2 className="h-5 w-5 animate-spin text-primary" />}
        <p className="font-black text-sm text-foreground">
          {step === "error" ? "Something went wrong" : step === "done" ? "Quiz Created!" : "Creating your quiz…"}
        </p>
      </div>
      {step !== "error" && (
        <div className="space-y-2.5">
          {steps.map(({ key, label, desc, emoji }, i) => {
            const stepIdx = order.indexOf(key);
            const isDone = step === "done" || stepIdx < currentIdx;
            const isActive = stepIdx === currentIdx && step !== "done";
            return (
              <div key={key} className="flex items-center gap-3">
                <div className={cn(
                  "w-7 h-7 rounded-xl flex items-center justify-center text-sm font-black shrink-0 transition-all",
                  isDone ? "bg-emerald-500 text-white" : isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}>
                  {isDone ? "✓" : isActive ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : emoji}
                </div>
                <div>
                  <p className={cn("text-xs font-bold",
                    isDone ? "text-emerald-600 dark:text-emerald-400" : isActive ? "text-primary" : "text-muted-foreground"
                  )}>{label}</p>
                  {isActive && <p className="text-[10px] text-muted-foreground">{desc}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {step === "error" && error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-3">
          <p className="text-xs text-destructive font-medium break-words">{error}</p>
        </div>
      )}
      {step === "done" && contractAddress && (
        <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded-xl px-3 py-2">
          <p className="text-[10px] text-emerald-600 font-black uppercase tracking-wide">Contract Deployed ✓</p>
          <p className="text-[10px] font-mono text-emerald-700 dark:text-emerald-300 break-all">{contractAddress}</p>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  Main Page
// ══════════════════════════════════════════════════════════════
export default function CreateQuizPage() {
  const router = useRouter();
  const { address: userWalletAddress } = useWallet();
  const { wallets } = useWallets();
  const activeWallet = wallets[0];
  const chainId = activeWallet ? parseInt(activeWallet.chainId.split(":")[1] ?? "0") : 0;
  const availableTokens = ALL_TOKENS_BY_CHAIN[chainId] ?? [];
  const chainName = CHAIN_NAMES[chainId] ?? "Unknown Network";

  const targetNetwork = getNetworkByChainId(chainId);
  const isSupportedNetwork = !!targetNetwork?.factories?.quiz;
  // Add alongside your existing pdfNumQuestions state
const [pdfSecondsPerQuestion, setPdfSecondsPerQuestion] = useState(20);
  // Wizard step: 0=details, 1=questions, 2=rewards, 3=launch
  const [wizardStep, setWizardStep] = useState(0);

  type DeployStep = "idle" | "deploying" | "saving" | "done" | "error";
  const [deployStep, setDeployStep] = useState<DeployStep>("idle");
  const [deployError, setDeployError] = useState("");
  const [rewardContractAddress, setRewardContractAddress] = useState("");

  // Meta
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [maxParticipants, setMaxParticipants] = useState<number>(0);
  const [startTime, setStartTime] = useState(() => {
    const d = new Date(Date.now() + 5 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [creatorUsername, setCreatorUsername] = useState("");
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfNumQuestions, setPdfNumQuestions] = useState(5);
  const [pendingPdfFile, setPendingPdfFile] = useState<File | null>(null);

  // Questions
  const [questions, setQuestions] = useState<QuizQuestion[]>([blankQuestion()]);
  const [activeQIdx, setActiveQIdx] = useState(0);
  const [mode, setMode] = useState<"build" | "ai">("build");

  // AI
  const [aiTopic, setAiTopic] = useState("");
  const [aiNumQ, setAiNumQ] = useState(10);
  const [aiDifficulty, setAiDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [aiTimePerQ, setAiTimePerQ] = useState(30);
  const [isGenerating, setIsGenerating] = useState(false);
   // Add these new states and ref
  const [isPdfUploading, setIsPdfUploading] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  // Add the handler function
const handlePdfFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  if (pdfInputRef.current) pdfInputRef.current.value = "";

  // ✅ Mobile browsers report PDFs inconsistently — check name too
  const isPdf =
    file.type === "application/pdf" ||
    file.type === "application/x-pdf" ||
    file.type === "" || // iOS sometimes sends empty MIME type
    file.name.toLowerCase().endsWith(".pdf");

  if (!isPdf) {
    toast.error("Please upload a PDF file.");
    return;
  }

  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    toast.error(`Max size is ${MAX_FILE_SIZE_MB}MB.`);
    return;
  }

  setPendingPdfFile(file);
  setPdfNumQuestions(5);
  setShowPdfModal(true);
};


const handlePdfUpload = async () => {
  if (!pendingPdfFile) return;
  setShowPdfModal(false);
  setIsPdfUploading(true);
  
  // 🔔 1. Start loading toast for PDF
  let toastId = toast.loading("📄 Reading PDF and extracting facts...");

  try {
    const formData = new FormData();
    formData.append("file", pendingPdfFile);
    formData.append("numQuestions", String(pdfNumQuestions));
    formData.append("timePerQuestion", String(pdfSecondsPerQuestion));

    const res = await fetch(`${API_BASE_URL}/api/quiz/generate-from-pdf`, {
      method: "POST",
      body: formData,
    });
    
    const data = await res.json();

    if (data.success && data.questions) {
      const newQuestions = data.questions.map((q: any) => ({
        id: crypto.randomUUID(),
        question: q.question,
        options: q.options,
        correctId: q.correctId,
        timeLimit: pdfSecondsPerQuestion,
      }));
      
      setQuestions(prev => {
        if (prev.length === 1 && !prev[0].question.trim() && !prev[0].options[0].text.trim()) {
          return newQuestions;
        }
        return [...prev, ...newQuestions];
      });
      
      // 🔔 2. Success update!
      toast.success(`✨ ${newQuestions.length} questions imported from PDF!`, { id: toastId });
    } else {
      throw new Error(data.detail || data.message || "Failed to process PDF");
    }
  } catch (err: any) {
    // 🔔 3. Error update!
    toast.error(`❌ Error processing PDF: ${err?.message}`, { id: toastId });
  } finally {
    setIsPdfUploading(false);
    setPendingPdfFile(null);
  }
};

  // Reward
  const [reward, setReward] = useState<RewardConfig>({
    poolAmount: "", tokenAddress: "", tokenSymbol: "", tokenDecimals: 18,
    tokenLogoUrl: "", totalWinners: 3, distributionType: "equal", customTiers: {},
    claimWindowDuration: 48 * 3600,
  });
  const [tokenPrice, setTokenPrice] = useState<number | null>(null);
  const [isFetchingPrice, setIsFetchingPrice] = useState(false);
  const poolUsdValue = tokenPrice !== null && reward.poolAmount
    ? (parseFloat(reward.poolAmount) || 0) * tokenPrice : null;
  

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);

  // Derive active steps from mode; reset wizard position when mode changes
  const activeSteps = mode === "ai" ? WIZARD_STEPS_AI : WIZARD_STEPS_MANUAL;
  const lastStepIdx = activeSteps.length - 1;

  React.useEffect(() => {
    if (!userWalletAddress) return;
    fetch(`${API_BASE_URL}/api/profile/${userWalletAddress}`)
      .then(r => r.json()).then(d => { if (d.username) setCreatorUsername(d.username); }).catch(() => {});
  }, [userWalletAddress]);

  React.useEffect(() => {
    if (availableTokens.length > 0 && !reward.tokenAddress) {
      const t = availableTokens[0];
      setReward(prev => ({ ...prev, tokenAddress: t.address, tokenSymbol: t.symbol, tokenDecimals: t.decimals, tokenLogoUrl: t.logoUrl }));
    }
  }, [chainId]);

  React.useEffect(() => {
    if (!reward.tokenSymbol) return;
    const geckoId = COINGECKO_IDS[reward.tokenSymbol];
    if (!geckoId) { setTokenPrice(null); return; }
    setIsFetchingPrice(true);
    fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${geckoId}&vs_currencies=usd`)
      .then(r => r.json()).then(d => setTokenPrice(d[geckoId]?.usd ?? null))
      .catch(() => setTokenPrice(null)).finally(() => setIsFetchingPrice(false));
  }, [reward.tokenSymbol]);

  const setR = (updates: Partial<RewardConfig>) => setReward(prev => ({ ...prev, ...updates }));

  const updateQuestion = useCallback((idx: number, updates: Partial<QuizQuestion>) => {
    setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, ...updates } : q));
  }, []);
  const updateOption = (qIdx: number, optId: string, text: string) => {
    setQuestions(prev => prev.map((q, i) => i === qIdx
      ? { ...q, options: q.options.map(o => o.id === optId ? { ...o, text } : o) } : q));
  };
  const addQuestion = () => {
    setQuestions(prev => [...prev, blankQuestion()]);
    setActiveQIdx(questions.length);
    toast.success(`Question ${questions.length + 1} added! 🎯`);
  };
  const removeQuestion = (idx: number) => {
    if (questions.length === 1) { toast.error("Need at least 1 question!"); return; }
    setQuestions(prev => prev.filter((_, i) => i !== idx));
    setActiveQIdx(prev => Math.min(prev, questions.length - 2));
  };
  const moveQuestion = (idx: number, dir: "up" | "down") => {
    const next = dir === "up" ? idx - 1 : idx + 1;
    if (next < 0 || next >= questions.length) return;
    setQuestions(prev => { const arr = [...prev]; [arr[idx], arr[next]] = [arr[next], arr[idx]]; return arr; });
    setActiveQIdx(next);
  };
  const activeQ = questions[activeQIdx] ?? questions[0];

  const getQuizRewardConfig = (): QuizRewardConfig => {
    const selectedToken = availableTokens.find(t => t.address === reward.tokenAddress);
    return {
      name: title.trim() || "Quiz Reward",
      tokenAddress: reward.tokenAddress,
      tokenDecimals: reward.tokenDecimals,
      isNativeToken: selectedToken?.isNative ?? false,
      poolAmount: reward.poolAmount,
      claimWindowDuration: reward.claimWindowDuration,
    };
  };

  const buildPayload = () => ({
    title, description, questions, timePerQuestion: 30, maxParticipants,
    startTime: startTime || null, creatorAddress: userWalletAddress,
    creatorUsername, coverImageUrl: coverImageUrl || null, chainId,
    reward: {
      poolAmount: parseFloat(reward.poolAmount) || 0,
      tokenAddress: reward.tokenAddress, tokenSymbol: reward.tokenSymbol,
      tokenDecimals: reward.tokenDecimals, tokenLogoUrl: reward.tokenLogoUrl,
      chainId, totalWinners: reward.totalWinners,
      distributionType: reward.distributionType,
      distribution: calcDistribution(reward),
      poolUsdValue: poolUsdValue ?? undefined,
      claimWindowDuration: reward.claimWindowDuration,
    },
  });

  const validateQuiz = () => {
    if (!title.trim()) return "Quiz title is required";
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question.trim()) return `Question ${i + 1} has no text`;
      if (q.options.some(o => !o.text.trim())) return `Question ${i + 1} has empty options`;
    }
    if (!reward.poolAmount || parseFloat(reward.poolAmount) <= 0) return "Enter a valid reward pool amount";
    if (!reward.tokenAddress) return "Select a reward token";
    if (reward.totalWinners < 1) return "Must have at least 1 winner";
    if (reward.distributionType === "custom") {
      const total = customTierTotal(reward);
      if (Math.abs(total - 100) > 0.5) return `Custom tiers must add up to 100% (currently ${total.toFixed(1)}%)`;
    }
    return null;
  };

  const handleGenerateAI = async () => {
    if (!aiTopic.trim()) { toast.error("Enter a topic!"); return; }
    if (!userWalletAddress) { toast.error("Connect your wallet"); return; }
    if (!isSupportedNetwork) { toast.error("Unsupported network. Switch chains."); return; }
    
    setIsGenerating(true);
    setDeployStep("deploying");
    setDeployError("");
    
    // 🔔 1. Start the loading toast
    let toastId = toast.loading("⛓️ Deploying QuizReward contract...");
    
    try {
      const privyProvider = await wallets[0]?.getEthereumProvider();
      const ethersProvider = new BrowserProvider(privyProvider);
      
      const { contractAddress, txHash: deployTxHash } = await deployQuizReward(ethersProvider, chainId, getQuizRewardConfig());
      setRewardContractAddress(contractAddress);
      
      // 🔔 2. Update toast for the AI generation phase (which takes the longest)
      toast.loading("🤖 Contract deployed! AI is generating your questions...", { id: toastId });
      setDeployStep("saving");
      
      const res = await fetch(`${API_BASE_URL}/api/quiz/generate-ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: aiTopic, numQuestions: aiNumQ, difficulty: aiDifficulty,
          timePerQuestion: aiTimePerQ, creatorAddress: userWalletAddress,
          creatorUsername, coverImageUrl: coverImageUrl || null,
          title: title || undefined, chainId,
          faucetAddress: contractAddress, // 🛠️ Crucial fix from earlier
          reward: { ...buildPayload().reward, contractAddress, deployTxHash, isOnChain: true, isFunded: false },
        }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        setDeployStep("done"); 
        setCreatedCode(data.code);
        
        // 🔔 3. Final success update!
        toast.success(`✨ AI Quiz created! Code: ${data.code}`, { id: toastId });
        
        setTimeout(() => router.push(`/quiz/${data.code}`), 1500);
      } else {
        throw new Error(data.detail || "Generation failed");
      }
     } catch (err: any) {
      setDeployStep("error");
      const msg = parseOnchainError(err);
      setDeployError(msg); 
      
      // 🔔 4. Update toast to show error
      toast.error(`❌ Failed: ${msg}`, { id: toastId });
    } finally { 
      setIsGenerating(false); 
    }
  };

  const handleSubmit = async () => {
    const err = validateQuiz();
    if (err) { toast.error(err); return; }
    if (!userWalletAddress) { toast.error("Connect your wallet"); return; }
    if (isUploadingCover) { toast.error("Wait for image upload"); return; }
    if (!isSupportedNetwork) { toast.error("Switch to a supported network"); return; }
    
    setIsSubmitting(true);
    setDeployStep("deploying");
    setDeployError("");
    
    // 🔔 1. Start the loading toast
    let toastId = toast.loading("⛓️ Deploying QuizReward contract...");
    
    try {
      const privyProvider = await wallets[0]?.getEthereumProvider();
      const ethersProvider = new BrowserProvider(privyProvider);
      
      const { contractAddress, txHash: deployTxHash } = await deployQuizReward(ethersProvider, chainId, getQuizRewardConfig());
      setRewardContractAddress(contractAddress);
      
      // 🔔 2. Update toast when contract deploys
      toast.loading("💾 Contract deployed! Saving quiz data to server...", { id: toastId });
      setDeployStep("saving");
      
      const payload = {
        ...buildPayload(),
        faucetAddress: contractAddress, // 🛠️ Crucial fix from earlier
        reward: { ...buildPayload().reward, contractAddress, deployTxHash, isOnChain: true, isFunded: false },
      };
      
      const res = await fetch(`${API_BASE_URL}/api/quiz/create`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      const data = await res.json();
      
      if (data.success) {
        setDeployStep("done"); 
        setCreatedCode(data.code);
        
        // 🔔 3. Final success update!
        toast.success(`🎉 Quiz created successfully! Code: ${data.code}`, { id: toastId });
        
        setTimeout(() => router.push(`/quiz/${data.code}`), 1500);
      } else {
        throw new Error(data.detail || "Create failed");
      }
    } catch (err: any) {
      setDeployStep("error");
      const msg = parseOnchainError(err);
      setDeployError(msg); 
      
      // 🔔 4. Update toast to show error
      toast.error(`❌ Failed: ${msg}`, { id: toastId });
    } finally { 
      setIsSubmitting(false); 
    }
  };

  const completedQuestions = questions.filter(q => q.question.trim() && q.options.every(o => o.text.trim())).length;

  // ── Success screen ──
  if (createdCode) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <Header pageTitle="Quiz Created!" />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-sm space-y-4 text-center">
            <div className="text-8xl animate-bounce">🎉</div>
            <div className="bg-card rounded-3xl border-2 border-primary/20 p-8 shadow-2xl space-y-5">
              <div>
                <h2 className="text-2xl font-black text-foreground">Quiz is Live!</h2>
                <p className="text-muted-foreground text-sm mt-1">
                  🏆 {reward.poolAmount} {reward.tokenSymbol} for top {reward.totalWinners} winners
                </p>
              </div>
              {coverImageUrl && (
                <div className="rounded-2xl overflow-hidden h-24 border-2 border-border">
                  <img src={coverImageUrl} alt="Cover" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="bg-primary/5 rounded-2xl p-6 border-2 border-primary/20">
                <p className="text-xs font-bold text-primary uppercase tracking-widest mb-2">Quiz Code</p>
                <div className="text-5xl font-black tracking-[0.15em] text-primary">{createdCode}</div>
              </div>
              <Button className="w-full h-12 rounded-2xl font-bold text-base"
                onClick={() => { navigator.clipboard.writeText(createdCode); toast.success("Copied! 📋"); }}>
                <Copy className="mr-2 h-4 w-4" /> Copy Code
              </Button>
              <Button variant="outline" className="w-full h-11 rounded-2xl border-2 font-bold"
                onClick={() => router.push(`/quiz/${createdCode}`)}>
                Open Lobby <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 0: Details ──
  const renderStepDetails = () => (
    <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="text-center space-y-2 pb-2">
        <div className="text-5xl">🎯</div>
        <h2 className="text-xl font-black text-foreground">Name your quiz</h2>
        <p className="text-sm text-muted-foreground">Give it a killer title that makes people want to play</p>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2 p-1 bg-muted rounded-2xl">
        {([
          { id: "build", label: "Build Manually", icon: "✏️" },
          { id: "ai", label: "AI Generate", icon: "✨" },
        ] as const).map(m => (
          <button key={m.id} onClick={() => { setMode(m.id); setWizardStep(0); }}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all",
              mode === m.id
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}>
            <span>{m.icon}</span> {m.label}
          </button>
        ))}
      </div>

      {/* Title */}
      <div className="space-y-2">
        <Label className="text-sm font-bold text-foreground">
          Quiz Title <span className="text-destructive">*</span>
        </Label>
        <div className="relative">
          <Input value={title} onChange={e => setTitle(e.target.value)}
            placeholder={mode === "ai" ? "Leave blank — AI will create one" : "e.g. Web3 Trivia Challenge 🔥"}
            className="h-12 text-base rounded-xl border-2 pr-10" />
          {title && <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-emerald-500" />}
        </div>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label className="text-sm font-bold text-foreground">Description</Label>
        <Textarea value={description} onChange={e => setDescription(e.target.value)}
          placeholder="What's this quiz about? Get people hyped! 🎲"
          className="resize-none h-20 rounded-xl border-2" />
      </div>

      {/* Cover */}
      <div className="space-y-2">
        <Label className="text-sm font-bold text-foreground">Cover Image</Label>
        <ImageUploader value={coverImageUrl} onChange={setCoverImageUrl}
          isUploading={isUploadingCover} setIsUploading={setIsUploadingCover} />
      </div>

      {creatorUsername && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
          <span className="text-xs text-emerald-700 dark:text-emerald-300">
            Creating as <span className="font-black">@{creatorUsername}</span>
          </span>
        </div>
      )}

      {/* Network status */}
      {chainId > 0 ? (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/50 border border-border">
          <div className={cn("w-2 h-2 rounded-full shrink-0", isSupportedNetwork ? "bg-emerald-500" : "bg-amber-500")} />
          <span className="text-xs text-muted-foreground font-medium">
            {isSupportedNetwork ? `Connected to ${chainName} ✓` : `${chainName} — not supported yet`}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
          <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
          <span className="text-xs text-amber-700 dark:text-amber-300">Connect your wallet to continue</span>
        </div>
      )}

      {/* AI-specific fields */}
      {mode === "ai" && (
        <div className="space-y-4 border-t border-dashed border-border pt-5">
          <div className="flex items-center gap-2">
            <span className="text-xl">✨</span>
            <h3 className="font-black text-foreground text-sm">AI Settings</h3>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-bold text-foreground">Topic <span className="text-destructive">*</span></Label>
            <Textarea value={aiTopic} onChange={e => setAiTopic(e.target.value)}
              placeholder="e.g. 'Ethereum & DeFi basics', 'World geography', 'Crypto history'..."
              className="resize-none h-20 rounded-xl border-2" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Questions</Label>
              <div className="flex flex-wrap gap-1.5">
                {[5, 10, 15, 20, 30, 40, 60].map(n => (
                  <button key={n} onClick={() => setAiNumQ(n)}
                    className={cn("px-3 py-1.5 rounded-xl text-xs font-black border-2 transition-all",
                      aiNumQ === n ? "bg-primary border-primary text-primary-foreground shadow-sm" : "bg-card border-border text-muted-foreground hover:border-primary/50")}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Difficulty</Label>
              <div className="flex flex-wrap gap-1.5">
                {([
                  { d: "easy", emoji: "😊", color: "bg-emerald-500 border-emerald-500 text-white" },
                  { d: "medium", emoji: "🤔", color: "bg-yellow-500 border-yellow-500 text-black" },
                  { d: "hard", emoji: "🔥", color: "bg-red-500 border-red-500 text-white" },
                ] as const).map(({ d, emoji, color }) => (
                  <button key={d} onClick={() => setAiDifficulty(d)}
                    className={cn("px-2.5 py-1.5 rounded-xl text-xs font-black border-2 transition-all flex items-center gap-1",
                      aiDifficulty === d ? color + " shadow-sm" : "bg-card border-border text-muted-foreground hover:border-primary/40")}>
                    {emoji} {d}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Seconds per question</Label>
            <div className="flex flex-wrap gap-1.5">
              {[3, 5, 7, 10, 15, 20, 30].map(t => (
                <button key={t} onClick={() => setAiTimePerQ(t)}
                  className={cn("px-3 py-1.5 rounded-xl text-xs font-black border-2 transition-all",
                    aiTimePerQ === t ? "bg-primary border-primary text-primary-foreground shadow-sm" : "bg-card border-border text-muted-foreground hover:border-primary/50")}>
                  {t}s
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // AFTER — replace the entire renderStepQuestions with:
  const renderStepQuestions = () => {
    const isComplete = (q: QuizQuestion) =>
      q.question.trim() !== "" && q.options.every(o => o.text.trim() !== "");

    return (
      <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
        {/* Header row */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-foreground">Build the challenge</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              <span className={cn("font-bold", completedQuestions === questions.length ? "text-emerald-500" : "text-primary")}>
                {completedQuestions}
              </span>
              /{questions.length} questions ready
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* PDF import */}
            <input
              type="file"
              accept="application/pdf,.pdf"
              ref={pdfInputRef}
              className="hidden"
              onChange={handlePdfFileSelected}
            />
            <label
              className={cn(
                "h-9 px-3 rounded-xl border-2 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer",
                isPdfUploading
                  ? "bg-muted border-border text-muted-foreground cursor-wait pointer-events-none"
                  : "bg-card border-border text-muted-foreground hover:border-primary/50 hover:text-primary"
              )}
            >
              <input
                type="file"
                accept="application/pdf,.pdf"
                ref={pdfInputRef}
                className="hidden"
                onChange={handlePdfFileSelected}
                disabled={isPdfUploading}
              />
              {isPdfUploading
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading…</>
                : <><FileText className="h-3.5 w-3.5" /> PDF</>}
            </label>
            <button
              onClick={addQuestion}
              className="h-9 px-3 rounded-xl border-2 border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary text-primary font-bold text-xs flex items-center gap-1.5 transition-all"
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          </div>
        </div>

        {/* Question pill nav */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {questions.map((q, idx) => {
            const done = isComplete(q);
            const active = idx === activeQIdx;
            return (
              <button
                key={q.id}
                onClick={() => setActiveQIdx(idx)}
                className={cn(
                  "shrink-0 flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-bold border-2 transition-all",
                  active
                    ? "bg-primary border-primary text-primary-foreground shadow-sm"
                    : done
                    ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400"
                    : "bg-card border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                )}
              >
                {done && !active
                  ? <CheckCircle2 className="h-3 w-3" />
                  : <span className="w-3.5 h-3.5 rounded-full bg-current/20 flex items-center justify-center text-[9px] leading-none">{idx + 1}</span>}
                <span className="max-w-[80px] truncate">
                  {q.question.trim() ? q.question.trim().slice(0, 18) + (q.question.length > 18 ? "…" : "") : `Q${idx + 1}`}
                </span>
              </button>
            );
          })}
        </div>

        {/* Editor card */}
        <div className="rounded-2xl border-2 border-primary/20 bg-primary/[0.02] overflow-hidden">
          {/* Card header */}
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-card">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-xl bg-primary text-primary-foreground text-xs font-black flex items-center justify-center shrink-0">
                {activeQIdx + 1}
              </div>
              <span className="text-xs font-bold text-muted-foreground">
                Question {activeQIdx + 1} of {questions.length}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => moveQuestion(activeQIdx, "up")}
                disabled={activeQIdx === 0}
                className="w-7 h-7 rounded-lg border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/50 disabled:opacity-30 transition-colors"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => moveQuestion(activeQIdx, "down")}
                disabled={activeQIdx === questions.length - 1}
                className="w-7 h-7 rounded-lg border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/50 disabled:opacity-30 transition-colors"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => removeQuestion(activeQIdx)}
                className="w-7 h-7 rounded-lg border border-destructive/30 bg-destructive/5 flex items-center justify-center text-destructive hover:bg-destructive/15 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Editor body */}
          <div className="p-4 space-y-4">
            {/* Question text */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Question <span className="text-destructive normal-case">*</span>
              </Label>
              <Textarea
                value={activeQ.question}
                onChange={e => updateQuestion(activeQIdx, { question: e.target.value })}
                placeholder="Ask something interesting… what will stump your players? 🤔"
                className="resize-none h-[88px] text-sm rounded-xl border-2 focus-visible:border-primary bg-card"
              />
            </div>

            {/* Time limit */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="h-3 w-3" /> Time limit
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {[3, 5, 7, 10, 15, 20, 30].map(t => (
                  <button
                    key={t}
                    onClick={() => updateQuestion(activeQIdx, { timeLimit: t })}
                    className={cn(
                      "h-8 px-3 rounded-xl text-xs font-bold border-2 transition-all",
                      activeQ.timeLimit === t
                        ? "bg-foreground border-foreground text-background shadow-sm"
                        : "bg-card border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                    )}
                  >
                    {t}s
                  </button>
                ))}
              </div>
            </div>

            {/* Answer options */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Answers <span className="text-destructive normal-case">*</span>
              </Label>
              <p className="text-[11px] text-muted-foreground -mt-0.5">
                Click the colored tile to mark the correct answer ✓
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {activeQ.options.map(opt => (
                  <AnswerOptionButton
                    key={opt.id}
                    opt={opt}
                    isCorrect={activeQ.correctId === opt.id}
                    text={opt.text}
                    onChange={text => updateOption(activeQIdx, opt.id, text)}
                    onMarkCorrect={() => updateQuestion(activeQIdx, { correctId: opt.id as any })}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Prev / Next question nav */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => setActiveQIdx(i => Math.max(0, i - 1))}
            disabled={activeQIdx === 0}
            className="flex items-center gap-1.5 h-9 px-4 rounded-xl border-2 border-border bg-card text-xs font-bold text-muted-foreground hover:text-foreground hover:border-primary/50 disabled:opacity-30 transition-all"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Prev
          </button>
          <span className="text-xs text-muted-foreground font-medium">
            {activeQIdx + 1} / {questions.length}
          </span>
          {activeQIdx < questions.length - 1 ? (
            <button
              onClick={() => setActiveQIdx(i => Math.min(questions.length - 1, i + 1))}
              className="flex items-center gap-1.5 h-9 px-4 rounded-xl border-2 border-border bg-card text-xs font-bold text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all"
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              onClick={addQuestion}
              className="flex items-center gap-1.5 h-9 px-4 rounded-xl border-2 border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary text-primary font-bold text-xs transition-all"
            >
              <Plus className="h-3.5 w-3.5" /> New Q
            </button>
          )}
        </div>
      </div>
    );
  };

  // ── Step 2: Rewards ──
  const renderStepRewards = () => (
    <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300 max-w-xl mx-auto">
      <div className="text-center space-y-2 pb-2">
        <div className="text-5xl">💰</div>
        <h2 className="text-xl font-black text-foreground">Set the prize pool</h2>
        <p className="text-sm text-muted-foreground">The bigger the pot, the more players you attract</p>
      </div>

      {/* Chain badge */}
      {chainId > 0 ? (
        <div className="flex items-center justify-center gap-2 px-4 py-2 rounded-2xl bg-muted/50 border border-border">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-xs font-bold text-foreground">{chainName}</span>
          <Badge variant="outline" className="text-[10px] h-4 px-1.5">Chain {chainId}</Badge>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
          <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
          <span className="text-xs text-amber-700 dark:text-amber-300 font-medium">Connect wallet to select a token</span>
        </div>
      )}

      {/* Token picker */}
      {availableTokens.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs font-black text-muted-foreground uppercase tracking-wider">Reward Token</Label>
          <div className="grid grid-cols-2 gap-2">
            {availableTokens.map(token => (
              <button key={token.address}
                onClick={() => setReward(prev => ({ ...prev, tokenAddress: token.address, tokenSymbol: token.symbol, tokenDecimals: token.decimals, tokenLogoUrl: token.logoUrl }))}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2.5 rounded-2xl border-2 text-left transition-all",
                  reward.tokenAddress === token.address
                    ? "border-yellow-500 bg-yellow-50 dark:bg-yellow-500/10 shadow-sm"
                    : "border-border hover:border-primary/40 bg-card"
                )}>
                <img src={token.logoUrl} alt={token.symbol}
                  className="w-8 h-8 rounded-full object-cover shrink-0 bg-muted"
                  onError={e => { (e.target as HTMLImageElement).src = "/fallback-token.png"; }} />
                <div className="min-w-0">
                  <div className="text-xs font-black text-foreground">{token.symbol}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{token.name}</div>
                </div>
                {reward.tokenAddress === token.address && <Check className="h-4 w-4 text-yellow-600 ml-auto shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Pool amount */}
      <div className="space-y-2">
        <Label className="text-xs font-black text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Coins className="h-3.5 w-3.5" /> Pool Amount
        </Label>
        <div className="relative">
          <Input type="number" min="0" step="any" value={reward.poolAmount}
            onChange={e => setR({ poolAmount: e.target.value })} placeholder="0.00"
            className={cn("h-12 text-lg font-mono rounded-xl pr-24 border-2")} />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {isFetchingPrice && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            {reward.tokenLogoUrl && <img src={reward.tokenLogoUrl} alt="" className="w-5 h-5 rounded-full" />}
            <span className="text-xs font-black text-muted-foreground">{reward.tokenSymbol}</span>
          </div>
        </div>
        {poolUsdValue !== null && (
          <div className={cn("flex items-center gap-2 text-xs rounded-xl px-3 py-2",
            "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400")}>
            <span className="font-black">≈ ${poolUsdValue.toFixed(2)} USD</span>
          </div>
        )}
      </div>

      {/* Winners */}
      <div className="space-y-3">
        <Label className="text-xs font-black text-muted-foreground uppercase tracking-wider">Winners</Label>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setR({ totalWinners: Math.max(1, reward.totalWinners - 1) })}
            className="w-10 h-10 rounded-xl border-2 border-border bg-card text-foreground font-black text-lg hover:border-primary transition-all">−</button>
          <div className="flex-1 text-center">
            <span className="text-4xl font-black text-primary">{reward.totalWinners}</span>
            <p className="text-xs text-muted-foreground mt-0.5">winners</p>
          </div>
          <button
            onClick={() => setR({ totalWinners: Math.min(10, reward.totalWinners + 1) })}
            className="w-10 h-10 rounded-xl border-2 border-border bg-card text-foreground font-black text-lg hover:border-primary transition-all">+</button>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {[1, 2, 3, 5, 10].map(n => (
            <button key={n} onClick={() => setR({ totalWinners: n })}
              className={cn("px-3 py-1.5 rounded-xl text-xs font-black border-2 transition-all",
                reward.totalWinners === n ? "bg-primary border-primary text-primary-foreground" : "bg-card border-border text-muted-foreground hover:border-primary/50")}>
              Top {n}
            </button>
          ))}
        </div>
      </div>

      {/* Distribution */}
      <div className="space-y-2">
        <Label className="text-xs font-black text-muted-foreground uppercase tracking-wider">Distribution</Label>
        <div className="grid grid-cols-2 gap-2">
          {([
            { type: "equal" as const, emoji: "⚖️", label: "Equal Split", desc: "Same prize for all" },
            { type: "custom" as const, emoji: "🎯", label: "Custom", desc: "Set each % manually" },
          ]).map(({ type, emoji, label, desc }) => (
            <button key={type} onClick={() => setR({ distributionType: type })}
              className={cn("flex flex-col items-center gap-1.5 p-4 rounded-2xl border-2 text-center transition-all",
                reward.distributionType === type
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:border-primary/40")}>
              <span className="text-2xl">{emoji}</span>
              <span className="text-xs font-black text-foreground">{label}</span>
              <span className="text-[10px] text-muted-foreground">{desc}</span>
            </button>
          ))}
        </div>
      </div>

      {reward.distributionType === "custom" && (
        <div className="space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">% per rank</span>
            {(() => {
              const total = customTierTotal(reward);
              return (
                <span className={cn("text-xs font-black tabular-nums",
                  total > 100 ? "text-destructive" : total < 100 ? "text-amber-500" : "text-emerald-500")}>
                  {total.toFixed(1)}% {total > 100 ? "⚠ over!" : total < 100 ? `(${(100 - total).toFixed(1)}% left)` : "✓ perfect"}
                </span>
              );
            })()}
          </div>
          <div className="space-y-2">
            {Array.from({ length: reward.totalWinners }, (_, i) => {
              const rank = i + 1;
              const podiumEmoji = ["🥇", "🥈", "🥉"][i] ?? "🏅";
              return (
                <div key={rank} className="flex items-center gap-3">
                  <span className="text-lg shrink-0">{podiumEmoji}</span>
                  <span className="text-xs font-bold text-muted-foreground w-8">#{rank}</span>
                  <div className="flex-1 relative">
                    <Input type="number" min="0" max="100" step="0.1"
                      value={reward.customTiers[rank] ?? ""}
                      onChange={e => setReward(prev => ({ ...prev, customTiers: { ...prev.customTiers, [rank]: e.target.value } }))}
                      placeholder={`${(100 / reward.totalWinners).toFixed(1)}`}
                      className="h-9 pr-7 font-mono text-sm rounded-xl border-2" />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                  </div>
                  <span className="text-xs text-muted-foreground w-20 text-right tabular-nums text-[11px]">
                    {reward.poolAmount ? `${((parseFloat(reward.poolAmount) || 0) * (parseFloat(reward.customTiers[rank] ?? "0") || 0) / 100).toFixed(3)} ${reward.tokenSymbol}` : "—"}
                  </span>
                </div>
              );
            })}
          </div>
          <button
            onClick={() => {
              const equal = (100 / reward.totalWinners).toFixed(1);
              const reset: Record<number, string> = {};
              for (let i = 1; i <= reward.totalWinners; i++) reset[i] = equal;
              setReward(prev => ({ ...prev, customTiers: reset }));
            }}
            className="w-full h-9 text-xs font-bold text-muted-foreground border-2 border-dashed border-border rounded-xl hover:border-primary/50 transition-colors">
            Reset to equal
          </button>
        </div>
      )}

      {/* Claim window */}
      <div className="space-y-2 border-t border-border pt-5">
        <Label className="text-xs font-black text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Timer className="h-3.5 w-3.5" /> Claim Window
        </Label>
        <div className="flex gap-1.5 flex-wrap">
          {CLAIM_WINDOW_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => setR({ claimWindowDuration: opt.value })}
              className={cn("px-3 py-1.5 rounded-xl text-xs font-black border-2 transition-all",
                reward.claimWindowDuration === opt.value ? "bg-primary border-primary text-primary-foreground" : "bg-card border-border text-muted-foreground hover:border-primary/50")}>
              {opt.label}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground leading-tight">
          How long winners have to claim on-chain after the quiz ends.
        </p>
      </div>

      <RewardPreview config={reward} />
    </div>
  );

  // ── Step 3: Launch ──
  const renderStepLaunch = () => (
    <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300 max-w-xl mx-auto">
      <div className="text-center space-y-2 pb-2">
        <div className="text-5xl">🚀</div>
        <h2 className="text-xl font-black text-foreground">Ready to launch?</h2>
        <p className="text-sm text-muted-foreground">Review your quiz and hit the button</p>
      </div>

      {/* Summary card */}
      <div className="rounded-3xl border-2 border-border bg-card overflow-hidden">
        {coverImageUrl && (
          <div className="h-32 relative">
            <img src={coverImageUrl} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
            <div className="absolute bottom-3 left-4">
              <p className="text-white font-black text-lg leading-tight drop-shadow">{title || "Untitled Quiz"}</p>
            </div>
          </div>
        )}
        <div className="p-5 space-y-4">
          {!coverImageUrl && (
            <h3 className="text-lg font-black text-foreground">{title || "Untitled Quiz"}</h3>
          )}

          <div className="grid grid-cols-2 gap-3">
            {[
              { emoji: "🧠", label: "Questions", value: `${completedQuestions}/${questions.length}`, ok: completedQuestions === questions.length },
              { emoji: "💰", label: "Prize Pool", value: `${reward.poolAmount || "0"} ${reward.tokenSymbol}`, ok: !!reward.poolAmount && parseFloat(reward.poolAmount) > 0  },
              { emoji: "🏆", label: "Winners", value: `Top ${reward.totalWinners}`, ok: reward.totalWinners > 0 },
              { emoji: "⏳", label: "Claim", value: CLAIM_WINDOW_OPTIONS.find(o => o.value === reward.claimWindowDuration)?.label ?? "—", ok: true },
            ].map(item => (
              <div key={item.label}
                className={cn("flex items-center gap-2.5 rounded-2xl px-3 py-2.5 border-2",
                  item.ok ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800" : "bg-destructive/10 border-destructive/30")}>
                <span className="text-xl shrink-0">{item.emoji}</span>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground">{item.label}</p>
                  <p className={cn("text-xs font-black", item.ok ? "text-foreground" : "text-destructive")}>{item.value}</p>
                </div>
                {item.ok ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 ml-auto shrink-0" />
                ) : (
                  <AlertCircle className="h-3.5 w-3.5 text-destructive ml-auto shrink-0" />
                )}
              </div>
            ))}
          </div>

          {/* Optional schedule */}
          <div className="space-y-2 border-t border-border pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" /> Max Players</Label>
                <Input type="number" min={0} value={maxParticipants === 0 ? "" : maxParticipants}
                  onChange={e => setMaxParticipants(Number(e.target.value) || 0)} placeholder="Unlimited"
                  className="h-9 text-xs rounded-xl border-2" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Schedule</Label>
                <Input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)}
                  className="h-9 text-xs rounded-xl border-2" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <DeployProgress step={deployStep} contractAddress={rewardContractAddress} error={deployError} />

      {/* Launch button */}
      <button
        onClick={mode === "ai" ? handleGenerateAI : handleSubmit}
        disabled={isSubmitting || isGenerating || isUploadingCover || !isSupportedNetwork}
        className={cn(
          "w-full h-16 rounded-2xl font-black text-lg transition-all duration-200 relative overflow-hidden",
          "disabled:opacity-60 disabled:cursor-not-allowed",
          isSupportedNetwork
            ? "bg-primary text-primary-foreground hover:opacity-90 shadow-lg hover:scale-[1.01] active:scale-[0.99]"
            : "bg-muted text-muted-foreground"
        )}
      >
        <span className="relative z-10 flex items-center justify-center gap-2">
          {isSubmitting || isGenerating ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              {deployStep === "deploying" ? "Deploying contract…" : mode === "ai" ? "Generating questions…" : "Saving quiz…"}
            </>
          ) : isUploadingCover ? (
            <><Loader2 className="h-5 w-5 animate-spin" /> Uploading image…</>
          ) : !isSupportedNetwork ? (
            "⚠️ Switch to a Supported Network"
          ) : mode === "ai" ? (
            <><Sparkles className="h-5 w-5" /> Generate & Launch Quiz</>
          ) : (
            <><Rocket className="h-5 w-5" /> Launch Quiz 🚀</>
          )}
        </span>
      </button>

      <p className="text-center text-xs text-muted-foreground">
        🔒 Rewards are locked in a smart contract. Fund it in the lobby after launching.
      </p>
    </div>
  );

  // stepContent maps wizard index → renderer, varies by mode
  const stepContent = mode === "ai"
    ? [renderStepDetails, renderStepRewards, renderStepLaunch]
    : [renderStepDetails, renderStepQuestions, renderStepRewards, renderStepLaunch];

  const canAdvance = () => {
    const stepId = activeSteps[wizardStep]?.id;
    if (stepId === "details") {
      if (mode === "ai") return !!userWalletAddress && isSupportedNetwork;
      return !!title.trim() && !!userWalletAddress && isSupportedNetwork;
    }
    if (stepId === "questions") return completedQuestions > 0;
    if (stepId === "rewards") return !!reward.poolAmount && parseFloat(reward.poolAmount) > 0 && !!reward.tokenAddress;
    return true;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header pageTitle="Create Quiz" />

      {/* Subtle background decoration */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-primary/5 blur-3xl opacity-60" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-primary/5 blur-3xl opacity-60" />
      </div>

      <div className="relative z-10 flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 pb-24 pt-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()}
            className="w-9 h-9 rounded-xl border-2 border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-lg font-black text-foreground">Create a Quiz</h1>
            <p className="text-xs text-muted-foreground">Step {wizardStep + 1} of {activeSteps.length} — {activeSteps[wizardStep]?.desc}</p>
          </div>
        </div>

        {/* Step progress */}
        <WizardProgress currentStep={wizardStep} setStep={setWizardStep} steps={activeSteps} />

        {/* Step content */}
        <div className="bg-card rounded-3xl border-2 border-border p-5 sm:p-7 shadow-sm relative overflow-hidden">
          <FloatyEmojis />
          <div className="relative z-10">
            {stepContent[wizardStep]?.()}
          </div>
        </div>

        {/* Nav buttons */}
        {wizardStep < lastStepIdx && (
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => setWizardStep(s => Math.max(0, s - 1))}
              disabled={wizardStep === 0}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl border-2 border-border bg-card text-muted-foreground font-bold text-sm hover:border-primary/50 hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-all">
              <ChevronLeft className="h-4 w-4" /> Back
            </button>

            <div className="flex items-center gap-1.5">
              {activeSteps.map((_, i) => (
                <div key={i}
                  className={cn("rounded-full transition-all duration-300",
                    i === wizardStep ? "w-6 h-2 bg-primary" : i < wizardStep ? "w-2 h-2 bg-primary/40" : "w-2 h-2 bg-border")} />
              ))}
            </div>

            <button
              onClick={() => setWizardStep(s => Math.min(lastStepIdx, s + 1))}
              disabled={!canAdvance()}
              className={cn(
                "flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm transition-all",
                canAdvance()
                  ? "bg-primary text-primary-foreground hover:opacity-90 shadow-sm hover:scale-[1.02]"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}>
              {wizardStep === lastStepIdx - 1 ? "Review" : "Next"} <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

{/* ── PDF Question Count Modal ── */}
{showPdfModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.07] rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
          <FileText className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-black text-foreground">Generate from PDF</h3>
          <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[180px]">
            {pendingPdfFile?.name}
          </p>
        </div>
      </div>

      {/* Count picker */}
      <div className="space-y-3">
        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          How many questions?
        </label>
        <div className="flex flex-wrap gap-2">
          {[3, 5, 8, 10, 15, 20].map(n => (
            <button
              key={n}
              onClick={() => setPdfNumQuestions(n)}
              className={cn(
                "h-9 w-12 rounded-xl text-sm font-black border-2 transition-all",
                pdfNumQuestions === n
                  ? "bg-primary border-primary text-primary-foreground shadow-sm scale-105"
                  : "bg-card border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
              )}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={() => setPdfNumQuestions(n => Math.max(1, n - 1))}
            className="w-9 h-9 rounded-xl border-2 border-border bg-card text-foreground font-black text-base hover:border-primary transition-all shrink-0"
          >−</button>
          <div className="flex-1 text-center">
            <span className="text-3xl font-black text-primary tabular-nums">{pdfNumQuestions}</span>
            <p className="text-[10px] text-muted-foreground">questions</p>
          </div>
          <button
            onClick={() => setPdfNumQuestions(n => Math.min(30, n + 1))}
            className="w-9 h-9 rounded-xl border-2 border-border bg-card text-foreground font-black text-base hover:border-primary transition-all shrink-0"
          >+</button>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Time per question picker */}
      <div className="space-y-3">
        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          Seconds per question?
        </label>
        <div className="flex flex-wrap gap-2">
          {[3, 5, 7, 10, 15, 20, 30].map(s => (
            <button
              key={s}
              onClick={() => setPdfSecondsPerQuestion(s)}
              className={cn(
                "h-9 w-12 rounded-xl text-sm font-black border-2 transition-all",
                pdfSecondsPerQuestion === s
                  ? "bg-primary border-primary text-primary-foreground shadow-sm scale-105"
                  : "bg-card border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
              )}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={() => setPdfSecondsPerQuestion(n => Math.max(5, n - 5))}
            className="w-9 h-9 rounded-xl border-2 border-border bg-card text-foreground font-black text-base hover:border-primary transition-all shrink-0"
          >−</button>
          <div className="flex-1 text-center">
            <span className="text-3xl font-black text-primary tabular-nums">{pdfSecondsPerQuestion}</span>
            <p className="text-[10px] text-muted-foreground">seconds</p>
          </div>
          <button
            onClick={() => setPdfSecondsPerQuestion(n => Math.min(120, n + 5))}
            className="w-9 h-9 rounded-xl border-2 border-border bg-card text-foreground font-black text-base hover:border-primary transition-all shrink-0"
          >+</button>
        </div>
        <p className="text-[11px] text-muted-foreground text-center">
          {pdfNumQuestions} questions × {pdfSecondsPerQuestion}s = ~{Math.round(pdfNumQuestions * pdfSecondsPerQuestion / 60)} min total
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        <Button
          variant="outline"
          className="flex-1 h-11 border-border text-muted-foreground hover:text-foreground bg-transparent"
          onClick={() => { setShowPdfModal(false); setPendingPdfFile(null); }}
        >
          Cancel
        </Button>
        <Button
          className="flex-1 h-11 font-bold bg-primary text-primary-foreground hover:opacity-90 border-0"
          onClick={handlePdfUpload}
        >
          <Sparkles className="mr-2 h-4 w-4" /> Generate
        </Button>
      </div>
    </div>
  </div>
)}
      </div>
    </div>
  );
}