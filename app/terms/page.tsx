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
  .fee-badge {
    display: inline-block; background: rgba(234,179,8,0.12);
    border: 1px solid rgba(234,179,8,0.35); border-radius: 8px;
    padding: 4px 10px; font-size: 13px; font-weight: 800; color: #ca8a04;
    margin-top: 8px;
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
  .section-chevron {
    color: var(--dd-text-dim); flex-shrink: 0;
    transition: color 0.25s;
  }
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
    transition: color 0.25s;
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
  .contact-label {
    font-size: 11px; color: var(--dd-text-dim);
    transition: color 0.25s;
  }
  .contact-value {
    font-size: 13px; font-weight: 700; color: var(--dd-blue, #2563eb);
    text-decoration: none; transition: color 0.25s;
  }
  .contact-value:hover { text-decoration: underline; }
  .footer-note {
    text-align: center; font-size: 11px; color: var(--dd-text-dim);
    padding: 16px 20px 0; line-height: 1.6;
    transition: color 0.25s;
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
          Welcome to PrimeIQ — a peer-to-peer quiz dueling platform where players stake
          tokens and compete for rewards on-chain. By accessing or using PrimeIQ at
          pay.faucetdrops.io or through any associated services, you agree to these Terms and
          Conditions ("Terms").
        </p>
        <p>
          These Terms form a legally binding agreement between you ("Player" or "you") and
          PrimeIQ ("we," "us," or "our"). If you do not agree, please do not use our Service.
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
        <p>You must be at least 18 years old to participate in staked duels involving real tokens.</p>
        <h4>Wallet Responsibility</h4>
        <ul>
          <li>You can only use the platform with minipay.</li>
          <li>You are solely responsible for the security of your wallet, private keys, and seed phrase.</li>
          <li>PrimeIQ is never liable for losses due to wallet mismanagement, phishing, or key exposure.</li>
          <li>All transactions submitted through your connected wallet are your responsibility.</li>
        </ul>
      </>
    ),
  },
  {
    num: "03",
    title: "How Duels Work",
    content: (
      <>
        <p>
          A duel is a 1v1 quiz match between two players. The creator sets a topic and stake amount.
          Both players must stake the agreed amount in an  USDm, USDC or USDT before the
          game begins. Questions are AI-generated and split across Easy, Medium, and Hard rounds.
        </p>
        <ul>
          <li>The player with the most points at the end wins the full pool.</li>
          <li>In the event of a tie, both stakes are refunded via <code>refundQuiz()</code> on-chain.</li>
          <li>Winners must call <code>claimReward()</code> from the frontend to receive their payout.</li>
          <li>Results are resolved by a trusted resolver wallet calling the QuizHub smart contract.</li>
        </ul>
      </>
    ),
  },
  {
    num: "04",
    title: "Escrow Fee",
    content: (
      <>
        <p>
          PrimeIQ charges a flat escrow fee to cover on-chain resolution costs and platform
          operations. This fee is deducted at stake time.
        </p>
        <ul>
          <li>Escrow fee: <strong>$0.25 USD per player</strong> — deducted from each player's stake with stake amount at the time of staking.</li>
          <li>Both players pay the fee upfront; the full remaining pool goes to the winner.</li>
          <li>The fee is non-refundable once a player has staked, regardless of outcome.</li>
          <li>In a tie, stakes (minus the escrow fee already deducted) are returned to both players.</li>
          <li>Fees may be updated with 7 days' notice posted on the platform.</li>
        </ul>
      </>
    ),
  },
  {
    num: "05",
    title: "Smart Contract & On-Chain Risk",
    content: (
      <>
        <p>
          Staked funds are held and managed by the QuizHub smart contract deployed on 
         Celo blockchains. By staking, you accept the following risks:
        </p>
        <ul>
          <li>Smart contract bugs or exploits could result in loss of funds — use at your own risk.</li>
          <li>Blockchain network congestion or failures may delay or prevent transactions.</li>
          <li>Gas fees are borne by the player and are separate from the escrow fee.</li>
          <li>PrimeIQ does not custody your funds — the contract does.</li>
        </ul>
      </>
    ),
  },
  {
    num: "06",
    title: "Prohibited Conduct",
    content: (
      <>
        <p>You agree not to:</p>
        <ul>
          <li>Use bots, scripts, or automated tools to gain an unfair advantage in duels.</li>
          <li>Collude with opponents to manipulate outcomes.</li>
          <li>Attempt to exploit, reverse-engineer, or attack the smart contract or backend.</li>
          <li>Use the platform for money laundering, fraud, or any illegal activity.</li>
          <li>Create multiple accounts to abuse promotional features or rankings.</li>
        </ul>
        <p>
          Violations may result in permanent wallet bans and forfeiture of any pending rewards.
        </p>
      </>
    ),
  },
  {
    num: "07",
    title: "AI-Generated Content",
    content: (
      <>
        <p>
          Quiz questions are generated by third-party AI models (Google Gemini or Groq). 
            We do not guarantee the accuracy, completeness, or fairness of any question.
        </p>
        <ul>
          <li>Questions are reviewed algorithmically but not manually curated.</li>
          <li>Disputed questions do not void a completed duel or entitle players to a refund.</li>
          <li>PrimeIQ is not responsible for errors in AI-generated content.</li>
        </ul>
      </>
    ),
  },
  {
    num: "08",
    title: "Limitation of Liability",
    content: (
      <>
        <p>To the fullest extent permitted by applicable law:</p>
        <ul>
          <li>PrimeIQ provides the platform "as is" with no guarantees of uptime or accuracy.</li>
          <li>We are not liable for financial losses from smart contract interactions, network issues, or wallet errors.</li>
          <li>Our total liability to you for any claim shall not exceed the escrow fee paid in the relevant duel.</li>
          <li>We are not liable for indirect, incidental, or consequential damages of any kind.</li>
        </ul>
      </>
    ),
  },
  {
    num: "09",
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
    num: "10",
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
    num: "11",
    title: "Changes to These Terms",
    content: (
      <p>
        We may update these Terms from time to time. Material changes will be announced via the
        platform with at least 7 days' notice. Continued use of the Service after the effective
        date of any changes constitutes acceptance of the revised Terms.
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

        {/* Header */}
        <div className="terms-header">
          <button className="back-btn" onClick={() => router.back()}>
            <ArrowLeft size={16} />
          </button>
          <div className="header-text">
            <div className="page-title">Terms & Conditions</div>
            <div className="page-meta">Last updated: April 27, 2026</div>
          </div>
        </div>

        <div className="terms-body">

          {/* Fee highlight card */}
          <div className="highlight-card">
            <div className="highlight-title">⚡ Platform Fee</div>
            <div className="highlight-text">
              PrimeIQ charges a flat escrow fee on every duel.
              This covers on-chain resolution and platform operations.
            </div>
            <div className="fee-badge">$0.25 USD per player · deducted at stake time</div>
          </div>

          {/* Accordion sections */}
          {SECTIONS.map(s => (
            <AccordionSection key={s.num} section={s} />
          ))}

          {/* Contact */}
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
            By connecting your wallet and playing a duel, you confirm that you have read,
            understood, and agreed to these Terms and Conditions.
          </p>

        </div>
      </div>
    </>
  );
}