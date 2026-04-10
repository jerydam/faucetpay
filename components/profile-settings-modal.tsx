"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useWallet } from "@/components/wallet-provider"
import { usePrivy } from "@privy-io/react-auth"
import { useSolanaWallet } from "@/hooks/use-solana"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Loader2, Save, Upload, Check, RefreshCw, CheckCircle2, Link as LinkIcon, Wallet, AlertTriangle } from "lucide-react"
import { toast } from "sonner"

const API_BASE_URL = "https://identical-vivi-faucetdrops-41e9c56b.koyeb.app"

interface UserProfile {
  wallet_address: string;
  username: string | null;
  bio?: string;
  avatar_url?: string;
  twitter_handle?: string;
  is_quest_subscribed?: boolean;
  quest_subscription_expires_at?: string;
}

const GENERATED_SEEDS = [
  "Jerry","John", "Aneka", "Zack", "Molly", "Bear", "Crypto", "Whale", "Pepe",
  "Satoshi", "Vitalik", "Gwei", "HODL", "WAGMI", "Doge", "Shiba", "Solana",
  "Ether", "Bitcoin", "Chain", "Block", "DeFi", "NFT", "Alpha", "Beta",
  "Neon", "Cyber", "Pixel", "Glitch", "Retro", "Vapor", "Synth", "Wave",
  "Pulse", "Echo", "Flux", "Spark", "Glow", "Shine", "Shadow", "Light",
  "Dark", "Void", "Zenith", "Apex", "Nova", "Nebula", "Galaxy", "Comet",
  "Zeus", "Hera", "Odin", "Thor", "Loki", "Freya", "Ra", "Anubis",
  "Apollo", "Athena", "Ares", "Hades", "Poseidon", "Atlas", "Titan",
  "Phoenix", "Dragon", "Griffin", "Hydra", "Medusa", "Pegasus", "Sphinx",
  "Wolf", "Eagle", "Hawk", "Lion", "Tiger", "Shark", "Dolphin", "Panda",
  "Fox", "Owl", "Raven", "Crow", "Snake", "Cobra", "Viper", "Toad",
  "River", "Sky", "Ocean", "Forest", "Mountain", "Rain", "Storm", "Snow",
  "Leo", "Zoe", "Max", "Ruby", "Kai", "Luna", "Finn", "Cleo",
  "Jasper", "Milo", "Otis", "Arlo", "Ezra", "Silas", "Jude", "Rowan"
]

