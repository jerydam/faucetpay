"use client"

import { useEffect, useRef, useState } from "react"
import { FaucetList } from "@/components/faucet-list"
import { AnalyticsDashboard } from "@/components/analytics-dashboard"
import { Header } from "@/components/header"
import { NetworkGrid } from "@/components/network"

// ── Galaxy Canvas Background ─────────────────────────────────────────────────
function GalaxyBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext("2d")!

    let animId: number
    let w = 0
    let h = 0

    // ── Star types: tiny drifters + mid twinklers + big anchors
    type Star = {
      x: number; y: number
      vx: number; vy: number
      r: number
      alpha: number
      alphaDir: number
      alphaSpeed: number
      layer: 0 | 1 | 2      // 0=far(slow), 1=mid, 2=near(fast)
    }

    const COUNTS = [220, 110, 55]
    const SPEEDS = [0.04, 0.12, 0.28]
    const RADII  = [[0.3, 0.8], [0.7, 1.4], [1.2, 2.6]]

    let stars: Star[] = []

    function buildStars() {
      stars = []
      COUNTS.forEach((count, layer) => {
        for (let i = 0; i < count; i++) {
          stars.push({
            x: Math.random() * w,
            y: Math.random() * h,
            vx: (Math.random() - 0.5) * SPEEDS[layer],
            vy: (Math.random() - 0.5) * SPEEDS[layer],
            r: RADII[layer][0] + Math.random() * (RADII[layer][1] - RADII[layer][0]),
            alpha: 0.2 + Math.random() * 0.8,
            alphaDir: Math.random() > 0.5 ? 1 : -1,
            alphaSpeed: 0.002 + Math.random() * 0.006,
            layer: layer as 0 | 1 | 2,
          })
        }
      })
    }

    function resize() {
      w = canvas.offsetWidth
      h = canvas.offsetHeight
      canvas.width  = w * window.devicePixelRatio
      canvas.height = h * window.devicePixelRatio
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
      buildStars()
    }

    function isDark() {
      return document.documentElement.classList.contains("dark")
    }

    function draw() {
      const dark = isDark()

      // ── Background gradient
      const bg = ctx.createRadialGradient(w * 0.5, h * 0.4, 0, w * 0.5, h * 0.4, Math.max(w, h) * 0.75)
      if (dark) {
        bg.addColorStop(0,   "rgba(15, 12, 30, 1)")
        bg.addColorStop(0.5, "rgba(8, 8, 20, 1)")
        bg.addColorStop(1,   "rgba(2, 4, 14, 1)")
      } else {
        bg.addColorStop(0,   "rgba(235, 240, 255, 1)")
        bg.addColorStop(0.5, "rgba(215, 225, 252, 1)")
        bg.addColorStop(1,   "rgba(195, 210, 248, 1)")
      }
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, w, h)

      // ── Nebula clouds (soft blobs)
      const nebulas = dark
        ? [
            { x: w * 0.15, y: h * 0.2, r: w * 0.35, color: "rgba(99,40,150,0.07)" },
            { x: w * 0.8,  y: h * 0.7, r: w * 0.3,  color: "rgba(30,60,180,0.06)" },
            { x: w * 0.5,  y: h * 0.5, r: w * 0.45, color: "rgba(20,80,120,0.04)" },
          ]
        : [
            { x: w * 0.15, y: h * 0.2, r: w * 0.35, color: "rgba(130,100,220,0.06)" },
            { x: w * 0.8,  y: h * 0.7, r: w * 0.3,  color: "rgba(80,120,240,0.05)" },
            { x: w * 0.5,  y: h * 0.5, r: w * 0.45, color: "rgba(100,140,255,0.04)" },
          ]

      nebulas.forEach(n => {
        const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r)
        g.addColorStop(0, n.color)
        g.addColorStop(1, "transparent")
        ctx.fillStyle = g
        ctx.fillRect(0, 0, w, h)
      })

      // ── Stars
      stars.forEach(s => {
        s.alpha += s.alphaDir * s.alphaSpeed
        if (s.alpha > 1)   { s.alpha = 1;   s.alphaDir = -1 }
        if (s.alpha < 0.1) { s.alpha = 0.1; s.alphaDir =  1 }

        s.x += s.vx
        s.y += s.vy
        if (s.x < -4) s.x = w + 4
        if (s.x > w + 4) s.x = -4
        if (s.y < -4) s.y = h + 4
        if (s.y > h + 4) s.y = -4

        ctx.save()
        ctx.globalAlpha = s.alpha

        if (dark) {
          const hue = s.layer === 2 ? "220,230,255" : "200,215,255"
          if (s.r > 1.5) {
            const glow = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 3.5)
            glow.addColorStop(0, `rgba(${hue},${s.alpha * 0.6})`)
            glow.addColorStop(1, "transparent")
            ctx.fillStyle = glow
            ctx.beginPath()
            ctx.arc(s.x, s.y, s.r * 3.5, 0, Math.PI * 2)
            ctx.fill()
          }
          ctx.fillStyle = `rgba(${hue},1)`
        } else {
          const hue = s.layer === 2 ? "60,80,160" : "80,100,180"
          if (s.r > 1.5) {
            const glow = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 3)
            glow.addColorStop(0, `rgba(${hue},${s.alpha * 0.4})`)
            glow.addColorStop(1, "transparent")
            ctx.fillStyle = glow
            ctx.beginPath()
            ctx.arc(s.x, s.y, s.r * 3, 0, Math.PI * 2)
            ctx.fill()
          }
          ctx.fillStyle = `rgba(${hue},${0.6 + s.alpha * 0.4})`
        }

        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      })

      animId = requestAnimationFrame(draw)
    }

    resize()
    window.addEventListener("resize", resize)
    draw()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener("resize", resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none z-0"
      aria-hidden
    />
  )
}

