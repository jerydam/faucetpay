"use client"

import { PrivyProvider } from '@privy-io/react-auth'
import { WagmiProvider } from '@privy-io/wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { privyConfig, supportedChains } from '@/config/privy'
import { http } from 'viem'
import { createConfig } from 'wagmi'

// Wagmi config for Celo only
const wagmiConfig = createConfig({
  chains: supportedChains,
  transports: {
    [supportedChains[0].id]: http(),
  },
})

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
    },
  },
})

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={privyConfig.appId}
      config={{
        ...privyConfig.config,
        // ── Minimal & Clean Login (No social at launch) ─────────────────────
        loginMethods: ['email'],           // Only email at login
        appearance: {
          ...privyConfig.config.appearance,
          accentColor: '#3b82f6',
          logo: 'https://FaucetDrops.io/favicon.png',
          landingHeader: 'FaucetDrops',
          loginMessage: 'Connect with Email',
        },

        embeddedWallets: {
          createOnLogin: 'off',            // We rely on MiniPay auto-connect
        },

        // Completely disable wallet options on login screen
        walletList: [],
        showWalletLoginFirst: false,

        // Optional: Hide third-party wallets on login
        loginModal: {
          showThirdPartyWallets: false,
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider 
          config={wagmiConfig} 
          reconnectOnMount={false}
        >
          {children}
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  )
}