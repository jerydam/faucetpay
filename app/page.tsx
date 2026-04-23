"use client";

/**
 * /app/page.tsx — DropDuel MiniPay Landing
 * Minimal. Mobile-first. Strict palette: #020617 + #2563eb + white.
 * Font: Big Shoulders Display (display) + Figtree (body)
 */

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Zap, Trophy, Gavel, ArrowUpRight, ShieldCheck, Users } from "lucide-react";
import { ThemeToggle } from "@/components/theme";

export default function LandingPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [isMiniPay, setIsMiniPay] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 60);
    // Detect MiniPay — same flag used in WalletProvider
    setIsMiniPay(!!(window.ethereum as any)?.isMiniPay);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@400;700;900&family=Figtree:wght@400;500;600;700&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --bg:    #020617;
          --blue:  #2563eb;
          --blue2: #1d4ed8;
          --white: #ffffff;
          --dim:   rgba(255,255,255,0.45);
          --line:  rgba(255,255,255,0.07);
        }

        body { background: var(--bg); }

        .d  { font-family: 'Big Shoulders Display', sans-serif; }
        .b  { font-family: 'Figtree', sans-serif; }

        /* ── page load ── */
        @keyframes up {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        .r  { opacity: 0; animation: up .55s ease forwards; }
        .r1 { animation-delay: .05s; }
        .r2 { animation-delay: .15s; }
        .r3 { animation-delay: .25s; }
        .r4 { animation-delay: .38s; }
        .r5 { animation-delay: .50s; }

        /* ── blue accent pulse ── */
        @keyframes bpulse {
          0%,100% { opacity:.9; }
          50%      { opacity:.5; }
        }
        .live-dot { animation: bpulse 1.8s ease-in-out infinite; }

        /* ── card hover ── */
        .mode-card {
          transition: transform .22s ease, border-color .22s ease;
          cursor: pointer;
        }
        .mode-card:hover {
          transform: translateY(-3px);
          border-color: var(--blue) !important;
        }

        /* ── btn ── */
        .btn-blue {
          background: var(--blue);
          transition: background .2s, transform .15s;
        }
        .btn-blue:hover  { background: var(--blue2); }
        .btn-blue:active { transform: scale(.97); }

        .btn-ghost {
          border: 1.5px solid var(--line);
          transition: border-color .2s, background .2s, transform .15s;
        }
        .btn-ghost:hover  { border-color: rgba(37,99,235,.5); background: rgba(37,99,235,.06); }
        .btn-ghost:active { transform: scale(.97); }

        /* ── stat divider ── */
        .stat-row {
          border-top: 1px solid var(--line);
          border-bottom: 1px solid var(--line);
        }

        /* ── blue bar on card ── */
        .blue-bar::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 2px;
          background: var(--blue);
          transform: scaleX(0);
          transform-origin: left;
          transition: transform .3s ease;
        }
        .mode-card:hover .blue-bar::before { transform: scaleX(1); }

        /* ── number highlight ── */
        .num {
          font-family: 'Big Shoulders Display', sans-serif;
          font-weight: 900;
          line-height: 1;
          color: var(--white);
        }

        /* ── vertical rule ── */
        .vr { width: 1px; background: var(--line); align-self: stretch; }

        /* ── tag ── */
        .tag {
          font-family: 'Figtree', sans-serif;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: .18em;
          text-transform: uppercase;
        }
      `}</style>

      <div
        className={`b min-h-screen bg-[#020617] text-white flex flex-col transition-opacity duration-500 ${ready ? "opacity-100" : "opacity-0"}`}
        style={{ maxWidth: 480, margin: "0 auto" }}
      >

        {/* ── Nav ──────────────────────────────────────────────────────────── */}
        <nav className="r r1 flex items-center justify-between px-6 pt-8 pb-6">

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[#2563eb] flex items-center justify-center" style={{ borderRadius: 6 }}>
              <Zap className="h-4 w-4 text-white fill-white" />
            </div>
            <span className="d font-black text-xl tracking-tight text-white" style={{ letterSpacing: "-.01em" }}>
              DropDuel
            </span>
             <ThemeToggle />
          </div>

          
        </nav>

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section className="px-6 pb-10 flex-1 flex flex-col justify-center">

          
          {/* headline */}
          <h1 className="r r2 d font-black text-white leading-none mb-5" style={{ fontSize: "clamp(3.4rem, 14vw, 5rem)", letterSpacing: "-.01em" }}>
            STAKE.<br />
            <span style={{ color: "#2563eb" }}>PLAY.</span><br />
            EARN.
          </h1>

          <p className="r r3 b text-white/50 font-medium leading-relaxed mb-8" style={{ fontSize: 15, maxWidth: 320 }}>
            Challenge anyone on any topic. Negotiate the stake, answer faster, take the pool — secured on Celo.
          </p>

          {/* CTAs */}
          <div className="r r4 flex flex-col gap-3">
            <button
              onClick={() => router.push("/challenge")}
              className="btn-blue w-full h-14 text-white font-bold text-sm tracking-wide flex items-center justify-center gap-2"
              style={{ borderRadius: 12 }}
            >
              <Gavel className="h-4 w-4" />
              Start a Duel
            </button>
            <button
              onClick={() => router.push("/quiz")}
              className="btn-ghost w-full h-14 text-white font-bold text-sm tracking-wide flex items-center justify-center gap-2"
              style={{ borderRadius: 12 }}
            >
              <Trophy className="h-4 w-4" />
              Browse Tournaments
            </button>
          </div>
        </section>

        {/* ── Stats ────────────────────────────────────────────────────────── */}
        

        {/* ── Mode cards ───────────────────────────────────────────────────── */}
        <section className="r r5 px-6 pt-8 pb-10 space-y-4">
          <p className="tag mb-1" style={{ color: "rgba(255,255,255,0.25)" }}>Choose your DropDuel</p>

          {/* 1v1 Duel */}
          <div
            className="mode-card blue-bar relative p-6"
            style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, background: "rgba(255,255,255,0.02)" }}
            onClick={() => router.push("/challenge")}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 flex items-center justify-center" style={{ background: "rgba(37,99,235,.15)", borderRadius: 10 }}>
                <Gavel className="h-5 w-5 text-[#2563eb]" />
              </div>
              <ArrowUpRight className="h-4 w-4 text-white/20" />
            </div>
            <h3 className="d font-black text-white text-2xl uppercase tracking-tight mb-2">1v1 Staked Duel</h3>
            <p className="b text-white/40 font-medium leading-relaxed" style={{ fontSize: 14 }}>
              Pick a topic. Negotiate the stake live. Winner takes the entire escrow.
            </p>
            <div className="flex items-center gap-3 mt-4">
              {["Negotiation", "On-chain Escrow", "Instant Payout"].map(tag => (
                <span key={tag} className="tag" style={{ color: "#2563eb", fontSize: 9 }}>{tag}</span>
              ))}
            </div>
          </div>

          {/* Tournament */}
          <div
            className="mode-card blue-bar relative p-6"
            style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, background: "rgba(255,255,255,0.02)" }}
            onClick={() => router.push("/quiz")}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 flex items-center justify-center" style={{ background: "rgba(37,99,235,.15)", borderRadius: 10 }}>
                <Trophy className="h-5 w-5 text-[#2563eb]" />
              </div>
              <ArrowUpRight className="h-4 w-4 text-white/20" />
            </div>
            <h3 className="d font-black text-white text-2xl uppercase tracking-tight mb-2">Global Tournament</h3>
            <p className="b text-white/40 font-medium leading-relaxed" style={{ fontSize: 14 }}>
              Compete with hundreds. Climb the leaderboard. Top players split the pool.
            </p>
            <div className="flex items-center gap-3 mt-4">
              {["Leaderboard", "Tiered Rewards", "Multi-player"].map(tag => (
                <span key={tag} className="tag" style={{ color: "#2563eb", fontSize: 9 }}>{tag}</span>
              ))}
            </div>
          </div>
        </section>

        {/* ── Trust row ────────────────────────────────────────────────────── */}
        <div className="px-6 pb-10 flex items-center gap-5" style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 24 }}>
          {[
            { icon: <ShieldCheck className="h-4 w-4 text-[#2563eb]" />, label: "Secured by Celo" },
            { icon: <Zap className="h-4 w-4 text-[#2563eb]" />, label: "Instant payouts" },
            { icon: <Users className="h-4 w-4 text-[#2563eb]" />, label: "12K+ players" },
          ].map((t, i) => (
            <React.Fragment key={t.label}>
              <div className="flex items-center gap-1.5 flex-1">
                {t.icon}
                <span className="tag" style={{ color: "rgba(255,255,255,0.3)", fontSize: 9 }}>{t.label}</span>
              </div>
              {i < 2 && <div className="vr h-4" />}
            </React.Fragment>
          ))}
        </div>

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <footer className="px-6 pb-8 flex items-center justify-between">
          <span className="tag" style={{ color: "rgba(255,255,255,0.15)" }}>DropDuel v2.0 // Celo</span>
          {!isMiniPay && (
            <button
              onClick={() => router.push("/challenge")}
              className="btn-blue flex items-center gap-1.5 px-4 h-8 font-bold text-white"
              style={{ borderRadius: 8, fontSize: 11, letterSpacing: ".06em" }}
            >
              Connect <ArrowUpRight className="h-3 w-3" />
            </button>
          )}
        </footer>

      </div>
    </>
  );
}