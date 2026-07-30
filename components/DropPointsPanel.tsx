"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Contract, JsonRpcProvider, formatUnits } from "ethers";
import {
  History,
  Clock,
  Zap,
  Loader2,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  ShoppingBag,
  ChevronDown,
  ChevronRight,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useWallet } from "@/hooks/use-wallet";
import Image from "next/image";

// ─── Celo config (MiniPay — single chain) ─────────────────────────────────────

const CELO_CHAIN_ID = 42220;

const CELO = {
  name: "Celo",
  color: "#FCFF52",
  explorer: "https://celoscan.io/tx/",
  rpc: "https://forno.celo.org",
  contract: "0x9825670865B896738CF8E6c98d093aD5b40F0A11",
  blockLookback: 1_000_000,
};

const API_BASE_URL = "https://identical-vivi-faucetdrops-41e9c56b.koyeb.app";

const COOLDOWN_MS = 24 * 60 * 60 * 1000;

// ─── ABI ──────────────────────────────────────────────────────────────────────

const POINTS_ABI = [
  "function claim(uint256 amount, uint256 timestamp, bytes signature) external",
  "function canClaim(address user) view returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClaimEntry {
  timestamp: string;
  amount: number;
  tx_hash: string;
}

// ─── Module-level helpers ─────────────────────────────────────────────────────

function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`;
}

let _provider: JsonRpcProvider | null = null;
function getProvider(): JsonRpcProvider {
  if (!_provider) _provider = new JsonRpcProvider(CELO.rpc);
  return _provider;
}

async function verifyWithRetry(
  txHash: string,
  address: string,
  attempts = 3
): Promise<any> {
  for (let i = 0; i < attempts; i++) {
    try {
      const verifyRes = await fetch(`${API_BASE_URL}/api/droplist/verify-claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash, chainId: CELO_CHAIN_ID, walletAddress: address }),
        signal: AbortSignal.timeout(30_000),
      });
      const verifyData = await verifyRes.json();
      if (verifyRes.ok || verifyData?.success === true) return verifyData;
      const detail = verifyData?.detail || "";
      if (detail.toLowerCase().includes("already")) return;
      throw new Error(detail || "Verification failed");
    } catch (err: any) {
      const isLast = i === attempts - 1;
      const isNetwork =
        err?.name === "AbortError" ||
        err?.message?.includes("fetch") ||
        err?.message?.includes("network") ||
        err?.message?.includes("aborted");
      if (isNetwork && !isLast) {
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      if (isLast) throw err;
    }
  }
}

// ─── LS cache helpers ─────────────────────────────────────────────────────────

const HISTORY_CACHE_KEY = (addr: string) => `drop_history_celo_${addr.toLowerCase()}`;
const HISTORY_CACHE_TTL = 30 * 60 * 1000;

function saveHistoryCache(addr: string, data: ClaimEntry[]) {
  try {
    localStorage.setItem(
      HISTORY_CACHE_KEY(addr),
      JSON.stringify({ data, cachedAt: Date.now() })
    );
  } catch {}
}

function loadHistoryCache(addr: string): ClaimEntry[] | null {
  try {
    const raw = localStorage.getItem(HISTORY_CACHE_KEY(addr));
    if (!raw) return null;
    const { data, cachedAt } = JSON.parse(raw);
    if (Date.now() - cachedAt > HISTORY_CACHE_TTL) return null;
    return data as ClaimEntry[];
  } catch {
    return null;
  }
}

// ─── Particle burst ───────────────────────────────────────────────────────────

