"use client"

import React, { useEffect, useState, useMemo, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { useWallet } from "@/components/wallet-provider" 
import { useNetwork, Network } from "@/hooks/use-network" 
import { getUserFaucets } from "@/lib/faucet"
import { Header } from "@/components/header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { createClient } from "@supabase/supabase-js"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { 
    Settings, Search, Copy, Wallet, Loader2,
    ScrollText, PencilRuler, Rocket, Trash2,
    CheckCircle,
    Shield
} from "lucide-react"
import { buildFaucetSlug } from "@/lib/faucet-slug"

import { useToast } from "@/hooks/use-toast"
import { ProfileSettingsModal } from "@/components/profile-settings-modal" 
import { MyCreationsModal } from "@/components/my-creations-modal" 
import { CreateNewModal } from "@/components/create-new-modal" 
import { usePrivy } from "@privy-io/react-auth" 
import { EmbeddedWalletControlProduction } from "@/components/embeddedwallet"
import { SelfVerificationModal } from "@/components/self-verification-modal"
import { VerifiedAvatar, VerifyPill, VerifiedBadge } from "@/components/verified-profile-avatar"
import Loading from "@/app/loading"
// --- Custom Icons ---
const XIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
)

// --- Types ---
interface FaucetData {
  faucetAddress: string;
  name:          string;
  chainId:       number;          // already existed
  faucetType:    string;
  createdAt?:    string;
  slug?:         string;
  imageUrl?:     string;
  // ── new fields from faucet_details ──
  tokenSymbol?:  string;
  tokenDecimals?: number;
  isEther?:      boolean;
  isClaimActive?: boolean;
  claimAmount?:  bigint;
  startTime?:    string | number;
  endTime?:      string | number;
  token?:        string;
  network?:      Network;
  description?:  string;
  owner?:        string;
  factoryAddress?: string;
}

interface QuestData {
    faucetAddress?: string; 
    slug?: string;
    title: string;
    isDemo?: boolean;
    description: string;
    imageUrl: string;
    creatorAddress?: string;
    status?: 'draft' | 'published';
    createdAt?: string;
    participantCount?: number;
}

interface QuizData {
    code: string;
    title: string;
    description: string;
    coverImageUrl?: string;
    status: string;
    creatorAddress: string;
    playerCount: number;
    maxParticipants: number;
    createdAt: string;
}
interface UserProfileData {
    wallet_address: string;
    username: string;
    email?: string;
    bio?: string;
    avatar_url?: string;
    twitter_handle?: string;
    discord_handle?: string;
    telegram_handle?: string;
    farcaster_handle?: string;
}

export default function DashboardPage() {
    const backendUrl = "https://identical-vivi-faucetdrops-41e9c56b.koyeb.app"; 
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const { address: connectedAddress, isConnected } = useWallet(); 
    const { networks } = useNetwork();
    const { user: privyUser } = usePrivy(); 
    const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; quest: QuestData | null }>({ open: false, quest: null })
    const [deleteConfirmInput, setDeleteConfirmInput] = useState("")
    // This could be "jerydam" OR "0x123..."
    const targetUsernameOrAddress = params.username as string;
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )
const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
const [isVerified, setIsVerified] = useState(false);


const getNativeTokenSymbol = (networkName: string): string => {
  switch (networkName) {
    case "Celo": return "CELO";
    case "Lisk": return "ETH";
    case "Arbitrum":
    case "Base":
    case "Ethereum": return "ETH";
    case "BNB": return "BNB";
    default: return "ETH";
  }
};

async function fetchOwnerFaucetsMeta(supabaseClient: any, ownerAddress: string) {
  const { data, error } = await supabaseClient
    .from("network_faucets")
    .select("faucet_address, slug, is_claim_active, is_ether, start_time, token_symbol, faucet_name, owner_address, factory_address, factory_type, chain_id")
    .eq("owner_address", ownerAddress.toLowerCase());

  if (error) throw new Error(`network_faucets owner fetch: ${error.message}`);
  return (data ?? []).map((r: any) => ({
    faucetAddress:  r.faucet_address,
    isClaimActive:  r.is_claim_active,
    isEther:        r.is_ether,
    slug:           r.slug,
    createdAt:      r.start_time,
    tokenSymbol:    r.token_symbol,
    name:           r.faucet_name,
    owner:          r.owner_address,
    factoryAddress: r.factory_address,
    factoryType:    r.factory_type,
    chainId:        r.chain_id,
  }));
}

