"use client";

/**
 * /app/challenge/page.tsx — MiniPay-first, max-width 480px
 * Matches landing page aesthetic: Big Shoulders Display + Figtree, CSS variables
 */

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/hooks/use-wallet";
import { Header } from "@/components/header";
import { Input } from "@/components/ui/input";
import {
  Plus, Trophy, Users, Loader2, Gamepad2,
  RefreshCw, ChevronRight, Zap, Swords, XCircle,
} from "lucide-react";
import { toast } from "sonner";
import Loading from "../loading/page";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://faucetpay-backend.koyeb.app";
const CELO_CHAIN_ID = 42220;

interface LobbyChallenge {
  code: string; topic: string; stake_amount: number; token_symbol: string;
  chain_id: number; created_at: string; creator_username: string;
}
interface HistoryChallenge {
  code: string; topic: string; stake_amount: number; token_symbol: string;
  status: "waiting"|"active"|"finished"; winner_address: string|null;
  created_at: string; finished_at: string|null;
}

const fmt = (n: number) => n%1===0 ? n.toString() : n.toFixed(n<1?2:1)
function timeAgo(iso: string) {
  const d = Math.floor((Date.now()-new Date(iso).getTime())/1000)
  if(d<60) return `${d}s ago`; if(d<3600) return `${Math.floor(d/60)}m ago`
  if(d<86400) return `${Math.floor(d/3600)}h ago`; return `${Math.floor(d/86400)}d ago`
}

const S = `
  @import url('https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;900&family=Figtree:wght@400;500;600;700;800&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  :root{--dd-bg:#ffffff;--dd-surface:rgba(0,0,0,0.02);--dd-text:#0f172a;--dd-text-dim:rgba(15,23,42,0.45);--dd-text-mute:rgba(15,23,42,0.25);--dd-line:rgba(15,23,42,0.08);--dd-line-soft:rgba(15,23,42,0.05);--dd-blue:#2563eb;--dd-blue2:#1d4ed8;--dd-blue-bg:rgba(37,99,235,0.10);--dd-card-border:rgba(15,23,42,0.08)}
  .dark{--dd-bg:#020617;--dd-surface:rgba(255,255,255,0.02);--dd-text:#ffffff;--dd-text-dim:rgba(255,255,255,0.45);--dd-text-mute:rgba(255,255,255,0.25);--dd-line:rgba(255,255,255,0.07);--dd-line-soft:rgba(255,255,255,0.05);--dd-blue-bg:rgba(37,99,235,0.15);--dd-card-border:rgba(255,255,255,0.08)}
  .dd-page{background:var(--dd-bg);color:var(--dd-text);font-family:'Figtree',sans-serif;transition:background .25s,color .25s}
  .d{font-family:'Big Shoulders Display',sans-serif}
  .dd-card{border:1px solid var(--dd-card-border);border-radius:16px;background:var(--dd-surface)}
  .btn-blue{background:var(--dd-blue);color:#fff;border:none;cursor:pointer;font-family:'Figtree',sans-serif;font-weight:700;transition:background .2s,transform .15s;display:flex;align-items:center;justify-content:center;gap:8px}
  .btn-blue:hover{background:var(--dd-blue2)}.btn-blue:active{transform:scale(.97)}
  .btn-ghost{background:transparent;border:1.5px solid var(--dd-line);cursor:pointer;font-family:'Figtree',sans-serif;font-weight:700;color:var(--dd-text);transition:border-color .2s,background .2s,transform .15s;display:flex;align-items:center;justify-content:center;gap:8px}
  .btn-ghost:hover{border-color:rgba(37,99,235,.5);background:rgba(37,99,235,.06)}.btn-ghost:active{transform:scale(.97)}
  .lobby-card{border:1.5px solid var(--dd-card-border);border-radius:14px;background:var(--dd-surface);transition:border-color .2s,transform .15s;cursor:pointer}
  .lobby-card:hover{border-color:var(--dd-blue);transform:translateY(-2px)}
  .lobby-card:active{transform:scale(.98)}
  .history-row{transition:border-color .15s}.history-row:active{transform:scale(.99)}
  .support-fab:active{transform:scale(.96)!important}
  .spin{animation:spin 1s linear infinite}
  @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
`

