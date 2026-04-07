"use client"
import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react"
import { ZeroAddress, FallbackProvider, JsonRpcProvider } from "ethers"
import { useToast } from "@/hooks/use-toast"
import { useWallet } from "@/hooks/use-wallet"

export interface Network {
  name: string
  symbol: string
  chainId: number
  rpcUrl: string | string[]          // ← Now supports array for automatic fallbacks
  blockExplorerUrls: string
  explorerUrl?: string
  color: string
  logoUrl: string
  iconUrl?: string
  factoryAddresses: string[]
  factories: {
    dropcode?: string
    droplist?: string
    custom?: string
    quest?: string
    quiz?: string
  }
  tokenAddress: string
  nativeCurrency: {
    name: string
    symbol: string
    decimals: number
  }
  isTestnet?: boolean
  defaultTokens?: {
    address: string;
    name: string;
    symbol: string;
    decimals: number;
  }[];
}

// =============================================
// UPDATED NETWORKS WITH MULTIPLE RPC FALLBACKS
// =============================================
export const networks: Network[] = [
  {
    name: "Celo",
    symbol: "CELO",
    chainId: 42220,
    rpcUrl: [
      "https://forno.celo.org",
      "https://celo-mainnet.g.alchemy.com/v2/sXHCrL5-xwYkPtkRC_WTEZHvIkOVTbw-",
      "https://celo-mainnet.infura.io/v3/e9fa8c3350054dafa40019a5b604679f",
      "https://rpc.ankr.com/celo",
      "https://1rpc.io/celo",
      "https://celo.drpc.org",
      "https://celo-rpc.publicnode.com"
    ],
    blockExplorerUrls: "https://celoscan.io",
    color: "#35D07F",
    logoUrl: "/celo.png",
    iconUrl: "/celo.png",
    factoryAddresses: [
      "0x17cFed7fEce35a9A71D60Fbb5CA52237103A21FB",
      "0xB8De8f37B263324C44FD4874a7FB7A0C59D8C58E",
      "0xc26c4Ea50fd3b63B6564A5963fdE4a3A474d4024",
      "0x9D6f441b31FBa22700bb3217229eb89b13FB49de",
      "0xE3Ac30fa32E727386a147Fe08b4899Da4115202f",
      "0xF8707b53a2bEc818E96471DDdb34a09F28E0dE6D",
      "0x8D1306b3970278b3AB64D1CE75377BDdf00f61da",
      "0x8cA5975Ded3B2f93E188c05dD6eb16d89b14aeA5",
      "0xdC9b027B6453560ce8C4390E0B609b343a8eBd62",
      "0xc9c89f695C7fa9D9AbA3B297C9b0d86C5A74f534"
    ],
    factories: {
      droplist: "0xF8707b53a2bEc818E96471DDdb34a09F28E0dE6D",
      dropcode: "0x8D1306b3970278b3AB64D1CE75377BDdf00f61da",
      custom: "0x8cA5975Ded3B2f93E188c05dD6eb16d89b14aeA5",
      quest: "0x2Eb9692785e089DD7588b0D3220B5dD154eF2699",
      quiz: "0x45aF94C51188C2f1cBAa060Bd9Ee4a37e416Ed1F"
    },
    tokenAddress: "0x471EcE3750Da237f93B8E339c536989b8978a438",
    nativeCurrency: {
      name: "Celo",
      symbol: "CELO",
      decimals: 18,
    },
    isTestnet: false,
  },
  {
    name: "Lisk",
    symbol: "LSK",
    chainId: 1135,
    rpcUrl: [
      "https://rpc.api.lisk.com",
      "https://lisk.drpc.org",
      "https://1rpc.io/lisk"
    ],
    blockExplorerUrls: "https://blockscout.lisk.com",
    explorerUrl: "https://blockscout.lisk.com",
    color: "#0D4477",
    logoUrl: "/lsk.png",
    iconUrl: "/lsk.png",
    factoryAddresses: [
      "0x96E9911df17e94F7048cCbF7eccc8D9b5eDeCb5C",
      "0x4F5Cf906b9b2Bf4245dba9F7d2d7F086a2a441C2",
      "0x21E855A5f0E6cF8d0CfE8780eb18e818950dafb7",
      "0xd6Cb67dF496fF739c4eBA2448C1B0B44F4Cf0a7C",
      "0x0837EACf85472891F350cba74937cB02D90E60A4"
    ],
    factories: {
      droplist: "0x0837EACf85472891F350cba74937cB02D90E60A4",
      dropcode: "0xd6Cb67dF496fF739c4eBA2448C1B0B44F4Cf0a7C",
      custom: "0x21E855A5f0E6cF8d0CfE8780eb18e818950dafb7",
      quest: "0xE9a7637f11F22c55061936Bc97b9aFEAC2e93C2E",
      quiz: "0x8BD9AD5C66Ca2BE1A728e4d139d92103615bcA7C"  
    },
    tokenAddress: ZeroAddress,
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
    isTestnet: false,
  },
  {
    name: "Arbitrum",
    symbol: "ARB",
    chainId: 42161,
    rpcUrl: [
      "https://arb1.arbitrum.io/rpc",
      "https://arb-mainnet.g.alchemy.com/v2/sXHCrL5-xwYkPtkRC_WTEZHvIkOVTbw-",
      "https://arbitrum.infura.io/v3/e9fa8c3350054dafa40019a5b604679f",
      "https://rpc.ankr.com/arbitrum",
      "https://1rpc.io/arb",
      "https://arbitrum.drpc.org",
      "https://arbitrum-one-rpc.publicnode.com"
    ],
    blockExplorerUrls: "https://arbiscan.io",
    explorerUrl: "https://arbiscan.io",
    color: "#28A0F0",
    logoUrl: "/arb.jpeg",
    iconUrl: "/arb.jpeg",
    factoryAddresses: [
      "0x0a5C19B5c0f4B9260f0F8966d26bC05AAea2009C",
      "0x42355492298A89eb1EF7FB2fFE4555D979f1Eee9",
      "0x9D6f441b31FBa22700bb3217229eb89b13FB49de"
    ],
    factories: {
      droplist: "0x0a5C19B5c0f4B9260f0F8966d26bC05AAea2009C",
      dropcode: "0x42355492298A89eb1EF7FB2fFE4555D979f1Eee9",
      custom: "0x9D6f441b31FBa22700bb3217229eb89b13FB49de",
      quest: "0x069ad2047FaEC364eb5009E8E783Ec1D9ae08629",
      quiz: "0x3C4ce82625Aa9dc0Efb199bCf5553Af32d27e555"
    },
    tokenAddress: ZeroAddress,
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
    isTestnet: false,
  },
  {
    name: "Base",
    symbol: "BASE",
    chainId: 8453,
    rpcUrl: [
      "https://base.publicnode.com",
      "https://base-mainnet.g.alchemy.com/v2/sXHCrL5-xwYkPtkRC_WTEZHvIkOVTbw-",
      "https://mainnet.base.org",
      "https://rpc.ankr.com/base",
      "https://1rpc.io/base",
      "https://base-mainnet.infura.io/v3/e9fa8c3350054dafa40019a5b604679f",
      "https://base.drpc.org"
    ],
    blockExplorerUrls: "https://basescan.org",
    explorerUrl: "https://basescan.org",
    color: "#0052FF",
    logoUrl: "/base.png",
    iconUrl: "/base.png",
    factoryAddresses: [
      "0x945431302922b69D500671201CEE62900624C6d5",
      "0xda191fb5Ca50fC95226f7FC91C792927FC968CA9",
      "0x587b840140321DD8002111282748acAdaa8fA206"
    ],
    factories: {
      droplist: "0x945431302922b69D500671201CEE62900624C6d5",
      dropcode: "0xda191fb5Ca50fC95226f7FC91C792927FC968CA9",
      custom: "0x587b840140321DD8002111282748acAdaa8fA206",
      quest: "0xb0B955e9B4a98A1323cE099A97632D5c4fc5d210",
      quiz: "0xE88028BC2bF2C4bb6eC6C0587d3248b79cAA5198"
    },
    tokenAddress: ZeroAddress,
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
    isTestnet: false,
  },
  {
    name: "BNB",
    symbol: "BNB",
    chainId: 56,
    rpcUrl: [
      "https://bnb-mainnet.g.alchemy.com/v2/sXHCrL5-xwYkPtkRC_WTEZHvIkOVTbw-", // your Alchemy key (fastest)
      "https://bsc-dataseed.binance.org/",
      "https://rpc.ankr.com/bsc",
      "https://1rpc.io/bnb",
      "https://bsc-mainnet.infura.io/v3/e9fa8c3350054dafa40019a5b604679f",
      "https://bsc.publicnode.com",
      "https://bsc.drpc.org"
    ],
    blockExplorerUrls: "https://bscscan.com",
    explorerUrl: "https://bscscan.com",
    color: "#F3BA2F",
    logoUrl: "/bnb.jpg",
    iconUrl: "/bnb.jpg",
    factoryAddresses: [
      "0xFE7DB2549d0c03A4E3557e77c8d798585dD80Cc1",
      "0x0F779235237Fc136c6EE9dD9bC2545404CDeAB36",
      "0x4B8c7A12660C4847c65662a953F517198fBFc0ED"
    ],
    factories: {
      droplist: "0x4B8c7A12660C4847c65662a953F517198fBFc0ED",
      dropcode: "0xFE7DB2549d0c03A4E3557e77c8d798585dD80Cc1",
      custom: "0x0F779235237Fc136c6EE9dD9bC2545404CDeAB36",
      quest: "0xBcA0AB3a9705C82DfBb92c4BAcFd5C2175511d54",
      quiz: "0xBfbE657a1FB5Fbc1fFadfB5A79EBAfC7D2637d06"
    },
    tokenAddress: ZeroAddress,
    nativeCurrency: {
      name: "BNB",
      symbol: "BNB",
      decimals: 18,
    },
    isTestnet: false,
  },
  {
    name: "Solana Devnet",
    symbol: "SOL",
    chainId: 102, // Keep this as 101 so the backend router catches it
    rpcUrl: [
      "https://api.devnet.solana.com", // 👈 Devnet RPC
    ],
    blockExplorerUrls: "https://solscan.io/?cluster=devnet", // 👈 Appends cluster=devnet
    color: "#14F195",
    logoUrl: "/solana.png",
    iconUrl: "/solana.png",
    factoryAddresses: [],
    factories: {
      dropcode: "",
      quest: "719GaXbsBWwskSVKZDykUMX6mur7BiCVjNSSWS7KMwtp", 
      quiz: "719GaXbsBWwskSVKZDykUMX6mur7BiCVjNSSWS7KMwtp"
    },
    tokenAddress: "11111111111111111111111111111111", // Native SOL Mint
    nativeCurrency: {
      name: "Solana",
      symbol: "SOL",
      decimals: 9,
    },
    isTestnet: true, // 👈 Marks it as a testnet in your UI
  },
]

