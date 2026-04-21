"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useWallet } from "@/components/wallet-provider"
import { usePrivy } from "@privy-io/react-auth"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Loader2, Save, Upload, Check, RefreshCw,
  CheckCircle2, Wallet, AlertTriangle
} from "lucide-react"
import { toast } from "sonner"

const API_BASE_URL = "https://faucetpay-backend.koyeb.app"

interface UserProfile {
  wallet_address: string
  username: string | null
  bio?: string
  avatar_url?: string
  email?: string
  phone?: string
}

const GENERATED_SEEDS = [
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
  const {
    user,
    linkEmail,
    linkPhone,
    linkGoogle,
    unlinkEmail,
    unlinkPhone,
    unlinkGoogle,
  } = usePrivy()

  const router = useRouter()
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = externalOpen !== undefined && externalOnOpenChange !== undefined
  const isOpen = isControlled ? externalOpen : internalOpen
  const setIsOpen = isControlled ? externalOnOpenChange : setInternalOpen

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [seedOffset, setSeedOffset] = useState(0)
  const hasPrefilledRef = useRef(false)

  const [formData, setFormData] = useState<UserProfile>({
    wallet_address: "",
    username: "",
    bio: "",
    avatar_url: "",
    email: "",
    phone: "",
  })

  // ── MiniPay detection ─────────────────────────────────────────────────
  const isMiniPay = typeof navigator !== "undefined" &&
    /MiniPay|Opera Mini/i.test(navigator.userAgent)

  // ── Resolve ALL possible identification values from Privy ─────────────
  // Email: could come from Google OAuth, email OTP, or embedded wallet email
  const resolvedEmail: string = (() => {
    if (user?.google?.email) return user.google.email
    if (user?.email?.address) return user.email.address

    // Walk every linked account for any email-like field
    for (const acc of user?.linkedAccounts ?? []) {
      const a = acc as any
      if (a.type === "google_oauth" && a.email) return a.email
      if (a.type === "email" && a.address) return a.address
      // MiniPay sometimes surfaces email under these fields
      if (a.email) return a.email
      if (a.emailAddress) return a.emailAddress
    }
    return ""
  })()

  // Phone: Privy stores it under a "phone" linked account
  const resolvedPhone: string = (() => {
    for (const acc of user?.linkedAccounts ?? []) {
      const a = acc as any
      if (a.type === "phone" && (a.phoneNumber || a.number)) {
        return a.phoneNumber || a.number
      }
    }
    return ""
  })()

  // Which Privy subject IDs do we have so we can unlink cleanly?
  const googleSubject = user?.google?.subject ?? null
  const emailAddress  = user?.email?.address ?? null
  const phoneNumber   = resolvedPhone || null

  // ── EVM wallet ────────────────────────────────────────────────────────
  const linkedWallets = user?.linkedAccounts.filter(
    (acc) => acc.type === "wallet"
  ) ?? []
  const linkedEvmWallets = linkedWallets.filter(
    (w: any) => w.chainType === "ethereum"
  )
  const activeEvmWallet = linkedEvmWallets.find(
    (w: any) => w.address?.toLowerCase() === address?.toLowerCase()
  ) ?? { address, walletClientType: "external", chainType: "ethereum" }

  const isEmbeddedEvm =
    (activeEvmWallet as any)?.walletClientType === "privy"

  // ── Avatar / username fallbacks ───────────────────────────────────────
  const getFallbackAvatar = useCallback(() => {
    if (!user) return ""
    const google = user.google as any
    return google?.picture || google?.profilePictureUrl || ""
  }, [user])

  const getFallbackUsername = useCallback(() => {
    if (!user) return ""
    if (user.google?.name) return (user.google.name as string).replace(/\s+/g, "")
    if (user.email?.address) return user.email.address.split("@")[0]
    // MiniPay: derive from phone if nothing else
    if (resolvedPhone) return `user${resolvedPhone.slice(-4)}`
    return ""
  }, [user, resolvedPhone])

  // ── Fetch profile ─────────────────────────────────────────────────────
  const fetchProfile = useCallback(
    async (signal?: AbortSignal) => {
      if (!address) return
      setLoading(true)
      try {
        const res = await fetch(`${API_BASE_URL}/api/profile/${address}`, { signal })
        if (signal?.aborted) return
        const data = await res.json()
        setFormData({
          wallet_address: address,
          username: data.profile?.username || getFallbackUsername(),
          bio: data.profile?.bio || "",
          avatar_url: data.profile?.avatar_url || getFallbackAvatar(),
          email: data.profile?.email || resolvedEmail,
          phone: data.profile?.phone || resolvedPhone,
        })
      } catch (err: any) {
        if (err.name === "AbortError") return
      } finally {
        if (!signal?.aborted) setLoading(false)
      }
    },
    [address, getFallbackUsername, getFallbackAvatar, resolvedEmail, resolvedPhone]
  )

  useEffect(() => {
    if (isOpen && address) {
      hasPrefilledRef.current = false
      setUsernameError(null)
      fetchProfile()
    }
  }, [isOpen, address, fetchProfile])

  // Prefill from Privy data once modal opens
  useEffect(() => {
    if (isOpen && user && !hasPrefilledRef.current) {
      hasPrefilledRef.current = true
      setFormData((prev) => ({
        ...prev,
        username: prev.username || getFallbackUsername(),
        avatar_url: prev.avatar_url || getFallbackAvatar(),
        email: prev.email || resolvedEmail,
        phone: prev.phone || resolvedPhone,
      }))
    }
  }, [user, isOpen, getFallbackUsername, getFallbackAvatar, resolvedEmail, resolvedPhone])

  // ── Username uniqueness ───────────────────────────────────────────────
  const checkUsernameUniqueness = async (value: string) => {
    if (!value?.trim() || !address) return true
    try {
      const res = await fetch(`${API_BASE_URL}/api/profile/check-availability`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          field: "username",
          value: value.trim(),
          current_wallet: address.toLowerCase(),
        }),
      })
      const data = await res.json()
      if (!data.available) { setUsernameError(data.message); return false }
      setUsernameError(null)
      return true
    } catch {
      return true
    }
  }

  // ── Save ──────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!isConnected || !address || !signer)
      return toast.error("Wallet not connected")

    setSaving(true)
    const valid = await checkUsernameUniqueness(formData.username || "")
    if (!valid) { setSaving(false); return toast.error("Fix username error first.") }

    try {
      const nonce = Math.floor(Math.random() * 1_000_000).toString()
      const message = `Update Profile\nWallet: ${address}\nNonce: ${nonce}`
      const signature = await signer.signMessage(message)

      const payload = {
        wallet_address: address,
        username: formData.username,
        bio: formData.bio,
        avatar_url: formData.avatar_url,
        // identification — send whatever we resolved
        email: resolvedEmail || formData.email || "",
        phone: resolvedPhone || formData.phone || "",
        // kept empty for backend schema compatibility
        solana_address: "",
        twitter_handle: "",
        discord_handle: "",
        telegram_handle: "",
        farcaster_handle: "",
        twitter_id: "",
        discord_id: "",
        telegram_user_id: "",
        farcaster_id: "",
        signature,
        message,
        nonce,
      }

      const res = await fetch(`${API_BASE_URL}/api/profile/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error("Update failed")

      toast.success("Profile saved!")
      setIsOpen(false)
      window.dispatchEvent(
        new CustomEvent("profileUpdated", {
          detail: { username: formData.username, avatarUrl: formData.avatar_url },
        })
      )
      if (formData.username && formData.username.toLowerCase() !== "anonymous") {
        router.push(`/dashboard/${formData.username}`)
      }
    } catch {
      toast.error("Could not save profile")
    } finally {
      setSaving(false)
    }
  }

  // ── File upload ───────────────────────────────────────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch(`${API_BASE_URL}/upload-image`, { method: "POST", body: fd })
      const data = await res.json()
      if (data.success) {
        setFormData((prev) => ({ ...prev, avatar_url: data.imageUrl }))
        toast.success("Image uploaded!")
      } else throw new Error(data.message)
    } catch (err: any) {
      toast.error(`Upload failed: ${err.message}`)
    } finally {
      setUploading(false)
    }
  }

  const handleShuffle = () =>
    setSeedOffset((p) => (p + 8) % GENERATED_SEEDS.length)
  const currentSeeds = GENERATED_SEEDS.slice(seedOffset, seedOffset + 8)

  // ── Reusable identification row ───────────────────────────────────────
  const IdentRow = ({
    label,
    value,
    onConnect,
    onDisconnect,
    mono = false,
    hint,
  }: {
    label: string
    value?: string | null
    onConnect?: () => void
    onDisconnect?: () => void
    mono?: boolean
    hint?: string
  }) => {
    const [busy, setBusy] = useState(false)

    const run = async (fn: () => void) => {
      setBusy(true)
      try { await (fn as any)() }
      catch (err: any) {
        const msg = (err?.message ?? "").toLowerCase()
        const isPopupDismiss =
          msg.includes("closed") || msg.includes("cancel") ||
          msg.includes("rejected") || msg.includes("exited")
        if (!isPopupDismiss) toast.error("Action failed. Please try again.")
      } finally { setBusy(false) }
    }

    return (
      <div className="flex items-center justify-between p-3 border rounded-lg bg-card/50">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">{label}</span>
          {value ? (
            <span className={`text-xs text-green-600 flex items-center gap-1 ${mono ? "font-mono" : ""}`}>
              <CheckCircle2 className="h-3 w-3 shrink-0" />
              {value}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">
              {hint || "Not linked"}
            </span>
          )}
        </div>

        {value ? (
          onDisconnect && (
            <Button
              size="sm" variant="ghost" type="button"
              disabled={busy}
              onClick={() => run(onDisconnect)}
              className="text-red-500 hover:text-red-600 hover:bg-red-50 text-xs"
            >
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : "Remove"}
            </Button>
          )
        ) : (
          onConnect && (
            <Button size="sm" variant="outline" type="button"
              disabled={busy} onClick={() => run(onConnect)}
            >
              {busy && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
              {busy ? "Connecting…" : "Link"}
            </Button>
          )
        )}
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="w-[95%] sm:max-w-[580px] max-h-[92vh] rounded-lg flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            Edit profile
            {isMiniPay && (
              <Badge variant="secondary" className="text-xs">MiniPay</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="flex flex-col gap-8">

              {/* Avatar */}
              <div className="flex flex-col items-center gap-4">
                <Avatar className="h-20 w-20 border-2 border-primary/20">
                  <AvatarImage src={formData.avatar_url} className="object-cover" />
                  <AvatarFallback className="text-2xl font-bold">
                    {formData.username?.[0]?.toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>

                <Tabs defaultValue="generate" className="w-full max-w-sm">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="upload">Upload</TabsTrigger>
                    <TabsTrigger value="generate">Generate</TabsTrigger>
                  </TabsList>

                  <TabsContent value="upload" className="pt-4">
                    <div className="relative flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 hover:bg-accent/50 transition-colors cursor-pointer bg-muted/30">
                      <input
                        type="file" accept="image/*"
                        onChange={handleFileUpload}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        disabled={uploading}
                      />
                      {uploading
                        ? <Loader2 className="h-9 w-9 animate-spin text-muted-foreground" />
                        : <Upload className="h-9 w-9 text-muted-foreground mb-2" />
                      }
                      <p className="text-sm text-muted-foreground text-center">
                        {uploading ? "Uploading…" : "Click to upload (max 5 MB)"}
                      </p>
                    </div>
                  </TabsContent>

                  <TabsContent value="generate" className="pt-4">
                    <div className="grid grid-cols-4 gap-3">
                      {currentSeeds.map((seed, idx) => {
                        const url = `https://api.dicebear.com/9.x/notionists/svg?seed=${seed}`
                        const isSelected = formData.avatar_url === url
                        return (
                          <div
                            key={`${seed}-${idx}`}
                            onClick={() => setFormData((p) => ({ ...p, avatar_url: url }))}
                            className={`relative aspect-square rounded-full cursor-pointer overflow-hidden border-2 transition-all hover:scale-105 ${
                              isSelected
                                ? "border-primary ring-2 ring-primary/30"
                                : "border-transparent bg-muted"
                            }`}
                          >
                            <img src={url} alt={seed} className="w-full h-full" />
                            {isSelected && (
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                <Check className="h-5 w-5 text-white" />
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    <Button
                      variant="ghost" size="sm" onClick={handleShuffle}
                      className="w-full mt-3 text-muted-foreground hover:text-primary gap-2"
                    >
                      <RefreshCw className="h-4 w-4" /> Shuffle
                    </Button>
                  </TabsContent>
                </Tabs>
              </div>

              {/* Basic info */}
              <div className="grid gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-4 items-start gap-2">
                  <Label className="sm:text-right pt-2 text-sm">Username</Label>
                  <div className="col-span-3">
                    <Input
                      value={formData.username || ""}
                      onChange={(e) => {
                        setFormData({ ...formData, username: e.target.value })
                        setUsernameError(null)
                      }}
                      onBlur={() => checkUsernameUniqueness(formData.username || "")}
                      className={usernameError ? "border-red-500 focus-visible:ring-red-500" : ""}
                      placeholder="yourusername"
                    />
                    {usernameError && (
                      <p className="text-xs text-red-500 mt-1">{usernameError}</p>
                    )}
                    {usernameError === null && formData.username && (
                      <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Username available
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 items-start gap-2">
                  <Label className="sm:text-right pt-2 text-sm">Bio</Label>
                  <Textarea
                    value={formData.bio || ""}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    className="col-span-3 resize-y min-h-[70px]"
                    placeholder="Tell the community about yourself…"
                  />
                </div>
              </div>

              {/* Identification */}
              <div className="border-t pt-6 flex flex-col gap-3">
                <div>
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    Identification
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Link your email or phone so we can identify you across the platform.
                  </p>
                </div>

                {/* MiniPay banner — only shown inside MiniPay */}
                {isMiniPay && (
                  <div className="flex gap-2 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      MiniPay detected — your login email or phone has been auto-detected below.
                      No extra steps needed.
                    </p>
                  </div>
                )}

                {/* Email row — auto-populated for MiniPay Gmail users */}
                <IdentRow
                  label="Email / Google"
                  value={resolvedEmail || null}
                  hint={isMiniPay ? "Will be auto-detected from your MiniPay account" : "Link via Google or email OTP"}
                  onConnect={
                    // In MiniPay the email should already be there via the wallet;
                    // only show a connect button in normal browsers
                    isMiniPay ? undefined : linkGoogle
                  }
                  onDisconnect={
                    googleSubject
                      ? () => unlinkGoogle(googleSubject)
                      : emailAddress
                      ? () => unlinkEmail(emailAddress)
                      : undefined
                  }
                />

                {/* Phone row — for users who signed up with phone OTP */}
                <IdentRow
                  label="Phone number"
                  value={resolvedPhone || null}
                  hint="Link via SMS one-time code"
                  onConnect={linkPhone}
                  onDisconnect={
                    phoneNumber ? () => unlinkPhone(phoneNumber) : undefined
                  }
                />
              </div>

              {/* Wallet */}
              <div className="border-t pt-6 flex flex-col gap-3">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <Wallet className="h-4 w-4" /> Wallet
                </h4>

                {activeEvmWallet?.address && (
                  <IdentRow
                    label={`EVM wallet${isEmbeddedEvm ? " (embedded)" : ""}`}
                    value={`${(activeEvmWallet.address as string).slice(0, 6)}...${(activeEvmWallet.address as string).slice(-4)}`}
                    mono
                  />
                )}
              </div>

            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-5 border-t bg-background">
          <Button
            onClick={handleSave}
            disabled={saving || loading || !!usernameError}
            className="w-full h-11 text-sm"
          >
            {saving ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</>
            ) : (
              <><Save className="mr-2 h-4 w-4" /> Save profile</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}