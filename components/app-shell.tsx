"use client"

// Everything in this tree needs a wallet (ethers) and is only ever rendered
// once MiniPayGate has confirmed window.ethereum.isMiniPay — see minipay-gate.tsx,
// which lazy-loads this component specifically so non-MiniPay visitors (including
// PageSpeed/Lighthouse) never download this bundle at all.
import type React from "react"
import { WalletProvider } from "@/components/wallet-provider"
import { PresenceProvider } from "@/components/presence-provider"
import { BottomNav } from "@/components/bottom-nav"
import { Toaster } from "sonner"

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <WalletProvider>
      <PresenceProvider>
        <div className="min-h-screen flex flex-col">
          <main className="flex-1">{children}</main>
        </div>
        <BottomNav />
        <Toaster richColors position="top-center" closeButton />
      </PresenceProvider>
    </WalletProvider>
  )
}
