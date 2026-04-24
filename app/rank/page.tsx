"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/hooks/use-wallet";
import { ArrowLeft, Swords, Search, ChevronUp, ChevronDown, Minus } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "https://faucetpay-backend.koyeb.app";

// ─── Tier system (win ranges) ─────────────────────────────────────────────────

interface Tier {
  label: string;
  minWins: number;
  maxWins: number;
  stars: number;
  color: string;
  glow: string;
  badge: string;
}

const TIERS: Tier[] = [
  { label: "Rookie",   minWins: 0,   maxWins: 100,      stars: 1, color: "#9ca3af", glow: "rgba(156,163,175,0.25)", badge: "🥉" },
  { label: "Hustler",  minWins: 101, maxWins: 200,      stars: 2, color: "#60a5fa", glow: "rgba(96,165,250,0.25)",  badge: "🔵" },
  { label: "Duelist",  minWins: 201, maxWins: 300,      stars: 3, color: "#34d399", glow: "rgba(52,211,153,0.25)",  badge: "🟢" },
  { label: "Veteran",  minWins: 301, maxWins: 400,      stars: 4, color: "#fbbf24", glow: "rgba(251,191,36,0.25)",  badge: "🌟" },
  { label: "Champion", minWins: 401, maxWins: Infinity,  stars: 5, color: "#f87171", glow: "rgba(248,113,113,0.30)", badge: "🏆" },
];

function getTier(wins: number): Tier {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (wins >= TIERS[i].minWins) return TIERS[i];
  }
  return TIERS[0];
}

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

function WinRateBar({ wins, total }: { wins: number; total: number }) {
  const pct   = total === 0 ? 0 : Math.round((wins / total) * 100);
  const color = pct >= 60 ? "#34d399" : pct >= 40 ? "#fbbf24" : "#f87171";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ flex: 1, height: 4, background: "var(--dd-line)", borderRadius: 9999, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 9999, transition: "width 0.6s ease" }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color, minWidth: 32 }}>{pct}%</span>
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

interface Player {
  wallet_address: string;
  username: string;
  avatar_url?: string;
  total_wins: number;
  total_duels: number;
  total_earned: number;
  rank_delta: number;
}

