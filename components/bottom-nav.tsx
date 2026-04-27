"use client";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { Home, Trophy, User, Gavel, Swords, X } from "lucide-react";
import { useWallet } from "@/components/wallet-provider";

const API_BASE_URL = "http://127.0.0.1:8000";

const tabs = [
  { id: "home",    label: "Home",    icon: Home,   href: "/" },
  { id: "ranks",   label: "Ranks",   icon: Trophy, href: "/rank" },
  { id: "profile", label: "Profile", icon: User,   href: "/dashboard" },
];

export function BottomNav() {
  const router   = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const { address, isConnected } = useWallet();
  const [dbUsername, setDbUsername] = useState<string | null>(null);
  const hasFetchedRef = useRef(false);

  // ── Hide nav on active challenge/lobby/game pages ──────────────────────────
  // Pattern: /challenge/SOMECODE  or  /challenge/SOMECODE/pre-lobby
  // Keep nav on: /challenge (hub list), /challenge/create, /challenge/create-quiz
  const isGamePage = /^\/challenge\/[A-Z0-9]{5,}(\/|$)/i.test(pathname);

  useEffect(() => {
    if (!isConnected || !address) {
      setDbUsername(null);
      hasFetchedRef.current = false;
      return;
    }
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    fetch(`${API_BASE_URL}/api/profile/${address.toLowerCase()}`)
      .then(r => r.json())
      .then(data => {
        const username = data.profile?.username;
        if (username && username !== "Dropee") setDbUsername(username);
      })
      .catch(() => {});
  }, [address, isConnected]);

  useEffect(() => {
    const handler = (e: CustomEvent) => {
      if (e.detail?.username) setDbUsername(e.detail.username);
    };
    window.addEventListener("profileUpdated" as any, handler);
    return () => window.removeEventListener("profileUpdated" as any, handler);
  }, []);

  // Don't render nav during game/lobby/pre-lobby
  if (isGamePage) return null;

  const profileHref = dbUsername
    ? `/dashboard/${dbUsername}`
    : address
    ? `/dashboard/${address.toLowerCase()}`
    : "/dashboard";

  const resolvedTabs = tabs.map(t =>
    t.id === "profile" ? { ...t, href: profileHref } : t
  );

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex items-end justify-around px-2 pb-safe pt-2"
      style={{
        background: "var(--dd-bg)",
        borderTop:  "1px solid var(--dd-line)",
      }}
    >
      {/* Left two tabs: Home, Ranks */}
      {resolvedTabs.slice(0, 2).map(t => (
        <button
          key={t.id}
          onClick={() => router.push(t.href)}
          className="flex flex-col items-center gap-1 px-3 py-1"
          style={{ color: pathname === t.href ? "var(--dd-blue)" : "var(--dd-dim)" }}
        >
          <t.icon size={22} strokeWidth={1.8} />
          <span style={{ fontSize: 11, fontWeight: 500 }}>{t.label}</span>
        </button>
      ))}

      {/* Centre Play button — same size as other tabs */}
      <div className="relative flex flex-col items-center">
        {open && (
          <div
            className="absolute bottom-[52px] left-1/2 -translate-x-1/2 rounded-2xl overflow-hidden"
            style={{
              background: "var(--dd-bg)",
              border:     "1px solid var(--dd-line)",
              minWidth:   160,
              boxShadow:  "0 8px 32px rgba(0,0,0,0.18)",
            }}
          >
            <button
              onClick={() => { router.push("/challenge"); setOpen(false); }}
              className="flex items-center gap-3 w-full px-4 py-3 text-sm font-bold transition-colors"
              style={{ color: "var(--dd-text)" }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--dd-line)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <Gavel size={16} color="var(--dd-blue)" /> 1v1 Duel
            </button>
            <div style={{ height: 1, background: "var(--dd-line)", margin: "0 12px" }} />
            <button
              onClick={() => { router.push("/quiz"); setOpen(false); }}
              className="flex items-center gap-3 w-full px-4 py-3 text-sm font-bold transition-colors"
              style={{ color: "var(--dd-text)" }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--dd-line)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <Trophy size={16} color="var(--dd-blue)" /> Tournament
            </button>
          </div>
        )}
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center justify-center px-3 py-1"
          style={{ background: "none", border: "none", color: open ? "var(--dd-blue)" : "var(--dd-dim)" }}
        >
          {open ? <X size={22} strokeWidth={1.8} /> : <Swords size={22} strokeWidth={1.8} />}
        </button>
        <span style={{ fontSize: 11, fontWeight: 500, color: open ? "var(--dd-blue)" : "var(--dd-dim)" }}>
          Play
        </span>
      </div>

      {/* Right tab: Profile */}
      {resolvedTabs.slice(2).map(t => (
        <button
          key={t.id}
          onClick={() => router.push(t.href)}
          className="flex flex-col items-center gap-1 px-3 py-1"
          style={{ color: pathname.startsWith("/dashboard") ? "var(--dd-blue)" : "var(--dd-dim)" }}
        >
          <t.icon size={22} strokeWidth={1.8} />
          <span style={{ fontSize: 11, fontWeight: 500 }}>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}