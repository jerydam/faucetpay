"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/hooks/use-wallet";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useSearchParams } from "next/navigation";
import {
  Loader2, CheckCircle2, AlertCircle,
  ChevronRight, ChevronLeft, Rocket, Globe, Lock,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  createWalletClient,
  createPublicClient,
  custom,
  http,
  keccak256,
  toBytes,
  type Address,
} from "viem";
import { celo } from "viem/chains";
import { QUIZ_HUB_ABI } from "@/lib/abis";

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE_URL = "https://faucetpay-backend.koyeb.app";

const QUIZ_HUB_ADDRESSES: Record<number, `0x${string}`> = {
  42220: (process.env.NEXT_PUBLIC_QUIZ_HUB_CELO ?? "0x9088298cd07BE0cAA1e256d3f3761313e1a1447E") as `0x${string}`,
};

interface TokenConfig {
  address: string;
  symbol: string;
  decimals: number;
  logoUrl: string;
  isNative?: boolean; 
}

const TOKENS_BY_CHAIN: Record<number, TokenConfig[]> = {
  42220: [
    { address: "0x765DE816845861e75A25fCA122bb6898B8B1282a", symbol: "USDm",  decimals: 18, logoUrl: "/USDm.png"   },
    { address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C", symbol: "USDC",  decimals: 6,  logoUrl: "/usdc.jpg"   },
    { address: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e", symbol: "USDT",  decimals: 6,  logoUrl: "/usdt.jpg"   },
  ],
  8453: [
    { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", symbol: "USDC",  decimals: 6,  logoUrl: "/usdc.jpg"   },
  ],
  1135: [
    { address: "0xac485391EB2d7D88253a7F1eF18C37f4242D1A24", symbol: "LSK",   decimals: 18, logoUrl: "/lsk.png"    },
  ],
};

const CHAIN_NAMES: Record<number, string> = {
  42220: "Celo",
};
const MIN_STAKE = 0.5;
function deriveQuizId(code: string): `0x${string}` {
  return keccak256(toBytes(code));
}

const STEPS = [
  { id: "topic",  emoji: "🎯", label: "Topic",  desc: "What to quiz about" },
  { id: "stake",  emoji: "💰", label: "Stake",  desc: "Set the wager"       },
  { id: "launch", emoji: "🚀", label: "Launch", desc: "Go live"             },
];

function WizardProgress({ current, setStep }: { current: number; setStep: (n: number) => void; }) {
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

type TxPhase = "idle" | "backend" | "Creating" | "done";

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

export default function CreateChallengePage() {
  const router = useRouter();
  const { address: userWalletAddress, chainId: walletChainId, ensureCorrectNetwork } = useWallet();

  const searchParams = useSearchParams();

  const chainId = walletChainId ?? 42220;
  const availableTokens = TOKENS_BY_CHAIN[chainId] ?? [];

  const [wizardStep, setWizardStep]        = useState(0);
  const [txPhase, setTxPhase]              = useState<TxPhase>("idle");
  const [createdCode, setCreatedCode]      = useState<string | null>(null);

  // Step 0 — Topic & Visibility
  const [topic, setTopic]                  = useState("");
  const [creatorUsername, setCreatorUsername] = useState("");
  
  // 👉 Logic: If inviteUsername is in URL, default to Private (false)
  const [isPublic, setIsPublic]            = useState(!searchParams.get("inviteUsername"));
  const [questionCount, setQuestionCount]  = useState(9);

  // Step 1 — Stake
  const [stakeAmount, setStakeAmount]      = useState("");
  const [tokenSymbol, setTokenSymbol]      = useState(availableTokens[0]?.symbol ?? "CELO");

  // Duel Routing States
  const [inviteUsername, setInviteUsername] = useState(searchParams.get("inviteUsername") ?? "");
  const [inviteWallet, setInviteWallet]     = useState(searchParams.get("inviteWallet") ?? "");
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "loading" | "found" | "notfound">("idle");
  const [resolvedUsername, setResolvedUsername] = useState(searchParams.get("inviteUsername") ?? "");

  // Effect to mark as found if coming from Ranks with proper params
  useEffect(() => {
    if (searchParams.get("inviteWallet") && searchParams.get("inviteUsername")) {
      setUsernameStatus("found");
    }
  }, [searchParams]);

  const lookupUsername = async (username: string) => {
    if (!username.trim() || username.length < 3) return;
    setUsernameStatus("loading");
    try {
      const res = await fetch(`${API_BASE_URL}/api/players/by-username/${encodeURIComponent(username.trim())}`);
      if (!res.ok) { setUsernameStatus("notfound"); return; }
      const data = await res.json();
      setInviteWallet(data.wallet);
      setResolvedUsername(data.username);
      setUsernameStatus("found");
    } catch {
      setUsernameStatus("notfound");
    }
  };

  useEffect(() => {
    const tokens = TOKENS_BY_CHAIN[chainId] ?? [];
    if (tokens.length > 0) setTokenSymbol(tokens[0].symbol);
  }, [chainId]);

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
    if (id === "topic") {
      const topicOk = topic.trim().length > 3 && !!userWalletAddress;
      if (!isPublic) return topicOk && usernameStatus === "found";
      return topicOk;
    }
    if (id === "stake") return !!stakeAmount && parseFloat(stakeAmount) >= MIN_STAKE && !!tokenSymbol;
    return true;
  }, [wizardStep, topic, stakeAmount, tokenSymbol, userWalletAddress, isPublic, usernameStatus]);

 const createQuizOnChain = async (code: string, token: TokenConfig): Promise<void> => {
  if (!window.ethereum) throw new Error("No wallet found. Please open inside MiniPay.");
  
  // Required for MiniPay before any signing
  await window.ethereum.request({ method: "eth_requestAccounts" });

  const walletClient = createWalletClient({
    chain: celo,
    transport: custom(window.ethereum),
  });
  const publicClient = createPublicClient({
    chain: celo,
    transport: http("https://forno.celo.org"),
  });

  const contractAddress = QUIZ_HUB_ADDRESSES[chainId] as Address;
  if (!contractAddress) throw new Error(`QuizHub not configured for chain ${chainId}`);

  const [account] = await walletClient.getAddresses();
  const quizId = deriveQuizId(code);

  setTxPhase("Creating");
  toast.info("Confirm quiz creation in your wallet…");

  const txHash = await walletClient.writeContract({
    address: contractAddress,
    abi: QUIZ_HUB_ABI,
    functionName: "createQuiz",
    args: [quizId, token.address as `0x${string}`],
    account,
    chain: celo,
  });

  toast.loading("Waiting for confirmation…", { id: "create-confirm" });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  toast.success("Quiz created on-chain! ⛓️✅", { id: "create-confirm" });

  try {
    await fetch(`${API_BASE_URL}/api/challenge/${code}/on-chain-confirmed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creatorWallet: userWalletAddress, txHash: receipt.transactionHash }),
    });
  } catch (err) {
    console.warn("[on-chain-confirmed] failed to notify:", err);
  }
};

  const handleCreate = async () => {
    if (!userWalletAddress || !topic.trim() || !stakeAmount || !selectedToken) {
      toast.error("Please fill all required fields");
      return;
    }

    const contractAddress = QUIZ_HUB_ADDRESSES[chainId];
    if (!contractAddress) {
      toast.error(`QuizHub not deployed on ${CHAIN_NAMES[chainId] ?? chainId} yet.`);
      return;
    }

    try {
      await ensureCorrectNetwork(chainId);
    } catch {
      return;
    }

    setTxPhase("backend");

    try {
      if (creatorUsername) {
        await fetch(`${API_BASE_URL}/api/players/register?wallet=${userWalletAddress}&username=${creatorUsername}`, { method: "POST" }).catch(() => {});
      }

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
          inviteWallet: !isPublic && inviteWallet.trim() ? inviteWallet.trim() : undefined,
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.detail ?? "Challenge creation failed");

      const code: string = data.code;
      await createQuizOnChain(code, selectedToken);

      setTxPhase("done");
      setCreatedCode(code);
      toast.success(`🎉 Challenge live! Code: ${code}`);

    } catch (err: any) {
      setTxPhase("idle");
      if (err?.code === 4001 || err?.code === "ACTION_REJECTED") {
        toast.error("Transaction rejected — challenge not created.");
        return;
      }
      toast.error(`❌ ${err?.reason ?? err?.message ?? "Unknown error"}`);
    }
  };

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
                  onClick={() => router.push(`/challenge/${createdCode}/pre-lobby`)}
                >
                  Open Pre-Lobby <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const renderStepTopic = () => (
    <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="text-center space-y-2 pb-2">
        <div className="text-5xl">🎯</div>
        <h2 className="text-xl font-black text-foreground">What's the quiz about?</h2>
        <p className="text-sm text-muted-foreground">AI will generate {questionCount} questions on your topic</p>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-bold text-foreground">Topic <span className="text-destructive">*</span></Label>
        <Textarea
          value={topic}
          onChange={e => setTopic(e.target.value)}
          placeholder='"Ethereum & DeFi basics", "World geography capitals", "Solidity security"'
          className="resize-none h-24 rounded-xl border-2 text-sm"
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
                isPublic === val ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"
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
        <Label className="text-sm font-bold text-foreground">Opponent username</Label>
        <div className="flex gap-2">
          <Input
            value={inviteUsername}
            onChange={e => {
              setInviteUsername(e.target.value);
              setUsernameStatus("idle");
              setInviteWallet("");
            }}
            onBlur={() => lookupUsername(inviteUsername)}
            placeholder="e.g. axelrod"
            className="h-11 rounded-xl border-2 text-sm flex-1"
          />
          <button
            type="button"
            onClick={() => lookupUsername(inviteUsername)}
            disabled={usernameStatus === "loading"}
            className="px-4 rounded-xl border-2 border-border bg-card text-sm font-bold text-muted-foreground hover:border-primary/50 transition-all disabled:opacity-50"
          >
            {usernameStatus === "loading" ? "…" : "Find"}
          </button>
        </div>

        {usernameStatus === "found" && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
            <div>
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">{resolvedUsername}</span>
              <span className="text-xs text-emerald-600 dark:text-emerald-400 ml-1">— {inviteWallet.slice(0, 6)}…{inviteWallet.slice(-4)}</span>
            </div>
          </div>
        )}
        {usernameStatus === "notfound" && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
            <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
            <span className="text-xs font-medium text-red-700 dark:text-red-300">Username not found.</span>
          </div>
        )}
      </div>
    )}
    </div>
  );

  const renderStepStake = () => (
    <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="text-center space-y-2 pb-2">
        <div className="text-5xl">💰</div>
        <h2 className="text-xl font-black text-foreground">Set the stake</h2>
        <p className="text-sm text-muted-foreground">Both players must stake this amount. Winner takes the pool.</p>
      </div>

      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/50 border border-border">
        <div className={cn("w-2 h-2 rounded-full shrink-0", CHAIN_NAMES[chainId] ? "bg-emerald-500" : "bg-amber-500")} />
        <span className="text-xs text-muted-foreground font-medium">{CHAIN_NAMES[chainId] ?? chainId} Network</span>
      </div>

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
                  tokenSymbol === t.symbol ? "border-yellow-500 bg-yellow-50 dark:bg-yellow-500/10" : "border-border hover:border-primary/40 bg-card"
                )}
              >
                <img src={t.logoUrl} alt={t.symbol} className="w-8 h-8 rounded-full object-cover shrink-0" onError={e => { (e.target as HTMLImageElement).src = "/fallback-token.png"; }} />
                <div className="text-xs font-black text-foreground">{t.symbol}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-xs font-black text-muted-foreground uppercase tracking-wider">Amount per player <span className="text-destructive">(min {MIN_STAKE})</span></Label>
        <div className="relative">
          <Input type="number" value={stakeAmount} onChange={e => setStakeAmount(e.target.value)} placeholder="0.00" className="h-12 text-lg font-mono rounded-xl pr-20 border-2" />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-muted-foreground">{tokenSymbol}</span>
          {stakeAmount && parseFloat(stakeAmount) < MIN_STAKE && parseFloat(stakeAmount) > 0 && (
            <p className="text-xs text-destructive font-bold mt-1">
              Minimum stake is {MIN_STAKE} {tokenSymbol}
            </p>
          )}
        </div>
      </div>
    </div>
  );

  const renderStepLaunch = () => (
    <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300 max-w-xl mx-auto">
      <div className="text-center space-y-2 pb-2">
        <div className="text-5xl">🚀</div>
        <h2 className="text-xl font-black text-foreground">Ready to challenge?</h2>
        <p className="text-sm text-muted-foreground">Review and launch</p>
      </div>

      <div className="rounded-3xl border-2 border-border bg-card overflow-hidden p-5 space-y-4">
        {[
          { emoji: "🧠", label: "Topic", value: topic || "—", ok: !!topic },
          { emoji: "💰", label: "Stake", value: `${stakeAmount} ${tokenSymbol}`, ok: !!stakeAmount && parseFloat(stakeAmount) > 0 },
          { emoji: isPublic ? "🌐" : "🔒", label: "Visibility", value: isPublic ? "Public" : `Duel vs ${resolvedUsername}`, ok: true },
        ].map(item => (
          <div key={item.label} className={cn("flex items-center gap-2.5 rounded-2xl px-3 py-2.5 border-2", item.ok ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200" : "bg-destructive/10 border-destructive/30")}>
            <span className="text-xl">{item.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-muted-foreground">{item.label}</p>
              <p className="text-sm font-black truncate text-foreground">{item.value}</p>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={handleCreate}
        disabled={txPhase !== "idle" || !userWalletAddress}
        className={cn("w-full h-16 rounded-2xl font-black text-lg transition-all", userWalletAddress ? "bg-primary text-primary-foreground hover:opacity-90" : "bg-muted text-muted-foreground")}
      >
        {txPhase !== "idle" ? <><Loader2 className="h-5 w-5 animate-spin mr-2 inline" /> Creating</> : <><Rocket className="h-5 w-5 mr-2 inline" /> Launch Duel</>}
      </button>
    </div>
  );

  const stepContent = [renderStepTopic, renderStepStake, renderStepLaunch];
  const lastStep    = STEPS.length - 1;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header pageTitle="Create Challenge" />
      <div className="relative z-10 flex-1 max-w-2xl mx-auto w-full px-4 pb-24 pt-6 space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="w-9 h-9 rounded-xl border-2 border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground transition-all">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-lg font-black text-foreground">New Challenge</h1>
            <p className="text-xs text-muted-foreground">Step {wizardStep + 1} of {STEPS.length}</p>
          </div>
        </div>

        <WizardProgress current={wizardStep} setStep={setWizardStep} />

        <div className="bg-card rounded-3xl border-2 border-border p-5 shadow-sm">
          {stepContent[wizardStep]?.()}
        </div>

        {wizardStep < lastStep && (
          <div className="flex items-center justify-between gap-3">
            <button onClick={() => setWizardStep(s => Math.max(0, s - 1))} disabled={wizardStep === 0} className="px-5 py-3 rounded-2xl border-2 border-border bg-card text-muted-foreground font-bold text-sm disabled:opacity-40 transition-all">
              <ChevronLeft className="h-4 w-4 inline mr-1" /> Back
            </button>
            <button onClick={() => setWizardStep(s => Math.min(lastStep, s + 1))} disabled={!canAdvance()} className={cn("px-5 py-3 rounded-2xl font-bold text-sm transition-all", canAdvance() ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground cursor-not-allowed")}>
              Next <ChevronRight className="h-4 w-4 inline ml-1" />
            </button>
          </div>
        )}
      </div>
      <TxStatusPill phase={txPhase} />
    </div>
  );
}