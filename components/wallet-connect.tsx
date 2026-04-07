"use client"

import Link from "next/link"
import { useState, useEffect, useCallback, useRef } from "react"
import { usePrivy, useWallets, type User } from '@privy-io/react-auth'
import { useWallet } from "@/components/wallet-provider"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LayoutDashboard, LogOut, Copy, ChevronDown, Wallet, User as UserIcon } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const API_BASE_URL = "https://faucetdrop-backend.onrender.com"

interface WalletConnectButtonProps {
  className?: string; 
}

export function WalletConnectButton({ className }: WalletConnectButtonProps) {
  const { ready, authenticated, login, logout, user } = usePrivy()
  const { wallets } = useWallets()
  const { address, walletType, isConnected } = useWallet()
  
  const [dbUsername, setDbUsername] = useState<string | null>(null)
  const [dbAvatarUrl, setDbAvatarUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  
  const hasSyncedRef = useRef(false)

  // --- 🚀 NEW: AUTO-CONNECT FOR MINIPAY ---
  useEffect(() => {
    // If Privy is ready, user is NOT authenticated, and we are inside MiniPay, force login.
    if (ready && !authenticated && typeof window !== 'undefined' && window.ethereum?.isMiniPay) {
      console.log("[AutoConnect] MiniPay detected. Connecting automatically...")
      login()
    }
  }, [ready, authenticated, login])

  // --- FALLBACK HELPERS ---
  const getFallbackAvatar = useCallback((privyUser: User | null) => {
    if (!privyUser) return "";
    const google = privyUser.google as any;
    const twitter = privyUser.twitter as any;
    return google?.picture || google?.profilePictureUrl || twitter?.profilePictureUrl || "";
  }, []);

  const getFallbackUsername = useCallback((privyUser: User | null) => {
    if (!privyUser) return "";
    if (privyUser.twitter?.username) return privyUser.twitter.username;
    if (privyUser.discord?.username) return privyUser.discord.username;
    if (privyUser.google?.name) return privyUser.google.name.replace(/\s+/g, '');
    if (privyUser.email?.address) return privyUser.email.address.split('@')[0];
    return "User"; 
  }, []);

  // --- AUTO-SYNC & FETCH LOGIC ---
  useEffect(() => {
    if (!isConnected || !address || !user) {
      setDbUsername(null)
      setDbAvatarUrl(null)
      hasSyncedRef.current = false
      return
    }

    let isMounted = true
    setLoading(true)

    const fetchOrSyncProfile = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/users/${address.toLowerCase()}`)
        let profileExists = false;

        if (response.ok) {
          const data = await response.json()
          const profileData = data.profile || (data.username ? data : null)

          if (profileData && profileData.username && profileData.username !== "New User") {
            profileExists = true;
            if (isMounted) {
              setDbUsername(profileData.username)
              setDbAvatarUrl(profileData.avatar_url || profileData.avatarUrl || "")
            }
          }
        }

        if (!profileExists && !hasSyncedRef.current) {
          hasSyncedRef.current = true; 
          
          const fallbackUsername = getFallbackUsername(user) || `user_${address.slice(-4)}`;
          const fallbackAvatar = getFallbackAvatar(user);
          const email = user?.email?.address || "";
          
          console.log("[AutoSync] Creating new profile for:", fallbackUsername);

          const syncRes = await fetch(`${API_BASE_URL}/api/profile/sync`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  wallet_address: address,
                  username: fallbackUsername,
                  avatar_url: fallbackAvatar,
                  email: email
              })
          });
          
          const syncData = await syncRes.json();
          if (syncData.success && syncData.profile && isMounted) {
              setDbUsername(syncData.profile.username);
              setDbAvatarUrl(syncData.profile.avatar_url);
              
              window.dispatchEvent(new CustomEvent('profileUpdated', {
                  detail: { username: syncData.profile.username, avatarUrl: syncData.profile.avatar_url }
              }));
          }
        }
      } catch (error) {
        console.error("❌ Failed to fetch/sync user profile:", error)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    fetchOrSyncProfile()

    return () => { isMounted = false }
  }, [address, isConnected, user, getFallbackUsername, getFallbackAvatar])

  // --- LISTEN FOR MANUAL PROFILE SAVES ---
  useEffect(() => {
    const handleProfileUpdate = (event: CustomEvent) => {
      const { username: newUsername, avatarUrl: newAvatarUrl } = event.detail
      if (newUsername) setDbUsername(newUsername)
      if (newAvatarUrl) setDbAvatarUrl(newAvatarUrl)
    }
    window.addEventListener('profileUpdated' as any, handleProfileUpdate)
    return () => window.removeEventListener('profileUpdated' as any, handleProfileUpdate)
  }, [])

  const displayName = dbUsername || "Anonymous";
  const displayAvatar = dbAvatarUrl || getFallbackAvatar(user);
  
  const dashboardLink = dbUsername 
    ? `/dashboard/${dbUsername}` 
    : `/dashboard/${address?.toLowerCase() || ''}`

  const getWalletName = () => {
    if (!wallets[0]) return null
    const wallet = wallets[0]
    if (wallet.walletClientType === 'privy') return 'Embedded Wallet'
    return wallet.walletClientType === 'metamask' ? 'MetaMask' :
           wallet.walletClientType === 'coinbase_wallet' ? 'Coinbase' :
           'External Wallet'
  }

  // NOTE: If they are in MiniPay, they likely will never see this loading state
  // because the auto-connect fires immediately once `ready` is true.
  if (!ready) {
    return (
      <Button 
        size="sm" 
        disabled 
        variant="outline" 
        className={cn("text-xs font-bold uppercase tracking-widest px-6 opacity-50 border-border", className)}
      >
        Loading...
      </Button>
    )
  }

  if (!isConnected) {
    return (
      <Button 
        onClick={login} 
        size="sm" 
        variant="default" 
        className={cn("text-xs font-bold uppercase tracking-widest px-6 shadow-md hover:scale-105 transition-all", className)}
      >
        Get Started
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className={cn("flex items-center gap-2 p-1 sm:pr-3 border-primary/20 hover:bg-primary/5 transition-all rounded-full h-9 relative", className)}
        >
          <div className="relative">
            <Avatar className="h-7 w-7 border border-background shadow-sm">
              <AvatarImage src={displayAvatar} className="object-cover" />
              <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
                {loading ? <span className="animate-pulse">...</span> : displayName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {walletType === 'external' && (
              <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-blue-500 rounded-full border border-background flex items-center justify-center">
                <Wallet className="h-2 w-2 text-white" />
              </div>
            )}
          </div>

          <span className="hidden sm:block text-xs sm:text-sm font-medium max-w-[100px] truncate">
            {loading ? "..." : displayName}
          </span>
          <ChevronDown className="hidden sm:block h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56 z-[200]" sideOffset={8}>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none truncate">{displayName}</p>
            {user?.email && <p className="text-xs leading-none text-muted-foreground truncate">{user.email.address}</p>}
            {address && (
              <div className="flex items-center gap-1">
                <p className="text-xs leading-none text-muted-foreground font-mono">{address.slice(0, 6)}...{address.slice(-4)}</p>
                {walletType === 'external' && <span className="text-[10px] bg-blue-500/10 text-blue-600 px-1.5 py-0.5 rounded">{getWalletName()}</span>}
              </div>
            )}
          </div>
        </DropdownMenuLabel>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href={dashboardLink} className="cursor-pointer flex items-center gap-2"> 
              {dbUsername ? <UserIcon className="h-4 w-4" /> : <LayoutDashboard className="h-4 w-4" />}
              <span>{dbUsername ? "Profile" : "Dashboard"}</span>
            </Link>
          </DropdownMenuItem>
          {address && (
            <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(address); toast.success("Address copied to clipboard!") }} className="cursor-pointer flex items-center gap-2">
              <Copy className="h-4 w-4" />
              <span>Copy Address</span>
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
      
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout} className="cursor-pointer flex items-center gap-2 text-red-600 focus:text-red-600 focus:bg-red-50">
          <LogOut className="h-4 w-4" />
          <span>Disconnect</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}