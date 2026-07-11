import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { toast } from "sonner"
import { CELO_CHAIN_ID, ensureCeloNetwork } from "@/lib/chain"

/**
 * Ensure the injected wallet is on Celo Mainnet.
 * PrimeIQ is Celo-only — MiniPay is always on Celo already, so this is
 * mostly a safety net for generic injected wallets.
 * Hook-free: safe to call from any async handler.
 */
export const ensureCorrectNetwork = async (
  requiredChainId: number = CELO_CHAIN_ID
): Promise<boolean> => {
  if (typeof window === "undefined" || !window.ethereum) {
    toast.error("Wallet not connected", {
      description: "Please connect your wallet.",
    })
    return false
  }

  try {
    const currentHex: string = await (window.ethereum as any).request({
      method: "eth_chainId",
    })
    if (parseInt(currentHex, 16) === requiredChainId) return true

    // ensureCeloNetwork handles wallet_switchEthereumChain + add-chain fallback
    await ensureCeloNetwork()
    return true
  } catch (error) {
    console.error("Error switching network:", error)
    toast.error("Network switch failed", {
      description: "Please switch to Celo Mainnet manually in your wallet.",
    })
    return false
  }
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}