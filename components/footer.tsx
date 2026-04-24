"use client"

import React from "react"
import { Github, Mail, Youtube } from "lucide-react"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import Link from "next/link"
import { useTheme } from "next-themes"

const XIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
)

const TelegramIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
  </svg>
)

interface FooterProps {
  className?: string
}

export const Footer: React.FC<FooterProps> = ({ className = "" }) => {
  const { resolvedTheme } = useTheme()
  const dark = resolvedTheme === "dark"

  // All colors derived from theme — mirrors the landing page variable system
  const c = {
    bg:       dark ? "#020617"                : "#ffffff",
    border:   dark ? "rgba(255,255,255,0.07)" : "rgba(2,6,23,0.07)",
    divider:  dark ? "rgba(255,255,255,0.10)" : "rgba(2,6,23,0.10)",
    text:     dark ? "rgba(255,255,255,0.85)" : "rgba(2,6,23,0.85)",
    dim:      dark ? "rgba(255,255,255,0.40)" : "rgba(2,6,23,0.45)",
    mute:     dark ? "rgba(255,255,255,0.30)" : "rgba(2,6,23,0.30)",
    icon:     dark ? "rgba(255,255,255,0.35)" : "rgba(2,6,23,0.35)",
  }

  const socialLinks = [
    { name: "X (Twitter)",  href: "https://x.com/FaucetDrops",                                      icon: XIcon,        hover: "hover:text-sky-500"   },
    { name: "YouTube",      href: "https://www.youtube.com/@Faucet_Drops",                           icon: Youtube,      hover: "hover:text-red-500"   },
    { name: "Telegram",     href: "https://t.me/FaucetDropschat",                                    icon: TelegramIcon, hover: "hover:text-blue-500"  },
    { name: "GitHub",       href: "https://github.com/priveedores-de-solucione/FaucetDrops",         icon: Github,       hover: dark ? "hover:text-white" : "hover:text-slate-900" },
    { name: "Email",        href: "mailto:drops.faucet@gmail.com",                                   icon: Mail,         hover: "hover:text-emerald-500"},
  ]

  return (
    <footer
      className={`mt-8 transition-[background,border-color] duration-300 ${className}`}
      style={{ background: c.bg, borderTop: `1px solid ${c.border}` }}
    >
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">

          {/* ── Brand & Tagline ── */}
          <div className="flex flex-col md:flex-row items-center gap-3 md:gap-4 text-center md:text-left">
            <div className="flex items-center gap-2">
              <span
                className="font-semibold md:hidden transition-colors duration-300"
                style={{ color: c.text }}
              >
                Built By FaucetDrops
              </span>
              <Image
                src="/favicon.png"
                alt="FaucetDrops Logo"
                width={40}
                height={40}
                className="w-8 h-8 lg:w-10 lg:h-10 rounded-md object-contain flex-shrink-0"
              />
              
            </div>

            <div
              className="hidden md:block w-px h-6 transition-colors duration-300"
              style={{ background: c.divider }}
            />

            <span
              className="text-xs sm:text-sm transition-colors duration-300"
              style={{ color: c.dim }}
            >
              Automated onchain reward and engagement platform
            </span>
          </div>

          {/* ── Socials & Copyright ── */}
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">

            {/* Social icons */}
            <div className="flex items-center gap-1">
              {socialLinks.map(({ name, href, icon: Icon, hover }) => (
                <Button
                  key={name}
                  variant="ghost"
                  size="icon"
                  asChild
                  className={`h-8 w-8 transition-colors duration-200 ${hover}`}
                  style={{ color: c.icon }}
                >
                  <Link href={href} target="_blank" rel="noopener noreferrer" aria-label={name} title={name}>
                    <Icon className="h-4 w-4" />
                  </Link>
                </Button>
              ))}
            </div>

            {/* Copyright & links */}
            <div
              className="flex items-center gap-4 text-xs transition-colors duration-300"
              style={{ color: c.mute }}
            >
              <span>&copy; {new Date().getFullYear()}</span>
              <div className="flex items-center gap-3">
                {[{ label: "Privacy", href: "/privacy" }, { label: "Terms", href: "/terms" }].map(({ label, href }) => (
                  <Link
                    key={label}
                    href={href}
                    className="transition-colors duration-200"
                    style={{ color: c.mute }}
                    onMouseEnter={e => (e.currentTarget.style.color = c.text)}
                    onMouseLeave={e => (e.currentTarget.style.color = c.mute)}
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </footer>
  )
}