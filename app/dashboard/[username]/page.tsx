"use client"

import React, { useEffect, useState, useMemo, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { useWallet } from "@/components/wallet-provider"
import { useNetwork, Network } from "@/hooks/use-network"
import { Header } from "@/components/header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createClient } from "@supabase/supabase-js"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Settings, Search, Copy, Wallet, Loader2,
  ScrollText, PencilRuler, Rocket, Trash2,
  Mail, Phone
} from "lucide-react"

import { useToast } from "@/hooks/use-toast"
import { ProfileSettingsModal } from "@/components/profile-settings-modal"
import { MyCreationsModal } from "@/components/my-creations-modal"
import { CreateNewModal } from "@/components/create-new-modal"
import { usePrivy } from "@privy-io/react-auth"
import { EmbeddedWalletControlProduction } from "@/components/embeddedwallet"
import { SelfVerificationModal } from "@/components/self-verification-modal"
import { VerifiedAvatar, VerifyPill, VerifiedBadge } from "@/components/verified-profile-avatar"
import Loading from "@/app/loading"
import { buildFaucetSlug } from "@/lib/faucet-slug"

// --- Types ---
interface FaucetData {
  faucetAddress: string
  name: string
  chainId: number
  faucetType: string
  createdAt?: string
  slug?: string
  imageUrl?: string
  tokenSymbol?: string
  tokenDecimals?: number
  isEther?: boolean
  isClaimActive?: boolean
  claimAmount?: bigint
  startTime?: string | number
  endTime?: string | number
  token?: string
  network?: Network
  description?: string
  owner?: string
  factoryAddress?: string
}

interface QuestData {
  faucetAddress?: string
  slug?: string
  title: string
  isDemo?: boolean
  description: string
  imageUrl: string
  creatorAddress?: string
  status?: "draft" | "published"
  createdAt?: string
  participantCount?: number
}

interface QuizData {
  code: string
  title: string
  description: string
  coverImageUrl?: string
  status: string
  creatorAddress: string
  playerCount: number
  maxParticipants: number
  createdAt: string
}

interface UserProfileData {
  wallet_address: string
  username: string
  email?: string
  phone?: string
  bio?: string
  avatar_url?: string
}

