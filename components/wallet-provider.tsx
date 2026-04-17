"use client"

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react"
import { BrowserProvider, type JsonRpcSigner } from "ethers"
import { toast } from "sonner"

interface WalletContextType {
  provider: BrowserProvider | null
  signer: JsonRpcSigner | null
  address: string | null
  chainId: number | null
  isConnected: boolean
  isConnecting: boolean
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  ensureCorrectNetwork: (requiredChainId: number) => Promise<boolean>
  refreshProvider: () => Promise<void>
}

export const WalletContext = createContext<WalletContextType>({
  provider: null,
  signer: null,
  address: null,
  chainId: null,
  isConnected: false,
  isConnecting: false,
  connect: async () => {},
  disconnect: async () => {},
  ensureCorrectNetwork: async () => false,
  refreshProvider: async () => {},
})

export function WalletProvider({ children }: { children: ReactNode }) {
  const [provider, setProvider] = useState<BrowserProvider | null>(null)
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null)
  const [address, setAddress] = useState<string | null>(null)
  const [chainId, setChainId] = useState<number | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)

  const isConnected = !!address && !!signer

  const setupProvider = useCallback(async () => {
    const eth = window.ethereum
    if (!eth) return

    try {
      const ethersProvider = new BrowserProvider(eth)
      const accounts = await ethersProvider.listAccounts()

      if (accounts.length === 0) return

      const network = await ethersProvider.getNetwork()
      const ethersSigner = await ethersProvider.getSigner()

      setProvider(ethersProvider)
      setSigner(ethersSigner)
      setAddress(await ethersSigner.getAddress())
      setChainId(Number(network.chainId))
    } catch (err) {
      console.error("[WalletProvider] setupProvider failed:", err)
    }
  }, [])

  const refreshProvider = useCallback(async () => {
    await setupProvider()
  }, [setupProvider])

  // EFFECT 1: Handle MiniPay Auto-connect ONLY
  useEffect(() => {
    if (typeof window === "undefined") return
    
    // MiniPay is designed to be "always connected" within the Opera browser
    if (window.ethereum?.isMiniPay) {
      setupProvider()
    }
    // Note: If MetaMask is present, we do NOT auto-connect here. 
    // The user must click "Connect Wallet".
  }, [setupProvider])

  // EFFECT 2: Sync UI with Wallet Changes
  useEffect(() => {
    const eth = window.ethereum
    if (!eth) return

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnect()
      } else {
        setupProvider()
      }
    }

    const handleChainChanged = () => {
      setupProvider()
    }

    eth.on?.("accountsChanged", handleAccountsChanged)
    eth.on?.("chainChanged", handleChainChanged)

    return () => {
      eth.removeListener?.("accountsChanged", handleAccountsChanged)
      eth.removeListener?.("chainChanged", handleChainChanged)
    }
  }, [setupProvider])

  const connect = async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      toast.error("No Ethereum wallet detected. Please install MetaMask or use MiniPay.")
      return
    }

    setIsConnecting(true)
    try {
      // Trigger the wallet popup (MetaMask or MiniPay account selector)
      await window.ethereum.request({ method: "eth_requestAccounts" })
      await setupProvider()
      toast.success("Wallet connected!")
    } catch (err: any) {
      if (err?.code === 4001) {
        toast.error("Connection rejected by user.")
      } else {
        toast.error("Failed to connect wallet.")
      }
    } finally {
      setIsConnecting(false)
    }
  }

  const disconnect = async () => {
    setProvider(null)
    setSigner(null)
    setAddress(null)
    setChainId(null)
  }

  const ensureCorrectNetwork = async (requiredChainId: number): Promise<boolean> => {
    if (!isConnected) {
      await connect()
      return false
    }
    if (chainId !== requiredChainId) {
      try {
        await window.ethereum?.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: `0x${requiredChainId.toString(16)}` }],
        })
        await setupProvider()
        return true
      } catch (err: any) {
        toast.error("Please switch to the correct network in your wallet.")
        throw err
      }
    }
    return true
  }

  return (
    <WalletContext.Provider
      value={{
        provider,
        signer,
        address,
        chainId,
        isConnected,
        isConnecting,
        connect,
        disconnect,
        ensureCorrectNetwork,
        refreshProvider,
      }}
    >
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  return useContext(WalletContext)
}