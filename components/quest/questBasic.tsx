// components/quest/questBasic.tsx
"use client"

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { toast } from 'sonner'
import {
    Upload, Loader2, Trash2, Check, AlertTriangle, Coins, Settings, Save,
    Plus, Minus, DollarSign, Wallet, Users, Trophy, Medal, Award, Star
} from "lucide-react"

import { useWallet } from "@/hooks/use-wallet"
import { ZeroAddress, isAddress as ethersIsAddress } from 'ethers'
import { type Network } from "@/lib/faucet"

// ==== CONFIG ====
const API_BASE_URL = "https://faucetdrop-backend.onrender.com"

const networks: Network[] = [
    {
        name: "Celo", symbol: "CELO", chainId: BigInt(42220), rpcUrl: "https://forno.celo.org", blockExplorer: "https://celoscan.io", color: "#35D07F", logoUrl: "/celo.png", iconUrl: "/celo.png", explorerUrl: "https://celoscan.io",
        factoryAddresses: ["0x17cFed7fEce35a9A71D60Fbb5CA52237103A21FB", "0x8cA5975Ded3B2f93E188c05dD6eb16d89b14aeA5"],
        factories: { custom: "0x8cA5975Ded3B2f93E188c05dD6eb16d89b14aeA5" }, tokenAddress: "0x471EcE3750Da237f93B8E339c536989b8978a438", nativeCurrency: { name: "Celo", symbol: "CELO", decimals: 18 }, isTestnet: false,
    },
    {
        name: "Lisk", symbol: "LSK", chainId: BigInt(1135), rpcUrl: "https://rpc.api.lisk.com", blockExplorer: "https://blockscout.lisk.com", explorerUrl: "https://blockscout.lisk.com", color: "#0D4477", logoUrl: "/lsk.png", iconUrl: "/lsk.png",
        factoryAddresses: ["0x21E855A5f0E6cF8d0CfE8780eb18e818950dafb7"],
        factories: { custom: "0x21E855A5f0E6cF8d0CfE8780eb18e818950dafb7" }, tokenAddress: ZeroAddress, nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, isTestnet: false,
    },
    {
        name: "Arbitrum", symbol: "ARB", chainId: BigInt(42161), rpcUrl: "https://arb1.arbitrum.io/rpc", blockExplorer: "https://arbiscan.io", explorerUrl: "https://arbiscan.io", color: "#28A0F0", logoUrl: "/arb.jpeg", iconUrl: "/arb.jpeg",
        factoryAddresses: ["0x9D6f441b31FBa22700bb3217229eb89b13FB49de"],
        factories: { custom: "0x9D6f441b31FBa22700bb3217229eb89b13FB49de" }, tokenAddress: ZeroAddress, nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, isTestnet: false,
    },
    {
        name: "Base", symbol: "BASE", chainId: BigInt(8453), rpcUrl: "https://base.publicnode.com", blockExplorer: "https://basescan.org", explorerUrl: "https://basescan.org", color: "#0052FF", logoUrl: "/base.png", iconUrl: "/base.png",
        factoryAddresses: ["0x587b840140321DD8002111282748acAdaa8fA206"],
        factories: { custom: "0x587b840140321DD8002111282748acAdaa8fA206" }, tokenAddress: ZeroAddress, nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, isTestnet: false,
    },
    {
        name: "Bnb", symbol: "BNB", chainId: BigInt(56), rpcUrl: "https://binance.llamarpc.com", blockExplorer: "https://bscscan.com", explorerUrl: "https://bscscan.com", color: "#F3BA2F",
        logoUrl: "/bnb.png", iconUrl: "/bnb.png", factoryAddresses: ["0x587b840140321DD8002111282748acAdaa8fA206"], factories: { custom: "0x587b840140321DD8002111282748acAdaa8fA206" }, tokenAddress: ZeroAddress, nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 }, isTestnet: false,
    }
]

