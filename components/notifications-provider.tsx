"use client";
import React, { useEffect, useState, useRef, useCallback } from "react";
import { useWallet } from "@/hooks/use-wallet";
import { useRouter } from "next/navigation";
import { Bell, X, Check, Zap } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

function getWsNotifyUrl() {
  if (typeof window === "undefined") return "wss://127.0.0.1:8000/ws/notify";
  return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "ws://127.0.0.1:8000/ws/notify"
    : "wss://identical-vivi-faucetdrops-41e9c56b.koyeb.app/ws/notify";
}

const POPUP_DURATION = 30; // seconds

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  data?: { code?: string; topic?: string; stake?: number; token?: string; creatorName?: string };
  isRead: boolean;
  createdAt: string;
}

interface ChallengePopup {
  notification: Notification;
  secondsLeft: number;
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ── Challenge Popup Overlay ───────────────────────────────────────────────────

function ChallengePopupOverlay({
  popup,
  onAccept,
  onDecline,
}: {
  popup: ChallengePopup;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const { notification: n, secondsLeft } = popup;
  const pct = (secondsLeft / POPUP_DURATION) * 100;
  const isUrgent = secondsLeft <= 10;

  const initials = (n.data?.creatorName ?? "??")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        animation: "fadeIn 0.2s ease-out",
      }}
      onClick={onDecline} // clicking backdrop = decline
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--color-background-primary)",
          borderRadius: "var(--border-radius-xl)",
          border: "0.5px solid var(--color-border-tertiary)",
          padding: "1.5rem",
          width: "100%",
          maxWidth: "340px",
          animation: "slideUp 0.25s ease-out",
        }}
      >
        {/* Creator row */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "1rem" }}>
          <div style={{
            width: 44, height: 44, borderRadius: "50%",
            background: "var(--color-background-info)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 500, color: "var(--color-text-info)",
            flexShrink: 0,
          }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)" }}>
              {n.data?.creatorName ?? "Someone"} challenged you!
            </p>
            <p style={{ margin: 0, fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>
              {n.data?.topic ?? n.body}
            </p>
          </div>
          <button
            onClick={onDecline}
            style={{
              width: 28, height: 28, borderRadius: "50%",
              background: "var(--color-background-secondary)",
              border: "0.5px solid var(--color-border-tertiary)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", flexShrink: 0,
            }}
          >
            <X size={14} color="var(--color-text-tertiary)" />
          </button>
        </div>

        {/* Stake info */}
        {n.data?.stake && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "var(--color-background-secondary)",
            borderRadius: "var(--border-radius-md)",
            padding: "0.5rem 0.75rem",
            marginBottom: "1rem",
          }}>
            <Zap size={14} color="var(--color-text-warning)" />
            <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Stake</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)", marginLeft: "auto" }}>
              {n.data.stake} {n.data.token}
            </span>
          </div>
        )}

        {/* Countdown */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: "0.5rem",
        }}>
          <span style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>Time to decide</span>
          <span style={{
            fontSize: 22, fontWeight: 500,
            color: isUrgent ? "var(--color-text-danger)" : "var(--color-text-primary)",
            fontVariantNumeric: "tabular-nums",
            transition: "color 0.3s",
          }}>
            0:{String(secondsLeft).padStart(2, "0")}
          </span>
        </div>

        {/* Progress bar */}
        <div style={{
          width: "100%", height: 4,
          background: "var(--color-background-secondary)",
          borderRadius: 2, marginBottom: "1rem", overflow: "hidden",
        }}>
          <div style={{
            width: `${pct}%`, height: "100%",
            background: isUrgent ? "var(--color-background-danger)" : "var(--color-background-success)",
            borderRadius: 2,
            transition: "width 1s linear, background 0.3s",
          }} />
        </div>

        {/* Buttons */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <button
            onClick={onAccept}
            style={{
              padding: "11px 0",
              borderRadius: "var(--border-radius-md)",
              background: "var(--color-background-success)",
              border: "0.5px solid var(--color-border-success)",
              color: "var(--color-text-success)",
              fontSize: 13, fontWeight: 500, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            <Check size={14} /> Accept
          </button>
          <button
            onClick={onDecline}
            style={{
              padding: "11px 0",
              borderRadius: "var(--border-radius-md)",
              background: "var(--color-background-secondary)",
              border: "0.5px solid var(--color-border-tertiary)",
              color: "var(--color-text-secondary)",
              fontSize: 13, cursor: "pointer",
            }}
          >
            Decline
          </button>
        </div>

        <p style={{ margin: "0.75rem 0 0", textAlign: "center", fontSize: 11, color: "var(--color-text-tertiary)" }}>
          Dismissed challenges are saved in your inbox
        </p>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(16px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function NotificationBell() {
  const { address } = useWallet();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [popup, setPopup] = useState<ChallengePopup | null>(null);
  const panelRef   = useRef<HTMLDivElement>(null);
  const popupTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // Close panel on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Fetch notifications when panel opens
  useEffect(() => {
    if (!open || !address) return;
    setLoading(true);
    fetch(`${API_BASE_URL}/api/notifications/${address.toLowerCase()}`)
      .then((r) => r.json())
      .then((d) => setNotifications(d.notifications ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, address]);

  // Clear popup timer on unmount
  useEffect(() => () => { if (popupTimer.current) clearInterval(popupTimer.current); }, []);

  const dismissPopup = useCallback((notif: Notification) => {
    if (popupTimer.current) clearInterval(popupTimer.current);
    setPopup(null);
    // Add to inbox as unread if not already there
    setNotifications((prev) =>
      prev.some((n) => n.id === notif.id) ? prev : [notif, ...prev]
    );
  }, []);

  const showChallengePopup = useCallback((notif: Notification) => {
    if (popupTimer.current) clearInterval(popupTimer.current);
    setPopup({ notification: notif, secondsLeft: POPUP_DURATION });

    popupTimer.current = setInterval(() => {
      setPopup((prev) => {
        if (!prev) return null;
        if (prev.secondsLeft <= 1) {
          clearInterval(popupTimer.current!);
          // Time expired — dismiss silently, keep in inbox
          setNotifications((ns) =>
            ns.some((n) => n.id === prev.notification.id) ? ns : [prev.notification, ...ns]
          );
          return null;
        }
        return { ...prev, secondsLeft: prev.secondsLeft - 1 };
      });
    }, 1000);
  }, []);

  // WebSocket push
  useEffect(() => {
    if (!address) return;
    const ws = new WebSocket(`${getWsNotifyUrl()}/${address.toLowerCase()}`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data) as Notification & { type: string };
      if (data.type === "unread_count") return;

      const notif: Notification = {
        id:        data.id ?? String(Date.now()),
        type:      data.type,
        title:     data.title,
        body:      data.body,
        data:      data.data,
        isRead:    false,
        createdAt: new Date().toISOString(),
      };

      // Public challenge invite → show popup
      if (data.type === "public_challenge" || data.type === "friend_invite") {
        showChallengePopup(notif);
      } else {
        // Other notifications → sonner toast + inbox
        setNotifications((prev) => [notif, ...prev]);
        toast(notif.title, { description: notif.body });
      }
    };

    return () => ws.close();
  }, [address, showChallengePopup]);

  const handleAccept = () => {
    if (!popup) return;
    const code = popup.notification.data?.code;
    if (popupTimer.current) clearInterval(popupTimer.current);
    // Mark as read
    setNotifications((prev) =>
      prev.map((n) => (n.id === popup.notification.id ? { ...n, isRead: true } : n))
    );
    setPopup(null);
    if (code) router.push(`/challenge/${code}`);
  };

  const handleDecline = () => {
    if (!popup) return;
    dismissPopup(popup.notification);
  };

  const markAllRead = async () => {
    if (!address) return;
    await fetch(`${API_BASE_URL}/api/notifications/${address.toLowerCase()}/read-all`, { method: "POST" });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const markOneRead = async (id: string) => {
    if (!address) return;
    await fetch(`${API_BASE_URL}/api/notifications/${address.toLowerCase()}/read/${id}`, { method: "POST" });
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
  };

  return (
    <>
      {/* ── Popup overlay ── */}
      {popup && (
        <ChallengePopupOverlay
          popup={popup}
          onAccept={handleAccept}
          onDecline={handleDecline}
        />
      )}

      {/* ── Bell + dropdown ── */}
      <div className="relative" ref={panelRef}>
        <button
          onClick={() => setOpen((o) => !o)}
          className="relative p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <Bell className="h-5 w-5 text-slate-600 dark:text-slate-300" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-white dark:ring-slate-900">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        {open && (
          <div className="absolute right-0 top-11 w-80 z-50 rounded-2xl border border-border bg-background shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-sm font-bold text-foreground">Notifications</span>
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-xs text-blue-500 hover:underline">
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
              ) : notifications.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">No notifications yet</div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => {
                      markOneRead(n.id);
                      if (n.data?.code) router.push(`/challenge/${n.data.code}`);
                    }}
                    className={cn(
                      "flex gap-3 px-4 py-3 border-b border-border cursor-pointer hover:bg-muted/50 transition-colors",
                      !n.isRead && "bg-blue-50 dark:bg-blue-950/20"
                    )}
                  >
                    <div className={cn(
                      "mt-1.5 h-2 w-2 rounded-full shrink-0",
                      n.isRead ? "bg-transparent" : "bg-blue-500"
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">{n.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.body}</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1">{timeAgo(n.createdAt)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}