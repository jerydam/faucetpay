"use client"

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { WalletConnectButton } from "@/components/wallet-connect";
import { NetworkSelector, MiniNetworkIndicator } from "@/components/network-selector";
import Link from "next/link";
import { Menu, X, ChevronLeft, Plus, RefreshCw } from "lucide-react"; // Added RefreshCw icon
import { useRouter, usePathname } from "next/navigation";
import { useWallet } from "@/hooks/use-wallet";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./theme";

export function Header({ 
  pageTitle, 
  hideAction = false,
  isDashboard = false,
  onRefresh, // 💡 Added
  loading = false // 💡 Added
}: { 
  pageTitle: string; 
  hideAction?: boolean; 
  isDashboard?: boolean;
  onRefresh?: () => void | Promise<void>; // 💡 Added type
  loading?: boolean; // 💡 Added type
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const router = useRouter();
  const pathname = usePathname();
  const { isConnected } = useWallet();

  const isDashboardPage = isDashboard || 
    pageTitle.includes('Dashboard') || 
    pageTitle.includes('Space') || 
    pathname.includes('/dashboard');

  const getActionConfig = () => {
    if (pathname.includes('/quest')) return { label: "Create Quest", path: "/quest/create-quest" };
    if (pathname.includes('/quiz')) return { label: "Create Quiz", path: "/quiz/create-quiz" };
    return { label: "Create Faucet", path: "/faucet/create-faucet" };
  };

  const action = getActionConfig();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

            {/* 💡 Visual Feedback for Refreshing */}
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
            <ThemeToggle/>
            {isConnected && (
              <>
                <NetworkSelector />
                {!hideAction && (
                  <Button
                      onClick={() => router.push(action.path)}
                      variant="default"
                      className="text-xs font-bold uppercase tracking-widest px-6 shadow-md hover:scale-105 transition-transform"
                  >
                      <Plus className="mr-2 h-4 w-4" />
                      {action.label}
                  </Button>
                )}
              </>
            )}
            <div className="border-l border-border pl-4">
               <WalletConnectButton />
            </div>
          </div>

          {/* Mobile Actions */}
          <div className="lg:hidden flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <WalletConnectButton />

            {isConnected && (
              <MiniNetworkIndicator className="h-9 w-9 border border-border rounded-md" />
            )}

            {!isDashboardPage && isConnected && 
              <Button
                ref={buttonRef}
                variant="outline"
                size="sm"
                className="px-2 border-border shadow-sm"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
              >
                {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            }
          </div>
        </div>

        {/* Mobile Menu Overlay */}
        {isMenuOpen && (
          <div
            ref={menuRef}
            className="lg:hidden absolute top-[79px] left-0 w-full bg-background border-b border-border p-6 flex flex-col gap-4 shadow-xl animate-in fade-in slide-in-from-top-2 duration-200"
          >
            {/* 💡 Mobile Refresh Option */}
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
                onClick={() => {
                  router.push(action.path);
                  setIsMenuOpen(false);
                }}
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