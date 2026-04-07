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
import { Providers } from "@/components/PrivyProvider"
import { SubscriptionModalProvider } from "@/components/subscribe"
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
      } catch (error) {
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
        <meta name="talentapp:project_verification" content="b30a81da8fe68c308c2b4978535103484c8acb90b729ec9625b7eff07309c1fb86809ee621e63c5eedc5c592ddde2c2d2c2c0e8afa73980dcf6339e92b0839d7"></meta>
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
          <Providers>
            <NetworkProvider>
              <WalletProvider>
              <SubscriptionModalProvider>
                <div className="min-h-screen flex flex-col">
                  <main className="flex-1">
                    {children}
                  </main>
                  <Footer />
                </div>
                <Toaster richColors position="top-center" closeButton />
              </SubscriptionModalProvider>
            </WalletProvider>
            </NetworkProvider>
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  )
}