export default function RanksPage() {
  const router = useRouter();
  const { address: myWallet } = useWallet();

  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [filter, setFilter]   = useState<"all" | "top10" | "myrank">("top10");

  useEffect(() => {
    fetch(`${API_BASE}/api/ranks`)
      .then(r => r.json())
      .then(d => { if (d.success) setPlayers(d.players ?? []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let list = [...players];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.username.toLowerCase().includes(q) ||
        p.wallet_address.toLowerCase().includes(q)
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

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;900&family=Figtree:wght@400;500;600;700&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        .ranks-page {
          min-height: 100vh;
          background: var(--dd-bg);
          color: var(--dd-text);
          font-family: 'Figtree', sans-serif;
          max-width: 480px;
          margin: 0 auto;
          padding-bottom: 100px;
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fade-up { animation: fadeUp 0.4s ease forwards; }

        .filter-pill {
          padding: 6px 14px; border-radius: 99px;
          border: 1.5px solid var(--dd-line);
          background: transparent; color: var(--dd-dim);
          font-family: 'Figtree', sans-serif;
          font-size: 12px; font-weight: 700;
          cursor: pointer; transition: all 0.15s; flex-shrink: 0;
        }
        .filter-pill.active { background: var(--dd-blue); border-color: var(--dd-blue); color: #fff; }
        .filter-pill:hover:not(.active) { border-color: rgba(37,99,235,0.4); color: var(--dd-text); }

        .player-row {
          display: flex; align-items: center; gap: 12px;
          padding: 14px 16px; border-radius: 14px;
          background: var(--dd-card); border: 1px solid var(--dd-line);
          cursor: pointer; transition: border-color 0.2s, background 0.2s;
          margin-bottom: 8px;
          animation: fadeUp 0.35s ease forwards; opacity: 0;
        }
        .player-row:hover { border-color: rgba(37,99,235,0.4); background: rgba(37,99,235,0.05); }
        .player-row.me    { border-color: rgba(37,99,235,0.5); background: rgba(37,99,235,0.08); }

        .avatar {
          width: 40px; height: 40px; border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          font-family: 'Big Shoulders Display', sans-serif;
          font-size: 16px; font-weight: 900; flex-shrink: 0;
        }
        .rank-num {
          font-family: 'Big Shoulders Display', sans-serif;
          font-size: 18px; font-weight: 900; min-width: 30px; text-align: center;
        }
        .duel-btn {
          padding: 7px 14px; border-radius: 10px;
          background: var(--dd-blue); border: none; color: #fff;
          font-family: 'Figtree', sans-serif; font-size: 12px; font-weight: 700;
          cursor: pointer; display: flex; align-items: center; gap: 5px;
          white-space: nowrap; transition: background 0.15s, transform 0.12s; flex-shrink: 0;
        }
        .duel-btn:hover  { background: var(--dd-blue2); }
        .duel-btn:active { transform: scale(0.95); }

        .search-wrap { position: relative; margin: 0 16px 16px; }
        .search-input {
          width: 100%; height: 44px; padding: 0 14px 0 40px;
          background: var(--dd-card); border: 1px solid var(--dd-line);
          border-radius: 12px; color: var(--dd-text);
          font-family: 'Figtree', sans-serif; font-size: 14px;
          outline: none; transition: border-color 0.2s;
        }
        .search-input::placeholder { color: var(--dd-dim); }
        .search-input:focus { border-color: rgba(37,99,235,0.5); }
        .search-icon {
          position: absolute; left: 13px; top: 50%;
          transform: translateY(-50%); pointer-events: none; opacity: 0.35;
        }

        .podium-wrap {
          display: flex; align-items: flex-end; justify-content: center;
          gap: 8px; padding: 24px 16px 20px;
        }
        .podium-card {
          flex: 1; display: flex; flex-direction: column; align-items: center;
          gap: 8px; padding: 16px 8px 12px; border-radius: 18px;
          border: 1px solid var(--dd-line); background: var(--dd-card);
          cursor: pointer; transition: border-color 0.2s;
        }
        .podium-card:hover { border-color: rgba(37,99,235,0.4); }
        .podium-card.first {
          background: rgba(251,191,36,0.06); border-color: rgba(251,191,36,0.3);
          transform: translateY(-8px);
        }
        .podium-avatar {
          width: 52px; height: 52px; border-radius: 14px;
          display: flex; align-items: center; justify-content: center;
          font-family: 'Big Shoulders Display', sans-serif; font-size: 20px; font-weight: 900;
        }
        .podium-card.first .podium-avatar { width: 60px; height: 60px; font-size: 24px; }

        @keyframes shimmer { 0% { opacity: 0.6; } 50% { opacity: 1; } 100% { opacity: 0.6; } }
        .crown { animation: shimmer 2s ease infinite; }
        .skeleton { background: var(--dd-line); border-radius: 10px; animation: shimmer 1.4s ease infinite; }
      `}</style>

      <div className="ranks-page">

        {/* ── Header ── */}
        <div style={{ padding: "20px 16px 0", display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => router.back()} style={{
            width: 36, height: 36, borderRadius: 10,
            background: "var(--dd-card)", border: "1px solid var(--dd-line)",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <ArrowLeft size={16} color="var(--dd-text)" />
          </button>
          <div>
            <h1 style={{ fontFamily: "'Big Shoulders Display', sans-serif", fontSize: 28, fontWeight: 900, lineHeight: 1, letterSpacing: "-0.01em", color: "var(--dd-text)" }}>
              RANKS
            </h1>
            <p style={{ fontSize: 12, color: "var(--dd-text-muted)", fontWeight: 500, marginTop: 2 }}>
              {players.length} duelists ranked by wins
            </p>
          </div>
        </div>

        {/* ── My rank banner ── */}
        {myEntry && (
          <div className="fade-up" style={{ margin: "16px 16px 0", padding: "14px 16px", borderRadius: 14, background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.3)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ fontFamily: "'Big Shoulders Display', sans-serif", fontSize: 22, fontWeight: 900, color: "var(--dd-blue)" }}>
                  #{myRank}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "var(--dd-text)" }}>Your rank</p>
                    <RankDelta delta={myEntry.rank_delta} />
                  </div>
                  <StarDisplay count={myTier.stars} color={myTier.color} size={12} />
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontSize: 12, color: "var(--dd-text-muted)" }}>{myTier.label}</p>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#34d399" }}>{myEntry.total_wins}W / {myEntry.total_duels}D</p>
              </div>
            </div>
            {/* Progress to next tier */}
            {myTier.maxWins !== Infinity && (
              <div style={{ marginTop: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: "var(--dd-text-muted)" }}>
                    {myEntry.total_wins - myTier.minWins} / {myTier.maxWins - myTier.minWins} wins to next tier
                  </span>
                  <span style={{ fontSize: 10, color: myTier.color, fontWeight: 700 }}>
                    {Math.round(((myEntry.total_wins - myTier.minWins) / (myTier.maxWins - myTier.minWins)) * 100)}%
                  </span>
                </div>
                <div style={{ height: 4, background: "var(--dd-line)", borderRadius: 9999, overflow: "hidden" }}>
                  <div style={{
                    height: "100%",
                    width: `${Math.min(100, Math.round(((myEntry.total_wins - myTier.minWins) / (myTier.maxWins - myTier.minWins)) * 100))}%`,
                    background: myTier.color, borderRadius: 9999, transition: "width 0.6s ease",
                  }} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Podium top 3 ── */}
        {!loading && players.length >= 3 && (
          <div className="podium-wrap fade-up">
            <PodiumCard player={players[1]} place={2} myWallet={myWallet ?? ""} onDuel={w => router.push(`/challenge/create?invite=${w}`)} />
            <PodiumCard player={players[0]} place={1} myWallet={myWallet ?? ""} onDuel={w => router.push(`/challenge/create?invite=${w}`)} />
            <PodiumCard player={players[2]} place={3} myWallet={myWallet ?? ""} onDuel={w => router.push(`/challenge/create?invite=${w}`)} />
          </div>
        )}

        {/* ── Search ── */}
        <div className="search-wrap">
          <Search size={15} color="var(--dd-text)" className="search-icon" />
          <input
            className="search-input"
            placeholder="Search username or wallet…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* ── Filters ── */}
        <div style={{ display: "flex", gap: 8, padding: "0 16px 16px", overflowX: "auto" }}>
          {(["all", "top10", "myrank"] as const).map(f => (
            <button key={f} className={`filter-pill ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
              {f === "all" ? "All players" : f === "top10" ? "Top 10" : "Near me"}
            </button>
          ))}
        </div>

        {/* ── Tier legend ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6, padding: "0 16px 16px" }}>
          {TIERS.map(t => (
            <div key={t.label} style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              padding: "8px 4px", borderRadius: 10,
              background: "var(--dd-card)", border: `1px solid ${t.color}33`,
            }}>
              <StarDisplay count={t.stars} color={t.color} size={9} />
              <span style={{ fontSize: 9, fontWeight: 700, color: t.color, textAlign: "center", lineHeight: 1 }}>
                {t.label}
              </span>
              <span style={{ fontSize: 8, color: "var(--dd-text-muted)", textAlign: "center", lineHeight: 1 }}>
                {t.maxWins === Infinity ? `${t.minWins}+` : `${t.minWins}–${t.maxWins}`}
              </span>
            </div>
          ))}
        </div>

        {/* ── List ── */}
        <div style={{ padding: "0 16px" }}>
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 72, marginBottom: 8 }} />
            ))
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 0", color: "var(--dd-text-muted)", fontSize: 14 }}>
              No players found
            </div>
          ) : (
            filtered.map((player, idx) => {
              const globalRank = players.indexOf(player) + 1;
              const tier       = getTier(player.total_wins);
              const isMe       = player.wallet_address.toLowerCase() === (myWallet?.toLowerCase() ?? "");
              const initial    = player.username?.slice(0, 2).toUpperCase() || "??";

              return (
                <div key={player.wallet_address} className={`player-row${isMe ? " me" : ""}`} style={{ animationDelay: `${idx * 0.04}s` }}>

                  <span className="rank-num" style={{
                    color: globalRank === 1 ? "#fbbf24" : globalRank === 2 ? "#9ca3af" : globalRank === 3 ? "#d97706" : "var(--dd-dim)",
                  }}>
                    {globalRank <= 3 ? ["🥇","🥈","🥉"][globalRank - 1] : `#${globalRank}`}
                  </span>

                  <div className="avatar" style={{ background: `${tier.color}22`, color: tier.color }}>{initial}</div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: "var(--dd-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {player.username}
                      </span>
                      {isMe && (
                        <span style={{ fontSize: 9, fontWeight: 700, background: "var(--dd-blue)", color: "#fff", padding: "2px 6px", borderRadius: 5, flexShrink: 0 }}>
                          YOU
                        </span>
                      )}
                      <RankDelta delta={player.rank_delta} />
                    </div>
                    <StarDisplay count={tier.stars} color={tier.color} size={12} />
                    <WinRateBar wins={player.total_wins} total={player.total_duels} />
                    <div style={{ display: "flex", gap: 10, marginTop: 3 }}>
                      <span style={{ fontSize: 11, color: "var(--dd-text-muted)" }}>
                        <span style={{ color: "#34d399", fontWeight: 700 }}>{player.total_wins}</span>W
                        {" / "}
                        <span style={{ fontWeight: 600, color: "var(--dd-text)" }}>{player.total_duels}</span>D
                      </span>
                      {player.total_earned > 0 && (
                        <span style={{ fontSize: 11, color: "var(--dd-text-muted)" }}>
                          {player.total_earned.toFixed(1)} earned
                        </span>
                      )}
                    </div>
                  </div>

                  {!isMe && (
                    <button className="duel-btn" onClick={e => { e.stopPropagation(); router.push(`/challenge/create?invite=${player.wallet_address}`); }}>
                      <Swords size={12} /> Duel
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

// ─── Podium card ──────────────────────────────────────────────────────────────

function PodiumCard({ player, place, myWallet, onDuel }: {
  player: Player; place: number; myWallet: string; onDuel: (wallet: string) => void;
}) {
  const tier       = getTier(player.total_wins);
  const isMe       = player.wallet_address.toLowerCase() === myWallet.toLowerCase();
  const initial    = player.username?.slice(0, 2).toUpperCase() || "??";
  const placeEmoji = ["🥇","🥈","🥉"][place - 1];

  return (
    <div className={`podium-card${place === 1 ? " first" : ""}`} style={{ order: place === 1 ? 0 : place === 2 ? -1 : 1 }}>
      {place === 1 && <span style={{ fontSize: 20, animation: "shimmer 2s ease infinite" }}>👑</span>}
      <div className="podium-avatar" style={{ background: `${tier.color}22`, color: tier.color }}>{initial}</div>
      <span style={{ fontFamily: "'Big Shoulders Display', sans-serif", fontSize: 13, fontWeight: 700, color: "var(--dd-text)", textAlign: "center", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {player.username}
      </span>
      <StarDisplay count={tier.stars} color={tier.color} size={place === 1 ? 14 : 12} />
      <span style={{ fontSize: 11, color: "var(--dd-text-muted)" }}>{player.total_wins}W</span>
      <RankDelta delta={player.rank_delta} />
      <span style={{ fontSize: 16 }}>{placeEmoji}</span>
      {!isMe && (
        <button
          style={{ fontSize: 11, fontWeight: 700, padding: "5px 12px", borderRadius: 8, background: "var(--dd-blue)", border: "none", color: "#fff", cursor: "pointer" }}
          onClick={() => onDuel(player.wallet_address)}
        >
          Duel
        </button>
      )}
    </div>
  );
}