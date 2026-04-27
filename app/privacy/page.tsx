"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronDown, ChevronUp, Shield, Eye, Lock, Globe, Trash2, Bell, Cookie, RefreshCw, Mail } from "lucide-react";

const S = `
  @import url('https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;900&family=Figtree:wght@400;500;600;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  .privacy-page {
    min-height: 100vh;
    background: var(--dd-bg);
    color: var(--dd-text);
    font-family: 'Figtree', sans-serif;
    max-width: 480px;
    margin: 0 auto;
    padding-bottom: 80px;
    transition: background 0.25s, color 0.25s;
  }

  .privacy-header {
    display: flex; align-items: center; gap: 12px;
    padding: 24px 20px 20px;
    position: sticky; top: 0; z-index: 10;
    background: var(--dd-bg);
    border-bottom: 1px solid var(--dd-line);
    backdrop-filter: blur(12px);
    transition: background 0.25s, border-color 0.25s;
  }

  .back-btn {
    width: 36px; height: 36px; border-radius: 10px;
    background: var(--dd-surface, rgba(255,255,255,0.03));
    border: 1.5px solid var(--dd-line);
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; color: var(--dd-text); transition: border-color .2s, background 0.25s;
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

  .privacy-body { padding: 24px 20px; display: flex; flex-direction: column; gap: 8px; }

  /* Hero card */
  .hero-card {
    background: rgba(37,99,235,0.08);
    border: 1.5px solid rgba(37,99,235,0.25);
    border-radius: 16px; padding: 20px 18px; margin-bottom: 8px;
    display: flex; flex-direction: column; gap: 12px;
  }
  .hero-icon-row { display: flex; gap: 10px; align-items: center; }
  .hero-icon {
    width: 40px; height: 40px; border-radius: 12px;
    background: rgba(37,99,235,0.15); border: 1px solid rgba(37,99,235,0.3);
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    color: var(--dd-blue, #2563eb);
  }
  .hero-label {
    font-family: 'Big Shoulders Display', sans-serif;
    font-size: 18px; font-weight: 900; color: var(--dd-text);
    transition: color 0.25s;
  }
  .hero-sub { font-size: 11px; color: var(--dd-text-dim); margin-top: 1px; transition: color 0.25s; }
  .hero-text {
    font-size: 13px; color: var(--dd-text-dim);
    line-height: 1.7; transition: color 0.25s;
  }
  .pill-row { display: flex; flex-wrap: wrap; gap: 6px; }
  .pill {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 4px 10px; border-radius: 99px;
    font-size: 11px; font-weight: 700;
    background: rgba(34,197,94,0.1);
    border: 1px solid rgba(34,197,94,0.25);
    color: #22c55e;
  }

  /* Accordion */
  .section {
    border: 1.5px solid var(--dd-line);
    border-radius: 14px; overflow: hidden;
    background: var(--dd-surface, rgba(255,255,255,0.02));
    transition: border-color .2s, background 0.25s;
  }
  .section:hover { border-color: rgba(37,99,235,0.3); }

  .section-header {
    display: flex; align-items: center; gap: 10px;
    padding: 13px 16px; cursor: pointer; user-select: none;
  }
  .section-icon {
    width: 28px; height: 28px; border-radius: 8px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    background: var(--dd-line); color: var(--dd-text-dim);
    transition: background 0.2s, color 0.2s;
  }
  .section.open .section-icon {
    background: rgba(37,99,235,0.15); color: var(--dd-blue, #2563eb);
  }
  .section-num {
    font-family: 'Big Shoulders Display', sans-serif;
    font-size: 10px; font-weight: 900; color: var(--dd-blue, #2563eb);
    text-transform: uppercase; letter-spacing: 0.15em; flex-shrink: 0;
  }
  .section-title {
    font-family: 'Big Shoulders Display', sans-serif;
    font-size: 14px; font-weight: 900; color: var(--dd-text);
    flex: 1; transition: color 0.25s;
  }
  .section-chevron { color: var(--dd-text-dim); flex-shrink: 0; transition: color 0.25s; }

  .section-body {
    padding: 0 16px 16px;
    border-top: 1px solid var(--dd-line);
    display: flex; flex-direction: column; gap: 0;
    transition: border-color 0.25s;
  }
  .section-body p {
    font-size: 13px; color: var(--dd-text-dim);
    line-height: 1.75; padding-top: 14px;
    transition: color 0.25s;
  }
  .section-body ul {
    padding-left: 0; list-style: none;
    display: flex; flex-direction: column; gap: 5px; padding-top: 10px;
  }
  .section-body li {
    font-size: 13px; color: var(--dd-text-dim);
    line-height: 1.65; padding-left: 18px; position: relative;
    transition: color 0.25s;
  }
  .section-body li::before {
    content: "→"; position: absolute; left: 0;
    color: var(--dd-blue, #2563eb); font-size: 11px; top: 3px;
  }
  .section-body h4 {
    font-family: 'Big Shoulders Display', sans-serif;
    font-size: 12px; font-weight: 700; color: var(--dd-text);
    text-transform: uppercase; letter-spacing: 0.08em;
    padding-top: 14px; margin-top: 4px;
    border-top: 1px solid var(--dd-line);
    transition: color 0.25s, border-color 0.25s;
  }
  .section-body h4:first-child { border-top: none; padding-top: 14px; margin-top: 0; }

  /* Contact */
  .contact-row {
    display: flex; align-items: center; gap: 12px;
    padding: 14px 16px; border-radius: 14px;
    background: var(--dd-surface, rgba(255,255,255,0.02));
    border: 1.5px solid var(--dd-line); margin-top: 8px;
    transition: background 0.25s, border-color 0.25s;
  }
  .contact-icon {
    width: 38px; height: 38px; border-radius: 10px;
    background: rgba(37,99,235,0.12); border: 1px solid rgba(37,99,235,0.25);
    display: flex; align-items: center; justify-content: center;
    font-size: 16px; flex-shrink: 0;
  }
  .contact-label { font-size: 11px; color: var(--dd-text-dim); transition: color 0.25s; }
  .contact-link {
    font-size: 13px; font-weight: 700; color: var(--dd-blue, #2563eb);
    text-decoration: none;
  }
  .contact-link:hover { text-decoration: underline; }

  .footer-note {
    text-align: center; font-size: 11px; color: var(--dd-text-dim);
    padding: 16px 4px 0; line-height: 1.7; transition: color 0.25s;
  }

  @keyframes fadeDown {
    from { opacity: 0; transform: translateY(-6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .animate-in { animation: fadeDown 0.2s ease forwards; }
`;

