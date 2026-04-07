"use client"

import React from "react"
import { Github, Mail, Youtube } from "lucide-react"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import Link from "next/link"

// Custom icons for X (Twitter) and Telegram
const XIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
)

const TelegramIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
  </svg>
)

interface FooterProps {
  className?: string
}

export const Footer: React.FC<FooterProps> = ({ className = "" }) => {
  const socialLinks = [
    {
      name: "X (Twitter)",
      href: "https://x.com/FaucetDrops",
      icon: XIcon,
      hoverColor: "hover:text-sky-500"
    },
    {
      name: "YouTube",
      href: "https://www.youtube.com/@Faucet_Drops",
      icon: Youtube,
      hoverColor: "hover:text-red-500"
    },
    {
      name: "Telegram",
      href: "https://t.me/FaucetDropschat",
      icon: TelegramIcon,
      hoverColor: "hover:text-blue-500"
    },
    {
      name: "GitHub",
      href: "https://github.com/priveedores-de-solucione/FaucetDrops",
      icon: Github,
      hoverColor: "hover:text-gray-600 dark:hover:text-gray-300"
    },
    {
      name: "Email",
      href: "mailto:drops.faucet@gmail.com",
      icon: Mail,
      hoverColor: "hover:text-green-500"
    }
  ]

  return (
    <footer className={`bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 mt-8 ${className}`}>
      <div className="container mx-auto px-4 py-6">
        {/* Main Flex Container: Column on mobile, Row on Desktop */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          
          {/* Section 1: Brand & Tagline */}
          <div className="flex flex-col md:flex-row items-center gap-3 md:gap-4 text-center md:text-left">
            <div className="flex items-center gap-2">
              <div className="flex-shrink-0">
                <Image
                  src="/favicon.png"
                  alt="FaucetDrops Logo"
                  width={40}
                  height={40}
                  className="w-8 h-8 lg:w-10 lg:h-10 rounded-md object-contain"
                />
              </div>
              <span className="font-semibold text-slate-700 dark:text-slate-200 md:hidden">
                FaucetDrops
              </span>
            </div>
            
            {/* Divider for desktop only */}
            <div className="hidden md:block w-px h-6 bg-slate-300 dark:bg-slate-600"></div>
            
            <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Automated onchain reward and engagement platform
            </span>
          </div>

          {/* Section 2: Socials & Copyright (Stacked on mobile, side-by-side on desktop) */}
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
            
            {/* Social Icons */}
            <div className="flex items-center gap-2">
              {socialLinks.map((link) => {
                const IconComponent = link.icon
                return (
                  <Button
                    key={link.name}
                    variant="ghost"
                    size="icon"
                    asChild
                    className={`h-8 w-8 text-slate-500 dark:text-slate-400 transition-colors ${link.hoverColor}`}
                  >
                    <Link
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={link.name}
                      title={link.name}
                    >
                      <IconComponent className="h-4 w-4" />
                    </Link>
                  </Button>
                )
              })}
            </div>

            {/* Copyright & Links */}
            <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
              <span>&copy; {new Date().getFullYear()}</span>
              <div className="flex items-center gap-3">
                <Link
                  href="/privacy"
                  className="hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                >
                  Privacy
                </Link>
                <Link
                  href="/terms"
                  className="hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                >
                  Terms
                </Link>
              </div>
            </div>

          </div>
        </div>
      </div>
    </footer>
  )
}