"use client"

import { useEffect, useState } from "react"
import { useWallet } from "@/hooks/use-wallet"
import { Card, CardContent } from "@/components/ui/card"
import { formatUnits, Contract, ZeroAddress, JsonRpcProvider } from "ethers"
import { ERC20_ABI } from "@/lib/abis"
import { Skeleton } from "@/components/ui/skeleton"
import { CELO_CONFIG, CELO_CHAIN_ID } from "@/lib/chain"
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
  const [balance, setBalance] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (address) {
      fetchBalance()
    } else {
      setLoading(false)
      setError(null)
    }
  }, [address, tokenAddress, isNativeToken, networkChainId])

  const fetchBalance = async () => {
    if (!address) return

    try {
      setLoading(true)
      setError(null)

      // Celo-only — reject anything else
      if (networkChainId && networkChainId !== CELO_CHAIN_ID) {
        setError("Network not supported")
        setLoading(false)
        return
      }

      const provider = new JsonRpcProvider(CELO_CONFIG.rpcUrl)

      let balanceValue
      if (isNativeToken || tokenAddress === ZeroAddress) {
        balanceValue = await provider.getBalance(address)
      } else {
        const tokenContract = new Contract(tokenAddress, ERC20_ABI, provider)
        balanceValue = await tokenContract.balanceOf(address)
      }

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