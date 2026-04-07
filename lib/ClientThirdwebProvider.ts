"use client"

import { defineChain, getContract } from "thirdweb"
import { client } from "@/components/thirdweb-provider"
import type { Network } from "@/hooks/use-network"

/**
 * Convert a Network object to a Thirdweb chain definition
 */
export function networkToThirdwebChain(network: Network) {
  return defineChain({
    id: network.chainId,
    name: network.name,
    rpc: network.rpcUrl,
    nativeCurrency: network.nativeCurrency,
    blockExplorers: [
      {
        name: "Explorer",
        url: network.blockExplorerUrls,
        apiUrl: `${network.blockExplorerUrls}/api`,
      },
    ],
  })
}

/**
 * Get a Thirdweb contract instance
 */
export function getThirdwebContract(
  address: string, 
  network: Network,
  abi?: any[]
) {
  const chain = networkToThirdwebChain(network)
  
  return getContract({
    client,
    chain,
    address,
    abi,
  })
}

/**
 * Standard ERC20 ABI for token contracts
 */
export const ERC20_ABI = [
  {
    "inputs": [
      { "internalType": "address", "name": "to", "type": "address" },
      { "internalType": "uint256", "name": "amount", "type": "uint256" }
    ],
    "name": "transfer",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "owner", "type": "address" },
      { "internalType": "address", "name": "spender", "type": "address" }
    ],
    "name": "allowance", 
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "spender", "type": "address" },
      { "internalType": "uint256", "name": "amount", "type": "uint256" }
    ],
    "name": "approve",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "nonpayable", 
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "account", "type": "address" }],
    "name": "balanceOf",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "decimals",
    "outputs": [{ "internalType": "uint8", "name": "", "type": "uint8" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "symbol",
    "outputs": [{ "internalType": "string", "name": "", "type": "string" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "name",
    "outputs": [{ "internalType": "string", "name": "", "type": "string" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalSupply",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
] as const

/**
 * Get an ERC20 token contract using Thirdweb
 */
export function getERC20Contract(tokenAddress: string, network: Network) {
  return getThirdwebContract(tokenAddress, network, ERC20_ABI)
}

/**
 * Get supported chains for Thirdweb
 */
export function getSupportedThirdwebChains(networks: Network[]) {
  return networks.map(networkToThirdwebChain)
}

/**
 * Check if a network supports smart wallets
 */
export function supportsSmartWallets(network: Network): boolean {
  return !!(network.factories.custom || network.factoryAddresses.length > 0)
}

/**
 * Get the factory address for smart wallets on a network
 */
export function getSmartWalletFactory(network: Network): string | null {
  return network.factories.custom || network.factoryAddresses[0] || null
}

/**
 * Thirdweb transaction options
 */
export interface ThirdwebTransactionOptions {
  gasless?: boolean
  gasLimit?: string
  gasPrice?: string
  value?: string
}

/**
 * Default transaction options
 */
export const DEFAULT_TRANSACTION_OPTIONS: ThirdwebTransactionOptions = {
  gasless: false,
}

/**
 * Create transaction options for smart wallets
 */
export function createSmartWalletTransactionOptions(
  options: Partial<ThirdwebTransactionOptions> = {}
): ThirdwebTransactionOptions {
  return {
    ...DEFAULT_TRANSACTION_OPTIONS,
    gasless: true, // Enable gasless transactions for smart wallets
    ...options,
  }
}

/**
 * Wallet configuration presets
 */
export const WALLET_PRESETS = {
  // For social login focused apps
  social: [
    "google",
    "facebook", 
    "x",
    "discord",
    "email",
    "phone",
  ],
  // For crypto-native users
  crypto: [
    "io.metamask",
    "com.coinbase.wallet",
    "me.rainbow",
    "io.rabby",
  ],
  // For maximum compatibility
  all: [
    "google",
    "telegram",
    "farcaster", 
    "email",
    "x",
    "passkey",
    "phone",
    "discord",
    "facebook",
    "guest",
    "io.metamask",
    "com.coinbase.wallet",
    "me.rainbow",
    "io.rabby",
    "io.zerion.wallet",
  ],
} as const

/**
 * Get wallet configuration based on app type
 */
export function getWalletConfig(preset: keyof typeof WALLET_PRESETS = 'all') {
  return WALLET_PRESETS[preset]
}

/**
 * Environment configuration
 */
export const THIRDWEB_CONFIG = {
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "",
  secretKey: process.env.THIRDWEB_SECRET_KEY || "",
  isDevelopment: process.env.NODE_ENV === "development",
  isProduction: process.env.NODE_ENV === "production",
} as const

/**
 * Validate Thirdweb configuration
 */
export function validateThirdwebConfig() {
  const issues: string[] = []

  if (!THIRDWEB_CONFIG.clientId) {
    issues.push("NEXT_PUBLIC_THIRDWEB_CLIENT_ID is not set")
  }

  if (THIRDWEB_CONFIG.isProduction && !THIRDWEB_CONFIG.secretKey) {
    issues.push("THIRDWEB_SECRET_KEY is not set for production")
  }

  return {
    isValid: issues.length === 0,
    issues,
  }
}

/**
 * Error handling utilities
 */
export class ThirdwebError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: any
  ) {
    super(message)
    this.name = "ThirdwebError"
  }
}

export function handleThirdwebError(error: any): ThirdwebError {
  if (error instanceof ThirdwebError) {
    return error
  }

  // Handle common error patterns
  if (error.code === 4001) {
    return new ThirdwebError("User rejected the request", "USER_REJECTED", error)
  }

  if (error.message?.includes("insufficient funds")) {
    return new ThirdwebError("Insufficient funds for transaction", "INSUFFICIENT_FUNDS", error)
  }

  if (error.message?.includes("network")) {
    return new ThirdwebError("Network error occurred", "NETWORK_ERROR", error)
  }

  return new ThirdwebError(
    error.message || "An unknown error occurred",
    "UNKNOWN_ERROR",
    error
  )
}

/**
 * Format Thirdweb addresses
 */
export function formatAddress(address: string, length = 4): string {
  if (!address) return ""
  return `${address.slice(0, 2 + length)}...${address.slice(-length)}`
}

/**
 * Check if an address is valid
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

/**
 * Convert wei to human readable format
 */
export function formatTokenAmount(
  amount: bigint | string,
  decimals: number = 18,
  precision: number = 4
): string {
  const amountBig = typeof amount === "string" ? BigInt(amount) : amount
  const divisor = BigInt(10 ** decimals)
  const quotient = amountBig / divisor
  const remainder = amountBig % divisor
  
  if (remainder === 0n) {
    return quotient.toString()
  }
  
  const remainderStr = remainder.toString().padStart(decimals, "0")
  const trimmedRemainder = remainderStr.slice(0, precision).replace(/0+$/, "")
  
  if (trimmedRemainder === "") {
    return quotient.toString()
  }
  
  return `${quotient}.${trimmedRemainder}`
}

/**
 * Convert human readable amount to wei
 */
export function parseTokenAmount(amount: string, decimals: number = 18): bigint {
  const [whole, fractional] = amount.split(".")
  const wholePart = BigInt(whole || "0") * BigInt(10 ** decimals)
  
  if (!fractional) {
    return wholePart
  }
  
  const fractionalPadded = fractional.padEnd(decimals, "0").slice(0, decimals)
  const fractionalPart = BigInt(fractionalPadded)
  
  return wholePart + fractionalPart
}

/**
 * Thirdweb hook utilities
 */
export function useThirdwebTransaction() {
  // This would be implemented as a custom hook
  // For now, returning a placeholder structure
  return {
    sendTransaction: async (contract: any, method: string, args: any[]) => {
      // Implementation would go here
      throw new Error("useThirdwebTransaction not implemented")
    },
    isLoading: false,
    error: null,
  }
}

/**
 * Smart wallet utilities
 */
export interface SmartWalletConfig {
  factoryAddress: string
  gasless: boolean
  bundlerUrl?: string
  paymasterUrl?: string
}

export function createSmartWalletConfig(network: Network): SmartWalletConfig | null {
  const factoryAddress = getSmartWalletFactory(network)
  
  if (!factoryAddress) {
    return null
  }
  
  return {
    factoryAddress,
    gasless: true,
    // Add bundler/paymaster URLs if available
    bundlerUrl: process.env.NEXT_PUBLIC_BUNDLER_URL,
    paymasterUrl: process.env.NEXT_PUBLIC_PAYMASTER_URL,
  }
}

/**
 * Export commonly used types
 */
export type WalletType = 
  | "metamask"
  | "coinbase"
  | "rainbow" 
  | "rabby"
  | "zerion"
  | "inapp"
  | "smart"

export interface WalletInfo {
  id: string
  name: string
  type: WalletType
  icon?: string
  description?: string
}

export const SUPPORTED_WALLETS: WalletInfo[] = [
  {
    id: "io.metamask",
    name: "MetaMask",
    type: "metamask",
    description: "Connect using MetaMask wallet",
  },
  {
    id: "com.coinbase.wallet", 
    name: "Coinbase Wallet",
    type: "coinbase",
    description: "Connect using Coinbase Wallet",
  },
  {
    id: "me.rainbow",
    name: "Rainbow",
    type: "rainbow", 
    description: "Connect using Rainbow wallet",
  },
  {
    id: "io.rabby",
    name: "Rabby",
    type: "rabby",
    description: "Connect using Rabby wallet", 
  },
  {
    id: "io.zerion.wallet",
    name: "Zerion",
    type: "zerion",
    description: "Connect using Zerion wallet",
  },
  {
    id: "inapp",
    name: "Social Login", 
    type: "inapp",
    description: "Connect with email, social media, or phone",
  },
]

/**
 * Get wallet info by ID
 */
export function getWalletInfo(walletId: string): WalletInfo | undefined {
  return SUPPORTED_WALLETS.find(wallet => wallet.id === walletId)
}