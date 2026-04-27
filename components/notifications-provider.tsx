"use client";
import React, { useEffect, useState, useRef, useCallback } from "react";
import { useWallet } from "@/hooks/use-wallet";
import { useRouter } from "next/navigation";
import { Bell, X, Check, Zap } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createPortal } from "react-dom";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://faucetpay-backend.koyeb.app0";

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
  const creatorName = n.data?.creatorName || "A challenger";
  const topic = n.data?.topic || "a random topic";

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-6 animate-in fade-in duration-200"
      style={{
        background: "radial-gradient(circle at center, rgba(30, 41, 59, 0.75) 0%, rgba(15, 23, 42, 0.92) 100%)",
        backdropFilter: "blur(10px) saturate(160%)",
      }}
      onClick={onDecline}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "relative w-full sm:max-w-[380px] overflow-hidden",
          // Mobile: slides up from bottom as a sheet
          "rounded-t-[28px] sm:rounded-[32px]",
          "border border-white/10 bg-slate-900 shadow-2xl",
          "animate-in slide-in-from-bottom-8 duration-300",
        )}
      >
        {/* Decorative pattern */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />

        {/* Drag handle on mobile */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-slate-700" />
        </div>

        <div className="relative px-5 pt-4 pb-6 sm:p-8 sm:text-center">
          {/* Avatar */}
          <div className="flex justify-center mb-4">
            <div className="h-14 w-14 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold border-2 border-blue-500/30 text-lg shadow-[0_0_20px_rgba(59,130,246,0.2)]">
              {creatorName.slice(0, 2).toUpperCase()}
            </div>
          </div>

          {/* Text */}
          <div className="space-y-1.5 mb-4 text-center">
            <h3 className="text-white font-black text-xl leading-tight">
              Challenge Issued!
            </h3>
            <p className="text-slate-300 text-sm leading-relaxed px-2">
              <span className="text-blue-400 font-bold">{creatorName}</span>{" "}
              challenged you on{" "}
              <span className="text-white font-bold">"{topic}"</span>
            </p>
          </div>

          {/* Stake badge — blue not amber */}
          {n.data?.stake && (
            <div className="flex items-center justify-center gap-2 bg-blue-500/10 rounded-xl py-2 px-4 border border-blue-500/20 mb-4 w-fit mx-auto">
              <Zap size={13} className="text-blue-400 fill-blue-400" />
              <span className="text-[11px] font-black text-blue-400 uppercase tracking-widest">
                Stake: {n.data.stake} {n.data.token}
              </span>
            </div>
          )}

          {/* Timer */}
          <div className="mb-5">
            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all duration-1000 linear rounded-full",
                  isUrgent
                    ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]"
                    : "bg-blue-500",
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex justify-between items-center mt-1.5">
              <p
                className={cn(
                  "text-[10px] font-bold tracking-widest uppercase",
                  isUrgent ? "text-red-500" : "text-slate-500",
                )}
              >
                {isUrgent ? "Expiring soon" : "Incoming challenge"}
              </p>
              <p
                className={cn(
                  "text-[11px] font-black tabular-nums",
                  isUrgent ? "text-red-500" : "text-blue-400",
                )}
              >
                {secondsLeft}s
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2.5">
            <button
              onClick={onAccept}
              className="w-full py-4 rounded-2xl bg-blue-600 text-white font-black text-base hover:bg-blue-500 shadow-lg shadow-blue-600/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <Zap className="h-4 w-4 fill-white" /> Accept Challenge
            </button>
            <button
              onClick={onDecline}
              className="w-full py-3.5 rounded-2xl bg-slate-800 text-slate-400 font-bold text-sm hover:bg-slate-700 transition-colors active:scale-[0.98]"
            >
              Decline
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
function PopupPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}

// ── Main Component ────────────────────────────────────────────────────────────

