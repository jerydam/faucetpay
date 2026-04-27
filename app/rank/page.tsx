"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/hooks/use-wallet";
import { ArrowLeft, Swords, Search, ChevronUp, ChevronDown, Minus } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "https://faucetpay-backend.koyeb.app";
const WS_BASE  = API_BASE.replace(/^http/, "ws");

// ─── Tier system ──────────────────────────────────────────────────────────────

interface Tier {
  label: string; minWins: number; maxWins: number;
  stars: number; color: string; badge: string;
}

const TIERS: Tier[] = [
  { label: "Droplet",  minWins: 0,   maxWins: 100,     stars: 1, color: "#9ca3af", badge: "💧" },
  { label: "Drizzle",  minWins: 101, maxWins: 200,     stars: 2, color: "#60a5fa", badge: "🌧️" },
  { label: "Downpour", minWins: 201, maxWins: 300,     stars: 3, color: "#34d399", badge: "⛈️" },
  { label: "Torrent",  minWins: 301, maxWins: 400,     stars: 4, color: "#fbbf24", badge: "🌊" },
  { label: "Flood",    minWins: 401, maxWins: Infinity, stars: 5, color: "#f87171", badge: "🏆" },
];

function getTier(wins: number): Tier {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (wins >= TIERS[i].minWins) return TIERS[i];
  }
  return TIERS[0];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StarDisplay({ count, color, size = 14 }: { count: number; color: string; size?: number }) {
  return (
    <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24"
          fill={i < count ? color : "none"}
          stroke={i < count ? color : "var(--dd-line)"}
          strokeWidth={1.5}
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </div>
  );
}

function RankDelta({ delta }: { delta: number }) {
  if (delta === 0) return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 2,
      fontSize: 9, fontWeight: 700, color: "var(--dd-text-muted)",
      background: "var(--dd-card)", padding: "2px 5px", borderRadius: 5,
      border: "1px solid var(--dd-line)",
    }}>
      <Minus size={8} /> —
    </span>
  );
  const up = delta > 0;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 2,
      fontSize: 9, fontWeight: 800,
      color:      up ? "#34d399" : "#f87171",
      background: up ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)",
      border:     `1px solid ${up ? "rgba(52,211,153,0.25)" : "rgba(248,113,113,0.25)"}`,
      padding: "2px 5px", borderRadius: 5,
    }}>
      {up ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
      {Math.abs(delta)}
    </span>
  );
}

// ─── Online dot ───────────────────────────────────────────────────────────────

function OnlineDot({ online }: { online: boolean }) {
  return (
    <span style={{
      display: "inline-block",
      width: 8, height: 8,
      borderRadius: "50%",
      background: online ? "#22c55e" : "#6b7280",
      flexShrink: 0,
      boxShadow: online ? "0 0 0 2px rgba(34,197,94,0.2)" : "none",
    }} title={online ? "Online" : "Offline"} />
  );
}

interface Player {
  wallet_address: string;
  username: string;
  avatar_url?: string;
  total_wins: number;
  total_duels: number;
  total_earned: number;
  rank_delta: number;
}

// ─── Podium Card ──────────────────────────────────────────────────────────────

