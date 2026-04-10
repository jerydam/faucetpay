"use client"

import Link from "next/link"
import { useState, useEffect, useCallback, useRef } from "react"
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
import { LayoutDashboard, LogOut, Copy, ChevronDown } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const API_BASE_URL = "https://identical-vivi-faucetdrops-41e9c56b.koyeb.app"

interface WalletConnectButtonProps {
  className?: string
}

export function WalletConnectButton({ className }: WalletConnectButtonProps) {
  const { address, isConnected, isConnecting, connect, disconnect } = useWallet()

  const [dbUsername, setDbUsername] = useState<string | null>(null)
  const [dbAvatarUrl, setDbAvatarUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const hasSyncedRef = useRef(false)

  // Fetch or create profile when wallet connects
  useEffect(() => {
    if (!isConnected || !address) {
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

        if (response.ok) {
          const data = await response.json()
          const profile = data.profile || (data.username ? data : null)

          if (profile?.username && profile.username !== "New User") {
            if (isMounted) {
              setDbUsername(profile.username)
              setDbAvatarUrl(profile.avatar_url || profile.avatarUrl || "")
            }
            return
          }
        }

        // No profile yet — create one
        if (!hasSyncedRef.current) {
          hasSyncedRef.current = true
          const fallbackUsername = `user_${address.slice(-4)}`

          const syncRes = await fetch(`${API_BASE_URL}/api/profile/sync`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              wallet_address: address,
              username: fallbackUsername,
              avatar_url: "",
              email: "",
            }),
          })

          const syncData = await syncRes.json()
          if (syncData.success && syncData.profile && isMounted) {
            setDbUsername(syncData.profile.username)
            setDbAvatarUrl(syncData.profile.avatar_url)

            window.dispatchEvent(
              new CustomEvent("profileUpdated", {
                detail: {
                  username: syncData.profile.username,
                  avatarUrl: syncData.profile.avatar_url,
                },
              })
            )
          }
        }
      } catch (err) {
        console.error("Failed to fetch/sync profile:", err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    fetchOrSyncProfile()
    return () => { isMounted = false }
  }, [address, isConnected])

  // Listen for manual profile saves
  useEffect(() => {
    const handleProfileUpdate = (event: CustomEvent) => {
      const { username, avatarUrl } = event.detail
      if (username) setDbUsername(username)
      if (avatarUrl) setDbAvatarUrl(avatarUrl)
    }
    window.addEventListener("profileUpdated" as any, handleProfileUpdate)
    return () => window.removeEventListener("profileUpdated" as any, handleProfileUpdate)
  }, [])

  const displayName = dbUsername || "Anonymous"
  const displayAvatar = dbAvatarUrl || ""
  const dashboardLink = dbUsername
    ? `/dashboard/${dbUsername}`
    : `/dashboard/${address?.toLowerCase() || ""}`

  if (isConnecting) {
    return (
      <Button
        size="sm"
        disabled
        variant="outline"
        className={cn("text-xs font-bold uppercase tracking-widest px-6 opacity-50 border-border", className)}
      >
        Connecting...
      </Button>
    )
  }

  if (!isConnected) {
    const isMiniPay = typeof window !== "undefined" && !!window.ethereum?.isMiniPay

    if (!isMiniPay) {
      return (
        <Button
          size="sm"
          variant="outline"
          disabled
          className={cn("text-xs font-bold uppercase tracking-widest px-6 opacity-60 border-border", className)}
        >
          Open in MiniPay
        </Button>
      )
    }

    return (
      <Button
        onClick={connect}
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
          className={cn("flex items-center gap-2 p-1 sm:pr-3 border-primary/20 hover:bg-primary/5 transition-all rounded-full h-9", className)}
        >
          <Avatar className="h-7 w-7 border border-background shadow-sm">
            <AvatarImage src={displayAvatar} className="object-cover" />
            <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
              {loading ? <span className="animate-pulse">...</span> : displayName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
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
            {address && (
              <p className="text-xs leading-none text-muted-foreground font-mono">
                {address.slice(0, 6)}...{address.slice(-4)}
              </p>
            )}
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href={dashboardLink} className="cursor-pointer flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4" />
              <span>{dbUsername ? "Profile" : "Dashboard"}</span>
            </Link>
          </DropdownMenuItem>
          {address && (
            <DropdownMenuItem
              onClick={() => { navigator.clipboard.writeText(address); toast.success("Address copied!") }}
              className="cursor-pointer flex items-center gap-2"
            >
              <Copy className="h-4 w-4" />
              <span>Copy Address</span>
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={disconnect}
          className="cursor-pointer flex items-center gap-2 text-red-600 focus:text-red-600 focus:bg-red-50"
        >
          <LogOut className="h-4 w-4" />
          <span>Disconnect</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}