interface Section {
  num: string;
  title: string;
  icon: React.ReactNode;
  content: React.ReactNode;
}

const SECTIONS: Section[] = [
  {
    num: "01", title: "Introduction", icon: <Shield size={14} />,
    content: (
      <>
        <p>
          PrimeIQ ("we," "us," or "our") operates pay.faucetdrops.io — a peer-to-peer quiz
          dueling platform where players compete using staked tokens on supported EVM blockchains.
          This Privacy Policy explains how we collect, use, and protect your information when you
          use our platform ("Service").
        </p>
        <p>
          By connecting your wallet or using any feature of the platform, you acknowledge and
          agree to the practices described in this policy.
        </p>
      </>
    ),
  },
  {
    num: "02", title: "Information We Collect", icon: <Eye size={14} />,
    content: (
      <>
        <h4>On-Chain Data</h4>
        <ul>
          <li>Your public wallet address — used to identify you as a player, track wins/losses, and process payouts.</li>
          <li>Transaction hashes for stake deposits, challenge creation, and reward claims.</li>
          <li>All on-chain data is public by nature of the blockchain.</li>
        </ul>
        <h4>Off-Chain Data</h4>
        <ul>
          <li>Username and optional avatar URL you set in your profile.</li>
          <li>Optional email or phone number if provided in profile settings.</li>
          <li>Quiz answers and scores — stored to resolve disputes and power the leaderboard.</li>
          <li>Challenge history: topics played, opponents, outcomes, and timestamps.</li>
        </ul>
        <h4>Automatic Data</h4>
        <ul>
          <li>IP address, browser type, and device info — used for security and abuse prevention.</li>
          <li>WebSocket connection events for presence tracking (online/offline status).</li>
        </ul>
      </>
    ),
  },
  {
    num: "03", title: "How We Use Your Data", icon: <RefreshCw size={14} />,
    content: (
      <>
        <p>We use collected data strictly to operate and improve the platform:</p>
        <ul>
          <li>Matching players, running game sessions, and resolving outcomes on-chain.</li>
          <li>Powering the leaderboard, rank snapshots, and tier progression system.</li>
          <li>Sending in-app notifications (challenge invites, game results, rematch requests).</li>
          <li>Detecting and preventing cheating, collusion, or abuse of the platform.</li>
          <li>Improving AI question quality by analyzing topics and difficulty spread.</li>
          <li>Complying with legal obligations where applicable.</li>
        </ul>
      </>
    ),
  },
  {
    num: "04", title: "Data Sharing", icon: <Globe size={14} />,
    content: (
      <>
        <p>We do not sell your personal information. We may share data only in these cases:</p>
        <ul>
          <li>
            <strong>Blockchain networks</strong> — stake and payout transactions are submitted
            publicly to Celo, Base, or Lisk.
          </li>
          <li>
            <strong>AI providers</strong> — quiz topics (not wallet addresses) are sent to
            Google Gemini, Groq, or Anthropic to generate questions.
          </li>
          <li>
            <strong>Database infrastructure</strong> — Supabase/PostgreSQL stores your profile,
            game history, and notifications under our control.
          </li>
          <li>
            <strong>Legal requirements</strong> — if required by law, court order, or to protect
            the platform from fraud or harm.
          </li>
        </ul>
        <p>
          Your username and rank are publicly visible to all platform users as part of the
          leaderboard feature.
        </p>
      </>
    ),
  },
  {
    num: "05", title: "Data Retention", icon: <Trash2 size={14} />,
    content: (
      <>
        <p>We retain your data for as long as your wallet is active on the platform:</p>
        <ul>
          <li>Challenge history and scores are kept indefinitely to maintain leaderboard integrity.</li>
          <li>Notification inbox items are retained for 90 days then auto-deleted.</li>
          <li>Profile data (username, avatar, bio) is kept until you request deletion.</li>
          <li>On-chain transaction data is permanent and outside our control.</li>
        </ul>
        <p>
          To request deletion of your off-chain profile data, contact us at the email below.
          Note that your wallet address and on-chain history cannot be erased.
        </p>
      </>
    ),
  },
  {
    num: "06", title: "Your Rights", icon: <Lock size={14} />,
    content: (
      <>
        <p>Depending on your jurisdiction, you may have the right to:</p>
        <ul>
          <li>Access the personal data we hold about you.</li>
          <li>Correct inaccurate profile information (via profile settings directly).</li>
          <li>Request deletion of your off-chain profile data.</li>
          <li>Opt out of non-essential notifications via in-app settings.</li>
          <li>Object to processing where our legal basis is legitimate interest.</li>
        </ul>
        <p>
          To exercise any of these rights, contact us at drops.faucet@gmail.com. We will
          respond within 30 days.
        </p>
      </>
    ),
  },
  {
    num: "07", title: "Notifications", icon: <Bell size={14} />,
    content: (
      <>
        <p>
          PrimeIQ sends in-app notifications for game events such as challenge invites,
          duel results, rematch requests, and rank changes. These are delivered via WebSocket
          and stored in your notification inbox.
        </p>
        <ul>
          <li>Notifications are only sent to your connected wallet address.</li>
          <li>You can mark notifications as read or clear them via the app.</li>
          <li>We do not send marketing emails unless you explicitly opt in.</li>
        </ul>
      </>
    ),
  },
  {
    num: "08", title: "Cookies & Tracking", icon: <Cookie size={14} />,
    content: (
      <>
        <p>
          PrimeIQ uses minimal browser storage (localStorage/sessionStorage) to maintain
          your wallet connection state and UI preferences (e.g. dark/light theme). We do not
          use third-party advertising cookies or tracking pixels.
        </p>
        <ul>
          <li>Session storage is used to preserve game state across page refreshes.</li>
          <li>No cross-site tracking or fingerprinting is performed.</li>
          <li>You can clear all local data by disconnecting your wallet and clearing browser storage.</li>
        </ul>
      </>
    ),
  },
  {
    num: "09", title: "Data Security", icon: <Shield size={14} />,
    content: (
      <>
        <p>
          We implement reasonable technical and organisational measures to protect your data:
        </p>
        <ul>
          <li>All API communication uses HTTPS/TLS encryption.</li>
          <li>Database connections require SSL and are restricted by IP allowlisting.</li>
          <li>Resolver private keys are stored as environment secrets, never in code.</li>
          <li>WebSocket connections are authenticated by wallet address per session.</li>
        </ul>
        <p>
          No system is completely secure. We cannot guarantee the absolute security of data
          transmitted over the internet or stored on-chain.
        </p>
      </>
    ),
  },
  {
    num: "10", title: "International Transfers", icon: <Globe size={14} />,
    content: (
      <p>
        PrimeIQ is operated from Nigeria. Our infrastructure providers (Supabase, Koyeb,
        Google Cloud) may process data in data centres outside Nigeria. By using the platform,
        you consent to your data being transferred to and processed in these locations. We
        ensure any such transfers are subject to appropriate safeguards.
      </p>
    ),
  },
  {
    num: "11", title: "Policy Updates", icon: <RefreshCw size={14} />,
    content: (
      <p>
        We may update this Privacy Policy from time to time to reflect changes in our
        practices or applicable laws. Material changes will be posted on the platform with at
        least 7 days' notice. Continued use of the Service after the effective date constitutes
        acceptance of the revised policy.
      </p>
    ),
  },
];

