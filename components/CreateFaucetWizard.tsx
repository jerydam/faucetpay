// File: components/CreateFaucetWizard.tsx
'use client'

import { Alert } from "@/components/ui/alert"
import { useState, useEffect, useCallback, useMemo, Suspense } from "react"
import { useWallet } from "@/hooks/use-wallet"
import { useNetwork, isFactoryTypeAvailable } from "@/hooks/use-network"
import { useChainId } from 'wagmi'
import { toast } from "sonner"
import { useRouter, useSearchParams } from 'next/navigation'
import {
  createFaucet,
  checkFaucetNameExists,
} from "@/lib/faucet"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { AlertDescription, AlertTitle } from "@/components/ui/alert"
import { getFaucetByAddress, buildFaucetSlug } from "@/lib/faucet-slug"
import {
  AlertCircle,
  Loader2,
  Info,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Globe,
  Shield,
  Key,
  Coins,
  AlertTriangle,
  Check,
  Settings,
  Zap,
  XCircle,
  Plus,
  X,
  Upload,
  Image as ImageIcon,
} from "lucide-react"
import { Header } from "@/components/header"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { zeroAddress, isAddress } from "viem"
import LoadingPage from "@/components/loading"

// --- TYPES ---
export interface TokenConfiguration {
  address: string
  name: string
  symbol: string
  decimals: number
  isNative?: boolean
  isCustom?: boolean
  logoUrl?: string | null
  description?: string
}

interface FaucetNameConflict {
  faucetAddress: string
  faucetName: string
  ownerAddress: string
  factoryAddress: string
  factoryType: FactoryType
}

interface NameValidationState {
  isValidating: boolean
  isNameAvailable: boolean
  validationError: string | null
  conflictingFaucets?: FaucetNameConflict[]
  validationWarning?: string
}

interface CustomTokenValidationState {
  isValidating: boolean
  isValid: boolean
  tokenInfo: TokenConfiguration | null
  validationError: string | null
}

interface FaucetCreationFormData {
  faucetName: string
  selectedTokenAddress: string
  customTokenAddress: string
  showCustomTokenInput: boolean
  requiresDropCode: boolean
}

interface WizardStepState {
  currentStep: number
  selectedFaucetType: string
  formData: FaucetCreationFormData
  showUseCasesDialog: boolean
}

type FactoryType = 'dropcode' | 'droplist' | 'custom'
type FaucetType = 'open' | 'gated' | 'custom'

interface ValidationConflict {
  address: string
  name: string
  owner: string
  factoryAddress: string
  factoryType: FactoryType
}

// --- SUB-COMPONENTS ---

interface NetworkImageProps {
  network: any
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
}
const DEFAULT_FAUCET_IMAGE = "/default.jpeg"

function NetworkImage({ network, size = 'md', className = '' }: NetworkImageProps) {
  const [imageError, setImageError] = useState(false)
  const [imageLoading, setImageLoading] = useState(true)
    
  const sizeClasses = {
    xs: 'w-4 h-4',
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  }
    
  const fallbackSizes = {
    xs: 'text-xs',
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  }

  if (imageError || !network?.logoUrl) {
    return (
      <div
        className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-bold text-white ${className}`}
        style={{ backgroundColor: network?.color || '#6B7280' }}
      >
        <span className={fallbackSizes[size]}>
          {network?.symbol?.slice(0, 2) || 'N/A'}
        </span>
      </div>
    )
  }

  return (
    <div className={`${sizeClasses[size]} ${className} relative`}>
      {imageLoading && (
        <div
          className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-bold text-white absolute inset-0 animate-pulse`}
          style={{ backgroundColor: network?.color || '#6B7280' }}
        >
          <span className={fallbackSizes[size]}>
            {network?.symbol?.slice(0, 2) || 'N/A'}
          </span>
        </div>
      )}
      <img
        src={network.logoUrl}
        alt={`${network.name} logo`}
        className={`${sizeClasses[size]} rounded-full object-cover ${imageLoading ? 'opacity-0' : 'opacity-100'} transition-opacity`}
        onLoad={() => {
          setImageLoading(false)
          setImageError(false)
        }}
        onError={() => {
          setImageLoading(false)
          setImageError(true)
        }}
      />
    </div>
  )
}

interface TokenImageProps {
  token: TokenConfiguration
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
}

function TokenImage({ token, size = 'md', className = '' }: TokenImageProps) {
  const [imageError, setImageError] = useState(false)
  const [imageLoading, setImageLoading] = useState(true)
    
  const sizeClasses = {
    xs: 'w-4 h-4',
    sm: 'w-5 h-5',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  }
    
  const fallbackSizes = {
    xs: 'text-xs',
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  }

  const getTokenColor = () => {
    if (token.isNative) return '#3B82F6'
    if (token.isCustom) return '#8B5CF6'
    return '#6B7280'
  }

  if (imageError || !token.logoUrl) {
    return (
      <div
        className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-bold text-white ${className}`}
        style={{ backgroundColor: getTokenColor() }}
      >
        <span className={fallbackSizes[size]}>
          {token.symbol.slice(0, 2)}
        </span>
      </div>
    )
  }

  return (
    <div className={`${sizeClasses[size]} ${className} relative`}>
      {imageLoading && (
        <div
          className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-bold text-white absolute inset-0 animate-pulse`}
          style={{ backgroundColor: getTokenColor() }}
        >
          <span className={fallbackSizes[size]}>
            {token.symbol.slice(0, 2)}
          </span>
        </div>
      )}
      <img
        src={token.logoUrl}
        alt={`${token.name} logo`}
        className={`${sizeClasses[size]} rounded-full object-cover ${imageLoading ? 'opacity-0' : 'opacity-100'} transition-opacity`}
        onLoad={() => {
          setImageLoading(false)
          setImageError(false)
        }}
        onError={() => {
          setImageLoading(false)
          setImageError(true)
        }}
      />
    </div>
  )
}

// --- CONSTANTS ---
const FAUCET_TYPES = {
  OPEN: 'open' as const,
  GATED: 'gated' as const,
  CUSTOM: 'custom' as const,
} as const

const FAUCET_TYPE_TO_FACTORY_TYPE_MAPPING: Record<FaucetType, FactoryType> = {
  [FAUCET_TYPES.OPEN]: 'dropcode',
  [FAUCET_TYPES.GATED]: 'droplist',
  [FAUCET_TYPES.CUSTOM]: 'custom',
}

const SUPPORTED_CHAIN_IDS = [42220, 1135, 42161, 8453] as const

