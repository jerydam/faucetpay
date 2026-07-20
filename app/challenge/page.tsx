"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/hooks/use-wallet";
import { Header } from "@/components/header";
import {
   Plus, Trophy, Loader2, Gamepad2,
   RefreshCw, ChevronRight, Zap, Gift, CheckCircle2, Swords,
   HelpCircle,} from "lucide-react";
import { toast } from "sonner";
import Loading from "@/app/loading";
import { BottomNav } from "@/components/bottom-nav";
import { ethers } from "ethers";
import { REDEEM_ABI } from "@/lib/abis";
import { getChainConfig, CELO_CHAIN_ID} from "@/lib/chain";
import { sendTagged } from "@/lib/attribution-tag";
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://conscious-adorne-faucetdrops-fc77a861.koyeb.app";
const DROP_TOKEN_CONTRACT = "0x213DF7A728E545BdAff8ff8c4BF9cFD7359Def0B";

interface LobbyChallenge {
  code: string; topic: string; stake_amount: number; token_symbol: string;
  chain_id: number; created_at: string; creator_username: string;
  tx_hash?: string | null;  // ← add this
}
interface HistoryChallenge {
  code: string; topic: string; stake_amount: number; token_symbol: string;
  status: "waiting" | "active" | "finished"; winner_address: string | null;
  created_at: string; finished_at: string | null;
}
interface DropsBalance {
  gameDrops: number; rewardDrops: number; tier: string;
  totalDuels: number; rematchBadge: boolean; gamesUntilBadge: number;
  alreadyMinted?: boolean;
}

