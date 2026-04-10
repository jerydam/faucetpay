"use client"

export const privyConfig = {
  appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID || '',

  config: {
    appearance: {
      accentColor: '#3b82f6',
      logo: 'https://FaucetDrops.io/favicon.png',
      landingHeader: 'FaucetDrops Profiles',
      loginMessage: 'Connect with social or email',
    },

    // Prioritize methods that work well in mobile/IAB
    loginMethods: [
      'email',           // Very reliable on mobile
      'google',          // Keep but handle gracefully (fallback needed)
      'twitter',         // Usually works well
      'discord',
      'telegram',        // Excellent on mobile
      'farcaster',       // Good if your users are in that ecosystem
      // 'wallet' → you already disabled this for embedded flow
    ],

    embeddedWallets: {
      createOnLogin: 'off',   // You already have this — good for Celo-only setup
    },

    // Optional: force certain behavior for better mobile UX
    // You can also add:
    // supportedChains: supportedChains, // already in your Wagmi config
  }
}