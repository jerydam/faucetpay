import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

import { useToast } from "@/hooks/use-toast"
import { useNetwork } from "@/hooks/use-network"
import { useChainId } from "wagmi"

export const ensureCorrectNetwork = async (requiredChainId: number): Promise<boolean> => {
  const { toast } = useToast()
  const { network, switchNetwork } = useNetwork()
  const chainId = useChainId()

  if (!chainId) {
    toast({
      title: "Wallet not connected",
      description: "Please connect your wallet.",
      variant: "destructive",
    })
    return false
  }

  if (chainId !== requiredChainId) {
    try {
      await switchNetwork(requiredChainId)

      // Wait for the chain to be switched
      return new Promise((resolve) => {
        const checkChain = () => {
          if (chainId === requiredChainId) {
            resolve(true)
          } else {
            setTimeout(checkChain, 500)
          }
        }

        // Start checking after a short delay to allow for the chain to switch
        setTimeout(checkChain, 1000)
      })
    } catch (error) {
      console.error("Error switching network:", error)
      toast({
        title: "Network switch failed",
        description: `Please switch to the ${network?.name || "required"} network manually.`,
        variant: "destructive",
      })
      return false
    }
  }

  return true
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