const ALL_TOKENS_BY_CHAIN: Record<number, TokenConfiguration[]> = {
    42220: [
        { address: "0x471EcE3750Da237f93B8E339c536989b8978a438", name: "Celo", symbol: "CELO", decimals: 18, isNative: true, logoUrl: "/celo.jpeg", description: "Native Celo token" },
        { address: "0x765DE816845861e75A25fCA122bb6898B8B1282a", name: "Celo Dollar", symbol: "cUSD", decimals: 18, logoUrl: "/cusd.png", description: "USD-pegged stablecoin on Celo" },
        { address: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e", name: "Tether", symbol: "USDT", decimals: 6, logoUrl: "/usdt.jpg", description: "Tether USD stablecoin" },
        { address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C", name: "USD Coin", symbol: "USDC", decimals: 6, logoUrl: "/usdc.jpg", description: "USD Coin stablecoin" },
    ],
    1135: [
        { address: ZeroAddress, name: "Ethereum", symbol: "ETH", decimals: 18, isNative: true, logoUrl: "/ether.jpeg", description: "Native Ethereum" },
        { address: "0xac485391EB2d7D88253a7F1eF18C37f4242D1A24", name: "Lisk", symbol: "LSK", decimals: 18, logoUrl: "/lsk.png", description: "Lisk native token" },
    ],
    42161: [
        { address: ZeroAddress, name: "Ethereum", symbol: "ETH", decimals: 18, isNative: true, logoUrl: "/ether.jpeg", description: "Native Ethereum" },
        { address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", name: "USD Coin", symbol: "USDC", decimals: 6, logoUrl: "/usdc.jpg", description: "Native USD Coin" },
    ],
    8453: [
        { address: ZeroAddress, name: "Ethereum", symbol: "ETH", decimals: 18, isNative: true, logoUrl: "/ether.jpeg", description: "Native Ethereum" },
        { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", name: "USD Coin", symbol: "USDC", decimals: 6, logoUrl: "/usdc.jpg", description: "Native USD Coin" },
    ],
    56: [
        { address: ZeroAddress, name: "BNB", symbol: "BNB", decimals: 18, isNative: true, logoUrl: "/bnb.png", description: "Native BNB for transaction fees" },
        { address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", name: "USD Coin", symbol: "USDC", decimals: 18, logoUrl: "/usdc.jpg", description: "Binance-Peg USD Coin" },
        { address: "0x55d398326f99059fF775485246999027B3197955", name: "Tether USD", symbol: "USDT", decimals: 18, logoUrl: "/usdt.jpg", description: "Binance-Peg BSC-USD" },
        { address: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56", name: "BUSD", symbol: "BUSD", decimals: 18, logoUrl: "/busd.png", description: "Binance-Peg BUSD Token" },
    ]
}

const COINGECKO_IDS: Record<string, string> = {
    "CELO": "celo",
    "cUSD": "celo-dollar",
    "USDT": "tether",
    "USDC": "usd-coin",
    "ETH": "ethereum",
    "LSK": "lisk",
    "BNB": "bnb",
    "BUSD": "binance-usd",
}

// ==== TYPES ====
export interface TokenConfiguration {
    address: string
    name: string
    symbol: string
    decimals: number
    isNative?: boolean
    logoUrl?: string
    description?: string
}

// ✅ NEW: one entry per rank position — replaces range-based tiers
export interface RankReward {
    rank: number    // 1-based rank position
    amount: number | string;
}

export interface DistributionConfig {
    model: 'equal' | 'custom_tiers' | 'quadratic'
    totalWinners: number
    tiers: RankReward[]  // length === totalWinners when model is custom_tiers
}

export interface QuestData {
    title: string
    description: string
    imageUrl: string
    rewardPool: string
    distributionConfig: DistributionConfig
    faucetAddress?: string
    rewardTokenType?: 'native' | 'erc20'
    tokenAddress?: string
    tokenSymbol?: string
    tasks: any[]
    // ADD THESE 4 LINES
    startDate?: string
    startTime?: string
    endDate?: string
    endTime?: string
}

// ==== UTILS ====
const isAddress = (addr: string) => {
    try { return ethersIsAddress(addr) } catch { return false }
}

// ✅ Shared helper used in both draft and finalize payloads
export const computeRewardPool = (
    distributionConfig: DistributionConfig,
    rawRewardPool: string
): number => {
    if (distributionConfig.model === 'custom_tiers') {
        return distributionConfig.tiers.reduce(
            // Safely parse the string to a float
            (sum, r) => sum + (parseFloat(String(r.amount)) || 0), 
            0
        )
    }
    return parseFloat(rawRewardPool || '0')
}

const buildRanks = (n: number, existing: RankReward[]): RankReward[] => {
    const existingMap = new Map(existing.map(r => [r.rank, r.amount]))
    return Array.from({ length: n }, (_, i) => ({
        rank: i + 1,
        amount: existingMap.get(i + 1) ?? "", // <--- Default to empty string instead of 0
    }))
}

const examplePoints = [10000, 8100, 6400, 4900, 3600]
const weights = examplePoints.map(p => Math.sqrt(p))
const totalWeight = weights.reduce((a, b) => a + b, 0)

// ==== RANK STYLING HELPERS ====
const RANK_ICONS: Record<number, React.ReactNode> = {
    1: <Trophy className="h-4 w-4 text-yellow-400" />,
    2: <Medal className="h-4 w-4 text-slate-400" />,
    3: <Award className="h-4 w-4 text-amber-600" />,
}
const getRankIcon = (rank: number) =>
    RANK_ICONS[rank] ?? <Star className="h-3.5 w-3.5 text-muted-foreground/40" />

const getRankLabel = (rank: number) => {
    if (rank === 1) return "1st Place"
    if (rank === 2) return "2nd Place"
    if (rank === 3) return "3rd Place"
    return `${rank}th Place`
}

const getRankRowStyle = (rank: number) => {
    if (rank === 1) return "border-yellow-400/40 bg-yellow-400/5"
    if (rank === 2) return "border-slate-400/40 bg-slate-400/5"
    if (rank === 3) return "border-amber-600/40 bg-amber-600/5"
    return "border-border/50 bg-muted/10"
}

// ==== IMAGE UPLOAD COMPONENT ====
const ImageUploadField: React.FC<{
    imageUrl: string
    onImageUrlChange: (url: string) => void
    onFileUpload: (file: File) => Promise<void>
    isUploading: boolean
    uploadError: string | null
    requiredResolution?: { width: number; height: number }
}> = ({ imageUrl, onImageUrlChange, onFileUpload, isUploading, uploadError, requiredResolution }) => {
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [resolutionError, setResolutionError] = useState<string | null>(null)

    const maxWidth = requiredResolution?.width || 1024
    const maxHeight = requiredResolution?.height || 1024
    const isPlaceholder = !imageUrl || imageUrl.includes('placehold.co')

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setResolutionError(null)
        if (file.size > 5 * 1024 * 1024) {
            setResolutionError("File size exceeds 5MB limit.")
            if (fileInputRef.current) fileInputRef.current.value = ""
            return
        }
        const reader = new FileReader()
        reader.onload = (ev) => {
            setPreviewUrl(ev.target?.result as string)
            onFileUpload(file)
        }
        reader.readAsDataURL(file)
    }
    const handleRemove = () => {
        onImageUrlChange("")
        setPreviewUrl(null)
        setResolutionError(null)
        if (fileInputRef.current) fileInputRef.current.value = ""
    }

    const shouldShowPreview = (!isPlaceholder) || previewUrl || uploadError || resolutionError

    return (
        <div className="space-y-2">
            <Label>Quest Image/Logo (Max 5MB, Recommended: {maxWidth}x{maxHeight} Square)</Label>
            <div className="flex items-center space-x-3">
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="flex-grow"
                >
                    {isUploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                    {isUploading ? "Uploading..." : (!isPlaceholder ? "Change Image" : "Upload Image")}
                </Button>
                {!isPlaceholder && (
                    <Button type="button" variant="destructive" size="icon" onClick={handleRemove} disabled={isUploading}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                )}
                <Input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </div>
            {shouldShowPreview && (
                <div className="flex items-start space-x-3 mt-2 border p-3 rounded-lg bg-slate-50 dark:bg-gray-800 animate-in fade-in zoom-in duration-200">
                    <div className="h-16 w-16 rounded-lg overflow-hidden border bg-gray-100 dark:bg-gray-700 flex-shrink-0">
                        {(previewUrl || !isPlaceholder) ? (
                            <img src={previewUrl || imageUrl} alt="Preview" className="h-full w-full object-cover" />
                        ) : (
                            <div className="h-full w-full flex items-center justify-center text-[10px] text-muted-foreground text-center p-1">No Image</div>
                        )}
                    </div>
                    <div className="flex-grow pt-1">
                        {resolutionError || uploadError ? (
                            <p className="text-xs text-red-500 font-medium flex items-center gap-1">
                                <AlertTriangle className="h-3.5 w-3.5" />{resolutionError || uploadError}
                            </p>
                        ) : !isPlaceholder ? (
                            <p className="text-xs text-green-600 font-medium flex items-center gap-1">
                                <Check className="h-3.5 w-3.5" />Ready for quest
                            </p>
                        ) : null}
                    </div>
                </div>
            )}
        </div>
    )
}

// ==== PHASE 1 PROPS ====
interface Phase1Props<T extends QuestData> {
    newQuest: T
    setNewQuest: React.Dispatch<React.SetStateAction<T>>
    selectedToken: TokenConfiguration | null
    setSelectedToken: React.Dispatch<React.SetStateAction<TokenConfiguration | null>>
    nameError: string | null
    setNameError: React.Dispatch<React.SetStateAction<string | null>>
    isCheckingName: boolean
    setIsCheckingName: React.Dispatch<React.SetStateAction<boolean>>
    isUploadingImage: boolean
    setIsUploadingImage: React.Dispatch<React.SetStateAction<boolean>>
    uploadImageError: string | null
    setUploadImageError: React.Dispatch<React.SetStateAction<string | null>>
    handleImageUpload: (file: File) => Promise<void>
    onDraftSaved: (faucetAddress: string) => void
    isSavingDraft: boolean
    setIsSavingDraft: React.Dispatch<React.SetStateAction<boolean>>
    setError: React.Dispatch<React.SetStateAction<string | null>>
}

// ==== PHASE 1 COMPONENT ====
export default function Phase1QuestDetailsRewards<T extends QuestData>({
    newQuest,
    setNewQuest,
    selectedToken,
    setSelectedToken,
    nameError,
    setNameError,
    isCheckingName,
    setIsCheckingName,
    isUploadingImage,
    setIsUploadingImage,
    uploadImageError,
    setUploadImageError,
    handleImageUpload,
    onDraftSaved,
    isSavingDraft,
    setIsSavingDraft,
    setError
}: Phase1Props<T>) {
    const { address, isConnected, chainId } = useWallet()
    const network = useMemo(() => networks.find(n => n.chainId === BigInt(chainId || 0)) || null, [chainId])
    const availableTokens = chainId ? ALL_TOKENS_BY_CHAIN[Number(chainId)] || [] : []

    const [isCustomToken, setIsCustomToken] = useState(false)
    const [customTokenAddress, setCustomTokenAddress] = useState('')
    const nameCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    const [tokenPrice, setTokenPrice] = useState<number>(0)
    const [isFetchingPrice, setIsFetchingPrice] = useState(false)

    // ── Price fetch ──────────────────────────────────────────────────────────
    const fetchTokenPrice = async (symbol: string) => {
        setIsFetchingPrice(true)
        try {
            const coingeckoId = COINGECKO_IDS[symbol] || "ethereum"
            const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoId}&vs_currencies=usd`)
            const data = await res.json()
            setTokenPrice(data[coingeckoId]?.usd ?? 0)
        } catch {
            setTokenPrice(0)
        } finally {
            setIsFetchingPrice(false)
        }
    }

    useEffect(() => {
        if (selectedToken) fetchTokenPrice(selectedToken.symbol)
    }, [selectedToken])

    // ── Derived pool amounts ─────────────────────────────────────────────────
    // ✅ Always use computeRewardPool so custom_tiers is handled correctly
    const poolAmount = computeRewardPool(newQuest.distributionConfig, newQuest.rewardPool)
    const poolUsdValue = poolAmount * tokenPrice

    // ── Name check ───────────────────────────────────────────────────────────
    const checkNameAvailabilityAPI = useCallback(async (nameToValidate: string) => {
        if (!nameToValidate.trim()) { setNameError(null); return }
        setIsCheckingName(true)
        setNameError(null)
        try {
            const response = await fetch(`${API_BASE_URL}/api/check-name?name=${encodeURIComponent(nameToValidate)}`)
            const data = await response.json()
            setNameError(data.exists ? `The name "${nameToValidate}" is already taken.` : null)
        } catch {
            // silent
        } finally {
            setIsCheckingName(false)
        }
    }, [setNameError, setIsCheckingName])

    const handleTitleChange = useCallback((value: string) => {
        setNewQuest(prev => ({ ...prev, title: value } as T));
        // Clear any previous error while the user is actively typing a new name
        if (nameError) setNameError(null); 
    }, [setNewQuest, nameError, setNameError]);

    const handleTitleBlur = useCallback(() => {
        const currentTitle = newQuest.title || "";
        // Trigger the check immediately when clicking outside the input
        if (currentTitle.trim().length >= 3) {
            checkNameAvailabilityAPI(currentTitle.trim());
        }
    }, [newQuest.title, checkNameAvailabilityAPI]);

    const titleSafe = newQuest.title || ""
    const titleLength = titleSafe.trim().length

    // ── equal/quadratic helpers ──────────────────────────────────────────────
    const getAmountPerWinner = () => {
        const total = parseFloat(newQuest.rewardPool || '0')
        const winners = newQuest.distributionConfig.totalWinners || 1
        if (!total || total <= 0) return '0'
        return (total / winners).toFixed(6)
    }

   // ── Phase 1 validity ─────────────────────────────────────────────────────
    const isPhase1Valid = useMemo(() => {
        const hasValidTitle = (newQuest.title || "").trim().length >= 3 && !nameError
        const hasImage = true
        const hasToken = !!selectedToken

        // 👇 NEW: Ensure no ranks are exactly 0 or empty when using custom tiers
        const isCustomTiersValid = newQuest.distributionConfig.model !== 'custom_tiers' || 
            !newQuest.distributionConfig.tiers.some(r => (parseFloat(String(r.amount)) || 0) <= 0)
        
        return hasValidTitle && hasImage && hasToken && isConnected && !isCheckingName && isCustomTiersValid 
    }, [newQuest.title, nameError, newQuest.imageUrl, selectedToken, isConnected, isCheckingName, newQuest.distributionConfig])

    // ── Distribution model change ────────────────────────────────────────────
    // ✅ FIX: Just swap the model. Preserve tiers so user can switch back safely.
    //         Reset rewardPool to "0" when entering custom_tiers so stale
    //         equal/quadratic values don't bleed into the payload.
    const handleModelChange = (v: DistributionConfig['model']) => {
        setNewQuest(prev => ({
            ...prev,
            rewardPool: v === 'custom_tiers' ? '0' : prev.rewardPool,
            distributionConfig: {
                ...prev.distributionConfig,
                model: v,
                // Tiers are NOT wiped — preserving them lets the user switch
                // back to custom_tiers without losing their rank data
            },
        } as T))
    }

    // ── custom_tiers: winner count change ────────────────────────────────────
    // ✅ Builds a correctly-sized tiers array, preserving existing amounts
    const handleWinnersChange = useCallback((value: number) => {
        const n = Math.max(1, Math.min(100, value || 1))

        if (newQuest.distributionConfig.model === 'custom_tiers') {
            // Rebuild rank rows, keeping existing amounts for unchanged ranks
            const newTiers = buildRanks(n, newQuest.distributionConfig.tiers)
            const newTotal = newTiers.reduce((sum, r) => sum + (parseFloat(String(r.amount)) || 0), 0)
            setNewQuest(prev => ({
                ...prev,
                rewardPool: newTotal.toString(),
                distributionConfig: { ...prev.distributionConfig, totalWinners: n, tiers: newTiers },
            } as T))
        } else {
            setNewQuest(prev => ({
                ...prev,
                distributionConfig: { ...prev.distributionConfig, totalWinners: n },
            } as T))
        }
    }, [newQuest.distributionConfig, setNewQuest])

    // ── custom_tiers: per-rank amount change ─────────────────────────────────
 
    const handleRankAmountChange = useCallback((rank: number, raw: string) => {
        // Store the exact raw string (e.g. "0.") so it doesn't get erased
        const updated = newQuest.distributionConfig.tiers.map(r =>
            r.rank === rank ? { ...r, amount: raw } : r
        )
        
        // Calculate the total by parsing the strings safely
        const newTotal = updated.reduce((sum, r) => sum + (parseFloat(String(r.amount)) || 0), 0)
        
        setNewQuest(prev => ({
            ...prev,
            rewardPool: newTotal.toString(),
            distributionConfig: { ...prev.distributionConfig, tiers: updated },
        } as T))
    }, [newQuest.distributionConfig, setNewQuest])

    // ── Initialise rank rows when entering custom_tiers for the first time ───
    useEffect(() => {
        if (
            newQuest.distributionConfig.model === 'custom_tiers' &&
            newQuest.distributionConfig.tiers.length !== newQuest.distributionConfig.totalWinners
        ) {
            const synced = buildRanks(
                newQuest.distributionConfig.totalWinners,
                newQuest.distributionConfig.tiers
            )
            const newTotal = synced.reduce((sum, r) => sum + (parseFloat(String(r.amount)) || 0), 0)
            setNewQuest(prev => ({
                ...prev,
                rewardPool: newTotal.toString(),
                distributionConfig: { ...prev.distributionConfig, tiers: synced },
            } as T))
        }
    }, [newQuest.distributionConfig.model, newQuest.distributionConfig.totalWinners])

    // ── Save draft ───────────────────────────────────────────────────────────
   // ── Save draft ───────────────────────────────────────────────────────────
    const handleSaveDraft = async () => {
        if (!address || !isConnected || !selectedToken || titleLength < 3 || nameError || !newQuest.imageUrl) {
            setError("Complete all required fields")
            return
        }

        // ✅ Always compute from source of truth — never trust raw rewardPool for custom_tiers
        const computedPool = computeRewardPool(newQuest.distributionConfig, newQuest.rewardPool)
        if (computedPool <= 0) {
            setError("Reward pool amount must be greater than zero.")
            return
        }

        // 👇 ADD THIS NEW CHECK 👇
        if (newQuest.distributionConfig.model === 'custom_tiers') {
            const hasZero = newQuest.distributionConfig.tiers.some(r => (parseFloat(String(r.amount)) || 0) <= 0);
            if (hasZero) {
                setError("All ranks must have a reward amount greater than 0.");
                return;
            }
        }

        setIsSavingDraft(true)
        try {
            const draftId = newQuest.faucetAddress || `draft-${crypto.randomUUID()}`

            // ADD THIS HELPER: Safely combine date and time into an ISO string if they exist
            const formatToISO = (dateStr?: string, timeStr?: string) => {
                if (!dateStr) return undefined;
                if (dateStr.includes("T")) return dateStr; // Already an ISO string from the DB
                const time = timeStr || "00:00";
                try {
                    return new Date(`${dateStr}T${time}`).toISOString();
                } catch {
                    return dateStr;
                }
            };
            const DEFAULT_QUEST_IMAGE = "https://placehold.co/1024x1024/1e293b/94a3b8?text=Quest"
            const DEFAULT_QUEST_DESCRIPTION = "Complete tasks to earn points and compete for rewards in this quest campaign."

            const payload = {
                creatorAddress: address,
                title: newQuest.title.trim(),
                description: newQuest.description?.trim() || DEFAULT_QUEST_DESCRIPTION,
                imageUrl: newQuest.imageUrl || DEFAULT_QUEST_IMAGE,
                rewardPool: computedPool.toString(),   // ✅ always correct
                rewardTokenType: selectedToken.isNative ? 'native' : 'erc20',
                tokenAddress: selectedToken.address,
                tokenSymbol: selectedToken.symbol,
                token_symbol: selectedToken.symbol,
                distributionConfig: newQuest.distributionConfig,
                faucetAddress: draftId,
                tasks: newQuest.tasks,
                // ADD THESE TWO LINES SO DATES ARE NOT LOST:
                startDate: formatToISO(newQuest.startDate, newQuest.startTime),
                endDate: formatToISO(newQuest.endDate, newQuest.endTime)
            }

            const res = await fetch(`${API_BASE_URL}/api/quests/draft`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })

            if (!res.ok) throw new Error(await res.text())

            toast.success("Draft saved successfully!")
            onDraftSaved(draftId)
            console.log("DRAFT PAYLOAD:", JSON.stringify(payload, null, 2))
        } catch (e: any) {
            setError(e.message || "Draft save failed")
        } finally {
            setIsSavingDraft(false)
        }
    }
    // ── Derived custom_tiers totals for the summary panel ───────────────────
    const customTiersTotal = useMemo(() =>
        newQuest.distributionConfig.tiers.reduce((sum, r) => sum + (parseFloat(String(r.amount)) || 0), 0),
        [newQuest.distributionConfig.tiers]
    )
    const highestRankAmount = useMemo(() =>
        Math.max(...newQuest.distributionConfig.tiers.map(r => parseFloat(String(r.amount)) || 0), 0),
        [newQuest.distributionConfig.tiers]
    )
    const hasZeroRanks = newQuest.distributionConfig.tiers.some(r => (parseFloat(String(r.amount)) || 0) <= 0)

    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="space-y-12 max-w-5xl mx-auto py-8">

            {/* ── Step 1: Basic Details ── */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Settings className="h-5 w-5" /> Step 1: Basic Quest Details
                    </CardTitle>
                    <CardDescription>The Title is used as the Faucet name.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Quest Title</Label>
                        <div className="relative">
                            <Input
                                value={titleSafe}
                                onChange={(e) => handleTitleChange(e.target.value)}
                                onBlur={handleTitleBlur}
                                placeholder="e.g. FaucetDrops Launch Campaign"
                                className={nameError ? "border-red-500 pr-10" : (!isCheckingName && titleLength >= 3 && !nameError) ? "border-green-500 pr-10" : "pr-10"}
                                disabled={isCheckingName}
                            />
                            {isCheckingName && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-500" />}
                            {!isCheckingName && titleLength >= 3 && (
                                nameError
                                    ? <AlertTriangle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-500" />
                                    : <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                            )}
                        </div>
                        {titleLength > 0 && titleLength < 3 && <p className="text-xs text-red-500">At least 3 characters</p>}
                        {nameError && titleLength >= 3 && <p className="text-xs text-red-500">{nameError}</p>}
                        {isCheckingName && <p className="text-xs text-blue-500">Checking availability...</p>}
                    </div>

                    <ImageUploadField
                        imageUrl={newQuest.imageUrl}
                        onImageUrlChange={(url) => setNewQuest(prev => ({ ...prev, imageUrl: url } as T))}
                        onFileUpload={handleImageUpload}
                        isUploading={isUploadingImage}
                        uploadError={uploadImageError}
                        requiredResolution={{ width: 1024, height: 1024 }}
                    />

                    <div className="space-y-2">
                        <Label>Description</Label>
                        <Textarea
                            value={newQuest.description || ""}
                            onChange={(e) => setNewQuest(prev => ({ ...prev, description: e.target.value } as T))}
                            placeholder="Describe your quest campaign"
                            rows={3}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* ── Step 2: Rewards Configuration ── */}
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Coins className="h-5 w-5" /> Step 2: Rewards Configuration
                            </CardTitle>
                            <CardDescription>Choose token and distribution model</CardDescription>
                        </div>
                        {network && (
                            <Badge variant="outline" className="flex items-center gap-1" style={{ borderColor: network.color, color: network.color }}>
                                <Wallet className="h-3 w-3" /> {network.name}
                            </Badge>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">

                    {/* Token selector */}
                    <div className="space-y-2">
                        <Label>Reward Token ({network?.name || 'Unknown Network'})</Label>
                        <Select
                            value={isCustomToken ? "custom" : selectedToken?.address}
                            onValueChange={(v) => {
                                if (v === "custom") {
                                    setIsCustomToken(true)
                                    setSelectedToken(null)
                                } else {
                                    const token = availableTokens.find(t => t.address === v)
                                    if (token) {
                                        setSelectedToken(token)
                                        setIsCustomToken(false)
                                        setCustomTokenAddress('')
                                        setNewQuest(prev => ({
                                            ...prev,
                                            rewardTokenType: token.isNative ? 'native' : 'erc20',
                                            tokenAddress: token.address,
                                            tokenSymbol: token.symbol
                                        } as T))
                                    }
                                }
                            }}
                        >
                            <SelectTrigger><SelectValue placeholder="Select token" /></SelectTrigger>
                            <SelectContent>
                                {availableTokens.map(t => (
                                    <SelectItem key={t.address} value={t.address}>{t.name} ({t.symbol})</SelectItem>
                                ))}
                                <SelectItem value="custom">+ Custom Token</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Custom token input */}
                    {isCustomToken && (
                        <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-900 border-dashed border-gray-300 dark:border-gray-700">
                            <Label>Custom Token Address</Label>
                            <div className="flex gap-2 mt-2">
                                <Input
                                    value={customTokenAddress}
                                    onChange={(e) => setCustomTokenAddress(e.target.value)}
                                    placeholder="0x..."
                                />
                                <Button variant="secondary" onClick={() => {
                                    if (isAddress(customTokenAddress)) {
                                        const customToken = { address: customTokenAddress, name: 'Custom', symbol: 'TOK', decimals: 18 }
                                        setSelectedToken(customToken)
                                        setNewQuest(prev => ({
                                            ...prev,
                                            rewardTokenType: 'erc20',
                                            tokenAddress: customTokenAddress,
                                            tokenSymbol: 'TOK'
                                        } as T))
                                        toast.success("Custom token address set")
                                    } else {
                                        toast.error("Invalid token address")
                                    }
                                }}>Set Address</Button>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                                Make sure this is a valid ERC20 token on {network?.name}.
                            </p>
                        </div>
                    )}

                    {/* Winners count + Model selector */}
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Number of Winners</Label>
                                <Input
                                    type="number"
                                    min="1"
                                    value={newQuest.distributionConfig.totalWinners}
                                    onChange={(e) => handleWinnersChange(parseInt(e.target.value) || 1)}
                                />
                            </div>
                            <div>
                                <Label>Distribution Model</Label>
                                <Select
                                    value={newQuest.distributionConfig.model}
                                    onValueChange={(v: any) => handleModelChange(v)}
                                >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="equal">Equal</SelectItem>
                                        <SelectItem value="quadratic">Quadratic</SelectItem>
                                        <SelectItem value="custom_tiers">Custom Tiers</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* ── Equal model ── */}
                        {newQuest.distributionConfig.model === 'equal' && (
                            <>
                                <div>
                                    <div className="flex justify-between">
                                        <Label>Total Reward Pool ({selectedToken?.symbol})</Label>
                                        {tokenPrice > 0 && (
                                            <span className="text-xs text-muted-foreground font-mono">
                                                1 {selectedToken?.symbol} ≈ ${tokenPrice.toFixed(2)}
                                            </span>
                                        )}
                                    </div>
                                    <div className="relative mt-1">
                                        <Input
                                            type="number"
                                            value={newQuest.rewardPool}
                                            onChange={(e) => setNewQuest(prev => ({ ...prev, rewardPool: e.target.value } as T))}
                                        />
                                        {tokenPrice > 0 && (
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground flex items-center gap-1">
                                                <DollarSign className="h-3 w-3" />{poolUsdValue.toFixed(2)}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded">
                                    <p>Each winner gets: <strong>{getAmountPerWinner()} {selectedToken?.symbol}</strong></p>
                                    <p className="text-xs mt-2">
                                        Deposit needed (incl. 1% fee):{" "}
                                        <strong>{newQuest.rewardPool ? (parseFloat(newQuest.rewardPool) * 1.01).toFixed(4) : 0} {selectedToken?.symbol}</strong>
                                    </p>
                                </div>
                            </>
                        )}

                        {/* ── Quadratic model ── */}
                        {newQuest.distributionConfig.model === 'quadratic' && (
                            <>
                                <div>
                                    <Label>Total Reward Pool ({selectedToken?.symbol})</Label>
                                    <div className="relative mt-1">
                                        <Input
                                            type="number"
                                            value={newQuest.rewardPool}
                                            onChange={(e) => setNewQuest(prev => ({ ...prev, rewardPool: e.target.value } as T))}
                                        />
                                        {tokenPrice > 0 && (
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground flex items-center gap-1">
                                                <DollarSign className="h-3 w-3" />{poolUsdValue.toFixed(2)}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="border rounded overflow-hidden">
                                    <div className="grid grid-cols-5 text-xs font-medium bg-gray-100 dark:bg-gray-800 p-3">
                                        <div>Rank</div><div>Points</div><div>Weight</div><div>Share %</div><div>Reward</div>
                                    </div>
                                    {examplePoints.map((p, i) => {
                                        const share = totalWeight ? (weights[i] / totalWeight * 100).toFixed(2) : 0
                                        const reward = totalWeight ? (weights[i] / totalWeight * poolAmount).toFixed(4) : 0
                                        return (
                                            <div key={i} className="grid grid-cols-5 text-xs p-3 border-t">
                                                <div>#{i + 1}</div>
                                                <div>{p.toLocaleString()}</div>
                                                <div>{weights[i].toFixed(2)}</div>
                                                <div>{share}%</div>
                                                <div>{reward}</div>
                                            </div>
                                        )
                                    })}
                                    <div className="p-3 text-xs text-muted-foreground text-center bg-gray-50 dark:bg-gray-900 border-t">
                                        Previewing Top 5. Rewards scale down non-linearly.
                                    </div>
                                </div>
                            </>
                        )}

                        {/* ── Custom Tiers model ── */}
                        {newQuest.distributionConfig.model === 'custom_tiers' && (
                            <div className="space-y-5">

                                {/* Winner count stepper */}
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium flex items-center gap-2">
                                        <Users className="h-4 w-4 text-primary" />
                                        Number of Winners
                                    </Label>
                                    <div className="flex items-center gap-3">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            className="h-9 w-9 shrink-0"
                                            onClick={() => handleWinnersChange(newQuest.distributionConfig.totalWinners - 1)}
                                            disabled={newQuest.distributionConfig.totalWinners <= 1}
                                        >
                                            <Minus className="h-4 w-4" />
                                        </Button>
                                        <Input
                                            type="number"
                                            min={1}
                                            max={100}
                                            value={newQuest.distributionConfig.totalWinners}
                                            onChange={(e) => handleWinnersChange(parseInt(e.target.value))}
                                            className="w-24 text-center font-mono text-base bg-background"
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            className="h-9 w-9 shrink-0"
                                            onClick={() => handleWinnersChange(newQuest.distributionConfig.totalWinners + 1)}
                                            disabled={newQuest.distributionConfig.totalWinners >= 100}
                                        >
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                        <span className="text-sm text-muted-foreground">
                                            winner{newQuest.distributionConfig.totalWinners !== 1 ? "s" : ""}
                                        </span>
                                    </div>
                                </div>

                                {/* Per-rank reward rows */}
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium">Reward per Rank</Label>
                                    <p className="text-xs text-muted-foreground">
                                        Assign how much {selectedToken?.symbol || 'TOKEN'} each rank earns. Higher ranks should receive more.
                                    </p>

                                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1 mt-3">
                                        {newQuest.distributionConfig.tiers.map((rankReward) => {
                                        // 👇 1. Create a safe, guaranteed number for our math calculations
                                        const numericAmount = parseFloat(String(rankReward.amount)) || 0;

                                        // 👇 2. Use numericAmount here for division
                                        const barWidth = highestRankAmount > 0
                                            ? Math.round((numericAmount / highestRankAmount) * 100)
                                            : 0

                                        return (
                                            <div
                                                key={rankReward.rank}
                                                className={`relative flex items-center gap-3 p-3 rounded-lg border transition-colors ${getRankRowStyle(rankReward.rank)}`}
                                            >
                                                {/* Proportional bar fill */}
                                                {barWidth > 0 && (
                                                    <div
                                                        className="absolute inset-0 rounded-lg opacity-[0.04] bg-primary pointer-events-none"
                                                        style={{ width: `${barWidth}%` }}
                                                    />
                                                )}

                                                {/* Icon + rank label */}
                                                <div className="flex items-center gap-2 w-28 shrink-0">
                                                    {getRankIcon(rankReward.rank)}
                                                    <span className="text-sm font-medium tabular-nums">
                                                        {getRankLabel(rankReward.rank)}
                                                    </span>
                                                </div>

                                                {/* Amount input */}
                                                <div className="flex-1 relative">
                                                    <Input
                                                        type="number"
                                                        min={0}
                                                        step="any"
                                                        placeholder="0.00"
                                                        value={rankReward.amount} // Keep the raw string/number here!
                                                        onChange={(e) => handleRankAmountChange(rankReward.rank, e.target.value)}
                                                        // 👇 3. Use numericAmount here for the error border check
                                                        className={`bg-background/80 font-mono text-sm pr-20 ${numericAmount <= 0 ? "border-red-500/50" : ""}`}
                                                    />
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none font-mono">
                                                        {selectedToken?.symbol || 'TOKEN'}
                                                    </span>
                                                </div>

                                                {/* USD value */}
                                                {/* 👇 4. Use numericAmount here for the > 0 check and the multiplication */}
                                                {tokenPrice > 0 && numericAmount > 0 && (
                                                    <div className="flex items-center gap-1 text-xs text-muted-foreground w-20 shrink-0 justify-end">
                                                        <DollarSign className="h-3 w-3" />
                                                        {(numericAmount * tokenPrice).toFixed(2)}
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                    </div>

                                    {hasZeroRanks && (
                                        <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
                                            <AlertTriangle className="h-3 w-3" /> Some ranks have no reward assigned.
                                        </p>
                                    )}
                                </div>

                                {/* Summary panel */}
                                <div className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-3">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">Total Reward Pool</span>
                                        <span className="font-semibold font-mono">
                                            {customTiersTotal.toFixed(4)}{" "}
                                            <span className="text-muted-foreground text-xs">{selectedToken?.symbol}</span>
                                        </span>
                                    </div>
                                    {tokenPrice > 0 && (
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-muted-foreground">Estimated USD Value</span>
                                            <span className="font-mono text-green-600 dark:text-green-400">
                                                ≈ ${(customTiersTotal * tokenPrice).toFixed(2)}
                                            </span>
                                        </div>
                                    )}
                                    <div className="flex items-center justify-between text-sm border-t border-border/50 pt-3">
                                        <span className="text-muted-foreground">
                                            Deposit needed{" "}
                                            <Badge variant="outline" className="text-[10px] ml-1">incl. 1% fee</Badge>
                                        </span>
                                        <span className="font-semibold font-mono text-primary">
                                            {(customTiersTotal * 1.01).toFixed(4)}{" "}
                                            <span className="text-muted-foreground text-xs">{selectedToken?.symbol}</span>
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Save & Continue */}
                    <div className="pt-8 border-t text-center">
                        <Button
                            size="lg"
                            onClick={handleSaveDraft}
                            disabled={isSavingDraft || !isPhase1Valid}
                            className="w-full sm:w-auto"
                        >
                            {isSavingDraft
                                ? <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                : <Save className="mr-2 h-5 w-5" />}
                            Save and Continue
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}