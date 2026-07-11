"use client"

import { useEffect, useState } from "react"
import { QRCodeSVG } from "qrcode.react"
import { Smartphone, Copy, Check } from "lucide-react"

const APP_URL = "https://minipay.faucetdrops.io"

export function MiniPayGate({ children }: { children: React.ReactNode }) {
  // null = still detecting (avoids flash of gate screen during hydration)
  const [inMiniPay, setInMiniPay] = useState<boolean | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    // MiniPay injects its provider before page scripts run, but give it a
    // brief grace window in case injection races the first render.
    const check = () => !!(window.ethereum as any)?.isMiniPay
    if (check()) { setInMiniPay(true); return }
    const t = setTimeout(() => setInMiniPay(check()), 600)
    return () => clearTimeout(t)
  }, [])

  // Detecting — render nothing (or a splash) to avoid gate flicker in MiniPay
  if (inMiniPay === null) return null

  if (inMiniPay) return <>{children}</>

  // ── Not MiniPay: landing screen ──
  const copyLink = () => {
    navigator.clipboard.writeText(APP_URL)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-6 text-center bg-background">
      <div className="text-6xl">⚡</div>
      <div className="space-y-2">
        <h1 className="text-2xl font-black text-foreground">PrimeIQ runs in MiniPay</h1>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          Open the MiniPay app, go to the browser tab, and paste this link:
        </p>
      </div>

      <button
        onClick={copyLink}
        className="flex items-center gap-2 px-4 py-3 rounded-2xl border-2 border-border bg-card font-mono text-sm font-bold hover:border-primary/50 transition-colors"
      >
        {APP_URL.replace("https://", "")}
        {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
      </button>

      {/* QR for desktop visitors scanning with their phone */}
      <div className="p-4 bg-white rounded-2xl border-2 border-border">
        <QRCodeSVG value={APP_URL} size={160} />
      </div>

      <p className="text-xs text-muted-foreground max-w-xs flex items-center gap-1.5 justify-center">
        <Smartphone className="h-3.5 w-3.5 shrink-0" />
        MiniPay is built into Opera Mini, or get it at minipay.opera.com
      </p>
    </div>
  )
}