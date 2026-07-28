"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { useWallet } from "@/hooks/use-wallet";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "https://conscious-adorne-faucetdrops-fc77a861.koyeb.app";
const WS_BASE  = API_BASE.replace(/^http/, "ws");

const PresenceContext = createContext<Set<string>>(new Set());

export function PresenceProvider({ children }: { children: React.ReactNode }) {
  const { address } = useWallet();
  const [onlineSet, setOnlineSet] = useState<Set<string>>(new Set());

  const wsRef   = useRef<WebSocket | null>(null);
  const addrRef = useRef<string | null>(null);
  const deadRef = useRef(false);

  addrRef.current = address?.toLowerCase() ?? null;

  // One long-lived socket — it does NOT tear down when the wallet resolves.
  useEffect(() => {
    deadRef.current = false;
    let ping:  ReturnType<typeof setInterval> | null = null;
    let retry: ReturnType<typeof setTimeout>  | null = null;
    let attempt = 0;

    const connect = () => {
      if (deadRef.current) return;
      const ws = new WebSocket(`${WS_BASE}/ws/presence`);
      wsRef.current = ws;

      ws.onopen = () => {
        attempt = 0;
        if (addrRef.current) ws.send(JSON.stringify({ type: "hello", wallet: addrRef.current }));
        // Koyeb drops idle sockets — keep it warm.
        ping = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "ping" }));
        }, 25_000);
      };

      ws.onmessage = (e) => {
        let msg: any;
        try { msg = JSON.parse(e.data); } catch { return; }
        if (msg.type !== "presence" || !Array.isArray(msg.online)) return;

        // Server sends [{ wallet, username, avatar_url }] — tolerate plain strings too.
        setOnlineSet(new Set(
          msg.online.map((p: any) => String(p?.wallet ?? p).toLowerCase())
        ));
      };

      ws.onclose = () => {
        if (ping) { clearInterval(ping); ping = null; }
        if (deadRef.current) return;
        retry = setTimeout(connect, Math.min(1000 * 2 ** attempt++, 15_000));
      };

      ws.onerror = () => ws.close();
    };

    connect();
    return () => {
      deadRef.current = true;
      if (ping)  clearInterval(ping);
      if (retry) clearTimeout(retry);
      wsRef.current?.close();
    };
  }, []);

  // Announce identity whenever the wallet appears or changes — no reconnect needed.
  useEffect(() => {
    const ws = wsRef.current;
    if (!address || !ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "hello", wallet: address.toLowerCase() }));
  }, [address]);

  return (
    <PresenceContext.Provider value={onlineSet}>
      {children}
    </PresenceContext.Provider>
  );
}

export const usePresence = () => useContext(PresenceContext);