// =============================================
// NEW HELPER FUNCTIONS (RPC fallback support)
// =============================================

/**
 * Returns all RPC URLs for a network as an array (always safe)
 */
export function getRpcUrls(network: Network | null): string[] {
  if (!network) return []
  return Array.isArray(network.rpcUrl)
    ? network.rpcUrl.filter(Boolean)
    : [network.rpcUrl].filter(Boolean)
}

/**
 * Returns the primary (fastest) RPC URL
 */
export function getPrimaryRpcUrl(network: Network | null): string {
  return getRpcUrls(network)[0] || ""
}

/**
 * Creates an ethers FallbackProvider with automatic failover
 * (use this in your wallet hooks or contract calls for 429/rate-limit protection)
 */
export function createFallbackProvider(network: Network | null) {
  const urls = getRpcUrls(network)
  if (urls.length === 0) return null

  const providers = urls.map((url) => new JsonRpcProvider(url))
  return new FallbackProvider(providers, 1) // quorum = 1
}

interface NetworkContextType {
  network: Network | null
  networks: Network[]
  setNetwork: (network: Network) => void
  switchNetwork: (chainId: number) => Promise<void>
  getLatestFactoryAddress: (network?: Network) => string | null
  getFactoryAddress: (factoryType: 'dropcode' | 'droplist' | 'custom' | 'quest' | 'quiz', network?: Network) => string | null
  isSwitchingNetwork: boolean
  currentChainId: number | null
  isConnecting: boolean
}

