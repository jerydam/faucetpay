"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ArrowLeft, MessageCircle, Send, Swords, X } from "lucide-react";
import { useDM, type DMMessage } from "@/components/dm-provider";
import { usePresence } from "@/components/presence-provider";
import { useWallet } from "@/hooks/use-wallet";
import { cn } from "@/lib/utils";

function shortTime(iso: string) {
  const d = new Date(iso);
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60)    return "now";
  if (s < 3600)  return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function Avatar({ url, name, size = 40 }: { url?: string; name: string; size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-blue-500/15 font-black text-blue-600"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
    >
      {url
        ? <img src={url} alt={name} className="h-full w-full object-cover"
               onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        : (name || "??").slice(0, 2).toUpperCase()}
    </div>
  );
}

function Dot({ online }: { online: boolean }) {
  return (
    <span className={cn(
      "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-white dark:ring-slate-950",
      online ? "bg-emerald-500" : "bg-slate-400",
    )} />
  );
}

export function DMPanel() {
  const router = useRouter();
  const { address } = useWallet();
  const presence = usePresence();
  const {
    open, view, threads, peer, peerName, peerAvatar,
    messages, loading, sending, openChat, backToInbox, closePanel, sendMessage,
  } = useDM();

  const [text, setText] = useState("");
  const [mounted, setMounted] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, view]);

  if (!mounted || !open) return null;

  const me = address?.toLowerCase() ?? "";
  const peerOnline = !!peer && presence.has(peer);

  const submit = async () => {
    const body = text.trim();
    if (!body) return;
    setText("");
    await sendMessage(body);
  };

  const startDuel = () => {
    if (!peer) return;
    closePanel();
    router.push(`/challenge/create-challenge?${new URLSearchParams({
      inviteWallet: peer, inviteUsername: peerName,
    }).toString()}`);
  };

  const bubble = (m: DMMessage) => {
    const mine = m.from.toLowerCase() === me;

    if (m.kind === "duel_invite" && m.meta?.code) {
      return (
        <div key={m.id} className="mx-auto w-full max-w-[280px] rounded-2xl border border-blue-500/30 bg-blue-500/10 p-3 text-center">
          <div className="text-[11px] font-bold uppercase tracking-wide text-blue-500">Duel invite</div>
          <div className="mt-1 text-sm font-bold text-foreground">{m.meta.topic}</div>
          <div className="text-xs text-muted-foreground">{m.meta.stake} {m.meta.token}</div>
          <button
            onClick={() => { closePanel(); router.push(`/challenge/${m.meta!.code}/pre-lobby`); }}
            className="mt-2 w-full rounded-lg bg-blue-600 py-2 text-xs font-bold text-white active:scale-95"
          >
            {mine ? "Open duel" : "Join duel"}
          </button>
        </div>
      );
    }

    return (
      <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
        <div className={cn(
          "max-w-[75%] rounded-2xl px-3 py-2 text-sm",
          mine ? "rounded-br-md bg-blue-600 text-white"
               : "rounded-bl-md bg-muted text-foreground",
        )}>
          <p className="whitespace-pre-wrap break-words">{m.body}</p>
          <span className={cn("mt-0.5 block text-[10px]", mine ? "text-white/60" : "text-muted-foreground")}>
            {shortTime(m.createdAt)}
          </span>
        </div>
      </div>
    );
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/40" onClick={closePanel} />

      <div className="relative flex h-[85vh] w-full max-w-[480px] flex-col overflow-hidden rounded-t-3xl border border-border bg-background shadow-2xl sm:h-[600px] sm:rounded-3xl">

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          {view === "chat" ? (
            <>
              <button onClick={backToInbox} className="rounded-lg p-1 hover:bg-muted"><ArrowLeft className="h-4 w-4" /></button>
              <div className="relative"><Avatar url={peerAvatar} name={peerName} size={36} /><Dot online={peerOnline} /></div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-foreground">{peerName}</div>
                <div className={cn("text-[11px]", peerOnline ? "text-emerald-500" : "text-muted-foreground")}>
                  {peerOnline ? "Online" : "Offline"}
                </div>
              </div>
              <button onClick={startDuel} className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white active:scale-95">
                <Swords className="h-3.5 w-3.5" /> Duel
              </button>
            </>
          ) : (
            <>
              <MessageCircle className="h-4 w-4 text-blue-500" />
              <span className="flex-1 text-sm font-black text-foreground">Messages</span>
            </>
          )}
          <button onClick={closePanel} className="rounded-lg p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        {/* Body */}
        {view === "inbox" ? (
          <div className="flex-1 overflow-y-auto">
            {threads.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <p className="text-sm font-bold text-foreground">No conversations yet</p>
                <p className="mt-1 text-xs text-muted-foreground">Open the rankings and message a player to set up a duel.</p>
              </div>
            ) : threads.map((t) => {
              const online = presence.has(t.peer) || t.online;
              return (
                <button
                  key={t.peer}
                  onClick={() => openChat(t.peer, t.username, t.avatar_url)}
                  className="flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left hover:bg-muted/50"
                >
                  <div className="relative"><Avatar url={t.avatar_url} name={t.username} /><Dot online={online} /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-bold text-foreground">{t.username}</span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">{shortTime(t.lastAt)}</span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {t.lastKind === "duel_invite" ? "⚔️ " : t.lastFrom.toLowerCase() === me ? "You: " : ""}{t.lastBody}
                    </p>
                  </div>
                  {t.unread > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[10px] font-bold text-white">
                      {t.unread > 9 ? "9+" : t.unread}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
              {loading ? (
                <div className="flex justify-center py-10">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                </div>
              ) : messages.length === 0 ? (
                <p className="py-10 text-center text-xs text-muted-foreground">
                  Say hi, then hit Duel to send a private challenge.
                </p>
              ) : messages.map(bubble)}
              <div ref={endRef} />
            </div>

            <div className="flex items-center gap-2 border-t border-border p-3">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
                placeholder="Message…"
                maxLength={1000}
                className="h-10 flex-1 rounded-xl border border-border bg-muted/40 px-3 text-sm text-foreground outline-none focus:border-blue-500/50"
              />
              <button
                onClick={submit}
                disabled={sending || !text.trim()}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white disabled:opacity-40 active:scale-95"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}