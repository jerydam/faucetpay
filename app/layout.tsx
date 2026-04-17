"use client"

import type React from "react"
import { useEffect } from "react"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "sonner"
import { NetworkProvider } from "@/hooks/use-network"
import { WalletProvider } from "@/components/wallet-provider"
import { Footer } from "@/components/footer"

import sdk from "@farcaster/miniapp-sdk"

const inter = Inter({ subsets: ["latin"] })

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
      } catch (error) {<meta name="talentapp:project_verification" content="98f7ce94c39130cef543fae892959918754270dff34594b8d7a129a75b6e2b6f052016215082a0071b59805b26c86d58ae8dec2460ee57a9652ab98f089e8461"></meta>
        console.warn("Failed to initialize Farcaster SDK", error);
      }
    };
    init();
  }, []);

  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
        
        {/* Primary Meta Tags */}
        <title>FaucetDrops - Automated Onchain Reward and Engagement Platform</title>
        <meta name="title" content="app.faucetdrops - Automated Onchain Reward and Engagement Platform" />
        <meta name="description" content="Automated onchain reward and engagement platform 💧. Distribute tokens effortlessly across multiple chains." />
        <meta name="talentapp:project_verification" content="98f7ce94c39130cef543fae892959918754270dff34594b8d7a129a75b6e2b6f052016215082a0071b59805b26c86d58ae8dec2460ee57a9652ab98f089e8461"></meta>
        {/* Open Graph / Facebook / WhatsApp / Telegram */}
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
        
        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content="https://app.faucetdrops.io/" />
        <meta name="twitter:title" content="app.faucetdrops - Automated Onchain Reward and Engagement Platform" />
        <meta name="twitter:description" content="Automated onchain reward and engagement platform 💧. Distribute tokens effortlessly across multiple chains." />
        <meta name="twitter:image" content="https://app.faucetdrops.io/opengraph-image" />
        <meta name="twitter:image:alt" content="app.faucetdrops - Automated onchain reward and engagement platform" />
        
        {/* Additional SEO */}
        <meta name="keywords" content="token drops, crypto faucet, onchain rewards, web3 engagement, token distribution, blockchain rewards" />
        <meta name="author" content="FaucetDrops" />
        <link rel="canonical" href="https://app.faucetdrops.io/" />
        
        {/* Theme Color */}
        <meta name="theme-color" content="#020817" />
      </head>
      <body className={inter.className}>
        <ThemeProvider 
          attribute="class" 
          defaultTheme="system" 
          enableSystem 
          disableTransitionOnChange
        >
          {/* SINGLE PROVIDER WRAPPER - handles Privy, Wagmi, and QueryClient */}
            <NetworkProvider>
              <WalletProvider>
                <div className="min-h-screen flex flex-col">
                  <main className="flex-1">
                    {children}
                  </main>
                  <Footer />
                </div>
                <Toaster richColors position="top-center" closeButton />
            </WalletProvider>
            </NetworkProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}