async function fetchOwnerFaucetsDetails(supabaseClient: any, addresses: string[]) {
  if (addresses.length === 0) return {};
  const { data, error } = await supabaseClient
    .from("faucet_details")
    .select("*")
    .in("faucet_address", addresses.map((a: string) => a.toLowerCase()));

  if (error) throw new Error(`faucet_details owner fetch: ${error.message}`);
  const map: Record<string, any> = {};
  for (const row of data ?? []) {
    map[row.faucet_address.toLowerCase()] = row;
  }
  return map;
}

    // Data State
    const [userQuizzes, setUserQuizzes] = useState<QuizData[]>([]);
    const [faucets, setFaucets] = useState<FaucetData[]>([]);
    const [publishedQuests, setPublishedQuests] = useState<QuestData[]>([]);
    const [draftQuests, setDraftQuests] = useState<QuestData[]>([]);
    const [profile, setProfile] = useState<UserProfileData | null>(null);
    const [quizCount, setQuizCount] = useState<number>(0);
    const [loading, setLoading] = useState(true);
    const [initialLoadComplete, setInitialLoadComplete] = useState(false);
    
    // Filters & UI State
    const [searchQuery, setSearchQuery] = useState("");
    const [networkFilter, setNetworkFilter] = useState("all");
    const [activeTab, setActiveTab] = useState<'faucets' | 'quests' | 'quizzes'>('faucets');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    const isOwner = useMemo(() => {
        if (!connectedAddress || !profile?.wallet_address) return false;
        return connectedAddress.toLowerCase() === profile.wallet_address.toLowerCase();
    }, [connectedAddress, profile]);
    const getDisplayAvatar = () => {
    if (profile?.avatar_url) return profile.avatar_url;
    // Only use Privy fallback if the dashboard owner is the current logged-in user
    if (isOwner && privyUser) {
        const google = privyUser.google as any;
        const twitter = privyUser.twitter as any;
        return google?.picture || google?.profilePictureUrl || twitter?.profilePictureUrl || "";
    }
    return "";
}

    const getDisplayName = () => {
    // If they have a real DB username, use it. If it's the "New User" placeholder, try to upgrade it.
    if (profile?.username && profile.username !== "New User") return profile.username;
    
    if (isOwner && privyUser) {
        if (privyUser.twitter?.username) return privyUser.twitter.username;
        if (privyUser.discord?.username) return privyUser.discord.username;
        if (privyUser.google?.name) return privyUser.google.name.replace(/\s+/g, '');
        if (privyUser.email?.address) return privyUser.email.address.split('@')[0];
    }
    return profile?.username || "Anonymous";
}
useEffect(() => {
    if (profile?.wallet_address) {
        const stored = localStorage.getItem(`verification_${profile.wallet_address.toLowerCase()}`);
        if (stored) {
            const data = JSON.parse(stored);
            // Verify if record is less than 30 days old
            if (data.verified && (Date.now() - data.timestamp < 30 * 24 * 60 * 60 * 1000)) {
                setIsVerified(true);
            }
        }
    }
}, [profile]);