export default function DashboardPage() {
  const backendUrl = "https://identical-vivi-faucetdrops-41e9c56b.koyeb.app"
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const { address: connectedAddress, isConnected } = useWallet()
  const { networks } = useNetwork()
  const { user: privyUser } = usePrivy()

  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; quest: QuestData | null }>({
    open: false,
    quest: null,
  })
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("")

  const targetUsernameOrAddress = params.username as string

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false)
  const [isVerified, setIsVerified] = useState(false)

  // Data state
  const [userQuizzes, setUserQuizzes] = useState<QuizData[]>([])
  const [faucets, setFaucets] = useState<FaucetData[]>([])
  const [publishedQuests, setPublishedQuests] = useState<QuestData[]>([])
  const [draftQuests, setDraftQuests] = useState<QuestData[]>([])
  const [profile, setProfile] = useState<UserProfileData | null>(null)
  const [quizCount, setQuizCount] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [initialLoadComplete, setInitialLoadComplete] = useState(false)

  // UI state
  const [searchQuery, setSearchQuery] = useState("")
  const [networkFilter, setNetworkFilter] = useState("all")
  const [activeTab, setActiveTab] = useState<"faucets" | "quests" | "quizzes">("faucets")

  const isOwner = useMemo(() => {
    if (!connectedAddress || !profile?.wallet_address) return false
    return connectedAddress.toLowerCase() === profile.wallet_address.toLowerCase()
  }, [connectedAddress, profile])

  // ── Display helpers ───────────────────────────────────────────────────
  const getDisplayAvatar = () => {
    if (profile?.avatar_url) return profile.avatar_url
    if (isOwner && privyUser) {
      const google = privyUser.google as any
      return google?.picture || google?.profilePictureUrl || ""
    }
    return ""
  }

  const getDisplayName = () => {
    if (profile?.username && profile.username !== "New User") return profile.username
    if (isOwner && privyUser) {
      if (privyUser.google?.name) return (privyUser.google.name as string).replace(/\s+/g, "")
      if (privyUser.email?.address) return privyUser.email.address.split("@")[0]
    }
    return profile?.username || "Anonymous"
  }

  const displayAvatar = getDisplayAvatar()
  const displayName = getDisplayName()

  // ── Resolve identification from Privy (email + phone) ────────────────
  const privyEmail: string = (() => {
    if (!privyUser) return ""
    if (privyUser.google?.email) return privyUser.google.email
    if (privyUser.email?.address) return privyUser.email.address
    for (const acc of privyUser.linkedAccounts ?? []) {
      const a = acc as any
      if (a.type === "google_oauth" && a.email) return a.email
      if (a.type === "email" && a.address) return a.address
      if (a.email) return a.email
      if (a.emailAddress) return a.emailAddress
    }
    return ""
  })()

  const privyPhone: string = (() => {
    if (!privyUser) return ""
    for (const acc of privyUser.linkedAccounts ?? []) {
      const a = acc as any
      if (a.type === "phone" && (a.phoneNumber || a.number)) return a.phoneNumber || a.number
    }
    return ""
  })()

  // ── Verification ──────────────────────────────────────────────────────
  useEffect(() => {
    if (profile?.wallet_address) {
      const stored = localStorage.getItem(
        `verification_${profile.wallet_address.toLowerCase()}`
      )
      if (stored) {
        const data = JSON.parse(stored)
        if (data.verified && Date.now() - data.timestamp < 30 * 24 * 60 * 60 * 1000) {
          setIsVerified(true)
        }
      }
    }
  }, [profile])

  const handleVerificationSuccess = async (data: any) => {
    try {
      setIsVerified(true)
      localStorage.setItem(
        `verification_${profile?.wallet_address.toLowerCase()}`,
        JSON.stringify(data)
      )
      toast({ title: "Identity Verified!", description: "Your verified status has been saved." })
    } catch {
      toast({ title: "Error", description: "Verification succeeded but failed to save.", variant: "destructive" })
    }
  }

  // ── Supabase helpers ──────────────────────────────────────────────────
  const getNativeTokenSymbol = (networkName: string): string => {
    switch (networkName) {
      case "Celo": return "CELO"
      case "BNB": return "BNB"
      default: return "ETH"
    }
  }

  async function fetchOwnerFaucetsMeta(supabaseClient: any, ownerAddress: string) {
    const { data, error } = await supabaseClient
      .from("network_faucets")
      .select(
        "faucet_address, slug, is_claim_active, is_ether, start_time, token_symbol, faucet_name, owner_address, factory_address, factory_type, chain_id"
      )
      .eq("owner_address", ownerAddress.toLowerCase())
    if (error) throw new Error(`network_faucets fetch: ${error.message}`)
    return (data ?? []).map((r: any) => ({
      faucetAddress: r.faucet_address,
      isClaimActive: r.is_claim_active,
      isEther: r.is_ether,
      slug: r.slug,
      createdAt: r.start_time,
      tokenSymbol: r.token_symbol,
      name: r.faucet_name,
      owner: r.owner_address,
      factoryAddress: r.factory_address,
      factoryType: r.factory_type,
      chainId: r.chain_id,
    }))
  }

  async function fetchOwnerFaucetsDetails(supabaseClient: any, addresses: string[]) {
    if (addresses.length === 0) return {}
    const { data, error } = await supabaseClient
      .from("faucet_details")
      .select("*")
      .in("faucet_address", addresses.map((a: string) => a.toLowerCase()))
    if (error) throw new Error(`faucet_details fetch: ${error.message}`)
    const map: Record<string, any> = {}
    for (const row of data ?? []) map[row.faucet_address.toLowerCase()] = row
    return map
  }

  // ── Delete draft ──────────────────────────────────────────────────────
  const handleDeleteDraft = async () => {
    if (!deleteDialog.quest?.faucetAddress) return
    try {
      const res = await fetch(
        `${backendUrl}/api/quests/draft/${deleteDialog.quest.faucetAddress}`,
        { method: "DELETE" }
      )
      const data = await res.json()
      if (data.success) {
        toast({ title: "Draft deleted" })
        setDraftQuests((prev) =>
          prev.filter((q) => q.faucetAddress !== deleteDialog.quest!.faucetAddress)
        )
      } else {
        toast({ title: "Failed to delete draft", variant: "destructive" })
      }
    } catch {
      toast({ title: "Error deleting draft", variant: "destructive" })
    } finally {
      setDeleteDialog({ open: false, quest: null })
      setDeleteConfirmInput("")
    }
  }

  // ── Main data fetch ───────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      let userProfile: UserProfileData | null = null
      let userWallet: string | null = null

      const isAddress =
        targetUsernameOrAddress.startsWith("0x") &&
        targetUsernameOrAddress.length === 42

      if (isAddress) {
        const res = await fetch(
          `${backendUrl}/api/profile/${targetUsernameOrAddress.toLowerCase()}`
        )
        const data = await res.json()
        const p = data.profile

        userProfile = p
          ? {
              wallet_address: p.wallet_address || targetUsernameOrAddress.toLowerCase(),
              username: p.username,
              email: p.email,
              phone: p.phone,
              bio: p.bio,
              avatar_url: p.avatar_url,
            }
          : {
              wallet_address: targetUsernameOrAddress.toLowerCase(),
              username: "New User",
              bio: "Profile not set up yet.",
            }
        userWallet = targetUsernameOrAddress.toLowerCase()
      } else {
        const res = await fetch(
          `${backendUrl}/api/profile/user/${targetUsernameOrAddress}`
        )
        const data = await res.json()
        if (data.success && data.profile) {
          const p = data.profile
          userProfile = {
            wallet_address: p.wallet_address,
            username: p.username,
            email: p.email,
            phone: p.phone,
            bio: p.bio,
            avatar_url: p.avatar_url,
          }
          userWallet = p.wallet_address
        } else {
          setProfile(null)
          setInitialLoadComplete(true)
          setLoading(false)
          return
        }
      }

      setProfile(userProfile)

      if (!userWallet) return

      // Faucets
      const metaList = await fetchOwnerFaucetsMeta(supabase, userWallet)
      const detailMap = await fetchOwnerFaucetsDetails(
        supabase,
        metaList.map((m: any) => m.faucetAddress)
      )

      const enrichedFaucets: FaucetData[] = metaList.map((meta: any) => {
        const row = detailMap[meta.faucetAddress.toLowerCase()]
        const chainNetwork = networks.find((n) => n.chainId === meta.chainId)
        if (row) {
          return {
            faucetAddress: row.faucet_address,
            name: row.faucet_name,
            slug: row.slug || meta.slug,
            tokenSymbol:
              row.token_symbol ||
              (row.is_ether ? getNativeTokenSymbol(chainNetwork?.name || "") : "TOK"),
            tokenDecimals: row.token_decimals ?? 18,
            isEther: row.is_ether,
            claimAmount: row.claim_amount ? BigInt(row.claim_amount) : undefined,
            startTime: row.start_time,
            endTime: row.end_time,
            isClaimActive: row.is_claim_active,
            token: row.token_address,
            network: chainNetwork,
            createdAt: row.start_time,
            description: row.description,
            imageUrl: row.image_url || "/default.jpeg",
            owner: row.owner_address,
            factoryAddress: row.factory_address || meta.factoryAddress,
            faucetType: meta.factoryType || "dropcode",
            chainId: meta.chainId,
          } as FaucetData
        }
        return {
          faucetAddress: meta.faucetAddress,
          name: meta.name,
          slug: meta.slug,
          tokenSymbol:
            meta.tokenSymbol ||
            (meta.isEther ? getNativeTokenSymbol(chainNetwork?.name || "") : "TOK"),
          tokenDecimals: 18,
          isEther: meta.isEther,
          isClaimActive: meta.isClaimActive,
          network: chainNetwork,
          createdAt: meta.createdAt,
          owner: meta.owner,
          factoryAddress: meta.factoryAddress,
          imageUrl: "/default.jpeg",
          faucetType: meta.factoryType || "dropcode",
          chainId: meta.chainId,
        } as FaucetData
      })
      setFaucets(enrichedFaucets)

      // Published quests
      const questRes = await fetch(`${backendUrl}/api/quests`)
      const qData = await questRes.json()
      if (qData.success) {
        const mine = qData.quests
          .filter((q: any) => q.creatorAddress?.toLowerCase() === userWallet!.toLowerCase())
          .map((q: any) => ({
            ...q,
            slug: q.slug || q.faucetAddress,
            isDemo:
              q.faucetAddress?.startsWith("draft-") ||
              q.faucetAddress?.startsWith("demo-"),
          }))
        setPublishedQuests(mine.filter((q: any) => !q.isDraft))
      }

      // Drafts (owner only)
      if (connectedAddress?.toLowerCase() === userWallet.toLowerCase()) {
        try {
          const draftRes = await fetch(
            `${backendUrl}/api/quests/drafts/${userWallet}`
          )
          if (draftRes.ok) {
            const dData = await draftRes.json()
            if (dData.success) {
              setDraftQuests(
                dData.drafts.map((d: any) => ({
                  ...d,
                  faucetAddress: d.faucet_address,
                  creatorAddress: d.creator_address,
                  imageUrl: d.image_url,
                  title: d.title,
                  description: d.description,
                }))
              )
            }
          }
        } catch {}
      }

      // Quizzes
      try {
        const quizRes = await fetch(`${backendUrl}/api/quiz/list`)
        const quizData = await quizRes.json()
        if (quizData.success) {
          const mine = quizData.quizzes.filter(
            (q: QuizData) =>
              q.creatorAddress?.toLowerCase() === userWallet!.toLowerCase()
          )
          setUserQuizzes(mine)
          setQuizCount(mine.length)
        }
      } catch {}

      setInitialLoadComplete(true)
    } catch (error) {
      console.error("Dashboard load error:", error)
      toast({ title: "Failed to load dashboard", variant: "destructive" })
      setInitialLoadComplete(true)
    } finally {
      setLoading(false)
    }
  }, [targetUsernameOrAddress, connectedAddress, backendUrl, networks])

  useEffect(() => {
    if (!targetUsernameOrAddress) return
    setInitialLoadComplete(false)
    setProfile(null)
    setFaucets([])
    setPublishedQuests([])
    setDraftQuests([])
    fetchData()
  }, [targetUsernameOrAddress, fetchData])

  // ── Helpers ───────────────────────────────────────────────────────────
  const getNetworkName = (id: number) =>
    networks.find((n) => n.chainId === id)?.name || `Chain ${id}`
  const getNetworkColor = (id: number) =>
    networks.find((n) => n.chainId === id)?.color || "#64748b"

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({ title: "Copied to clipboard" })
  }

  const filteredFaucets = useMemo(
    () =>
      faucets.filter((f) => {
        const matchesSearch =
          f.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          f.faucetAddress.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesNetwork =
          networkFilter === "all" || f.chainId.toString() === networkFilter
        return matchesSearch && matchesNetwork
      }),
    [faucets, searchQuery, networkFilter]
  )

  // ── Guards ────────────────────────────────────────────────────────────
  if (loading && !initialLoadComplete) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <Loading />
      </div>
    )
  }

  if (!profile && initialLoadComplete) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-2">
        <p className="text-xl font-semibold">User not found</p>
        <p className="text-muted-foreground">This profile doesn't exist.</p>
        <Button onClick={() => router.push("/")} className="mt-4">
          Go Home
        </Button>
      </div>
    )
  }

  if (!profile) return null

  const displayAddress = profile.wallet_address
    ? `${profile.wallet_address.slice(0, 6)}...${profile.wallet_address.slice(-4)}`
    : ""

  // Identification to show on profile (email or phone — whichever is set)
  const shownEmail = profile.email || (isOwner ? privyEmail : "")
  const shownPhone = profile.phone || (isOwner ? privyPhone : "")

  return (
    <main className="min-h-screen bg-background pb-20 relative overflow-x-hidden">
      <div className="container mx-auto px-4 py-8 relative z-10 max-w-7xl">
        <Header
          pageTitle={isOwner ? "My Dashboard" : `${profile.username}'s Space`}
          hideAction={true}
        />

        {/* --- PROFILE CARD --- */}
        <div className="mb-10">
          <Card className="border-none bg-gradient-to-r from-primary/5 via-primary/10 to-background shadow-sm">
            <CardContent className="p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center gap-6 relative">
              {isOwner && (
                <div className="absolute top-4 right-4 md:hidden z-30">
                  <EmbeddedWalletControlProduction />
                </div>
              )}

              <VerifiedAvatar
                displayAvatar={displayAvatar}
                displayName={displayName}
                isVerified={isVerified}
                isOwner={isOwner}
              />

              <SelfVerificationModal
                isOpen={isVerifyModalOpen}
                onOpenChange={setIsVerifyModalOpen}
                account={connectedAddress || ""}
                onSuccess={handleVerificationSuccess}
              />

              <div className="flex-1 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                    {displayName}
                  </h1>
                  {isOwner && !isVerified && (
                    <VerifyPill onClick={() => setIsVerifyModalOpen(true)} />
                  )}
                  {isVerified && <VerifiedBadge />}
                </div>

                {/* Wallet address */}
                <div className="flex items-center gap-2 text-muted-foreground font-mono text-sm">
                  <Wallet className="h-4 w-4" />
                  <span>{displayAddress}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => copyToClipboard(profile.wallet_address)}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>

                {/* Identification badges — email and/or phone */}
                {(shownEmail || shownPhone) && (
                  <div className="flex flex-wrap gap-2">
                    {shownEmail && (
                      <Badge
                        variant="secondary"
                        className="bg-blue-50 text-blue-700 border-blue-100 gap-1.5"
                      >
                        <Mail className="h-3 w-3" />
                        {shownEmail}
                      </Badge>
                    )}
                    {shownPhone && (
                      <Badge
                        variant="secondary"
                        className="bg-green-50 text-green-700 border-green-100 gap-1.5"
                      >
                        <Phone className="h-3 w-3" />
                        {shownPhone}
                      </Badge>
                    )}
                  </div>
                )}

                <p className="text-sm text-muted-foreground max-w-2xl line-clamp-2">
                  {profile.bio || "No bio set yet."}
                </p>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-6 bg-background/50 p-4 rounded-xl border self-start md:self-center w-full md:w-auto justify-around md:justify-start">
                <div className="text-center">
                  <div className="text-2xl font-bold">{faucets.length}</div>
                  <div className="text-xs text-muted-foreground uppercase font-semibold">
                    Faucets
                  </div>
                </div>
                <div className="h-10 w-[1px] bg-border" />
                <div className="text-center">
                  <div className="text-2xl font-bold">{publishedQuests.length}</div>
                  <div className="text-xs text-muted-foreground uppercase font-semibold">
                    Quests
                  </div>
                </div>
                <div className="h-10 w-[1px] bg-border" />
                <div className="text-center">
                  <div className="text-2xl font-bold">{quizCount}</div>
                  <div className="text-xs text-muted-foreground uppercase font-semibold">
                    Quizzes
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* --- ACTION BAR & TABS --- */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
          <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg">
            {(["faucets", "quests", "quizzes"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                  activeTab === tab
                    ? "bg-background shadow text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)} (
                {tab === "faucets"
                  ? faucets.length
                  : tab === "quests"
                  ? publishedQuests.length
                  : quizCount}
                )
              </button>
            ))}
          </div>

          {isOwner && (
            <div className="flex gap-3 w-full md:w-auto">
              <div className="md:hidden flex gap-3 w-full">
                <MyCreationsModal faucets={faucets} address={connectedAddress!} />
                <CreateNewModal onSuccess={fetchData} />
              </div>
              <div className="hidden md:flex gap-3 flex-wrap">
                <EmbeddedWalletControlProduction />
                <MyCreationsModal faucets={faucets} address={connectedAddress!} />
                <CreateNewModal onSuccess={fetchData} />
              </div>
            </div>
          )}
        </div>

        {/* --- TAB: FAUCETS --- */}
        {activeTab === "faucets" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search faucets..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={networkFilter} onValueChange={setNetworkFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="All Networks" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Networks</SelectItem>
                  {networks.map((n) => (
                    <SelectItem key={n.chainId} value={n.chainId.toString()}>
                      {n.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredFaucets.length > 0 ? (
                filteredFaucets.map((faucet) => (
                  <FaucetCard
                    key={faucet.faucetAddress}
                    faucet={faucet}
                    getNetworkName={getNetworkName}
                    getNetworkColor={getNetworkColor}
                    onManage={() =>
                      router.push(
                        faucet.slug
                          ? `/faucet/${faucet.slug}`
                          : `/faucet/${faucet.faucetAddress}?networkId=${faucet.chainId}`
                      )
                    }
                    isOwner={isOwner}
                  />
                ))
              ) : (
                <div className="col-span-full text-center py-10 text-muted-foreground">
                  No faucets found.
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- TAB: QUESTS --- */}
        {activeTab === "quests" && (
          <div className="space-y-10">
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Rocket className="h-5 w-5 text-blue-500" /> Published Quests
              </h3>
              {publishedQuests.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {publishedQuests.map((quest) => (
                    <QuestCard
                      key={quest.faucetAddress}
                      quest={quest}
                      type="published"
                      onClick={() =>
                        router.push(`/quest/${quest.slug || quest.faucetAddress}`)
                      }
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No published quests yet.
                </div>
              )}
            </div>

            {isOwner && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <PencilRuler className="h-5 w-5 text-orange-500" /> Drafts
                  </h3>
                  <Badge
                    variant="outline"
                    className="border-orange-200 text-orange-600 bg-orange-50"
                  >
                    {draftQuests.length}
                  </Badge>
                </div>
                {draftQuests.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {draftQuests.map((quest) => (
                      <QuestCard
                        key={quest.faucetAddress}
                        quest={quest}
                        type="draft"
                        onClick={() =>
                          router.push(
                            `/quest/create-quest?draftId=${quest.faucetAddress}${quest.isDemo ? "&demo=true" : ""}`
                          )
                        }
                        onDelete={(q) => {
                          setDeleteDialog({ open: true, quest: q })
                          setDeleteConfirmInput("")
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 border border-dashed rounded-lg bg-muted/10 text-muted-foreground">
                    No drafts in progress.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* --- TAB: QUIZZES --- */}
        {activeTab === "quizzes" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              🧠 Created Quizzes
            </h3>
            {userQuizzes.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {userQuizzes.map((quiz) => (
                  <QuizCard
                    key={quiz.code}
                    quiz={quiz}
                    onClick={() => router.push(`/quiz/${quiz.code}`)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 border border-dashed rounded-lg bg-muted/10 text-muted-foreground">
                No quizzes created yet.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete draft dialog */}
      <Dialog
        open={deleteDialog.open}
        onOpenChange={(open) => {
          setDeleteDialog({ open, quest: open ? deleteDialog.quest : null })
          setDeleteConfirmInput("")
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Draft</DialogTitle>
            <DialogDescription>
              This cannot be undone. Type the quest name to confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm font-medium">
              Quest name:{" "}
              <span className="font-bold text-destructive">
                {deleteDialog.quest?.title || "Untitled Quest"}
              </span>
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Type to confirm</Label>
              <Input
                placeholder={deleteDialog.quest?.title || "Untitled Quest"}
                value={deleteConfirmInput}
                onChange={(e) => setDeleteConfirmInput(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialog({ open: false, quest: null })
                setDeleteConfirmInput("")
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={
                deleteConfirmInput !== (deleteDialog.quest?.title || "Untitled Quest")
              }
              onClick={handleDeleteDraft}
            >
              <Trash2 className="h-4 w-4 mr-2" /> Delete Draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}

// --- Sub-components ---

function FaucetCard({ faucet, getNetworkName, getNetworkColor, onManage, isOwner }: any) {
  const networkName = getNetworkName(faucet.chainId)
  const networkColor = getNetworkColor(faucet.chainId)
  return (
    <Card className="hover:shadow-md transition-all group cursor-pointer flex flex-col">
      <div className="relative aspect-square w-full bg-muted overflow-hidden rounded-t-lg">
        {faucet.imageUrl ? (
          <img src={faucet.imageUrl} alt={faucet.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-primary/5">
            <span className="text-primary/30 text-4xl font-bold uppercase">
              {faucet.name?.charAt(0) || "F"}
            </span>
          </div>
        )}
        <Badge className="absolute top-2 right-2 capitalize text-xs" variant="secondary">
          {faucet.faucetType}
        </Badge>
      </div>
      <CardHeader className="pb-3">
        <Badge
          variant="outline"
          className="mb-2 w-fit bg-background"
          style={{ borderColor: networkColor, color: networkColor }}
        >
          <span className="w-1.5 h-1.5 rounded-full mr-1.5" style={{ backgroundColor: networkColor }} />
          {networkName}
        </Badge>
        <CardTitle className="truncate text-lg">{faucet.name}</CardTitle>
        <CardDescription className="font-mono text-xs mt-1">
          {faucet.faucetAddress.slice(0, 6)}...{faucet.faucetAddress.slice(-4)}
        </CardDescription>
      </CardHeader>
      <div className="p-4 pt-0 mt-auto">
        <Button onClick={onManage} className="w-full">
          <Settings className="h-4 w-4 mr-2" /> {isOwner ? "Manage" : "View"} Distribution
        </Button>
      </div>
    </Card>
  )
}

function QuizCard({ quiz, onClick }: { quiz: QuizData; onClick: () => void }) {
  return (
    <Card className="hover:shadow-md transition-all cursor-pointer flex flex-col" onClick={onClick}>
      <div className="relative aspect-square w-full bg-muted overflow-hidden rounded-t-lg">
        {quiz.coverImageUrl ? (
          <img src={quiz.coverImageUrl} alt={quiz.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-primary/10 flex items-center justify-center">
            <span className="text-primary/40 text-4xl font-bold uppercase">
              {quiz.title?.charAt(0) || "Q"}
            </span>
          </div>
        )}
        <Badge
          className="absolute top-2 right-2 capitalize"
          variant={quiz.status === "active" ? "default" : quiz.status === "finished" ? "secondary" : "outline"}
        >
          {quiz.status}
        </Badge>
      </div>
      <CardContent className="p-4 flex flex-col flex-grow">
        <div className="flex justify-between items-start mb-1 gap-2">
          <h4 className="font-bold truncate text-base">{quiz.title || "Untitled Quiz"}</h4>
          <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
            {quiz.code}
          </span>
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2 h-10 mb-4">
          {quiz.description || "No description."}
        </p>
        <div className="mt-auto flex justify-between items-center text-xs text-muted-foreground border-t pt-3">
          <span className="text-primary font-medium">
            Players: {quiz.playerCount}
            {quiz.maxParticipants > 0 && ` / ${quiz.maxParticipants}`}
          </span>
          <span>{quiz.createdAt ? new Date(quiz.createdAt).toLocaleDateString() : ""}</span>
        </div>
      </CardContent>
    </Card>
  )
}

interface QuestCardProps {
  quest: QuestData
  type: "published" | "draft"
  onClick: () => void
  onDelete?: (quest: QuestData) => void
}

function QuestCard({ quest, type, onClick, onDelete }: QuestCardProps) {
  return (
    <Card className={`hover:shadow-md transition-all ${type === "draft" ? "border-dashed border-orange-200 bg-orange-50/10" : ""}`}>
      <div
        className="relative aspect-square w-full bg-muted overflow-hidden rounded-t-lg cursor-pointer"
        onClick={onClick}
      >
        {quest.imageUrl && (
          <img src={quest.imageUrl} alt={quest.title} className="w-full h-full object-cover" />
        )}
        <div className="absolute top-2 right-2 flex gap-1">
          <Badge variant={type === "draft" ? "outline" : "default"}>
            {type === "draft" ? "Draft" : "Published"}
          </Badge>
          {(quest.isDemo ||
            quest.faucetAddress?.startsWith("draft-") ||
            quest.faucetAddress?.startsWith("demo-")) && (
            <Badge className="bg-amber-500 text-white border-0">Demo</Badge>
          )}
        </div>
      </div>
      <CardContent className="p-4">
        <h4 className="font-bold truncate text-base mb-1">{quest.title || "Untitled Quest"}</h4>
        <p className="text-sm text-muted-foreground line-clamp-2 h-10 mb-3">
          {quest.description || "No description."}
        </p>
        <div className="flex gap-2">
          <Button
            variant={type === "draft" ? "outline" : "default"}
            size="sm"
            className="flex-1"
            onClick={onClick}
          >
            {type === "draft" ? (
              <><PencilRuler className="h-3 w-3 mr-2" /> Continue Editing</>
            ) : (
              <><ScrollText className="h-3 w-3 mr-2" /> View Quest</>
            )}
          </Button>
          {type === "draft" && onDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="px-2"
              onClick={(e) => { e.stopPropagation(); onDelete(quest) }}
            >
              <Trash2 className="h-3 w-3 text-red-500" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}