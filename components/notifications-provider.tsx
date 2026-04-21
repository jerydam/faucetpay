"use client";
import React, { useEffect, useState, useRef, useCallback } from "react";
import { useWallet } from "@/hooks/use-wallet";
import { useRouter } from "next/navigation";
import { Bell, X, Check, Zap } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://faucetpay-backend.koyeb.app";

function getWsNotifyUrl() {
  if (typeof window === "undefined") return "wss://127.0.0.1:8000/ws/notify";
  return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "ws://127.0.0.1:8000/ws/notify"
    : "wss://faucetpay-backend.koyeb.app/ws/notify";
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

  // Extract variables for cleaner code
  const creatorName = n.data?.creatorName || "A challenger";
  const topic = n.data?.topic || "a random topic";

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200"
      style={{
        background: "radial-gradient(circle at center, var(--overlay-gradient-start, rgba(30, 41, 59, 0.6)) 0%, var(--overlay-gradient-end, rgba(15, 23, 42, 0.8)) 100%)",
        backdropFilter: "blur(12px) saturate(180%)",
      }}
      onClick={onDecline}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[360px] overflow-hidden rounded-[32px] border border-white/10 bg-slate-900 shadow-2xl animate-in slide-in-from-bottom-4"
      >
        {/* Subtle decorative background */}
        <div className="absolute inset-0 opacity-10 pointer-events-none" 
             style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` }} 
        />

        <div className="relative p-6 text-center">
          {/* Avatar Icon */}
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold border-2 border-blue-500/30 text-xl shadow-[0_0_20px_rgba(59,130,246,0.2)]">
              {creatorName.slice(0, 2).toUpperCase()}
            </div>
          </div>

          {/* New Dynamic Text Content */}
          <div className="space-y-2 mb-6">
            <h3 className="text-white font-black text-xl leading-tight">
              Challenge Issued!
            </h3>
            <p className="text-slate-300 text-sm leading-relaxed">
              <span className="text-blue-400 font-bold">{creatorName}</span> just challenged your knowledge on <span className="text-white font-bold">"{topic}"</span>
            </p>
          </div>

          {/* Stake Detail */}
          {n.data?.stake && (
            <div className="flex items-center justify-center gap-2 bg-amber-500/10 rounded-2xl py-2 px-4 border border-amber-500/20 mb-6 w-fit mx-auto">
              <Zap size={14} className="text-amber-500 fill-amber-500" />
              <span className="text-xs font-black text-amber-500 uppercase tracking-widest">
                Stake: {n.data.stake} {n.data.token}
              </span>
            </div>
          )}

          {/* Timer Section */}
          <div className="mb-6 px-2">
             <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className={cn("h-full transition-all duration-1000 linear", isUrgent ? "bg-red-500" : "bg-blue-500")}
                  style={{ width: `${pct}%` }}
                />
             </div>
             <p className={cn("text-[10px] font-bold mt-2 tracking-widest uppercase", isUrgent ? "text-red-500" : "text-slate-500")}>
               {isUrgent ? `Hurry! ${secondsLeft}s left` : `Expiring in ${secondsLeft} seconds`}
             </p>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={onDecline}
              className="py-3.5 rounded-2xl bg-slate-800 text-slate-300 font-bold text-sm hover:bg-slate-700 transition-colors active:scale-95"
            >
              Decline
            </button>
            <button 
              onClick={onAccept}
              className="py-3.5 rounded-2xl bg-blue-600 text-white font-black text-sm hover:bg-blue-500 shadow-lg shadow-blue-600/20 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              Accept
            </button>
          </div>
        </div>
      </div>
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
    if (code) router.push(`/challenge/${code}/pre-lobby`);
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
      {popup && <ChallengePopupOverlay popup={popup} onAccept={handleAccept} onDecline={handleDecline} />}

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

        {/* RESPONSIVE DROPDOWN: Fixed center on mobile, absolute on desktop */}
        {open && (
          <div className={cn(
            "fixed inset-x-4 top-20 bottom-auto z-50 rounded-3xl border border-border bg-background shadow-2xl overflow-hidden sm:absolute sm:inset-auto sm:right-0 sm:top-12 sm:w-80 sm:max-h-[480px]",
            "animate-in fade-in zoom-in-95 duration-200"
          )}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30">
              <span className="text-sm font-black text-foreground">Activity</span>
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-xs font-bold text-blue-500 hover:text-blue-600">
                  Clear All
                </button>
              )}
            </div>

            <div className="overflow-y-auto max-h-[60vh] sm:max-h-96">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                   <div className="h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="py-12 px-6 text-center">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3 text-muted-foreground">
                    <Bell size={20} />
                  </div>
                  <p className="text-sm font-bold text-foreground">No updates yet</p>
                  <p className="text-xs text-muted-foreground mt-1">We'll notify you when someone challenges you.</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => {
                       // ... (your existing click logic)
                    }}
                    className={cn(
                      "group flex gap-3 px-5 py-4 border-b border-border/50 cursor-pointer transition-colors",
                      !n.isRead ? "bg-blue-500/[0.03]" : "hover:bg-muted/50"
                    )}
                  >
                    <div className={cn(
                      "mt-1.5 h-2 w-2 rounded-full shrink-0 transition-transform group-hover:scale-125",
                      n.isRead ? "bg-transparent" : "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-foreground truncate leading-none mb-1">{n.title}</p>
                      <p className="text-[12px] text-muted-foreground line-clamp-2 leading-relaxed">{n.body}</p>
                      <p className="text-[10px] font-medium text-muted-foreground/50 mt-2 uppercase tracking-tight">{timeAgo(n.createdAt)}</p>
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