const fmt = (n: number) => n % 1 === 0 ? n.toString() : n.toFixed(n < 1 ? 2 : 1);
function timeAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (d < 60) return `${d}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}

const TIER_COLOR: Record<string, string> = {
  Flood: "#6366f1", Torrent: "#8b5cf6", Downpour: "#3b82f6",
  Drizzle: "#06b6d4", Droplet: "#64748b",
};

const S = `
  @import url('https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;900&family=Figtree:wght@400;500;600;700;800&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  :root{--dd-bg:#ffffff;--dd-surface:rgba(0,0,0,0.02);--dd-text:#0f172a;--dd-text-dim:rgba(15,23,42,0.45);--dd-text-mute:rgba(15,23,42,0.25);--dd-line:rgba(15,23,42,0.08);--dd-line-soft:rgba(15,23,42,0.05);--dd-blue:#2563eb;--dd-blue2:#1d4ed8;--dd-blue-bg:rgba(37,99,235,0.10);--dd-card-border:rgba(15,23,42,0.08)}
  .dark{--dd-bg:#020617;--dd-surface:rgba(255,255,255,0.02);--dd-text:#ffffff;--dd-text-dim:rgba(255,255,255,0.45);--dd-text-mute:rgba(255,255,255,0.25);--dd-line:rgba(255,255,255,0.07);--dd-line-soft:rgba(255,255,255,0.05);--dd-blue-bg:rgba(37,99,235,0.15);--dd-card-border:rgba(255,255,255,0.08)}
  .dd-page{background:var(--dd-bg);color:var(--dd-text);font-family:'Figtree',sans-serif;transition:background .25s,color .25s}
  .d{font-family:'Big Shoulders Display',sans-serif}
  .dd-card{border:1px solid var(--dd-card-border);border-radius:16px;background:var(--dd-surface)}
  .btn-blue{background:var(--dd-blue);color:#fff;border:none;cursor:pointer;font-family:'Figtree',sans-serif;font-weight:700;transition:background .2s,transform .15s;display:flex;align-items:center;justify-content:center;gap:8px}
  .btn-blue:hover{background:var(--dd-blue2)}.btn-blue:active{transform:scale(.97)}
  .btn-ghost{background:transparent;border:1.5px solid var(--dd-line);cursor:pointer;font-family:'Figtree',sans-serif;font-weight:700;color:var(--dd-text);transition:border-color .2s,background .2s,transform .15s;display:flex;align-items:center;justify-content:center;gap:8px}
  .btn-ghost:hover{border-color:rgba(37,99,235,.5);background:rgba(37,99,235,.06)}.btn-ghost:active{transform:scale(.97)}
  .lobby-card{border:1.5px solid var(--dd-card-border);border-radius:14px;background:var(--dd-surface);transition:border-color .2s,transform .15s;cursor:pointer}
  .lobby-card:hover{border-color:var(--dd-blue);transform:translateY(-2px)}
  .lobby-card:active{transform:scale(.98)}
  .history-row{transition:border-color .15s}.history-row:active{transform:scale(.99)}
  .register-banner{background:linear-gradient(135deg,var(--dd-blue),var(--dd-blue2));border-radius:16px;overflow:hidden;animation:slideDown 0.4s ease-out}
  @keyframes slideDown{from{opacity:0;transform:translateY(-12px)}to{opacity:1;transform:translateY(0)}}
  @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
  .spin{animation:spin 1s linear infinite}
  .drops-pill{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:800;font-family:'Figtree',sans-serif}
  @keyframes confettiFall {
    0%   { transform: translateY(-10px) rotate(0deg);   opacity: 1; }
    100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
  }

  @keyframes dangerBlink {
  0%, 100% { background: rgba(239,68,68,0.12); border-color: rgba(239,68,68,0.9); color: #ef4444; box-shadow: 0 0 0px rgba(239,68,68,0); }
  50%      { background: rgba(239,68,68,0.35); border-color: #ef4444; color: #fff; box-shadow: 0 0 14px 3px rgba(239,68,68,0.6); }
}
.danger-blink {
  animation: dangerBlink 1s ease-in-out infinite;
  font-weight: 900 !important;
}
  @keyframes popIn {
    0%   { transform: scale(0.4) translateY(60px); opacity: 0; }
    70%  { transform: scale(1.06) translateY(-8px); }
    100% { transform: scale(1) translateY(0);       opacity: 1; }
  }
  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50%       { transform: translateY(-8px); }
  }
  @keyframes checkinGlow {
    0%,100% { box-shadow: 0 0 8px 2px rgba(37,99,235,0.4), 0 0 0px rgba(37,99,235,0); border-color: rgba(37,99,235,0.5); }
    50%      { box-shadow: 0 0 18px 6px rgba(37,99,235,0.9), 0 0 32px 8px rgba(99,102,241,0.4); border-color: rgba(99,102,241,0.9); }
  }

  @keyframes dangerGlow {
  0%,100% { box-shadow: 0 0 8px 2px rgba(239,68,68,0.4), 0 0 0px rgba(239,68,68,0); border-color: rgba(239,68,68,0.6); }
  50%      { box-shadow: 0 0 18px 6px rgba(239,68,68,0.9), 0 0 32px 8px rgba(220,38,38,0.4); border-color: #ef4444; }
}
@keyframes dangerPulseText {
  0%,100% { opacity: 1; }
  50%      { opacity: 0.65; }
}
.danger-btn-glow {
  animation: dangerGlow 1.4s ease-in-out infinite;
  border: 1.5px solid rgba(239,68,68,0.6) !important;
  background: rgba(239,68,68,0.1) !important;
  color: #ef4444 !important;
  position: relative;
  overflow: hidden;
}
.danger-btn-glow::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
  transform: translateX(-100%);
  animation: shimmer 1.6s infinite;
}
  @keyframes checkinPulseText {
    0%,100% { opacity: 1; }
    50%      { opacity: 0.7; }
  }
  .checkin-btn-glow {
    animation: checkinGlow 1.8s ease-in-out infinite;
    border: 1.5px solid rgba(37,99,235,0.5) !important;
    position: relative;
    overflow: hidden;
  }
  .checkin-btn-glow::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
    transform: translateX(-100%);
    animation: shimmer 2s infinite;
  }
  @keyframes shimmer {
    100% { transform: translateX(100%); }
  }
  @keyframes partyBounce {
    0%,100% { transform: scale(1) rotate(-5deg); }
    25%     { transform: scale(1.2) rotate(5deg); }
    50%     { transform: scale(0.95) rotate(-3deg); }
    75%     { transform: scale(1.1) rotate(4deg); }
  }
  @keyframes bgPulse {
    0%,100% { background-position: 0% 50%; }
    50%      { background-position: 100% 50%; }
  }
  @keyframes ringPulse {
    0%   { transform: scale(0.8); opacity: 0.8; }
    100% { transform: scale(2.2); opacity: 0; }
  }
  @keyframes textShine {
    0%   { background-position: -200% center; }
    100% { background-position: 200% center; }
  }
  @keyframes sheetUp {
    from { transform: translateY(24px); opacity: 0; }
    to   { transform: translateY(0);    opacity: 1; }
  }

  .checkin-popup { animation: popIn 0.55s cubic-bezier(0.34,1.56,0.64,1) forwards; }
  .party-icon { animation: partyBounce 0.6s ease-in-out infinite; display: inline-block; }
  .confetti-piece { position: absolute; animation: confettiFall linear forwards; pointer-events: none; }
  .shine-text {
    background: linear-gradient(90deg, #fff 0%, #a5b4fc 30%, #fff 50%, #fbbf24 70%, #fff 100%);
    background-size: 200% auto;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    animation: textShine 2s linear infinite;
  }
  .ring {
    position: absolute;
    border-radius: 50%;
    border: 3px solid rgba(99,102,241,0.6);
    animation: ringPulse 1.5s ease-out infinite;
  }
  .create-sheet { animation: sheetUp 0.25s cubic-bezier(0.34,1.56,0.64,1) forwards; }
  .create-choice-card { transition: border-color .15s, transform .15s, background .15s; cursor: pointer; }
  .create-choice-card:hover { border-color: var(--dd-blue); background: var(--dd-blue-bg); }
  .create-choice-card:active { transform: scale(.97); }
`;

/** Popup shown when tapping "Create" — choose 1v1 duel vs. solo-vs-bot. */
function CreateChoiceModal({
  onPickDuel, onPickSolo, onClose,
}: { onPickDuel: () => void; onPickSolo: () => void; onClose: () => void }) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        padding: "0", background: "rgba(2,6,23,0.6)", backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        className="create-sheet dd-page"
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 480, borderRadius: "20px 20px 0 0",
          padding: "14px 20px 28px", border: "1px solid var(--dd-card-border)",
          borderBottom: "none",
        }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 99, background: "var(--dd-line)", margin: "0 auto 18px" }} />
        <h2 className="d" style={{ fontSize: 20, fontWeight: 900, color: "var(--dd-text)", textAlign: "center", marginBottom: 2 }}>
          Start a Challenge
        </h2>
        <p style={{ fontSize: 12, color: "var(--dd-text-mute)", textAlign: "center", marginBottom: 18 }}>
          Pick who you want to face.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <button
            className="create-choice-card"
            onClick={onPickDuel}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
              padding: "18px 12px", borderRadius: 16,
              border: "1.5px solid var(--dd-card-border)", background: "var(--dd-surface)",
              textAlign: "center",
            }}
          >
            <div style={{
              width: 44, height: 44, borderRadius: 12, background: "var(--dd-blue-bg)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Zap size={20} style={{ color: "var(--dd-blue)" }} />
            </div>
            <div>
              <p className="d" style={{ fontSize: 15, fontWeight: 900, color: "var(--dd-text)" }}>Duel a Player</p>
              <p style={{ fontSize: 10.5, color: "var(--dd-text-mute)", marginTop: 3, lineHeight: 1.4 }}>
                Public or invite-only stake match
              </p>
            </div>
          </button>

          <button
            className="create-choice-card"
            onClick={onPickSolo}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
              padding: "18px 12px", borderRadius: 16,
              border: "1.5px solid var(--dd-card-border)", background: "var(--dd-surface)",
              textAlign: "center",
            }}
          >
            <div style={{
              width: 44, height: 44, borderRadius: 12, background: "var(--dd-blue-bg)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Swords size={20} style={{ color: "var(--dd-blue)" }} />
            </div>
            <div>
              <p className="d" style={{ fontSize: 15, fontWeight: 900, color: "var(--dd-text)" }}>Play Solo</p>
              <p style={{ fontSize: 10.5, color: "var(--dd-text-mute)", marginTop: 3, lineHeight: 1.4 }}>
                Face a bot at your difficulty
              </p>
            </div>
          </button>
        </div>

        <button
          onClick={onClose}
          style={{
            width: "100%", height: 38, borderRadius: 10, border: "none", background: "transparent",
            color: "var(--dd-text-mute)", fontWeight: 700, fontSize: 12, cursor: "pointer",
            fontFamily: "'Figtree',sans-serif",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function QuizListPage() {
  const router = useRouter();
  const { address: userWalletAddress, getActiveSigner,chainId, ensureCorrectNetwork } = useWallet();
  const [tab, setTab] = useState<"lobby" | "history">("lobby");
  const [lobbyChallenges, setLobbyChallenges] = useState<LobbyChallenge[]>([]);
  const [history, setHistory] = useState<HistoryChallenge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [navigating, setNavigating] = useState<string | null>(null);
  const [showFullModal, setShowFullModal] = useState(false);
  const [showWelcomePopup, setShowWelcomePopup] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // ── Register / DROPS state ────────────────────────────────────────────────
  const [dropsBalance, setDropsBalance] = useState<DropsBalance | null>(null);
  const [dropsLoading, setDropsLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [showRegisterBanner, setShowRegisterBanner] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [showCheckinSuccess, setShowCheckinSuccess] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [incomingChallenge, setIncomingChallenge] = useState<{
  code: string; topic: string; stake: number; token: string;
  creatorName: string; avatar?: string;
} | null>(null);

// Add this effect after your other useEffects:
useEffect(() => {
  if (!userWalletAddress) return;
  const ws = new WebSocket(
    `${API_BASE_URL.replace(/^http/, "ws")}/ws/notify/${userWalletAddress.toLowerCase()}`
  );
  ws.onmessage = (evt) => {
    try {
      const msg = JSON.parse(evt.data);
      if (msg.type === "public_challenge" || msg.type === "challenge_invite") {
        setIncomingChallenge({
          code:        msg.data?.code,
          topic:       msg.data?.topic,
          stake:       msg.data?.stake,
          token:       msg.data?.token,
          creatorName: msg.data?.creatorName || msg.title,
          avatar:      msg.data?.avatar,
        });
      }
    } catch { /* ignore parse errors */ }
  };
  return () => ws.close();
}, [userWalletAddress]);
  const handleCheckin = async () => {
  if (!userWalletAddress || isCheckingIn) return;
  const activeChainId = chainId ?? CELO_CHAIN_ID;
  const cfg = getChainConfig(activeChainId);

  setIsCheckingIn(true);
  try {
    const onCorrectChain = await ensureCorrectNetwork();
    if (!onCorrectChain) { toast.error(`Please switch to ${cfg.name}.`); return; }

    const signer = await getActiveSigner();
    if (!signer) { toast.error("Could not get wallet signer."); return; }

    const CHECKIN_ABI = [{ name: "checkin", type: "function", inputs: [], stateMutability: "nonpayable" }] as const;
    const contract = new ethers.Contract(cfg.contracts.quizHub, CHECKIN_ABI, signer);

    toast.info("Confirm check-in in your wallet…");
    const tx = await sendTagged(contract, "checkin");
    await tx.wait();
    setShowCheckinSuccess(true); // ← trigger popup
    playCheckinMusic(); 
  } catch (err: any) {
    const msg = err?.reason ?? err?.shortMessage ?? err?.message ?? "Check-in failed";
    if (!msg.includes("user rejected") && !msg.includes("cancelled")) toast.error(msg);
  } finally {
    setIsCheckingIn(false);
  }
};

const playCheckinMusic = () => {
  const audio = new Audio("/war.mp3");
  audio.loop = true;
  audio.volume = 0.5;
  audio.play().catch(() => {});
  audioRef.current = audio;
};

const stopCheckinMusic = () => {
  if (audioRef.current) {
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    audioRef.current = null;
  }
};

const closeCheckinPopup = () => {
  stopCheckinMusic();
  setShowCheckinSuccess(false);
};

const closeWelcomePopup = () => {
  stopCheckinMusic(); // reuse same audio stop
  setShowWelcomePopup(false);
};
  // ── Droplist daily sync ───────────────────────────────────────────────────
  // Runs once after balance loads. Credits +10 DROPS if player claimed on
  // Droplist within the last 24 hrs and hasn't been credited yet today.
  const syncDroplistDaily = useCallback(async (wallet: string) => {
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/players/sync-droplist/${wallet.toLowerCase()}`
      );
      if (!res.ok) return;
      const data = await res.json();
      if (!data.success) return;

      // If drops were credited, update the displayed balance and notify the user
      if (data.credited > 0) {
        setDropsBalance(prev =>
          prev ? { ...prev, gameDrops: data.gameDrops, rewardDrops: data.rewardDrops } : prev
        );
        toast.success(`+${data.credited} DROPS added from your daily Droplist claim! 🎁`);
      }
    } catch {
      // Silent — sync failure should never break the page
    }
  }, []);

  // ── Load DROPS balance & determine if registered ──────────────────────────
 const fetchDropsBalance = useCallback(async () => {
  if (!userWalletAddress || !chainId) return;
  setDropsLoading(true);
  try {
    const res = await fetch(
      `${API_BASE_URL}/api/drops/balance/${userWalletAddress.toLowerCase()}?chainId=${chainId}`
    );
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        setDropsBalance(data);
        if (data.alreadyMinted || data.gameDrops > 0) {
          setRegistered(true);
          setShowRegisterBanner(false);
          syncDroplistDaily(userWalletAddress);
        } else {
          setRegistered(false);        // ← also reset when switching to an unclaimed chain
          setShowRegisterBanner(true);
        }
      }
    } else if (res.status === 404) {
      setShowRegisterBanner(true);
    }
  } catch {
  } finally {
    setDropsLoading(false);
  }
}, [userWalletAddress, chainId, syncDroplistDaily]);