export const NETWORK_TOKENS: Record<number, TokenConfiguration[]> = {
  // Celo Mainnet (42220)
  42220: [
    {
      address: "0x471EcE3750Da237f93B8E339c536989b8978a438",
      name: "Celo",
      symbol: "CELO",
      decimals: 18,
      isNative: true,
      logoUrl: "/celo.jpeg", 
      description: "Native Celo token for governance and staking",
    },
    {
      address: "0xE2702Bd97ee33c88c8f6f92DA3B733608aa76F71",
      name: "Celo Nigerian Naira",
      symbol: "cNGN",
      decimals: 18,
      logoUrl: "/cngn.png", 
      description: "Naira-pegged stablecoin on Celo",
    },
    {
      address: "0x8A567e2aE79CA692Bd748aB832081C45de4041eA",
      name: "Celo Colombian Peso",
      symbol: "cCOP",
      decimals: 18,
      logoUrl: "/ccop.png",
      description: "colombian peso-pegged stablecoin on Celo",

    },
    {
      address: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
      name: "Celo Dollar",
      symbol: "cUSD",
      decimals: 18,
      logoUrl: "/cusd.png", 
      description: "USD-pegged stablecoin on Celo",
    },
    {
      address: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e",
      name: "Tether",
      symbol: "USDT",
      decimals: 6,
      logoUrl: "/usdt.jpg", 
      description: "Tether USD stablecoin",
    },
    {
      address: "0x639A647fbe20b6c8ac19E48E2de44ea792c62c5C",
      name: "Celo Brazilian Real",
      symbol: "cREAL",
      decimals: 18,
      logoUrl: "/creal.jpg", 
      description: "Brazilian Real-pegged stablecoin on Celo",
    },
    {
      address: "0x32A9FE697a32135BFd313a6Ac28792DaE4D9979d",
      name: "Celo Kenyan Shilling",
      symbol: "cKES",
      decimals: 18,
      logoUrl: "/ckes.jpg", 
      description: "Kenyan Shilling-pegged stablecoin on Celo",
    },
    {
      address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C",
      name: "USD Coin",
      symbol: "USDC",
      decimals: 6,
      logoUrl: "/usdc.jpg", 
      description: "USD Coin stablecoin",
    },
    {
      address: "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73",
      name: "Celo Euro",
      symbol: "cEUR",
      decimals: 18,
      logoUrl: "/ceur.png", 
      description: "Euro-pegged stablecoin on Celo",
    },
    {
      address: "0x4f604735c1cf31399c6e711d5962b2b3e0225ad3",
      name: "Glo Dollar",
      symbol: "USDGLO",
      decimals: 18,
      logoUrl: "/glo.jpg", 
      description: "Philanthropic dollar that funds global poverty relief",
    },
    {
      address: "0x62b8b11039fcfe5ab0c56e502b1c372a3d2a9c7a",
      name: "GoodDollar",
      symbol: "G$",
      decimals: 18,
      logoUrl: "/gd.jpg", 
      description: "Universal basic income token",
    },
  ],

  // Lisk Mainnet (1135)
  1135: [
    {
      address: zeroAddress,
      name: "Ethereum",
      symbol: "ETH",
      decimals: 18,
      isNative: true,
      logoUrl: "/ether.jpeg", 
      description: "Native Ethereum for transaction fees",
    },
    {
      address: "0xac485391EB2d7D88253a7F1eF18C37f4242D1A24",
      name: "Lisk",
      symbol: "LSK",
      decimals: 18,
      logoUrl: "/lsk.png", 
      description: "Lisk native token",
    },
    {
      address: "0x05D032ac25d322df992303dCa074EE7392C117b9",
      name: "Tether USD",
      symbol: "USDT",
      decimals: 6,
      logoUrl: "/usdt.jpg", 
      description: "Tether USD stablecoin",
    },
    {
      address: "0xF242275d3a6527d877f2c927a82D9b057609cc71",
      name: "Bridged USDC",
      symbol: "USDC.e",
      decimals: 6,
      logoUrl: "/usdc.jpg", 
      description: "Bridged USD Coin from Ethereum",
    },
  ],

  // Arbitrum One (42161)
  42161: [
    {
      address: zeroAddress,
      name: "Ethereum",
      symbol: "ETH",
      decimals: 18,
      isNative: true,
      logoUrl: "/ether.jpeg", 
      description: "Native Ethereum for transaction fees",
    },
    {
      address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      name: "USD Coin",
      symbol: "USDC",
      decimals: 6,
      logoUrl: "/usdc.jpg", 
      description: "Native USD Coin on Arbitrum",
    },
    {
      address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
      name: "Tether USD",
      symbol: "USDT",
      decimals: 6,
      logoUrl: "/usdt.jpg", 
      description: "Tether USD stablecoin",
    },
    {
      address: "0x912CE59144191C1204E64559FE8253a0e49E6548",
      name: "Arbitrum",
      symbol: "ARB",
      decimals: 18,
      logoUrl: "/arb.jpeg", 
      description: "Arbitrum governance token",
    },
  ],

  // Base Mainnet (8453)
  8453: [
    {
      address: zeroAddress,
      name: "Ethereum",
      symbol: "ETH",
      decimals: 18,
      isNative: true,
      logoUrl: "/ether.jpeg", 
      description: "Native Ethereum for transaction fees",
    },
    {
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      name: "USD Coin",
      symbol: "USDC",
      decimals: 6,
      logoUrl: "/usdc.jpg", 
      description: "Native USD Coin on Base",
    },
    {
      address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
      name: "Bridged Tether USD",
      symbol: "USDT",
      decimals: 6,
      logoUrl: "/usdt.jpg", 
      description: "Bridged Tether USD from Ethereum",
    },
    {
      address: "0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed",
      name: "Degen",
      symbol: "DEGEN",
      decimals: 18,
      logoUrl: "/degen.png", 
      description: "Degen community token",
    },
  ],
  
  56:[
    {
      address: zeroAddress,
      name: "BNB",
      symbol: "BNB",
      decimals: 18,
      isNative: true,
      logoUrl: "/bnb.jpg", 
      description: "Native BNB for transaction fees",
    },
    {
      address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
      name: "USD Coin",
      symbol: "USDC",
      decimals: 18, // USDC on BSC is usually 18 decimals (Bridged)
      logoUrl: "/busdc.jpg", 
      description: "Binance-Peg USD Coin",
    },
    {
      address: "0x55d398326f99059fF775485246999027B3197955",
      name: "Tether USD",
      symbol: "USDT",
      decimals: 18,
      logoUrl: "/busd.jpg", 
      description: "Binance-Peg BSC-USD",
    },
    {
      address: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56",
      name: "BUSD",
      symbol: "BUSD",
      decimals: 18,
      logoUrl: "/busdt.jpg", 
      description: "Binance-Peg BUSD Token",
    },
]
}

const FAUCET_USE_CASE_TEMPLATES: Record<FaucetType, Array<{
  templateName: string
  description: string
  idealUseCase: string
}>> = {
  [FAUCET_TYPES.OPEN]: [
    {
      templateName: "Community Token Distribution",
      description: "Wide distribution to community members with drop code protection",
      idealUseCase: "Best for token launches and community rewards",
    },
    {
      templateName: "Event-Based Distribution",
      description: "Token distribution at events, conferences, or hackathons",
      idealUseCase: "Perfect for hackathons, meetups, and conferences",
    },
    {
      templateName: "Marketing Campaign Distribution",
      description: "Public token distribution for promotional purposes",
      idealUseCase: "Great for increasing awareness and adoption",
    },
  ],
  [FAUCET_TYPES.GATED]: [
    {
      templateName: "Contest Winner Rewards",
      description: "Exclusive rewards for specific contest participants",
      idealUseCase: "Best for competitions and challenges",
    },
    {
      templateName: "Private Investor Airdrop",
      description: "Exclusive distribution to pre-selected wallet addresses",
      idealUseCase: "Perfect for investors, team members, and advisors",
    },
    {
      templateName: "DAO Member Rewards",
      description: "Rewards for active DAO contributors and governance participants",
      idealUseCase: "Great for governance participation incentives",
    },
  ],
  [FAUCET_TYPES.CUSTOM]: [
    {
      templateName: "Advanced Logic Airdrops",
      description: "Complex distribution with sophisticated rules and conditions",
      idealUseCase: "Best for sophisticated token distribution mechanisms",
    },
    {
      templateName: "Multi-Tier Reward System",
      description: "Different reward amounts based on user tier or activity",
      idealUseCase: "Perfect for loyalty programs and tiered distributions",
    },
    {
      templateName: "API-Integrated Distribution",
      description: "Built for seamless API integration and automated systems",
      idealUseCase: "Great for dApps and automated distribution systems",
    },
  ],
}

// --- PROPS INTERFACE ---
interface CreateFaucetProps {
  onSuccess?: () => void;
  closeModal?: () => void;
}

