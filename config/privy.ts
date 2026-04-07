"use client"

import { type Chain } from 'viem'
import { celo } from 'viem/chains'

// 1. Restrict to ONLY Celo
export const supportedChains: [Chain, ...Chain[]] = [celo]

export const privyConfig = {
  appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID || '',
  config: {
  appearance: {
    accentColor: '#3b82f6',
    logo: 'https://FaucetDrops.io/favicon.png',
    landingHeader: 'FaucetDrops',
    loginMessage: 'Connecting to MiniPay...',
    walletChainType: 'ethereum-only',
  },
  loginMethods: ['wallet'],
  embeddedWallets: {
    createOnLogin: 'off',
  },
  defaultChain: celo,
  supportedChains,
  // ADD THIS — hides all wallets except Opera (MiniPay's underlying wallet)
  walletConnectCloudProjectId: undefined,
  externalWallets: {
    coinbaseWallet: { connectionOptions: 'all' },
  },
}
}