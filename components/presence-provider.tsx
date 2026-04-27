"use client";

import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { useWallet } from "@/hooks/use-wallet"; // Adjust this import path if needed

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "https://faucetpay-backend.koyeb.app";
const WS_BASE  = API_BASE.replace(/^http/, "ws");

// Create a context to hold our set of online wallets
const PresenceContext = createContext<Set<string>>(new Set());

export function PresenceProvider({ children }: { children: React.ReactNode }) {
  const { address } = useWallet();
  const [onlineSet, setOnlineSet] = useState<Set<string>>(new Set());
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(`${WS_BASE}/ws/presence`);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "presence" && Array.isArray(msg.online)) {
          setOnlineSet(new Set(msg.online.map((w: string) => w.toLowerCase())));
        }
      } catch {}
    };

    ws.onopen = () => {
      // If we have an address when the connection opens, broadcast it immediately
      if (address) ws.send(JSON.stringify({ type: "hello", wallet: address }));
    };

    return () => { ws.close(); };
  }, [address]); // Re-run if their wallet address changes

  return (
    <PresenceContext.Provider value={onlineSet}>
      {children}
    </PresenceContext.Provider>
  );
}

// Custom hook so any page can instantly grab the online list
export const usePresence = () => useContext(PresenceContext);