// ----------------------------------------------------------------------------------
// MAIN WIZARD COMPONENT
// ----------------------------------------------------------------------------------
export default function CreateFaucetWizard({ onSuccess, closeModal }: CreateFaucetProps) {
  const { network, getFactoryAddress, networks } = useNetwork()
  const { 
    address, 
    isConnected, 
    chainId: walletChainId, 
    connect, 
    provider 
  } = useWallet();

  const router = useRouter()
  const searchParams = useSearchParams()
  const effectiveChainId = walletChainId;
    
  const currentNetwork = useMemo(() => {
    if (!effectiveChainId) return null
    const matched = networks.find(n => n.chainId === effectiveChainId)
    return matched || null
  }, [effectiveChainId, networks])

  // State declarations
  const [faucetDescription, setFaucetDescription] = useState("")
  const [faucetImageUrl, setFaucetImageUrl] = useState("")
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null)

  const [wizardState, setWizardState] = useState<WizardStepState>({
    currentStep: 1,
    selectedFaucetType: '',
    formData: {
      faucetName: '',
      selectedTokenAddress: '',
      customTokenAddress: '',
      showCustomTokenInput: false,
      requiresDropCode: true,
    },
    showUseCasesDialog: false,
  })

  const [nameValidation, setNameValidation] = useState<NameValidationState>({
    isValidating: false,
    isNameAvailable: false,
    validationError: null,
  })

  const [customTokenValidation, setCustomTokenValidation] = useState<CustomTokenValidationState>({
    isValidating: false,
    isValid: false,
    tokenInfo: null,
    validationError: null,
  })

  const [availableTokens, setAvailableTokens] = useState<TokenConfiguration[]>([])
  const [isTokensLoading, setIsTokensLoading] = useState(false)
  const [isFaucetCreating, setIsFaucetCreating] = useState(false)
  const [creationError, setCreationError] = useState<string | null>(null)
  const [showConflictDetails, setShowConflictDetails] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)

  // Auto-select type from URL Params
  useEffect(() => {
    const typeParam = searchParams.get('type')

    // Check if we have a param and we haven't already selected a type
    if (typeParam && wizardState.selectedFaucetType === '') {
      let targetType: FaucetType | '' = ''

      // Map URL param to internal types
      if (typeParam === 'open') targetType = FAUCET_TYPES.OPEN
      if (typeParam === 'whitelist') targetType = FAUCET_TYPES.GATED
      if (typeParam === 'custom') targetType = FAUCET_TYPES.CUSTOM

      if (targetType) {
        console.log(`🔗 Auto-selecting faucet type from URL: ${targetType}`)
        setWizardState(prev => ({
          ...prev,
          selectedFaucetType: targetType,
          currentStep: 2 // Auto-advance to configuration step
        }))
      }
    }
  }, [searchParams, wizardState.selectedFaucetType])

  // Helper function to upload image
  const uploadImageToServer = async (file: File): Promise<string> => {
    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch('https://faucetdrop-backend.onrender.com/upload-image', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Failed to upload image')
      }

      const data = await response.json()
      return data.imageUrl
    } catch (error) {
      console.error('Image upload error:', error)
      throw error
    }
  }

  // Handle image file selection and upload
  const handleImageFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error("Invalid File Type. Please select an image file.")
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File Too Large. Please select an image smaller than 5MB")
      return
    }

    setSelectedImageFile(file)
    setIsUploadingImage(true)

    try {
      const uploadedUrl = await uploadImageToServer(file)
      setFaucetImageUrl(uploadedUrl)
      toast.success("Image uploaded successfully")
    } catch (error) {
      toast.error("Image upload failed. Please try again.")
      setSelectedImageFile(null)
    } finally {
      setIsUploadingImage(false)
    }
  }

  // Helper function to save metadata
  const saveFaucetMetadata = async (
    faucetAddress: string,
    description: string,
    imageUrl: string,
    createdBy: string,
    chainId: number
  ): Promise<void> => {
    try {
      console.log(`💾 Saving faucet metadata for ${faucetAddress}`)
        
      const response = await fetch('https://faucetdrop-backend.onrender.com/faucet-metadata', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          faucetAddress,
          description,
          imageUrl: imageUrl || null,
          createdBy,
          chainId
        }),
      })
        
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to save faucet metadata')
      }
        
      console.log('✅ Faucet metadata saved successfully')
        
    } catch (error: any) {
      console.error('❌ Error saving faucet metadata:', error)
      toast.warning("Faucet created, but failed to save metadata. You can update it later in the dashboard.")
    }
  }

  // Token validation
  const validateCustomTokenAddress = useCallback(async (tokenAddress: string) => {
    if (!tokenAddress.trim()) {
      setCustomTokenValidation({
        isValidating: false,
        isValid: false,
        tokenInfo: null,
        validationError: null,
      })
      return
    }

    if (!isAddress(tokenAddress)) {
      setCustomTokenValidation({
        isValidating: false,
        isValid: false,
        tokenInfo: null,
        validationError: "Invalid token address format",
      })
      return
    }

    if (!provider) {
      setCustomTokenValidation({
        isValidating: false,
        isValid: false,
        tokenInfo: null,
        validationError: "Please connect your wallet to validate the token",
      })
      return
    }

    setCustomTokenValidation(prev => ({ ...prev, isValidating: true, validationError: null }))

    try {
      const tokenContract = new (await import("ethers")).Contract(
        tokenAddress,
        [
          "function name() view returns (string)",
          "function symbol() view returns (string)",
          "function decimals() view returns (uint8)",
        ],
        provider
      )

      const [name, symbol, decimals] = await Promise.all([
        tokenContract.name(),
        tokenContract.symbol(),
        tokenContract.decimals(),
      ])

      const tokenInfo: TokenConfiguration = {
        address: tokenAddress,
        name,
        symbol,
        decimals,
        isCustom: true,
        description: "Custom ERC-20 token",
      }

      setCustomTokenValidation({
        isValidating: false,
        isValid: true,
        tokenInfo,
        validationError: null,
      })

    } catch (error: any) {
      console.error("Custom token validation error:", error)
      setCustomTokenValidation({
        isValidating: false,
        isValid: false,
        tokenInfo: null,
        validationError: "Failed to fetch token information. Please check if the address is correct and the token follows ERC-20 standard.",
      })
    }
  }, [provider])

  // Debounced custom token validation
  useEffect(() => {
    if (wizardState.formData.showCustomTokenInput && wizardState.formData.customTokenAddress.trim()) {
      const validationTimer = setTimeout(() => {
        validateCustomTokenAddress(wizardState.formData.customTokenAddress)
      }, 500)
      return () => clearTimeout(validationTimer)
    }
  }, [wizardState.formData.customTokenAddress, wizardState.formData.showCustomTokenInput, validateCustomTokenAddress])

  // Faucet type availability
  const isFaucetTypeAvailableOnNetwork = (faucetType: FaucetType): boolean => {
    if (!effectiveChainId) {
      console.log("❌ No chainId available for type check")
      return false
    }
    const mappedFactoryType = FAUCET_TYPE_TO_FACTORY_TYPE_MAPPING[faucetType]
    const isAvailable = isFactoryTypeAvailable(effectiveChainId, mappedFactoryType)
    console.log(`🔍 Checking availability for ${faucetType} (${mappedFactoryType}) on chain ${effectiveChainId}:`, isAvailable)
    return isAvailable
  }

  const getUnavailableFaucetTypesForNetwork = (): FaucetType[] => {
    if (!effectiveChainId) return []
    const unavailableTypes: FaucetType[] = []
    Object.entries(FAUCET_TYPE_TO_FACTORY_TYPE_MAPPING).forEach(([faucetType, factoryType]) => {
      if (!isFactoryTypeAvailable(effectiveChainId, factoryType)) {
        unavailableTypes.push(faucetType as FaucetType)
      }
    })
    return unavailableTypes
  }
  // Helper function to register faucet in backend database
  const registerFaucetInBackend = async (
    faucetAddress: string,
    ownerAddress: string,
    chainId: number,
    faucetType: string,
    name: string
  ): Promise<void> => {
    try {
      console.log(`📝 Registering faucet ${name} (${faucetAddress}) in backend...`)

      const response = await fetch('https://faucetdrop-backend.onrender.com/register-faucet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          faucetAddress,
          ownerAddress,
          chainId,
          faucetType, // This should be 'dropcode', 'droplist', or 'custom'
          name
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to register faucet in database')
      }

      console.log('✅ Faucet registered successfully in backend')

    } catch (error: any) {
      console.error('❌ Error registering faucet in backend:', error)
      // We don't block the UI here, just log/toast warning, as the on-chain faucet is already created
      toast.error("Faucet created on-chain, but failed to register in dashboard. It may not appear in your list immediately.")
    }
  }
  // Name validation
  const validateFaucetNameAcrossFactories = useCallback(async (nameToValidate: string) => {
    if (!nameToValidate.trim()) {
      setNameValidation({
        isValidating: false,
        isNameAvailable: false,
        validationError: null,
      })
      return
    }
    if (!provider) {
      setNameValidation({
        isValidating: false,
        isNameAvailable: false,
        validationError: "Please connect your wallet to validate the name",
      })
      return
    }
    if (!effectiveChainId || !currentNetwork) {
      setNameValidation({
        isValidating: false,
        isNameAvailable: false,
        validationError: "Please connect to a supported network",
      })
      return
    }
    if (!wizardState.selectedFaucetType) {
      setNameValidation({
        isValidating: false,
        isNameAvailable: false,
        validationError: "Please select a faucet type before validating the name",
      })
      return
    }
    const mappedFactoryType = FAUCET_TYPE_TO_FACTORY_TYPE_MAPPING[wizardState.selectedFaucetType as FaucetType]
    const primaryFactoryAddress = getFactoryAddress(mappedFactoryType, currentNetwork)
    if (!primaryFactoryAddress) {
      setNameValidation({
        isValidating: false,
        isNameAvailable: false,
        validationError: `${wizardState.selectedFaucetType} faucets are not available on this network`,
      })
      return
    }
    setNameValidation(prev => ({ ...prev, isValidating: true, validationError: null }))
    try {
      console.log(`Validating name "${nameToValidate}" across all factories on ${currentNetwork?.name}...`)
      // Cast to 'any' to bypass the slight interface mismatch between the hook and lib
      const validationResult = await checkFaucetNameExists(provider, currentNetwork as any, nameToValidate)
      if (validationResult.exists && validationResult.conflictingFaucets) {
        const conflictCount = validationResult.conflictingFaucets.length
        const factoryTypeList = validationResult.conflictingFaucets
          .map((conflict: ValidationConflict) => `${conflict.factoryType} factory`)
          .join(', ')
        setNameValidation({
          isValidating: false,
          isNameAvailable: false,
          validationError: conflictCount > 1
            ? `Name "${validationResult.existingFaucet?.name}" exists in ${conflictCount} factories: ${factoryTypeList}`
            : `Name "${validationResult.existingFaucet?.name}" already exists in ${factoryTypeList}`,
          conflictingFaucets: validationResult.conflictingFaucets.map((conflict: ValidationConflict) => ({
            faucetAddress: conflict.address,
            faucetName: conflict.name,
            ownerAddress: conflict.owner,
            factoryAddress: conflict.factoryAddress,
            factoryType: conflict.factoryType,
          })),
        })
        return
      }
      if (validationResult.warning) {
        console.warn("Name validation warning:", validationResult.warning)
        setNameValidation({
          isValidating: false,
          isNameAvailable: true,
          validationError: null,
          validationWarning: validationResult.warning,
        })
        return
      }
      setNameValidation({
        isValidating: false,
        isNameAvailable: true,
        validationError: null,
      })
    } catch (error: any) {
      console.error("Name validation error:", error)
      setNameValidation({
        isValidating: false,
        isNameAvailable: false,
        validationError: "Failed to validate name across all factories",
      })
    }
  }, [provider, effectiveChainId, currentNetwork, wizardState.selectedFaucetType, getFactoryAddress])

  // Debounced name validation
  useEffect(() => {
    const validationTimer = setTimeout(() => {
      if (wizardState.formData.faucetName.trim() && wizardState.formData.faucetName.length >= 3) {
        validateFaucetNameAcrossFactories(wizardState.formData.faucetName)
      }
    }, 500)
    return () => clearTimeout(validationTimer)
  }, [wizardState.formData.faucetName, validateFaucetNameAcrossFactories])

  // Load tokens
  useEffect(() => {
    const loadNetworkTokens = async () => {
      if (!effectiveChainId) {
        console.log('[CreatePage] ⏳ No chainId available yet')
        return
      }
      console.log('[CreatePage] 🔄 Loading tokens for chainId:', effectiveChainId)
      setIsTokensLoading(true)
      try {
        const networkTokens = NETWORK_TOKENS[effectiveChainId] || []
        console.log('[CreatePage] ✅ Loaded', networkTokens.length, 'tokens')
        setAvailableTokens(networkTokens)
        if (networkTokens.length > 0 && !wizardState.formData.selectedTokenAddress) {
          console.log('[CreatePage] 📌 Setting default token:', networkTokens[0].symbol)
          setWizardState(prev => ({
            ...prev,
            formData: {
              ...prev.formData,
              selectedTokenAddress: networkTokens[0].address,
            }
          }))
        }
      } catch (error) {
        console.error('[CreatePage] ❌ Failed to load tokens:', error)
        setCreationError("Failed to load available tokens")
      } finally {
        setIsTokensLoading(false)
      }
    }
    loadNetworkTokens()
  }, [effectiveChainId, wizardState.formData.selectedTokenAddress])

  // Network validation
  useEffect(() => {
    if (!effectiveChainId) {
      setCreationError("Please connect your wallet to a supported network")
      return
    }
    const matchedNetwork = networks.find(n => n.chainId === effectiveChainId)
    if (!matchedNetwork) {
      setCreationError(`Chain ID ${effectiveChainId} is not supported`)
      return
    }
    setCreationError(null)
    if (wizardState.selectedFaucetType && !isFaucetTypeAvailableOnNetwork(wizardState.selectedFaucetType as FaucetType)) {
      setWizardState(prev => ({ ...prev, selectedFaucetType: '' }))
      toast.warning(`Selected faucet type is not available on ${matchedNetwork.name}. Please choose another type.`)
    }
  }, [effectiveChainId, networks, wizardState.selectedFaucetType, toast])

  // Reset custom token
  useEffect(() => {
    if (!wizardState.formData.showCustomTokenInput) {
      setWizardState(prev => ({
        ...prev,
        formData: {
          ...prev.formData,
          customTokenAddress: '',
        }
      }))
      setCustomTokenValidation({
        isValidating: false,
        isValid: false,
        tokenInfo: null,
        validationError: null,
      })
    }
  }, [wizardState.formData.showCustomTokenInput])

  // Helper functions
  const getSelectedTokenConfiguration = (): TokenConfiguration | null => {
    if (wizardState.formData.showCustomTokenInput && customTokenValidation.tokenInfo) {
      return customTokenValidation.tokenInfo
    }
    return availableTokens.find((token) => token.address === wizardState.formData.selectedTokenAddress) || null
  }

  const getFinalTokenAddress = (): string => {
    if (wizardState.formData.showCustomTokenInput && customTokenValidation.isValid) {
      return wizardState.formData.customTokenAddress
    }
    return wizardState.formData.selectedTokenAddress
  }

  const proceedToNextStep = () => {
    if (wizardState.currentStep < 3) {
      setWizardState(prev => ({ ...prev, currentStep: prev.currentStep + 1 }))
    }
  }

  const returnToPreviousStep = () => {
    if (wizardState.currentStep > 1) {
      setWizardState(prev => ({ ...prev, currentStep: prev.currentStep - 1 }))
    }
  }

  const navigateToMainPage = () => {
    router.back()
  }

  const selectFaucetType = (type: FaucetType) => {
    if (!isFaucetTypeAvailableOnNetwork(type)) {
      console.warn(`❌ Cannot select ${type} - not available on current network`)
      toast.warning(`The selected faucet type is not available on the current network. Please choose another type.`)
      return
    }
    console.log(`✅ Selected faucet type: ${type}`)
    setWizardState(prev => ({ ...prev, selectedFaucetType: type }))
  }

  const handleTokenSelectionChange = (value: string) => {
    if (value === "custom") {
      setWizardState(prev => ({
        ...prev,
        formData: {
          ...prev.formData,
          showCustomTokenInput: true,
          selectedTokenAddress: '',
        }
      }))
    } else {
      setWizardState(prev => ({
        ...prev,
        formData: {
          ...prev.formData,
          showCustomTokenInput: false,
          selectedTokenAddress: value,
        }
      }))
    }
  }

  // ── ADD this helper above handleFaucetCreation ──────────────────────────────
