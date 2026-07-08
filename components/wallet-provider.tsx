"use client"

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react"
import { BrowserProvider, type JsonRpcSigner } from "ethers"
import { toast } from "sonner"
import { CELO_CHAIN_ID, ensureCeloNetwork } from "@/lib/chain"
import { registerSignerGetter } from "@/lib/getSigner"

interface WalletContextType {
  provider: BrowserProvider | null
  signer: JsonRpcSigner | null
  address: string | null
  chainId: number | null
  isConnected: boolean
  isConnecting: boolean
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  /** Ensures the wallet is on Celo. MiniPay is always on Celo already;
   *  this exists mainly to catch the rare non-MiniPay injected wallet. */
  ensureCorrectNetwork: () => Promise<boolean>
  refreshProvider: () => Promise<void>
  /** Returns a ready-to-use signer, connecting first if necessary. */
  getActiveSigner: () => Promise<JsonRpcSigner>
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
  getActiveSigner: async () => { throw new Error("Wallet not initialized") },
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

  // MiniPay is always-on within the Opera browser — auto-connect.
  useEffect(() => {
    if (typeof window === "undefined") return
    if (window.ethereum?.isMiniPay) {
      setupProvider()
    }
  }, [setupProvider])

  useEffect(() => {
    const eth = window.ethereum
    if (!eth) return

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) disconnect()
      else setupProvider()
    }
    const handleChainChanged = () => setupProvider()

    eth.on?.("accountsChanged", handleAccountsChanged)
    eth.on?.("chainChanged", handleChainChanged)

    return () => {
      eth.removeListener?.("accountsChanged", handleAccountsChanged)
      eth.removeListener?.("chainChanged", handleChainChanged)
    }
  }, [setupProvider])

  const connect = async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      toast.error("No Ethereum wallet detected. Please open this in MiniPay.")
      return
    }

    setIsConnecting(true)
    try {
      await window.ethereum.request({ method: "eth_requestAccounts" })
      await setupProvider()
      toast.success("Wallet connected!")
    } catch (err: any) {
      if (err?.code === 4001) toast.error("Connection rejected by user.")
      else toast.error("Failed to connect wallet.")
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

  const ensureCorrectNetwork = async (): Promise<boolean> => {
    if (!isConnected) {
      await connect()
      return false
    }
    if (chainId !== CELO_CHAIN_ID) {
      try {
        await ensureCeloNetwork()
        await setupProvider()
        return true
      } catch (err) {
        toast.error("Please switch to Celo in your wallet.")
        throw err
      }
    }
    return true
  }

  const getActiveSigner = useCallback(async (): Promise<JsonRpcSigner> => {
    if (signer) return signer
    if (!window.ethereum) throw new Error("No wallet detected.")
    await connect()
    const ethersProvider = new BrowserProvider(window.ethereum)
    const s = await ethersProvider.getSigner()
    if (!s) throw new Error("Could not get signer — wallet not connected.")
    return s
  }, [signer])

  useEffect(() => {
    registerSignerGetter(getActiveSigner)
  }, [getActiveSigner])
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
        getActiveSigner,
      }}
    >
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  return useContext(WalletContext)
}