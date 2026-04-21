"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/hooks/use-wallet";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Loader2, CheckCircle2, AlertCircle,
  ChevronRight, ChevronLeft, Rocket, Globe, Lock,
  Copy, ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Contract,
  parseUnits,
  keccak256,
  toUtf8Bytes,
  ZeroAddress,
} from "ethers";
import { QUIZ_HUB_ABI, ERC20_ABI } from "@/lib/abis";
// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE_URL = "https://faucetpay-backend.koyeb.app";

/**
 * Fill in the deployed QuizHub address for each chain.
 * These must match the QUIZ_HUB_CONTRACT env var on the backend.
 */
const QUIZ_HUB_ADDRESSES: Record<number, string> = {
  42220: process.env.NEXT_PUBLIC_QUIZ_HUB_CELO  ?? "0xceDC56a09ae64563D3b04cCde4dC2A2E0667Ce8B",

};


// ─────────────────────────────────────────────────────────────────────────────
// Token / chain data
// ─────────────────────────────────────────────────────────────────────────────

interface TokenConfig {
  address: string;
  symbol: string;
  decimals: number;
  logoUrl: string;
  isNative?: boolean; // true = native gas token (ETH) → NOT supported by QuizHub
}

const TOKENS_BY_CHAIN: Record<number, TokenConfig[]> = {
  42220: [
    // CELO is ERC-20 on its own chain — fully supported
    { address: "0x765DE816845861e75A25fCA122bb6898B8B1282a", symbol: "cUSD",  decimals: 18, logoUrl: "/cusd.png"   },
    { address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C", symbol: "USDC",  decimals: 6,  logoUrl: "/usdc.jpg"   },
    { address: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e", symbol: "USDT",  decimals: 6,  logoUrl: "/usdt.jpg"   },
  ],
  8453: [
    // ETH (zero address) is native — QuizHub.stake() is non-payable, skip it
    { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", symbol: "USDC",  decimals: 6,  logoUrl: "/usdc.jpg"   },
  ],
  1135: [
    { address: "0xac485391EB2d7D88253a7F1eF18C37f4242D1A24", symbol: "LSK",   decimals: 18, logoUrl: "/lsk.png"    },
  ],
};

const CHAIN_NAMES: Record<number, string> = {
  42220: "Celo",
  8453:  "Base",
  1135:  "Lisk",
};

// ─────────────────────────────────────────────────────────────────────────────
// On-chain helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Derives the bytes32 quizId the contract uses.
 * MUST match quiz_engine._get_quiz_id:
 *   Web3.keccak(text=code)  →  keccak256(toUtf8Bytes(code))
 */
function deriveQuizId(code: string): string {
  return keccak256(toUtf8Bytes(code));
}

// ─────────────────────────────────────────────────────────────────────────────
// Wizard steps
// ─────────────────────────────────────────────────────────────────────────────

const STEPS = [
  { id: "topic",  emoji: "🎯", label: "Topic",  desc: "What to quiz about" },
  { id: "stake",  emoji: "💰", label: "Stake",  desc: "Set the wager"       },
  { id: "launch", emoji: "🚀", label: "Launch", desc: "Go live"             },
];

function WizardProgress({
  current,
  setStep,
}: {
  current: number;
  setStep: (n: number) => void;
}) {
  return (
    <div className="relative flex items-center justify-between w-full max-w-xs mx-auto px-2 mb-8">
      <div className="absolute top-5 left-8 right-8 h-1 bg-border rounded-full z-0" />
      <div
        className="absolute top-5 left-8 h-1 rounded-full z-0 transition-all duration-500 bg-primary"
        style={{ width: `calc(${(current / (STEPS.length - 1)) * 100}%)` }}
      />
      {STEPS.map((step, idx) => {
        const done   = idx < current;
        const active = idx === current;
        return (
          <button
            key={step.id}
            onClick={() => idx < current && setStep(idx)}
            disabled={idx > current}
            className="relative z-10 flex flex-col items-center gap-1.5"
          >
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center text-lg border-[3px] transition-all duration-300 shadow-sm",
              done   ? "bg-primary border-primary text-primary-foreground scale-95"
                     : active
                     ? "bg-card border-primary text-primary scale-110 shadow-lg"
                     : "bg-card border-border text-muted-foreground"
            )}>
              {done ? "✓" : step.emoji}
            </div>
            <span className={cn(
              "text-[10px] font-bold hidden sm:block transition-colors",
              active ? "text-primary" : "text-muted-foreground/50"
            )}>
              {step.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Transaction status pill — shown while the on-chain flow runs
// ─────────────────────────────────────────────────────────────────────────────

type TxPhase =
  | "idle"
  | "backend"      // POST /api/challenge/create
  | "Creating"      // waiting for QuizHub.stake tx
  | "done";

function TxStatusPill({ phase }: { phase: TxPhase }) {
  const labels: Record<TxPhase, string> = {
    idle:      "",
    backend:   "🤖 Generating questions…",
    Creating:   "⛓️ Confirm Create transaction…",
    done:      "✅ Challenge live!",
  };
  if (phase === "idle") return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl bg-card border-2 border-primary/30 shadow-xl flex items-center gap-3 text-sm font-bold text-foreground whitespace-nowrap">
      {phase !== "done" && <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />}
      {labels[phase]}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function CreateChallengePage() {
  const router = useRouter();
  const { address: userWalletAddress, signer, chainId: walletChainId, ensureCorrectNetwork } = useWallet();

  // Use wallet's chain when available, else default to Celo
  const chainId = walletChainId ?? 42220;
  const availableTokens = TOKENS_BY_CHAIN[chainId] ?? [];

  const [wizardStep, setWizardStep]        = useState(0);
  const [txPhase, setTxPhase]              = useState<TxPhase>("idle");
  const [createdCode, setCreatedCode]      = useState<string | null>(null);

  // Step 0 — Topic
  const [topic, setTopic]                  = useState("");
  const [creatorUsername, setCreatorUsername] = useState("");
  const [isPublic, setIsPublic]            = useState(true);
  const [inviteWallet, setInviteWallet]    = useState("");
  const [questionCount, setQuestionCount] = useState(9);
  // Step 1 — Stake
  const [stakeAmount, setStakeAmount]      = useState("");
  const [tokenSymbol, setTokenSymbol]      = useState(availableTokens[0]?.symbol ?? "CELO");

  // Keep selected token in sync when chain changes
  useEffect(() => {
    const tokens = TOKENS_BY_CHAIN[chainId] ?? [];
    if (tokens.length > 0) setTokenSymbol(tokens[0].symbol);
  }, [chainId]);

  // Load username from player profile
  useEffect(() => {
    if (!userWalletAddress) return;
    fetch(`${API_BASE_URL}/api/players/${userWalletAddress}`)
      .then(r => r.json())
      .then(d => { if (d.username) setCreatorUsername(d.username); })
      .catch(() => {});
  }, [userWalletAddress]);

  const selectedToken = availableTokens.find(t => t.symbol === tokenSymbol);

  const canAdvance = useCallback((): boolean => {
    const id = STEPS[wizardStep]?.id;
    if (id === "topic") return topic.trim().length > 3 && !!userWalletAddress;
    if (id === "stake") return !!stakeAmount && parseFloat(stakeAmount) > 0 && !!tokenSymbol;
    return true;
  }, [wizardStep, topic, stakeAmount, tokenSymbol, userWalletAddress]);

  // ─── On-chain staking ───────────────────────────────────────────────────────
  /**
   * Approves (if needed) and stakes on the QuizHub contract.
   * @param code      6-char challenge code returned by the backend
   * @param token     TokenConfig of the selected token
   * @param amount    Human-readable amount string e.g. "0.5"
   */
  // ── New: Create Quiz on-chain (NO staking, NO approval) ─────────────────────
  const createQuizOnChain = async (
    code: string,
    token: TokenConfig,
    amount: string,
  ): Promise<void> => {
    if (!signer) throw new Error("Wallet not connected");

    console.log("[createQuizOnChain] Starting...", { code, token, amount });

    const contractAddress = QUIZ_HUB_ADDRESSES[chainId];
    if (!contractAddress) {
      throw new Error(
        `QuizHub contract address not configured for chain ${chainId} (${CHAIN_NAMES[chainId] ?? "unknown"}). ` +
        `Set NEXT_PUBLIC_QUIZ_HUB_${CHAIN_NAMES[chainId]?.toUpperCase() ?? chainId} in .env.local`
      );
    }

    const quizId   = deriveQuizId(code);
    const amountBN = parseUnits(amount, token.decimals);
    console.log("[createQuizOnChain] quizId:", quizId, "| stakePerPlayer:", amountBN.toString());

    const quizHub = new Contract(contractAddress, QUIZ_HUB_ABI, signer);

    console.log("[createQuizOnChain] Contracts initialised");
    console.log("[createQuizOnChain] quizHub address:", contractAddress);
    console.log("[createQuizOnChain] token address:", token.address);

    // ── Step: Create quiz on-chain (no approve, no fee, no transfer) ───────
    setTxPhase("Creating");

    toast.info("Confirm quiz creation in your wallet…");

    console.log("[createQuizOnChain] Sending createQuiz tx:", {
      quizId,
      tokenAddress: token.address,
      stakePerPlayer: amountBN.toString(),
    });

    const createTx = await quizHub.createQuiz(quizId, token.address);
    console.log("[createQuizOnChain] createTx hash:", createTx.hash);

    toast.loading("Waiting for creation confirmation…", { id: "create-confirm" });
    const createReceipt = await createTx.wait();
    console.log("[createQuizOnChain] createReceipt:", createReceipt);

    toast.success("Quiz created on-chain! ⛓️✅", { id: "create-confirm" });
    console.log("[createQuizOnChain] Done ✅");
  };

  // ─── Full create flow (backend + on-chain creation only) ─────────────────────
  const handleCreate = async () => {
    if (!userWalletAddress)          { toast.error("Connect your wallet"); return; }
    if (!topic.trim())               { toast.error("Enter a quiz topic"); return; }
    if (!stakeAmount || parseFloat(stakeAmount) <= 0) { toast.error("Enter a stake amount"); return; }
    if (!selectedToken)              { toast.error("Select a token"); return; }

    const contractAddress = QUIZ_HUB_ADDRESSES[chainId];
    if (!contractAddress) {
      toast.error(`QuizHub not deployed on ${CHAIN_NAMES[chainId] ?? `chain ${chainId}`} yet.`);
      return;
    }

    try {
      // Ensure the wallet is on the right network before doing anything
      await ensureCorrectNetwork(chainId);
    } catch {
      // ensureCorrectNetwork shows its own toast
      return;
    }

    setTxPhase("backend");

    try {
      // ── 1. Register / upsert player ───────────────────────────────────────
      if (creatorUsername) {
        await fetch(
          `${API_BASE_URL}/api/players/register?wallet=${userWalletAddress}&username=${creatorUsername}`,
          { method: "POST" },
        ).catch(() => {}); // non-fatal
      }

      // ── 2. Backend creates challenge + generates questions ─────────────────
      const res = await fetch(`${API_BASE_URL}/api/challenge/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic.trim(),
          questionCount,
          creatorAddress:  userWalletAddress,
          creatorUsername: creatorUsername || userWalletAddress.slice(0, 8),
          stakeAmount:     parseFloat(stakeAmount),
          tokenSymbol,
          chainId,
          isPublic,
          inviteWallet:    !isPublic && inviteWallet.trim() ? inviteWallet.trim() : undefined,
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.detail ?? "Challenge creation failed");

      const code: string = data.code;

      // ── 3. Create quiz on-chain (NEW) ─────────────────────────────────────
      await createQuizOnChain(code, selectedToken, stakeAmount);

      // ── 4. Done ───────────────────────────────────────────────────────────
      setTxPhase("done");
      setCreatedCode(code);
      toast.success(`🎉 Challenge live! Code: ${code}`);

    } catch (err: any) {
      setTxPhase("idle");

      // User rejected the wallet popup
      if (err?.code === 4001 || err?.code === "ACTION_REJECTED") {
        toast.error("Transaction rejected — challenge not created on-chain.");
        return;
      }

      const msg = err?.reason ?? err?.message ?? "Unknown error";
      toast.error(`❌ ${msg}`);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Success screen
  // ─────────────────────────────────────────────────────────────────────────

  if (createdCode) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <Header pageTitle="Challenge Created!" />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-sm space-y-4 text-center">
            <div className="text-8xl animate-bounce">🎉</div>
            <div className="bg-card rounded-3xl border-2 border-primary/20 p-8 shadow-2xl space-y-5">
              <div>
                <h2 className="text-2xl font-black text-foreground">Challenge is Live!</h2>
                <p className="text-muted-foreground text-sm mt-1">Topic: {topic}</p>
              </div>
              <div className="bg-primary/5 rounded-2xl p-6 border-2 border-primary/20">
                <p className="text-xs font-bold text-primary uppercase tracking-widest mb-2">Challenge Code</p>
                <div className="text-5xl font-black tracking-[0.15em] text-primary">{createdCode}</div>
              </div>
              
             <Button
                  variant="outline"
                  className="w-full h-11 rounded-2xl border-2 font-bold"
                  onClick={() => router.push(`/challenge/${createdCode}/pre-lobby`)}  // ← was /challenge/${createdCode}
                >
                  Open Pre-Lobby <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Step 0: Topic + visibility
  // ─────────────────────────────────────────────────────────────────────────

  const renderStepTopic = () => (
    <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="text-center space-y-2 pb-2">
        <div className="text-5xl">🎯</div>
        <h2 className="text-xl font-black text-foreground">What's the quiz about?</h2>
        <p className="text-sm text-muted-foreground">
          AI will generate 9 questions (3 rounds) on your topic automatically
        </p>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-bold text-foreground">
          Topic <span className="text-destructive">*</span>
        </Label>
        <Textarea
          value={topic}
          onChange={e => setTopic(e.target.value)}
          placeholder='"Ethereum & DeFi basics", "World geography capitals", "Solidity security"'
          className="resize-none h-24 rounded-xl border-2 text-sm"
        />
        <p className="text-xs text-muted-foreground">
          The more specific, the better. Gemini generates 3 rounds: easy, medium, hard.
        </p>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-bold text-foreground">Your username</Label>
        <Input
          value={creatorUsername}
          onChange={e => setCreatorUsername(e.target.value)}
          placeholder="Set in your player profile"
          className="h-11 rounded-xl border-2"
        />
      </div>
      <div className="space-y-2">
      <Label className="text-sm font-bold text-foreground">Number of Questions</Label>
      <div className="grid grid-cols-4 gap-2">
        {[15, 18, 21, 24, 27, 30].map((num) => (
          <button
            key={num}
            onClick={() => setQuestionCount(num)}
            className={cn(
              "py-2 rounded-xl border-2 text-xs font-bold transition-all",
              questionCount === num 
                ? "border-primary bg-primary/10 text-primary" 
                : "border-border bg-card text-muted-foreground"
            )}
          >
            {num}
          </button>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground">
        Questions are split equally across Easy, Medium, and Hard rounds.
      </p>
    </div>
      <div className="space-y-2">
        <Label className="text-sm font-bold text-foreground">Visibility</Label>
        <div className="grid grid-cols-2 gap-2">
          {([
            { val: true,  icon: Globe, label: "Public",  desc: "Anyone can join" },
            { val: false, icon: Lock,  label: "Private", desc: "Invite only" },
          ] as const).map(({ val, icon: Icon, label, desc }) => (
            <button
              key={String(val)}
              onClick={() => setIsPublic(val)}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all",
                isPublic === val
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:border-primary/40"
              )}
            >
              <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-xs font-black text-foreground">{label}</p>
                <p className="text-[10px] text-muted-foreground">{desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {!isPublic && (
        <div className="space-y-2 animate-in fade-in duration-200">
          <Label className="text-sm font-bold text-foreground">Opponent wallet address</Label>
          <Input
            value={inviteWallet}
            onChange={e => setInviteWallet(e.target.value)}
            placeholder="0x…"
            className="h-11 rounded-xl border-2 font-mono text-sm"
          />
        </div>
      )}

      {!userWalletAddress && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
          <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
          <span className="text-xs text-amber-700 dark:text-amber-300 font-medium">
            Connect your wallet to continue
          </span>
        </div>
      )}
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Step 1: Stake
  // ─────────────────────────────────────────────────────────────────────────

  const renderStepStake = () => (
    <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="text-center space-y-2 pb-2">
        <div className="text-5xl">💰</div>
        <h2 className="text-xl font-black text-foreground">Set the stake</h2>
        <p className="text-sm text-muted-foreground">
          Both players must stake this amount. Winner takes the pool.
        </p>
      </div>

      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/50 border border-border">
        <div className={cn(
          "w-2 h-2 rounded-full shrink-0",
          CHAIN_NAMES[chainId] ? "bg-emerald-500" : "bg-amber-500"
        )} />
        <span className="text-xs text-muted-foreground font-medium">
          {CHAIN_NAMES[chainId] ? `Connected · ${CHAIN_NAMES[chainId]}` : `Chain ${chainId}`}
        </span>
      </div>

      {/* Warn if no contract deployed on this chain */}
      {!QUIZ_HUB_ADDRESSES[chainId] && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
          <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <span className="text-xs text-amber-700 dark:text-amber-300 font-medium">
            QuizHub contract is not configured for {CHAIN_NAMES[chainId] ?? `chain ${chainId}`}.
            Set <code className="font-mono">NEXT_PUBLIC_QUIZ_HUB_{(CHAIN_NAMES[chainId] ?? `${chainId}`).toUpperCase()}</code> in .env.local.
          </span>
        </div>
      )}

      {availableTokens.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs font-black text-muted-foreground uppercase tracking-wider">Token</Label>
          <div className="grid grid-cols-2 gap-2">
            {availableTokens.map(t => (
              <button
                key={t.address}
                onClick={() => setTokenSymbol(t.symbol)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2.5 rounded-2xl border-2 text-left transition-all",
                  tokenSymbol === t.symbol
                    ? "border-yellow-500 bg-yellow-50 dark:bg-yellow-500/10 shadow-sm"
                    : "border-border hover:border-primary/40 bg-card"
                )}
              >
                <img
                  src={t.logoUrl} alt={t.symbol}
                  className="w-8 h-8 rounded-full object-cover bg-muted shrink-0"
                  onError={e => { (e.target as HTMLImageElement).src = "/fallback-token.png"; }}
                />
                <div className="min-w-0">
                  <div className="text-xs font-black text-foreground">{t.symbol}</div>
                </div>
                {tokenSymbol === t.symbol && (
                  <CheckCircle2 className="h-4 w-4 text-yellow-600 ml-auto shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-xs font-black text-muted-foreground uppercase tracking-wider">
          Amount per player
        </Label>
        <div className="relative">
          <Input
            type="number"
            min="0"
            step="any"
            value={stakeAmount}
            onChange={e => setStakeAmount(e.target.value)}
            placeholder="0.00"
            className="h-12 text-lg font-mono rounded-xl pr-20 border-2"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-muted-foreground">
            {tokenSymbol}
          </span>
        </div>
        {stakeAmount && parseFloat(stakeAmount) > 0 && (
          <p className="text-xs text-muted-foreground">
            Winner receives{" "}
            <span className="font-black text-foreground">
              {(parseFloat(stakeAmount) * 2).toFixed(4)} {tokenSymbol}
            </span>{" "}
            (minus platform fee &amp; gas)
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground font-medium">Quick pick</p>
        <div className="flex flex-wrap gap-2">
          {["0.1", "0.5", "1", "5", "10"].map(v => (
            <button
              key={v}
              onClick={() => setStakeAmount(v)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-black border-2 transition-all",
                stakeAmount === v
                  ? "bg-primary border-primary text-primary-foreground"
                  : "bg-card border-border text-muted-foreground hover:border-primary/50"
              )}
            >
              {v} {tokenSymbol}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Step 2: Launch preview
  // ─────────────────────────────────────────────────────────────────────────

  const isSubmitting = txPhase !== "idle";

  const renderStepLaunch = () => (
    <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300 max-w-xl mx-auto">
      <div className="text-center space-y-2 pb-2">
        <div className="text-5xl">🚀</div>
        <h2 className="text-xl font-black text-foreground">Ready to challenge?</h2>
        <p className="text-sm text-muted-foreground">Review and launch</p>
      </div>

      <div className="rounded-3xl border-2 border-border bg-card overflow-hidden">
        <div className="p-5 space-y-4">
          {[
            { emoji: "🧠", label: "Topic",      value: topic || "—",                    ok: !!topic },
            { emoji: "💰", label: "Stake",       value: `${stakeAmount} ${tokenSymbol}`, ok: !!stakeAmount && parseFloat(stakeAmount) > 0 },
            { emoji: "🔗", label: "Chain",       value: CHAIN_NAMES[chainId] ?? `Chain ${chainId}`, ok: !!QUIZ_HUB_ADDRESSES[chainId] },
            { emoji: isPublic ? "🌐" : "🔒", label: "Visibility", value: isPublic ? "Public" : "Private invite", ok: true },
          ].map(item => (
            <div
              key={item.label}
              className={cn(
                "flex items-center gap-2.5 rounded-2xl px-3 py-2.5 border-2",
                item.ok
                  ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800"
                  : "bg-destructive/10 border-destructive/30"
              )}
            >
              <span className="text-xl shrink-0">{item.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-muted-foreground">{item.label}</p>
                <p className={cn(
                  "text-sm font-black truncate",
                  item.ok ? "text-foreground" : "text-destructive"
                )}>
                  {item.value}
                </p>
              </div>
              {item.ok
                ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 ml-auto shrink-0" />
                : <AlertCircle  className="h-3.5 w-3.5 text-destructive ml-auto shrink-0" />
              }
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={handleCreate}
        disabled={isSubmitting || !userWalletAddress || !QUIZ_HUB_ADDRESSES[chainId]}
        className={cn(
          "w-full h-16 rounded-2xl font-black text-lg transition-all duration-200",
          "disabled:opacity-60 disabled:cursor-not-allowed",
          userWalletAddress && QUIZ_HUB_ADDRESSES[chainId]
            ? "bg-primary text-primary-foreground hover:opacity-90 shadow-lg hover:scale-[1.01] active:scale-[0.99]"
            : "bg-muted text-muted-foreground"
        )}
      >
        <span className="flex items-center justify-center gap-2">
          {isSubmitting ? (
            <><Loader2 className="h-5 w-5 animate-spin" /> Creating </>
          ) : !userWalletAddress ? (
            "⚠️ Connect Wallet"
          ) : !QUIZ_HUB_ADDRESSES[chainId] ? (
            "⚠️ Contract not configured"
          ) : (
            <><Rocket className="h-5 w-5" /> Launch Quiz 🚀</>
          )}
        </span>
      </button>
    </div>
  );

  const stepContent = [renderStepTopic, renderStepStake, renderStepLaunch];
  const lastStep    = STEPS.length - 1;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header pageTitle="Create Challenge" />

      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-primary/5 blur-3xl opacity-60" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-primary/5 blur-3xl opacity-60" />
      </div>

      <div className="relative z-10 flex-1 max-w-2xl mx-auto w-full px-4 sm:px-6 pb-24 pt-6 space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 rounded-xl border-2 border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-lg font-black text-foreground">New Challenge</h1>
            <p className="text-xs text-muted-foreground">
              Step {wizardStep + 1} of {STEPS.length} — {STEPS[wizardStep]?.desc}
            </p>
          </div>
        </div>

        <WizardProgress current={wizardStep} setStep={setWizardStep} />

        <div className="bg-card rounded-3xl border-2 border-border p-5 sm:p-7 shadow-sm">
          {stepContent[wizardStep]?.()}
        </div>

        {wizardStep < lastStep && (
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => setWizardStep(s => Math.max(0, s - 1))}
              disabled={wizardStep === 0}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl border-2 border-border bg-card text-muted-foreground font-bold text-sm hover:border-primary/50 hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="h-4 w-4" /> Back
            </button>

            <div className="flex items-center gap-1.5">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "rounded-full transition-all duration-300",
                    i === wizardStep ? "w-6 h-2 bg-primary"
                    : i < wizardStep  ? "w-2 h-2 bg-primary/40"
                    :                   "w-2 h-2 bg-border"
                  )}
                />
              ))}
            </div>

            <button
              onClick={() => setWizardStep(s => Math.min(lastStep, s + 1))}
              disabled={!canAdvance()}
              className={cn(
                "flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm transition-all",
                canAdvance()
                  ? "bg-primary text-primary-foreground hover:opacity-90 shadow-sm hover:scale-[1.02]"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              {wizardStep === lastStep - 1 ? "Review" : "Next"}
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
        
      {/* Floating transaction status pill */}
      <TxStatusPill phase={txPhase} />
    </div>
  );
}