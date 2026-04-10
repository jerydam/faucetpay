"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Contract, JsonRpcProvider, formatUnits } from "ethers";
import {
  Droplets,
  History,
  Clock,
  Zap,
  Loader2,
  ExternalLink,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useWallet } from "@/hooks/use-wallet";
import Image from "next/image";

// ─── Chain config ─────────────────────────────────────────────────────────────

const CHAIN_CONFIG: Record<
  number,
  { name: string; color: string; explorer: string; rpc: string; contract: string }
> = {
  42220: {
    name: "Celo",
    color: "#FCFF52",
    explorer: "https://celoscan.io/tx/",
    rpc: "https://forno.celo.org",
    contract: "0xF8F6D74E61A0FC2dd2feCd41dE384ba2fbf91b9D",
  },
  8453: {
    name: "Base",
    color: "#0052FF",
    explorer: "https://basescan.org/tx/",
    rpc: "https://mainnet.base.org",
    contract: "0x42fcB7C4D4a36D772c430ee8C7d026f627365BcB",
  },
  56: {
    name: "BNB",
    color: "#F3BA2F",
    explorer: "https://bscscan.com/tx/",
    rpc: "https://bsc-dataseed.binance.org",
    contract: "0x4C603fe32fe590D8A47B7f23b027dc24C2c762B1",
  },
  1135: {
    name: "Lisk",
    color: "#4A90D9",
    explorer: "https://blockscout.lisk.com/tx/",
    rpc: "https://rpc.api.lisk.com",
    contract: "0x28B9DAB4Fd2CD9bF1A4773dB858e03Ee178AE075",
  },
  42161: {
    name: "Arbitrum",
    color: "#28A0F0",
    explorer: "https://arbiscan.io/tx/",
    rpc: "https://arb1.arbitrum.io/rpc",
    contract: "0xEcb026D22f9aA7FD9Aa83B509834dB8Fd66B27F6",
  },
};



const CHAIN_IDS = Object.keys(CHAIN_CONFIG).map(Number);

const API_BASE_URL = "https://identical-vivi-faucetdrops-41e9c56b.koyeb.app";

// ─── ABI ──────────────────────────────────────────────────────────────────────

const POINTS_ABI = [
  "function claim(uint256 amount, uint256 timestamp, bytes signature) external",
  "function canClaim(address user) view returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
];

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "overview" | "history";

interface ChainBalance {
  chainId: number;
  balance: number;
  loading: boolean;
  error: boolean;
}

