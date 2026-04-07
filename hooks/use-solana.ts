"use client"

import { useCallback } from "react"
import { usePrivy, useWallets } from "@privy-io/react-auth"
import { toast } from "sonner"

export const SOLANA_CHAIN_IDS = new Set([
  101,   // Solana Mainnet (Privy / legacy)
  102,   // Solana Devnet  (Privy)
  103,   // Solana Testnet (Privy)
  900,   // used by some indexers
  1399811149, // Solana Mainnet (newer numeric id)
])

export function useSolanaWallet() {
  const { user, linkWallet } = usePrivy()
  const { wallets } = useWallets() // live wallet objects from Privy

  const linkedAccounts = user?.linkedAccounts ?? []
  const linkedWallets  = linkedAccounts.filter((a) => a.type === "wallet")

  // ── Embedded detection ──────────────────────────────────────────────────
  // A user is "embedded" when they have NO external EVM wallet — i.e. they
  // signed in via Google/Twitter/Discord and Privy auto-created wallets.
  const hasExternalEvm = linkedWallets.some(
    (w: any) => w.chainType === "ethereum" && w.walletClientType !== "privy"
  )
  const isEmbeddedUser = !hasExternalEvm

  // ── Solana wallet resolution ─────────────────────────────────────────────
  const linkedSolanaWallets = linkedWallets.filter(
    (w: any) => w.chainType === "solana"
  )
  const externalSolana = linkedSolanaWallets.find(
    (w: any) => w.walletClientType !== "privy"
  ) as any | undefined

  const embeddedSolana = linkedSolanaWallets.find(
    (w: any) => w.walletClientType === "privy"
  ) as any | undefined

  // External always overrides embedded when both exist
  const activeSolanaAccount = externalSolana ?? embeddedSolana ?? null

  // Live wallet object (has .sendTransaction etc.)
  const activeSolanaWallet = wallets.find(
    (w) =>
      w.address === activeSolanaAccount?.address &&
      // @ts-ignore – chainType exists on Privy wallet objects
      (w.chainType === "solana" || SOLANA_CHAIN_IDS.has(Number(w.chainId)))
  ) ?? null

  // ── Network-switch handler ───────────────────────────────────────────────
  /**
   * Call this from your network selector when the user picks a Solana network.
   *
   * @returns The Solana address that became active, or null if the flow was
   *          triggered but not yet complete (linkWallet popup opened).
   */
  const switchToSolana = useCallback(async (): Promise<string | null> => {
    // Case 1 – External Solana wallet linked → use it directly
    if (externalSolana?.address) {
      toast.success(`Switched to Solana — using ${externalSolana.address.slice(0, 4)}…${externalSolana.address.slice(-4)}`)
      return externalSolana.address
    }

    // Case 2 – Embedded-only user → use the embedded Solana wallet silently
    if (embeddedSolana?.address) {
      toast.success(`Switched to Solana — using your embedded wallet`)
      return embeddedSolana.address
    }

    // Case 3 – No Solana wallet at all → open the link-wallet flow
    toast.info("Connect a Solana wallet to continue")
    try {
      await linkWallet()
      // After the popup resolves Privy re-renders; the caller should re-check
      // activeSolanaAccount on the next render cycle.
    } catch (err: any) {
      const msg = (err?.message ?? "").toLowerCase()
      if (!msg.includes("closed") && !msg.includes("cancelled") && !msg.includes("popup")) {
        toast.error("Could not connect Solana wallet")
      }
    }
    return null
  }, [externalSolana, embeddedSolana, linkWallet])

  return {
    /** The winning Solana linked-account object (external > embedded > null) */
    activeSolanaAccount,
    /** The live Privy Wallet object (has sendTransaction, signMessage, etc.) */
    activeSolanaWallet,
    /** Convenience: just the address string */
    solanaAddress: activeSolanaAccount?.address ?? null,
    /** True when using an externally-linked Solana wallet (e.g. Phantom) */
    hasExternalSolana: !!externalSolana,
    /** True when only the Privy-embedded Solana wallet exists */
    hasEmbeddedSolana: !!embeddedSolana && !externalSolana,
    /** True when the user has NO external EVM wallet (social/email login) */
    isEmbeddedUser,
    /** Call from network selector when user selects a Solana chain */
    switchToSolana,
    /** Raw Privy linkWallet for other uses */
    linkWallet,
  }
}