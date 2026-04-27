/** /components/wallet-connect-button.tsx */
"use client"

import Link from "next/link"
import { useState, useEffect, useRef } from "react"
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
import { LayoutDashboard, LogOut, Copy, ChevronDown, Wallet } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const API_BASE_URL = "https://faucetpay-backend.koyeb.app"

interface WalletConnectButtonProps {
  className?: string
}

export function WalletConnectButton({ className }: WalletConnectButtonProps) {
  const { address, isConnected, isConnecting, connect, disconnect } = useWallet()

  const [dbUsername, setDbUsername]   = useState<string | null>(null)
  const [dbAvatarUrl, setDbAvatarUrl] = useState<string | null>(null)
  const [loading, setLoading]         = useState(false)
  const hasSyncedRef = useRef(false)

  // ── Fetch or create profile when wallet connects ──────────────────────
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
        // Use the same endpoint the rest of the app uses
        const res  = await fetch(`${API_BASE_URL}/api/profile/${address.toLowerCase()}`)
        const data = await res.json()

        const profile = data.profile ?? null

        if (profile?.username && profile.username !== "Dropee") {
          if (isMounted) {
            setDbUsername(profile.username)
            setDbAvatarUrl(profile.avatar_url || "")
          }
          return
        }

        // No profile yet — create a stub
        if (!hasSyncedRef.current) {
          hasSyncedRef.current = true
          const fallbackUsername = `user_${address.slice(-4)}`

          const syncRes  = await fetch(`${API_BASE_URL}/api/profile/sync`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              wallet_address: address,
              username:   fallbackUsername,
              avatar_url: "",
              email:      "",
            }),
          })
          const syncData = await syncRes.json()

          if (syncData.success && syncData.profile && isMounted) {
            setDbUsername(syncData.profile.username)
            setDbAvatarUrl(syncData.profile.avatar_url || "")
            window.dispatchEvent(new CustomEvent("profileUpdated", {
              detail: {
                username:  syncData.profile.username,
                avatarUrl: syncData.profile.avatar_url,
              },
            }))
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

  // ── Listen for profile updates (e.g. after editing in the modal) ──────
  useEffect(() => {
    const handleUpdate = (e: CustomEvent) => {
      const { username, avatarUrl } = e.detail
      if (username)  setDbUsername(username)
      if (avatarUrl) setDbAvatarUrl(avatarUrl)
    }
    window.addEventListener("profileUpdated" as any, handleUpdate)
    return () => window.removeEventListener("profileUpdated" as any, handleUpdate)
  }, [])

  // Always resolvable — fall back to address slug if username not yet loaded
  const displayName   = dbUsername || (address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "—")
  const displayAvatar = dbAvatarUrl || ""
  // Link is always valid: username path when available, address path otherwise
  const dashboardLink = dbUsername
    ? `/dashboard/${dbUsername}`
    : `/dashboard/${address?.toLowerCase() ?? ""}`

  // ── Connecting state ──────────────────────────────────────────────────
  if (isConnecting) {
    return (
      <Button
        size="sm" disabled variant="outline"
        className={cn(
          "text-xs font-bold uppercase tracking-widest px-6 opacity-50 border-border animate-pulse",
          className,
        )}
      >
        Connecting…
      </Button>
    )
  }

  // ── Not connected ─────────────────────────────────────────────────────
  if (!isConnected) {
    const hasWallet = typeof window !== "undefined" && !!window.ethereum
    return (
      <Button
        onClick={connect}
        disabled={!hasWallet}
        size="sm"
        variant="default"
        className={cn(
          "text-xs font-bold uppercase tracking-widest px-6 shadow-md hover:scale-105 transition-all bg-blue-600 hover:bg-blue-500 text-white",
          className,
        )}
      >
        <Wallet className="mr-2 h-4 w-4" />
        {hasWallet ? "Connect Wallet" : "No Wallet Detected"}
      </Button>
    )
  }

  // ── Connected ─────────────────────────────────────────────────────────
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "flex items-center gap-2 p-1 sm:pr-3 border-primary/20 hover:bg-primary/5 transition-all rounded-full h-9",
            className,
          )}
        >
          <Avatar className="h-7 w-7 border border-background shadow-sm">
            <AvatarImage src={displayAvatar} className="object-cover" />
            <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
              {loading
                ? <span className="animate-pulse">…</span>
                : displayName.charAt(0).toUpperCase()
              }
            </AvatarFallback>
          </Avatar>
          <span className="hidden sm:block text-xs sm:text-sm font-medium max-w-[100px] truncate">
            {loading ? "…" : displayName}
          </span>
          <ChevronDown className="hidden sm:block h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56 z-[200] rounded-xl" sideOffset={8}>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-bold leading-none truncate">{displayName}</p>
            {address && (
              <p className="text-[10px] leading-none text-muted-foreground font-mono">
                {address.slice(0, 6)}…{address.slice(-4)}
              </p>
            )}
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          {/* Profile link — always active once connected; dims only while loading */}
          <DropdownMenuItem asChild>
            <Link
              href={dashboardLink}
              className={cn(
                "cursor-pointer flex items-center gap-2",
                loading && "opacity-50 pointer-events-none",
              )}
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>Profile</span>
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => {
              if (address) {
                navigator.clipboard.writeText(address)
                toast.success("Address copied!")
              }
            }}
            className="cursor-pointer flex items-center gap-2"
          >
            <Copy className="h-4 w-4" />
            <span>Copy Address</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={disconnect}
          className="cursor-pointer flex items-center gap-2 text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/20"
        >
          <LogOut className="h-4 w-4" />
          <span>Disconnect</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}