const NetworkContext = createContext<NetworkContextType>({
  network: null,
  networks: networks,
  setNetwork: () => {},
  switchNetwork: async () => {},
  getLatestFactoryAddress: () => null,
  getFactoryAddress: () => null,
  isSwitchingNetwork: false,
  currentChainId: null,
  isConnecting: false,
})

export function NetworkProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast()
  const [network, setNetworkState] = useState<Network | null>(null)
  const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  
  const { chainId: rawChainId, address, switchChain } = useWallet()
  
  // Parse chainId to number early (handle hex or decimal string)
  const parseChainId = (id: string | number | null | undefined): number | null => {
    if (!id) return null
    const idStr = String(id)
    if (idStr.startsWith('0x')) {
      const parsed = parseInt(idStr, 16)
      console.log(`[parseChainId] Hex parse: '${idStr}' -> ${parsed}`)
      return isNaN(parsed) ? null : parsed
    } else {
      const parsed = Number(idStr)
      console.log(`[parseChainId] Decimal parse: '${idStr}' -> ${parsed}`)
      return isNaN(parsed) ? null : parsed
    }
  }
  
  const currentChainId = parseChainId(rawChainId)
  
  // Use ref to always have fresh values - update synchronously on every render
  const walletRef = useRef({ address, chainId: rawChainId, switchChain })
  walletRef.current = { address, chainId: rawChainId, switchChain }

  // Debug: Log network state changes
  useEffect(() => {
    console.log(`[NetworkProvider] State:`, {
      networkName: network?.name,
      networkChainId: network?.chainId,
      rawChainId,
      parsedChainId: currentChainId,
      address,
      hasAddress: !!address,
      isSwitchingNetwork,
      isConnecting,
      walletRef: walletRef.current
    })
  }, [network, rawChainId, currentChainId, address, isSwitchingNetwork, isConnecting])

  // FIXED: Separate effect for connection state (runs when address changes, before chainId)
  useEffect(() => {
    console.log(`[NetworkProvider] Connection effect:`, { rawChainId, parsedChainId: currentChainId, address })
    if (address && currentChainId === null) {
      console.log(`[NetworkProvider] ⏳ Wallet connecting... (address ready, awaiting valid chainId)`)
      setIsConnecting(true)
    } else if (!address) {
      console.log(`[NetworkProvider] ❌ No wallet connected`)
      setIsConnecting(false)
      setNetworkState(null)
    }
  }, [address, rawChainId, currentChainId])

  // FIXED: Dedicated effect for chainId updates (triggers network set/reset)
  useEffect(() => {
    console.log(`[NetworkProvider] chainId effect:`, { rawChainId, parsedChainId: currentChainId, hasAddress: !!address, isConnecting })
    
    // If wallet is connected but no valid chainId yet, keep waiting
    if (currentChainId === null) {
      if (address) {
        console.log(`[NetworkProvider] ⏳ Waiting for valid chainId... (raw: ${rawChainId})`)
        return
      }
      // If no wallet connected, clear everything
      console.log(`[NetworkProvider] ❌ No chainId and no address`)
      setNetworkState(null)
      return
    }
    
    setIsConnecting(false) // Clear connecting state
    
    const currentNetwork = networks.find((n) => n.chainId === currentChainId)
    
    if (currentNetwork) {
      console.log(`[NetworkProvider] ✅ Setting network: ${currentNetwork.name} (parsed chainId: ${currentChainId})`)
      setNetworkState(currentNetwork)
      
      // Only show toast if this is a user-initiated change (not initial load)
      if (network && network.chainId !== currentChainId) {
        toast({
          title: "Network Changed",
          description: `Switched to ${currentNetwork.name}`,
        })
      }
    } else {
      console.log(`[NetworkProvider] ⚠️ Unsupported chainId: ${currentChainId} (raw: ${rawChainId})`)
      setNetworkState(null)
      toast({
        title: "Unsupported Network",
        description: `Chain ID ${currentChainId} is not supported. Please switch to Celo, Lisk, Arbitrum, Base, BNB .`,
        variant: "destructive",
      })
    }
  }, [rawChainId, address, network, toast, currentChainId]) // Include currentChainId for reactivity

  const getLatestFactoryAddress = (targetNetwork?: Network) => {
    const selectedNetwork = targetNetwork || network
    return selectedNetwork?.factoryAddresses[selectedNetwork.factoryAddresses.length - 1] || null
  }

  const getFactoryAddress = (factoryType: 'dropcode' | 'droplist' | 'custom' | 'quest' | 'quiz', targetNetwork?: Network) => {
    const selectedNetwork = targetNetwork || network
    if (!selectedNetwork) return null
    return selectedNetwork.factories[factoryType] || null
  }

  const switchNetwork = useCallback(async (targetChainId: number) => {
    // Get fresh values from ref
    const { address: currentAddress, chainId: currentRawChainId, switchChain: currentSwitchChain } = walletRef.current
    
    console.log(`[NetworkProvider: switchNetwork] Called with:`, {
      targetChainId,
      currentAddress,
      currentRawChainId,
      currentParsedChainId: parseChainId(currentRawChainId),
      hasAddress: !!currentAddress,
      refValues: walletRef.current
    })
    
    if (!currentAddress) {
      console.log(`[NetworkProvider: switchNetwork] ❌ No wallet connected`)
      toast({
        title: "No Wallet Connected",
        description: "Please connect your wallet first",
        variant: "destructive",
      })
      return
    }

    if (isSwitchingNetwork) {
      console.log(`[NetworkProvider: switchNetwork] ⏳ Already switching, ignoring`)
      return
    }

    const targetNetwork = networks.find((n) => n.chainId === targetChainId)
    if (!targetNetwork) {
      console.log(`[NetworkProvider: switchNetwork] ❌ Network not found: ${targetChainId}`)
      toast({
        title: "Network Not Supported",
        description: `Chain ID ${targetChainId} is not supported`,
        variant: "destructive",
      })
      return
    }
    
    // Already on target network (compare parsed)
    const currentParsed = parseChainId(currentRawChainId)
    if (currentParsed === targetChainId) {
      console.log(`[NetworkProvider: switchNetwork] ✅ Already on ${targetNetwork.name}`)
      return
    }

    try {
      setIsSwitchingNetwork(true)
      console.log(`[NetworkProvider: switchNetwork] ⏳ Switching to ${targetNetwork.name}...`)

      // Let the wallet switch and the useEffect will update the UI
      await currentSwitchChain(targetChainId)
      console.log(`[NetworkProvider: switchNetwork] ✅ Switch completed`)

      toast({
        title: "Network Switched",
        description: `Successfully switched to ${targetNetwork.name}`,
      })
    } catch (error: any) {
      console.error(`[NetworkProvider: switchNetwork] ❌ Error:`, error)
      
      toast({
        title: "Network Switch Failed",
        description: error?.message || `Could not switch to ${targetNetwork.name}`,
        variant: "destructive",
      })
    } finally {
      setIsSwitchingNetwork(false)
    }
  }, [isSwitchingNetwork, toast])

  const handleSetNetwork = useCallback((newNetwork: Network) => {
    console.log(`[NetworkProvider: handleSetNetwork] Request to switch: ${newNetwork.name}`)
    switchNetwork(newNetwork.chainId)
  }, [switchNetwork])

  return (
    <NetworkContext.Provider
      value={{
        network,
        networks,
        setNetwork: handleSetNetwork,
        switchNetwork,
        getLatestFactoryAddress,
        getFactoryAddress,
        isSwitchingNetwork,
        currentChainId,
        isConnecting,
      }}
    >
      {children}
    </NetworkContext.Provider>
  )
}

