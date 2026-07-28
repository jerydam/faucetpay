"use client";

import React, {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from "react";
import { toast } from "sonner";
import { MessageCircle } from "lucide-react";
import { useWallet } from "@/hooks/use-wallet";
import { usePresence } from "@/components/presence-provider";
import { cn } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "https://conscious-adorne-faucetdrops-fc77a861.koyeb.app";
const WS_BASE  = API_BASE.replace(/^http/, "ws");

export interface DMMessage {
  id: string;
  from: string;
  to: string;
  body: string;
  kind: "text" | "duel_invite" | "system";
  meta?: { code?: string; topic?: string; stake?: number; token?: string } | null;
  isRead: boolean;
  createdAt: string;
  delivered?: boolean;   // recipient had a live socket when we sent it
  failed?: boolean;      // POST /api/dm/send never landed
}

export interface DMThread {
  peer: string;
  username: string;
  avatar_url: string;
  online: boolean;
  lastBody: string;
  lastKind: string;
  lastFrom: string;
  lastAt: string;
  unread: number;
}

interface DMContextValue {
  open: boolean;
  view: "inbox" | "chat";
  threads: DMThread[];
  unreadTotal: number;
  peer: string | null;
  peerName: string;
  peerAvatar: string;
  messages: DMMessage[];
  loading: boolean;
  sending: boolean;
  openInbox: () => void;
  openChat: (peer: string, username?: string, avatar?: string) => void;
  backToInbox: () => void;
  closePanel: () => void;
  sendMessage: (text: string) => Promise<void>;
  refreshThreads: () => Promise<void>;
}

const DMContext = createContext<DMContextValue | null>(null);

export function DMProvider({ children }: { children: React.ReactNode }) {
  const { address } = useWallet();
  const me = address?.toLowerCase() ?? null;

  const [open,       setOpen]       = useState(false);
  const [view,       setView]       = useState<"inbox" | "chat">("inbox");
  const [threads,    setThreads]    = useState<DMThread[]>([]);
  const [unreadTotal,setUnreadTotal]= useState(0);
  const [peer,       setPeer]       = useState<string | null>(null);
  const [peerName,   setPeerName]   = useState("");
  const [peerAvatar, setPeerAvatar] = useState("");
  const [messages,   setMessages]   = useState<DMMessage[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [sending,    setSending]    = useState(false);

  const peerRef = useRef<string | null>(null);
  peerRef.current = peer;

  // ── Loaders ───────────────────────────────────────────────────────────────
  const refreshThreads = useCallback(async () => {
    if (!me) return;
    try {
      const r = await fetch(`${API_BASE}/api/dm/threads/${me}`);
      const d = await r.json();
      if (d.success) {
        setThreads(d.threads ?? []);
        setUnreadTotal((d.threads ?? []).reduce((s: number, t: DMThread) => s + t.unread, 0));
      }
    } catch {}
  }, [me]);

  const loadChat = useCallback(async (p: string) => {
    if (!me) return;
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/dm/${me}/${p.toLowerCase()}`);
      const d = await r.json();
      if (d.success) {
        setMessages(d.messages ?? []);
        if (d.peer?.username) setPeerName(d.peer.username);
        if (d.peer?.avatar_url) setPeerAvatar(d.peer.avatar_url);
      }
      await fetch(`${API_BASE}/api/dm/${me}/${p.toLowerCase()}/read`, { method: "POST" });
      refreshThreads();
    } catch {
      toast.error("Couldn't load the conversation.");
    } finally {
      setLoading(false);
    }
  }, [me, refreshThreads]);

  useEffect(() => { refreshThreads(); }, [refreshThreads]);

  // ── Live inbound DMs ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!me) return;
    let ws: WebSocket | null = null;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let dead = false;

    const connect = () => {
      if (dead) return;
      ws = new WebSocket(`${WS_BASE}/ws/notify/${me}`);

      ws.onopen = () => { retry = 0; };

      ws.onmessage = (e) => {
        let d: any;
        try { d = JSON.parse(e.data); } catch { return; }
        if (d.type === "dm_read") {
          const reader = String(d.reader ?? "").toLowerCase();
          if (peerRef.current === reader) {
            setMessages((prev) => prev.map((m) =>
              m.from.toLowerCase() === me && !m.isRead ? { ...m, isRead: true } : m
            ));
          }
          return;
        }
        if (d.type !== "dm_message") return;

        const msg: DMMessage = d.message;

        if (peerRef.current && peerRef.current === msg.from) {
          setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
          fetch(`${API_BASE}/api/dm/${me}/${msg.from}/read`, { method: "POST" }).catch(() => {});
        } else {
          setUnreadTotal((n) => n + 1);
          // Content stays out of the popup — it lives in the notification inbox.
          toast(`💬 New message from ${d.peerName}`, {
            action: {
              label: "Open",
              onClick: () => {
                setOpen(true); setView("chat"); setPeer(msg.from);
                setPeerName(d.peerName); setPeerAvatar(d.peerAvatar || "");
                loadChat(msg.from);
              },
            },
          });
        }
        refreshThreads();
      };

      ws.onclose = () => {
        if (dead) return;
        timer = setTimeout(connect, Math.min(1000 * 2 ** retry++, 15_000));
      };
      ws.onerror = () => ws?.close();
    };

    connect();
    return () => { dead = true; if (timer) clearTimeout(timer); ws?.close(); };
  }, [me, loadChat, refreshThreads]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const openInbox = useCallback(() => {
    setView("inbox"); setPeer(null); setOpen(true); refreshThreads();
  }, [refreshThreads]);

  const openChat = useCallback((p: string, username?: string, avatar?: string) => {
    const w = p.toLowerCase();
    setPeer(w);
    setPeerName(username || `User${w.slice(-4).toUpperCase()}`);
    setPeerAvatar(avatar || "");
    setMessages([]);
    setView("chat");
    setOpen(true);
    loadChat(w);
  }, [loadChat]);

  const backToInbox = useCallback(() => {
    setView("inbox"); setPeer(null); setMessages([]); refreshThreads();
  }, [refreshThreads]);

  const closePanel = useCallback(() => {
    setOpen(false); setPeer(null); setMessages([]);
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    const body = text.trim();
    if (!me || !peer || !body || sending) return;

    const optimistic: DMMessage = {
      id: `tmp-${Date.now()}`, from: me, to: peer, body,
      kind: "text", isRead: false, createdAt: new Date().toISOString(),
      delivered: false,
    };
    setMessages((p) => [...p, optimistic]);
    setSending(true);

    try {
      const r = await fetch(`${API_BASE}/api/dm/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frm: me, to: peer, body }),
      });
      const d = await r.json();
      if (!d.success) throw new Error(d.detail || "send failed");
      setMessages((p) => p.map((m) => (m.id === optimistic.id ? d.message : m)));
      refreshThreads();
    } catch (e: any) {
      setMessages((p) => p.map((m) => (m.id === optimistic.id ? { ...m, failed: true } : m)));
      toast.error(e?.message ?? "Message failed to send.");
    } finally {
      setSending(false);
    }
  }, [me, peer, sending, refreshThreads]);

  return (
    <DMContext.Provider value={{
      open, view, threads, unreadTotal, peer, peerName, peerAvatar,
      messages, loading, sending,
      openInbox, openChat, backToInbox, closePanel, sendMessage, refreshThreads,
    }}>
      {children}
    </DMContext.Provider>
  );
}

