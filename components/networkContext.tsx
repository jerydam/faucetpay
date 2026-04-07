"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { ZeroAddress } from "ethers"
import { toast } from "sonner"

export interface Network {
  name: string
  chainId: bigint // Changed from number to bigint
  rpcUrl: string
  blockExplorerUrls: string
  explorerUrl?: string
  color: string
  factoryAddress: string
  tokenAddress: string
  nativeCurrency: {
    name: string
    symbol: string
    decimals: number
  }
}

interface NetworkContextType {
  network: Network | null
  networks: Network[]
  setNetwork: (network: Network) => void
  switchNetwork: (chainId: number) => Promise<void>
}

// Define networks for all major EVM chains
const networks: Network[] = [
  {
    name: "Celo",
    chainId: BigInt(42220), // Convert to bigint
    rpcUrl: "https://forno.celo.org",
    blockExplorerUrls: "https://celoscan.io",
    explorerUrl: "https://celoscan.io",
    color: "#35D07F",
    factoryAddress: "0x9D6f441b31FBa22700bb3217229eb89b13FB49de",
    tokenAddress: "0x471EcE3750Da237f93B8E339c536989b8978a438", // Wrapped CELO
    nativeCurrency: {
      name: "Celo",
      symbol: "CELO",
      decimals: 18,
    },
  },
  {
    name: "Lisk",
    chainId: BigInt(1135),
    rpcUrl: "https://rpc.api.lisk.com",
    blockExplorerUrls: "https://blockscout.lisk.com",
    explorerUrl: "https://blockscout.lisk.com",
    color: "#0D4477",
    factoryAddress: "0xc5f8c2A85520c0A3595C29e004b2f5D9e7CE3b0B",
    tokenAddress: ZeroAddress, // LISK (native)
    nativeCurrency: {
      name: "Lisk",
      symbol: "LISK",
      decimals: 18,
    },
  },
  {
    name: "Arbitrum",
    chainId: BigInt(42161),
    rpcUrl: "https://arb1.arbitrum.io/rpc",
    blockExplorerUrls: "https://arbiscan.io",
    explorerUrl: "https://arbiscan.io",
    color: "#28A0F0",
    factoryAddress: "0x6087810cFc24310E85736Cbd500e4c1d5a45E196",
    tokenAddress: ZeroAddress, // ETH (native)
    nativeCurrency: {
      name: "Ethereum",
      symbol: "ETH",
      decimals: 18,
    },
  },
  {
    chainId: BigInt(8453),
    name: "Base Mainnet",
    rpcUrl: "https://mainnet.base.org",
    blockExplorerUrls: "https://basescan.org",
    factoryAddress: "0xYourFactoryAddressForBase", // Replace with actual address
    color: "#0052FF",
    tokenAddress: ZeroAddress, // ETH (native)
    nativeCurrency: {
      name: "Ethereum",
      symbol: "ETH",
      decimals: 18,
    },
  },
];

const NetworkContext = createContext<NetworkContextType>({
  network: null,
  networks: networks,
  setNetwork: () => {},
  switchNetwork: async () => {},
})

export function NetworkProvider({ children }: { children: ReactNode }) {
 
  const [network, setNetwork] = useState<Network | null>(networks[0])
  const [currentChainId, setCurrentChainId] = useState<bigint | null>(null)
  const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false)

  useEffect(() => {
    const detectCurrentChain = async () => {
      if (typeof window === "undefined" || !window.ethereum) return

      try {
        const chainIdHex = await window.ethereum.request({ method: "eth_chainId" })
        const chainId = BigInt(chainIdHex)
        setCurrentChainId(chainId)

        const detectedNetwork = networks.find((n) => n.chainId === chainId)
        if (detectedNetwork) {
          setNetwork(detectedNetwork)
        }
      } catch (error) {
        console.error("Error detecting chain:", error)
      }
    }

    detectCurrentChain()

    if (window.ethereum) {
      const handleChainChanged = (chainIdHex: string) => {
        try {
          const chainId = BigInt(chainIdHex)
          console.log(`Chain changed to: ${chainId}`)
          setCurrentChainId(chainId)

          const detectedNetwork = networks.find((n) => n.chainId === chainId)
          if (detectedNetwork) {
            setNetwork(detectedNetwork)
          }
          window.location.reload()
        } catch (error) {
          console.error("Error handling chain change:", error)
        }
      }

      window.ethereum.on("chainChanged", handleChainChanged)

      return () => {
        if (window.ethereum && window.ethereum.removeListener) {
          window.ethereum.removeListener("chainChanged", handleChainChanged)
        }
      }
    }
  }, [])

  const switchNetwork = async (chainId: number) => {
    if (typeof window === "undefined" || !window.ethereum) {
      toast.error("No Ethereum Provider, Please install MetaMask or similar wallet.")
      return
    }

    if (isSwitchingNetwork) {
      console.log("Network switch already in progress, skipping")
      return
    }

    const targetNetwork = networks.find((n) => n.chainId === BigInt(chainId))
    if (!targetNetwork) {
      toast.error("Unsupported network")
      return
    }

    try {
      setIsSwitchingNetwork(true)
      console.log(`Attempting to switch to network ${targetNetwork.name} (${chainId})`)

      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${chainId.toString(16)}` }],
      })

      console.log(`Successfully switched to ${targetNetwork.name}`)
      setNetwork(targetNetwork)
      setCurrentChainId(BigInt(chainId))
      window.location.reload()
    } catch (error: any) {
      console.warn(`Error switching to ${targetNetwork.name}:`, error)

      if (error.code === 4902) {
        try {
          console.log(`Adding network ${targetNetwork.name} to wallet`)

          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: `0x${chainId.toString(16)}`,
                chainName: targetNetwork.name,
                nativeCurrency: targetNetwork.nativeCurrency,
                rpcUrls: [targetNetwork.rpcUrl],
                blockExplorerUrlsUrls: [targetNetwork.blockExplorerUrls],
              },
            ],
          })

          console.log(`Successfully added network ${targetNetwork.name}`)

          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: `0x${chainId.toString(16)}` }],
          })

          setNetwork(targetNetwork)
          setCurrentChainId(BigInt(chainId))
          window.location.reload()
        } catch (addError: any) {
          console.error(`Error adding network ${targetNetwork.name}:`, addError)
          toast.error(`Could not add network ${targetNetwork.name}: ${addError.message}`)
        }
      } else {
        console.error(`Error switching to network ${targetNetwork.name}:`, error)
        toast.error(`Could not switch to network ${targetNetwork.name}: ${error.message}`)
      }
    } finally {
      setIsSwitchingNetwork(false)
    }
  }

  const handleSetNetwork = (newNetwork: Network) => {
    setNetwork(newNetwork)
    switchNetwork(Number(newNetwork.chainId))
  }

  return (
    <NetworkContext.Provider
      value={{
        network,
        networks,
        setNetwork: handleSetNetwork,
        switchNetwork,
      }}
    >
      {children}
    </NetworkContext.Provider>
  )
}

export function useNetwork() {
  return useContext(NetworkContext)
}