"use client";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { Home, Trophy, User, Swords } from "lucide-react";
import { useWallet } from "@/components/wallet-provider";

const API_BASE_URL = "https://conscious-adorne-faucetdrops-fc77a861.koyeb.app";

const tabs = [
  { id: "home",    label: "Home",    icon: Home,   href: "/" },
  { id: "ranks",   label: "Ranks",   icon: Trophy, href: "/rank" },
  { id: "profile", label: "Profile", icon: User,   href: "/dashboard" },
];

export function BottomNav() {
  const router   = useRouter();
  const pathname = usePathname();

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

  const isDuelActive = pathname.startsWith("/challenge");

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex items-end justify-around px-2 pb-safe pt-2"
      style={{
        background: "var(--dd-bg)",
        borderTop:  "1px solid var(--dd-line)",
      }}
    >
      {/* Left tab: Home */}
      {resolvedTabs.slice(0, 1).map(t => (
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

      {/* Duel button — Second position */}
      <button
        onClick={() => router.push("/challenge")}
        className="flex flex-col items-center gap-1 px-3 py-1"
        style={{ color: isDuelActive ? "var(--dd-blue)" : "var(--dd-dim)" }}
      >
        <Swords size={22} strokeWidth={1.8} />
        <span style={{ fontSize: 11, fontWeight: 500 }}>Duel</span>
      </button>

      {/* Right tabs: Ranks, Profile */}
      {resolvedTabs.slice(1).map(t => (
        <button
          key={t.id}
          onClick={() => router.push(t.href)}
          className="flex flex-col items-center gap-1 px-3 py-1"
          style={{ 
            color: pathname === t.href || (t.id === "profile" && pathname.startsWith("/dashboard")) 
              ? "var(--dd-blue)" 
              : "var(--dd-dim)" 
          }}
        >
          <t.icon size={22} strokeWidth={1.8} />
          <span style={{ fontSize: 11, fontWeight: 500 }}>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}