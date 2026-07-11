"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronDown, ChevronUp } from "lucide-react";

const S = `
  @import url('https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;900&family=Figtree:wght@400;500;600;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  .terms-page {
    min-height: 100vh; background: var(--dd-bg); color: var(--dd-text);
    font-family: 'Figtree', sans-serif; max-width: 480px; margin: 0 auto; padding-bottom: 80px;
    transition: background 0.25s, color 0.25s;
  }
  .terms-header {
    display: flex; align-items: center; gap: 12px;
    padding: 24px 20px 20px; position: sticky; top: 0; z-index: 10;
    background: var(--dd-bg); border-bottom: 1px solid var(--dd-line);
    backdrop-filter: blur(12px);
    transition: background 0.25s, border-color 0.25s;
  }
  .back-btn {
    width: 36px; height: 36px; border-radius: 10px;
    background: var(--dd-surface, rgba(255,255,255,0.03));
    border: 1.5px solid var(--dd-line); cursor: pointer;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    color: var(--dd-text);
    transition: border-color .2s, background 0.25s, color 0.25s;
  }
  .back-btn:hover { border-color: rgba(37,99,235,0.5); }
  .header-text { flex: 1; min-width: 0; }
  .page-title {
    font-family: 'Big Shoulders Display', sans-serif;
    font-size: 22px; font-weight: 900; color: var(--dd-text); line-height: 1;
    transition: color 0.25s;
  }
  .page-meta {
    font-size: 11px; color: var(--dd-text-dim); margin-top: 3px;
    transition: color 0.25s;
  }
  .terms-body { padding: 24px 20px; display: flex; flex-direction: column; gap: 8px; }

  .highlight-card {
    background: rgba(37,99,235,0.08); border: 1.5px solid rgba(37,99,235,0.25);
    border-radius: 14px; padding: 16px 18px; margin-bottom: 8px;
    transition: background 0.25s, border-color 0.25s;
  }
  .highlight-title {
    font-family: 'Big Shoulders Display', sans-serif;
    font-size: 13px; font-weight: 900; color: var(--dd-blue, #2563eb);
    text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 8px;
    transition: color 0.25s;
  }
  .highlight-text {
    font-size: 13px; color: var(--dd-text-dim); line-height: 1.6;
    transition: color 0.25s;
  }

  .drops-table {
    width: 100%; border-collapse: collapse; margin-top: 10px;
    font-size: 12px;
  }
  .drops-table th {
    text-align: left; padding: 6px 8px;
    font-family: 'Big Shoulders Display', sans-serif;
    font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em;
    color: var(--dd-blue, #2563eb); border-bottom: 1px solid var(--dd-line);
    transition: color 0.25s, border-color 0.25s;
  }
  .drops-table td {
    padding: 6px 8px; color: var(--dd-text-dim);
    border-bottom: 1px solid rgba(255,255,255,0.04);
    transition: color 0.25s;
  }
  .drops-table tr:last-child td { border-bottom: none; }
  .tier-badge {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 2px 8px; border-radius: 99px;
    font-size: 11px; font-weight: 700;
    background: rgba(37,99,235,0.1); border: 1px solid rgba(37,99,235,0.2);
    color: var(--dd-blue, #2563eb);
  }

  .section {
    border: 1.5px solid var(--dd-line);
    border-radius: 14px; overflow: hidden;
    background: var(--dd-surface, rgba(255,255,255,0.02));
    transition: border-color .2s, background 0.25s;
  }
  .section:hover { border-color: rgba(37,99,235,0.3); }
  .section-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 16px; cursor: pointer; user-select: none; gap: 12px;
  }
  .section-num {
    font-family: 'Big Shoulders Display', sans-serif;
    font-size: 11px; font-weight: 900; color: var(--dd-blue, #2563eb);
    text-transform: uppercase; letter-spacing: 0.15em; flex-shrink: 0;
    min-width: 28px; transition: color 0.25s;
  }
  .section-title {
    font-family: 'Big Shoulders Display', sans-serif;
    font-size: 15px; font-weight: 900; color: var(--dd-text); flex: 1;
    transition: color 0.25s;
  }
  .section-chevron { color: var(--dd-text-dim); flex-shrink: 0; transition: color 0.25s; }

  .section-body {
    padding: 0 16px 16px; border-top: 1px solid var(--dd-line);
    display: flex; flex-direction: column; gap: 10px;
    transition: border-color 0.25s;
  }
  .section-body p {
    font-size: 13px; color: var(--dd-text-dim);
    line-height: 1.7; padding-top: 14px;
    transition: color 0.25s;
  }
  .section-body ul {
    padding-left: 0; list-style: none; display: flex; flex-direction: column; gap: 6px;
    padding-top: 10px;
  }
  .section-body li {
    font-size: 13px; color: var(--dd-text-dim);
    line-height: 1.6; padding-left: 18px; position: relative;
    transition: color 0.25s;
  }
  .section-body li::before {
    content: "→"; position: absolute; left: 0;
    color: var(--dd-blue, #2563eb); font-size: 11px; top: 2px;
  }
  .section-body h4 {
    font-family: 'Big Shoulders Display', sans-serif;
    font-size: 13px; font-weight: 700; color: var(--dd-text);
    text-transform: uppercase; letter-spacing: 0.08em;
    padding-top: 12px; border-top: 1px solid var(--dd-line);
    margin-top: 4px;
    transition: color 0.25s, border-color 0.25s;
  }
  .section-body h4:first-child { border-top: none; margin-top: 0; }

  .contact-row {
    display: flex; align-items: center; gap: 10px;
    padding: 14px 16px; border-radius: 14px;
    background: var(--dd-surface, rgba(255,255,255,0.02));
    border: 1.5px solid var(--dd-line); margin-top: 8px;
    transition: background 0.25s, border-color 0.25s;
  }
  .contact-icon {
    width: 36px; height: 36px; border-radius: 10px;
    background: rgba(37,99,235,0.12); border: 1px solid rgba(37,99,235,0.25);
    display: flex; align-items: center; justify-content: center;
    font-size: 16px; flex-shrink: 0;
  }
  .contact-label { font-size: 11px; color: var(--dd-text-dim); transition: color 0.25s; }
  .contact-value {
    font-size: 13px; font-weight: 700; color: var(--dd-blue, #2563eb);
    text-decoration: none;
  }
  .contact-value:hover { text-decoration: underline; }
  .footer-note {
    text-align: center; font-size: 11px; color: var(--dd-text-dim);
    padding: 16px 20px 0; line-height: 1.6; transition: color 0.25s;
  }
`;

