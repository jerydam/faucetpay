"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useWallet } from "@/components/wallet-provider"
import { usePrivy } from "@privy-io/react-auth"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Loader2, Save, Upload, Check,
  RefreshCw, CheckCircle2, AlertCircle,
} from "lucide-react"
import { toast } from "sonner"

const API_BASE_URL = "https://faucetpay-backend.koyeb.app0"

const AVATAR_SEEDS = [
  "Jerry","John","Aneka","Zack","Molly","Bear","Crypto","Whale","Pepe",
  "Satoshi","Vitalik","Gwei","HODL","WAGMI","Doge","Shiba","Solana",
  "Ether","Bitcoin","Chain","Block","DeFi","NFT","Alpha","Beta",
  "Neon","Cyber","Pixel","Glitch","Retro","Vapor","Synth","Wave",
  "Pulse","Echo","Flux","Spark","Glow","Shine","Shadow","Light",
]

interface ProfileSettingsModalProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function ProfileSettingsModal({
  open: externalOpen,
  onOpenChange: externalOnOpenChange,
}: ProfileSettingsModalProps) {
  const { address, isConnected, signer } = useWallet()
  const { user } = usePrivy()
  const router = useRouter()

  const isControlled = externalOpen !== undefined && externalOnOpenChange !== undefined
  const [internalOpen, setInternalOpen] = useState(false)
  const isOpen = isControlled ? externalOpen! : internalOpen
  const setIsOpen = isControlled ? externalOnOpenChange! : setInternalOpen

  const [pageLoading, setPageLoading]   = useState(false)
  const [saving, setSaving]             = useState(false)
  const [uploading, setUploading]       = useState(false)
  const [username, setUsername]         = useState("")
  const [avatarUrl, setAvatarUrl]       = useState("")
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [usernameOk, setUsernameOk]     = useState(false)
  const [seedPage, setSeedPage]         = useState(0)
  const [avatarMode, setAvatarMode]     = useState<"generate" | "upload">("generate")
  const hasLoaded = useRef(false)

  // ── Identity resolution from Privy ───────────────────────────────────
  // Silently collected from whichever login method the user used (email,
  // Google OAuth, phone/SMS) — including the account used to set up MiniPay.
  const resolvedEmail: string = (() => {
    if (!user) return ""
    if (user.google?.email) return user.google.email as string
    if (user.email?.address) return user.email.address
    for (const acc of user.linkedAccounts ?? []) {
      const a = acc as any
      if (a.email)        return a.email
      if (a.emailAddress) return a.emailAddress
      if (a.type === "google_oauth" && a.email) return a.email
      if (a.type === "email"        && a.address) return a.address
    }
    return ""
  })()

  const resolvedPhone: string = (() => {
    if (!user) return ""
    for (const acc of user.linkedAccounts ?? []) {
      const a = acc as any
      if (a.type === "phone" && (a.phoneNumber || a.number))
        return a.phoneNumber || a.number
    }
    return ""
  })()

  // Identity label shown in the "Connected as" chip
  const identityLabel = resolvedEmail || resolvedPhone || ""

  // Fallback avatar / username from Privy social data
  const fallbackAvatar = (() => {
    if (!user) return ""
    const g = user.google as any
    return g?.picture || g?.profilePictureUrl || ""
  })()

  const fallbackUsername = (() => {
    if (!user) return ""
    if (user.google?.name) return (user.google.name as string).replace(/\s+/g, "")
    if (user.email?.address) return user.email.address.split("@")[0]
    if (resolvedPhone) return `user${resolvedPhone.slice(-4)}`
    return ""
  })()

  // ── Fetch existing profile ────────────────────────────────────────────
  const loadProfile = useCallback(async () => {
    if (!address) return
    setPageLoading(true)
    try {
      const res  = await fetch(`${API_BASE_URL}/api/profile/${address}`)
      const data = await res.json()
      const p    = data.profile
      setUsername(p?.username  || fallbackUsername || "")
      setAvatarUrl(p?.avatar_url || fallbackAvatar || "")
    } catch {
      setUsername(fallbackUsername || "")
      setAvatarUrl(fallbackAvatar  || "")
    } finally {
      setPageLoading(false)
    }
  }, [address, fallbackUsername, fallbackAvatar])

  useEffect(() => {
    if (isOpen && address && !hasLoaded.current) {
      hasLoaded.current = true
      setUsernameError(null)
      setUsernameOk(false)
      loadProfile()
    }
    if (!isOpen) hasLoaded.current = false
  }, [isOpen, address, loadProfile])

  // ── Username validation ───────────────────────────────────────────────
  const validateUsername = async (value: string) => {
    const v = value.trim()
    setUsernameError(null)
    setUsernameOk(false)
    if (!v || !address) return

    if (v.length < 3)  { setUsernameError("At least 3 characters"); return }
    if (v.length > 24) { setUsernameError("Max 24 characters"); return }
    if (!/^[a-zA-Z0-9_]+$/.test(v)) {
      setUsernameError("Letters, numbers and underscores only")
      return
    }

    try {
      const res  = await fetch(`${API_BASE_URL}/api/profile/check-availability`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          field: "username",
          value: v,
          current_wallet: address.toLowerCase(),
        }),
      })
      const data = await res.json()
      if (!data.available) { setUsernameError(data.message); return }
      setUsernameOk(true)
    } catch { setUsernameOk(true) }
  }

  // ── Avatar upload ─────────────────────────────────────────────────────
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0]
  if (!file) return

  // Validate size (2MB limit)
  if (file.size > 2 * 1024 * 1024) {
    toast.error("Image must be under 2MB")
    return
  }

  setUploading(true)
  try {
    const fd = new FormData()
    fd.append("file", file)
    const res = await fetch(`${API_BASE_URL}/upload-image`, { method: "POST", body: fd })

    if (!res.ok) {
      const text = await res.text()
      console.error("Upload error:", res.status, text)
      throw new Error(`Server error ${res.status}`)
    }

    const data = await res.json()
    if (data.success) {
      setAvatarUrl(data.imageUrl)
      toast.success("Photo uploaded!")
    } else {
      throw new Error(data.message || "Upload failed")
    }
  } catch (err: any) {
    console.error("Upload failed:", err)
    toast.error(err.message || "Upload failed — check your connection")
  } finally {
    setUploading(false)
    // Reset input so same file can be re-selected
    e.target.value = ""
  }
}

  // ── Save ──────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!isConnected || !address || !signer) {
      toast.error("Wallet not connected"); return
    }
    if (usernameError) { toast.error("Fix username first"); return }

    setSaving(true)
    try {
      const nonce   = Math.floor(Math.random() * 1_000_000).toString()
      const message = `Update Profile\nWallet: ${address}\nNonce: ${nonce}`
      const signature = await signer.signMessage(message)

      const res = await fetch(`${API_BASE_URL}/api/profile/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet_address: address,
          username:       username.trim(),
          avatar_url:     avatarUrl,
          // Auto-attach the identity from the user's MiniPay / Privy login
          email:          resolvedEmail,
          phone:          resolvedPhone,
          // kept for schema compatibility
          bio: "", solana_address: "", twitter_handle: "", discord_handle: "",
          telegram_handle: "", farcaster_handle: "", twitter_id: "",
          discord_id: "", telegram_user_id: "", farcaster_id: "",
          signature, message, nonce,
        }),
      })
      if (!res.ok) throw new Error("Save failed")

      toast.success("Profile saved!")
      window.dispatchEvent(new CustomEvent("profileUpdated", {
        detail: { username: username.trim(), avatarUrl },
      }))
      setIsOpen(false)
      if (username.trim()) router.push(`/dashboard/${username.trim()}`)
    } catch {
      toast.error("Could not save profile")
    } finally { setSaving(false) }
  }

  // ── Avatar grid (generated) ───────────────────────────────────────────
  const PAGE_SIZE  = 8
  const pageSeeds  = AVATAR_SEEDS.slice(seedPage * PAGE_SIZE, seedPage * PAGE_SIZE + PAGE_SIZE)
  const totalPages = Math.ceil(AVATAR_SEEDS.length / PAGE_SIZE)

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="w-[95vw] max-w-sm rounded-2xl p-0 gap-0 overflow-hidden">

        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-4 border-b">
          <DialogTitle className="text-base font-black tracking-tight">Edit Profile</DialogTitle>
        </DialogHeader>

        {pageLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
          </div>
        ) : (
          <div className="px-5 py-5 space-y-6 overflow-y-auto max-h-[75vh]">

            {/* ── Avatar ─────────────────────────────────────────────── */}
            <div className="flex flex-col items-center gap-4">
              {/* Current avatar preview */}
              <div className="relative">
                <Avatar className="h-20 w-20 border-2 border-border shadow-sm">
                  <AvatarImage src={avatarUrl} className="object-cover" />
                  <AvatarFallback className="text-2xl font-bold bg-primary/10 text-primary">
                    {username?.[0]?.toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
              </div>

              {/* Mode toggle */}
              <div className="flex w-full max-w-xs rounded-xl border border-border overflow-hidden text-xs font-bold">
                <button
                  onClick={() => setAvatarMode("generate")}
                  className={`flex-1 py-2 transition-colors ${
                    avatarMode === "generate"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  Generate
                </button>
                <button
                  onClick={() => setAvatarMode("upload")}
                  className={`flex-1 py-2 transition-colors ${
                    avatarMode === "upload"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  Upload photo
                </button>
              </div>

              {/* Generate grid */}
              {avatarMode === "generate" && (
                <div className="w-full space-y-3">
                  <div className="grid grid-cols-4 gap-2.5">
                    {pageSeeds.map((seed) => {
                      const url       = `https://api.dicebear.com/9.x/notionists/svg?seed=${seed}`
                      const isSelected = avatarUrl === url
                      return (
                        <button
                          key={seed}
                          onClick={() => setAvatarUrl(url)}
                          className={`relative aspect-square rounded-full overflow-hidden border-2 transition-all hover:scale-105 focus:outline-none ${
                            isSelected
                              ? "border-primary ring-2 ring-primary/25 scale-105"
                              : "border-transparent bg-muted"
                          }`}
                        >
                          <img src={url} alt={seed} className="w-full h-full" />
                          {isSelected && (
                            <div className="absolute inset-0 bg-primary/40 flex items-center justify-center">
                              <Check className="h-4 w-4 text-white" />
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                  {/* Page dots + shuffle */}
                  <div className="flex items-center justify-between">
                    <div className="flex gap-1">
                      {Array.from({ length: totalPages }).map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setSeedPage(i)}
                          className={`w-1.5 h-1.5 rounded-full transition-colors ${
                            i === seedPage ? "bg-primary" : "bg-border"
                          }`}
                        />
                      ))}
                    </div>
                    <button
                      onClick={() => setSeedPage((p) => (p + 1) % totalPages)}
                      className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <RefreshCw className="h-3 w-3" /> More
                    </button>
                  </div>
                </div>
              )}

              {/* Upload area */}
              {avatarMode === "upload" && (
                <label className="w-full cursor-pointer">
                  <div className="w-full space-y-2">
  <label htmlFor="avatar-upload" className="w-full cursor-pointer">
    <div className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl p-7 hover:bg-muted/40 transition-colors">
      {uploading
        ? <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        : <Upload className="h-8 w-8 text-muted-foreground" />
      }
      <p className="text-xs text-muted-foreground font-medium text-center">
        {uploading ? "Uploading…" : "Tap to choose a photo"}
      </p>
    </div>
  </label>
  <input
    id="avatar-upload"
    type="file"
    accept="image/*"
    onChange={handleUpload}
    disabled={uploading}
    className="hidden"
  />
</div>
                </label>
              )}
            </div>

            {/* ── Username ────────────────────────────────────────────── */}
            <div className="space-y-2">
              <label className="text-xs font-black text-muted-foreground uppercase tracking-wider">
                Username
              </label>
              <div className="relative">
                <Input
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value)
                    setUsernameError(null)
                    setUsernameOk(false)
                  }}
                  onBlur={() => validateUsername(username)}
                  placeholder="yourname"
                  className={`h-11 pr-9 font-medium ${
                    usernameError
                      ? "border-red-400 focus-visible:ring-red-400"
                      : usernameOk
                      ? "border-emerald-400 focus-visible:ring-emerald-400"
                      : ""
                  }`}
                  maxLength={24}
                />
                {/* inline status icon */}
                {usernameOk && !usernameError && (
                  <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500 pointer-events-none" />
                )}
                {usernameError && (
                  <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-500 pointer-events-none" />
                )}
              </div>
              {usernameError && (
                <p className="text-xs text-red-500 font-medium">{usernameError}</p>
              )}
              {usernameOk && !usernameError && (
                <p className="text-xs text-emerald-600 font-medium">Username is available ✓</p>
              )}
            </div>

            {/* ── Connected account (auto-detected, read-only) ─────────── */}
            {identityLabel && (
              <div className="flex items-center gap-3 px-3.5 py-3 rounded-xl bg-primary/5 border border-primary/15">
                <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider mb-0.5">
                    Account
                  </p>
                  <p className="text-sm font-semibold text-foreground truncate">{identityLabel}</p>
                </div>
                <span className="text-[10px] font-bold text-primary/70 bg-primary/10 px-2 py-0.5 rounded-full shrink-0">
                  Linked
                </span>
              </div>
            )}

          </div>
        )}

        {/* Save footer */}
        <div className="px-5 pb-5 pt-3 border-t bg-background">
          <Button
            onClick={handleSave}
            disabled={saving || pageLoading || !!usernameError}
            className="w-full h-11 font-bold text-sm"
          >
            {saving ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</>
            ) : (
              <><Save className="mr-2 h-4 w-4" /> Save Profile</>
            )}
          </Button>
        </div>

      </DialogContent>
    </Dialog>
  )
}