const getSlugForNewFaucet = async (
  faucetAddr: string,
  chainId: number,
  faucetName: string,
  maxAttempts = 5
): Promise<string> => {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 600 * (i + 1))) // 600ms, 1.2s, 1.8s …
    try {
      const row = await getFaucetByAddress(faucetAddr, chainId)
      if (row?.slug) return row.slug
    } catch {
      // swallow and retry
    }
  }
  // Fallback: build it client-side — FaucetDetails handles 0x-address lookups too
  return buildFaucetSlug(faucetName, faucetAddr)
}
  // Faucet creation
const handleFaucetCreation = async () => {
  if (!wizardState.formData.faucetName.trim()) {
    setCreationError("Please enter a faucet name")
    return
  }
  if (!nameValidation.isNameAvailable) {
    setCreationError("Please choose a valid faucet name")
    return
  }

  const finalTokenAddress = getFinalTokenAddress()
  if (!finalTokenAddress) {
    setCreationError("Please select a token or enter a custom token address")
    return
  }
  if (wizardState.formData.showCustomTokenInput && !customTokenValidation.isValid) {
    setCreationError("Please enter a valid custom token address")
    return
  }

  if (!effectiveChainId || !currentNetwork) {
    setCreationError("Please connect your wallet to a supported network")
    return
  }
  if (!address) {
    setCreationError("Unable to get wallet address")
    return
  }

  const mappedFactoryType = FAUCET_TYPE_TO_FACTORY_TYPE_MAPPING[wizardState.selectedFaucetType as FaucetType]
  const factoryAddress = getFactoryAddress(mappedFactoryType, currentNetwork)
  if (!factoryAddress) {
    setCreationError(`${wizardState.selectedFaucetType} faucets are not available on this network`)
    return
  }

  setCreationError(null)

  if (!isConnected) {
    try {
      await connect()
    } catch (error) {
      console.error("Failed to connect wallet:", error)
      setCreationError("Failed to connect wallet. Please try again.")
      return
    }
  }
  if (!provider) {
    setCreationError("Wallet not connected")
    return
  }

  setIsFaucetCreating(true)

  try {
    let shouldUseBackend = false
    let isCustomFaucet = false

    console.log("🏭 Creating faucet with selected type:", wizardState.selectedFaucetType)
    console.log("🏭 Mapped factory type:", mappedFactoryType)
    console.log("🏭 Factory address:", factoryAddress)
    console.log("🏭 Final token address:", finalTokenAddress)

    switch (wizardState.selectedFaucetType) {
      case FAUCET_TYPES.OPEN:
        shouldUseBackend = wizardState.formData.requiresDropCode
        isCustomFaucet = false
        break
      case FAUCET_TYPES.GATED:
        shouldUseBackend = false
        isCustomFaucet = false
        break
      case FAUCET_TYPES.CUSTOM:
        shouldUseBackend = false
        isCustomFaucet = true
        break
      default:
        throw new Error(`Invalid faucet type selected: ${wizardState.selectedFaucetType}`)
    }

    const createdFaucetAddress = await createFaucet(
      provider,
      factoryAddress,
      wizardState.formData.faucetName,
      finalTokenAddress,
      BigInt(effectiveChainId),
      BigInt(effectiveChainId),
      shouldUseBackend,
      isCustomFaucet
    )

    if (!createdFaucetAddress) {
      throw new Error("Failed to get created faucet address")
    }

    console.log("🎉 Faucet created successfully at:", createdFaucetAddress)

    // Register in backend + save metadata
    await registerFaucetInBackend(
      createdFaucetAddress,
      address,
      effectiveChainId,
      mappedFactoryType,
      wizardState.formData.faucetName
    )

    const networkName = currentNetwork?.name || "Unknown Network"
    const ownerShort = `${address.slice(0, 6)}...${address.slice(-4)}`
    const finalDescription = faucetDescription.trim() || 
      `This is a faucet on ${networkName} by ${ownerShort}`
    const finalImageUrl = faucetImageUrl.trim() || DEFAULT_FAUCET_IMAGE

    await saveFaucetMetadata(
      createdFaucetAddress,
      finalDescription,
      finalImageUrl,
      address,
      effectiveChainId
    )

    // === INSTANT SYNC + GET SLUG ===
    let finalSlug = createdFaucetAddress // fallback
    try {
      const syncRes = await fetch(`https://faucetdrops-indexer.onrender.com/sync-faucet/${createdFaucetAddress}`, {
        method: "POST",
      })
      if (syncRes.ok) {
        const data = await syncRes.json()
        if (data.slug) {
          finalSlug = data.slug
          console.log("✅ Sync returned clean slug:", finalSlug)
        }
      }
    } catch (syncErr) {
      console.warn("Sync call failed (non-blocking):", syncErr)
    }

    const selectedToken = getSelectedTokenConfiguration()
    toast.success(`Faucet "${wizardState.formData.faucetName}" created successfully!`)

    if (onSuccess) {
      console.log("🔄 Triggering dashboard refresh...")
      setTimeout(() => onSuccess(), 500)
    }

    if (closeModal) {
      closeModal()
    } else {
      // REDIRECT USING SLUG (clean URL!)
      window.location.href = `/faucet/${finalSlug}?networkId=${effectiveChainId}&new=true`
    }

  } catch (error: any) {
    console.error("❌ Error creating faucet:", error)
    const errorMessage = error.message || "Failed to create faucet"
    toast.error("Failed to create faucet", { description: errorMessage })
    setCreationError(errorMessage)
  } finally {
    setIsFaucetCreating(false)
  }
}
  const getWizardStepTitle = (step: number): string => {
    switch (step) {
      case 1: return "Choose Faucet Type"
      case 2: return "Configure Details"
      case 3: return "Review & Create"
      default: return "Create Faucet"
    }
  }

  useEffect(() => {
    const initializeComponent = async () => {
      try {
        setInitialLoading(true)
        console.log('[CreatePage] 🚀 Initializing...', {
          effectiveChainId,
          network: network?.name
        })
        await new Promise(resolve => setTimeout(resolve, 500))
      } catch (error) {
        console.error('[CreatePage] ❌ Error initializing:', error)
      } finally {
        setInitialLoading(false)
        console.log('[CreatePage] ✅ Initialization complete')
      }
    }
    initializeComponent()
  }, [])

  const getWizardStepDescription = (step: number): string => {
    switch (step) {
      case 1: return "Select the type of faucet that fits your needs"
      case 2: return "Set up your faucet parameters and select tokens"
      case 3: return "Review your configuration and create"
      default: return "Create your token faucet"
    }
  }

  const renderUseCaseTemplates = (faucetType: FaucetType) => {
    const templates = FAUCET_USE_CASE_TEMPLATES[faucetType]
    if (!templates) return null
    if (initialLoading) {
      return <LoadingPage />
    }
    return (
      <div className="space-y-3">
        {templates.map((template, index) => (
          <div key={index} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="font-medium">{template.templateName}</div>
            <div className="text-sm text-gray-600 mt-1">{template.idealUseCase}</div>
          </div>
        ))}
      </div>
    )
  }

  const ConflictDetailsDialog = () => {
    if (!nameValidation.conflictingFaucets || nameValidation.conflictingFaucets.length === 0) {
      return null
    }
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowConflictDetails(true)}
          className="mt-2"
        >
          <Info className="h-4 w-4 mr-2" />
          View Conflict Details
        </Button>
        <Dialog open={showConflictDetails} onOpenChange={setShowConflictDetails}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Name Conflicts Found</DialogTitle>
              <DialogDescription>
                The name "{wizardState.formData.faucetName}" is already used by {nameValidation.conflictingFaucets.length} faucet(s) on this network:
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 space-y-3 max-h-60 overflow-y-auto">
              {nameValidation.conflictingFaucets.map((conflict: FaucetNameConflict, index: number) => (
                <div key={index} className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <span className="font-medium capitalize">{conflict.factoryType} Factory</span>
                    </div>
                    <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                      Conflict
                    </span>
                  </div>
                  <div className="mt-2 space-y-1 text-sm">
                    <div>
                      <span className="text-gray-500">Faucet:</span> {conflict.faucetAddress.slice(0, 8)}...{conflict.faucetAddress.slice(-6)}
                    </div>
                    <div>
                      <span className="text-gray-500">Owner:</span> {conflict.ownerAddress.slice(0, 8)}...{conflict.ownerAddress.slice(-6)}
                    </div>
                    <div>
                      <span className="text-gray-500">Factory:</span> {conflict.factoryAddress.slice(0, 8)}...{conflict.factoryAddress.slice(-6)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center space-x-2 mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <Info className="h-4 w-4 text-blue-600" />
              <span className="text-sm text-blue-700 dark:text-blue-300">
                Please choose a different name to avoid conflicts across factory types.
              </span>
            </div>
          </DialogContent>
        </Dialog>
      </>
    )
  }

  const EnhancedTokenSelector = () => (
    <Select
      value={wizardState.formData.showCustomTokenInput ? "custom" : wizardState.formData.selectedTokenAddress}
      onValueChange={handleTokenSelectionChange}
    >
      <SelectTrigger id="token-selector">
        <SelectValue placeholder={isTokensLoading ? "Loading tokens..." : "Select a token"}>
          {(() => {
            if (wizardState.formData.showCustomTokenInput && customTokenValidation.tokenInfo) {
              const token = customTokenValidation.tokenInfo
              return (
                <div className="flex items-center space-x-2">
                  <TokenImage token={token} size="sm" />
                  <span className="font-bold text-purple-600">{token.symbol}</span>
                  <span className="text-gray-500">({token.name})</span>
                  <span className="text-xs bg-purple-100 text-purple-800 px-1 rounded">Custom</span>
                </div>
              )
            }
            const selectedToken = availableTokens.find(t => t.address === wizardState.formData.selectedTokenAddress)
            if (selectedToken) {
              return (
                <div className="flex items-center space-x-2">
                  <TokenImage token={selectedToken} size="sm" />
                  <span className="font-bold text-blue-600">{selectedToken.symbol}</span>
                  <span className="text-gray-500">({selectedToken.name})</span>
                  {selectedToken.isNative && (
                    <span className="text-xs bg-blue-100 text-blue-800 px-1 rounded">Native</span>
                  )}
                </div>
              )
            }
            return "Select a token"
          })()}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {availableTokens.filter(token => token.isNative).map((token) => (
          <SelectItem key={token.address} value={token.address}>
            <div className="flex items-start space-x-2 py-1">
              <TokenImage token={token} size="sm" />
              <div className="flex flex-col min-w-0">
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-blue-600">{token.symbol}</span>
                  <span className="text-gray-500">({token.name})</span>
                  <span className="text-xs bg-blue-100 text-blue-800 px-1 rounded">Native</span>
                </div>
                {token.description && (
                  <span className="text-xs text-gray-400 mt-1 truncate">{token.description}</span>
                )}
              </div>
            </div>
          </SelectItem>
        ))}
        {availableTokens.some(t => t.isNative) && availableTokens.some(t => !t.isNative) && (
          <SelectItem disabled value="_divider_native" className="border-t border-gray-200 mt-1 pt-1">
            <span className="text-gray-400 text-xs">━━━ Other Tokens ━━━</span>
          </SelectItem>
        )}
        {availableTokens.filter(token => !token.isNative).map((token) => (
          <SelectItem key={token.address} value={token.address}>
            <div className="flex items-start space-x-2 py-1">
              <TokenImage token={token} size="sm" />
              <div className="flex flex-col min-w-0">
                <div className="flex items-center space-x-2">
                  <span className="font-bold">{token.symbol}</span>
                  <span className="text-gray-500">({token.name})</span>
                  <span className="text-xs text-gray-500">{token.decimals} decimals</span>
                </div>
                {token.description && (
                  <span className="text-xs text-gray-400 mt-1 truncate">{token.description}</span>
                )}
              </div>
            </div>
          </SelectItem>
        ))}
        <SelectItem disabled value="_divider_custom" className="border-t border-gray-200 mt-1 pt-1">
          <span className="text-gray-400 text-xs">━━━━━━━━━━━━━━━━━━━━</span>
        </SelectItem>
        <SelectItem value="custom">
          <div className="flex items-center space-x-2">
            <Plus className="h-4 w-4 text-purple-600" />
            <span className="font-medium text-purple-600">Add Custom Token</span>
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  )

  const renderFaucetTypeSelection = () => {
    const unavailableTypes = getUnavailableFaucetTypesForNetwork()
    return (
      <div className="space-y-6">
        {!isConnected && (
          <Alert className="border-red-500 bg-red-50 dark:bg-red-900/20">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertTitle className="text-red-700 dark:text-red-300">No Network Detected</AlertTitle>
            <AlertDescription className="text-red-700 dark:text-red-300">
              Please connect your wallet to get started.
              <div className="mt-2 flex flex-wrap gap-2">
                <Button onClick={connect} variant="outline" size="sm">
                  Connect Wallet
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}
        {isConnected && !currentNetwork && (
  <Alert className="border-red-500 bg-red-50 dark:bg-red-900/20">
    <AlertTriangle className="h-4 w-4 text-red-600" />
    <AlertTitle className="text-red-700 dark:text-red-300">Wrong Network Selected</AlertTitle>
    <AlertDescription className="text-red-700 dark:text-red-300">
      The current network (Chain ID: {effectiveChainId}) is not supported. 
      Please switch to Celo, Lisk, Arbitrum, or Base.
    </AlertDescription>
  </Alert>
)}
        {unavailableTypes.length > 0 && network && (
          <Alert className="border-orange-500 bg-orange-50 dark:bg-orange-900/20">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <AlertTitle className="text-orange-700 dark:text-orange-300">Limited Factory Support</AlertTitle>
            <AlertDescription className="text-orange-700 dark:text-orange-300">
              Some faucet types are not yet available on:
              <div className="flex items-center space-x-2 mt-2">
                <NetworkImage network={currentNetwork} size="xs" />
                <span>{currentNetwork?.name}</span>
              </div>
              <div className="mt-2 space-y-1">
                {unavailableTypes.map((type) => (
                  <div key={type} className="flex items-center space-x-2">
                    <XCircle className="h-3 w-3" />
                    <span className="capitalize">{type} Drop</span>
                  </div>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card
            className={`cursor-pointer border-2 transition-all ${!isFaucetTypeAvailableOnNetwork(FAUCET_TYPES.OPEN)
                ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                : wizardState.selectedFaucetType === FAUCET_TYPES.OPEN
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            onClick={() => isFaucetTypeAvailableOnNetwork(FAUCET_TYPES.OPEN) && selectFaucetType(FAUCET_TYPES.OPEN)}
          >
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Globe className={`h-5 w-5 ${isFaucetTypeAvailableOnNetwork(FAUCET_TYPES.OPEN) ? 'text-green-600' : 'text-gray-400'}`} />
                <CardTitle className="text-lg flex items-center space-x-2">
                  <span>Open Drop</span>
                  {!isFaucetTypeAvailableOnNetwork(FAUCET_TYPES.OPEN) && (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                </CardTitle>
              </div>
              <CardDescription>Anyone with a Drop Code</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Open faucet for wide distribution with drop code protection.
              </p>
              {!isFaucetTypeAvailableOnNetwork(FAUCET_TYPES.OPEN) && currentNetwork && (
                <div className="flex items-center space-x-2 mt-2">
                  <p className="text-xs text-red-600">Not available on</p>
                  <NetworkImage network={currentNetwork} size="xs" />
                  <span className="text-xs text-red-600">{currentNetwork.name}</span>
                </div>
              )}
            </CardContent>
          </Card>
          <Card
            className={`cursor-pointer border-2 transition-all ${!isFaucetTypeAvailableOnNetwork(FAUCET_TYPES.GATED)
                ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                : wizardState.selectedFaucetType === FAUCET_TYPES.GATED
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            onClick={() => isFaucetTypeAvailableOnNetwork(FAUCET_TYPES.GATED) && selectFaucetType(FAUCET_TYPES.GATED)}
          >
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Shield className={`h-5 w-5 ${isFaucetTypeAvailableOnNetwork(FAUCET_TYPES.GATED) ? 'text-orange-600' : 'text-gray-400'}`} />
                <CardTitle className="text-lg flex items-center space-x-2">
                  <span>Whitelist Drop</span>
                  {!isFaucetTypeAvailableOnNetwork(FAUCET_TYPES.GATED) && (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                </CardTitle>
              </div>
              <CardDescription>Only Selected Wallets</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Restricted faucet for specific wallet addresses only.
              </p>
              {!isFaucetTypeAvailableOnNetwork(FAUCET_TYPES.GATED) && currentNetwork && (
                <div className="flex items-center space-x-2 mt-2">
                  <p className="text-xs text-red-600">Not available on</p>
                  <NetworkImage network={currentNetwork} size="xs" />
                  <span className="text-xs text-red-600">{currentNetwork.name}</span>
                </div>
              )}
            </CardContent>
          </Card>
          <Card
            className={`cursor-pointer border-2 transition-all ${!isFaucetTypeAvailableOnNetwork(FAUCET_TYPES.CUSTOM)
                ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                : wizardState.selectedFaucetType === FAUCET_TYPES.CUSTOM
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            onClick={() => isFaucetTypeAvailableOnNetwork(FAUCET_TYPES.CUSTOM) && selectFaucetType(FAUCET_TYPES.CUSTOM)}
          >
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Settings className={`h-5 w-5 ${isFaucetTypeAvailableOnNetwork(FAUCET_TYPES.CUSTOM) ? 'text-purple-600' : 'text-gray-400'}`} />
                <CardTitle className="text-lg flex items-center space-x-2">
                  <span>Custom Drop</span>
                  {!isFaucetTypeAvailableOnNetwork(FAUCET_TYPES.CUSTOM) && (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                </CardTitle>
              </div>
              <CardDescription>Advanced Customization</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Fully customizable faucet with advanced logic and integrations.
              </p>
              {!isFaucetTypeAvailableOnNetwork(FAUCET_TYPES.CUSTOM) && currentNetwork && (
                <div className="flex items-center space-x-2 mt-2">
                  <p className="text-xs text-red-600">Not available on</p>
                  <NetworkImage network={currentNetwork} size="xs" />
                  <span className="text-xs text-red-600">{currentNetwork.name}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        {wizardState.selectedFaucetType && (
          <>
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>
                {wizardState.selectedFaucetType === FAUCET_TYPES.OPEN ? "Open Drop Selected" :
                  wizardState.selectedFaucetType === FAUCET_TYPES.GATED ? "Whitelist Drop Selected" :
                    "Custom Drop Selected"}
              </AlertTitle>
              <AlertDescription>
                {wizardState.selectedFaucetType === FAUCET_TYPES.OPEN
                  ? "This faucet will be accessible to anyone with a drop code for security."
                  : wizardState.selectedFaucetType === FAUCET_TYPES.GATED
                    ? "This faucet will be restricted to specific wallet addresses that you whitelist."
                    : "This faucet offers advanced customization options and is perfect for complex distribution scenarios."}
              </AlertDescription>
            </Alert>
            <Card className="hidden md:block">
              <CardHeader>
                <CardTitle className="text-lg">Available Use Cases</CardTitle>
                <CardDescription>
                  These are common use cases for {
                    wizardState.selectedFaucetType === FAUCET_TYPES.OPEN ? "open drop" :
                      wizardState.selectedFaucetType === FAUCET_TYPES.GATED ? "whitelist drop" :
                        "custom drop"
                  } faucets
                </CardDescription>
              </CardHeader>
              <CardContent>
                {renderUseCaseTemplates(wizardState.selectedFaucetType as FaucetType)}
              </CardContent>
            </Card>
            <div className="md:hidden">
              <Dialog open={wizardState.showUseCasesDialog} onOpenChange={(open) =>
                setWizardState(prev => ({ ...prev, showUseCasesDialog: open }))}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full">
                    <Info className="h-4 w-4 mr-2" />
                    View Use Cases
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Available Use Cases</DialogTitle>
                    <DialogDescription>
                      Common use cases for {
                        wizardState.selectedFaucetType === FAUCET_TYPES.OPEN ? "open drop" :
                          wizardState.selectedFaucetType === FAUCET_TYPES.GATED ? "whitelist drop" :
                            "custom drop"
                      } faucets
                    </DialogDescription>
                  </DialogHeader>
                  <div className="mt-4">
                    {renderUseCaseTemplates(wizardState.selectedFaucetType as FaucetType)}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            {wizardState.selectedFaucetType === FAUCET_TYPES.CUSTOM && (
              <Alert className="border-purple-500 bg-purple-50 dark:bg-purple-900/20">
                <Zap className="h-4 w-4 text-purple-600" />
                <AlertTitle className="text-purple-700 dark:text-purple-300">Advanced Features</AlertTitle>
                <AlertDescription className="text-purple-700 dark:text-purple-300">
                  Custom faucets provide maximum flexibility with features like dynamic claim amounts,
                  complex eligibility rules, API integrations, and custom distribution logic.
                </AlertDescription>
              </Alert>
            )}
          </>
        )}
      </div>
    )
  }

  const renderConfigurationDetails = () => (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="faucet-name">Faucet Name</Label>
          <div className="relative">
            <Input
              id="faucet-name"
              placeholder="Enter a unique name for your faucet (e.g., Community Airdrop)"
              value={wizardState.formData.faucetName}
              onChange={(e) => setWizardState(prev => ({
                ...prev,
                formData: { ...prev.formData, faucetName: e.target.value }
              }))}
              className={
                wizardState.formData.faucetName.length >= 3 && nameValidation.validationError
                  ? "border-red-500 focus:border-red-500"
                  : wizardState.formData.faucetName.length >= 3 && nameValidation.isNameAvailable
                    ? "border-green-500 focus:border-green-500"
                    : ""
              }
            />
            {wizardState.formData.faucetName.length >= 3 && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                {nameValidation.isValidating ? (
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                ) : nameValidation.isNameAvailable ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : nameValidation.validationError ? (
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                ) : null}
              </div>
            )}
          </div>
          {wizardState.formData.faucetName.length >= 3 && nameValidation.validationError && (
            <div className="space-y-2">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {nameValidation.validationError}
                </AlertDescription>
              </Alert>
              {nameValidation.conflictingFaucets && nameValidation.conflictingFaucets.length > 0 && (
                <ConflictDetailsDialog />
              )}
            </div>
          )}
          {wizardState.formData.faucetName.length >= 3 && nameValidation.isNameAvailable && (
            <Alert className="border-green-500 bg-green-50 dark:bg-green-900/20">
              <Check className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700 dark:text-green-300">
                <div className="flex items-center space-x-2">
                  <span>Great! This name (<b>{wizardState.formData.faucetName}</b>) is available across all factory types on</span>
                  {currentNetwork && <NetworkImage network={currentNetwork} size="xs" />}
                  <span>{currentNetwork?.name}</span>
                </div>
                {nameValidation.validationWarning && (
                  <div className="mt-1 text-xs text-yellow-700">
                    Note: {nameValidation.validationWarning}
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}
          {wizardState.formData.faucetName.length > 0 && wizardState.formData.faucetName.length < 3 && (
            <p className="text-sm text-gray-500">
              Name must be at least 3 characters long
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="token-selector">Select Token</Label>
          <EnhancedTokenSelector />
          {wizardState.formData.showCustomTokenInput && (
            <div className="space-y-3 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200">
              <div className="flex items-center justify-between">
                <Label htmlFor="custom-token-address" className="text-purple-700 dark:text-purple-300">
                  Custom Token Contract Address
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setWizardState(prev => ({
                    ...prev,
                    formData: {
                      ...prev.formData,
                      showCustomTokenInput: false,
                      selectedTokenAddress: availableTokens[0]?.address || '',
                    }
                  }))}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="relative">
                <Input
                  id="custom-token-address"
                  placeholder="Enter ERC-20 token contract address (0x...)"
                  value={wizardState.formData.customTokenAddress}
                  onChange={(e) => setWizardState(prev => ({
                    ...prev,
                    formData: { ...prev.formData, customTokenAddress: e.target.value }
                  }))}
                  className={
                    wizardState.formData.customTokenAddress.length > 0 && customTokenValidation.validationError
                      ? "border-red-500 focus:border-red-500"
                      : wizardState.formData.customTokenAddress.length > 0 && customTokenValidation.isValid
                        ? "border-green-500 focus:border-green-500"
                        : ""
                  }
                />
                {wizardState.formData.customTokenAddress.length > 0 && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    {customTokenValidation.isValidating ? (
                      <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
                    ) : customTokenValidation.isValid ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : customTokenValidation.validationError ? (
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                    ) : null}
                  </div>
                )}
              </div>
              {wizardState.formData.customTokenAddress.length > 0 && customTokenValidation.validationError && (
                <Alert variant="destructive" className="mt-2">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {customTokenValidation.validationError}
                  </AlertDescription>
                </Alert>
              )}
              {wizardState.formData.customTokenAddress.length > 0 && customTokenValidation.isValid && customTokenValidation.tokenInfo && (
                <Alert className="border-green-500 bg-green-50 dark:bg-green-900/20 mt-2">
                  <Check className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-700 dark:text-green-300">
                    <div className="space-y-1">
                      <div className="font-medium">Token Found:</div>
                      <div className="flex items-center space-x-2 text-sm">
                        <TokenImage token={customTokenValidation.tokenInfo} size="xs" />
                        <span className="font-bold">{customTokenValidation.tokenInfo.symbol}</span>
                        <span>({customTokenValidation.tokenInfo.name})</span>
                        <span className="text-xs bg-green-100 text-green-800 px-1 rounded">
                          {customTokenValidation.tokenInfo.decimals} decimals
                        </span>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
              <div className="text-xs text-purple-600 dark:text-purple-400">
                <Info className="h-3 w-3 inline mr-1" />
                We'll automatically fetch the token details from the contract. Make sure the token follows ERC-20 standard.
              </div>
            </div>
          )}
          {!wizardState.formData.showCustomTokenInput && wizardState.formData.selectedTokenAddress && (
            <div className="text-sm text-gray-600">
              {(() => {
                const selectedToken = availableTokens.find(t => t.address === wizardState.formData.selectedTokenAddress)
                return selectedToken ? (
                  <div className="flex items-center space-x-2 p-3 bg-gray-50 dark:bg-gray-800 rounded">
                    <TokenImage token={selectedToken} size="md" />
                    <div className="flex flex-col">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold">{selectedToken.symbol}</span>
                        <span className="text-gray-500">({selectedToken.name})</span>
                        <span className="text-xs text-gray-500">{selectedToken.decimals} decimals</span>
                        {selectedToken.isNative && (
                          <span className="text-xs bg-blue-100 text-blue-800 px-1 rounded">Native</span>
                        )}
                      </div>
                      {selectedToken.description && (
                        <span className="text-xs text-gray-400 mt-1">{selectedToken.description}</span>
                      )}
                    </div>
                  </div>
                ) : null
              })()}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="faucet-description">
            Description (Optional)
          </Label>
          <Textarea
            id="faucet-description"
            placeholder={currentNetwork && address 
              ? `This is a faucet on ${currentNetwork.name} by ${address.slice(0, 6)}...${address.slice(-4)}`
              : "Describe your faucet, its purpose, and how users can benefit from it..."
            }
            value={faucetDescription}
            onChange={(e) => setFaucetDescription(e.target.value)}
            rows={4}
            className="text-xs sm:text-sm"
          />
          <p className="text-xs text-muted-foreground">
            {faucetDescription.trim() 
              ? "Custom description will be saved"
              : "If left empty, a default description will be generated"
            }
          </p>
        </div>

        {/* Image with default preview */}
        <div className="space-y-2">
          <Label htmlFor="faucet-image">
            Faucet Image (Optional)
          </Label>
            
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById('image-file-input')?.click()}
                disabled={isUploadingImage}
                className="flex-1"
              >
                {isUploadingImage ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Image
                  </>
                )}
              </Button>
                
              {selectedImageFile && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setSelectedImageFile(null)
                    setFaucetImageUrl("")
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            <input
              id="image-file-input"
              type="file"
              accept="image/*"
              onChange={handleImageFileChange}
              className="hidden"
            />

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or paste URL
                </span>
              </div>
            </div>

            <Input
              id="faucet-image-url"
              placeholder="https://example.com/your-image.png"
              value={faucetImageUrl}
              onChange={(e) => setFaucetImageUrl(e.target.value)}
              disabled={isUploadingImage || !!selectedImageFile}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            {faucetImageUrl.trim() || selectedImageFile
              ? "Custom image will be used"
              : "If left empty, the FaucetDrops logo will be used"
            }
          </p>

          {/* Preview */}
          {(faucetImageUrl || !faucetImageUrl) && (
            <div className="mt-3 p-3 border rounded-lg bg-gray-50 dark:bg-gray-800">
              <p className="text-xs font-medium mb-2 flex items-center gap-2">
                <ImageIcon className="h-3 w-3" />
                {faucetImageUrl ? "Custom Image Preview:" : "Default Image:"}
              </p>
              <img 
                src={faucetImageUrl || DEFAULT_FAUCET_IMAGE}
                alt="Faucet preview" 
                className="max-h-40 rounded object-contain mx-auto"
                onError={() => {
                  if (faucetImageUrl) {
                    toast.error("The image cannot be loaded. Default will be useding a file.")
                  }
                }}
              />
            </div>
          )}
        </div>

        {wizardState.selectedFaucetType === FAUCET_TYPES.OPEN && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="drop-code-toggle">Require Drop Code</Label>
              <Switch
                id="drop-code-toggle"
                disabled
                checked={wizardState.formData.requiresDropCode}
                onCheckedChange={(checked) => setWizardState(prev => ({
                  ...prev,
                  formData: { ...prev.formData, requiresDropCode: checked }
                }))}
              />
            </div>
            <p className="text-sm text-gray-600">
              Drop codes provide additional security for open faucets
            </p>
          </div>
        )}
        {wizardState.selectedFaucetType === FAUCET_TYPES.CUSTOM && (
          <Alert className="border-purple-500 bg-purple-50 dark:bg-purple-900/20">
            <Settings className="h-4 w-4 text-purple-600" />
            <AlertTitle className="text-purple-700 dark:text-purple-300">Custom Configuration</AlertTitle>
            <AlertDescription className="text-purple-700 dark:text-purple-300">
              After creation, you'll have access to advanced settings including custom claim amounts,
              dynamic distribution rules, and API endpoints for external integrations.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  )

  const renderReviewAndCreate = () => {
    const selectedTokenConfig = getSelectedTokenConfiguration()
    const mappedFactoryType = FAUCET_TYPE_TO_FACTORY_TYPE_MAPPING[wizardState.selectedFaucetType as FaucetType]
    const factoryAddress = getFactoryAddress(mappedFactoryType, currentNetwork as any)
    const finalTokenAddress = getFinalTokenAddress()
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Faucet Configuration Summary</CardTitle>
            <CardDescription>Review your configuration before creating the faucet</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-500">Network</Label>
                <div className="flex items-center space-x-2">
                  {currentNetwork && <NetworkImage network={currentNetwork} size="sm" />}
                  <span>{currentNetwork?.name || "Unknown Network"}</span>
                  {currentNetwork?.isTestnet && (
                    <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
                      Testnet
                    </span>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-500">Faucet Type</Label>
                <p className="flex items-center space-x-2">
                  {wizardState.selectedFaucetType === FAUCET_TYPES.OPEN ? (
                    <>
                      <Globe className="h-4 w-4 text-green-600" />
                      <span>Open Drop</span>
                    </>
                  ) : wizardState.selectedFaucetType === FAUCET_TYPES.GATED ? (
                    <>
                      <Shield className="h-4 w-4 text-orange-600" />
                      <span>Whitelist Drop</span>
                    </>
                  ) : (
                    <>
                      <Settings className="h-4 w-4 text-purple-600" />
                      <span>Custom Drop</span>
                    </>
                  )}
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-500">Factory Address</Label>
                <p className="text-sm font-mono text-gray-600">
                  {factoryAddress ? `${factoryAddress.slice(0, 6)}...${factoryAddress.slice(-4)}` : 'N/A'}
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-500">Faucet Name</Label>
                <p className="flex items-center space-x-2">
                  <span>{wizardState.formData.faucetName}</span>
                  {nameValidation.isNameAvailable && (
                    <Check className="h-4 w-4 text-green-500" />
                  )}
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-500">Token</Label>
                <div className="flex items-center space-x-2">
                  {selectedTokenConfig && <TokenImage token={selectedTokenConfig} size="sm" />}
                  <span className="font-bold">{selectedTokenConfig?.symbol}</span>
                  <span className="text-gray-500">({selectedTokenConfig?.name})</span>
                  {selectedTokenConfig?.isNative && (
                    <span className="text-xs bg-blue-100 text-blue-800 px-1 rounded">Native</span>
                  )}
                  {selectedTokenConfig?.isCustom && (
                    <span className="text-xs bg-purple-100 text-purple-800 px-1 rounded">Custom</span>
                  )}
                </div>
                <p className="text-xs text-gray-500 font-mono">
                  {finalTokenAddress.slice(0, 8)}...{finalTokenAddress.slice(-6)}
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-500">Token Source</Label>
                <p className="flex items-center space-x-2">
                  {wizardState.formData.showCustomTokenInput ? (
                    <>
                      <Plus className="h-4 w-4 text-purple-600" />
                      <span>Custom Contract</span>
                    </>
                  ) : (
                    <>
                      <Coins className="h-4 w-4 text-blue-600" />
                      <span>Predefined Token</span>
                    </>
                  )}
                </p>
              </div>
              {wizardState.selectedFaucetType === FAUCET_TYPES.OPEN && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-500">Drop Code Required</Label>
                  <p className="flex items-center space-x-2">
                    {wizardState.formData.requiresDropCode ? (
                      <>
                        <Key className="h-4 w-4 text-green-600" />
                        <span>Yes</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-4 w-4 text-orange-600" />
                        <span>No</span>
                      </>
                    )}
                  </p>
                </div>
              )}
              {wizardState.selectedFaucetType === FAUCET_TYPES.CUSTOM && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-500">Advanced Features</Label>
                  <p className="flex items-center space-x-2">
                    <Zap className="h-4 w-4 text-purple-600" />
                    <span>Enabled</span>
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        {creationError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{creationError}</AlertDescription>
          </Alert>
        )}
        {!factoryAddress && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Factory Not Available</AlertTitle>
            <AlertDescription>
              <div className="flex items-center space-x-2">
                <span>{wizardState.selectedFaucetType} faucets are not available on</span>
                {currentNetwork && <NetworkImage network={currentNetwork} size="xs" />}
                <span>{currentNetwork?.name}. Please select a different faucet type or switch networks.</span>
              </div>
            </AlertDescription>
          </Alert>
        )}
        {wizardState.selectedFaucetType === FAUCET_TYPES.CUSTOM && (
          <Alert className="border-purple-500 bg-purple-50 dark:bg-purple-900/20">
            <Settings className="h-4 w-4 text-purple-600" />
            <AlertTitle className="text-purple-700 dark:text-purple-300">Next Steps</AlertTitle>
            <AlertDescription className="text-purple-700 dark:text-purple-300">
              After creation, you'll be able to configure advanced settings including custom eligibility rules,
              dynamic claim amounts, API integrations, and more through the faucet management interface.
            </AlertDescription>
          </Alert>
        )}
        {wizardState.formData.showCustomTokenInput && (
          <Alert className="border-purple-500 bg-purple-50 dark:bg-purple-900/20">
            <Info className="h-4 w-4 text-purple-600" />
            <AlertTitle className="text-purple-700 dark:text-purple-300">Custom Token Notice</AlertTitle>
            <AlertDescription className="text-purple-700 dark:text-purple-300">
              You're using a custom token contract. Please ensure you have sufficient tokens in your wallet
              to fund the faucet and that the contract is legitimate and follows ERC-20 standards.
            </AlertDescription>
          </Alert>
        )}
      </div>
    )
  }

  const renderCurrentWizardStep = () => {
    switch (wizardState.currentStep) {
      case 1: return renderFaucetTypeSelection()
      case 2: return renderConfigurationDetails()
      case 3: return renderReviewAndCreate()
      default: return renderFaucetTypeSelection()
    }
  }

  const canProceedToNextStep = (): boolean => {
    switch (wizardState.currentStep) {
      case 1:
        return wizardState.selectedFaucetType !== '' &&
          isFaucetTypeAvailableOnNetwork(wizardState.selectedFaucetType as FaucetType)
      case 2:
        const hasValidName = wizardState.formData.faucetName.trim() !== '' && nameValidation.isNameAvailable
        const hasValidToken = wizardState.formData.showCustomTokenInput
          ? customTokenValidation.isValid
          : wizardState.formData.selectedTokenAddress !== ''
        return hasValidName && hasValidToken
      case 3:
        const mappedFactoryType = FAUCET_TYPE_TO_FACTORY_TYPE_MAPPING[wizardState.selectedFaucetType as FaucetType]
        const factoryAddress = getFactoryAddress(mappedFactoryType, currentNetwork as any)
        return !!factoryAddress
      default:
        return false
    }
  }

  const isActionDisabled = isFaucetCreating || !effectiveChainId || !currentNetwork

  if (initialLoading) {
    return <LoadingPage />
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Header pageTitle="Create Faucet" />
        </div>
        <div className="max-w-4xl mx-auto mb-8">
          <div className="flex items-center justify-between mb-4">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step <= wizardState.currentStep ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                    }`}
                >
                  {step}
                </div>
                {step < 3 && (
                  <div className={`w-24 h-1 mx-2 ${step < wizardState.currentStep ? 'bg-blue-600' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">Step {wizardState.currentStep} of 3</p>
          </div>
        </div>
        <div className="max-w-4xl mx-auto">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl">{getWizardStepTitle(wizardState.currentStep)}</CardTitle>
              <CardDescription className="text-lg">{getWizardStepDescription(wizardState.currentStep)}</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              {renderCurrentWizardStep()}
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button
                variant="outline"
                onClick={returnToPreviousStep}
                disabled={wizardState.currentStep === 1}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Previous</span>
              </Button>
              {wizardState.currentStep < 3 ? (
                <Button
                  onClick={proceedToNextStep}
                  disabled={!canProceedToNextStep()}
                  className="flex items-center space-x-2"
                >
                  <span>Next</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleFaucetCreation}
                  disabled={isActionDisabled || !canProceedToNextStep()}
                  className="flex items-center space-x-2"
                >
                  {isFaucetCreating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : !isConnected ? (
                    <span>Connect & Create Faucet</span>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      <span>Create Faucet</span>
                    </>
                  )}
                </Button>
              )}
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  )
}