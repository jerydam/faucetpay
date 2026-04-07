"use client"

import { useEffect, useState } from "react"
import { useWallet } from "@/hooks/use-wallet"
import { Card, CardContent } from "@/components/ui/card"
import { formatUnits, Contract, ZeroAddress, JsonRpcProvider } from "ethers"
import { ERC20_ABI } from "@/lib/abis"
import { Skeleton } from "@/components/ui/skeleton"
import { useNetwork } from "@/hooks/use-network"
import { WalletConnectButton } from "@/components/wallet-connect"

interface TokenBalanceProps {
  tokenAddress: string
  tokenSymbol: string
  tokenDecimals: number
  isNativeToken?: boolean
  networkChainId?: number
}

export function TokenBalance({
  tokenAddress,
  tokenSymbol,
  tokenDecimals,
  isNativeToken = false,
  networkChainId,
}: TokenBalanceProps) {
  const { address, chainId } = useWallet()
  const { networks } = useNetwork()
  const [balance, setBalance] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Check if we're on the correct network
  const isCorrectNetwork = !networkChainId || chainId === networkChainId

  useEffect(() => {
    if (address) {
      fetchBalance()
    } else {
      setLoading(false)
      setError(null) // Reset error when wallet is not connected
    }
  }, [address, tokenAddress, isNativeToken, networkChainId])

  const fetchBalance = async () => {
    if (!address) return

    try {
      setLoading(true)
      setError(null)

      // Find the network configuration for this chain ID
      const network = networks.find((n) => n.chainId === networkChainId)

      if (!network) {
        setError("Network not configured")
        setLoading(false)
        return
      }

      // Safely extract the first RPC URL whether it's a string or array
      const safeRpcUrl = Array.isArray(network.rpcUrl) 
        ? network.rpcUrl[0] 
        : network.rpcUrl;

      // Create a dedicated provider for this network using the safe URL
      const provider = new JsonRpcProvider(safeRpcUrl)

      let balanceValue

      if (isNativeToken || tokenAddress === ZeroAddress) {
        // Fetch native token balance
        balanceValue = await provider.getBalance(address)
      } else {
        // Fetch ERC20 token balance
        const tokenContract = new Contract(tokenAddress, ERC20_ABI, provider)
        balanceValue = await tokenContract.balanceOf(address)
      }

      // 💡 FIX: Format to units, then parse to float and fix to 2 decimal places
      const formattedBalance = formatUnits(balanceValue, tokenDecimals)
      setBalance(parseFloat(formattedBalance).toFixed(4))

    } catch (error) {
      console.error("Error fetching token balance:", error)
      setBalance("Error")
      setError("Failed to fetch")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">My Balance:</span>
          {loading ? (
            <Skeleton className="h-6 w-24" />
          ) : !address ? (
            <WalletConnectButton className="bg-red-500 hover:bg-red-600 text-white" />
          ) : error ? (
            <span className="text-sm text-red-500">{error}</span>
          ) : (
            <span className="font-bold">
              {balance || "0.00"} {tokenSymbol}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}