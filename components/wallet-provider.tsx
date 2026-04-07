"use client"
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react"
import { BrowserProvider, type JsonRpcSigner } from "ethers"
import { useDisconnect, useSwitchChain, useChainId } from 'wagmi'
import { usePrivy, useWallets } from '@privy-io/react-auth'
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
  switchChain: (newChainId: number) => Promise<void>
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
  switchChain: async () => {},
  refreshProvider: async () => {},
})

export function WalletProvider({ children }: { children: ReactNode }) {
  const [provider, setProvider] = useState<BrowserProvider | null>(null)
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null)
  const [liveChainId, setLiveChainId] = useState<number | null>(null)

  const { ready, authenticated, login, logout } = usePrivy()
  const { wallets } = useWallets()
  const { disconnect: wagmiDisconnect } = useDisconnect()
  const { switchChain: wagmiSwitchChain } = useSwitchChain()
  const wagmiChainId = useChainId()

  // In a MiniPay-only world, we just grab the single connected wallet.
  const activeWallet = wallets[0] || null
  const address = activeWallet?.address || null
  
  const isConnected = ready && authenticated && !!address && !!signer
  const isConnecting = !ready || (authenticated && wallets.length > 0 && !address)

  const setupProvider = useCallback(async () => {
    if (!activeWallet) {
      setProvider(null)
      setSigner(null)
      setLiveChainId(null)
      return
    }

    try {
      const ethereumProvider = await activeWallet.getEthereumProvider()
      const ethersProvider = new BrowserProvider(ethereumProvider)
      const network = await ethersProvider.getNetwork()
      const detectedChainId = Number(network.chainId)
      const ethersSigner = await ethersProvider.getSigner()

      setProvider(ethersProvider)
      setSigner(ethersSigner)
      setLiveChainId(detectedChainId)
    } catch (error) {
      console.error('❌ [WalletProvider] Error setting up wallet:', error)
      setProvider(null)
      setSigner(null)
      setLiveChainId(null)
    }
  }, [activeWallet])

  const refreshProvider = useCallback(async () => {
    await setupProvider()
  }, [setupProvider])

  // Setup on mount / wallet change
  useEffect(() => {
    if (authenticated && wallets.length > 0) {
      setupProvider()
    }
  }, [authenticated, wallets.length, activeWallet?.address, setupProvider])

  // Listeners for account/chain changes
  useEffect(() => {
    if (!activeWallet) return
    let rawProvider: any = null

    const handleChainChange = async () => {
      await setupProvider()
    }

    const attach = async () => {
      try {
        rawProvider = await activeWallet.getEthereumProvider()
        rawProvider.on?.('chainChanged', handleChainChange)
        rawProvider.on?.('accountsChanged', refreshProvider)
      } catch (e) {
        console.error('[WalletProvider] Could not attach chain listener', e)
      }
    }
    attach()
    
    return () => {
      rawProvider?.removeListener?.('chainChanged', handleChainChange)
      rawProvider?.removeListener?.('accountsChanged', refreshProvider)
    }
  }, [activeWallet?.address, setupProvider, refreshProvider])

  const connect = async () => {
    try { await login() } catch { toast.error("Failed to connect wallet") }
  }

  const disconnect = async () => {
    wagmiDisconnect()
    setProvider(null)
    setSigner(null)
    setLiveChainId(null)
    await logout()
  }

  const switchChain = async (newChainId: number) => {
    if (!activeWallet) throw new Error("No wallet connected")
      
    const hexChainId = `0x${newChainId.toString(16)}`
    
    try {
      const rawProvider = await activeWallet.getEthereumProvider()

      try {
        await rawProvider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: hexChainId }],
        })
      } catch (switchErr: any) {
        // Fallback to Wagmi if direct RPC request fails
        if (switchErr.code === 4902 || switchErr.message?.includes("Unrecognized chain ID")) {
          await wagmiSwitchChain({ chainId: newChainId })
        } else {
          throw switchErr
        }
      }

      await setupProvider()
    } catch (error: any) {
      if (error?.code === 4001 || error?.message?.includes("rejected")) {
        toast.error("Network switch cancelled")
      } else {
        toast.error("Failed to switch network.")
      }
      throw error
    }
  }

  const ensureCorrectNetwork = async (requiredChainId: number): Promise<boolean> => {
    if (!isConnected) {
      await connect()
      return false
    }
    const currentChain = liveChainId ?? wagmiChainId
    if (currentChain !== requiredChainId) {
      await switchChain(requiredChainId)
      return true
    }
    return true
  }

  return (
    <WalletContext.Provider
      value={{
        provider,
        signer,
        address,
        chainId: liveChainId ?? wagmiChainId ?? null,
        isConnected,
        isConnecting,
        connect,
        disconnect,
        ensureCorrectNetwork,
        switchChain,
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