function ClaimBurst({ trigger }: { trigger: boolean }) {
  return (
    <AnimatePresence>
      {trigger &&
        Array.from({ length: 14 }).map((_, i) => {
          const angle = (i / 14) * 360;
          const dist = 55 + Math.random() * 35;
          const x = Math.cos((angle * Math.PI) / 180) * dist;
          const y = Math.sin((angle * Math.PI) / 180) * dist;
          return (
            <motion.span
              key={i}
              className="absolute rounded-full pointer-events-none z-10"
              style={{
                width: 6 + Math.random() * 4,
                height: 6 + Math.random() * 4,
                background: i % 2 === 0 ? "hsl(var(--primary))" : CELO.color,
                left: "50%",
                top: "50%",
                translateX: "-50%",
                translateY: "-50%",
              }}
              initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
              animate={{ opacity: 0, x, y, scale: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.65, ease: "easeOut" }}
            />
          );
        })}
    </AnimatePresence>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface DropPointsPanelProps {
  /** Control the modal from a parent (e.g. a landing-page button). Omit to self-manage. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Show the built-in floating pill. Turn off when the parent supplies its own trigger. */
  showTrigger?: boolean;
  /** Auto-open once per page load when the user is eligible to claim. */
  autoOpen?: boolean;
}

export default function DropPointsPanel({
  open: controlledOpen,
  onOpenChange,
  showTrigger = true,
  autoOpen = true,
}: DropPointsPanelProps = {}) {
  const { address, isConnected, chainId, getActiveSigner } = useWallet();
  const router = useRouter();

  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : uncontrolledOpen;
  const setIsOpen = useCallback(
    (v: boolean) => {
      if (!isControlled) setUncontrolledOpen(v);
      onOpenChange?.(v);
    },
    [isControlled, onOpenChange]
  );

  const [cooldownChecked, setCooldownChecked] = useState(false);
  const [historyExpanded, setHistoryExpanded]  = useState(true);
  const [isClaiming, setIsClaiming]   = useState(false);
  const [claimBurst, setClaimBurst]   = useState(false);
  const [lastClaimAt, setLastClaimAt] = useState<string | null>(null);
  const [canClaim, setCanClaim]       = useState(true);
  const [remainingMs, setRemainingMs] = useState(0);

  const [balance, setBalance]               = useState(0);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [balanceError, setBalanceError]     = useState(false);

  const [history, setHistory]               = useState<ClaimEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const claimLockRef  = useRef(false);
  const autoOpenedRef = useRef(false);

  const onCelo = chainId === CELO_CHAIN_ID;

  // ── Cooldown from the Celo contract ───────────────────────────────────────

  const fetchCooldown = useCallback(async (addr: string) => {
    try {
      const provider = getProvider();
      const contract = new Contract(CELO.contract, POINTS_ABI, provider);

      const eligible: boolean = await contract.canClaim(addr);
      if (eligible) {
        setCanClaim(true);
        setRemainingMs(0);
        setLastClaimAt(null);
        return;
      }

      // Not eligible — find the last mint to work out when the cooldown ends
      let lastClaimMs = Date.now() - 23 * 60 * 60 * 1000; // fallback: assume recent
      try {
        const filter = contract.filters.Transfer(
          "0x0000000000000000000000000000000000000000",
          addr
        );
        const currentBlock = await provider.getBlockNumber();
        const fromBlock = Math.max(0, currentBlock - 100_000);
        const logs = await contract.queryFilter(filter, fromBlock, "latest");
        if (logs.length > 0) {
          const lastLog = logs[logs.length - 1] as any;
          const block = await provider.getBlock(lastLog.blockNumber);
          if (block) lastClaimMs = block.timestamp * 1000;
        }
      } catch {}

      const rem = COOLDOWN_MS - (Date.now() - lastClaimMs);
      if (rem > 0) {
        setCanClaim(false);
        setRemainingMs(rem);
        setLastClaimAt(new Date(lastClaimMs).toISOString());
      } else {
        setCanClaim(true);
        setRemainingMs(0);
        setLastClaimAt(null);
      }
    } catch (e) {
      console.warn("[DropPoints] Cooldown check failed:", e);
    } finally {
      setCooldownChecked(true);
    }
  }, []);

  // ── Balance ───────────────────────────────────────────────────────────────

  const fetchBalance = useCallback(async (addr: string) => {
    setBalanceLoading(true);
    setBalanceError(false);
    try {
      const contract = new Contract(CELO.contract, POINTS_ABI, getProvider());
      const [raw, dec]: [bigint, number] = await Promise.all([
        contract.balanceOf(addr),
        contract.decimals(),
      ]);
      setBalance(parseFloat(formatUnits(raw, dec)));
    } catch {
      setBalanceError(true);
    } finally {
      setBalanceLoading(false);
    }
  }, []);

  // ── History ───────────────────────────────────────────────────────────────

  const fetchHistory = useCallback(
    async (forceRefresh = false) => {
      if (!address) return;

      if (!forceRefresh) {
        const cached = loadHistoryCache(address);
        if (cached) {
          setHistory(cached);
          setHistoryLoading(false);
          return;
        }
      }

      setHistoryLoading(true);
      try {
        const provider = getProvider();
        const contract = new Contract(CELO.contract, POINTS_ABI, provider);

        const filter = contract.filters.Transfer(
          "0x0000000000000000000000000000000000000000",
          address
        );

        const currentBlock = await provider.getBlockNumber();
        const fromBlock = Math.max(0, currentBlock - CELO.blockLookback);

        const CHUNK = 100_000;
        const logs: any[] = [];
        for (let start = fromBlock; start < currentBlock; start += CHUNK) {
          const to = Math.min(start + CHUNK - 1, currentBlock);
          try {
            const chunkLogs = await contract.queryFilter(filter, start, to);
            logs.push(...chunkLogs);
          } catch {}
        }

        if (logs.length === 0) {
          setHistory([]);
          saveHistoryCache(address, []);
          return;
        }

        const decimals: number = await contract.decimals().catch(() => 18);
        const blockCache: Record<number, number> = {};
        const uniqueBlocks = [...new Set(logs.map((l: any) => l.blockNumber))];
        await Promise.allSettled(
          uniqueBlocks.map(async (bn) => {
            const block = await provider.getBlock(bn);
            blockCache[bn] = block?.timestamp ?? Math.floor(Date.now() / 1000);
          })
        );

        const claims: ClaimEntry[] = logs.map((log: any) => ({
          tx_hash: log.transactionHash,
          amount: parseFloat(formatUnits(log.args[2] ?? log.args.value, decimals)),
          timestamp: new Date(
            (blockCache[log.blockNumber] ?? Math.floor(Date.now() / 1000)) * 1000
          ).toISOString(),
        }));

        claims.sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        setHistory(claims);
        saveHistoryCache(address, claims);
      } catch (e) {
        console.error("Error fetching on-chain history:", e);
        toast.error("Failed to load claim history.");
      } finally {
        setHistoryLoading(false);
      }
    },
    [address]
  );

  // ── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!address) return;
    setCooldownChecked(false);
    fetchBalance(address);
    fetchCooldown(address);
  }, [address, fetchBalance, fetchCooldown]);

  useEffect(() => {
    if (!address) return;
    const cached = loadHistoryCache(address);
    if (cached) setHistory(cached);
    const timer = setTimeout(() => fetchHistory(false), 2000);
    return () => clearTimeout(timer);
  }, [address, fetchHistory]);

  useEffect(() => {
    if (!lastClaimAt) {
      setCanClaim(true);
      setRemainingMs(0);
      return;
    }
    const tick = () => {
      const rem = COOLDOWN_MS - (Date.now() - new Date(lastClaimAt).getTime());
      if (rem > 0) {
        setCanClaim(false);
        setRemainingMs(rem);
      } else {
        setCanClaim(true);
        setRemainingMs(0);
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [lastClaimAt]);

  // ── Auto-popup (once per page load, skipped if already claimed) ───────────

  useEffect(() => {
    if (!autoOpen || autoOpenedRef.current) return;

    if (!address) {
      const t = setTimeout(() => {
        if (autoOpenedRef.current) return;
        autoOpenedRef.current = true;
        setIsOpen(true);
      }, 1500);
      return () => clearTimeout(t);
    }

    if (!cooldownChecked) return;
    autoOpenedRef.current = true;
    if (canClaim) setIsOpen(true);
  }, [autoOpen, address, cooldownChecked, canClaim, setIsOpen]);

  // ── Close on Escape ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, setIsOpen]);

  // ── Claim ─────────────────────────────────────────────────────────────────

  const handleClaim = async () => {
    if (!canClaim)    { toast.error(`Come back in ${formatCountdown(remainingMs)}`); return; }
    if (!isConnected) { toast.warning("Connect your wallet first."); return; }
    if (!address)     { toast.warning("Wallet not ready."); return; }
    if (!onCelo) {
      toast.error("Drop Points are on Celo — switch networks to claim.");
      return;
    }
    if (claimLockRef.current) return;

    claimLockRef.current = true;
    setIsClaiming(true);

    let receipt: any = null;

    try {
      const activeSigner = await getActiveSigner();
      if (!activeSigner) {
        toast.error("Could not get signer — please re-login.", { id: "claim-tx" });
        return;
      }

      // ── Pre-flight ───────────────────────────────────────────────────────
      try {
        const readOnly = new Contract(CELO.contract, POINTS_ABI, getProvider());
        const eligible: boolean = await readOnly.canClaim(address);
        if (!eligible) {
          toast.error("Already claimed today.");
          setCanClaim(false);
          return;
        }
      } catch {}

      // ── Signature ────────────────────────────────────────────────────────
      toast.loading("Generating secure signature...", { id: "claim-tx" });
      const sigRes = await fetch(`${API_BASE_URL}/api/droplist/generate-signature`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: address, chainId: CELO_CHAIN_ID }),
      });
      const sigData = await sigRes.json();
      if (!sigRes.ok) throw new Error(sigData?.detail || "Failed to generate signature");

      const { amount, timestamp, signature } = sigData;
      if (amount == null)    throw new Error("Server returned missing 'amount'.");
      if (timestamp == null) throw new Error("Server returned missing 'timestamp'.");
      if (!signature || signature.length < 10) throw new Error("Server returned invalid signature.");

      const sig = signature.startsWith("0x") ? signature : `0x${signature}`;
      if (!/^0x[0-9a-fA-F]{130}$/.test(sig))
        throw new Error(`Malformed signature (length ${sig.length}, expected 132).`);

      // ── Send tx ──────────────────────────────────────────────────────────
      toast.loading("Sending transaction...", { id: "claim-tx" });
      const contract = new Contract(CELO.contract, POINTS_ABI, activeSigner);
      const tx = await contract.claim(BigInt(amount), BigInt(timestamp), sig, { from: address });

      toast.loading("Confirming on-chain...", { id: "claim-tx" });
      receipt = await tx.wait();

      // ── Verify ───────────────────────────────────────────────────────────
      toast.loading("Verifying proof...", { id: "claim-tx" });
      try {
        await verifyWithRetry(receipt.hash, address);
      } catch (verifyErr: any) {
        console.warn("[DropPoints] Verify failed but tx confirmed:", verifyErr);
        toast.warning("Claimed! Balance will update shortly.", { id: "claim-tx" });
      }

      setClaimBurst(true);
      setTimeout(() => setClaimBurst(false), 800);

      try {
        const block = await getProvider().getBlock(receipt.blockNumber);
        setLastClaimAt(
          block ? new Date(block.timestamp * 1000).toISOString() : new Date().toISOString()
        );
      } catch {
        setLastClaimAt(new Date().toISOString());
      }

      fetchBalance(address);
      fetchHistory(true);
      toast.success("Drop Points claimed! 🎉", { id: "claim-tx" });

    } catch (error: any) {
      const msg: string = error?.reason || error?.message || "Claim failed";
      if (msg.toLowerCase().includes("user rejected") || error?.code === 4001) {
        toast.error("Transaction cancelled.", { id: "claim-tx" });
      } else if (msg.toLowerCase().includes("cooldown") || msg.toLowerCase().includes("already used")) {
        toast.error("Already claimed today.", { id: "claim-tx" });
        setCanClaim(false);
      } else {
        toast.error(msg, { id: "claim-tx" });
        console.error("[DropPoints] Claim error:", error);
      }
    } finally {
      setIsClaiming(false);
      claimLockRef.current = false;
    }
  };

  // ── Claim button label ────────────────────────────────────────────────────

  const claimLabel = () => {
    if (isClaiming)   return <><Loader2 size={14} className="animate-spin" /> Processing</>;
    if (!isConnected) return <><Zap size={14} /> Connect Wallet to Claim</>;
    if (!onCelo)      return <><AlertCircle size={14} /> Switch to Celo</>;
    if (!canClaim)    return <><Clock size={14} /> {formatCountdown(remainingMs)}</>;
    return <><Zap size={14} /> Claim Daily Drop Points</>;
  };

  const claimDisabled = isClaiming || !canClaim || !isConnected || !onCelo;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Floating trigger ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {showTrigger && !isOpen && (
          <motion.button
            id="claim-points"
            onClick={() => setIsOpen(true)}
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={`fixed bottom-5 right-5 z-[90] flex items-center gap-2 pl-2 pr-4 py-2 rounded-full
              shadow-lg border transition-colors ${
                canClaim
                  ? "bg-primary text-primary-foreground border-primary/50 shadow-primary/30"
                  : "bg-card text-foreground border-border"
              }`}
          >
            <span className="relative w-7 h-7 shrink-0">
              <Image src="/drop-token.png" alt="Drop" fill className="object-contain" />
            </span>
            <span className="text-xs font-bold tabular-nums">
              {!isConnected || canClaim ? "Claim Drop" : formatCountdown(remainingMs)}
            </span>
            {canClaim && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-background" />
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Popup ─────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
              initial={{ opacity: 0, y: 30, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.97 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="w-full max-w-[380px] max-h-[88vh] overflow-y-auto bg-card border border-border rounded-2xl shadow-2xl flex flex-col"
            >
              {/* Header */}
              <div className="px-5 pt-5 pb-4 border-b border-border bg-gradient-to-br from-card to-accent/20 dark:to-accent/5">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    Drop Points
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[9px] font-bold px-2 py-0.5 rounded-full border"
                      style={{
                        color: CELO.color,
                        borderColor: `${CELO.color}55`,
                        background: `${CELO.color}15`,
                      }}
                    >
                      {CELO.name}
                    </span>
                    {address && (
                      <button
                        onClick={() => {
                          fetchBalance(address);
                          fetchCooldown(address);
                        }}
                        className="p-1 rounded-md hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                        title="Refresh"
                      >
                        <RefreshCw size={12} />
                      </button>
                    )}
                    <button
                      onClick={() => setIsOpen(false)}
                      className="p-1 rounded-md hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                      title="Close"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>

                {/* Balance */}
                <div className="flex items-center gap-3 mb-5">
                  <div className="relative w-12 h-12 shrink-0">
                    <Image
                      src="/drop-token.png"
                      alt="Drop"
                      fill
                      className="object-contain drop-shadow-md"
                    />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground font-semibold">
                      Total Drop Points
                    </p>
                    {address && balanceLoading ? (
                      <div className="flex items-center gap-1.5 mt-1">
                        <Loader2 size={14} className="animate-spin text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Loading...</span>
                      </div>
                    ) : balanceError ? (
                      <span className="flex items-center gap-1 text-xs text-red-400 mt-1">
                        <AlertCircle size={11} /> Couldn't reach Celo
                      </span>
                    ) : (
                      <motion.p
                        key={balance}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-3xl font-black tracking-tight tabular-nums"
                      >
                        {address
                          ? balance.toLocaleString(undefined, { maximumFractionDigits: 2 })
                          : "—"}
                      </motion.p>
                    )}
                  </div>
                </div>

                {/* Claim button */}
                <div className="relative">
                  <ClaimBurst trigger={claimBurst} />
                  <motion.button
                    onClick={handleClaim}
                    disabled={claimDisabled}
                    whileTap={{ scale: 0.97 }}
                    className={`w-full py-3 rounded-xl font-bold text-xs transition-all duration-200 flex items-center justify-center gap-2 ${
                      claimDisabled && !isClaiming
                        ? "bg-accent text-muted-foreground cursor-not-allowed border border-border"
                        : isClaiming
                        ? "bg-primary/80 text-primary-foreground cursor-wait"
                        : "bg-primary text-primary-foreground hover:opacity-90 shadow-md hover:shadow-primary/30"
                    }`}
                  >
                    {claimLabel()}
                  </motion.button>
                </div>

                {/* Redeem Drop */}
                <button
                  onClick={() => {
                    setIsOpen(false);
                    router.push("/support");
                  }}
                  className="mt-3 w-full group flex items-center gap-3 px-4 py-3
                    rounded-xl border border-border/40 bg-accent/20 text-left
                    hover:bg-accent/40 hover:border-primary/40 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-accent border border-border/50
                    flex items-center justify-center shrink-0">
                    <ShoppingBag size={14} className="text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[11px] font-bold text-foreground leading-none mb-0.5">
                      Redeem Drop
                    </p>
                    <p className="text-[10px] text-muted-foreground leading-none">
                      See how to turn DROP points into rewards
                    </p>
                  </div>
                  <ChevronRight size={14} className="text-muted-foreground group-hover:text-foreground shrink-0" />
                </button>
              </div>

              {/* ── History ───────────────────────────────────────────────── */}
              <button
                onClick={() => setHistoryExpanded((v) => !v)}
                className="flex items-center justify-between px-5 py-3 border-b border-border text-[11px] font-bold text-muted-foreground hover:text-foreground transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <History size={13} /> Claim History
                  {history.length > 0 && (
                    <span className="text-[10px] font-normal">({history.length})</span>
                  )}
                </span>
                <motion.div
                  animate={{ rotate: historyExpanded ? 0 : 180 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                >
                  <ChevronDown size={14} />
                </motion.div>
              </button>

              <motion.div
                animate={historyExpanded ? "open" : "closed"}
                variants={{
                  open:   { height: "auto", opacity: 1 },
                  closed: { height: 0,      opacity: 0 },
                }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                style={{ overflow: "hidden" }}
              >
                <div className="p-4 space-y-2 overflow-y-auto max-h-[300px]">
                  {historyLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="h-14 rounded-xl bg-accent animate-pulse" />
                    ))
                  ) : history.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
                      <History size={28} strokeWidth={1.5} />
                      <p className="text-xs">No claims yet</p>
                    </div>
                  ) : (
                    history.map((entry, i) => {
                      const date = new Date(entry.timestamp);
                      return (
                        <div
                          key={i}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-accent/30 dark:bg-accent/10 border border-border/50 group"
                        >
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ background: CELO.color }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold">
                              +{entry.amount.toLocaleString()} pts
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {date.toLocaleDateString()} · {date.toLocaleTimeString()}
                            </p>
                          </div>
                          {entry.tx_hash && (
                            <a
                              href={`${CELO.explorer}${entry.tx_hash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <ExternalLink
                                size={12}
                                className="text-muted-foreground hover:text-foreground"
                              />
                            </a>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}