export function NotificationBell() {
  const { address } = useWallet();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [popup, setPopup] = useState<ChallengePopup | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const popupTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // Close panel on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Fetch notifications when panel opens
  useEffect(() => {
  if (!address) return;
  fetch(`${API_BASE_URL}/api/notifications/${address.toLowerCase()}`)
    .then((r) => r.json())
    .then((d) => {
      const unread = (d.notifications ?? []).filter((n: Notification) => !n.isRead);
      if (unread.length > 0) {
        setNotifications(d.notifications ?? []);
      }
    })
    .catch(() => {});
}, [address]);

  // Clear popup timer on unmount
  useEffect(() => {
    return () => {
      if (popupTimer.current) clearInterval(popupTimer.current);
    };
  }, []);

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
        id: data.id ?? String(Date.now()),
        type: data.type,
        title: data.title,
        body: data.body,
        data: data.data,
        isRead: false,
        createdAt: new Date().toISOString(),
      };

      // Public challenge invite → show popup
      if (data.type === "public_challenge" || data.type === "friend_invite" || data.type === "rematch_request") {
        setNotifications((prev) =>
          prev.some((n) => n.id === notif.id) ? prev : [notif, ...prev]
        );
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
    
    // Mark as read immediately
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
    // Optimistic UI update
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    await fetch(`${API_BASE_URL}/api/notifications/${address.toLowerCase()}/read/${id}`, { method: "POST" }).catch(() => {});
  };

  return (
    <>
      {popup && (
        <PopupPortal>
          <ChallengePopupOverlay
            popup={popup}
            onAccept={handleAccept}
            onDecline={handleDecline}
          />
        </PopupPortal>
      )}

      <div className="relative" ref={panelRef}>
        <button
          onClick={() => setOpen((o) => !o)}
          className="relative p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-95"
        >
          <Bell className="h-5 w-5 text-slate-600 dark:text-slate-300" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-white dark:ring-slate-900">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        {/* RESPONSIVE DROPDOWN: Fixed center on mobile, absolute on desktop. High z-index to stay above game UI */}
        {open && (
          <div className={cn(
            "fixed inset-x-4 top-20 bottom-auto z-[100] rounded-3xl border border-border bg-background shadow-2xl overflow-hidden sm:absolute sm:inset-auto sm:right-0 sm:top-12 sm:w-[360px] sm:max-h-[480px]",
            "animate-in fade-in zoom-in-95 duration-200"
          )}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30">
              <span className="text-sm font-black text-foreground">Activity</span>
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-xs font-bold text-blue-500 hover:text-blue-600 transition-colors">
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
                notifications.map((n) => {
                  const challengeCode = n.data?.code;
                  const isInteractive = !!challengeCode;

                  return (
                    <div
                      key={n.id}
                      onClick={() => {
                        if (!n.isRead) markOneRead(n.id);
                        
                        if (isInteractive) {
                          setOpen(false); // Close dropdown
                          // Route based on type
                          if (n.type === "public_challenge" || n.type === "friend_invite" || n.type === "rematch_request") {
                            router.push(`/challenge/${challengeCode}/pre-lobby`);
                          } else {
                            router.push(`/challenge/${challengeCode}`);
                          }
                        }
                      }}
                      className={cn(
                        "group flex gap-3 px-5 py-4 border-b border-border/50 transition-colors",
                        isInteractive ? "cursor-pointer" : "cursor-default",
                        !n.isRead ? "bg-blue-500/[0.04]" : "hover:bg-muted/50"
                      )}
                    >
                      <div className={cn(
                        "mt-1.5 h-2 w-2 rounded-full shrink-0 transition-transform group-hover:scale-125",
                        n.isRead ? "bg-transparent" : "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                      )} />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className="text-[13px] font-bold text-foreground truncate leading-none pt-0.5">
                            {n.title}
                          </p>
                          {/* Visual indicator that this notification is actionable */}
                          {isInteractive && (
                            <div className="shrink-0 text-[9px] bg-blue-500/10 text-blue-500 px-1.5 py-0.5 rounded flex items-center font-black uppercase tracking-tighter">
                              Join
                            </div>
                          )}
                        </div>
                        
                        <p className="text-[12px] text-muted-foreground line-clamp-2 leading-relaxed">
                          {n.body}
                        </p>
                        
                        <p className="text-[10px] font-medium text-muted-foreground/50 mt-2 uppercase tracking-tight">
                          {timeAgo(n.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}