function PodiumCard({
  player, place, myWallet, onDuel, online,
}: {
  player: Player; place: number; myWallet: string;
  onDuel: (w: string, username: string) => void; online: boolean;
}) {
  const tier    = getTier(player.total_wins);
  const isMe    = player.wallet_address.toLowerCase() === myWallet.toLowerCase();
  const initial = player.username?.slice(0, 2).toUpperCase() || "??";
  const medals  = ["🥇", "🥈", "🥉"];
  const isFirst = place === 1;

  return (
    <div
      className={`podium-card${isFirst ? " podium-first" : ""}`}
    >
      {isFirst && <span className="crown-emoji">👑</span>}

      <div style={{ position: "relative", display: "inline-block" }}>
        <div
          className="podium-avatar"
          style={{
            background: `${tier.color}22`, color: tier.color,
            width: isFirst ? 60 : 48, height: isFirst ? 60 : 48,
            fontSize: isFirst ? 22 : 17, overflow: "hidden", padding: 0,
          }}
        >
          {player.avatar_url ? (
            <img src={player.avatar_url} alt={player.username}
              style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }}
              onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ) : initial}
        </div>
        {/* Adjusted online dot placement to ensure visibility */}
        <span style={{
          position: "absolute", bottom: -2, right: -2,
          width: 14, height: 14, borderRadius: "50%",
          background: online ? "#22c55e" : "#6b7280",
          border: "3px solid var(--dd-bg)",
          zIndex: 10,
        }} />
      </div>

      <span className="podium-name">{player.username}</span>
      <StarDisplay count={tier.stars} color={tier.color} size={isFirst ? 13 : 11} />
      <span style={{ fontSize: 12, color: "#34d399", fontWeight: 700 }}>{player.total_wins}W</span>
      <RankDelta delta={player.rank_delta} />
      <span style={{ fontSize: 18 }}>{medals[place - 1]}</span>

      {/* Only show Duel if NOT me */}
      {!isMe && (
        <button
          className="podium-duel-btn"
          onClick={() => onDuel(player.wallet_address, player.username)}
          disabled={!online}
        >
          {online ? "Duel ↗" : "Offline"}
        </button>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RanksPage() {
  const router = useRouter();
  const { address: myWallet } = useWallet();

  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [filter, setFilter] = useState<"all" | "top10" | "myrank" | "online">("top10");


  // ── Online presence: map of wallet → boolean ──
  const [onlineSet, setOnlineSet] = useState<Set<string>>(new Set());
  const presenceWsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/ranks`)
      .then(r => r.json())
      .then(d => { if (d.success) setPlayers(d.players ?? []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ── Connect to presence endpoint once players are loaded ──
  useEffect(() => {
    if (!players.length) return;

    // Use a lightweight WS endpoint that broadcasts the set of online wallets.
    // The backend pushes { type: "presence", online: ["0x...", ...] } periodically.
    const ws = new WebSocket(`${WS_BASE}/ws/presence`);
    presenceWsRef.current = ws;

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "presence" && Array.isArray(msg.online)) {
          setOnlineSet(new Set(msg.online.map((w: string) => w.toLowerCase())));
        }
      } catch {}
    };

    // Announce our own wallet if connected
    ws.onopen = () => {
      if (myWallet) ws.send(JSON.stringify({ type: "hello", wallet: myWallet }));
    };

    return () => { ws.close(); };
  }, [players.length, myWallet]);

  const isOnline = (wallet: string) => onlineSet.has(wallet.toLowerCase());

  // ── Duel routing — always private invite ──
  const handleDuel = (targetWallet: string, targetUsername: string) => {
    // Route to create page with private invite pre-filled (username + wallet)
    const params = new URLSearchParams({
      inviteUsername: targetUsername,
      inviteWallet:   targetWallet,
    });
    router.push(`/challenge/create?${params.toString()}`);
  };

  const filtered = useMemo(() => {
    let list = [...players];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.username.toLowerCase().includes(q) ||
        p.wallet_address.toLowerCase().includes(q),
      );
    }
    if (filter === "top10") list = list.slice(0, 10);
    if (filter === "myrank" && myWallet) {
      const myIdx = list.findIndex(p => p.wallet_address.toLowerCase() === myWallet.toLowerCase());
      if (myIdx !== -1) {
        const start = Math.max(0, myIdx - 4);
        list = list.slice(start, start + 10);
      }
    }
    return list;
  }, [players, search, filter, myWallet]);

  const myEntry = players.find(p => p.wallet_address.toLowerCase() === (myWallet?.toLowerCase() ?? ""));
  const myRank  = myEntry ? players.indexOf(myEntry) + 1 : null;
  const myTier  = myEntry ? getTier(myEntry.total_wins) : TIERS[0];
  const tierProgress = myEntry && myTier.maxWins !== Infinity
    ? Math.min(100, Math.round(((myEntry.total_wins - myTier.minWins) / (myTier.maxWins - myTier.minWins)) * 100))
    : 100;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;900&family=Figtree:wght@400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .ranks-page {
          min-height: 100vh; background: var(--dd-bg); color: var(--dd-text);
          font-family: 'Figtree', sans-serif; max-width: 480px; margin: 0 auto; padding-bottom: 100px;
        }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shimmer { 0%,100% { opacity: 0.6; } 50% { opacity: 1; } }
        .fade-up { animation: fadeUp 0.4s ease forwards; }
        .skeleton { background: var(--dd-line); border-radius: 10px; animation: shimmer 1.4s ease infinite; }
        .ranks-header { display: flex; align-items: center; gap: 12px; padding: 20px 16px 14px; }
        .back-btn {
          width: 36px; height: 36px; border-radius: 10px;
          background: var(--dd-card); border: 1px solid var(--dd-line);
          cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .page-title {
          font-family: 'Big Shoulders Display', sans-serif;
          font-size: 26px; font-weight: 900; line-height: 1;
          letter-spacing: -0.01em; color: var(--dd-text);
        }
        .page-subtitle { font-size: 12px; color: var(--dd-text-muted); font-weight: 500; margin-top: 2px; }
        .my-banner {
          margin: 0 16px 16px; padding: 14px 16px; border-radius: 14px;
          background: rgba(37,99,235,0.1); border: 1px solid rgba(37,99,235,0.3);
        }
        .my-banner-top { display: flex; align-items: flex-start; justify-content: space-between; }
        .my-banner-left { display: flex; flex-direction: column; gap: 4; }
        .my-banner-label { font-size: 11px; color: var(--dd-text-muted); font-weight: 500; }
        .my-banner-rank { font-family: 'Big Shoulders Display', sans-serif; font-size: 32px; font-weight: 900; color: var(--dd-blue); line-height: 1; }
        .my-banner-tier { font-size: 12px; color: var(--dd-text-muted); margin-top: 4px; }
        .my-banner-right { text-align: right; }
        .my-banner-username { font-size: 13px; font-weight: 700; color: var(--dd-text); }
        .my-banner-record { font-size: 13px; font-weight: 700; color: #34d399; margin-top: 2px; }
        .my-banner-delta { display: flex; justify-content: flex-end; margin-top: 4px; }
        .tier-progress-row { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; margin-bottom: 4px; }
        .tier-progress-label { font-size: 10px; color: var(--dd-text-muted); }
        .tier-progress-pct   { font-size: 10px; font-weight: 700; }
        .tier-progress-track { height: 4px; background: var(--dd-line); border-radius: 9999; overflow: hidden; }
        .tier-progress-fill  { height: 100%; border-radius: 9999; transition: width 0.6s ease; }
        .podium-wrap { display: flex; align-items: flex-end; justify-content: center; gap: 8px; padding: 0 16px 20px; }
        .podium-card {
          flex: 1; display: flex; flex-direction: column; align-items: center;
          gap: 6px; padding: 14px 6px 12px; border-radius: 16px;
          background: var(--dd-card); border: 1px solid var(--dd-line);
          cursor: pointer; transition: border-color 0.2s, transform 0.2s;
        }
        .podium-card:hover { border-color: rgba(37,99,235,0.4); }
        .podium-first { border-color: rgba(251,191,36,0.4); background: rgba(251,191,36,0.06); transform: translateY(-10px); }
        .podium-avatar {
          border-radius: 12px; display: flex; align-items: center; justify-content: center;
          font-family: 'Big Shoulders Display', sans-serif; font-weight: 900; flex-shrink: 0;
        }
        .podium-name {
          font-family: 'Big Shoulders Display', sans-serif; font-size: 12px; font-weight: 700;
          color: var(--dd-text); text-align: center; max-width: 100%;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .podium-duel-btn {
          font-size: 11px; font-weight: 700; padding: 5px 12px; border-radius: 8px;
          background: var(--dd-blue); border: none; color: #fff; cursor: pointer; transition: background 0.15s;
        }
        .podium-duel-btn:hover:not(:disabled) { background: var(--dd-blue2, #1d4ed8); }
        .podium-duel-btn:disabled {
          background: var(--dd-line); color: var(--dd-dim); cursor: not-allowed;
        }
        .crown-emoji { font-size: 20px; animation: shimmer 2s ease infinite; }
        .search-wrap { position: relative; margin: 0 16px 12px; }
        .search-input {
          width: 100%; height: 44px; padding: 0 14px 0 42px;
          background: var(--dd-card); border: 1px solid var(--dd-line);
          border-radius: 12px; color: var(--dd-text);
          font-family: 'Figtree', sans-serif; font-size: 14px; outline: none; transition: border-color 0.2s;
        }
        .search-input::placeholder { color: var(--dd-dim); }
        .search-input:focus { border-color: rgba(37,99,235,0.5); }
        .search-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); pointer-events: none; opacity: 0.35; }
        .filter-row { display: flex; gap: 8px; padding: 0 16px 14px; overflow-x: auto; }
        .filter-pill {
          padding: 7px 16px; border-radius: 99px; border: 1.5px solid var(--dd-line);
          background: transparent; color: var(--dd-dim);
          font-family: 'Figtree', sans-serif; font-size: 12px; font-weight: 700;
          cursor: pointer; transition: all 0.15s; flex-shrink: 0; white-space: nowrap;
        }
        .filter-pill.active { background: var(--dd-blue); border-color: var(--dd-blue); color: #fff; }
        .filter-pill:hover:not(.active) { border-color: rgba(37,99,235,0.4); color: var(--dd-text); }
        .tier-legend { display: grid; grid-template-columns: repeat(5,1fr); gap: 6px; padding: 0 16px 16px; }
        .tier-legend-cell { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 8px 4px; border-radius: 10px; background: var(--dd-card); }
        .tier-legend-name { font-size: 9px; font-weight: 700; text-align: center; line-height: 1; }
        .tier-legend-range { font-size: 8px; color: var(--dd-text-muted); text-align: center; line-height: 1; }
        .player-row {
          display: flex; align-items: center; gap: 10px;
          padding: 12px 14px; border-radius: 14px;
          background: var(--dd-card); border: 1px solid var(--dd-line);
          cursor: pointer; transition: border-color 0.2s, background 0.2s;
          margin-bottom: 8px;
          align-items: center;
          animation: fadeUp 0.35s ease forwards; opacity: 0;
        }
        .player-name {
          font-weight: 700;
          font-size: 13px;
          color: var(--dd-text);
          word-break: break-word;
        }

        .player-name-row {
          display: flex;
          align-items: center;
          gap: 5px;
          flex-wrap: wrap;        /* ← lets badges wrap instead of squeezing the name */
        }

        .player-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 3px;
          overflow: visible;      /* ← was clipping on small screens */
        }  
        .player-row:hover { border-color: rgba(37,99,235,0.4); background: rgba(37,99,235,0.04); }
        .player-row.me    { border-color: rgba(37,99,235,0.5); background: rgba(37,99,235,0.08); }
        .rank-num { font-family: 'Big Shoulders Display', sans-serif; font-size: 16px; font-weight: 900; min-width: 28px; text-align: center; flex-shrink: 0; }
        .avatar { width: 38px; height: 38px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-family: 'Big Shoulders Display', sans-serif; font-size: 14px; font-weight: 900; flex-shrink: 0; position: relative; }
        .you-badge { font-size: 8px; font-weight: 800; background: var(--dd-blue); color: #fff; padding: 2px 5px; border-radius: 4px; flex-shrink: 0; }
        .online-label { font-size: 9px; color: #22c55e; font-weight: 600; flex-shrink: 0; }
        .offline-label { font-size: 9px; color: var(--dd-text-muted); font-weight: 500; flex-shrink: 0; }
        .player-meta { display: flex; gap: 8px; margin-top: 1px; }
        .player-meta-item { font-size: 11px; color: var(--dd-text-muted); }
        .player-right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; min-width: 64px; }
        .player-wins { font-family: 'Big Shoulders Display', sans-serif; font-size: 15px; font-weight: 900; color: var(--dd-text); line-height: 1; }
        .win-bar-row { display: flex; align-items: center; gap: 5px; }
        .win-bar-track { width: 52px; height: 4px; background: var(--dd-line); border-radius: 9999; overflow: hidden; }
        .win-bar-fill { height: 100%; border-radius: 9999; transition: width 0.6s ease; }
        .win-pct { font-size: 10px; font-weight: 700; min-width: 28px; text-align: right; }
        .duel-btn {
          padding: 6px 12px; border-radius: 9px;
          background: var(--dd-blue); border: none; color: #fff;
          font-family: 'Figtree', sans-serif; font-size: 11px; font-weight: 700;
          cursor: pointer; display: flex; align-items: center; gap: 4px;
          white-space: nowrap; transition: background 0.15s, transform 0.12s; flex-shrink: 0;
        }
        .duel-btn:hover:not(:disabled)  { background: var(--dd-blue2, #1d4ed8); }
        .duel-btn:active:not(:disabled) { transform: scale(0.95); }
        .duel-btn:disabled { background: var(--dd-line); color: var(--dd-dim); cursor: not-allowed; }
      `}</style>

      <div className="ranks-page">

        {/* Header */}
        <div className="ranks-header">
          <button className="back-btn" onClick={() => router.back()}>
            <ArrowLeft size={16} color="var(--dd-text)" />
          </button>
          <div>
            <div className="page-title">Rankings</div>
            <div className="page-subtitle">
              {players.length} duelists · {onlineSet.size} online
            </div>
          </div>
        </div>

        {/* My Position Banner */}
        {myEntry && (
          <div className="my-banner fade-up">
            <div className="my-banner-top">
              <div className="my-banner-left">
                <span className="my-banner-label">Your position</span>
                <span className="my-banner-rank">#{myRank}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                  <StarDisplay count={myTier.stars} color={myTier.color} size={12} />
                  <span className="my-banner-tier">{myTier.label}</span>
                </div>
              </div>
              <div className="my-banner-right">
                <div className="my-banner-username">{myEntry.username}</div>
                <div className="my-banner-record">{myEntry.total_wins}W / {myEntry.total_duels}D</div>
                <div className="my-banner-delta">
                  
                </div>
              </div>
            </div>
            {myTier.maxWins !== Infinity && (
              <>
                <div className="tier-progress-row">
                  <span className="tier-progress-label">
                    {myEntry.total_wins - myTier.minWins}/{myTier.maxWins - myTier.minWins} wins to {TIERS[myTier.stars]?.label}
                  </span>
                  <span className="tier-progress-pct" style={{ color: myTier.color }}>{tierProgress}%</span>
                </div>
                <div className="tier-progress-track">
                  <div className="tier-progress-fill" style={{ width: `${tierProgress}%`, background: myTier.color }} />
                </div>
              </>
            )}
          </div>
        )}

        {/* Podium Top 3 */}
        {!loading && players.length >= 3 && (
          <div className="podium-wrap fade-up">
            {[
              { playerIdx: 1, place: 2 },  // 3rd — left
              { playerIdx: 0, place: 1 },  // 1st — center (elevated)
              { playerIdx: 2, place: 3 },  // 2nd — right
            ].map(({ playerIdx, place }) => (
              <PodiumCard
                key={players[playerIdx].wallet_address}
                player={players[playerIdx]}
                place={place}
                myWallet={myWallet ?? ""}
                onDuel={handleDuel}
                online={isOnline(players[playerIdx].wallet_address)}
              />
            ))}

          </div>
        )}

        {/* Search */}
        <div className="search-wrap">
          <Search size={15} color="var(--dd-text)" className="search-icon" />
          <input
            className="search-input"
            placeholder="Search player…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Filter Pills — added Online filter */}
        <div className="filter-row">
          {(["top10", "all", "myrank", "online"] as const).map(f => (
            <button
              key={f}
              className={`filter-pill${filter === f ? " active" : ""}`}
              onClick={() => setFilter(f as any)}
            >
              {f === "top10" ? "Top 10" : f === "all" ? "All" : f === "myrank" ? "Near me" : "🟢 Online"}
            </button>
          ))}
        </div>

        {/* Tier Legend */}
        <div className="tier-legend">
          {TIERS.map(t => (
            <div key={t.label} className="tier-legend-cell" style={{ border: `1px solid ${t.color}33` }}>
              <StarDisplay count={t.stars} color={t.color} size={9} />
              <span className="tier-legend-name" style={{ color: t.color }}>{t.label}</span>
              <span className="tier-legend-range">
                {t.maxWins === Infinity ? `${t.minWins}+` : `${t.minWins}–${t.maxWins}`}
              </span>
            </div>
          ))}
        </div>

        {/* Player List */}
        <div style={{ padding: "0 16px" }}>
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 70, marginBottom: 8 }} />
            ))
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 0", color: "var(--dd-text-muted)", fontSize: 14 }}>
              No players found
            </div>
          ) : (
            filtered
              // Apply online filter
              .filter(p => (filter as string) === "online" ? isOnline(p.wallet_address) : true)
              .map((player, idx) => {
                const globalRank = players.indexOf(player) + 1;
                const tier       = getTier(player.total_wins);
                const isMe       = player.wallet_address.toLowerCase() === (myWallet?.toLowerCase() ?? "");
                const online     = isOnline(player.wallet_address);
                const initial    = player.username?.slice(0, 2).toUpperCase() || "??";
                const pct        = player.total_duels === 0 ? 0 : Math.round((player.total_wins / player.total_duels) * 100);
                const barColor   = pct >= 60 ? "#34d399" : pct >= 40 ? "#fbbf24" : "#f87171";

                return (
                  <div
                    key={player.wallet_address}
                    className={`player-row${isMe ? " me" : ""}`}
                    style={{ animationDelay: `${idx * 0.04}s` }}
                  >
                    {/* Rank */}
                    <span className="rank-num" style={{
                      color: globalRank === 1 ? "#fbbf24" : globalRank === 2 ? "#9ca3af" : globalRank === 3 ? "#d97706" : "var(--dd-dim)",
                    }}>
                      {globalRank <= 3 ? ["🥇", "🥈", "🥉"][globalRank - 1] : `#${globalRank}`}
                    </span>

                    {/* Wrapper for avatar to allow absolute positioning without clipping */}
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      <div className="avatar" style={{ background: `${tier.color}22`, color: tier.color, overflow: "hidden", padding: 0 }}>
                        {player.avatar_url ? (
                          <img src={player.avatar_url} alt={player.username}
                            style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }}
                            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                          />
                        ) : initial}
                      </div>
                      <span style={{
                        position: "absolute", bottom: -2, right: -2,
                        width: 12, height: 12, borderRadius: "50%",
                        background: online ? "#22c55e" : "#6b7280",
                        border: "2px solid var(--dd-card)",
                        zIndex: 10
                      }} />
                    </div>

                    {/* Info */}
                    <div className="player-info">
                      <div className="player-name-row">
                        <span className="player-name">{player.username}</span>
                        {isMe && <span className="you-badge">you</span>}
                        
                        
                      </div>
                      <StarDisplay count={tier.stars} color={tier.color} size={11} />
                      <div className="player-meta">
                        <span className="player-meta-item">
                          <span style={{ color: "#34d399", fontWeight: 700 }}>{player.total_wins}</span>W
                          {" / "}
                          <span style={{ fontWeight: 600, color: "var(--dd-text)" }}>{player.total_duels}</span>D
                        </span>
                        {player.total_earned > 0 && (
                          <span className="player-meta-item">· {player.total_earned.toFixed(1)} earned</span>
                        )}
                      </div>
                    </div>

                    {/* Right: wins + winrate bar */}
                    <div className="player-right">
                      <span className="player-wins" style={{ color: "#34d399" }}>{player.total_wins}W</span>
                      <div className="win-bar-row">
                        <div className="win-bar-track">
                          <div className="win-bar-fill" style={{ width: `${pct}%`, background: barColor }} />
                        </div>
                        <span className="win-pct" style={{ color: barColor }}>{pct}%</span>
                      </div>
                    </div>

                    {/* Duel button — hidden for own wallet, disabled for offline players */}
                    {!isMe && (
                      <button
                        className="duel-btn"
                        onClick={e => {
                          e.stopPropagation();
                          handleDuel(player.wallet_address, player.username);
                        }}
                        disabled={!online}
                      >
                        <Swords size={11} /> {online ? "Duel ↗" : "Offline"}
                      </button>
                    )}
                  </div>
                );
              })
          )}
        </div>
      </div>
    </>
  );
}