export function useDM() {
  const ctx = useContext(DMContext);
  if (!ctx) throw new Error("useDM must be used inside <DMProvider>");
  return ctx;
}

// ── Reusable bits for the ranks page / header ────────────────────────────────

export function OnlineDot({ wallet, className }: { wallet: string; className?: string }) {
  const online = usePresence().has(wallet.toLowerCase());
  return (
    <span
      title={online ? "Online" : "Offline"}
      className={cn(
        "inline-block h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-slate-950",
        online ? "bg-emerald-500" : "bg-slate-400/50",
        className,
      )}
    />
  );
}

export function DuelChatButton({
  wallet, username, avatar, className,
}: { wallet: string; username?: string; avatar?: string; className?: string }) {
  const { openChat } = useDM();
  const { address } = useWallet();
  if (address?.toLowerCase() === wallet.toLowerCase()) return null;

  return (
    <button
      onClick={(e) => { e.stopPropagation(); openChat(wallet, username, avatar); }}
      aria-label={`Message ${username ?? "player"}`}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600",
        "transition hover:border-blue-500/50 hover:bg-blue-500/10 hover:text-blue-600 active:scale-95",
        "dark:border-white/10 dark:text-slate-300",
        className,
      )}
    >
      <MessageCircle className="h-4 w-4" />
    </button>
  );
}

export function DMInboxButton({ className }: { className?: string }) {
  const { openInbox, unreadTotal } = useDM();
  return (
    <button onClick={openInbox} aria-label="Messages" className={cn("relative flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 dark:border-white/10", className)}>
      <MessageCircle className="h-4 w-4" />
      {unreadTotal > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white">
          {unreadTotal > 9 ? "9+" : unreadTotal}
        </span>
      )}
    </button>
  );
}