function AccordionSection({ section }: { section: Section }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`section${open ? " open" : ""}`}>
      <div className="section-header" onClick={() => setOpen(o => !o)}>
        <span className="section-icon">{section.icon}</span>
        <span className="section-num">{section.num}</span>
        <span className="section-title">{section.title}</span>
        <span className="section-chevron">
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </div>
      {open && (
        <div className="section-body animate-in">
          {section.content}
        </div>
      )}
    </div>
  );
}

export default function PrivacyPage() {
  const router = useRouter();

  return (
    <>
      <style>{S}</style>
      <div className="privacy-page">

        {/* Header */}
        <div className="privacy-header">
          <button className="back-btn" onClick={() => router.back()}>
            <ArrowLeft size={16} />
          </button>
          <div className="header-text">
            <div className="page-title">Privacy Policy</div>
            <div className="page-meta">Last updated: April 27, 2026</div>
          </div>
        </div>

        <div className="privacy-body">

          {/* Hero card */}
          <div className="hero-card">
            <div className="hero-icon-row">
              <div className="hero-icon"><Shield size={18} /></div>
              <div>
                <div className="hero-label">Your Privacy Matters</div>
                <div className="hero-sub">PrimeIQ · pay.faucetdrops.io</div>
              </div>
            </div>
            <div className="hero-text">
              We collect only what's needed to run the platform. We never sell your data,
              never send marketing spam, and your wallet address is the only identifier we
              require. Blockchain transactions are public by nature — everything else stays private.
            </div>
            <div className="pill-row">
              <span className="pill">✓ No data selling</span>
              <span className="pill">✓ No ad tracking</span>
              <span className="pill">✓ Wallet-only ID</span>
              <span className="pill">✓ Open-source contract</span>
            </div>
          </div>

          {/* Accordion sections */}
          {SECTIONS.map(s => (
            <AccordionSection key={s.num} section={s} />
          ))}

          {/* Contact */}
          <div className="contact-row">
            <div className="contact-icon">
              <Mail size={16} color="var(--dd-blue, #2563eb)" />
            </div>
            <div>
              <div className="contact-label">Privacy questions or data requests?</div>
              <a href="mailto:drops.faucet@gmail.com" className="contact-link">
                drops.faucet@gmail.com
              </a>
            </div>
          </div>

          <p className="footer-note">
            By connecting your wallet to PrimeIQ, you acknowledge that you have read
            and understood this Privacy Policy and consent to the data practices described herein.
          </p>

        </div>
      </div>
    </>
  );
}