useEffect(() => {
  if (userWalletAddress && chainId) fetchDropsBalance();
}, [userWalletAddress, chainId, fetchDropsBalance]);
  useEffect(() => {
    if (userWalletAddress) fetchDropsBalance();
  }, [userWalletAddress, fetchDropsBalance]);

  // ── Register ──────────────────────────────────────────────────────────────
  async function submitDropsClaim(
    payload: { contract: string; amount: string; timestamp: number; signature: string },
    activeSigner: ethers.JsonRpcSigner | ethers.Wallet,
  ) {
    const contract = new ethers.Contract(payload.contract, REDEEM_ABI, activeSigner);
    const tx = await sendTagged(contract, "claim", [
      BigInt(payload.amount),
      BigInt(payload.timestamp),
      payload.signature as `0x${string}`,
    ]);
    await tx.wait();
    return tx.hash as string;
  }

  const handleRegister = async () => {
    if (!userWalletAddress || isRegistering) return;
    setIsRegistering(true);

    const activeChainId = chainId ?? CELO_CHAIN_ID;
    const activeCfg     = getChainConfig(activeChainId);
    const dropsTokenAddr = activeCfg.contracts.dropsToken;

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/players/register?wallet=${userWalletAddress.toLowerCase()}&username=User${userWalletAddress.slice(-4).toUpperCase()}&chainId=${activeChainId}`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!data.success) {
        toast.error("Registration failed. Please try again.");
        return;
      }

      if (data.welcomeAlreadyConfirmed) {
        setRegistered(true);
        setShowRegisterBanner(false);
        return;
      }

      // ── Use the chain the user is actually on, not Celo ──────────────────
      const onCorrectChain = await ensureCorrectNetwork();
      if (!onCorrectChain) { toast.error(`Please switch to ${activeCfg.name}.`); return; }

      const signer = await getActiveSigner();
      if (!signer) { toast.error("Could not get wallet signer."); return; }

      const WELCOME_ABI = [{
        name: "welcome", type: "function",
        inputs: [], stateMutability: "nonpayable",
      }] as const;

      toast.info("Please confirm the welcome transaction in your wallet…");
      const contract = new ethers.Contract(dropsTokenAddr, WELCOME_ABI, signer);

      let tx: ethers.ContractTransactionResponse;
      try {
        tx = await sendTagged(contract, "welcome");
      } catch (txErr: any) {
        const msg = txErr?.reason ?? txErr?.shortMessage ?? txErr?.message ?? "Transaction failed";
        if (!msg.includes("user rejected") && !msg.includes("cancelled")) {
          toast.error(`Transaction failed: ${msg}. You can try again.`);
        }
        return;
      }

      try {
        await tx.wait();
      } catch {
        toast.error("Transaction reverted. You may have already claimed. Checking status…");
        await fetchDropsBalance();
        return;
      }

      try {
        await fetch(`${API_BASE_URL}/api/players/confirm-welcome`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            walletAddress: userWalletAddress.toLowerCase(),
            txHash: tx.hash,
            chainId: activeChainId,   // ← was missing entirely before
          }),
        });
      } catch {
        console.warn("Could not confirm welcome mint to backend — will reconcile on next balance fetch");
      }

      const creditMsg = data.existingBalanceFolded > 0
        ? `🎉 Welcome! ${fmt(data.totalCredited)} DROPS added (100 bonus + ${fmt(data.existingBalanceFolded)} from your wallet).`
        : "🎉 Welcome! 100 DROPS minted to your wallet!";
      toast.success(creditMsg);
      setShowWelcomePopup(true); // ← add this
      playCheckinMusic(); 
      setRegistered(true);
      setTimeout(() => setShowRegisterBanner(false), 3000);
      setTimeout(() => fetchDropsBalance(), 4000);
    } catch (err: any) {
      const msg = err?.reason ?? err?.shortMessage ?? err?.message ?? "Unknown error";
      if (!msg.includes("user rejected") && !msg.includes("cancelled")) {
        toast.error(msg);
      }
    } finally {
      setIsRegistering(false);
    }
  };

  // ── Lobby & History ───────────────────────────────────────────────────────
  const fetchLobby = async (silent = false) => {
    if (!silent) setIsLoading(true); else setIsRefreshing(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/challenge/lobby`);
      const d = await r.json();
      if (d.success) {
        const allChallenges = d.challenges as LobbyChallenge[];
        // Only show challenges that have a tx_hash (on-chain confirmed)
        // The lobby view returns tx_hash; filter it out if missing/null
        const filtered = allChallenges.filter(
          (c) => c.chain_id && (c as any).tx_hash
        );
        setLobbyChallenges(filtered);
      }
    } catch {
      toast.error("Failed to sync lobby");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const fetchHistory = async () => {
    if (!userWalletAddress) return;
    setHistoryLoading(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/challenge/${userWalletAddress.toLowerCase()}/history?limit=50`);
      const d = await r.json();
      if (d.success) setHistory((d.history ?? []).filter((h: HistoryChallenge) => h.status === "finished"));
    } catch { toast.error("Failed to load match history"); }
    finally { setHistoryLoading(false); }
  };

  useEffect(() => { fetchLobby(); }, []);
  useEffect(() => { if (tab === "history" && userWalletAddress) fetchHistory(); }, [tab, userWalletAddress]);
  useEffect(() => {
    if (tab !== "lobby") return;
    const t = setInterval(() => fetchLobby(true), 15000);
    return () => clearInterval(t);
  }, [tab]);

  const myWallet = userWalletAddress?.toLowerCase() ?? "";
  const wins = useMemo(() => history.filter(h => h.winner_address?.toLowerCase() === myWallet), [history, myWallet]);

  // In handleJoinAction, replace the existing logic:
const handleJoinAction = async (code: string) => {
    if (code.length < 4) return;
    setNavigating(code);
    if (!userWalletAddress) {
      router.push(`/challenge/${code}/pre-lobby`);
      setNavigating(null);
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/challenge/${code}`);
      const data = await res.json();
      if (data.success && data.challenge) {
        const c = data.challenge;
        const w = userWalletAddress.toLowerCase();
        const playerKeys = Object.keys(c.players || {});
        const isCreator = c.creator?.toLowerCase() === w;
        const isPlayer = playerKeys.some((p: string) => p.toLowerCase() === w);
        const isFull = playerKeys.length >= 2;
        const hasOpponent = playerKeys.filter((p: string) => p.toLowerCase() !== c.creator?.toLowerCase()).length > 0;

        // Creator with no opponent yet → always go to pre-lobby so they can manage/share
        if (isCreator && !hasOpponent && c.status === "waiting") {
          router.push(`/challenge/${code}/pre-lobby`);
          return;
        }
        // Creator already in an active/full game → go to game page
        if (isCreator || isPlayer) { router.push(`/challenge/${code}`); return; }
        if (isFull) { setShowFullModal(true); setNavigating(null); return; }
        if (c.status === "active" || c.status === "finished") {
          toast.error("This challenge is no longer open."); setNavigating(null); return;
        }
        router.push(`/challenge/${code}/pre-lobby`);
      } else {
        router.push(`/challenge/${code}/pre-lobby`);
      }
    } catch {
      router.push(`/challenge/${code}/pre-lobby`);
    } finally {
      setNavigating(null);
    }
  };

  const tierColor = dropsBalance ? (TIER_COLOR[dropsBalance.tier] ?? "#64748b") : "#64748b";

  return (
    <>
      <style>{S}</style>
      <div className="dd-page" style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", paddingBottom: 100 }}>
        <Header pageTitle="Duel Arena" />

        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>

          {/* ── Register Banner ─────────────────────────────────────────── */}
          {userWalletAddress && showRegisterBanner && !dropsLoading && (
            <div className="register-banner" style={{ padding: 20 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: "rgba(255,255,255,0.2)",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <Gift size={22} color="#fff" />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ color: "#fff", fontWeight: 900, fontSize: 15, marginBottom: 4, fontFamily: "'Figtree',sans-serif" }}>
                    Claim your 100 DROPS!
                  </p>
                  <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 12, lineHeight: 1.4, marginBottom: 14, fontFamily: "'Figtree',sans-serif" }}>
                    New players get 100 free DROPS to start playing. Mint once, play forever.
                  </p>
                  {registered ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <CheckCircle2 size={18} color="#fff" />
                      <span style={{ color: "#fff", fontWeight: 800, fontSize: 13, fontFamily: "'Figtree',sans-serif" }}>
                        Minting in progress… check back shortly!
                      </span>
                    </div>
                  ) : (
                    <button
                      onClick={handleRegister}
                      disabled={isRegistering}
                      style={{
                        height: 42, padding: "0 20px", borderRadius: 10,
                        background: "#fff", color: "var(--dd-blue)", border: "none",
                        fontWeight: 900, fontSize: 13, cursor: "pointer",
                        display: "flex", alignItems: "center", gap: 8,
                        opacity: isRegistering ? 0.7 : 1,
                        fontFamily: "'Figtree',sans-serif", transition: "opacity .2s",
                      }}
                    >
                      {isRegistering
                        ? <><Loader2 size={15} className="spin" /> Registering…</>
                        : <><Gift size={15} /> Get 100 DROPS Free</>}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── DROPS balance pill ───────────────────────────────────────── */}
          {userWalletAddress && dropsBalance && !showRegisterBanner && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "12px 16px", borderRadius: 14,
              border: "1.5px solid var(--dd-card-border)", background: "var(--dd-surface)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <p style={{ fontSize: 15, fontWeight: 900, color: "var(--dd-text)", fontFamily: "'Big Shoulders Display',sans-serif" }}>
                    {fmt(dropsBalance.gameDrops)} <span style={{ fontSize: 11, fontWeight: 700, color: "var(--dd-text-mute)" }}>game</span>
                    {" · "}
                    {fmt(dropsBalance.rewardDrops)} <span style={{ fontSize: 11, fontWeight: 700, color: "var(--dd-text-mute)" }}>reward</span>
                  </p>
              </div>

              {/* ── Action buttons + tier ── */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button
                  onClick={() => router.push(`/dashboard/${userWalletAddress}?tab=challenge&subtab=redeem`)}
                  style={{
                    fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 8,
                    background: "var(--dd-surface)", color: "var(--dd-text)",
                    border: "1px solid var(--dd-card-border)", cursor: "pointer",
                    fontFamily: "'Figtree',sans-serif", whiteSpace: "nowrap",
                  }}
                >
                  {chainId === CELO_CHAIN_ID ? "Redeem $G" : ""}
                </button>
                <button
                  onClick={() => router.push(`/dashboard/${userWalletAddress}?tab=challenge&subtab=buy-drop`)}
                  className={dropsBalance.gameDrops <= 50 ? "danger-btn-glow" : ""}
                  style={{
                    fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 8,
                    ...(dropsBalance.gameDrops <= 50
                      ? {}
                      : {
                          background: "var(--dd-surface)",
                          color: "var(--dd-text)",
                          border: "1px solid var(--dd-card-border)",
                        }),
                    cursor: "pointer",
                    fontFamily: "'Figtree',sans-serif",
                    whiteSpace: "nowrap",
                  }}
                >
                  {dropsBalance.gameDrops <= 50
                    ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: 12 }}>⚠️</span>
                        <span style={{ animation: "dangerPulseText 1.4s ease-in-out infinite" }}>
                          Top Up Drops
                        </span>
                      </span>
                    )
                    : "Buy DROPS"}
                </button>
                <span className="drops-pill" style={{ background: `${tierColor}15`, color: tierColor, border: `1px solid ${tierColor}30` }}>
                  {dropsBalance.tier}
                </span>
              </div>
            </div>
          )}  

          {/* ── Hero + Quick Join ─────────────────────────────────────────── */}
          <div style={{ background: "var(--dd-blue)", borderRadius: 16, padding: 20 }}>
            <h1 className="d" style={{ fontSize: 36, fontWeight: 900, color: "#fff", lineHeight: 1, marginBottom: 4 }}>
              STAKE <span style={{ opacity: 0.7 }}>&</span> EARN
            </h1>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginBottom: 16 }}>
              Outsmart your opponent. Winner takes everything.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={codeInput}
                onChange={e => setCodeInput(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === "Enter" && handleJoinAction(codeInput)}
                placeholder="ROOM CODE"
                maxLength={8}
                style={{
                  flex: 1, height: 48, borderRadius: 10,
                  border: "1.5px solid rgba(255,255,255,0.25)",
                  background: "rgba(255,255,255,0.12)",
                  color: "#fff", padding: "0 14px",
                  fontSize: 14, fontWeight: 700, fontFamily: "monospace", outline: "none",
                }}
              />
              <button
                onClick={() => handleJoinAction(codeInput)}
                disabled={!codeInput || navigating !== null}
                style={{
                  height: 48, padding: "0 20px", borderRadius: 10,
                  background: "#fff", color: "var(--dd-blue)", border: "none",
                  fontWeight: 900, fontSize: 14, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
                  opacity: !codeInput ? 0.6 : 1, transition: "opacity .2s",
                }}
              >
                {navigating === codeInput ? <Loader2 size={16} className="spin" /> : <><Zap size={14} />DUEL</>}
              </button>
            </div>
          </div>

          {/* ── Action buttons ────────────────────────────────────────────── */}
          <div style={{ display: "flex", gap: 10 }}>
  <button
    className="btn-blue"
    onClick={() => setShowCreateModal(true)}
    style={{ flex: 1, height: 48, borderRadius: 12, fontSize: 14 }}
  >
    <Plus size={16} />
    <span style={{ display: "inline" }} className="btn-label">Create</span>
  </button>
  
  <button
    className="btn-ghost"
    onClick={() => router.push(`/dashboard/${userWalletAddress}?tab=challenge`)}
    style={{ height: 48, padding: "0 16px", borderRadius: 12, fontSize: 13, flexShrink: 0 }}
  >
    <Trophy size={15} />
    <span style={{ display: "inline" }} className="btn-label">My Stats</span>
  </button>
  {userWalletAddress && (
  <button
    className="btn-ghost checkin-btn-glow"
    onClick={handleCheckin}
    disabled={isCheckingIn}
    style={{
      height: 48, padding: "0 16px", borderRadius: 12,
      fontSize: 13, flexShrink: 0,
      opacity: isCheckingIn ? 0.6 : 1,
      background: "rgba(37,99,235,0.08)",
    }}
  >
    {isCheckingIn
      ? <Loader2 size={15} className="spin" />
      : (
        <>
          <span style={{ fontSize: 15 }}>⚔️</span>
          <span className="btn-label" style={{ animation: "checkinPulseText 1.8s ease-in-out infinite" }}>
           Vibe
          </span>
        </>
      )}
  </button>
)}
</div>

          {/* ── Tab + Refresh ─────────────────────────────────────────────── */}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{
              flex: 1, display: "flex", padding: 4, borderRadius: 12,
              background: "var(--dd-surface)", border: "1px solid var(--dd-line)",
            }}>
              {(["lobby", "history"] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  style={{
                    flex: 1, padding: "9px 8px", borderRadius: 9, border: "none",
                    cursor: "pointer",
                    background: tab === t ? "var(--dd-blue)" : "transparent",
                    color: tab === t ? "#fff" : "var(--dd-text-dim)",
                    fontWeight: 900, fontSize: 12, fontFamily: "'Figtree',sans-serif",
                    letterSpacing: "0.05em", transition: "all .2s", textTransform: "uppercase",
                  }}
                >
                  {t === "lobby" ? "PUBLIC" : "MY WINS"}
                </button>
              ))}
            </div>
            <button
              onClick={() => tab === "lobby" ? fetchLobby(true) : fetchHistory()}
              disabled={isRefreshing || historyLoading}
              style={{
                width: 40, height: 40, borderRadius: 20,
                border: "1.5px solid var(--dd-line)", background: "var(--dd-surface)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", flexShrink: 0,
              }}
            >
              <RefreshCw size={15} style={{ color: "var(--dd-blue)" }} className={(isRefreshing || historyLoading) ? "spin" : ""} />
            </button>
          </div>

          {/* ── LOBBY TAB ─────────────────────────────────────────────────── */}
          {tab === "lobby" && (
            isLoading
              ? <div style={{ display: "flex", justifyContent: "center", padding: "48px 0" }}><Loading /></div>
              : lobbyChallenges.length === 0
                ? (
                  <div style={{
                    display: "flex", flexDirection: "column", alignItems: "center",
                    padding: "48px 20px", gap: 12,
                    border: "2px dashed var(--dd-line)", borderRadius: 16, textAlign: "center",
                  }}>
                    <Gamepad2 size={40} style={{ color: "var(--dd-text-mute)" }} />
                    <p className="d" style={{ fontSize: 18, fontWeight: 900, color: "var(--dd-text-dim)" }}>No active duels</p>
                    <p style={{ fontSize: 13, color: "var(--dd-text-mute)" }}>Be first to create a public challenge.</p>
                    <button className="btn-blue" onClick={() => setShowCreateModal(true)} style={{ padding: "11px 24px", borderRadius: 10, fontSize: 13, marginTop: 4 }}>
                      Start Duel
                    </button>
                  </div>
                )
                : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {lobbyChallenges.map(c => (
                      <button
                        key={c.code}
                        className="lobby-card"
                        onClick={() => handleJoinAction(c.code)}
                        style={{ padding: 16, textAlign: "left", width: "100%" }}
                      >
                        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                              <span style={{ padding: "4px 8px", borderRadius: 6, background: "rgba(100,116,139,0.1)", color: "var(--dd-text-dim)", fontSize: 10, fontWeight: 900 }}>
                                {getChainConfig(c.chain_id).shortName}
                              </span>
                              <span style={{ padding: "4px 10px", borderRadius: 6, background: "var(--dd-blue)", color: "#fff", fontSize: 10, fontWeight: 900, textTransform: "uppercase", flexShrink: 0 }}>
                                Join Pool
                              </span>
                            </div>
                          
                        <div style={{ display: "flex", alignItems: "center", borderTop: "1px solid var(--dd-line)", borderBottom: "1px solid var(--dd-line)", padding: "10px 0", marginBottom: 10, gap: 0 }}>
                          <div style={{ flex: 1, textAlign: "center" }}>
                            <p style={{ fontSize: 10, color: "var(--dd-text-mute)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 2 }}>Entry</p>
                            <p className="d" style={{ fontSize: 15, fontWeight: 900, color: "var(--dd-text)" }}>{fmt(c.stake_amount)} {c.token_symbol}</p>
                          </div>
                          <div style={{ width: 1, background: "var(--dd-line)", alignSelf: "stretch" }} />
                          <div style={{ flex: 1, textAlign: "center" }}>
                            <p style={{ fontSize: 10, color: "var(--dd-blue)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 2 }}>Prize Pool</p>
                            <p className="d" style={{ fontSize: 15, fontWeight: 900, color: "var(--dd-blue)" }}>🏆 {fmt(c.stake_amount * 2)} {c.token_symbol}</p>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 11, color: "var(--dd-text-mute)", fontFamily: "monospace" }}>#{c.code}</span>
                          <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--dd-blue)", fontSize: 11, fontWeight: 900 }}>
                            {navigating === c.code ? <Loader2 size={13} className="spin" /> : <>CHALLENGE<ChevronRight size={12} /></>}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )
          )}

          {/* ── HISTORY TAB ───────────────────────────────────────────────── */}
          {tab === "history" && (
            !userWalletAddress
              ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "48px 20px", gap: 12, border: "1.5px solid var(--dd-line)", borderRadius: 16, textAlign: "center" }}>
                  <Trophy size={40} style={{ color: "var(--dd-text-mute)" }} />
                  <p style={{ fontSize: 14, fontWeight: 700, color: "var(--dd-text-dim)" }}>Connect your wallet to see your wins.</p>
                </div>
              )
              : historyLoading
                ? <div style={{ display: "flex", justifyContent: "center", padding: "48px 0" }}><Loading /></div>
                : (
                  <>
                    {history.length > 0 && (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                        {[
                          { label: "Played", val: history.length, color: "var(--dd-text)" },
                          { label: "Won", val: wins.length, color: "#1d4ed8" },
                          { label: "Win Rate", val: `${history.length > 0 ? Math.round((wins.length / history.length) * 100) : 0}%`, color: "var(--dd-blue)" },
                        ].map(s => (
                          <div key={s.label} className="dd-card" style={{ padding: "14px 8px", textAlign: "center" }}>
                            <p className="d" style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.val}</p>
                            <p style={{ fontSize: 9, fontWeight: 700, color: "var(--dd-text-mute)", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 3 }}>{s.label}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {wins.length === 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 20px", gap: 10, border: "2px dashed var(--dd-line)", borderRadius: 16, textAlign: "center" }}>
                        <Trophy size={36} style={{ color: "var(--dd-text-mute)" }} />
                        <p className="d" style={{ fontSize: 15, fontWeight: 800, color: "var(--dd-text-dim)" }}>
                          {history.length === 0 ? "No matches played yet." : "No wins yet — keep playing!"}
                        </p>
                        {history.length === 0 && (
                          <button className="btn-blue" onClick={() => setTab("lobby")} style={{ padding: "10px 20px", borderRadius: 10, fontSize: 12, marginTop: 4 }}>Find a Challenge</button>
                        )}
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {wins.map(item => (
                          <button
                            key={item.code}
                            className="history-row"
                            onClick={() => router.push(`/challenge/${item.code}`)}
                            style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px", borderRadius: 14, border: "1.5px solid rgba(37,99,235,0.3)", background: "rgba(37,99,235,0.04)", cursor: "pointer", textAlign: "left", width: "100%" }}
                          >
                            <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: "rgba(37,99,235,0.08)", border: "1.5px solid rgba(37,99,235,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <Trophy size={15} style={{ color: "var(--dd-blue)" }} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--dd-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "'Figtree',sans-serif" }}>{item.topic}</p>
                              <p style={{ fontSize: 10, color: "var(--dd-text-mute)", fontFamily: "monospace", marginTop: 2 }}>#{item.code}{item.finished_at && ` · ${timeAgo(item.finished_at)}`}</p>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, flexShrink: 0 }}>
                              <span style={{ fontSize: 10, fontWeight: 900, padding: "2px 7px", borderRadius: 20, background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.3)", color: "#1d4ed8" }}>WON</span>
                              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--dd-text-dim)" }}>{fmt(item.stake_amount)} {item.token_symbol}</span>
                              <span style={{ fontSize: 10, fontWeight: 900, color: "#1d4ed8" }}>+{fmt(item.stake_amount * 2)} {item.token_symbol}</span>
                            </div>
                            <ChevronRight size={13} style={{ color: "var(--dd-text-mute)", flexShrink: 0 }} />
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )
          )}
        </div>
      </div>

      {/* ── Create-choice popup ─────────────────────────────────────────── */}
      {showCreateModal && (
        <CreateChoiceModal
          onPickDuel={() => { setShowCreateModal(false); router.push("/challenge/create-challenge"); }}
          onPickSolo={() => { setShowCreateModal(false); router.push("/challenge/create-single-challenge"); }}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {/* ── Check-in Success Modal ──────────────────────────────────────── */}
      {showCheckinSuccess && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "0 24px",
            background: "rgba(2,6,23,0.85)",
            backdropFilter: "blur(8px)",
          }}
          onClick={closeCheckinPopup}
        >
          {/* ── Confetti ── */}
          {Array.from({ length: 50 }).map((_, i) => {
            const colors = ["#2563eb","#6366f1","#f59e0b","#10b981","#ef4444","#8b5cf6","#ec4899","#fff","#fbbf24"];
            const size = 6 + Math.random() * 10;
            const isCircle = Math.random() > 0.5;
            return (
              <div
                key={i}
                className="confetti-piece"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `-${Math.random() * 20}px`,
                  width: `${size}px`,
                  height: isCircle ? `${size}px` : `${size * 0.4}px`,
                  background: colors[i % colors.length],
                  borderRadius: isCircle ? "50%" : "2px",
                  animationDuration: `${1.8 + Math.random() * 2.5}s`,
                  animationDelay: `${Math.random() * 0.8}s`,
                  transform: `rotate(${Math.random() * 360}deg)`,
                }}
              />
            );
          })}

          <div
            className="checkin-popup"
            onClick={e => e.stopPropagation()}
            style={{
              borderRadius: 28, padding: "40px 28px 28px",
              maxWidth: 340, width: "100%",
              textAlign: "center",
              border: "1.5px solid rgba(255,255,255,0.12)",
              boxShadow: "0 32px 100px rgba(37,99,235,0.6), 0 0 0 1px rgba(99,102,241,0.2)",
              position: "relative", overflow: "hidden",
              background: "linear-gradient(145deg,#0f0c29,#1e1b4b,#2563eb)",
              backgroundSize: "300% 300%",
              animation: "popIn 0.55s cubic-bezier(0.34,1.56,0.64,1) forwards, bgPulse 4s ease infinite",
            }}
          >
            {/* Pulse rings */}
            {[0, 1, 2].map(i => (
              <div key={i} className="ring" style={{
                width: 80, height: 80,
                top: "50%", left: "50%",
                marginTop: -40, marginLeft: -40,
                animationDelay: `${i * 0.5}s`,
              }} />
            ))}

            {/* Inner glow */}
            <div style={{
              position: "absolute", top: -60, left: "50%", transform: "translateX(-50%)",
              width: 260, height: 260,
              background: "radial-gradient(circle, rgba(99,102,241,0.35) 0%, transparent 70%)",
              pointerEvents: "none",
            }} />

            {/* Emoji */}
            <div className="party-icon" style={{ fontSize: 72, marginBottom: 16, display: "block" }}>
              ⚔️
            </div>

            {/* Title */}
            <h2
              className="d shine-text"
              style={{ fontSize: 36, fontWeight: 900, marginBottom: 6, letterSpacing: "-0.5px" }}
            >
              ⚔️VIBING!⚔️
            </h2>

            {/* Subtitle */}
            <p style={{
              fontSize: 13, color: "rgba(255,255,255,0.6)",
              marginBottom: 24, fontFamily: "'Figtree',sans-serif", lineHeight: 1.5,
            }}>
              The arena awaits. No mercy. ⚔️<br/>
              <span style={{ fontSize: 11, opacity: 0.5 }}>Tap anywhere or close to dismiss</span>
            </p>

            {/* Stats */}
            {dropsBalance && (
              <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
                {[
                  { label: "Game DROPS", val: fmt(dropsBalance.gameDrops), icon: "💧" },
                  { label: "Tier",       val: dropsBalance.tier,           icon: "⚡" },
                  { label: "Duels",      val: dropsBalance.totalDuels,     icon: "⚔️" },
                ].map(s => (
                  <div key={s.label} style={{
                    flex: 1, padding: "12px 6px", borderRadius: 14,
                    background: "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    backdropFilter: "blur(4px)",
                  }}>
                    <p style={{ fontSize: 18, marginBottom: 2 }}>{s.icon}</p>
                    <p className="d" style={{ fontSize: 20, fontWeight: 900, color: "#fff" }}>{s.val}</p>
                    <p style={{
                      fontSize: 8, fontWeight: 700, color: "rgba(255,255,255,0.4)",
                      textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 3,
                    }}>{s.label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* CTAs */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                onClick={() => { closeCheckinPopup(); setShowCreateModal(true); }}
                style={{
                  height: 50, borderRadius: 14, border: "none",
                  background: "linear-gradient(135deg,#fff,#e0e7ff)",
                  color: "#2563eb", fontWeight: 900, fontSize: 14,
                  cursor: "pointer", fontFamily: "'Figtree',sans-serif",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  boxShadow: "0 4px 20px rgba(255,255,255,0.2)",
                }}
              >
                <Zap size={16} /> Start a Duel Now
              </button>
              <button
                onClick={closeCheckinPopup}
                style={{
                  height: 42, borderRadius: 12,
                  border: "1.5px solid rgba(255,255,255,0.15)",
                  background: "rgba(255,255,255,0.05)",
                  color: "rgba(255,255,255,0.6)",
                  fontWeight: 700, fontSize: 13, cursor: "pointer",
                  fontFamily: "'Figtree',sans-serif",
                  transition: "background .2s",
                }}
              >
                🔇 Stop Music &amp; Close
              </button>
            </div>
          </div>
        </div>
      )}
      {showWelcomePopup && (
  <div
    style={{
      position: "fixed", inset: 0, zIndex: 9999,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "0 24px", background: "rgba(0,0,0,0.7)",
      backdropFilter: "blur(4px)",
    }}
    onClick={closeWelcomePopup}
  >
    {/* Confetti */}
    {Array.from({ length: 50 }).map((_, i) => {
      const colors = ["#2563eb","#6366f1","#f59e0b","#10b981","#ef4444","#8b5cf6","#ec4899","#fff","#fbbf24"];
      const size = 6 + Math.random() * 10;
      const isCircle = Math.random() > 0.5;
      return (
        <div
          key={i}
          className="confetti-piece"
          style={{
            left: `${Math.random() * 100}%`,
            top: `-${Math.random() * 20}px`,
            width: `${size}px`,
            height: isCircle ? `${size}px` : `${size * 0.4}px`,
            background: colors[i % colors.length],
            borderRadius: isCircle ? "50%" : "2px",
            animationDuration: `${1.8 + Math.random() * 2.5}s`,
            animationDelay: `${Math.random() * 0.8}s`,
            transform: `rotate(${Math.random() * 360}deg)`,
          }}
        />
      );
    })}

    <div
      className="checkin-popup"
      onClick={e => e.stopPropagation()}
      style={{
        borderRadius: 28, padding: "40px 28px 28px",
        maxWidth: 340, width: "100%",
        textAlign: "center",
        border: "1.5px solid rgba(255,255,255,0.12)",
        boxShadow: "0 32px 100px rgba(37,99,235,0.6), 0 0 0 1px rgba(99,102,241,0.2)",
        position: "relative", overflow: "hidden",
        background: "linear-gradient(145deg,#0f0c29,#1e1b4b,#10b981)",
        backgroundSize: "300% 300%",
        animation: "popIn 0.55s cubic-bezier(0.34,1.56,0.64,1) forwards, bgPulse 4s ease infinite",
      }}
    >
      {/* Pulse rings */}
      {[0, 1, 2].map(i => (
        <div key={i} className="ring" style={{
          width: 80, height: 80,
          top: "50%", left: "50%",
          marginTop: -40, marginLeft: -40,
          animationDelay: `${i * 0.5}s`,
        }} />
      ))}

      {/* Inner glow */}
      <div style={{
        position: "absolute", top: -60, left: "50%", transform: "translateX(-50%)",
        width: 260, height: 260,
        background: "radial-gradient(circle, rgba(16,185,129,0.35) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* Emoji */}
      <div className="party-icon" style={{ fontSize: 72, marginBottom: 16, display: "block" }}>
        🎉
      </div>

      {/* Title */}
      <h2
        className="d shine-text"
        style={{ fontSize: 36, fontWeight: 900, marginBottom: 6, letterSpacing: "-0.5px" }}
      >
        WELCOME!
      </h2>

      {/* Subtitle */}
      <p style={{
        fontSize: 13, color: "rgba(255,255,255,0.6)",
        marginBottom: 24, fontFamily: "'Figtree',sans-serif", lineHeight: 1.5,
      }}>
        Your wallet is now in the arena. 100 DROPS minted! 💧<br/>
        <span style={{ fontSize: 11, opacity: 0.5 }}>Tap anywhere or close to dismiss</span>
      </p>

      {/* Stats */}
      {dropsBalance && (
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          {[
            { label: "Game DROPS", val: fmt(dropsBalance.gameDrops), icon: "💧" },
            { label: "Tier",       val: dropsBalance.tier,           icon: "⚡" },
            { label: "Duels",      val: dropsBalance.totalDuels,     icon: "⚔️" },
          ].map(s => (
            <div key={s.label} style={{
              flex: 1, padding: "12px 6px", borderRadius: 14,
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.1)",
              backdropFilter: "blur(4px)",
            }}>
              <p style={{ fontSize: 18, marginBottom: 2 }}>{s.icon}</p>
              <p className="d" style={{ fontSize: 20, fontWeight: 900, color: "#fff" }}>{s.val}</p>
              <p style={{
                fontSize: 8, fontWeight: 700, color: "rgba(255,255,255,0.4)",
                textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 3,
              }}>{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* CTAs */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <button
          onClick={() => { closeWelcomePopup(); setShowCreateModal(true); }}
          style={{
            height: 50, borderRadius: 14, border: "none",
            background: "linear-gradient(135deg,#fff,#d1fae5)",
            color: "#2563eb", fontWeight: 900, fontSize: 14,
            cursor: "pointer", fontFamily: "'Figtree',sans-serif",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            boxShadow: "0 4px 20px rgba(255,255,255,0.2)",
          }}
        >
          <Zap size={16} /> Start Your First Duel
        </button>
        <button
          onClick={closeWelcomePopup}
          style={{
            height: 42, borderRadius: 12,
            border: "1.5px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.05)",
            color: "rgba(255,255,255,0.6)",
            fontWeight: 700, fontSize: 13, cursor: "pointer",
            fontFamily: "'Figtree',sans-serif",
            transition: "background .2s",
          }}
        >
          🔇 Stop Music &amp; Close
        </button>
      </div>
    </div>
  </div>
)}
      {/* Full Modal */}
      {showFullModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "0 24px" }}>
          <div style={{ background: "var(--dd-bg)", borderRadius: 20, padding: 28, maxWidth: 340, width: "100%", border: "1.5px solid var(--dd-card-border)", textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
            <h2 className="d" style={{ fontSize: 22, fontWeight: 900, color: "var(--dd-text)", marginBottom: 8 }}>Challenge Full</h2>
            <p style={{ fontSize: 13, color: "var(--dd-text-dim)", marginBottom: 24, lineHeight: 1.5 }}>
              This duel already has two players. Create your own challenge to start a new game.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button className="btn-blue" onClick={() => { setShowFullModal(false); router.push("/challenge/create-challenge"); }} style={{ height: 46, borderRadius: 12, fontSize: 14 }}>
                Create New Challenge
              </button>
              <button className="btn-ghost" onClick={() => setShowFullModal(false)} style={{ height: 40, borderRadius: 12, fontSize: 13 }}>
                Go Back
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Floating Support Button ─────────────────────────────────────────── */}
     <button
  onClick={() => router.push("/support")}
  title="Support & FAQ"
  style={{
    position: "fixed",
    bottom: 80,
    right: 20,
    width: 46,
    height: 46,
    borderRadius: "50%",
    background: "#1e4ed8",
    border: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    zIndex: 100,
    boxShadow: "0 4px 16px rgba(30,78,216,0.4)",
    transition: "box-shadow .2s, transform .15s, background .2s",
  }}
  onMouseEnter={e => {
    const b = e.currentTarget;
    b.style.background = "#1d4ed8";
    b.style.boxShadow = "0 6px 24px rgba(30,78,216,0.55)";
    b.style.transform = "scale(1.08)";
  }}
  onMouseLeave={e => {
    const b = e.currentTarget;
    b.style.background = "#1e4ed8";
    b.style.boxShadow = "0 4px 16px rgba(30,78,216,0.4)";
    b.style.transform = "scale(1)";
  }}
>
  <HelpCircle size={20} color="#ffffff" strokeWidth={2.5} />
</button>
{/* ── Incoming Challenge Popup ──────────────────────────────────── */}
{incomingChallenge && (
  <div
    style={{
      position: "fixed", inset: 0, zIndex: 9998,
      display: "flex", alignItems: "flex-end", justifyContent: "center",
      padding: "0 0 100px",
      background: "rgba(2,6,23,0.5)", backdropFilter: "blur(4px)",
    }}
    onClick={() => setIncomingChallenge(null)}
  >
    <div
      onClick={e => e.stopPropagation()}
      style={{
        width: "100%", maxWidth: 480, borderRadius: "20px 20px 0 0",
        padding: "20px 20px 28px",
        background: "var(--dd-bg)",
        border: "1.5px solid var(--dd-card-border)",
        borderBottom: "none",
        animation: "sheetUp 0.3s ease-out forwards",
      }}
    >
      <div style={{ width: 36, height: 4, borderRadius: 99, background: "var(--dd-line)", margin: "0 auto 16px" }} />
      <p style={{ fontSize: 11, fontWeight: 700, color: "var(--dd-blue)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
        🎯 New Challenge
      </p>
      <p className="d" style={{ fontSize: 20, fontWeight: 900, color: "var(--dd-text)", marginBottom: 4 }}>
        {incomingChallenge.creatorName} is challenging you!
      </p>
      <p style={{ fontSize: 13, color: "var(--dd-text-dim)", marginBottom: 6 }}>
        Topic: <strong>{incomingChallenge.topic}</strong>
      </p>
      <p style={{ fontSize: 13, color: "var(--dd-text-dim)", marginBottom: 20 }}>
        Stake: <strong>{fmt(incomingChallenge.stake)} {incomingChallenge.token}</strong> · Prize: <strong style={{ color: "var(--dd-blue)" }}>{fmt(incomingChallenge.stake * 2)} {incomingChallenge.token}</strong>
      </p>
      <div style={{ display: "flex", gap: 10 }}>
        <button
          className="btn-blue"
          onClick={() => {
            setIncomingChallenge(null);
            router.push(`/challenge/${incomingChallenge.code}/pre-lobby`);
          }}
          style={{ flex: 1, height: 48, borderRadius: 12, fontSize: 14 }}
        >
          <Zap size={15} /> Accept Duel
        </button>
        <button
          className="btn-ghost"
          onClick={() => setIncomingChallenge(null)}
          style={{ height: 48, padding: "0 20px", borderRadius: 12, fontSize: 13 }}
        >
          Ignore
        </button>
      </div>
    </div>
  </div>
)}
<BottomNav />
    </>
  );
}