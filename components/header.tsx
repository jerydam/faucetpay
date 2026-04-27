"use client"

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { WalletConnectButton } from "@/components/wallet-connect";
import Link from "next/link";
import { Menu, X, ChevronLeft, Plus, RefreshCw } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { useWallet } from "@/hooks/use-wallet";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./theme";
import { NotificationBell } from "./notifications-provider";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://faucetpay-backend.koyeb.app0";

export function Header({ 
  pageTitle, 
  hideAction = false,
  isDashboard = false,
  onRefresh,
  loading = false
}: { 
  pageTitle: string; 
  hideAction?: boolean; 
  isDashboard?: boolean;
  onRefresh?: () => void | Promise<void>;
  loading?: boolean;
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMiniPay, setIsMiniPay] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [username, setUsername] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const router = useRouter();
  const pathname = usePathname();
  const { isConnected, address } = useWallet();

  // Detect MiniPay once on mount
  useEffect(() => {
    setIsMiniPay(!!(window.ethereum as any)?.isMiniPay);
  }, []);

  // Fetch profile for avatar — only when in MiniPay (wallet auto-connected)
  useEffect(() => {
    if (!isMiniPay || !address) return;
    fetch(`${API_BASE_URL}/api/profile/${address.toLowerCase()}`)
      .then(r => r.json())
      .then(d => {
        if (d.profile) {
          setAvatarUrl(d.profile.avatar_url || "");
          setUsername(d.profile.username || "");
        }
      })
      .catch(() => {});
  }, [isMiniPay, address]);

  // Re-fetch when profile is updated
  useEffect(() => {
    const handler = (e: any) => {
      if (e.detail?.avatarUrl) setAvatarUrl(e.detail.avatarUrl);
      if (e.detail?.username)  setUsername(e.detail.username);
    };
    window.addEventListener("profileUpdated", handler);
    return () => window.removeEventListener("profileUpdated", handler);
  }, []);

  const isDashboardPage = isDashboard || 
    pageTitle.includes("Dashboard") || 
    pageTitle.includes("Space") || 
    pathname.includes("/dashboard");

  const getActionConfig = () => {
    if (pathname.includes("/quest"))     return { label: "Create Quest",     path: "/quest/create-quest"         };
    if (pathname.includes("/quiz"))      return { label: "Create Quiz",      path: "/quiz/create-quiz"           };
    if (pathname.includes("/challenge")) return { label: "Create Challenge", path: "/challenge/create-challenge" };
    return { label: "Create Faucet", path: "/faucet/create-faucet" };
  };

  const action = getActionConfig();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current   && !menuRef.current.contains(event.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(event.target as Node)
      ) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Initials fallback for avatar
  const initials = username
    ? username.slice(0, 2).toUpperCase()
    : address
    ? address.slice(2, 4).toUpperCase()
    : "?";

  // Navigate to own dashboard profile
  const goToProfile = () => {
    if (username) {
      router.push(`/dashboard/${username}`);
    } else if (address) {
      router.push(`/dashboard/${address.toLowerCase()}`);
    }
  };

  // Profile button — shown only inside MiniPay when wallet is connected
  const ProfileButton = () => {
    if (!isMiniPay || !isConnected) return null;
    return (
      <button
        onClick={goToProfile}
        title="My Profile"
        className={cn(
          "relative flex items-center justify-center rounded-full",
          "ring-2 ring-border hover:ring-primary/50 transition-all duration-150",
          "active:scale-95 hover:scale-105",
        )}
      >
        <Avatar className="h-8 w-8">
          <AvatarImage src={avatarUrl} className="object-cover" />
          <AvatarFallback className="text-xs font-black bg-primary/10 text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
      </button>
    );
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-[100] w-full bg-background/80 backdrop-blur-md border-b border-border px-4 sm:px-10 h-20">
        <div className="max-w-[1400px] mx-auto h-full flex items-center justify-between">
          
          {/* Left Section */}
          <div className="flex items-center gap-4">       
            <Button
              variant="outline"
              size="icon"
              onClick={() => router.back()}
              className="rounded-full text-gray-400 hover:text-white transition-colors flex" 
              title="Go Back"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
           
            <h1 className="text-sm sm:text-base font-black tracking-tighter uppercase text-foreground/90">
              <Link href="/" className="hover:text-blue-500 transition-colors">
                {pageTitle}
              </Link>
            </h1>

            {onRefresh && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRefresh()}
                disabled={loading}
                className={cn("hidden md:flex items-center gap-2", loading && "opacity-50")}
              >
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                <span className="text-[10px] font-bold uppercase tracking-widest">
                  {loading ? "Syncing" : "Refresh"}
                </span>
              </Button>
            )}
          </div>
        
          {/* Desktop Actions */}
          <div className="hidden lg:flex items-center gap-4">
            <ThemeToggle />
            <NotificationBell />

            {isConnected && !hideAction && (
              <Button
                onClick={() => router.push(action.path)}
                variant="default"
                className="text-xs font-bold uppercase tracking-widest px-6 shadow-md hover:scale-105 transition-transform"
              >
                <Plus className="mr-2 h-4 w-4" />
                {action.label}
              </Button>
            )}

            {/* MiniPay: show profile avatar instead of wallet connect button */}
            {isMiniPay ? (
              <ProfileButton />
            ) : (
              <div className="border-l border-border pl-4">
                <WalletConnectButton />
              </div>
            )}
          </div>

          {/* Mobile Actions */}
          <div className="lg:hidden flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <NotificationBell />

            {/* MiniPay: profile avatar replaces wallet connect */}
            {isMiniPay ? (
              <ProfileButton />
            ) : (
              <WalletConnectButton />
            )}

            
          </div>
        </div>

        {/* Mobile Menu Overlay */}
        {isMenuOpen && (
          <div
            ref={menuRef}
            className="lg:hidden absolute top-[79px] left-0 w-full bg-background border-b border-border p-6 flex flex-col gap-4 shadow-xl animate-in fade-in slide-in-from-top-2 duration-200"
          >
            {onRefresh && (
              <Button 
                variant="outline" 
                onClick={() => { onRefresh(); setIsMenuOpen(false); }}
                disabled={loading}
                className="w-full text-xs font-bold uppercase tracking-widest py-6"
              >
                <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
                Refresh Data
              </Button>
            )}

            {isConnected && !hideAction && (
              <Button
                onClick={() => { router.push(action.path); setIsMenuOpen(false); }}
                variant="default"
                className="w-full text-xs font-bold uppercase tracking-widest py-6"
              >
                <Plus className="mr-2 h-4 w-4" />
                {action.label}
              </Button>
            )}
          </div>
        )}
      </header>
      
      <div className="h-20" />
    </>
  );
}