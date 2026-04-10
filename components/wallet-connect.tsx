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
import { LayoutDashboard, LogOut, Copy, ChevronDown, Edit2 } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { ProfileSettingsModal } from "@/components/profile-settings-modal"

const API_BASE_URL = "https://identical-vivi-faucetdrops-41e9c56b.koyeb.app"

interface WalletConnectButtonProps {
  className?: string
}

export function WalletConnectButton({ className }: WalletConnectButtonProps) {
  const { address, isConnected, isConnecting, connect, disconnect } = useWallet()

  const [dbUsername, setDbUsername] = useState<string | null>(null)
  const [dbAvatarUrl, setDbAvatarUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [profileModalOpen, setProfileModalOpen] = useState(false)
  const hasSyncedRef = useRef(false)

  // Fetch or create minimal profile when wallet connects
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
          const profile = data.profile || data

          if (profile?.username && profile.username !== "New User") {
            if (isMounted) {
              setDbUsername(profile.username)
              setDbAvatarUrl(profile.avatar_url || profile.avatarUrl || "")
            }
            return
          }
        }

        // Create minimal profile if none exists
        if (!hasSyncedRef.current) {
          hasSyncedRef.current = true
          const fallbackUsername = `user_${address.slice(-6)}`

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

  // Listen for profile updates from ProfileSettingsModal
  useEffect(() => {
    const handleProfileUpdate = (event: Event) => {
      const customEvent = event as CustomEvent
      if (customEvent.detail?.username) setDbUsername(customEvent.detail.username)
      if (customEvent.detail?.avatarUrl) setDbAvatarUrl(customEvent.detail.avatarUrl)
    }

    window.addEventListener("profileUpdated", handleProfileUpdate)
    return () => window.removeEventListener("profileUpdated", handleProfileUpdate)
  }, [])

  const displayName = dbUsername || "Anonymous"
  const displayAvatar = dbAvatarUrl || ""
  const dashboardLink = dbUsername
    ? `/dashboard/${dbUsername}`
    : `/dashboard/${dbUsername || ""}`

  // Loading state
  if (isConnecting) {
    return (
      <Button size="sm" disabled variant="outline" className={cn("px-6", className)}>
        Connecting...
      </Button>
    )
  }

  // Not connected → Show "Get Started" only in MiniPay
  if (!isConnected) {
    const isMiniPay = typeof window !== "undefined" && !!window.ethereum?.isMiniPay

    return (
      <Button
        onClick={connect}
        size="sm"
        variant="default"
        className={cn(
          "text-xs font-bold uppercase tracking-widest px-6 shadow-md hover:scale-105 transition-all",
          className
        )}
        disabled={!isMiniPay}
      >
        {isMiniPay ? "Get Started" : "Open in MiniPay"}
      </Button>
    )
  }

  // Connected → Show dropdown with profile edit
  return (
    <>
      {/* Modal lives outside the DropdownMenu entirely */}
      <ProfileSettingsModal
        open={profileModalOpen}
        onOpenChange={setProfileModalOpen}
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "flex items-center gap-2 p-1 sm:pr-4 border-primary/20 hover:bg-primary/5 rounded-full h-9",
              className
            )}
          >
            <Avatar className="h-7 w-7 border border-background shadow-sm">
              <AvatarImage src={displayAvatar} className="object-cover" />
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                {loading ? "…" : displayName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <span className="hidden sm:block text-sm font-medium truncate max-w-[120px]">
              {loading ? "Loading..." : displayName}
            </span>

            <ChevronDown className="hidden sm:block h-3 w-3 opacity-60" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-64" sideOffset={8}>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="font-medium truncate">{displayName}</p>
              {address && (
                <p className="text-xs text-muted-foreground font-mono">
                  {address.slice(0, 6)}...{address.slice(-4)}
                </p>
              )}
            </div>
          </DropdownMenuLabel>

          <DropdownMenuSeparator />

          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <Link href={dashboardLink} className="flex items-center gap-2 cursor-pointer">
                <LayoutDashboard className="h-4 w-4" />
                <span>Dashboard</span>
              </Link>
            </DropdownMenuItem>

            {/* Plain DropdownMenuItem that sets state — no asChild, no modal inside */}
            <DropdownMenuItem
              onClick={() => setProfileModalOpen(true)}
              className="flex items-center gap-2 cursor-pointer"
            >
              <Edit2 className="h-4 w-4" />
              <span>Edit Profile</span>
            </DropdownMenuItem>

            {address && (
              <DropdownMenuItem
                onClick={() => {
                  navigator.clipboard.writeText(address)
                  toast.success("Wallet address copied!")
                }}
                className="flex items-center gap-2 cursor-pointer"
              >
                <Copy className="h-4 w-4" />
                <span>Copy Address</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={disconnect}
            className="text-red-600 focus:text-red-600 cursor-pointer flex items-center gap-2"
          >
            <LogOut className="h-4 w-4" />
            <span>Disconnect</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}