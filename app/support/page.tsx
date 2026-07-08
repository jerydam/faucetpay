"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronUp, Zap, Shield, Trophy, Coins, Wifi, HelpCircle, ExternalLink, MessageCircle, Bot } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface FAQItem {
  q: string;
  a: React.ReactNode;
}

interface FAQSection {
  icon: React.ReactNode;
  title: string;
  color: string;
  items: FAQItem[];
}

// ── Bot tier table styles ─────────────────────────────────────────────────────

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "12px",
  marginTop: "8px",
};
const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "6px 8px",
  fontSize: "10px",
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--primary, #2563eb)",
  borderBottom: "1px solid var(--border)",
};
const tdStyle: React.CSSProperties = {
  padding: "6px 8px",
  color: "var(--muted-foreground)",
  borderBottom: "1px solid var(--border, rgba(255,255,255,0.06))",
};

// ── Data ──────────────────────────────────────────────────────────────────────

const FAQ_SECTIONS: FAQSection[] = [
  {
    icon: <Zap className="h-4 w-4" />,
    title: "Getting Started",
    color: "text-yellow-500 bg-yellow-500/10 border-yellow-500/20",
    items: [
      {
        q: "What is PrimeIQ?",
        a: "PrimeIQ is a quiz dueling platform built by FaucetDrops on the Celo blockchain. You can challenge another human player 1v1, or take on one of five AI bot opponents in single-player mode — staking DROPS tokens and competing for on-chain rewards.",
      },
      {
        q: "What wallet do I need?",
        a: "PrimeIQ runs exclusively inside MiniPay (Opera Mini's built-in wallet) on Celo Mainnet. Your wallet connects automatically when you open the app — no setup required. Make sure you have DROPS to stake (new players receive 100 DROPS as a welcome bonus).",
      },
      {
        q: "What are DROPS?",
        a: "DROPS is PrimeIQ's native platform token on Celo. You use DROPS to stake in games, and winnings are minted directly to your wallet as DROPS. You can purchase DROPS by exchanging $GoodDollar (G$) through the Buy DROPS flow, or earn them through platform rewards.",
      },
      {
        q: "How do I create a multiplayer challenge?",
        a: 'Tap "Create Challenge", pick a topic (e.g. "African History"), choose your DROPS stake amount, set visibility (Public or Private), and launch. An AI generates questions across Easy, Medium, and Hard rounds. You\'ll call createQuiz() on-chain via MiniPay to lock in the challenge.',
      },
      {
        q: "How do I join a multiplayer challenge?",
        a: "Browse the public hub or paste a code shared by a friend. Once you join, approve the redeem() transaction in MiniPay (which burns your DROPS stake), then click Ready when both players are confirmed.",
      },
    ],
  },
  {
    icon: <Bot className="h-4 w-4" />,
    title: "Single-Player Mode",
    color: "text-violet-500 bg-violet-500/10 border-violet-500/20",
    items: [
      {
        q: "What is single-player mode?",
        a: "Single-player mode lets you compete against an AI-powered bot opponent instead of a human. Choose a difficulty tier, stake your DROPS, and play — no waiting for an opponent. All payouts are settled on-chain just like multiplayer.",
      },
      {
        q: "What are the difficulty tiers?",
        a: (
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Tier</th>
                <th style={thStyle}>Bot</th>
                <th style={thStyle}>Stake</th>
                <th style={thStyle}>Questions</th>
                <th style={thStyle}>Bot Win Rate</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["1 — Easiest", "Droplet 💧", "10 DROPS", "15", "~25%"],
                ["2", "Drizzle 🌦", "20 DROPS", "18", "~42%"],
                ["3", "Downpour 🌧", "30 DROPS", "21", "~58%"],
                ["4", "Torrent ⛈", "40 DROPS", "24", "~72%"],
                ["5 — Hardest", "Flood 🌊", "50 DROPS", "30", "~87%"],
              ].map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j} style={{ ...tdStyle, borderBottom: i === 4 ? "none" : tdStyle.borderBottom }}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ),
      },
      {
        q: "How does the bot play?",
        a: "Each bot tier has a set base accuracy (chance of picking the correct answer) and answer speed. Higher tiers answer faster and more accurately, earning more speed-bonus points. A small mid-game nudge (±8%) adjusts bot accuracy slightly based on the score gap, keeping games from snowballing.",
      },
      {
        q: "What happens to my stake in single-player mode?",
        a: "When you create a single-player game, you call createQuiz() on-chain via MiniPay and redeem() to burn your DROPS stake. The resolver then calls registerQuiz(), and the bot wallet calls redeem() on-chain to burn its own DROPS stake for real. After the game, the resolver mints the payout directly to the winner's wallet.",
      },
      {
        q: "What are the single-player payouts?",
        a: "If you win, 2× your stake is minted to your wallet. If it's a tie, your full stake is refunded. If the bot wins, 2× the stake goes to the bot's platform wallet — no payout to you. All results are credited to your game_drops pouch.",
      },
      {
        q: "Can I choose my own topic in single-player mode?",
        a: "Yes — single-player mode uses the same AI question generation as multiplayer. Enter any topic you like and the AI will generate questions scaled to the question count for that difficulty tier.",
      },
    ],
  },
  {
    icon: <Coins className="h-4 w-4" />,
    title: "DROPS & Staking",
    color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    items: [
      {
        q: "How do I get DROPS?",
        a: "New players receive 100 DROPS as a one-time welcome bonus. You can also buy DROPS by exchanging $GoodDollar (G$) through the Buy DROPS flow in the app. DROPS can also be earned through platform rewards and game wins.",
      },
      {
        q: "What is the DROPS burn/mint model?",
        a: "When you stake in a game, your DROPS are burned via the redeem() function on the DROPS token contract. When you win (or receive a tie refund), the equivalent DROPS are minted to your wallet via mintTo(). This keeps the token supply balanced around active gameplay.",
      },
      {
        q: "What are game_drops vs reward_drops?",
        a: "game_drops is the balance used for staking in duels — wins, ties, and single-player payouts all credit this pouch. reward_drops are earned through platform rewards and can be redeemed for $GoodDollar (G$) via the DropsRedeemPool contract. Single-player results only credit game_drops.",
      },
      {
        q: "When do I receive my DROPS after winning?",
        a: "In multiplayer mode, a Claim Reward button appears on the results screen after the resolver calls setWinner(). Tap it to trigger the on-chain claim and receive your DROPS. In single-player mode, the payout is minted directly after the game ends — no separate claim needed.",
      },
      {
        q: "What happens in a tie?",
        a: "In multiplayer, the resolver calls declareTie() and both players' stakes are minted back to their wallets via the pending claims system. In single-player, a tie refunds your full stake directly.",
      },
      {
        q: "Can I redeem DROPS for real value?",
        a: "Yes — reward_drops can be staked in the DropsRedeemPool contract to earn $GoodDollar (G$) with an APY bonus. The redeem flow burns your reward_drops and opens a stake that matures over a set period.",
      },
    ],
  },
  {
    icon: <Trophy className="h-4 w-4" />,
    title: "Gameplay",
    color: "text-blue-500 bg-blue-500/10 border-blue-500/20",
    items: [
      {
        q: "How are questions generated?",
        a: "Questions are generated by AI (Gemini 2.5 Flash, with Groq as fallback) based on the topic you provide. Each game has 3 rounds — Easy, Medium, and Hard — with questions spread across them. The total question count depends on the mode: multiplayer uses 15 by default; single-player ranges from 15 (Droplet) to 30 (Flood).",
      },
      {
        q: "How is scoring calculated?",
        a: "Correct answers earn 500 base points plus up to 500 speed bonus points. Answering instantly earns the full 1000; answering at the last second earns 500. Wrong or unanswered questions score 0. Bots at higher tiers earn more speed bonus per correct answer.",
      },
      {
        q: "What are the time limits per round?",
        a: "Easy: 7 seconds per question. Medium: 10 seconds. Hard: 13 seconds.",
      },
      {
        q: "Can I rematch after a multiplayer duel?",
        a: "Yes — after a multiplayer game ends, tap Request Rematch. Your opponent has 30 seconds to accept. If they do, a new challenge is created with the same topic and stake. Rematch access may be gated by badge requirements.",
      },
      {
        q: "Is there a pre-lobby stake negotiation in multiplayer?",
        a: "Yes — when entering a multiplayer pre-lobby, you can accept the creator's stake or propose a different DROPS amount. The creator can counter, and you can counter back. Once both sides agree and the stake is locked, no changes can be made.",
      },
    ],
  },
  {
    icon: <Shield className="h-4 w-4" />,
    title: "Security & Smart Contracts",
    color: "text-purple-500 bg-purple-500/10 border-purple-500/20",
    items: [
      {
        q: "Are my staked DROPS safe?",
        a: "Stakes are committed via the DROPS token contract and resolved by the QuizHub contract on Celo Mainnet. The resolver wallet can only call designated resolution functions (setWinner, declareTie, confirmBurn, mintTo) — it cannot arbitrarily withdraw or redirect funds.",
      },
      {
        q: "Who resolves game outcomes on-chain?",
        a: "A resolver wallet operated by PrimeIQ calls the resolution functions after game logic confirms a result. In multiplayer, setWinner() or declareTie() is called. In single-player, the resolver handles registerQuiz(), confirmBurn() for both sides, and then mints the payout.",
      },
      {
        q: "What if my opponent disconnects mid-multiplayer game?",
        a: "There is a 60-second grace period for reconnection. If the opponent doesn't return in time, you win by forfeit and the resolver settles the game on-chain normally.",
      },
      {
        q: "What if a challenge expires before my opponent joins?",
        a: "Challenges expire after 10 minutes of inactivity. You can trigger an emergency refund of your stake after expiry.",
      },
      {
        q: "Are the bot wallets real wallets?",
        a: "Yes — each bot tier has a dedicated wallet address on Celo Mainnet with real DROPS. When a game starts, the bot calls redeem() on-chain to burn its stake just like a human player. When the bot wins, the payout is minted to its wallet on-chain. Bot private keys are held securely as server-side environment secrets and are never exposed to clients.",
      },
    ],
  },
  {
    icon: <Wifi className="h-4 w-4" />,
    title: "Technical Issues",
    color: "text-orange-500 bg-orange-500/10 border-orange-500/20",
    items: [
      {
        q: "My stake transaction failed — what do I do?",
        a: 'If your redeem() transaction was signed in MiniPay but the game didn\'t register it, use the "Already staked? Sync my stake" option on the lobby screen. This reads your burn event directly from the chain and syncs it without a new transaction.',
      },
      {
        q: "I staked but the game won't start.",
        a: "Both players must stake AND click Ready before a multiplayer game starts. If your status shows \"Stake verified\", just click Ready. If it still shows \"Awaiting stake\", try the Sync button to re-check the chain.",
      },
      {
        q: "The single-player game isn't starting after I staked.",
        a: "After your createQuiz() and redeem() transactions confirm, the backend needs to call registerQuiz() and complete the bot's stake. This typically takes a few seconds. If the game still hasn't started after 30 seconds, refresh the page and check your challenge history.",
      },
      {
        q: "The app shows 'Permission denied' when trying to transact.",
        a: "This usually means MiniPay hasn't authorised the transaction yet. Close and reopen the app inside MiniPay (not a regular browser), then try again. Make sure your DROPS balance covers the stake amount.",
      },
      {
        q: "The lobby isn't updating or I can't see my opponent.",
        a: "Tap the refresh icon (↻) in the lobby to manually pull the latest state. If that doesn't help, close and reopen the challenge link.",
      },
      {
        q: "My claim button isn't working after a win.",
        a: "Claim transactions require the resolver to have already called setWinner() or declareTie() on-chain. If the button appears but the transaction fails, wait a few seconds for the resolver confirmation to propagate and try again. Contact support if the issue persists more than a minute.",
      },
    ],
  },
];

