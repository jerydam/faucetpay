"use client";

/**
 * /app/page.tsx — High-Stakes Entry Point
 * Rebranded for Professional Competition & Reward Tiers.
 * Palette: Strict Blue (#2563eb) and Deep Slate (#020617).
 */

import React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { 
  Trophy, 
  Zap, 
  ArrowRight,
  Target,
  Users,
  ShieldCheck,
  TrendingUp,
  Gavel
} from "lucide-react";

export default function LandingPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#020617] text-white selection:bg-blue-500/30">
      
      {/* --- Minimalist Header --- */}
      <nav className="max-w-7xl mx-auto px-6 h-24 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 flex items-center justify-center">
            <Zap className="h-6 w-6 text-white fill-white" />
          </div>
          <span className="font-black text-2xl tracking-tighter uppercase italic">Arena</span>
        </div>
        <div className="hidden md:flex gap-8 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
          <a href="#mechanics" className="hover:text-blue-500 transition-colors">Mechanics</a>
          <a href="#security" className="hover:text-blue-500 transition-colors">Security</a>
        </div>
        <Button 
          onClick={() => router.push("/challenge")}
          className="bg-blue-600 hover:bg-blue-700 text-white font-black px-8 rounded-none uppercase tracking-widest text-xs h-12"
        >
          Connect Wallet
        </Button>
      </nav>

      {/* --- Hero: The Value Proposition --- */}
      <section className="relative pt-20 pb-32 px-6 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-blue-600/5 blur-[120px] rounded-full -z-10" />
        
        <div className="max-w-5xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center gap-3 px-4 py-2 bg-slate-900 border border-white/10 text-blue-400 text-[10px] font-black uppercase tracking-[0.3em]">
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            Live on Celo Mainnet
          </div>
          
          <h1 className="text-6xl md:text-8xl font-black leading-[0.85] tracking-tighter uppercase italic">
            Win the <span className="text-blue-600">Pool.</span> <br />
            Claim the <span className="text-blue-600">Rank.</span>
          </h1>
          
          <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto font-medium leading-relaxed">
            The premier decentralized arena for skill-based competition. Participate in global tournaments for rewards or initiate high-stakes 1v1 duels.
          </p>
        </div>
      </section>

      {/* --- Two Core Modes: High Contrast --- */}
      <section className="max-w-7xl mx-auto px-6 pb-32 grid grid-cols-1 md:grid-cols-2 gap-px bg-white/5 border border-white/5">
        
        {/* Tournament / Quiz Mode */}
        <div className="bg-[#020617] p-10 lg:p-16 space-y-8 group hover:bg-slate-950/50 transition-colors">
          <div className="space-y-4">
            <div className="w-12 h-12 border border-blue-600/30 flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-blue-600" />
            </div>
            <h2 className="text-3xl font-black uppercase tracking-tighter">Global Tournaments</h2>
            <p className="text-slate-400 leading-relaxed font-medium">
              Join time-limited quiz events. Top performers on the leaderboard split the designated Celo reward pool. Your knowledge determines your payout.
            </p>
          </div>
          
          <ul className="space-y-3 text-xs font-bold text-slate-500 uppercase tracking-widest">
            <li className="flex items-center gap-3"><Target className="h-4 w-4 text-blue-600" /> Tiered Reward Structure</li>
            <li className="flex items-center gap-3"><Users className="h-4 w-4 text-blue-600" /> Multi-player Competition</li>
          </ul>

          <Button 
            onClick={() => router.push("/quiz")}
            className="w-full h-16 bg-transparent border-2 border-white text-white hover:bg-white hover:text-black font-black text-sm uppercase tracking-[0.2em] transition-all"
          >
            Enter Tournament
          </Button>
        </div>

        {/* Challenge / Duel Mode */}
        <div className="bg-[#020617] p-10 lg:p-16 space-y-8 group hover:bg-slate-950/50 transition-colors border-l border-white/5">
          <div className="space-y-4">
            <div className="w-12 h-12 border border-blue-600/30 flex items-center justify-center">
              <Gavel className="h-6 w-6 text-blue-600" />
            </div>
            <h2 className="text-3xl font-black uppercase tracking-tighter">1v1 Staked Duels</h2>
            <p className="text-slate-400 leading-relaxed font-medium">
              Direct peer-to-peer challenges. Choose a topic, set the stake, and lock the pool. The winner takes the entire sum, minus a protocol fee.
            </p>
          </div>

          <ul className="space-y-3 text-xs font-bold text-slate-500 uppercase tracking-widest">
            <li className="flex items-center gap-3"><ShieldCheck className="h-4 w-4 text-blue-600" /> Escrowed Pool Security</li>
            <li className="flex items-center gap-3"><Zap className="h-4 w-4 text-blue-600" /> Instant Payouts</li>
          </ul>

          <Button 
            onClick={() => router.push("/challenge")}
            className="w-full h-16 bg-blue-600 text-white hover:bg-blue-700 font-black text-sm uppercase tracking-[0.2em] transition-all border-none"
          >
            Initiate Duel
          </Button>
        </div>
      </section>

      {/* --- Protocol Stats --- */}
      <section className="border-t border-white/5 bg-slate-950/30">
        <div className="max-w-7xl mx-auto py-16 px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { label: "Total Stakes", val: "500K+ CELO" },
            { label: "Active Duels", val: "1,240" },
            { label: "Global Players", val: "12,000+" },
            { label: "Uptime", val: "99.9%" },
          ].map((stat, i) => (
            <div key={i} className="text-center md:text-left">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{stat.label}</p>
              <p className="text-xl font-black text-white italic">{stat.val}</p>
            </div>
          ))}
        </div>
      </section>

      {/* --- Final CTA --- */}
      <section className="py-32 px-6 text-center border-t border-white/5">
        <div className="max-w-3xl mx-auto space-y-10">
          <h2 className="text-5xl md:text-6xl font-black uppercase tracking-tighter italic">Ready to settle the score?</h2>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={() => router.push("/challenge/create-quiz")}
              className="h-16 px-12 bg-white text-black hover:bg-blue-600 hover:text-white font-black uppercase tracking-widest transition-all"
            >
              Launch Challenge
            </Button>
          </div>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.4em]">Protocol Version 2.0 // Secured by Celo</p>
        </div>
      </section>
    </div>
  );
}