interface ProfileSettingsModalProps {
  // When provided, the modal is controlled externally (no trigger button rendered)
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function ProfileSettingsModal({ open: externalOpen, onOpenChange: externalOnOpenChange }: ProfileSettingsModalProps) {
  const { address, isConnected, signer } = useWallet()

  const {
    user,
    linkTwitter,
    linkDiscord,
    linkGoogle,
    linkTelegram,
    linkFarcaster,
    unlinkTwitter,
    unlinkDiscord,
    unlinkGoogle,
    unlinkTelegram,
    unlinkFarcaster,
  } = usePrivy()

  const {
    solanaAddress,
    activeSolanaAccount,
    hasExternalSolana,
    isEmbeddedUser,
    linkWallet,
  } = useSolanaWallet()

  const router = useRouter()

  // Internal open state — used only when the modal is NOT controlled externally
  const [internalOpen, setInternalOpen] = useState(false)

  // Whether we're in controlled (external) mode
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
  })

  // ── MiniPay Detection ─────────────────────────────────────────────────
  const isMiniPay = typeof navigator !== "undefined" &&
    /MiniPay|Opera Mini/i.test(navigator.userAgent)

  const miniPayEmail: string = isMiniPay
    ? (
        user?.google?.email ||
        user?.email?.address ||
        (user?.linkedAccounts?.find(
          (a: any) => a.type === "email" || a.type === "google_oauth"
        ) as any)?.email ||
        (user?.linkedAccounts?.find(
          (a: any) => a.type === "email" || a.type === "google_oauth"
        ) as any)?.address ||
        ""
      )
    : ""

  const resolvedEmail: string =
    user?.google?.email ||
    user?.email?.address ||
    miniPayEmail

  // ── EVM wallet details ────────────────────────────────────────────────
  const linkedWallets = user?.linkedAccounts.filter((acc) => acc.type === "wallet") || []
  const linkedEvmWallets = linkedWallets.filter((w: any) => w.chainType === "ethereum")

  const activeEvmWallet = linkedEvmWallets.find(
    (w: any) => w.address?.toLowerCase() === address?.toLowerCase()
  ) ?? { address, walletClientType: "external", chainType: "ethereum" }

  const hasExternalEvm = linkedEvmWallets.some(
    (w: any) => w.walletClientType !== "privy"
  ) || activeEvmWallet.walletClientType !== "privy"

  // ── Avatar / username fallbacks ───────────────────────────────────────
  const getFallbackAvatar = useCallback(() => {
    if (!user) return ""
    const google = user.google as any
    const twitter = user.twitter as any
    return google?.picture || google?.profilePictureUrl || twitter?.profilePictureUrl || ""
  }, [user])

  const getFallbackUsername = useCallback(() => {
    if (!user) return ""
    if (user.twitter?.username) return user.twitter.username
    if (user.discord?.username) return user.discord.username
    if (user.google?.name) return (user.google.name as string).replace(/\s+/g, "")
    if (user.email?.address) return user.email.address.split("@")[0]
    return ""
  }, [user])

  // ── Data fetching ─────────────────────────────────────────────────────
  const fetchProfile = useCallback(async (signal?: AbortSignal) => {
    if (!address) return
    setFormData({ wallet_address: address, username: "", bio: "", avatar_url: "" })
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
      })
    } catch (err: any) {
      if (err.name === "AbortError") return
      console.error("Failed to fetch profile")
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [address, getFallbackUsername, getFallbackAvatar])

  // Fetch profile when modal opens or address changes
  useEffect(() => {
    if (isOpen && address) {
      hasPrefilledRef.current = false
      setUsernameError(null)
      fetchProfile()
    }
  }, [isOpen, address, fetchProfile])

  // Prefill fallback data from social accounts
  useEffect(() => {
    if (isOpen && user && !hasPrefilledRef.current) {
      hasPrefilledRef.current = true
      setFormData(prev => ({
        ...prev,
        username: prev.username || getFallbackUsername(),
        avatar_url: prev.avatar_url || getFallbackAvatar(),
      }))
    }
  }, [user, isOpen, getFallbackUsername, getFallbackAvatar])

  // ── Username availability check ───────────────────────────────────────
  const checkUsernameUniqueness = async (value: string) => {
    if (!value?.trim() || !address) return true
    try {
      const res = await fetch(`${API_BASE_URL}/api/profile/check-availability`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          field: "username",
          value: value.trim(),
          current_wallet: address.toLowerCase()
        })
      })
      const data = await res.json()
      if (!data.available) {
        setUsernameError(data.message)
        return false
      }
      setUsernameError(null)
      return true
    } catch {
      return true
    }
  }

  // ── Save Profile ──────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!isConnected || !address || !signer) return toast.error("Wallet error")

    setSaving(true)
    const validUsername = await checkUsernameUniqueness(formData.username || "")
    if (!validUsername) {
      setSaving(false)
      return toast.error("Please fix username error before saving.")
    }

    try {
      const nonce = Math.floor(Math.random() * 1000000).toString()
      const message = `Update Profile\nWallet: ${address}\nNonce: ${nonce}`
      const signature = await signer.signMessage(message)

      const payload = {
        wallet_address: address,
        username: formData.username,
        bio: formData.bio,
        avatar_url: formData.avatar_url,
        email: resolvedEmail,
        twitter_handle: user?.twitter?.username || "",
        discord_handle: user?.discord?.username || "",
        telegram_handle: user?.telegram?.username || "",
        farcaster_handle: user?.farcaster?.username || "",
        twitter_id: user?.twitter?.subject || "",
        discord_id: user?.discord?.subject || "",
        telegram_user_id: user?.telegram?.telegramUserId || "",
        farcaster_id: user?.farcaster?.fid ? String(user.farcaster.fid) : "",
        solana_address: solanaAddress || "",
        signature,
        message,
        nonce,
      }

      const res = await fetch(`${API_BASE_URL}/api/profile/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })

      if (!res.ok) throw new Error("Update failed")

      toast.success("Profile saved successfully!")
      setIsOpen(false)
      window.dispatchEvent(new CustomEvent("profileUpdated", {
        detail: {
          username: formData.username,
          avatarUrl: formData.avatar_url,
        }
      }))

      if (formData.username && formData.username.toLowerCase() !== "anonymous") {
        router.push(`/dashboard/${formData.username}`)
      }
    } catch (err) {
      toast.error("Could not save profile")
    } finally {
      setSaving(false)
    }
  }

  // ── File Upload ───────────────────────────────────────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const uploadData = new FormData()
      uploadData.append("file", file)

      const response = await fetch(`${API_BASE_URL}/upload-image`, {
        method: "POST",
        body: uploadData
      })
      const data = await response.json()

      if (data.success) {
        setFormData(prev => ({ ...prev, avatar_url: data.imageUrl }))
        toast.success("Image uploaded successfully!")
      } else {
        throw new Error(data.message)
      }
    } catch (error: any) {
      toast.error(`Upload failed: ${error.message}`)
    } finally {
      setUploading(false)
    }
  }

  const handleShuffle = () => setSeedOffset(prev => (prev + 8) % GENERATED_SEEDS.length)
  const currentSeeds = GENERATED_SEEDS.slice(seedOffset, seedOffset + 8)

  // ── Social Row ────────────────────────────────────────────────────────
  const PrivySocialRow = ({
    label,
    handle,
    onConnect,
    onDisconnect,
    isRecommended = false,
    disabled = false,
    disabledReason,
  }: {
    label: string
    handle?: string | null
    onConnect: () => Promise<any> | void
    onDisconnect?: () => Promise<any> | void
    isRecommended?: boolean
    disabled?: boolean
    disabledReason?: string
  }) => {
    const [isConnecting, setIsConnecting] = useState(false)
    const [isDisconnecting, setIsDisconnecting] = useState(false)
    const isLinkingRef = useRef(false)

    const handleConnect = async () => {
      if (isLinkingRef.current || disabled) return
      isLinkingRef.current = true
      setIsConnecting(true)

      try {
        await onConnect()
      } catch (error: any) {
        const msg = (error?.message ?? "").toLowerCase()
        const code = (error?.code ?? "").toString().toLowerCase()

        const isPopupDismissed =
          msg.includes("closed") ||
          msg.includes("cancelled") ||
          msg.includes("canceled") ||
          msg.includes("popup") ||
          msg.includes("user rejected") ||
          msg.includes("user denied") ||
          msg.includes("exited") ||
          code.includes("privy_popup_closed") ||
          code.includes("privy_canceled")

        if (isPopupDismissed) {
          // Do nothing — if OAuth actually completed, `user` will update.
        } else if (isMiniPay && label.toLowerCase().includes("google")) {
          toast.error(
            "Google login is unstable in MiniPay. Use Twitter or Telegram instead.",
            { duration: 5000 }
          )
        } else {
          toast.error(`Failed to connect ${label}. Please try again.`)
        }
      } finally {
        setTimeout(() => {
          setIsConnecting(false)
          isLinkingRef.current = false
        }, 800)
      }
    }

    const handleDisconnect = async () => {
      if (!onDisconnect) return
      setIsDisconnecting(true)
      try {
        await onDisconnect()
      } catch (error: any) {
        const msg = (error?.message ?? "").toLowerCase()
        if (msg.includes("cannot remove") || msg.includes("only linked account")) {
          toast.error("You must keep at least one account linked.")
        } else {
          toast.error(`Failed to disconnect ${label}`)
        }
      } finally {
        setIsDisconnecting(false)
      }
    }

    return (
      <div className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${disabled ? "opacity-50 bg-muted/30" : "bg-card/50 hover:bg-card/80"}`}>
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{label}</span>
            {isRecommended && isMiniPay && (
              <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-600">
                Best in MiniPay
              </Badge>
            )}
          </div>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            {handle ? (
              <span className="text-green-600 flex items-center font-medium">
                <CheckCircle2 className="h-3 w-3 mr-1" /> {handle}
              </span>
            ) : disabled && disabledReason ? (
              <span className="text-amber-600">{disabledReason}</span>
            ) : (
              "Not linked"
            )}
          </span>
        </div>

        {handle ? (
          <Button
            size="sm"
            variant="ghost"
            type="button"
            onClick={handleDisconnect}
            disabled={isDisconnecting}
            className="text-red-500 hover:text-red-600 hover:bg-red-50"
          >
            {isDisconnecting && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
            {isDisconnecting ? "Removing…" : "Disconnect"}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            type="button"
            onClick={handleConnect}
            disabled={isConnecting || disabled}
          >
            {isConnecting && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
            {isConnecting ? "Connecting…" : "Connect"}
          </Button>
        )}
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="w-[95%] sm:max-w-[620px] max-h-[92vh] rounded-lg flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            Edit Profile
            {isMiniPay && (
              <Badge variant="secondary" className="text-xs">MiniPay Mode</Badge>
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

              {/* Avatar Section */}
              <div className="flex flex-col items-center gap-4">
                <Avatar className="h-24 w-24 border-2 border-primary/20">
                  <AvatarImage src={formData.avatar_url} className="object-cover" />
                  <AvatarFallback className="text-3xl font-bold">
                    {formData.username?.[0]?.toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>

                <Tabs defaultValue="generate" className="w-full max-w-sm">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="upload">Upload Photo</TabsTrigger>
                    <TabsTrigger value="generate">Generate Avatar</TabsTrigger>
                  </TabsList>

                  <TabsContent value="upload" className="pt-4">
                    <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 hover:bg-accent/50 transition-colors cursor-pointer relative bg-muted/30">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        disabled={uploading}
                      />
                      {uploading ? (
                        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
                      ) : (
                        <Upload className="h-10 w-10 text-muted-foreground mb-3" />
                      )}
                      <p className="text-sm text-muted-foreground text-center">
                        {uploading ? "Uploading image..." : "Click to upload custom avatar (max 5MB)"}
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
                            onClick={() => setFormData(prev => ({ ...prev, avatar_url: url }))}
                            className={`relative aspect-square rounded-full cursor-pointer overflow-hidden border-2 transition-all hover:scale-105 ${isSelected ? "border-primary ring-2 ring-primary/30" : "border-transparent bg-muted"}`}
                          >
                            <img src={url} alt={seed} className="w-full h-full" />
                            {isSelected && (
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                <Check className="h-6 w-6 text-white" />
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleShuffle}
                      className="w-full mt-4 text-muted-foreground hover:text-primary gap-2"
                    >
                      <RefreshCw className="h-4 w-4" /> Shuffle Avatars
                    </Button>
                  </TabsContent>
                </Tabs>
              </div>

              {/* Form Fields */}
              <div className="grid gap-5">
                <div className="grid grid-cols-1 sm:grid-cols-4 items-start gap-2">
                  <Label className="sm:text-right pt-2">Username</Label>
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
                    {usernameError && <p className="text-xs text-red-500 mt-1">{usernameError}</p>}
                    {usernameError === null && formData.username && (
                      <p className="text-xs text-green-600 mt-1 flex items-center">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Username available
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 items-start gap-2">
                  <Label className="sm:text-right pt-2">Bio</Label>
                  <Textarea
                    value={formData.bio || ""}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    className="col-span-3 resize-y min-h-[80px]"
                    placeholder="Tell the community about yourself..."
                  />
                </div>
              </div>

              {/* Linked Wallets */}
              <div className="border-t pt-6">
                <h4 className="mb-3 text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <Wallet className="h-4 w-4" /> Linked Wallets
                </h4>

                {isMiniPay && (
                  <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg flex gap-2 text-sm">
                    <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <p className="text-amber-700 dark:text-amber-400 text-xs">
                      MiniPay users: Your embedded wallet works across networks. You can still link external wallets if needed.
                    </p>
                  </div>
                )}

                <div className="grid gap-3">
                  {activeEvmWallet?.address && (
                    <div className="flex items-center justify-between p-3 border rounded-lg bg-card/50">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold">EVM Wallet (Celo)</span>
                        <span className="text-xs text-muted-foreground font-mono">
                          {activeEvmWallet.address.slice(0, 6)}...{activeEvmWallet.address.slice(-4)}
                        </span>
                      </div>
                      <Badge variant="secondary" className="capitalize">
                        {activeEvmWallet.walletClientType === "privy" ? "Embedded" : "External"}
                      </Badge>
                    </div>
                  )}

                  {!isEmbeddedUser && !hasExternalEvm && (
                    <div className="flex items-center justify-between p-3 border border-dashed rounded-lg bg-card/50 hover:bg-card/80">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold">External EVM Wallet</span>
                        <span className="text-xs text-muted-foreground">MetaMask, Coinbase, etc.</span>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => linkWallet()}>
                        Link Wallet
                      </Button>
                    </div>
                  )}

                  {solanaAddress && (
                    <div className="flex items-center justify-between p-3 border rounded-lg bg-card/50">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold">Solana Wallet</span>
                        <span className="text-xs text-muted-foreground font-mono">
                          {solanaAddress.slice(0, 6)}...{solanaAddress.slice(-4)}
                        </span>
                      </div>
                      <Badge variant={hasExternalSolana ? "default" : "secondary"}>
                        {hasExternalSolana ? "External" : "Embedded"}
                      </Badge>
                    </div>
                  )}

                  {!isEmbeddedUser && !hasExternalSolana && (
                    <div className="flex items-center justify-between p-3 border border-dashed rounded-lg bg-card/50 hover:bg-card/80">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold">External Solana Wallet</span>
                        <span className="text-xs text-muted-foreground">Phantom, Solflare, etc.</span>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => linkWallet()}>
                        {solanaAddress ? "Override" : "Link Wallet"}
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Social Connections */}
              <div className="border-t pt-6">
                <h4 className="mb-1 text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <LinkIcon className="h-4 w-4" /> Verified Connections
                </h4>
                <p className="text-xs text-muted-foreground mb-4">
                  Link any accounts you want — none are required to save.
                </p>

                {isMiniPay && (
                  <p className="text-xs text-amber-600 mb-4">
                    💡 In MiniPay: <strong>Telegram</strong> and <strong>Twitter</strong> work best.
                    Google may be unreliable in this browser.
                  </p>
                )}

                <div className="grid gap-3">
                  {isMiniPay ? (
                    <PrivySocialRow
                      label="Email (Google)"
                      handle={miniPayEmail || user?.google?.email || user?.email?.address || null}
                      onConnect={async () => {
                        toast.info(
                          "Google login is unreliable in MiniPay. Your wallet email is already used for your profile.",
                          { duration: 5000 }
                        )
                      }}
                      onDisconnect={
                        user?.google?.subject
                          ? () => unlinkGoogle(user.google!.subject!)
                          : undefined
                      }
                    />
                  ) : (
                    <PrivySocialRow
                      label="Email (Google)"
                      handle={user?.google?.email || user?.email?.address}
                      onConnect={linkGoogle}
                      onDisconnect={
                        user?.google?.subject
                          ? () => unlinkGoogle(user.google!.subject!)
                          : undefined
                      }
                    />
                  )}

                  <PrivySocialRow
                    label="X (Twitter)"
                    handle={user?.twitter?.username}
                    onConnect={linkTwitter}
                    onDisconnect={() => unlinkTwitter(user?.twitter?.subject!)}
                    isRecommended={isMiniPay}
                  />

                  <PrivySocialRow
                    label="Telegram"
                    handle={user?.telegram?.username}
                    onConnect={linkTelegram}
                    onDisconnect={() => unlinkTelegram(user?.telegram?.telegramUserId!)}
                    isRecommended={isMiniPay}
                  />

                  <PrivySocialRow
                    label="Discord"
                    handle={user?.discord?.username}
                    onConnect={linkDiscord}
                    onDisconnect={() => unlinkDiscord(user?.discord?.subject!)}
                  />

                  <PrivySocialRow
                    label="Farcaster"
                    handle={user?.farcaster?.username}
                    onConnect={linkFarcaster}
                    onDisconnect={() => unlinkFarcaster(user?.farcaster?.fid!)}
                  />
                </div>

                <p className="text-xs text-muted-foreground mt-4">
                  * Linked accounts will be saved when you click "Save Profile"
                </p>
              </div>

            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-6 border-t bg-background">
          <Button
            onClick={handleSave}
            disabled={saving || loading || !!usernameError}
            className="w-full h-12 text-base"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Saving Profile...
              </>
            ) : (
              <>
                <Save className="mr-2 h-5 w-5" />
                Save Profile
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}