export function useNetwork() {
  return useContext(NetworkContext)
}

export function getMainnetNetworks() {
  return networks.filter(network => !network.isTestnet)
}

export function getTestnetNetworks() {
  return networks.filter(network => network.isTestnet)
}

export function getNetworkByChainId(chainId: number) {
  return networks.find(network => network.chainId === chainId)
}

export function isFactoryTypeAvailable(chainId: number, factoryType: 'dropcode' | 'droplist' | 'custom' | 'quest' | 'quiz'): boolean {
  const network = getNetworkByChainId(chainId)
  if (!network) return false
  return !!network.factories[factoryType]
}

// ✅ UPDATED TYPE HERE
export function getAvailableFactoryTypes(chainId: number): ('dropcode' | 'droplist' | 'custom' | 'quest' | 'quiz')[] {
  const network = getNetworkByChainId(chainId)
  if (!network) return []
  
  const availableTypes: ('dropcode' | 'droplist' | 'custom' | 'quest' | 'quiz')[] = []
  if (network.factories.dropcode) availableTypes.push('dropcode')
  if (network.factories.droplist) availableTypes.push('droplist')
  if (network.factories.custom) availableTypes.push('custom')
  if (network.factories.quest) availableTypes.push('quest')
  if (network.factories.quiz) availableTypes.push('quiz') // ✅ Included quiz
  
  return availableTypes
}