const handleVerificationSuccess = async (data: any) => {
    try {
        // 1. Update the Database via your Backend
        const response = await fetch(`${backendUrl}/api/users/${profile?.wallet_address.toLowerCase()}/verify`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                is_verified: true,
                verification_data: data // Store the ZK-proof or timestamp
            }),
        });

        if (response.ok) {
            // 2. Update Local State for immediate UI feedback
            setIsVerified(true);
            
            // 3. Optional: Backup in localStorage for instant loading next time
            localStorage.setItem(`verification_${profile?.wallet_address.toLowerCase()}`, JSON.stringify(data));

            toast({ 
                title: "Identity Verified!", 
                description: "Your status is now permanently saved to your profile." 
            });
        }
    } catch (error) {
        console.error("Failed to save verification:", error);
        toast({ title: "Error", description: "Verification succeeded but failed to save to profile.", variant: "destructive" });
    }
};
    const displayAvatar = getDisplayAvatar();
    const displayName = getDisplayName();
    // --- NEW: Sync Email with Backend ---
    const syncEmailToBackend = useCallback(async (walletAddress: string, email: string) => {
        try {
            console.log('[Dashboard] Syncing email to backend:', email);
            const response = await fetch(`${backendUrl}/api/users/${walletAddress.toLowerCase()}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email }),
            });

            const data = await response.json();
            
            if (data.success) {
                console.log('✅ [Dashboard] Email synced successfully');
                return true;
            } else {
                console.error('❌ [Dashboard] Failed to sync email:', data);
                return false;
            }
        } catch (error) {
            console.error('❌ [Dashboard] Error syncing email:', error);
            return false;
        }
    }, [backendUrl]);

    // --- NEW: Check and sync email when user is logged in ---
    useEffect(() => {
        if (!privyUser || !connectedAddress || !isOwner) return;

        // Get email from Privy user object
        const userEmail = privyUser.email?.address;
        
        if (userEmail && profile && !profile.email) {
            console.log('[Dashboard] User has email in Privy but not in profile, syncing...');
            syncEmailToBackend(connectedAddress, userEmail).then((success) => {
                if (success) {
                    // Update local profile state
                    setProfile(prev => prev ? { ...prev, email: userEmail } : null);
                    toast({ 
                        title: "Email synced", 
                        description: "Your email has been added to your profile" 
                    });
                }
            });
        }
    }, [privyUser, connectedAddress, profile, isOwner, syncEmailToBackend, toast]);

    // --- FUNCTION: Delete Draft ---
   const handleDeleteDraft = async () => {
    if (!deleteDialog.quest?.faucetAddress) return
    try {
        const res = await fetch(`${backendUrl}/api/quests/draft/${deleteDialog.quest.faucetAddress}`, { method: 'DELETE' })
        const data = await res.json()
        if (data.success) {
            toast({ title: "Draft deleted successfully" })
            setDraftQuests(prev => prev.filter(q => q.faucetAddress !== deleteDialog.quest!.faucetAddress))
        } else {
            toast({ title: "Failed to delete draft", variant: "destructive" })
        }
    } catch (e) {
        console.error(e)
        toast({ title: "Error deleting draft", variant: "destructive" })
    } finally {
        setDeleteDialog({ open: false, quest: null })
        setDeleteConfirmInput("")
    }
}

    // IMPROVED: Fetch data with better address/username handling
   // IMPROVED: Fetch data with better address/username handling
  const fetchData = useCallback(async () => {
        console.log('[Dashboard] Starting fetchData for:', targetUsernameOrAddress)
        setLoading(true);
        
        try {
            let userProfile: UserProfileData | null = null;
            let userWallet: string | null = null;

            // STEP 1: Determine if input is address or username
            const isAddress = targetUsernameOrAddress.startsWith('0x') && targetUsernameOrAddress.length === 42;
            
            if (isAddress) {
                console.log('[Dashboard] Fetching profile by address:', targetUsernameOrAddress)
                const profRes = await fetch(`${backendUrl}/api/users/${targetUsernameOrAddress.toLowerCase()}?t=${Date.now()}`);
                const profData = await profRes.json();
                
                const fetchedData = profData.profile || (profData.username ? profData : null);

                if (profData.success && fetchedData) {
                    userProfile = {
                        wallet_address: fetchedData.wallet_address || targetUsernameOrAddress.toLowerCase(),
                        username: fetchedData.username,
                        email: fetchedData.email,
                        bio: fetchedData.bio,
                        avatar_url: fetchedData.avatar_url || fetchedData.avatarUrl,
                        twitter_handle: fetchedData.twitter_handle || fetchedData.twitterHandle,
                        discord_handle: fetchedData.discord_handle || fetchedData.discordHandle,
                        telegram_handle: fetchedData.telegram_handle || fetchedData.telegramHandle,
                        farcaster_handle: fetchedData.farcaster_handle || fetchedData.farcasterHandle
                    };
                    console.log('✅ [Dashboard] Profile found by address:', userProfile?.username)
                } else {
                    userProfile = {
                        wallet_address: targetUsernameOrAddress.toLowerCase(),
                        username: "New User",
                        bio: "You haven't set up your profile yet. Click settings to get started!"
                    };
                    console.log('✅ [Dashboard] New user detected (address)')
                }
                userWallet = targetUsernameOrAddress.toLowerCase();
                
            } else {
                console.log('[Dashboard] Fetching profile by username:', targetUsernameOrAddress)
                const profRes = await fetch(`${backendUrl}/api/profile/user/${targetUsernameOrAddress}?t=${Date.now()}`);
                const profData = await profRes.json();
                
                if (profData.success && profData.profile) {
                    userProfile = profData.profile;
                    userWallet = profData.profile.wallet_address;
                    console.log('✅ [Dashboard] Profile found by username:', userProfile?.username)
                } else {
                    console.log('❌ [Dashboard] Username not found')
                    setProfile(null);
                    setInitialLoadComplete(true);
                    setLoading(false);
                    return;
                }
            }

            // STEP 2: Set profile
            setProfile(userProfile);

            // STEP 3: Fetch user's faucets
            if (userWallet) {
                console.log('[Dashboard] Fetching faucets for wallet:', userWallet.slice(0, 8))
                // NEW (replace with this):
                const metaList = await fetchOwnerFaucetsMeta(supabase, userWallet);
                const detailMap = await fetchOwnerFaucetsDetails(supabase, metaList.map((m: any) => m.faucetAddress));

                const enrichedFaucets: FaucetData[] = metaList.map((meta: any) => {
                const row = detailMap[meta.faucetAddress.toLowerCase()];
                const chainNetwork = networks.find((n) => n.chainId === (meta as any).chainId);

                if (row) {
                    return {
                    faucetAddress: row.faucet_address,
                    name:          row.faucet_name,
                    slug:          row.slug || meta.slug,
                    tokenSymbol:   row.token_symbol || (row.is_ether ? getNativeTokenSymbol(chainNetwork?.name || "Ethereum") : "TOK"),
                    tokenDecimals: row.token_decimals ?? 18,
                    isEther:       row.is_ether,
                    claimAmount:   row.claim_amount ? BigInt(row.claim_amount) : undefined,
                    startTime:     row.start_time,
                    endTime:       row.end_time,
                    isClaimActive: row.is_claim_active,
                    token:         row.token_address,
                    network:       chainNetwork,
                    createdAt:     row.start_time,
                    description:   row.description,
                    imageUrl:      row.image_url || "/default.jpeg",
                    owner:         row.owner_address,
                    factoryAddress: row.factory_address || meta.factoryAddress,
                    faucetType:    meta.factoryType || "dropcode",
                    chainId:       (meta as any).chainId,
                    } as FaucetData & { chainId: number };
                }

                // Fallback to meta only
                return {
                    faucetAddress: meta.faucetAddress,
                    name:          meta.name,
                    slug:          meta.slug,
                    tokenSymbol:   meta.tokenSymbol || (meta.isEther ? getNativeTokenSymbol(chainNetwork?.name || "Ethereum") : "TOK"),
                    tokenDecimals: 18,
                    isEther:       meta.isEther,
                    isClaimActive: meta.isClaimActive,
                    network:       chainNetwork,
                    createdAt:     meta.createdAt,
                    owner:         meta.owner,
                    factoryAddress: meta.factoryAddress,
                    imageUrl:      "/default.jpeg",
                    faucetType:    meta.factoryType || "dropcode",
                    chainId:       (meta as any).chainId,
                } as FaucetData & { chainId: number };
                });

                setFaucets(enrichedFaucets);

                // STEP 4: Fetch published quests
                console.log('[Dashboard] Fetching quests...')
                const questRes = await fetch(`${backendUrl}/api/quests?t=${Date.now()}`);
                const qData = await questRes.json();
                
                if (qData.success) {
                    const myQuests = qData.quests
                        .filter((q: any) => q.creatorAddress?.toLowerCase() === userWallet!.toLowerCase())
                        .map((q: any) => ({
                            ...q,
                            slug: q.slug || q.faucetAddress, 
                            faucetAddress: q.faucetAddress
                        }));
                    
                    const published = myQuests.filter((q: any) => !q.isDraft).map((q: any) => ({
                            ...q,
                            isDemo: q.faucetAddress?.startsWith("draft-") || q.faucetAddress?.startsWith("demo-")
                        }));
                    console.log('[Dashboard] Published quests loaded:', published.length)
                    setPublishedQuests(published);
                }

                // STEP 5: Fetch drafts (only if owner)
                const isOwnerView = connectedAddress && userWallet.toLowerCase() === connectedAddress.toLowerCase();
                if (isOwnerView) {
                    console.log('[Dashboard] Fetching drafts...')
                    try {
                        const draftRes = await fetch(`${backendUrl}/api/quests/drafts/${userWallet}?t=${Date.now()}`);
                        if (draftRes.ok) {
                            const dData = await draftRes.json();
                            if (dData.success) {
                                const formattedDrafts = dData.drafts.map((d: any) => ({
                                    ...d,
                                    faucetAddress: d.faucet_address, 
                                    creatorAddress: d.creator_address,
                                    imageUrl: d.image_url,
                                    title: d.title,
                                    description: d.description,
                                    isDemo: !d.is_subscribed  // flag demo drafts from unsubscribed creators
                                }));
                                console.log('[Dashboard] Drafts loaded:', formattedDrafts.length)
                                setDraftQuests(formattedDrafts);
                            }
                        }
                    } catch (err) {
                        console.log('[Dashboard] No drafts found:', err);
                    }
                }

                // 👇 STEP 6: Fetch Quizzes
                console.log('[Dashboard] Fetching quizzes...')
                try {
                    const quizRes = await fetch(`${backendUrl}/api/quiz/list?t=${Date.now()}`);
                    const quizData = await quizRes.json();
                    
                    if (quizData.success && quizData.quizzes) {
                        const myQuizzes = quizData.quizzes.filter(
                            (q: QuizData) => q.creatorAddress?.toLowerCase() === userWallet!.toLowerCase()
                        );
                        setUserQuizzes(myQuizzes);
                        setQuizCount(myQuizzes.length);
                        console.log('[Dashboard] Quizzes loaded:', myQuizzes.length)
                    }
                } catch (err) {
                    console.log('[Dashboard] Error fetching quizzes:', err);
                }
            }
            
            setInitialLoadComplete(true);
            
        } catch (error) {
            console.error("❌ [Dashboard] Load error:", error);
            toast({ title: "Failed to load dashboard", variant: "destructive" });
            setInitialLoadComplete(true);
        } finally {
            setLoading(false);
        }
    }, [targetUsernameOrAddress, connectedAddress, backendUrl, toast]);
    // STEP 6: Trigger data fetch on mount and when params change
    useEffect(() => {
        if (!targetUsernameOrAddress) {
            console.log('[Dashboard] No username/address provided')
            return;
        }
        
        // Reset state when username changes
        setInitialLoadComplete(false);
        setProfile(null);
        setFaucets([]);
        setPublishedQuests([]);
        setDraftQuests([]);
        
        fetchData();
    }, [targetUsernameOrAddress, fetchData]);

    // Helpers
    const getNetworkName = (id: number) => networks.find(n => n.chainId === id)?.name || `Chain ${id}`;
    const getNetworkColor = (id: number) => networks.find(n => n.chainId === id)?.color || "#64748b";
    
    const getSocialUrl = (platform: string, handle: string) => {
        const cleanHandle = handle.replace('@', '').trim();
        switch (platform) {
            case 'twitter': return `https://x.com/${cleanHandle}`;
            case 'telegram': return `https://t.me/${cleanHandle}`;
            case 'farcaster': return `https://farcaster.xyz/${cleanHandle}`;
            default: return '#';
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast({ title: "Copied to clipboard" });
    };

    const filteredFaucets = useMemo(() => {
        return faucets.filter(f => {
            const matchesSearch = f.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                f.faucetAddress.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesNetwork = networkFilter === "all" || f.chainId.toString() === networkFilter;
            return matchesSearch && matchesNetwork;
        });
    }, [faucets, searchQuery, networkFilter]);

    // Loading state
    if (loading && !initialLoadComplete) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center">
               <Loading/>
            </div>
        );
    }

    if (!profile && initialLoadComplete) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center">
                <p className="text-xl font-semibold mb-2">User not found</p>
                <p className="text-muted-foreground">The profile you're looking for doesn't exist.</p>
                <Button onClick={() => router.push('/')} className="mt-4">Go Home</Button>
            </div>
        );
    }

    if (!profile) return null;

    const displayAddress = profile.wallet_address ? 
        `${profile.wallet_address.slice(0,6)}...${profile.wallet_address.slice(-4)}` : "";

    return (
        <main className="min-h-screen bg-background pb-20 relative overflow-x-hidden">
            <div className="container mx-auto px-4 py-8 relative z-10 max-w-7xl">
                <Header 
                    pageTitle={isOwner ? "My Dashboard" : `${profile.username}'s Space`} 
                    hideAction={true} 
                />

                {/* --- 1. USER IDENTITY SECTION --- */}
                <div className="mb-10">
                    <Card className="border-none bg-gradient-to-r from-primary/5 via-primary/10 to-background shadow-sm">
                        <CardContent className="p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center gap-6 relative">
                            {/* Embedded Wallet - Top Right Corner on Mobile */}
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
                                    {isOwner && !isVerified && <VerifyPill onClick={() => setIsVerifyModalOpen(true)} />}
                                    {isVerified && <VerifiedBadge />}
                                    <div className="flex gap-2 flex-wrap justify-center sm:justify-start">
                                        {/* Twitter / X */}
                                        {profile?.twitter_handle && (
                                            <a href={getSocialUrl('twitter', profile.twitter_handle)} target="_blank" rel="noopener noreferrer" className="no-underline">
                                                <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-100 gap-1.5 pl-2 pr-2.5 cursor-pointer">
                                                    <XIcon className="h-3 w-3" /> {profile.twitter_handle.replace('@', '')}
                                                </Badge>
                                            </a>
                                        )}

                                        {/* Discord */}
                                        {profile?.discord_handle && (
                                            <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-100 gap-1.5 pl-2 pr-2.5">
                                                Discord: {profile.discord_handle}
                                            </Badge>
                                        )}

                                        {/* Telegram */}
                                        {profile?.telegram_handle && (
                                            <a href={getSocialUrl('telegram', profile.telegram_handle)} target="_blank" rel="noopener noreferrer" className="no-underline">
                                                <Badge variant="secondary" className="bg-sky-50 text-sky-700 hover:bg-sky-100 border-sky-100 gap-1.5 pl-2 pr-2.5 cursor-pointer">
                                                    Telegram: @{profile.telegram_handle}
                                                </Badge>
                                            </a>
                                        )}

                                        {/* Farcaster */}
                                        {profile?.farcaster_handle && (
                                            <a href={getSocialUrl('farcaster', profile.farcaster_handle)} target="_blank" rel="noopener noreferrer" className="no-underline">
                                                <Badge variant="secondary" className="bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-100 gap-1.5 pl-2 pr-2.5 cursor-pointer">
                                                    Farcaster: @{profile.farcaster_handle}
                                                </Badge>
                                            </a>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 text-muted-foreground font-mono text-sm">
                                    <Wallet className="h-4 w-4" />
                                    <span>{displayAddress}</span>
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(profile.wallet_address)}>
                                        <Copy className="h-3 w-3" />
                                    </Button>
                                </div>

                                <p className="text-sm text-muted-foreground max-w-2xl line-clamp-2">
                                    {profile.bio || "No bio set yet."}
                                </p>
                            </div>

                            {/* STATS SECTION */}
                            <div className="flex items-center gap-6 bg-background/50 p-4 rounded-xl border self-start md:self-center w-full md:w-auto justify-around md:justify-start">
                                <div className="text-center">
                                    <div className="text-2xl font-bold">{faucets.length}</div>
                                    <div className="text-xs text-muted-foreground uppercase font-semibold">Faucets</div>
                                </div>
                                <div className="h-10 w-[1px] bg-border" />
                                <div className="text-center">
                                    <div className="text-2xl font-bold">{publishedQuests.length}</div> 
                                    <div className="text-xs text-muted-foreground uppercase font-semibold">Quests</div>
                                </div>
                                <div className="h-10 w-[1px] bg-border" />
                                <div className="text-center">
                                    <div className="text-2xl font-bold">{quizCount}</div> 
                                    <div className="text-xs text-muted-foreground uppercase font-semibold">Quizzes</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* --- 2. ACTION BAR & TABS --- */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                    <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg">
                        <button 
                            onClick={() => setActiveTab('faucets')}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'faucets' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Faucets ({faucets.length})
                        </button>
                        <button 
                            onClick={() => setActiveTab('quests')}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'quests' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Quests ({publishedQuests.length})
                        </button>
                        <button 
                            onClick={() => setActiveTab('quizzes')}
                            className={`px-4 py-2 text-sm font-medium whitespace-nowrap rounded-md transition-all ${activeTab === 'quizzes' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Quizzes ({quizCount})
                        </button>
                    </div>

                    {isOwner && (
                        <div className="flex gap-3 w-full md:w-auto">
                            {/* Mobile - Only show action buttons (wallet is in profile section) */}
                            <div className="md:hidden flex gap-3 w-full">
                                <MyCreationsModal faucets={faucets} address={connectedAddress!} />
                                <CreateNewModal onSuccess={fetchData} />
                            </div>
                            
                            {/* Desktop - Show all buttons including wallet */}
                            <div className="hidden md:flex gap-3 flex-wrap">
                                <EmbeddedWalletControlProduction /> 
                                <MyCreationsModal faucets={faucets} address={connectedAddress!} />
                                <CreateNewModal onSuccess={fetchData} />
                            </div>
                        </div>
                    )}
                </div>

                {/* --- 3. MAIN CONTENT --- */}
                
                {/* TAB: FAUCETS */}
                {activeTab === 'faucets' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                         <div className="flex flex-col sm:flex-row gap-4 mb-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input placeholder="Search faucets..." className="pl-9" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                            </div>
                            <Select value={networkFilter} onValueChange={setNetworkFilter}>
                                <SelectTrigger className="w-full sm:w-[180px]">
                                    <SelectValue placeholder="All Networks" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Networks</SelectItem>
                                    {networks.map(n => <SelectItem key={n.chainId} value={n.chainId.toString()}>{n.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-4"}>
                            {filteredFaucets.length > 0 ? filteredFaucets.map((faucet) => (
                                <FaucetCard 
                                    key={faucet.faucetAddress} 
                                    faucet={faucet} 
                                    getNetworkName={getNetworkName}
                                    getNetworkColor={getNetworkColor}
                                    onManage={() => router.push(
                                        faucet.slug
                                            ? `/faucet/${faucet.slug}`
                                            : `/faucet/${faucet.faucetAddress}?networkId=${faucet.chainId}`
                                        )}
                                    isOwner={isOwner}
                                />
                            )) : (
                                <div className="col-span-full text-center py-10 text-muted-foreground">No faucets found matching your filters.</div>
                            )}
                        </div>
                    </div>
                )}

                {/* TAB: QUESTS */}
                {activeTab === 'quests' && (
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
                                            onClick={() => router.push(`/quest/${quest.slug || quest.faucetAddress}`)}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8">No published quests yet.</div>
                            )}
                        </div>
                
                        {/* Section: Drafts (Only for Owner) */}
                        {isOwner && (
                            <div>
                                <div className="flex items-center gap-3 mb-4">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">
                                        <PencilRuler className="h-5 w-5 text-orange-500" /> Drafts
                                    </h3>
                                    <Badge variant="outline" className="border-orange-200 text-orange-600 bg-orange-50">{draftQuests.length}</Badge>
                                </div>
                                
                                {draftQuests.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {draftQuests.map((quest) => (
                                            <QuestCard 
                                                key={quest.faucetAddress} 
                                                quest={quest} 
                                                type="draft"
                                                onClick={() => router.push(`/quest/create-quest?draftId=${quest.faucetAddress}${quest.isDemo ? '&demo=true' : ''}`)}
                                                onDelete={(quest) => {
                                                    setDeleteDialog({ open: true, quest })
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
                        {/* TAB: QUIZZES */}
                {activeTab === 'quizzes' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div>
                            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                🧠 Created Quizzes
                            </h3>
                            {userQuizzes.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {userQuizzes.map((quiz) => (
                                        <QuizCard 
                                            key={quiz.code} 
                                            quiz={quiz} 
                                            onClick={() => router.push(`/quiz/${quiz.code}`)} // Adjust to your actual quiz URL route
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 border border-dashed rounded-lg bg-muted/10 text-muted-foreground">
                                    No quizzes created yet.
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
            <Dialog open={deleteDialog.open} onOpenChange={(open) => { setDeleteDialog({ open, quest: open ? deleteDialog.quest : null }); setDeleteConfirmInput("") }}>
    <DialogContent>
        <DialogHeader>
            <DialogTitle>Delete Draft</DialogTitle>
            <DialogDescription>
                This action cannot be undone. Type the quest name below to confirm deletion.
            </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
            <p className="text-sm font-medium text-foreground">
                Quest name: <span className="font-bold text-destructive">{deleteDialog.quest?.title || "Untitled Quest"}</span>
            </p>
            <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Type the quest name to confirm</Label>
                <Input
                    placeholder={deleteDialog.quest?.title || "Untitled Quest"}
                    value={deleteConfirmInput}
                    onChange={e => setDeleteConfirmInput(e.target.value)}
                />
            </div>
        </div>
        <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteDialog({ open: false, quest: null }); setDeleteConfirmInput("") }}>
                Cancel
            </Button>
            <Button
                variant="destructive"
                disabled={deleteConfirmInput !== (deleteDialog.quest?.title || "Untitled Quest")}
                onClick={() => handleDeleteDraft()}
            >
                <Trash2 className="h-4 w-4 mr-2" /> Delete Draft
            </Button>
        </DialogFooter>
    </DialogContent>
</Dialog>
        </main>
    )
}

// --- SUB-COMPONENTS (unchanged) ---

function FaucetCard({ faucet, getNetworkName, getNetworkColor, onManage, isOwner }: any) {
    const networkName = getNetworkName(faucet.chainId)
    const networkColor = getNetworkColor(faucet.chainId)
    return (
        <Card className="hover:shadow-md transition-all group cursor-pointer flex flex-col">
            {/* Square image header */}
            <div className="relative aspect-square w-full bg-muted overflow-hidden rounded-t-lg">
                {faucet.imageUrl ? (
                    <img src={faucet.imageUrl} alt={faucet.name} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-primary/5">
                        <span className="text-primary/30 text-4xl font-bold uppercase">{faucet.name?.charAt(0) || "F"}</span>
                    </div>
                )}
                <Badge className="absolute top-2 right-2 capitalize text-xs" variant="secondary">
                    {faucet.faucetType}
                </Badge>
            </div>
            <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                    <Badge variant="outline" className="mb-2 bg-background" style={{ borderColor: networkColor, color: networkColor }}>
                        <span className="w-1.5 h-1.5 rounded-full mr-1.5" style={{ backgroundColor: networkColor }}></span>
                        {networkName}
                    </Badge>
                    
                </div>
                <CardTitle className="truncate text-lg">{faucet.name}</CardTitle>
                <CardDescription className="font-mono text-xs flex items-center gap-2 mt-1">
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
// --- NEW QUIZ CARD COMPONENT ---
function QuizCard({ quiz, onClick }: { quiz: QuizData; onClick: () => void }) {
    return (
        <Card className="hover:shadow-md transition-all group cursor-pointer flex flex-col" onClick={onClick}>
            <div className="relative aspect-square w-full bg-muted overflow-hidden rounded-t-lg">
                {quiz.coverImageUrl ? (
                    <img src={quiz.coverImageUrl} alt={quiz.title} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                        <span className="text-primary/40 text-4xl font-bold uppercase">{quiz.title?.charAt(0) || "Q"}</span>
                    </div>
                )}
                <Badge 
                    className="absolute top-2 right-2 capitalize" 
                    variant={quiz.status === 'active' ? 'default' : quiz.status === 'finished' ? 'secondary' : 'outline'}
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
                    {quiz.description || "No description provided."}
                </p>
                
                <div className="mt-auto flex justify-between items-center text-xs text-muted-foreground border-t pt-3">
                    <div className="flex items-center gap-1 font-medium">
                        <span className="text-primary">Players: {quiz.playerCount}</span>
                        {quiz.maxParticipants > 0 && <span>/ {quiz.maxParticipants}</span>}
                    </div>
                    <span>
                        {quiz.createdAt ? new Date(quiz.createdAt).toLocaleDateString() : ""}
                    </span>
                </div>
            </CardContent>
        </Card>
    )
}
interface QuestCardProps {
    quest: QuestData;
    type: 'published' | 'draft';
    onClick: () => void;
   onDelete?: (quest: QuestData) => void;
}

function QuestCard({ quest, type, onClick, onDelete }: QuestCardProps) {
    return (
        <Card className={`hover:shadow-md transition-all group ${type === 'draft' ? 'border-dashed border-orange-200 bg-orange-50/10' : ''}`}>
           <div className="relative aspect-square w-full bg-muted overflow-hidden rounded-t-lg cursor-pointer" onClick={onClick}>
            {quest.imageUrl && (
                <img src={quest.imageUrl} alt={quest.title} className="w-full h-full object-cover" />
            )}
               <div className="absolute top-2 right-2 flex gap-1">
                    <Badge variant={type === 'draft' ? "outline" : "default"}>
                        {type === 'draft' ? 'Draft' : 'Published'}
                    </Badge>
                    {(quest.isDemo || quest.faucetAddress?.startsWith("draft-") || quest.faucetAddress?.startsWith("demo-")) && (
                        <Badge className="bg-amber-500 text-white border-0">Demo</Badge>
                    )}
                </div>
            </div>
            <CardContent className="p-4">
                <h4 className="font-bold truncate text-base mb-1">{quest.title || "Untitled Quest"}</h4>
                <p className="text-sm text-muted-foreground line-clamp-2 h-10 mb-3">
                    {quest.description || "No description provided."}
                </p>
                
                <div className="flex gap-2">
                    <Button 
                        variant={type === 'draft' ? "outline" : "default"} 
                        size="sm" 
                        className="flex-1" 
                        onClick={onClick}
                    >
                        {type === 'draft' ? (
                            <><PencilRuler className="h-3 w-3 mr-2" /> Continue Editing</>
                        ) : (
                            <><ScrollText className="h-3 w-3 mr-2" /> View Quest</>
                        )}
                    </Button>
                    
                    {type === 'draft' && onDelete && (
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="px-2" 
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete(quest);
                            }}
                        >
                            <Trash2 className="h-3 w-3 text-red-500" />
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}