// ── Shooting Stars Canvas ─────────────────────────────────────────────────────
function ShootingStars() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx    = canvas.getContext("2d")!

    let animId: number
    let w = 0, h = 0

    type Meteor = {
      x: number; y: number
      vx: number; vy: number
      len: number
      life: number
      decay: number
      speed: number
    }

    const meteors: Meteor[] = []

    function resize() {
      w = canvas.offsetWidth
      h = canvas.offsetHeight
      canvas.width  = w * window.devicePixelRatio
      canvas.height = h * window.devicePixelRatio
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
    }

    function spawnMeteor() {
      const angleDeg = 20 + Math.random() * 40
      const angleRad = (angleDeg * Math.PI) / 180
      const speed    = 300 + Math.random() * 400

      // Spawn from top edge, left edge, or right edge (upper portion)
      const edge = Math.random()
      let sx: number, sy: number
      let flipX = 1

      if (edge < 0.6) {
        sx = Math.random() * w
        sy = 0
      } else if (edge < 0.8) {
        sx = 0
        sy = Math.random() * h * 0.6
      } else {
        sx    = w
        sy    = Math.random() * h * 0.4
        flipX = -1   // shoot toward left
      }

      meteors.push({
        x:     sx,
        y:     sy,
        vx:    Math.cos(angleRad) * speed * flipX,
        vy:    Math.sin(angleRad) * speed,
        len:   80 + Math.random() * 140,
        life:  1,
        decay: 0.6 + Math.random() * 0.8,
        speed,
      })
    }

    let nextSpawn = 1.5
    let sinceSpawn = 0
    let last = performance.now()

    function draw(now: number) {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      sinceSpawn += dt

      ctx.clearRect(0, 0, w, h)

      const dark = document.documentElement.classList.contains("dark")

      if (sinceSpawn >= nextSpawn) {
        spawnMeteor()
        sinceSpawn = 0
        nextSpawn  = 1.2 + Math.random() * 2.3
      }

      for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i]
        m.x    += m.vx * dt
        m.y    += m.vy * dt
        m.life -= m.decay * dt

        if (m.life <= 0 || m.x > w + 200 || m.y > h + 200 || m.x < -200) {
          meteors.splice(i, 1)
          continue
        }

        const norm = m.speed === 0 ? 1 : m.speed
        const tailX = m.x - (m.vx / norm) * m.len
        const tailY = m.y - (m.vy / norm) * m.len

        const grad = ctx.createLinearGradient(tailX, tailY, m.x, m.y)
        const a    = m.life

        if (dark) {
          grad.addColorStop(0,   `rgba(255,255,255,0)`)
          grad.addColorStop(0.6, `rgba(200,215,255,${a * 0.4})`)
          grad.addColorStop(1,   `rgba(255,255,255,${a})`)
        } else {
          grad.addColorStop(0,   `rgba(60,80,200,0)`)
          grad.addColorStop(0.6, `rgba(80,100,220,${a * 0.3})`)
          grad.addColorStop(1,   `rgba(60,80,200,${a * 0.8})`)
        }

        ctx.save()
        ctx.strokeStyle = grad
        ctx.lineWidth   = 1.5
        ctx.beginPath()
        ctx.moveTo(tailX, tailY)
        ctx.lineTo(m.x, m.y)
        ctx.stroke()

        // Bright head
        ctx.beginPath()
        ctx.arc(m.x, m.y, 1.8, 0, Math.PI * 2)
        ctx.fillStyle = dark
          ? `rgba(255,255,255,${a})`
          : `rgba(80,100,220,${a * 0.9})`
        ctx.fill()
        ctx.restore()
      }

      animId = requestAnimationFrame(draw)
    }

    resize()
    window.addEventListener("resize", resize)
    animId = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener("resize", resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none z-1"
      aria-hidden
    />
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Faucet() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <main className="relative min-h-screen bg-[#0f0c1e] dark:bg-[#0f0c1e]">
      {/* Galaxy layers — canvas only renders client-side, avoids hydration mismatch */}
      {mounted && (
        <>
          <GalaxyBackground />
          <ShootingStars />
        </>
      )}

      {/* Content */}
      <div className="relative z-10">
        <Header pageTitle="Faucet Engine" />
        <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8">
          <div className="flex flex-col gap-4 sm:gap-6 lg:gap-8">

            <div className="flex flex-col gap-4 sm:gap-6 lg:gap-8">
              <div className="bg-white/80 dark:bg-slate-900/70 backdrop-blur-md rounded-xl shadow-sm border border-white/60 dark:border-white/10 overflow-hidden">
                <NetworkGrid />
              </div>

              <div className="bg-white/80 dark:bg-slate-900/70 backdrop-blur-md rounded-xl shadow-sm border border-white/60 dark:border-white/10 overflow-hidden">
                <AnalyticsDashboard />
              </div>

              <div className="bg-white/80 dark:bg-slate-900/70 backdrop-blur-md rounded-xl shadow-sm border border-white/60 dark:border-white/10 overflow-hidden">
                <FaucetList />
              </div>
            </div>

          </div>
        </div>
      </div>
    </main>
  )
}