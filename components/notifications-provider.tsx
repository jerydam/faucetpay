"use client";
import React, { useEffect, useState, useRef } from "react";
import { useWallet } from "@/hooks/use-wallet";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const API_BASE_URL = "http://127.0.0.1:8000";
const WS_NOTIFY_URL = "wss://127.0.0.1:8000/ws/notify";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  data?: { code?: string };
  isRead: boolean;
  createdAt: string;
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function NotificationBell() {
  const { address } = useWallet();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  // Close on outside click
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
    if (!open || !address) return;
    setLoading(true);
    fetch(`${API_BASE_URL}/api/notifications/${address.toLowerCase()}`)
      .then(r => r.json())
      .then(d => setNotifications(d.notifications ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, address]);

  // Live WebSocket push
  useEffect(() => {
    if (!address) return;
    const ws = new WebSocket(`${WS_NOTIFY_URL}/${address.toLowerCase()}`);
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "unread_count") return; // handled by fetch
      // New live notification arrived
      setNotifications(prev => [data, ...prev]);
      toast(data.title, {
        description: data.body,
        action: data.data?.code ? {
          label: "Join",
          onClick: () => window.location.href = `/quiz/${data.data.code}`,
        } : undefined,
      });
    };
    return () => ws.close();
  }, [address]);

  const markAllRead = async () => {
    if (!address) return;
    await fetch(`${API_BASE_URL}/api/notifications/${address.toLowerCase()}/read-all`, { method: "POST" });
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const markOneRead = async (id: string) => {
    if (!address) return;
    await fetch(`${API_BASE_URL}/api/notifications/${address.toLowerCase()}/read/${id}`, { method: "POST" });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        <Bell className="h-5 w-5 text-slate-600 dark:text-slate-300" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-white dark:ring-slate-900">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-11 w-80 z-50 rounded-2xl border border-border bg-background shadow-xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-sm font-bold text-foreground">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-blue-500 hover:underline">
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">No notifications yet</div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => markOneRead(n.id)}
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
  );
}