// ── FAQ Accordion Item ────────────────────────────────────────────────────────

function FAQAccordion({ items }: { items: FAQItem[] }) {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div
          key={i}
          className={cn(
            "rounded-2xl border transition-all duration-200 overflow-hidden",
            open === i
              ? "border-primary/30 bg-primary/5"
              : "border-border bg-card hover:border-primary/20",
          )}
        >
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full flex items-start justify-between gap-3 px-4 py-3.5 text-left"
          >
            <span className="text-sm font-bold text-foreground leading-snug flex-1">{item.q}</span>
            <span className="shrink-0 mt-0.5 text-muted-foreground">
              {open === i
                ? <ChevronUp className="h-4 w-4" />
                : <ChevronDown className="h-4 w-4" />
              }
            </span>
          </button>
          {open === i && (
            <div className="px-4 pb-4">
              {typeof item.a === "string"
                ? <p className="text-sm text-muted-foreground leading-relaxed">{item.a}</p>
                : <div className="text-sm text-muted-foreground leading-relaxed">{item.a}</div>
              }
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-background">

      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="flex items-center justify-center w-8 h-8 rounded-xl border border-border bg-card hover:bg-muted transition-colors active:scale-95 shrink-0"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <HelpCircle className="h-5 w-5 text-primary shrink-0" />
          <h1 className="font-black text-foreground text-base">Support & FAQ</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 pb-24 space-y-10">

        {/* Hero */}
        <div className="text-center space-y-3 pt-2">
          <div className="text-5xl">🧠</div>
          <div>
            <h2 className="text-2xl font-black text-foreground">How can we help?</h2>
            <p className="text-muted-foreground text-sm mt-1 max-w-xs mx-auto">
              Everything you need to know about PrimeIQ — DROPS staking, single-player bots,
              multiplayer duels, and troubleshooting.
            </p>
          </div>
        </div>

        {/* Mode overview cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-border bg-card p-4 space-y-1">
            <div className="text-2xl">⚔️</div>
            <p className="font-black text-foreground text-sm">Multiplayer</p>
            <p className="text-xs text-muted-foreground">1v1 human duels · stake DROPS · claim on-chain</p>
          </div>
          <div className="rounded-2xl border border-[#839ce9] bg-[#01071a] p-4 space-y-1">
            <div className="text-2xl">🤖</div>
            <p className="font-black text-foreground text-sm">Single-Player</p>
            <p className="text-xs text-muted-foreground">5 bot tiers · instant start · auto payout</p>
          </div>
        </div>

        {/* FAQ Sections */}
        {FAQ_SECTIONS.map((section) => (
          <section key={section.title} className="space-y-3">
            <div className="flex items-center gap-2">
              <span className={cn("flex items-center justify-center w-7 h-7 rounded-xl border text-xs font-black", section.color)}>
                {section.icon}
              </span>
              <h3 className="font-black text-foreground text-base">{section.title}</h3>
            </div>
            <FAQAccordion items={section.items} />
          </section>
        ))}

        {/* Contract info */}
        <div className="rounded-3xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="font-black text-foreground text-sm flex items-center gap-2">
              <Shield className="h-4 w-4 text-purple-500" /> Smart Contracts (Celo Mainnet)
            </h3>
          </div>
          <div className="px-5 py-4 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">QuizHub Contract</p>
                <p className="font-mono text-xs text-foreground break-all">
                  0x9088298cd07BE0cAA1e256d3f3761313e1a1447E
                </p>
              </div>
              <a
                href="https://celoscan.io/address/0x9088298cd07BE0cAA1e256d3f3761313e1a1447E"
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 flex items-center gap-1 text-xs font-bold text-primary hover:opacity-70 transition-opacity pt-5"
              >
                View <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              All stakes, wins, ties, and refunds flow through this contract. The resolver can
              only call{" "}
              <code className="bg-muted px-1 rounded text-[10px]">registerQuiz</code>,{" "}
              <code className="bg-muted px-1 rounded text-[10px]">confirmBurn</code>,{" "}
              <code className="bg-muted px-1 rounded text-[10px]">setWinner</code>,{" "}
              <code className="bg-muted px-1 rounded text-[10px]">declareTie</code>, and{" "}
              <code className="bg-muted px-1 rounded text-[10px]">mintTo</code> — it cannot
              withdraw funds directly. PrimeIQ runs exclusively on Celo Mainnet via MiniPay.
            </p>
          </div>
        </div>

        {/* Contact */}
        <div className="rounded-3xl border-2 border-primary/20 bg-primary/5 p-6 text-center space-y-4">
          <div className="text-3xl">💬</div>
          <div>
            <h3 className="font-black text-foreground">Still need help?</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Reach us directly — we typically respond within a few hours.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <a
              href="https://t.me/faucetdropschat"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-primary text-primary-foreground font-black text-sm hover:opacity-90 transition-all active:scale-[0.99]"
            >
              <MessageCircle className="h-4 w-4" /> Telegram Support
            </a>
            <a
              href="mailto:drops.faucet@gmail.com"
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl border-2 border-border bg-card text-foreground font-black text-sm hover:bg-muted transition-all active:scale-[0.99]"
            >
              ✉️ Email Us
            </a>
          </div>
        </div>

      </div>
    </div>
  );
}