interface Section {
  num: string;
  title: string;
  content: React.ReactNode;
}

const SECTIONS: Section[] = [
  {
    num: "01",
    title: "Introduction",
    content: (
      <>
        <p>
          Welcome to PrimeIQ — a quiz dueling platform built on Celo by FaucetDrops. Players
          compete using DROPS, a platform-native token, in 1v1 multiplayer duels or single-player
          challenges against AI-powered bot opponents. All outcomes are settled on-chain via the
          QuizHub smart contract on Celo Mainnet.
        </p>
        <p>
          By connecting your MiniPay wallet or using any feature of the Service at
          pay.faucetdrops.io, you agree to these Terms and Conditions ("Terms"), which form a
          legally binding agreement between you ("Player") and PrimeIQ ("we," "us," or "our"). If
          you do not agree, please do not use the Service.
        </p>
      </>
    ),
  },
  {
    num: "02",
    title: "Eligibility & Account",
    content: (
      <>
        <h4>Age Requirement</h4>
        <p>You must be at least 15 years old to participate in staked duels involving DROPS.</p>
        <h4>Wallet Responsibility</h4>
        <ul>
          <li>PrimeIQ is only accessible through MiniPay (Opera Mini's built-in wallet) on Celo Mainnet.</li>
          <li>You are solely responsible for the security of your wallet, private keys, and seed phrase.</li>
          <li>PrimeIQ is never liable for losses arising from wallet mismanagement, phishing, or key exposure.</li>
          <li>All on-chain transactions submitted through your connected wallet are your responsibility.</li>
        </ul>
      </>
    ),
  },
  {
    num: "03",
    title: "DROPS Token & Economy",
    content: (
      <>
        <p>
          DROPS is the native utility token of the FaucetDrops platform on Celo Mainnet. It powers
          all staking, rewards, and game payouts within PrimeIQ. DROPS is not a security or
          investment product.
        </p>
        <h4>Game Pouches</h4>
        <ul>
          <li>
            <strong>Game Drops</strong> — the balance used for staking in duels. All game wins,
            ties, and single-player payouts credit this pouch.
          </li>
          <li>
            <strong>Reward Drops</strong> — earned through platform rewards and redeemable for
            $GoodDollar (G$) via the DropsRedeemPool contract.
          </li>
        </ul>
        <h4>Welcome Bonus</h4>
        <ul>
          <li>New players receive a one-time welcome mint of 100 DROPS to their game pouch upon registration.</li>
          <li>Welcome DROPS are non-transferable and may only be used for staking in games.</li>
        </ul>
        <h4>Acquiring DROPS</h4>
        <ul>
          <li>DROPS can be purchased by exchanging $GoodDollar (G$) through the platform's Buy DROPS flow.</li>
          <li>Token prices are determined by the platform's exchange rate at the time of purchase.</li>
        </ul>
      </>
    ),
  },
  {
    num: "04",
    title: "Multiplayer Duels",
    content: (
      <>
        <p>
          A multiplayer duel is a 1v1 quiz match between two human players. The creator sets a
          topic, stake amount (in DROPS), and visibility (public or private). Both players must
          stake the agreed DROPS amount before gameplay begins. Questions are AI-generated across
          Easy, Medium, and Hard rounds.
        </p>
        <h4>Staking Mechanism</h4>
        <ul>
          <li>Stakes are submitted via a <code>redeem()</code> call on the DROPS token contract, burning DROPS from both players.</li>
          <li>The resolver calls <code>confirmBurn()</code> to verify each player's stake on-chain before the game starts.</li>
          <li>The QuizHub contract holds the commitment to the staked amounts until a result is declared.</li>
        </ul>
        <h4>Outcomes</h4>
        <ul>
          <li>The player with the most points wins — the resolver calls <code>setWinner()</code> and the winner claims 2× their stake via <code>mintTo()</code>.</li>
          <li>In a tie, the resolver calls <code>declareTie()</code> and both players receive a full refund of their stake via mint.</li>
          <li>Cancelled games trigger a refund of both stakes.</li>
          <li>Winners and refund recipients must claim their DROPS via the Claim button in-app.</li>
        </ul>
        <h4>Pre-Lobby Negotiation</h4>
        <ul>
          <li>Players may propose a different stake amount before joining; the creator can accept or counter.</li>
          <li>Once both sides agree and the stake is locked, no changes can be made.</li>
        </ul>
      </>
    ),
  },
  {
    num: "05",
    title: "Single-Player Mode",
    content: (
      <>
        <p>
          Single-player mode lets you compete against an AI-powered bot opponent at one of five
          difficulty tiers. Bot opponents are real Celo wallets with private keys held securely
          by the platform. The bot submits a genuine on-chain <code>redeem()</code> transaction
          to stake DROPS, just as a human player would.
        </p>
        <h4>Difficulty Tiers & Stakes</h4>
        <table className="drops-table">
          <thead>
            <tr>
              <th>Tier</th>
              <th>Bot</th>
              <th>Stake</th>
              <th>Questions</th>
            </tr>
          </thead>
          <tbody>
            <tr><td><span className="tier-badge">1</span></td><td>Droplet 💧</td><td>10 DROPS</td><td>15</td></tr>
            <tr><td><span className="tier-badge">2</span></td><td>Drizzle 🌦</td><td>20 DROPS</td><td>18</td></tr>
            <tr><td><span className="tier-badge">3</span></td><td>Downpour 🌧</td><td>30 DROPS</td><td>21</td></tr>
            <tr><td><span className="tier-badge">4</span></td><td>Torrent ⛈</td><td>40 DROPS</td><td>24</td></tr>
            <tr><td><span className="tier-badge">5</span></td><td>Flood 🌊</td><td>50 DROPS</td><td>30</td></tr>
          </tbody>
        </table>
        <h4>Payouts</h4>
        <ul>
          <li><strong>Creator wins</strong> — 2× the stake amount is minted to the creator's wallet and credited to their game pouch.</li>
          <li><strong>Tie</strong> — the original stake amount is minted back to the creator.</li>
          <li><strong>Bot wins</strong> — 2× the stake is minted to the bot's wallet; no payout to the creator.</li>
          <li>All single-player results credit the game_drops pouch only; reward_drops are not awarded in SP mode.</li>
        </ul>
        <h4>On-Chain Flow</h4>
        <ul>
          <li>You call <code>createQuiz()</code> client-side (MiniPay) when creating the single-player game.</li>
          <li>The resolver calls <code>registerQuiz()</code>, then the bot wallet calls <code>redeem()</code> on-chain to burn its DROPS stake for real.</li>
          <li>After the game, the resolver calls <code>confirmBurn()</code> for both sides and mints the payout directly.</li>
        </ul>
        <h4>Bot Behavior Disclaimer</h4>
        <ul>
          <li>Bot answer accuracy scales with difficulty (35%–90% correct) and includes a randomised speed component.</li>
          <li>A small score-state nudge (±8%) may adjust bot accuracy mid-game to prevent snowballing; outcomes remain probabilistic, not scripted.</li>
          <li>PrimeIQ does not guarantee any specific win rate for players in single-player mode.</li>
        </ul>
      </>
    ),
  },
  {
    num: "06",
    title: "Smart Contract & On-Chain Risk",
    content: (
      <>
        <p>
          Staked DROPS and game commitments are managed by the QuizHub and DROPS token contracts
          deployed on Celo Mainnet. By playing, you accept the following risks:
        </p>
        <ul>
          <li>Smart contract bugs or exploits could result in loss of funds — use at your own risk.</li>
          <li>Blockchain network congestion or RPC failures may delay or prevent transactions.</li>
          <li>Network fees on Celo are separate from any DROPS staked and are borne entirely by you.</li>
          <li>PrimeIQ does not custody your DROPS — the contracts do.</li>
          <li>The resolver wallet can only call designated resolution functions; it cannot withdraw or redirect funds.</li>
        </ul>
      </>
    ),
  },
  {
    num: "07",
    title: "Prohibited Conduct",
    content: (
      <>
        <p>You agree not to:</p>
        <ul>
          <li>Use bots, scripts, or automation tools to gain an unfair advantage in duels.</li>
          <li>Collude with opponents to manipulate game outcomes.</li>
          <li>Attempt to exploit, reverse-engineer, or attack the smart contracts or backend.</li>
          <li>Use the platform for money laundering, fraud, or any unlawful activity.</li>
          <li>Create multiple wallet accounts to abuse the welcome bonus, promotions, or leaderboard rankings.</li>
          <li>Misrepresent your identity or impersonate another player.</li>
        </ul>
        <p>
          Violations may result in permanent wallet bans and forfeiture of any pending DROPS
          rewards or claims.
        </p>
      </>
    ),
  },
  {
    num: "08",
    title: "AI-Generated Content",
    content: (
      <>
        <p>
          Quiz questions are generated by third-party AI models (Google Gemini 2.5 Flash, with
          Groq as fallback). We do not guarantee the accuracy, completeness, or fairness of any
          AI-generated question.
        </p>
        <ul>
          <li>Questions are reviewed algorithmically but not manually curated.</li>
          <li>Disputed questions do not void a completed duel or entitle players to a refund.</li>
          <li>PrimeIQ is not responsible for errors in AI-generated content.</li>
          <li>Topic choices are your responsibility — you accept any questions generated for your chosen subject.</li>
        </ul>
      </>
    ),
  },
  {
    num: "09",
    title: "Limitation of Liability",
    content: (
      <>
        <p>To the fullest extent permitted by applicable law:</p>
        <ul>
          <li>PrimeIQ provides the platform "as is" with no guarantees of uptime, accuracy, or game outcome.</li>
          <li>We are not liable for financial losses from smart contract interactions, network failures, or wallet errors.</li>
          <li>We are not liable for losses resulting from bot outcomes in single-player mode.</li>
          <li>Our total liability to you for any claim shall not exceed the DROPS value staked in the relevant game.</li>
          <li>We are not liable for indirect, incidental, or consequential damages of any kind.</li>
        </ul>
      </>
    ),
  },
  {
    num: "10",
    title: "Termination",
    content: (
      <p>
        We reserve the right to suspend or terminate your access to PrimeIQ at our sole
        discretion, without prior notice, if you violate these Terms or engage in conduct harmful
        to the platform or its players. You may stop using the platform at any time; pending
        on-chain transactions remain subject to smart contract logic regardless of account status.
      </p>
    ),
  },
  {
    num: "11",
    title: "Governing Law",
    content: (
      <p>
        These Terms are governed by and construed in accordance with the laws of the Federal
        Republic of Nigeria. Any disputes arising from or relating to these Terms shall be
        resolved in the courts of Lagos, Nigeria.
      </p>
    ),
  },
  {
    num: "12",
    title: "Changes to These Terms",
    content: (
      <p>
        We may update these Terms from time to time. Material changes will be announced via the
        platform with at least 7 days' notice. Continued use of the Service after the effective
        date constitutes acceptance of the revised Terms.
      </p>
    ),
  },
];

function AccordionSection({ section }: { section: Section }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="section">
      <div className="section-header" onClick={() => setOpen(o => !o)}>
        <span className="section-num">{section.num}</span>
        <span className="section-title">{section.title}</span>
        <span className="section-chevron">
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </div>
      {open && <div className="section-body">{section.content}</div>}
    </div>
  );
}

