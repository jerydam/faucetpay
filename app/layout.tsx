"use client"

import type React from "react"
import { useEffect } from "react"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "sonner"
import { WalletProvider } from "@/components/wallet-provider"
import { BottomNav } from "@/components/bottom-nav"
import { PresenceProvider } from "@/components/presence-provider"

import sdk from "@farcaster/miniapp-sdk"

import localFont from "next/font/local"
const inter = localFont({
  src: "./fonts/Inter-Variable.woff2",
  display: "swap",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  
  useEffect(() => {
    const init = async () => {
      try {
        setTimeout(() => {
          sdk.actions.ready();
        }, 300);
      } catch (error) {
        console.warn("Failed to initialize Farcaster SDK", error);
      }
    };
    init();
  }, []);

  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        <title>FaucetDrops - Automated Onchain Reward and Engagement Platform</title>
        <meta name="title" content="app.faucetdrops - Automated Onchain Reward and Engagement Platform" />
        <meta name="description" content="Automated onchain reward and engagement platform 💧. Distribute tokens effortlessly across multiple chains." />
        <meta name="talentapp:project_verification" content="98f7ce94c39130cef543fae892959918754270dff34594b8d7a129a75b6e2b6f052016215082a0071b59805b26c86d58ae8dec2460ee57a9652ab98f089e8461" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://app.faucetdrops.io/" />
        <meta property="og:site_name" content="app.faucetdrops" />
        <meta property="og:title" content="app.faucetdrops - Automated Onchain Reward and Engagement Platform" />
        <meta property="og:description" content="Automated onchain reward and engagement platform 💧. Distribute tokens effortlessly across multiple chains." />
        <meta property="og:image" content="https://app.faucetdrops.io/opengraph-image" />
        <meta property="og:image:secure_url" content="https://app.faucetdrops.io/opengraph-image" />
        <meta property="og:image:type" content="image/jpeg" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="app.faucetdrops - Automated onchain reward and engagement platform" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content="https://app.faucetdrops.io/" />
        <meta name="twitter:title" content="app.faucetdrops - Automated Onchain Reward and Engagement Platform" />
        <meta name="twitter:description" content="Automated onchain reward and engagement platform 💧. Distribute tokens effortlessly across multiple chains." />
        <meta name="twitter:image" content="https://app.faucetdrops.io/opengraph-image" />
        <meta name="twitter:image:alt" content="app.faucetdrops - Automated onchain reward and engagement platform" />
        <meta name="keywords" content="token drops, crypto faucet, onchain rewards, web3 engagement, token distribution, blockchain rewards" />
        <meta name="author" content="FaucetDrops" />
        <link rel="canonical" href="https://app.faucetdrops.io/" />
        <meta name="theme-color" content="#020817" />
      </head>
      <body className={inter.className}>
        <ThemeProvider 
  attribute="class" 
  defaultTheme="light" 
  enableSystem={false}
  disableTransitionOnChange
>
  <WalletProvider>
    <PresenceProvider>
      <div className="min-h-screen flex flex-col">
        <main className="flex-1">
          {children}
        </main>
      </div>
      <BottomNav />
      <Toaster richColors position="top-center" closeButton />
    </PresenceProvider>
  </WalletProvider>
</ThemeProvider>
      </body>
    </html>
  )
}