interface ClaimEntry {
  timestamp: string;
  amount: number;
  chain_id: number;
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

const providerCache: Record<number, JsonRpcProvider> = {};
function getProvider(chainId: number): JsonRpcProvider {
  if (!providerCache[chainId]) {
    providerCache[chainId] = new JsonRpcProvider(CHAIN_CONFIG[chainId].rpc);
  }
  return providerCache[chainId];
}

async function verifyWithRetry(
  txHash: string,
  chainId: number,
  address: string,
  attempts = 3
): Promise<any> {
  for (let i = 0; i < attempts; i++) {
    try {
      const verifyRes = await fetch(`${API_BASE_URL}/api/droplist/verify-claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash, chainId, walletAddress: address }),
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

const HISTORY_CACHE_KEY = (addr: string) => `drop_history_${addr.toLowerCase()}`;
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
                background: i % 2 === 0 ? "hsl(var(--primary))" : "#FCFF52",
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

// ─── Block lookback per chain ─────────────────────────────────────────────────

const BLOCK_LOOKBACK: Record<number, number> = {
  42220: 1_000_000,
  8453: 2_000_000,
  56: 3_000_000,
  1135: 500_000,
  42161: 15_000_000,
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DropPointsPanel() {
  const { address, isConnected, signer, chainId } = useWallet();

  const [activeTab, setActiveTab]     = useState<Tab>("overview");
  const [isClaiming, setIsClaiming]   = useState(false);
  const [claimBurst, setClaimBurst]   = useState(false);
  const [lastClaimAt, setLastClaimAt] = useState<string | null>(null);
  const [canClaim, setCanClaim]       = useState(true);
  const [remainingMs, setRemainingMs] = useState(0);

  const [chainBalances, setChainBalances] = useState<ChainBalance[]>(
    CHAIN_IDS.map((id) => ({ chainId: id, balance: 0, loading: true, error: false }))
  );

  const [history, setHistory]               = useState<ClaimEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const claimLockRef = useRef(false);

  const totalPoints = chainBalances.reduce((sum, c) => sum + c.balance, 0);
  const allLoaded   = chainBalances.every((c) => !c.loading);
  const maxBalance  = Math.max(...chainBalances.map((c) => c.balance), 1);

  // ── Cooldown from contract (connected chain only) ─────────────────────────

  const fetchCooldownFromContract = useCallback(async (addr: string, cId: number) => {
    const cfg = CHAIN_CONFIG[cId];
    if (!cfg) return;

    const provider = getProvider(cId);
    const contract = new Contract(cfg.contract, POINTS_ABI, provider);

    try {
      // 1. Ask the contract directly
      const eligible: boolean = await contract.canClaim(addr);
      if (eligible) {
        setCanClaim(true);
        setRemainingMs(0);
        setLastClaimAt(null);
        return;
      }

      // 2. On cooldown — find the last mint Transfer for the exact timestamp
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
        if (block) {
          setLastClaimAt(new Date(block.timestamp * 1000).toISOString());
          return;
        }
      }

      // 3. canClaim=false but no log found in window — safe fallback
      setLastClaimAt(new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString());
    } catch (err) {
      console.warn("Cooldown fetch failed:", err);
    }
  }, []);

  // ── Chain balances (all chains, no cooldown logic here) ───────────────────

  const fetchChainData = useCallback(async (addr: string) => {
    setChainBalances(
      CHAIN_IDS.map((id) => ({ chainId: id, balance: 0, loading: true, error: false }))
    );

    await Promise.allSettled(
      CHAIN_IDS.map(async (id) => {
        const cfg = CHAIN_CONFIG[id];
        const provider = getProvider(id);
        const contract = new Contract(cfg.contract, POINTS_ABI, provider);

        try {
          const [raw, dec]: [bigint, number] = await Promise.all([
            contract.balanceOf(addr),
            contract.decimals(),
          ]);
          const balance = parseFloat(formatUnits(raw, dec));
          setChainBalances((prev) =>
            prev.map((c) =>
              c.chainId === id
                ? { chainId: id, balance, loading: false, error: false }
                : c
            )
          );
        } catch {
          setChainBalances((prev) =>
            prev.map((c) =>
              c.chainId === id ? { ...c, loading: false, error: true } : c
            )
          );
        }
      })
    );
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
        const allClaims: ClaimEntry[] = [];

        await Promise.allSettled(
          CHAIN_IDS.map(async (id) => {
            try {
              const cfg = CHAIN_CONFIG[id];
              const provider = getProvider(id);
              const contract = new Contract(cfg.contract, POINTS_ABI, provider);

              const filter = contract.filters.Transfer(
                "0x0000000000000000000000000000000000000000",
                address
              );

              const currentBlock = await provider.getBlockNumber();
              const lookback = BLOCK_LOOKBACK[id] ?? 100_000;
              const fromBlock = Math.max(0, currentBlock - lookback);

              const CHUNK = 100_000;
              const chunks: { from: number; to: number }[] = [];
              for (let start = fromBlock; start < currentBlock; start += CHUNK) {
                chunks.push({ from: start, to: Math.min(start + CHUNK - 1, currentBlock) });
              }

              const logs: any[] = [];
              for (const chunk of chunks) {
                try {
                  const chunkLogs = await contract.queryFilter(filter, chunk.from, chunk.to);
                  logs.push(...chunkLogs);
                } catch {}
              }

              if (logs.length === 0) return;

              const blockCache: Record<number, number> = {};
              const decimals: number = await contract.decimals().catch(() => 18);

              const uniqueBlocks = [...new Set(logs.map((l: any) => l.blockNumber))];
              await Promise.allSettled(
                uniqueBlocks.map(async (bn) => {
                  const block = await provider.getBlock(bn);
                  blockCache[bn] = block?.timestamp ?? Math.floor(Date.now() / 1000);
                })
              );

              for (const log of logs) {
                const parsedLog = log as any;
                allClaims.push({
                  chain_id: id,
                  tx_hash: parsedLog.transactionHash,
                  amount: parseFloat(
                    formatUnits(parsedLog.args[2] ?? parsedLog.args.value, decimals)
                  ),
                  timestamp: new Date(
                    (blockCache[parsedLog.blockNumber] ?? Math.floor(Date.now() / 1000)) * 1000
                  ).toISOString(),
                });
              }
            } catch (chainErr) {
              console.warn(`History fetch failed for chain ${id}:`, chainErr);
            }
          })
        );

        allClaims.sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        setHistory(allClaims);
        saveHistoryCache(address, allClaims);
      } catch (e) {
        console.error("Error fetching on-chain history:", e);
        toast.error("Failed to load on-chain history.");
      } finally {
        setHistoryLoading(false);
      }
    },
    [address]
  );

  // ── Post-claim refresh ────────────────────────────────────────────────────

  const refreshAllPostClaim = useCallback(
    async (verifyData: any, receipt: any, claimedChainId: number) => {
      if (verifyData?.chain_balances?.length) {
        setChainBalances((prev) =>
          prev.map((c) => {
            const match = verifyData.chain_balances.find(
              (r: any) => r.chain_id === c.chainId
            );
            if (!match) return c;
            return {
              chainId: c.chainId,
              balance: match.balance ?? c.balance,
              loading: false,
              error: !!match.error,
            };
          })
        );
      }

      if (receipt?.blockNumber) {
        try {
          const provider = getProvider(claimedChainId);
          const block = await provider.getBlock(receipt.blockNumber);
          setLastClaimAt(
            block
              ? new Date(block.timestamp * 1000).toISOString()
              : (verifyData?.last_claim_at ?? new Date().toISOString())
          );
        } catch {
          setLastClaimAt(verifyData?.last_claim_at ?? new Date().toISOString());
        }
      } else {
        setLastClaimAt(verifyData?.last_claim_at ?? new Date().toISOString());
      }

      Promise.allSettled([fetchHistory()]);
    },
    [fetchHistory]
  );

  // ── Effects ───────────────────────────────────────────────────────────────

  // Balances + cooldown whenever wallet or chain changes
  useEffect(() => {
    if (!address || !chainId) return;
    fetchChainData(address);
    fetchCooldownFromContract(address, chainId);
  }, [address, chainId, fetchChainData, fetchCooldownFromContract]);

  // History prefetch on wallet connect
  useEffect(() => {
    if (!address) return;
    const cached = loadHistoryCache(address);
    if (cached) setHistory(cached);
    const timer = setTimeout(() => fetchHistory(false), 2000);
    return () => clearTimeout(timer);
  }, [address]);

  // History tab — only fetch if nothing loaded yet
  useEffect(() => {
    if (activeTab !== "history") return;
    if (history.length > 0) return;
    fetchHistory(false);
  }, [activeTab]);

  // Countdown tick
  useEffect(() => {
    if (!lastClaimAt) {
      setCanClaim(true);
      setRemainingMs(0);
      return;
    }
    const COOLDOWN = 24 * 60 * 60 * 1000;
    const tick = () => {
      const rem = COOLDOWN - (Date.now() - new Date(lastClaimAt).getTime());
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

  // ── Claim ─────────────────────────────────────────────────────────────────

  const handleClaim = async () => {
    if (!canClaim)    { toast.error(`Come back in ${formatCountdown(remainingMs)}`); return; }
    if (!isConnected) { toast.warning("Connect your wallet first."); return; }
    if (!address || !signer || !chainId) { toast.warning("Wallet not ready."); return; }

    const cfg = CHAIN_CONFIG[chainId];
    if (!cfg) { toast.error("Drop Points not supported on this network."); return; }
    if (claimLockRef.current) return;

    claimLockRef.current = true;
    setIsClaiming(true);

    let receipt: any = null;

    try {
      // 1. On-chain canClaim check
      try {
        const provider = getProvider(chainId);
        const readOnly = new Contract(cfg.contract, POINTS_ABI, provider);
        const eligible: boolean = await readOnly.canClaim(address);
        if (!eligible) {
          toast.error("Already claimed today.");
          setCanClaim(false);
          return;
        }
      } catch {}

      // 2. Get signature from backend
      toast.loading("Generating secure signature...", { id: "claim-tx" });
      const sigRes = await fetch(`${API_BASE_URL}/api/droplist/generate-signature`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: address, chainId }),
      });
      const sigData = await sigRes.json();
      if (!sigRes.ok) throw new Error(sigData?.detail || "Failed to generate signature");

      const { amount, timestamp, signature } = sigData;

      if (amount === undefined || amount === null)
        throw new Error("Server returned missing 'amount'.");
      if (timestamp === undefined || timestamp === null)
        throw new Error("Server returned missing 'timestamp'.");
      if (!signature || typeof signature !== "string" || signature.length < 10)
        throw new Error("Server returned invalid signature.");

      const sig = signature.startsWith("0x") ? signature : `0x${signature}`;
      if (!/^0x[0-9a-fA-F]{130}$/.test(sig))
        throw new Error(`Malformed signature (length ${sig.length}, expected 132).`);

      // 3. Send transaction
      toast.loading("Awaiting wallet confirmation...", { id: "claim-tx" });
      const contract = new Contract(cfg.contract, POINTS_ABI, signer);
      const tx = await contract.claim(BigInt(amount), BigInt(timestamp), sig, { from: address });

      // 4. Wait for confirmation
      toast.loading("Confirming on-chain...", { id: "claim-tx" });
      receipt = await tx.wait();

      // 5. Verify with backend
      toast.loading("Verifying proof...", { id: "claim-tx" });
      try {
        const verifyData = await verifyWithRetry(receipt.hash, chainId, address);
        await refreshAllPostClaim(verifyData, receipt, chainId);
      } catch (verifyErr: any) {
        console.warn("[DropPoints] Verify failed but tx confirmed:", verifyErr);
        toast.warning("Claimed! Balance will update shortly.", { id: "claim-tx" });
        setClaimBurst(true);
        setTimeout(() => setClaimBurst(false), 800);
        if (receipt?.blockNumber) {
          try {
            const provider = getProvider(chainId);
            const block = await provider.getBlock(receipt.blockNumber);
            setLastClaimAt(
              block ? new Date(block.timestamp * 1000).toISOString() : new Date().toISOString()
            );
          } catch {
            setLastClaimAt(new Date().toISOString());
          }
        } else {
          setLastClaimAt(new Date().toISOString());
        }
        fetchChainData(address);
        Promise.allSettled([fetchHistory()]);
        return;
      }

      // 6. Success
      toast.success("Drop Points claimed! 🎉", { id: "claim-tx" });
      setClaimBurst(true);
      setTimeout(() => setClaimBurst(false), 800);
    } catch (error: any) {
      const msg: string = error?.reason || error?.message || "Claim failed";
      if (msg.toLowerCase().includes("user rejected") || error?.code === 4001) {
        toast.error("Transaction cancelled.", { id: "claim-tx" });
      } else if (
        msg.toLowerCase().includes("cooldown") ||
        msg.toLowerCase().includes("already used")
      ) {
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

  // ── Tabs ──────────────────────────────────────────────────────────────────

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Overview", icon: <Droplets size={13} /> },
    { id: "history",  label: "History",  icon: <History size={13} /> },
  ];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      id="claim-points"
      className="w-full lg:w-[360px] bg-card border border-border rounded-2xl overflow-hidden shadow-sm flex flex-col"
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-border bg-gradient-to-br from-card to-accent/20 dark:to-accent/5">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            Drop Points
          </span>
          <div className="flex items-center gap-2">
            {isConnected && chainId && CHAIN_CONFIG[chainId] && (
              <span
                className="text-[9px] font-bold px-2 py-0.5 rounded-full border"
                style={{
                  color: CHAIN_CONFIG[chainId].color,
                  borderColor: `${CHAIN_CONFIG[chainId].color}55`,
                  background: `${CHAIN_CONFIG[chainId].color}15`,
                }}
              >
                {CHAIN_CONFIG[chainId].name}
              </span>
            )}
            {address && (
              <button
                onClick={() => {
                  fetchChainData(address);
                  if (chainId) fetchCooldownFromContract(address, chainId);
                }}
                className="p-1 rounded-md hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                title="Refresh"
              >
                <RefreshCw size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Total balance */}
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
              Total Earned (All Chains)
            </p>
            {!allLoaded && address ? (
              <div className="flex items-center gap-1.5 mt-1">
                <Loader2 size={14} className="animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Loading...</span>
              </div>
            ) : (
              <motion.p
                key={totalPoints}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-3xl font-black tracking-tight tabular-nums"
              >
                {address
                  ? totalPoints.toLocaleString(undefined, { maximumFractionDigits: 2 })
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
            disabled={isClaiming || !canClaim || !isConnected}
            whileTap={{ scale: 0.97 }}
            className={`w-full py-3 rounded-xl font-bold text-xs transition-all duration-200 flex items-center justify-center gap-2 ${
              !isConnected || !canClaim
                ? "bg-accent text-muted-foreground cursor-not-allowed border border-border"
                : isClaiming
                ? "bg-primary/80 text-primary-foreground cursor-wait"
                : "bg-primary text-primary-foreground hover:opacity-90 shadow-md hover:shadow-primary/30"
            }`}
          >
            {isClaiming ? (
              <><Loader2 size={14} className="animate-spin" /> Processing</>
            ) : !isConnected ? (
              <><Zap size={14} /> Connect Wallet to Claim</>
            ) : !canClaim ? (
              <><Clock size={14} /> {formatCountdown(remainingMs)}</>
            ) : (
              <><Zap size={14} /> Claim Daily Drop Points</>
            )}
          </motion.button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-[11px] font-bold transition-colors ${
              activeTab === tab.id
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.15 }}
          className="flex-1 overflow-y-auto max-h-[340px]"
        >
          {/* Overview */}
          {activeTab === "overview" && (
            <div className="p-4 space-y-2.5">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1 mb-3">
                On-chain Balance per Network
              </p>
              {chainBalances.map(({ chainId: id, balance, loading, error }) => {
                const cfg = CHAIN_CONFIG[id];
                const pct = Math.round((balance / maxBalance) * 100);
                return (
                  <div
                    key={id}
                    className="bg-accent/30 dark:bg-accent/10 rounded-xl px-4 py-3 border border-border/50"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ background: cfg.color }}
                        />
                        <span className="text-xs font-semibold">{cfg.name}</span>
                      </div>
                      {loading ? (
                        <div className="h-3.5 w-16 rounded bg-accent animate-pulse" />
                      ) : error ? (
                        <span className="flex items-center gap-1 text-[10px] text-red-400">
                          <AlertCircle size={10} /> RPC error
                        </span>
                      ) : (
                        <span className="text-xs font-black tabular-nums">
                          {balance.toLocaleString(undefined, { maximumFractionDigits: 2 })} pts
                        </span>
                      )}
                    </div>
                    <div className="h-1 w-full bg-border rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: cfg.color }}
                        initial={{ width: 0 }}
                        animate={{ width: loading ? "0%" : `${pct}%` }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* History */}
          {activeTab === "history" && (
            <div className="p-4 space-y-2">
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
                  const cfg = CHAIN_CONFIG[entry.chain_id];
                  const date = new Date(entry.timestamp);
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-accent/30 dark:bg-accent/10 border border-border/50 group"
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: cfg?.color ?? "#888" }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold">
                          +{entry.amount.toLocaleString()} pts
                          <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">
                            {cfg?.name}
                          </span>
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {date.toLocaleDateString()} · {date.toLocaleTimeString()}
                        </p>
                      </div>
                      {cfg && entry.tx_hash && (
                        <a
                          href={`${cfg.explorer}${entry.tx_hash}`}
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
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}