export default function TermsPage() {
  const router = useRouter();

  return (
    <>
      <style>{S}</style>
      <div className="terms-page">

        <div className="terms-header">
          <button className="back-btn" onClick={() => router.back()}>
            <ArrowLeft size={16} />
          </button>
          <div className="header-text">
            <div className="page-title">Terms & Conditions</div>
            <div className="page-meta">Last updated: July 8, 2026</div>
          </div>
        </div>

        <div className="terms-body">

          {/* Highlight card */}
          <div className="highlight-card">
            <div className="highlight-title">⚡ How It Works</div>
            <div className="highlight-text">
              PrimeIQ uses DROPS — a platform-native token on Celo — for all staking and
              payouts. Compete 1v1 against other players or challenge AI bot opponents across
              5 difficulty tiers. All outcomes are settled on-chain via the QuizHub contract.
              MiniPay wallet required.
            </div>
          </div>

          {SECTIONS.map(s => (
            <AccordionSection key={s.num} section={s} />
          ))}

          <div className="contact-row">
            <div className="contact-icon">✉️</div>
            <div>
              <div className="contact-label">Questions about these terms?</div>
              <a href="mailto:drops.faucet@gmail.com" className="contact-value">
                drops.faucet@gmail.com
              </a>
            </div>
          </div>

          <p className="footer-note">
            By connecting your MiniPay wallet and playing on PrimeIQ, you confirm that you
            have read, understood, and agreed to these Terms and Conditions.
          </p>

        </div>
      </div>
    </>
  );
}