export default function QuizListPage() {
  const router = useRouter();
  const { address: userWalletAddress } = useWallet();
  const [tab, setTab] = useState<"lobby"|"history">("lobby");
  const [lobbyChallenges, setLobbyChallenges] = useState<LobbyChallenge[]>([]);
  const [history, setHistory] = useState<HistoryChallenge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [navigating, setNavigating] = useState<string|null>(null);

  const fetchLobby = async (silent=false) => {
    if(!silent) setIsLoading(true); else setIsRefreshing(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/challenge/lobby`);
      const d = await r.json();
      if(d.success) setLobbyChallenges((d.challenges as LobbyChallenge[]).filter(c=>c.chain_id===CELO_CHAIN_ID));
    } catch { toast.error("Failed to sync lobby") }
    finally { setIsLoading(false); setIsRefreshing(false) }
  };

  const fetchHistory = async () => {
    if(!userWalletAddress) return;
    setHistoryLoading(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/challenge/${userWalletAddress.toLowerCase()}/history?limit=50`);
      const d = await r.json();
      if(d.success) setHistory((d.history??[]).filter((h:HistoryChallenge)=>h.status==="finished"));
    } catch { toast.error("Failed to load match history") }
    finally { setHistoryLoading(false) }
  };

  useEffect(()=>{ fetchLobby() },[]);
  useEffect(()=>{ if(tab==="history"&&userWalletAddress) fetchHistory() },[tab,userWalletAddress]);
  useEffect(()=>{
    if(tab!=="lobby") return;
    const t = setInterval(()=>fetchLobby(true),15000);
    return ()=>clearInterval(t)
  },[tab]);

  const myWallet = userWalletAddress?.toLowerCase()??"";
  const wins = useMemo(()=>history.filter(h=>h.winner_address?.toLowerCase()===myWallet),[history,myWallet]);
  const totalWon = useMemo(()=>wins.reduce((s,h)=>s+h.stake_amount*2,0),[wins]);

  const handleJoinAction = async (code: string) => {
    if(code.length<4) return;
    setNavigating(code);
    if(!userWalletAddress){ router.push(`/challenge/${code}/pre-lobby`); return }
    try {
      const res = await fetch(`${API_BASE_URL}/api/challenge/${code}`);
      const data = await res.json();
      if(data.success&&data.challenge){
        const c=data.challenge, w=userWalletAddress.toLowerCase();
        const isCreator=c.creator?.toLowerCase()===w;
        const isPlayer=c.players&&Object.keys(c.players).some((p:string)=>p.toLowerCase()===w);
        const cnt=Object.keys(c.players||{}).length;
        if(isCreator) router.push(cnt>=2?`/challenge/${code}`:`/challenge/${code}/pre-lobby`);
        else router.push(isPlayer?`/challenge/${code}`:`/challenge/${code}/pre-lobby`);
      } else router.push(`/challenge/${code}/pre-lobby`);
    } catch { router.push(`/challenge/${code}/pre-lobby`) }
  };

  return (
    <>
      <style>{S}</style>
      <div className="dd-page" style={{ maxWidth:480, margin:"0 auto", minHeight:"100vh", paddingBottom:80 }}>
        <Header pageTitle="Duel Arena"/>

        <div style={{ padding:"16px 20px", display:"flex", flexDirection:"column", gap:16 }}>

          {/* Hero + Quick Join */}
          <div style={{ background:"var(--dd-blue)", borderRadius:16, padding:20 }}>
            <h1 className="d" style={{ fontSize:36, fontWeight:900, color:"#fff", lineHeight:1, marginBottom:4 }}>
              STAKE <span style={{ opacity:0.7 }}>&</span> EARN
            </h1>
            <p style={{ fontSize:12, color:"rgba(255,255,255,0.7)", marginBottom:16 }}>
              Celo-based 1v1 quizzes. Winner takes the pool.
            </p>
            <div style={{ display:"flex", gap:8 }}>
              <input
                value={codeInput}
                onChange={e=>setCodeInput(e.target.value.toUpperCase())}
                onKeyDown={e=>e.key==="Enter"&&handleJoinAction(codeInput)}
                placeholder="ROOM CODE"
                maxLength={8}
                style={{ flex:1, height:48, borderRadius:10, border:"1.5px solid rgba(255,255,255,0.25)", background:"rgba(255,255,255,0.12)", color:"#fff", padding:"0 14px", fontSize:14, fontWeight:700, fontFamily:"monospace", outline:"none" }}
              />
              <button
                onClick={()=>handleJoinAction(codeInput)}
                disabled={!codeInput||navigating!==null}
                style={{ height:48, padding:"0 20px", borderRadius:10, background:"#fff", color:"var(--dd-blue)", border:"none", fontWeight:900, fontSize:14, cursor:"pointer", display:"flex", alignItems:"center", gap:6, flexShrink:0, opacity:!codeInput?0.6:1, transition:"opacity .2s" }}>
                {navigating===codeInput?<Loader2 size={16} className="spin"/>:<><Zap size={14}/>DUEL</>}
              </button>
            </div>
          </div>

          {/* Create button */}
          <button className="btn-blue" onClick={()=>router.push("/challenge/create-challenge")} style={{ width:"100%", height:48, borderRadius:12, fontSize:14 }}>
            <Plus size={16}/> Create Challenge
          </button>

          {/* Tab + Refresh row */}
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <div style={{ flex:1, display:"flex", padding:4, borderRadius:12, background:"var(--dd-surface)", border:"1px solid var(--dd-line)" }}>
              {(["lobby","history"] as const).map(t=>(
                <button key={t} onClick={()=>setTab(t)} style={{ flex:1, padding:"9px 8px", borderRadius:9, border:"none", cursor:"pointer", background:tab===t?"var(--dd-blue)":"transparent", color:tab===t?"#fff":"var(--dd-text-dim)", fontWeight:900, fontSize:12, fontFamily:"'Figtree',sans-serif", letterSpacing:"0.05em", transition:"all .2s", textTransform:"uppercase" }}>
                  {t==="lobby"?"PUBLIC":"MY WINS"}
                </button>
              ))}
            </div>
            <button onClick={()=>tab==="lobby"?fetchLobby(true):fetchHistory()} disabled={isRefreshing||historyLoading} style={{ width:40, height:40, borderRadius:20, border:"1.5px solid var(--dd-line)", background:"var(--dd-surface)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", flexShrink:0 }}>
              <RefreshCw size={15} style={{ color:"var(--dd-blue)" }} className={(isRefreshing||historyLoading)?"spin":""}/>
            </button>
          </div>

          {/* LOBBY TAB */}
          {tab==="lobby" && (
            isLoading ? <div style={{ display:"flex", justifyContent:"center", padding:"48px 0" }}><Loading/></div>
            : lobbyChallenges.length===0 ? (
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", padding:"48px 20px", gap:12, border:"2px dashed var(--dd-line)", borderRadius:16, textAlign:"center" }}>
                <Gamepad2 size={40} style={{ color:"var(--dd-text-mute)" }}/>
                <p className="d" style={{ fontSize:18, fontWeight:900, color:"var(--dd-text-dim)" }}>No active duels</p>
                <p style={{ fontSize:13, color:"var(--dd-text-mute)" }}>Be first to create a public challenge on Celo.</p>
                <button className="btn-blue" onClick={()=>router.push("/challenge/create-challenge")} style={{ padding:"11px 24px", borderRadius:10, fontSize:13, marginTop:4 }}>Start Duel</button>
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {lobbyChallenges.map(c=>(
                  <button key={c.code} className="lobby-card" onClick={()=>handleJoinAction(c.code)} style={{ padding:16, textAlign:"left", width:"100%" }}>
                    <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:10, marginBottom:12 }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <h3 className="d" style={{ fontSize:16, fontWeight:900, color:"var(--dd-text)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{c.topic}</h3>
                        <p style={{ fontSize:11, color:"var(--dd-text-mute)", marginTop:2 }}>@{c.creator_username}</p>
                      </div>
                      <span style={{ padding:"4px 10px", borderRadius:6, background:"var(--dd-blue)", color:"#fff", fontSize:10, fontWeight:900, textTransform:"uppercase", flexShrink:0 }}>Join Pool</span>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", borderTop:"1px solid var(--dd-line)", borderBottom:"1px solid var(--dd-line)", padding:"10px 0", marginBottom:10, gap:0 }}>
                      <div style={{ flex:1, textAlign:"center" }}>
                        <p style={{ fontSize:10, color:"var(--dd-text-mute)", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:2 }}>Entry</p>
                        <p className="d" style={{ fontSize:15, fontWeight:900, color:"var(--dd-text)" }}>{fmt(c.stake_amount)} {c.token_symbol}</p>
                      </div>
                      <div style={{ width:1, background:"var(--dd-line)", alignSelf:"stretch" }}/>
                      <div style={{ flex:1, textAlign:"center" }}>
                        <p style={{ fontSize:10, color:"var(--dd-blue)", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:2 }}>Prize Pool</p>
                        <p className="d" style={{ fontSize:15, fontWeight:900, color:"var(--dd-blue)" }}>🏆 {fmt(c.stake_amount*2)} {c.token_symbol}</p>
                      </div>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                      <span style={{ fontSize:11, color:"var(--dd-text-mute)", fontFamily:"monospace" }}>#{c.code}</span>
                      <div style={{ display:"flex", alignItems:"center", gap:4, color:"var(--dd-blue)", fontSize:11, fontWeight:900 }}>
                        {navigating===c.code?<Loader2 size={13} className="spin"/>:<>CHALLENGE<ChevronRight size={12}/></>}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )
          )}

          {/* MY WINS TAB */}
          {tab==="history" && (
            !userWalletAddress ? (
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", padding:"48px 20px", gap:12, border:"1.5px solid var(--dd-line)", borderRadius:16, textAlign:"center" }}>
                <Trophy size={40} style={{ color:"var(--dd-text-mute)" }}/>
                <p style={{ fontSize:14, fontWeight:700, color:"var(--dd-text-dim)" }}>Connect your wallet to see your wins.</p>
              </div>
            ) : historyLoading ? (
              <div style={{ display:"flex", justifyContent:"center", padding:"48px 0" }}><Loading/></div>
            ) : (
              <>
                {history.length>0 && (
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
                    {[
                      { label:"Played", val:history.length, color:"var(--dd-text)" },
                      { label:"Won",    val:wins.length,    color:"#1d4ed8" },
                      { label:"Win Rate", val:`${history.length>0?Math.round((wins.length/history.length)*100):0}%`, color:"var(--dd-blue)" },
                    ].map(s=>(
                      <div key={s.label} className="dd-card" style={{ padding:"14px 8px", textAlign:"center" }}>
                        <p className="d" style={{ fontSize:22, fontWeight:900, color:s.color }}>{s.val}</p>
                        <p style={{ fontSize:9, fontWeight:700, color:"var(--dd-text-mute)", textTransform:"uppercase", letterSpacing:"0.1em", marginTop:3 }}>{s.label}</p>
                      </div>
                    ))}
                  </div>
                )}

                {wins.length===0 ? (
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"center", padding:"40px 20px", gap:10, border:"2px dashed var(--dd-line)", borderRadius:16, textAlign:"center" }}>
                    <Trophy size={36} style={{ color:"var(--dd-text-mute)" }}/>
                    <p className="d" style={{ fontSize:15, fontWeight:800, color:"var(--dd-text-dim)" }}>{history.length===0?"No matches played yet.":"No wins yet — keep playing!"}</p>
                    {history.length===0 && <button className="btn-blue" onClick={()=>setTab("lobby")} style={{ padding:"10px 20px", borderRadius:10, fontSize:12, marginTop:4 }}>Find a Challenge</button>}
                  </div>
                ) : (
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    {wins.map(item=>(
                      <button key={item.code} className="history-row" onClick={()=>router.push(`/challenge/${item.code}`)} style={{ display:"flex", alignItems:"center", gap:12, padding:"14px", borderRadius:14, border:"1.5px solid rgba(251,191,36,0.3)", background:"rgba(251,191,36,0.03)", cursor:"pointer", textAlign:"left", width:"100%" }}>
                        <div style={{ width:36, height:36, borderRadius:10, flexShrink:0, background:"rgba(251,191,36,0.1)", border:"1.5px solid rgba(251,191,36,0.3)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                          <Trophy size={15} style={{ color:"#fbbf24" }}/>
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <p style={{ fontSize:13, fontWeight:700, color:"var(--dd-text)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", fontFamily:"'Figtree',sans-serif" }}>{item.topic}</p>
                          <p style={{ fontSize:10, color:"var(--dd-text-mute)", fontFamily:"monospace", marginTop:2 }}>#{item.code}{item.finished_at&&` · ${timeAgo(item.finished_at)}`}</p>
                        </div>
                        <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:3, flexShrink:0 }}>
                          <span style={{ fontSize:10, fontWeight:900, padding:"2px 7px", borderRadius:20, background:"rgba(251,191,36,0.1)", border:"1px solid rgba(251,191,36,0.3)", color:"#1d4ed8" }}>WON</span>
                          <span style={{ fontSize:10, fontWeight:700, color:"var(--dd-text-dim)" }}>{fmt(item.stake_amount)} {item.token_symbol}</span>
                          <span style={{ fontSize:10, fontWeight:900, color:"#1d4ed8" }}>+{fmt(item.stake_amount*2)} {item.token_symbol}</span>
                        </div>
                        <ChevronRight size={13} style={{ color:"var(--dd-text-mute)", flexShrink:0 }}/>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )
          )}
        </div>
      </div>
      {/* Floating Support Button */}
{/* Floating Support Button */}
<button
  onClick={() => router.push("/support")}
  style={{
    position: "fixed",
    bottom: 100,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: "50%",
    background: "var(--dd-blue)",
    color: "#fff",
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 4px 16px rgba(37,99,235,0.4)",
    zIndex: 999,
    transition: "transform .2s, box-shadow .2s",
  }}
  onMouseEnter={e => {
    (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-3px)";
    (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 8px 24px rgba(37,99,235,0.5)";
  }}
  onMouseLeave={e => {
    (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
    (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 16px rgba(37,99,235,0.4)";
  }}
>
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
</button>
    </>
  );
}