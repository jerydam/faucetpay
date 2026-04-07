// types/walletconnect.ts
// Additional type definitions for WalletConnect integration

import { WalletKit } from "@reown/walletkit"

// Infer types from WalletKit
type WalletKitInstance = Awaited<ReturnType<typeof WalletKit.init>>
export type SessionStruct = ReturnType<WalletKitInstance['getActiveSessions']>[string]

// Helper type for session metadata
export interface SessionMetadata {
  name: string
  description: string
  url: string
  icons: string[]
}

// Session proposal metadata
export interface SessionProposalMetadata {
  id: number
  pairingTopic: string
  expiry: number
  proposer: {
    publicKey: string
    metadata: SessionMetadata
  }
}

// Session request event structure
export interface SessionRequestEvent {
  id: number
  topic: string
  params: {
    request: {
      method: string
      params: any[]
    }
    chainId: string
  }
}

// Supported Ethereum methods
export const SUPPORTED_METHODS = [
  "eth_sendTransaction",
  "eth_signTransaction",
  "eth_sign",
  "personal_sign",
  "eth_signTypedData",
  "eth_signTypedData_v3",
  "eth_signTypedData_v4",
  "wallet_switchEthereumChain",
  "wallet_addEthereumChain",
  "wallet_getPermissions",
  "wallet_requestPermissions",
] as const

export type SupportedMethod = typeof SUPPORTED_METHODS[number]

// Supported events
export const SUPPORTED_EVENTS = ["chainChanged", "accountsChanged"] as const

export type SupportedEvent = typeof SUPPORTED_EVENTS[number]