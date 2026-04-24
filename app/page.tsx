"use client";

/**
 * /app/page.tsx — DropDuel Landing
 * Theme-aware: light/dark via next-themes + CSS variables
 * Font: Big Shoulders Display (display) + Figtree (body)
 */

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Zap, Trophy, Gavel, ArrowUpRight, ShieldCheck, Users } from "lucide-react";
import { ThemeToggle } from "@/components/theme";
import Image from "next/image";
import { Footer } from "@/components/footer";

export default function LandingPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [isMiniPay, setIsMiniPay] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 60);
    setIsMiniPay(!!(window.ethereum as any)?.isMiniPay);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@400;700;900&family=Figtree:wght@400;500;600;700&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        /* ── Theme-aware CSS variables ── */
        :root {
          --dd-bg:        #ffffff;
          --dd-surface:   rgba(0,0,0,0.02);
          --dd-text:      #020617;
          --dd-text-dim:  rgba(2,6,23,0.45);
          --dd-text-mute: rgba(2,6,23,0.25);
          --dd-line:      rgba(2,6,23,0.07);
          --dd-line-soft: rgba(2,6,23,0.05);
          --dd-blue:      #2563eb;
          --dd-blue2:     #1d4ed8;
          --dd-blue-bg:   rgba(37,99,235,0.10);
          --dd-card-border: rgba(2,6,23,0.08);
          --dd-vr:        rgba(2,6,23,0.10);
        }

        .dark {
          --dd-bg:        #020617;
          --dd-surface:   rgba(255,255,255,0.02);
          --dd-text:      #ffffff;
          --dd-text-dim:  rgba(255,255,255,0.45);
          --dd-text-mute: rgba(255,255,255,0.25);
          --dd-line:      rgba(255,255,255,0.07);
          --dd-line-soft: rgba(255,255,255,0.05);
          --dd-blue:      #2563eb;
          --dd-blue2:     #1d4ed8;
          --dd-blue-bg:   rgba(37,99,235,0.15);
          --dd-card-border: rgba(255,255,255,0.08);
          --dd-vr:        rgba(255,255,255,0.10);
        }

        .dd-page {
          background: var(--dd-bg);
          color: var(--dd-text);
          transition: background 0.25s ease, color 0.25s ease;
        }

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
          transition: transform .22s ease, border-color .22s ease, background .22s ease;
          cursor: pointer;
        }
        .mode-card:hover {
          transform: translateY(-3px);
          border-color: var(--dd-blue) !important;
        }

        /* ── blue bar on card ── */
        .blue-bar::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 2px;
          background: var(--dd-blue);
          transform: scaleX(0);
          transform-origin: left;
          transition: transform .3s ease;
        }
        .mode-card:hover .blue-bar::before { transform: scaleX(1); }

        /* ── buttons ── */
        .btn-blue {
          background: var(--dd-blue);
          color: #ffffff;
          border: none;
          transition: background .2s, transform .15s;
        }
        .btn-blue:hover  { background: var(--dd-blue2); }
        .btn-blue:active { transform: scale(.97); }

        .btn-ghost {
          background: transparent;
          color: var(--dd-text);
          border: 1.5px solid var(--dd-line);
          transition: border-color .2s, background .2s, transform .15s;
        }
        .btn-ghost:hover  {
          border-color: rgba(37,99,235,.5);
          background: rgba(37,99,235,.06);
        }
        .btn-ghost:active { transform: scale(.97); }

        /* ── vertical rule ── */
        .dd-vr { width: 1px; background: var(--dd-vr); align-self: stretch; }

        /* ── tag ── */
        .tag {
          font-family: 'Figtree', sans-serif;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: .18em;
          text-transform: uppercase;
        }

        /* ── theme toggle override for landing ── */
        .dd-toggle-btn {
          border-color: var(--dd-line) !important;
          background: transparent !important;
          color: var(--dd-text) !important;
        }
        .dd-toggle-btn:hover {
          background: var(--dd-blue-bg) !important;
        }
      `}</style>

      <div
        className={`dd-page b min-h-screen flex flex-col transition-opacity duration-500 ${ready ? "opacity-100" : "opacity-0"}`}
        style={{ maxWidth: 480, margin: "0 auto" }}
      >

        {/* ── Nav ── */}
        <nav className="r r1 flex items-center justify-between px-6 pt-8 pb-6">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 flex items-center justify-center"
              
            >
              <Image
                              src="/favicon.png"
                              alt="FaucetDrops Logo"
                              width={40}
                              height={40}
                              className="w-8 h-8 lg:w-10 lg:h-10 rounded-md object-contain flex-shrink-0"
                            />
            </div>
            <span
              className="d font-black text-xl tracking-tight"
              style={{ color: "var(--dd-text)", letterSpacing: "-.01em" }}
            >
              DropDuel
            </span>
          </div>

          {/* Theme toggle — wraps the existing component, overrides border/bg for landing */}
          <div className="dd-toggle-wrap">
            <ThemeToggle />
          </div>
        </nav>

        {/* ── Hero ── */}
        <section className="px-6 pb-10 flex-1 flex flex-col justify-center">

          <h1
            className="r r2 d font-black leading-none mb-5"
            style={{
              fontSize: "clamp(3.4rem, 14vw, 5rem)",
              letterSpacing: "-.01em",
              color: "var(--dd-text)",
            }}
          >
            STAKE.<br />
            <span style={{ color: "#2563eb" }}>PLAY.</span><br />
            EARN.
          </h1>

          <p
            className="r r3 b font-medium leading-relaxed mb-8"
            style={{ fontSize: 15, maxWidth: 320, color: "var(--dd-text-dim)" }}
          >
            Challenge anyone on any topic. Negotiate the stake, answer faster, take the pool — secured on Celo.
          </p>

          {/* CTAs */}
          <div className="r r4 flex flex-col gap-3">
            <button
              onClick={() => router.push("/challenge")}
              className="btn-blue w-full h-14 font-bold text-sm tracking-wide flex items-center justify-center gap-2"
              style={{ borderRadius: 12 }}
            >
              <Gavel className="h-4 w-4" />
              Start a Duel
            </button>
            <button
              onClick={() => router.push("/quiz")}
              className="btn-ghost w-full h-14 font-bold text-sm tracking-wide flex items-center justify-center gap-2"
              style={{ borderRadius: 12 }}
            >
              <Trophy className="h-4 w-4" />
              Browse Tournaments
            </button>
          </div>
        </section>

        {/* ── Mode cards ── */}
        <section className="r r5 px-6 pt-8 pb-10 space-y-4">
          <p className="tag mb-1" style={{ color: "var(--dd-text-mute)" }}>Choose your DropDuel</p>

          {/* 1v1 Duel */}
          <div
            className="mode-card blue-bar relative p-6"
            style={{
              border: "1px solid var(--dd-card-border)",
              borderRadius: 16,
              background: "var(--dd-surface)",
            }}
            onClick={() => router.push("/challenge")}
          >
            <div className="flex items-start justify-between mb-4">
              <div
                className="w-10 h-10 flex items-center justify-center"
                style={{ background: "var(--dd-blue-bg)", borderRadius: 10 }}
              >
                <Gavel className="h-5 w-5" style={{ color: "#2563eb" }} />
              </div>
              <ArrowUpRight className="h-4 w-4" style={{ color: "var(--dd-text-mute)" }} />
            </div>
            <h3
              className="d font-black text-2xl uppercase tracking-tight mb-2"
              style={{ color: "var(--dd-text)" }}
            >
              1v1 Staked Duel
            </h3>
            <p
              className="b font-medium leading-relaxed"
              style={{ fontSize: 14, color: "var(--dd-text-dim)" }}
            >
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
            style={{
              border: "1px solid var(--dd-card-border)",
              borderRadius: 16,
              background: "var(--dd-surface)",
            }}
            onClick={() => router.push("/quiz")}
          >
            <div className="flex items-start justify-between mb-4">
              <div
                className="w-10 h-10 flex items-center justify-center"
                style={{ background: "var(--dd-blue-bg)", borderRadius: 10 }}
              >
                <Trophy className="h-5 w-5" style={{ color: "#2563eb" }} />
              </div>
              <ArrowUpRight className="h-4 w-4" style={{ color: "var(--dd-text-mute)" }} />
            </div>
            <h3
              className="d font-black text-2xl uppercase tracking-tight mb-2"
              style={{ color: "var(--dd-text)" }}
            >
              Global Tournament
            </h3>
            <p
              className="b font-medium leading-relaxed"
              style={{ fontSize: 14, color: "var(--dd-text-dim)" }}
            >
              Compete with hundreds. Climb the leaderboard. Top players split the pool.
            </p>
            <div className="flex items-center gap-3 mt-4">
              {["Leaderboard", "Tiered Rewards", "Multi-player"].map(tag => (
                <span key={tag} className="tag" style={{ color: "#2563eb", fontSize: 9 }}>{tag}</span>
              ))}
            </div>
          </div>
        </section>     
      </div>
      <Footer className="pb-20" />
    </>
  );
}