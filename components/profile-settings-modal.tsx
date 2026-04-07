"use client"
import { useState, useEffect, useCallback, useRef } from "react" 
import { useWallet } from "@/components/wallet-provider" 
import { usePrivy } from "@privy-io/react-auth" 
import { useSolanaWallet } from "@/hooks/use-solana" // ← new hook
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Loader2, Save, Upload, Check, Edit2, RefreshCw, CheckCircle2, Link as LinkIcon, Wallet } from "lucide-react"
import { toast } from "sonner"

const API_BASE_URL = "https://faucetdrop-backend.onrender.com"

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
];

export function ProfileSettingsModal() {
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

  // ── Solana wallet resolution (external > embedded > none) ──────────────
  const {
    solanaAddress,
    activeSolanaAccount,
    hasExternalSolana,
    isEmbeddedUser,   // ← true when user has no external EVM wallet at all
    linkWallet,
  } = useSolanaWallet()

  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
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

  // ── EVM wallet details ─────────────────────────────────────────────────
  const linkedWallets = user?.linkedAccounts.filter((acc) => acc.type === "wallet") || []
  const linkedEvmWallets = linkedWallets.filter((w: any) => w.chainType === "ethereum")

  const activeEvmWallet =
    linkedEvmWallets.find(
      (w: any) => w.address?.toLowerCase() === address?.toLowerCase()
    ) ?? { address, walletClientType: "external", chainType: "ethereum" }

  const hasExternalEvm = linkedEvmWallets.some(
    (w: any) => w.walletClientType !== "privy"
  ) || activeEvmWallet.walletClientType !== "privy"

  // ── Avatar / username fallbacks ────────────────────────────────────────
  const getFallbackAvatar = useCallback(() => {
    if (!user) return ""
    const google = user.google as any
    const twitter = user.twitter as any
    return google?.picture || google?.profilePictureUrl || twitter?.profilePictureUrl || ""
  }, [user])

  const getFallbackUsername = useCallback(() => {
    if (!user) return ""
    if (user.twitter?.username)  return user.twitter.username
    if (user.discord?.username)  return user.discord.username
    if (user.google?.name)       return (user.google.name as string).replace(/\s+/g, "")
    if (user.email?.address)     return user.email.address.split("@")[0]
    return ""
  }, [user])

  // ── Data fetching ──────────────────────────────────────────────────────
  const fetchProfile = useCallback(async (signal?: AbortSignal) => {
  if (!address) return
  setFormData({ wallet_address: address, username: "", bio: "", avatar_url: "" })
  setLoading(true)
  try {
    const res = await fetch(`${API_BASE_URL}/api/profile/${address}`, { signal })
    if (signal?.aborted) return  // discard if cancelled
    const data = await res.json()
    setFormData({
      wallet_address: address,
      username:   data.profile?.username   || getFallbackUsername(),
      bio:        data.profile?.bio        || "",
      avatar_url: data.profile?.avatar_url || getFallbackAvatar(),
    })
  } catch (err: any) {
    if (err.name === "AbortError") return  // ignore cancelled requests
    console.error("Failed to fetch profile")
  } finally {
    if (!signal?.aborted) setLoading(false)
  }
}, [address, getFallbackUsername, getFallbackAvatar])

  useEffect(() => {
  if (isOpen && address) {
    // Reset prefill guard so new wallet gets its own fallback prefill
    hasPrefilledRef.current = false
    fetchProfile()
    setUsernameError(null)
  }
}, [isOpen, address, fetchProfile])

useEffect(() => {
  if (!isOpen || !address) return

  hasPrefilledRef.current = false
  setUsernameError(null)

  const controller = new AbortController()
  fetchProfile(controller.signal)
  return () => controller.abort()  // cancel if modal closes mid-fetch
}, [isOpen, address, fetchProfile])

useEffect(() => {
  if (!address) {
    setFormData({ wallet_address: "", username: "", bio: "", avatar_url: "" })
    setUsernameError(null)
    hasPrefilledRef.current = false
    return
  }

  setFormData({ wallet_address: address, username: "", bio: "", avatar_url: "" })
  setUsernameError(null)
  hasPrefilledRef.current = false

  if (!isOpen) return

  const controller = new AbortController()
  fetchProfile(controller.signal)
  return () => controller.abort()  // cancel if address changes again before fetch completes
}, [address, isOpen, fetchProfile])  // ✅ fetchProfile now in deps

  useEffect(() => {
    if (!isOpen) hasPrefilledRef.current = false
  }, [isOpen])

  useEffect(() => {
    if (isOpen && user && !hasPrefilledRef.current) {
      hasPrefilledRef.current = true
      setFormData(prev => ({
        ...prev,
        username:   prev.username   || getFallbackUsername(),
        avatar_url: prev.avatar_url || getFallbackAvatar(),
      }))
    }
  }, [user, isOpen, getFallbackUsername, getFallbackAvatar])

  // ── Form handlers ──────────────────────────────────────────────────────
  const checkUsernameUniqueness = async (value: string) => {
    if (!value?.trim() || !address) return true
    try {
      const res  = await fetch(`${API_BASE_URL}/api/profile/check-availability`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          field: "username",
          value: value.trim(),
          current_wallet: address.toLowerCase()
        })
      })
      const data = await res.json()
      if (!data.available) { setUsernameError(data.message); return false }
      setUsernameError(null)
      return true
    } catch { return true }
  }

  const handleSave = async () => {
    if (!isConnected || !address || !signer) return toast.error("Wallet error")
    if (!user?.google?.email)         return toast.error("Please connect your Google (Email) account.")
    if (!user?.twitter?.username)     return toast.error("Please connect your X (Twitter) account.")

    setSaving(true)
    const validUsername = await checkUsernameUniqueness(formData.username || "")
    if (!validUsername) { setSaving(false); return toast.error("Please fix errors before saving.") }

    try {
      const nonce     = Math.floor(Math.random() * 1000000).toString()
      const message   = `Update Profile\nWallet: ${address}\nNonce: ${nonce}`
      const signature = await signer.signMessage(message)

      const payload = {
        wallet_address: address,
        username:   formData.username,
        bio:        formData.bio,
        avatar_url: formData.avatar_url,
        email:            user?.google?.email         || "",
        twitter_handle:   user?.twitter?.username     || "",
        discord_handle:   user?.discord?.username     || "",
        telegram_handle:  user?.telegram?.username    || "",
        farcaster_handle: user?.farcaster?.username   || "",
        twitter_id:       user?.twitter?.subject      || "",
        discord_id:       user?.discord?.subject      || "",
        telegram_user_id: user?.telegram?.telegramUserId || "",
        farcaster_id:     user?.farcaster?.fid ? String(user.farcaster.fid) : "",
        // Include resolved Solana address so the backend stores it
        solana_address:   solanaAddress               || "",
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
      window.dispatchEvent(new Event("profileUpdated"))
      if (formData.username && formData.username.toLowerCase() !== "anonymous") {
        router.push(`/dashboard/${formData.username}`)
      }
    } catch {
      toast.error("Could not save profile")
    } finally {
      setSaving(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const uploadData = new FormData()
      uploadData.append("file", file)
      const response = await fetch(`${API_BASE_URL}/upload-image`, { method: "POST", body: uploadData })
      const data     = await response.json()
      if (data.success) {
        setFormData(prev => ({ ...prev, avatar_url: data.imageUrl }))
        toast.success("Image uploaded — ready to save.")
      } else throw new Error(data.message)
    } catch (error: any) {
      toast.error(`Upload failed: ${error.message}`)
    } finally {
      setUploading(false)
    }
  }

  const handleShuffle = () => setSeedOffset(prev => (prev + 8) % GENERATED_SEEDS.length)
  const currentSeeds  = GENERATED_SEEDS.slice(seedOffset, seedOffset + 8)

  // ── Reusable social row ────────────────────────────────────────────────
  const PrivySocialRow = ({
    label, handle, onConnect, onDisconnect
  }: {
    label: string
    handle?: string | null
    onConnect: () => Promise<any> | void
    onDisconnect?: () => Promise<any> | void
  }) => {
    const [isConnecting,    setIsConnecting]    = useState(false)
    const [isDisconnecting, setIsDisconnecting] = useState(false)
    const isLinkingRef = useRef(false)

    const handleConnect = async () => {
      if (isLinkingRef.current) return
      isLinkingRef.current = true
      setIsConnecting(true)
      try { await onConnect() }
      catch (error: any) {
        const msg = (error?.message ?? "").toLowerCase()
        if (!msg.includes("closed") && !msg.includes("cancelled") && !msg.includes("popup"))
          toast.error(`Failed to connect ${label}. Please try again.`)
      }
      finally { setIsConnecting(false); isLinkingRef.current = false }
    }

    const handleDisconnect = async () => {
      if (!onDisconnect) return
      setIsDisconnecting(true)
      try { await onDisconnect() }
      catch (error: any) {
        const msg = (error?.message ?? "").toLowerCase()
        if (msg.includes("cannot remove") || msg.includes("only linked account") || msg.includes("at least one"))
          toast.error("You must keep at least one account linked to your wallet.")
        else
          toast.error(`Failed to disconnect ${label}. Please try again.`)
      }
      finally { setIsDisconnecting(false) }
    }

    return (
      <div className="flex items-center justify-between p-3 border rounded-lg bg-card/50 hover:bg-card/80 transition-colors">
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-foreground">{label}</span>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            {handle ? (
              <span className="text-green-600 flex items-center font-medium">
                <CheckCircle2 className="h-3 w-3 mr-1" /> {handle}
              </span>
            ) : "Not linked"}
          </span>
        </div>
        {handle ? (
          <Button size="sm" variant="ghost" type="button" onClick={handleDisconnect} disabled={isDisconnecting}
            className="text-red-500 hover:text-red-600 hover:bg-red-50">
            {isDisconnecting && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
            {isDisconnecting ? "Removing…" : "Disconnect"}
          </Button>
        ) : (
          <Button size="sm" variant="outline" type="button" onClick={handleConnect} disabled={isConnecting}>
            {isConnecting && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
            {isConnecting ? "Opening…" : "Connect"}
          </Button>
        )}
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-background shadow-sm hover:bg-muted">
          <Edit2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>

      <DialogContent className="w-[95%] sm:max-w-[600px] max-h-[90vh] rounded-lg flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-0 shrink-0">
          <DialogTitle>Edit Profile</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-2">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="flex flex-col gap-6 py-4">

            {/* ── Avatar ──────────────────────────────────────────────── */}
            <div className="flex flex-col items-center gap-4 w-full">
              <Avatar className="h-24 w-24 border-2 border-primary/20">
                <AvatarImage src={formData.avatar_url} className="object-cover" />
                <AvatarFallback className="text-2xl font-bold">{formData.username?.[0] || "?"}</AvatarFallback>
              </Avatar>

              <Tabs defaultValue="generate" className="w-full max-w-sm">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="upload">Upload Custom</TabsTrigger>
                  <TabsTrigger value="generate">Choose Avatar</TabsTrigger>
                </TabsList>

                <TabsContent value="upload" className="pt-4">
                  <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 hover:bg-accent/50 transition-colors cursor-pointer relative bg-muted/20">
                    <input type="file" accept="image/*" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" disabled={uploading} />
                    {uploading
                      ? <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      : <Upload className="h-8 w-8 text-muted-foreground mb-2" />}
                    <p className="text-xs sm:text-sm text-muted-foreground text-center">
                      {uploading ? "Uploading…" : "Tap to upload image (max 5 MB)"}
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="generate" className="pt-4">
                  <div className="grid grid-cols-4 gap-3">
                    {currentSeeds.map((seed, idx) => {
                      const url        = `https://api.dicebear.com/9.x/notionists/svg?seed=${seed}`
                      const isSelected = formData.avatar_url === url
                      return (
                        <div key={`${seed}-${idx}`}
                          onClick={() => setFormData(prev => ({ ...prev, avatar_url: url }))}
                          className={`relative aspect-square rounded-full cursor-pointer overflow-hidden border-2 transition-all hover:scale-105 ${isSelected ? "border-primary ring-2 ring-primary/20" : "border-transparent bg-muted"}`}>
                          <img src={url} alt={seed} className="w-full h-full" />
                          {isSelected && (
                            <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                              <Check className="h-5 w-5 text-white" />
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleShuffle} className="w-full mt-4 text-muted-foreground hover:text-primary gap-2">
                    <RefreshCw className="h-3 w-3" /> Shuffle Avatars
                  </Button>
                </TabsContent>
              </Tabs>
            </div>

            {/* ── Manual inputs ────────────────────────────────────────── */}
            <div className="grid gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-4 items-start gap-2">
                <Label className="sm:text-right pt-2">Username</Label>
                <div className="col-span-3">
                  <Input
                    value={formData.username || ""}
                    onChange={(e) => { setFormData({ ...formData, username: e.target.value }); setUsernameError(null) }}
                    onBlur={() => checkUsernameUniqueness(formData.username || "")}
                    className={usernameError ? "border-red-500" : ""}
                  />
                  {usernameError && <p className="text-xs text-red-500 mt-1">{usernameError}</p>}
                  {usernameError === null && formData.username && (
                    <p className="text-xs text-green-600 mt-1 flex items-center">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Available
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 items-start gap-2">
                <Label className="sm:text-right pt-2">Bio</Label>
                <Textarea
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  className="col-span-3"
                  placeholder="Tell us about yourself…"
                />
              </div>
            </div>

            {/* ── Linked Wallets ───────────────────────────────────────── */}
            <div className="border-t pt-6">
              <h4 className="mb-1 text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Wallet className="h-3 w-3" /> Linked Wallets
              </h4>

              {/*
                NOTE: For embedded users we intentionally suppress ALL "link external
                wallet" prompts. Their embedded wallets cover both EVM and Solana and
                that's all they need.
              */}
              {!isEmbeddedUser && (
                <p className="text-xs text-muted-foreground mb-4">
                  Link your EVM and Solana wallets so your profile, points, and tasks
                  carry over when you switch networks.
                </p>
              )}
              {isEmbeddedUser && (
                <p className="text-xs text-muted-foreground mb-4">
                  Your embedded wallets automatically cover all supported networks.
                </p>
              )}

              <div className="grid gap-3">

                {/* ─ EVM wallet row ──────────────────────────────────── */}
                {activeEvmWallet?.address && (
                  <div className="flex items-center justify-between p-3 border rounded-lg bg-card/50">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold">EVM Wallet</span>
                      <span className="text-xs text-muted-foreground font-mono">
                        {(activeEvmWallet as any).address.slice(0, 6)}…{(activeEvmWallet as any).address.slice(-4)}
                      </span>
                    </div>
                    <Badge variant="secondary" className="capitalize">
                      {(activeEvmWallet as any).walletClientType === "privy" ? "Embedded" : "External"}
                    </Badge>
                  </div>
                )}

                {/*
                  "Link External EVM" prompt — hidden for embedded-only users.
                  External users who haven't linked a second EVM wallet see it.
                */}
                {!isEmbeddedUser && !hasExternalEvm && (
                  <div className="flex items-center justify-between p-3 border border-dashed rounded-lg bg-card/50 hover:bg-card/80 transition-colors">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold">External EVM Wallet</span>
                      <span className="text-xs text-muted-foreground max-w-[180px]">Link MetaMask, Coinbase, etc.</span>
                    </div>
                    <Button size="sm" variant="outline" type="button" onClick={() => linkWallet()}>
                      Link Wallet
                    </Button>
                  </div>
                )}

                {/* ─ Solana wallet row ───────────────────────────────── */}
                {solanaAddress && (
                  <div className="flex items-center justify-between p-3 border rounded-lg bg-card/50">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold">Solana Wallet</span>
                      <span className="text-xs text-muted-foreground font-mono">
                        {solanaAddress.slice(0, 6)}…{solanaAddress.slice(-4)}
                      </span>
                    </div>
                    <Badge variant={hasExternalSolana ? "default" : "secondary"} className="capitalize">
                      {hasExternalSolana ? "External" : "Embedded"}
                    </Badge>
                  </div>
                )}

                {/*
                  "Link External Solana" prompt:
                  • Hidden for embedded users entirely.
                  • Hidden for external users who already have an external Solana wallet.
                  • Shown for external users who only have an embedded (auto-generated)
                    Solana wallet — they can upgrade to Phantom/Solflare here.
                */}
                {!isEmbeddedUser && !hasExternalSolana && (
                  <div className="flex items-center justify-between p-3 border border-dashed rounded-lg bg-card/50 hover:bg-card/80 transition-colors">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold">External Solana Wallet</span>
                      <span className="text-xs text-muted-foreground max-w-[180px]">
                        Link Phantom, Solflare, etc.
                        {solanaAddress && (
                          <span className="block text-amber-600 mt-0.5">
                            Override your auto-generated wallet
                          </span>
                        )}
                      </span>
                    </div>
                    <Button size="sm" variant="outline" type="button" onClick={() => linkWallet()}>
                      {solanaAddress ? "Override" : "Link Wallet"}
                    </Button>
                  </div>
                )}

              </div>
            </div>

            {/* ── Verified connections ─────────────────────────────────── */}
            <div className="border-t pt-6">
              <h4 className="mb-4 text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <LinkIcon className="h-3 w-3" /> Verified Connections
              </h4>
              <div className="grid gap-3">
                <PrivySocialRow
                  label="Email (Google)"
                  handle={user?.google?.email}
                  onConnect={linkGoogle}
                  onDisconnect={() => unlinkGoogle(user?.google?.subject!)}
                />
                <PrivySocialRow
                  label="X (Twitter)"
                  handle={user?.twitter?.username}
                  onConnect={linkTwitter}
                  onDisconnect={() => unlinkTwitter(user?.twitter?.subject!)}
                />
                <PrivySocialRow
                  label="Discord"
                  handle={user?.discord?.username}
                  onConnect={linkDiscord}
                  onDisconnect={() => unlinkDiscord(user?.discord?.subject!)}
                />
                <PrivySocialRow
                  label="Telegram"
                  handle={user?.telegram?.username}
                  onConnect={linkTelegram}
                  onDisconnect={() => unlinkTelegram(user?.telegram?.telegramUserId!)}
                />
                <PrivySocialRow
                  label="Farcaster"
                  handle={user?.farcaster?.username}
                  onConnect={linkFarcaster}
                  onDisconnect={() => unlinkFarcaster(user?.farcaster?.fid!)}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                * Click "Save Profile" below to sync linked accounts to your public profile.
              </p>
            </div>

          </div>
        )}
        </div>

        <div className="shrink-0 px-6 pt-2 pb-6 border-t bg-background">
    <Button onClick={handleSave} disabled={saving || loading || !!usernameError} className="w-full">
      {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
      {saving ? "Saving…" : "Save Profile"}
    </Button>
  </div>
      </DialogContent>
    </Dialog>
  )
}
