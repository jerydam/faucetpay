"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { 
  ZeroAddress,
  isAddress as 
  ethersIsAddress,
  BrowserProvider,
  Contract, 
  parseUnits 
} from 'ethers'
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Loader2, Plus, Trash2, Save, Edit2, X, Lock, GripVertical,
  CheckCircle2, ChevronDown, ChevronUp, Upload, ExternalLink,
  Shield, Sparkles, Zap, AlertTriangle, Send, ShieldCheck,
  MessageSquareText, Code, Link as LinkIcon,
  DollarSign,
} from "lucide-react";
import { useWallet } from "../wallet-provider";

// ─── Constants ───────────────────────────────────────────────

const API_BASE_URL = "https://faucetdrop-backend.onrender.com";

const STAGES = ["Beginner", "Intermediate", "Advance", "Legend", "Ultimate"] as const;
type Stage = (typeof STAGES)[number];

const VERIFICATION_TYPES = [
  { value: "auto_social", label: "Auto Social" },
  { value: "auto_tx", label: "Auto TX" },
  { value: "onchain", label: "⚡ On-Chain Engine" },
  { value: "manual_link", label: "Manual Link" },
  { value: "manual_upload", label: "Manual Upload" },
  { value: "none", label: "Instant (Auto-Complete)" },
] as const;

const SOCIAL_PLATFORMS = ["Twitter", "Discord", "Telegram", "YouTube", "Instagram", "Website", "Other"] as const;

const ONCHAIN_ACTIONS = [
  { value: "hold_token", label: "Hold Token Balance" },
  { value: "hold_nft", label: "Hold NFT" },
  { value: "wallet_age", label: "Wallet Age Check" },
  { value: "tx_count", label: "Transaction Count" },
  { value: "timebound_interaction", label: "Timebound Contract Interaction" },
];

const getAvailableActions = (platform: string) => {
  switch (platform) {
    case "Twitter": return ["follow", "like & retweet", "quote", "comment"];
    case "Discord": return ["join", "role"];
    case "Telegram": return ["join", "message_count"];
    case "YouTube": return ["subscribe", "watch"];
    case "Website": return ["visit"];
    default: return ["follow", "join", "visit", "like"];
  }
};

const GENERAL_ACTIONS = [
  "follow", "join", "subscribe", "like", "retweet", "quote",
  "comment", "visit", "watch", "share", "swap", "trade",
  "hold_token", "hold_nft", "tx_count", "wallet_age",
];

const STAGE_COLORS: Record<Stage, string> = {
  Beginner: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Intermediate: "bg-blue-100 text-blue-700 border-blue-200",
  Advance: "bg-violet-100 text-violet-700 border-violet-200",
  Legend: "bg-amber-100 text-amber-700 border-amber-200",
  Ultimate: "bg-rose-100 text-rose-700 border-rose-200",
};

// ─── Suggested Tasks by Stage ─────────────────────────────────

const SUGGESTED_TASKS_BY_STAGE: Record<Stage, Array<Partial<EditableTask>>> = {
  Beginner: [
    { title: "Follow us on Twitter", description: "Follow our official X account.", category: "social", action: "follow", targetPlatform: "Twitter", points: 50, verificationType: "auto_social" },
    { title: "Join our Discord", description: "Become part of the community on Discord.", category: "social", action: "join", targetPlatform: "Discord", points: 50, verificationType: "auto_social" },
    { title: "Join Telegram Group", description: "Join our Telegram channel.", category: "social", action: "join", targetPlatform: "Telegram", points: 40, verificationType: "auto_social" },
    { title: "Like & Retweet on X", description: "Like & Retweet our post on X.", category: "social", action: "like & retweet", targetPlatform: "Twitter", points: 20, verificationType: "auto_social" },
    { title: "Visit Project Homepage", description: "Check out our official website.", category: "social", action: "visit", targetPlatform: "Website", points: 30, verificationType: "none" },
    { title: "Quote Quest on X", description: "Quote our post on X.", category: "social", action: "quote", targetPlatform: "Twitter", points: 20, verificationType: "auto_social" },
  ],
  Intermediate: [
    { title: "Attain 'Verified' Discord Role", description: "Get the Verified role in our server.", category: "social", action: "role", targetPlatform: "Discord", points: 80, verificationType: "auto_social" },
    { title: "Send 2 Messages in Telegram", description: "Be active and send 2 messages in the main chat.", category: "social", action: "message_count", targetPlatform: "Telegram", points: 60, verificationType: "auto_social", minTxCount: "2" },
    { title: "Subscribe to YouTube", description: "Subscribe to our YouTube channel.", category: "social", action: "subscribe", targetPlatform: "YouTube", points: 60, verificationType: "manual_upload" },
    { title: "Hold at least 0.01 ETH", description: "Hold a small amount of native token.", category: "trading", action: "hold_token", points: 80, verificationType: "onchain", minAmount: "0.01" },
    { title: "Make a Swap on DEX", description: "Execute at least one swap on a DEX.", category: "trading", action: "swap", points: 120, verificationType: "manual_link" },
  ],
  Advance: [
    { title: "Hold an NFT from Our Collection", description: "Own at least 1 NFT from the official collection.", category: "trading", action: "hold_nft", points: 200, verificationType: "onchain" },
    { title: "Make 3+ On-chain Transactions", description: "Complete at least 3 transactions on the target chain.", category: "trading", action: "tx_count", points: 180, verificationType: "onchain", minTxCount: "3" },
    { title: "Provide Liquidity ($50+)", description: "Add liquidity with at least $50 equivalent.", category: "trading", action: "swap", points: 250, verificationType: "manual_link", minAmount: "50" },
  ],
  Legend: [
    { title: "Cross-chain Bridge (2+ chains)", description: "Bridge assets between at least two different chains.", category: "trading", action: "swap", points: 600, verificationType: "manual_link" },
    { title: "Provide Liquidity for 7+ Days", description: "Add liquidity and maintain position for at least 7 days.", category: "trading", action: "swap", points: 500, verificationType: "manual_link" },
    { title: "Interact with Our Smart Contract", description: "Send at least one tx to our main contract.", category: "trading", action: "tx_count", points: 350, verificationType: "manual_link" },
  ],
  Ultimate: [
    { title: "Wallet Age > 90 Days + 50+ TX", description: "Have an aged wallet with significant on-chain history.", category: "trading", action: "wallet_age", points: 1200, verificationType: "onchain", minDays: "90", minTxCount: "50" },
    { title: "High Volume Trader ($10,000+)", description: "Execute swaps with cumulative value of $10k or more.", category: "trading", action: "swap", points: 1500, verificationType: "manual_link", minAmount: "10000" },
    { title: "Become an Ambassador", description: "Upload proof of Ambassador role assignment.", category: "general", action: "apply", points: 1000, verificationType: "manual_upload" },
  ],
};

// ─── Types ───────────────────────────────────────────────────

interface EditableTask {
  id: string;
  title: string;
  description: string;
  points: number;
  required: boolean;
  category: string;
  url: string;
  action: string;
  verificationType: string;
  targetPlatform: string;
  stage: Stage;
  targetHandle: string;
  targetServerId: string; 
  targetContractAddress: string;
  minAmount: string;
  minTxCount: string;
  minDays: string;
  startDate?: string; // <-- ADDED
  endDate?: string;   // <-- ADDED
  isSystem?: boolean;
  _isDirty?: boolean;
  _isNew?: boolean;
}

interface QuestEditPanelProps {
  questData: any;
  faucetAddress: string;
  creatorAddress: string;
  onQuestUpdated?: (partial: Partial<any>) => void;
}

// ─── Helpers ─────────────────────────────────────────────────

function makeBlankTask(stage: Stage = "Beginner"): EditableTask {
  return {
    id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    title: "",
    description: "",
    points: 50,
    required: true,
    category: "social",
    url: "",
    action: "follow",
    verificationType: "auto_social",
    targetPlatform: "Twitter",
    stage,
    targetHandle: "",
    targetServerId: "", // <-- Initialize
    targetContractAddress: "",
    minAmount: "",
    minTxCount: "",
    minDays: "",
    _isNew: true,
    _isDirty: true,
  };
}

function verificationIcon(vtype: string) {
  if (vtype === "auto_social") return <Sparkles className="h-3 w-3 text-blue-500" />;
  if (vtype === "onchain") return <Zap className="h-3 w-3 text-violet-500" />;
  if (vtype === "auto_tx") return <Shield className="h-3 w-3 text-green-500" />;
  return <ExternalLink className="h-3 w-3 text-slate-400" />;
}

function generateSocialTitle(platform: string, action: string): string {
  if (!platform || !action) return "";
  if (action === "role") return `Attain Role in ${platform}`;
  if (action === "message_count") return `Send Messages in ${platform}`;
  return `${action.charAt(0).toUpperCase() + action.slice(1)} our ${platform}`;
}

function normalizeUrl(url: string): string {
  if (!url) return "";
  let clean = url.trim();
  if (!/^https?:\/\//i.test(clean)) clean = `https://${clean}`;
  return clean.replace(/\/+$/, "");
}

// ─── Task Form (Add / Edit) ───────────────────────────────────

interface TaskFormProps {
  initial: EditableTask;
  onSave: (task: EditableTask) => void;
  onCancel: () => void;
  isDemoQuest?: boolean; 
}

function TaskForm({ initial, onSave, onCancel, isDemoQuest }: TaskFormProps) {
  
  const [task, setTask] = useState<EditableTask>({ ...initial });
  const availableVerificationTypes = isDemoQuest
    ? VERIFICATION_TYPES.filter(({ value }) => value === "auto_social" || value === "none")
    : VERIFICATION_TYPES;

  const [discordStatus, setDiscordStatus] = useState<{ checking: boolean; ok: boolean | null; msg: string }>({ checking: false, ok: null, msg: "" });
  const [telegramStatus, setTelegramStatus] = useState<{ checking: boolean; ok: boolean | null; botUsername: string }>({ checking: false, ok: null, botUsername: "" });

  const patch = (p: Partial<EditableTask>) => setTask((prev) => ({ ...prev, ...p, _isDirty: true }));

  const isSocial = task.category === "social";
  const isOnchain = task.verificationType === "onchain";
  const showContractAddress = ["hold_token", "hold_nft", "swap", "trade", "interact_contract", "timebound_interaction"].includes(task.action);
  const showMinAmount = ["hold_token", "swap", "trade"].includes(task.action);
  const showMinTxCount = task.action === "tx_count";
  const showMinDays = task.action === "wallet_age";
  const showTimeboundInputs = task.action === "timebound_interaction";

  // ADDED FORMATTER
  const formatForDateTimeLocal = (isoString?: string) => {
    if (!isoString) return "";
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return "";
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      return d.toISOString().slice(0, 16);
    } catch {
      return "";
    }
  };

  const getSocialInputLabel = () => {
    const p = task.targetPlatform;
    if (["Discord", "Telegram"].includes(p)) return "Server/Group Invite Link";
    if (["YouTube", "Instagram", "Website"].includes(p)) return "Profile / Content URL";
    return "Target Profile/Post URL";
  };

  const checkDiscord = async () => {
    if (!task.targetServerId) { toast.error("Enter the Discord Server ID first"); return; }
    setDiscordStatus({ checking: true, ok: null, msg: "" });
    try {
      const res = await fetch(`${API_BASE_URL}/api/bot/check-discord-status`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverId: task.targetServerId }), // <-- Changed from URL to targetServerId
      });
      const data = await res.json();
      setDiscordStatus({ checking: false, ok: data.is_in_server, msg: data.message || "" });
      data.is_in_server ? toast.success("Bot detected in server!") : toast.error("Bot not found in server.");
    } catch {
      setDiscordStatus({ checking: false, ok: false, msg: "Check failed" });
    }
  };

  const checkTelegram = async () => {
    if (!task.url || !task.url.includes("t.me")) { toast.error("Enter a Telegram URL first"); return; }
    setTelegramStatus((p) => ({ ...p, checking: true }));
    try {
      const res = await fetch(`${API_BASE_URL}/api/bot/check-telegram-admin`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelUrl: task.url }),
      });
      const data = await res.json();
      setTelegramStatus({ checking: false, ok: data.is_admin, botUsername: data.bot_username || "" });
    } catch {
      setTelegramStatus({ checking: false, ok: false, botUsername: "" });
    }
  };

  const suggestedForStage = SUGGESTED_TASKS_BY_STAGE[task.stage] || [];

  const applySuggestion = (s: Partial<EditableTask>) => {
    setTask((prev) => ({
      ...prev,
      ...s,
      stage: s.stage || prev.stage,
      id: prev.id,
      _isDirty: true,
      _isNew: prev._isNew,
    }));
    setDiscordStatus({ checking: false, ok: null, msg: "" });
    setTelegramStatus({ checking: false, ok: null, botUsername: "" });
  };

  const handleSave = () => {
    if (!task.title.trim()) { toast.error("Title is required"); return; }
    if (task.points < 0) { toast.error("Points must be ≥ 0"); return; }
    if (task.action === "timebound_interaction") {
      if (!task.targetContractAddress) { toast.error("Contract address is required."); return; }
      if (!task.url) { toast.error("Platform/dApp URL is required."); return; }
      if (!task.startDate || !task.endDate) { toast.error("Start and End dates are required."); return; }
    }
    if (task.targetPlatform === "Twitter" && ["quote", "comment"].includes(task.action) && !task.targetHandle) {
      toast.error("Target handle is required for quote/comment tasks"); return;
    }
    // Updated Validation: Discord requires a Server ID for auto_social Verification
    if (task.targetPlatform === "Discord" && task.verificationType === "auto_social" && !task.targetServerId) {
      toast.error("Server ID is required for Discord auto-verification"); return;
    }
    if (task.targetPlatform === "Discord" && task.action === "role" && !task.targetHandle) {
      toast.error("Role ID is required for Discord Role verification"); return;
    }
    if (task.targetPlatform === "Telegram" && task.action === "message_count" && (!task.minTxCount || Number(task.minTxCount) < 1)) {
      toast.error("A valid message count is required"); return;
    }
    onSave(task);
  };

  return (
    <div className="space-y-5 p-5 rounded-xl bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800">

      {/* ── Stage selector + Quick Add Templates ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="space-y-1 flex-1">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Stage</Label>
            <Select value={task.stage} onValueChange={(v) => patch({ stage: v as Stage })}>
              <SelectTrigger className="h-9 bg-white dark:bg-slate-950">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STAGES.map((s) => (
                  <SelectItem key={s} value={s}>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STAGE_COLORS[s]}`}>{s}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
            <Zap className="h-3 w-3 text-yellow-500" /> Quick Add Templates
          </Label>
          <div className="flex flex-wrap gap-1.5">
            {suggestedForStage.map((s, i) => (
              <Button key={i} variant="outline" size="sm"
                className="text-xs h-7 bg-white dark:bg-slate-900 hover:border-primary hover:text-primary transition-colors"
                onClick={() => applySuggestion(s)}>
                <Plus className="h-3 w-3 mr-1" />{s.title}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="h-px bg-slate-200 dark:bg-slate-700" />

      {/* ── Title + Points ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2 space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Task Title <span className="text-red-500">*</span>
          </Label>
          <Input value={task.title} placeholder="e.g. Follow us on Twitter"
            onChange={(e) => patch({ title: e.target.value })}
            className="h-10 bg-white dark:bg-slate-950" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Points</Label>
          <Input type="number" min={0} max={10000} value={task.points}
            onChange={(e) => patch({ points: Number(e.target.value) })}
            className="h-10 bg-white dark:bg-slate-950" />
        </div>
      </div>

      {/* ── Description ── */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Description</Label>
        <Textarea value={task.description} rows={2} placeholder="Describe what the user must do…"
          onChange={(e) => patch({ description: e.target.value })}
          className="resize-none bg-white dark:bg-slate-950 text-sm" />
      </div>

      {/* ── Category + Verification + Required ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 items-end">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Category</Label>
          <Select value={task.category} onValueChange={(v) => patch({ category: v })}>
            <SelectTrigger className="h-10 bg-white dark:bg-slate-950"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["social", "trading", "onchain", "community", "content", "general"].map((c) => (
                <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Verification</Label>
          <Select value={task.verificationType}
            onValueChange={(v) => patch({
              verificationType: v,
              action: v === "onchain" && !["hold_token","hold_nft","wallet_age","tx_count","timebound_interaction"].includes(task.action) ? "hold_token" : task.action,
            })}>
            <SelectTrigger className="h-10 bg-white dark:bg-slate-950"><SelectValue /></SelectTrigger>
            <SelectContent>
              {availableVerificationTypes.map(({ value, label }) => (
                <SelectItem key={value} value={value} className={value === "onchain" ? "font-bold text-violet-600" : ""}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-3 pb-1">
          <Switch id={`req-${task.id}`} checked={task.required} onCheckedChange={(v) => patch({ required: v })} />
          <Label htmlFor={`req-${task.id}`} className="text-sm font-medium cursor-pointer">Required</Label>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          SOCIAL TASK CONFIGURATION
      ══════════════════════════════════════════ */}
      {isSocial && (
        <div className="p-4 rounded-lg border border-blue-200 dark:border-blue-800/50 bg-blue-50/50 dark:bg-blue-950/10 space-y-4">
          <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Social Task Configuration
          </p>

          {/* Platform + Action */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-blue-600 dark:text-blue-400 font-semibold">Platform</Label>
              <Select value={task.targetPlatform || "Twitter"}
                onValueChange={(v) => {
                  const firstAction = getAvailableActions(v)[0];
                  patch({ targetPlatform: v, action: firstAction, title: generateSocialTitle(v, firstAction) });
                }}>
                <SelectTrigger className="h-9 bg-white dark:bg-slate-950 border-blue-200 dark:border-blue-800/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SOCIAL_PLATFORMS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-blue-600 dark:text-blue-400 font-semibold">Action</Label>
              <Select value={task.action}
                onValueChange={(v) => patch({ action: v, title: generateSocialTitle(task.targetPlatform, v) })}>
                <SelectTrigger className="h-9 bg-white dark:bg-slate-950 border-blue-200 dark:border-blue-800/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {getAvailableActions(task.targetPlatform || "Twitter").map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Auto-generated title (editable) */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Generated Title (editable)</Label>
            <Input value={task.title} onChange={(e) => patch({ title: e.target.value })}
              className="h-9 bg-white dark:bg-slate-950 border-blue-200 dark:border-blue-800/50 text-sm font-medium" />
          </div>

          {/* URL */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <LinkIcon className="h-3 w-3" /> {getSocialInputLabel()}
            </Label>
            <Input value={task.url} placeholder="https://..."
              onChange={(e) => patch({ url: e.target.value })}
              onBlur={() => { if (task.url?.includes(".")) patch({ url: normalizeUrl(task.url) }); }}
              className="h-9 bg-white dark:bg-slate-950 font-mono text-xs" />
          </div>

          {/* Twitter: handle for quote/comment/follow */}
          {task.targetPlatform === "Twitter" && ["quote", "comment", "follow"].includes(task.action) && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {task.action === "follow" ? "Twitter Handle to Follow" : "Target Tag/Handle"}
              </Label>
              <Input className="h-9 bg-white dark:bg-slate-950"
                placeholder="@YourProject"
                value={task.targetHandle}
                onChange={(e) => patch({ targetHandle: e.target.value.replace("@", "") })} />
            </div>
          )}

          {/* Discord: Server ID & Role ID */}
          {task.targetPlatform === "Discord" && task.verificationType === "auto_social" && (
            <div className="space-y-3">
              <div className="space-y-1.5 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
                <Label className="text-xs font-bold text-indigo-600 flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" /> Discord Server ID
                </Label>
                <Input className="h-9 bg-white dark:bg-slate-950" placeholder="e.g. 1476641584958144675"
                  value={task.targetServerId}
                  onChange={(e) => patch({ targetServerId: e.target.value })} />
                <p className="text-[10px] text-muted-foreground">Required for auto-verification. Right-click your Server name, and select "Copy Server ID".</p>
              </div>

              {task.action === "role" && (
                <div className="space-y-1.5 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
                  <Label className="text-xs font-bold text-indigo-600 flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3" /> Required Role ID
                  </Label>
                  <Input className="h-9 bg-white dark:bg-slate-950" placeholder="e.g. 104239849202392"
                    value={task.targetHandle}
                    onChange={(e) => patch({ targetHandle: e.target.value })} />
                  <p className="text-[10px] text-muted-foreground">Enable Developer Mode in Discord → right-click Role → "Copy Role ID"</p>
                </div>
              )}
            </div>
          )}

          {/* Telegram: message count */}
          {task.targetPlatform === "Telegram" && task.action === "message_count" && (
            <div className="space-y-1.5 p-3 bg-sky-500/10 border border-sky-500/20 rounded-lg">
              <Label className="text-xs font-bold text-sky-600 flex items-center gap-1">
                <MessageSquareText className="h-3 w-3" /> Required Message Count
              </Label>
              <Input type="number" className="h-9 bg-white dark:bg-slate-950" placeholder="e.g. 10"
                value={task.minTxCount}
                onChange={(e) => patch({ minTxCount: e.target.value })} />
              <p className="text-[10px] text-muted-foreground">Users must send this many messages in the group to pass.</p>
            </div>
          )}

          {/* ── Discord Bot Helper ── */}
          {task.targetPlatform === "Discord" && task.verificationType === "auto_social" && (
            <div className={`p-4 rounded-lg border text-sm transition-colors ${
              discordStatus.ok === true ? "bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800"
              : discordStatus.ok === false ? "bg-orange-50 border-orange-200 text-orange-800 dark:bg-orange-900/20 dark:border-orange-800"
              : "bg-indigo-50 border-indigo-200 text-indigo-800 dark:bg-indigo-900/20 dark:border-indigo-800"
            }`}>
              {discordStatus.ok === true ? (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span><strong>✅ Bot is in your server.</strong> Auto-verification is enabled!</span>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    {discordStatus.ok === false
                      ? <AlertTriangle className="h-5 w-5 text-orange-600 shrink-0 mt-0.5" />
                      : <ShieldCheck className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />}
                    <div>
                      <strong className="block mb-1">{discordStatus.ok === false ? "Bot not detected!" : "Action Required: Add Discord Bot"}</strong>
                      <p className="text-xs opacity-90">To verify server memberships automatically, our bot must be in your server.</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-black/10 dark:border-white/10">
                    <Button type="button" variant="outline" size="sm" className="text-xs h-8 bg-white dark:bg-slate-900"
                      onClick={() => window.open("https://discord.com/oauth2/authorize?client_id=1466125172342915145&permissions=8&integration_type=0&scope=bot", "_blank")}>
                      <Plus className="h-3 w-3 mr-1" /> Add Bot
                    </Button>
                    <Button type="button" size="sm" onClick={checkDiscord} disabled={discordStatus.checking || !task.targetServerId}
                      className={`text-xs h-8 text-white ${discordStatus.ok === false ? "bg-orange-600 hover:bg-orange-700" : "bg-indigo-600 hover:bg-indigo-700"}`}>
                      {discordStatus.checking ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Send className="h-3 w-3 mr-1" />}
                      {discordStatus.ok === false ? "Check Again" : "Verify Bot"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Telegram Bot Helper ── */}
          {task.targetPlatform === "Telegram" && task.verificationType === "auto_social" && (
            <div className={`p-4 rounded-lg border text-sm transition-colors ${
              telegramStatus.ok === true ? "bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800"
              : telegramStatus.ok === false ? "bg-orange-50 border-orange-200 text-orange-800 dark:bg-orange-900/20 dark:border-orange-800"
              : "bg-sky-50 border-sky-200 text-sky-800 dark:bg-sky-900/20 dark:border-sky-800"
            }`}>
              {telegramStatus.ok === true ? (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span><strong>✅ Bot is admin.</strong> Auto-verification is enabled!</span>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    {telegramStatus.ok === false
                      ? <AlertTriangle className="h-5 w-5 text-orange-600 shrink-0 mt-0.5" />
                      : <ShieldCheck className="h-5 w-5 text-sky-600 shrink-0 mt-0.5" />}
                    <div>
                      <strong className="block mb-1">{telegramStatus.ok === false ? "Bot is not an admin yet!" : "Action Required: Add Bot to Telegram"}</strong>
                      <p className="text-xs opacity-90">Add our bot to your channel/group as an administrator to enable auto-verification.</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-black/10 dark:border-white/10">
                    <Button type="button" variant="outline" size="sm" className="text-xs h-8 bg-white dark:bg-slate-900"
                      onClick={() => window.open(`https://t.me/${telegramStatus.botUsername || "FaucetDropsauth_bot"}?startgroup=true`, "_blank")}>
                      <Plus className="h-3 w-3 mr-1" /> Add Bot
                    </Button>
                    <Button type="button" size="sm" onClick={checkTelegram} disabled={telegramStatus.checking || !task.url}
                      className={`text-xs h-8 text-white ${telegramStatus.ok === false ? "bg-orange-600 hover:bg-orange-700" : "bg-sky-600 hover:bg-sky-700"}`}>
                      {telegramStatus.checking ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Send className="h-3 w-3 mr-1" />}
                      {telegramStatus.ok === false ? "Check Again" : "Verify Bot"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════
          ON-CHAIN VERIFICATION ENGINE
      ══════════════════════════════════════════ */}
      {isOnchain && (
        <div className="p-4 rounded-lg border border-violet-200 dark:border-violet-900/50 bg-violet-50/40 dark:bg-violet-950/10 space-y-4">
          <p className="text-xs font-semibold text-violet-700 dark:text-violet-400 uppercase tracking-wide flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5" /> On-Chain Verification Engine
          </p>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Requirement Type</Label>
            <Select value={task.action} onValueChange={(v) => patch({ action: v })}>
              <SelectTrigger className="h-10 bg-white dark:bg-slate-950 border-violet-200 dark:border-violet-800/50"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ONCHAIN_ACTIONS.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {showContractAddress && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                  <Code className="h-3 w-3" /> Contract Address
                </Label>
                <Input value={task.targetContractAddress} placeholder="0x… (Target Contract)"
                  onChange={(e) => patch({ targetContractAddress: e.target.value })}
                  className="h-9 font-mono text-xs bg-white dark:bg-slate-950" />
              </div>
            )}
            
            {/* NEW: Timebound Inputs */}
            {showTimeboundInputs && (
              <div className="space-y-4 col-span-1 sm:col-span-2 p-4 bg-white/50 dark:bg-slate-950/50 border border-violet-500/20 rounded-lg">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Platform / dApp URL</Label>
                  <Input value={task.url} placeholder="https://your-dapp.com/swap" onChange={e => patch({url: e.target.value})} className="h-9 bg-white dark:bg-slate-950 font-mono text-xs border-violet-500/30" />
                  <p className="text-[10px] text-muted-foreground">Participants will click this link to perform the interaction.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase text-muted-foreground">Start Date & Time (Local)</Label>
                    <Input type="datetime-local" value={formatForDateTimeLocal(task.startDate)} onChange={e => patch({startDate: e.target.value ? new Date(e.target.value).toISOString() : ""})} className="h-9 bg-white dark:bg-slate-950 border-violet-500/30 text-xs" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase text-muted-foreground">End Date & Time (Local)</Label>
                    <Input type="datetime-local" value={formatForDateTimeLocal(task.endDate)} onChange={e => patch({endDate: e.target.value ? new Date(e.target.value).toISOString() : ""})} className="h-9 bg-white dark:bg-slate-950 border-violet-500/30 text-xs" />
                  </div>
                </div>
              </div>
            )}

            {showMinAmount && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Min Amount</Label>
                <Input type="number" min={0} value={task.minAmount} placeholder="0"
                  onChange={(e) => patch({ minAmount: e.target.value })}
                  className="h-9 bg-white dark:bg-slate-950" />
              </div>
            )}
            {showMinTxCount && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Min TX Count</Label>
                <Input type="number" min={1} value={task.minTxCount} placeholder="10"
                  onChange={(e) => patch({ minTxCount: e.target.value })}
                  className="h-9 bg-white dark:bg-slate-950" />
              </div>
            )}
            {showMinDays && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Min Wallet Age (days)</Label>
                <Input type="number" min={1} value={task.minDays} placeholder="30"
                  onChange={(e) => patch({ minDays: e.target.value })}
                  className="h-9 bg-white dark:bg-slate-950" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Non-social, non-onchain: General Action + URL ── */}
      {!isSocial && !isOnchain && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Action</Label>
            <Select value={task.action} onValueChange={(v) => patch({ action: v })}>
              <SelectTrigger className="h-10 bg-white dark:bg-slate-950"><SelectValue /></SelectTrigger>
              <SelectContent>
                {GENERAL_ACTIONS.map((a) => <SelectItem key={a} value={a}>{a.replace(/_/g, " ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reference URL</Label>
            <Input value={task.url} placeholder="https://…"
              onChange={(e) => patch({ url: e.target.value })}
              className="h-10 font-mono text-xs bg-white dark:bg-slate-950" />
          </div>
        </div>
      )}

      {/* ── Target Handle for non-social manual tasks ── */}
      {["auto_social", "manual_link"].includes(task.verificationType) && !isSocial && (
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Target Handle / Role ID <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Input value={task.targetHandle} placeholder="@handle or role ID"
            onChange={(e) => patch({ targetHandle: e.target.value })}
            className="h-10 bg-white dark:bg-slate-950" />
        </div>
      )}

      {/* ── Save / Cancel ── */}
      <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button onClick={handleSave} className="min-w-[120px]">
          <Save className="h-4 w-4 mr-2" />
          {initial._isNew ? "Add Task" : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────
export function QuestEditPanel({
  questData,
  faucetAddress,
  creatorAddress,
  onQuestUpdated,
}: QuestEditPanelProps) {
  // ── Meta State ──
  const [metaTitle, setMetaTitle] = useState(questData?.title ?? "");
  const [metaImage, setMetaImage] = useState(questData?.imageUrl ?? "");
  const [isSavingMeta, setIsSavingMeta] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const { provider } = useWallet();
  const isDemoQuest = faucetAddress?.startsWith("draft-") || faucetAddress?.startsWith("demo-");

  // ── Distribution State ──
  const [distModel, setDistModel] = useState(questData?.distributionConfig?.model || "equal");
  const [totalWinners, setTotalWinners] = useState(questData?.distributionConfig?.totalWinners || "");
  const [tiers, setTiers] = useState<any[]>(questData?.distributionConfig?.tiers || []);
  const [isSavingDist, setIsSavingDist] = useState(false);

  // ── Funding State ──
  const [fundAmount, setFundAmount] = useState("");
  const [isFunding, setIsFunding] = useState(false);

  // ── Tasks State ──
  const [tasks, setTasks] = useState<EditableTask[]>([]);
  const [isFetchingTasks, setIsFetchingTasks] = useState(true);
  const [isSavingTasks, setIsSavingTasks] = useState(false);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [newTaskDraft, setNewTaskDraft] = useState<EditableTask | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<string | null>(null);
  const [systemTaskCount, setSystemTaskCount] = useState(0);

  const defaultStageForNew = (): Stage => {
    if (tasks.length === 0) return "Beginner";
    return tasks[tasks.length - 1].stage ?? "Beginner";
  };

  // ── Load tasks ──
  useEffect(() => {
    if (!faucetAddress || !creatorAddress) return;
    const load = async () => {
      setIsFetchingTasks(true);
      try {
        const res = await fetch(`${API_BASE_URL}/api/quests/${faucetAddress}/tasks/editable?adminAddress=${creatorAddress}`);
        const json = await res.json();
        if (json.success) {
          const mapped: EditableTask[] = (json.userTasks ?? []).map((t: any) => ({
            id: t.id ?? `task_${Date.now()}`,
            title: t.title ?? "",
            description: t.description ?? "",
            points: Number(t.points ?? 50),
            required: t.required ?? true,
            category: t.category ?? "social",
            url: t.url ?? "",
            action: t.action ?? "follow",
            verificationType: t.verificationType ?? "manual_link",
            targetPlatform: t.targetPlatform ?? "",
            stage: (STAGES.includes(t.stage) ? t.stage : "Beginner") as Stage,
            targetHandle: t.targetHandle ?? "",
            targetServerId: t.targetServerId ?? "", 
            targetContractAddress: t.targetContractAddress ?? "",
            minAmount: String(t.minAmount ?? ""),
            minTxCount: String(t.minTxCount ?? ""),
            minDays: String(t.minDays ?? ""),
            startDate: t.startDate ?? "",
            endDate: t.endDate ?? "",
          }));
          setTasks(mapped);
          setSystemTaskCount(json.systemTasksCount ?? 0);
        } else {
          toast.error("Could not load tasks");
        }
      } catch {
        toast.error("Failed to connect to server");
      } finally {
        setIsFetchingTasks(false);
      }
    };
    load();
  }, [faucetAddress, creatorAddress]);

  // ── Actions ──
  const handleSaveMeta = async () => {
    if (!metaTitle.trim() || metaTitle.trim().length < 3) { toast.error("Title must be at least 3 characters"); return; }
    setIsSavingMeta(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/quests/${faucetAddress}/meta`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminAddress: creatorAddress, title: metaTitle.trim(), imageUrl: metaImage.trim() || null }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Quest details saved!");
        onQuestUpdated?.({ title: metaTitle.trim(), imageUrl: metaImage.trim() });
      } else {
        toast.error(json.detail ?? "Save failed");
      }
    } catch (e: any) {
      toast.error(e.message ?? "Save failed");
    } finally {
      setIsSavingMeta(false);
    }
  };

  const handleSaveDistribution = async () => {
    setIsSavingDist(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/quests/${faucetAddress}/meta`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          adminAddress: creatorAddress, 
          distributionConfig: { model: distModel, totalWinners: totalWinners, tiers }
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Reward Distribution updated successfully!");
        onQuestUpdated?.({ distributionConfig: { model: distModel, totalWinners, tiers } });
      } else {
        toast.error(json.detail ?? "Failed to update distribution");
      }
    } catch (e: any) {
      toast.error(e.message ?? "Network error");
    } finally {
      setIsSavingDist(false);
    }
  };

  const handleFundQuest = async () => {
    if (!fundAmount || Number(fundAmount) <= 0) {
      toast.error("Please enter a valid amount to fund.");
      return;
    }
    if (!provider) {
      toast.error("Wallet not connected. Please connect your wallet.");
      return;
    }

    setIsFunding(true);
    try {
      // 1. Get the signer directly from your existing provider
      const signer = await provider.getSigner();

      // Check if the reward token is Native (ETH/CELO) or ERC20
      const isNative = questData?.rewardTokenType === 'native' || questData?.tokenAddress === ZeroAddress;
      
      let amountWei;
      // Minimal ABI for the Faucet's fund function
      const faucetAbi = ["function fund(uint256 _tokenAmount) payable"];

      if (isNative) {
        // Native tokens always use 18 decimals
        amountWei = parseUnits(fundAmount, 18);
        const contract = new Contract(faucetAddress, faucetAbi, signer);
        
        toast.info("Please confirm the funding transaction in your wallet...");
        // For native, we pass the amount as the argument AND as msg.value
        const tx = await contract.fund(amountWei, { value: amountWei });
        toast.info("Transaction submitted. Waiting for confirmation...");
        await tx.wait();

      } else {
        // 2. Handle ERC20 Tokens (Requires Approval first)
        const tokenAddress = questData?.tokenAddress;
        if (!tokenAddress) throw new Error("Token address is missing from quest data.");

        const erc20Abi = [
          "function decimals() view returns (uint8)",
          "function approve(address spender, uint256 amount) returns (bool)"
        ];
        const tokenContract = new Contract(tokenAddress, erc20Abi, signer);
        
        toast.info("Fetching token details...");
        const decimals = await tokenContract.decimals();
        amountWei = parseUnits(fundAmount, decimals);

        // A. Approve Faucet to spend the tokens
        toast.info("Please approve the token transfer in your wallet...");
        const approveTx = await tokenContract.approve(faucetAddress, amountWei);
        toast.info("Approval submitted. Waiting for confirmation...");
        await approveTx.wait();

        // B. Fund the Faucet
        toast.info("Please confirm the funding transaction...");
        const faucetContract = new Contract(faucetAddress, faucetAbi, signer);
        const tx = await faucetContract.fund(amountWei);
        toast.info("Transaction submitted. Waiting for confirmation...");
        await tx.wait();
      }

      // 3. Update Database to reflect new reward pool size
      toast.info("Syncing new balance to database...");
      const currentPool = parseFloat(questData?.rewardPool || "0");
      const addedAmount = parseFloat(fundAmount);
      const newTotal = (currentPool + addedAmount).toString();

      const res = await fetch(`${API_BASE_URL}/api/quests/${faucetAddress}/meta`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          adminAddress: creatorAddress, 
          rewardPool: newTotal 
        }),
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.detail || "Failed to sync database.");

      // 4. Update UI
      toast.success(`Successfully funded the quest with ${fundAmount} ${questData?.tokenSymbol || "Tokens"}!`);
      setFundAmount("");
      
      // Tell parent component to update the UI immediately
      onQuestUpdated?.({ rewardPool: newTotal });
      
    } catch (e: any) {
      console.error(e);
      const errorMsg = e.reason || e.shortMessage || e.message || "Transaction failed";
      toast.error("Funding failed: " + errorMsg);
    } finally {
      setIsFunding(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB"); return; }
    setIsUploadingImage(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API_BASE_URL}/upload-image`, { method: "POST", body: fd });
      const json = await res.json();
      const url = json.imageUrl ?? json.url;
      if (url) { setMetaImage(url); toast.success("Image uploaded!"); }
      else toast.error("Upload failed");
    } catch { toast.error("Upload error"); }
    finally { setIsUploadingImage(false); if (imageInputRef.current) imageInputRef.current.value = ""; }
  };

  // ── Task Array Handlers ──
  const startAddingTask = () => {
  if (isDemoQuest) {
    toast.error("Subscribe to unlock full quest editing");
    return;
  }
  setNewTaskDraft(makeBlankTask(defaultStageForNew()));
  setAddingNew(true);
  setEditingTaskId(null);
  setExpandedTask(null);
};
  const handleNewTaskSave = (task: EditableTask) => { setTasks((p) => [...p, task]); setAddingNew(false); setNewTaskDraft(null); toast.success("Task added — click Save All Tasks to persist"); };
const startEditing = (id: string) => {
  if (isDemoQuest) {
    toast.error("Subscribe to unlock full quest editing");
    return;
  }
  setEditingTaskId(id);
  setAddingNew(false);
  setNewTaskDraft(null);
  setExpandedTask(null);
};

  const handleEditSave = (updated: EditableTask) => { setTasks((p) => p.map((t) => (t.id === updated.id ? updated : t))); setEditingTaskId(null); toast.success("Task updated — click Save All Tasks to persist"); };
  const deleteTask = (id: string) => { setTasks((p) => p.filter((t) => t.id !== id)); setDeleteCandidate(null); if (editingTaskId === id) setEditingTaskId(null); toast.success("Task removed"); };
  
  const moveTask = (index: number, direction: "up" | "down") => {
    setTasks((prev) => {
      const next = [...prev];
      const swap = direction === "up" ? index - 1 : index + 1;
      if (swap < 0 || swap >= next.length) return prev;
      [next[index], next[swap]] = [next[swap], next[index]];
      return next;
    });
  };

  const handleSaveTasks = async () => {
    for (const t of tasks) {
      if (!t.title.trim()) { toast.error("A task has no title — please fill it in"); return; }
      if (t.points < 0) { toast.error(`"${t.title}": points must be ≥ 0`); return; }
    }
    setIsSavingTasks(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/quests/${faucetAddress}/tasks`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminAddress: creatorAddress, tasks: tasks.map(({ _isDirty, _isNew, ...t }) => t) }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.message ?? "Tasks saved successfully!");
        setTasks((prev) => prev.map((t) => ({ ...t, _isDirty: false, _isNew: false })));
        setTimeout(() => window.location.reload(), 1000);
      } else {
        toast.error(json.detail ?? "Save failed");
      }
    } catch (e: any) { toast.error(e.message ?? "Network error"); } 
    finally { setIsSavingTasks(false); }
  };

  const hasDirtyTasks = tasks.some((t) => t._isDirty || t._isNew) || addingNew;
  const metaChanged = metaTitle.trim() !== (questData?.title ?? "").trim() || metaImage.trim() !== (questData?.imageUrl ?? "").trim();

  return (
    <div className="space-y-8">
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* ══════════════════════════════════════════════════
            SECTION 1 — QUEST META
        ══════════════════════════════════════════════════ */}
        <Card className="border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
          <CardHeader className="pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Edit2 className="h-4 w-4 text-slate-500" /> Quest Details
                </CardTitle>
                <CardDescription className="mt-1">Edit the quest name and cover image.</CardDescription>
              </div>
              {metaChanged && <Badge variant="outline" className="border-amber-400 text-amber-600 bg-amber-50 dark:bg-amber-950/20 animate-pulse">Unsaved</Badge>}
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6 flex-1">
            <div className="space-y-2">
              <Label htmlFor="meta-title" className="text-sm font-semibold">Quest Title <span className="text-red-500">*</span></Label>
              <Input id="meta-title" value={metaTitle} maxLength={80} onChange={(e) => setMetaTitle(e.target.value)} className="h-11" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Quest Cover Image</Label>
              <div className="flex gap-3">
                <Input value={metaImage} placeholder="https://..." onChange={(e) => setMetaImage(e.target.value)} className="h-11 flex-1 font-mono text-sm" />
                <input type="file" accept="image/*" className="hidden" ref={imageInputRef} onChange={handleImageUpload} />
                <Button variant="outline" className="h-11 px-4 shrink-0" onClick={() => imageInputRef.current?.click()} disabled={isUploadingImage}>
                  {isUploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  <span className="ml-2 hidden sm:inline">Upload</span>
                </Button>
              </div>
              {metaImage && (
                <div className="relative w-full h-32 rounded-lg overflow-hidden border bg-slate-100 dark:bg-slate-900 mt-3">
                  <img src={metaImage} alt="Preview" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  <button className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1" onClick={() => setMetaImage("")}><X className="h-4 w-4" /></button>
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter className="border-t border-slate-100 dark:border-slate-800 pt-4 flex justify-end">
            <Button onClick={handleSaveMeta} disabled={isSavingMeta || !metaChanged} className="min-w-[140px]">
              {isSavingMeta ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />} Save Details
            </Button>
          </CardFooter>
        </Card>

        
      </div>

      {/* ══════════════════════════════════════════════════
          SECTION 2 — TASK EDITOR (GRID LAYOUT)
      ══════════════════════════════════════════════════ */}
      <Card className="border border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader className="pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-slate-500" /> Quest Tasks
              </CardTitle>
              <CardDescription className="mt-1">
                Add or edit user tasks below. Grid layout optimizes space for quick management.
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              {systemTaskCount > 0 && (
                <Badge variant="outline" className="text-xs gap-1">
                  <Lock className="h-3 w-3" /> {systemTaskCount} system tasks hidden
                </Badge>
              )}
              {hasDirtyTasks && (
                <Badge variant="outline" className="border-amber-400 text-amber-600 bg-amber-50 dark:bg-amber-950/20 animate-pulse text-xs">
                  Unsaved changes
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6 space-y-6 bg-slate-50/30 dark:bg-slate-900/10">
          {isFetchingTasks ? (
            <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Loading tasks…</span>
            </div>
          ) : (
            <>
              {/* Task Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 items-start">
                {tasks.map((task, idx) => (
                  <div 
                    key={task.id} 
                    // Make the card span across the grid if it's currently being edited
                    className={editingTaskId === task.id ? "col-span-1 md:col-span-2 xl:col-span-3 transition-all duration-300" : "transition-all duration-300"}
                  >
                    <TaskRow
                      task={task}
                      index={idx}
                      total={tasks.length}
                      isExpanded={expandedTask === task.id && editingTaskId !== task.id}
                      isEditing={editingTaskId === task.id}
                      onToggle={() => {
                        if (editingTaskId === task.id) return;
                        setExpandedTask((prev) => (prev === task.id ? null : task.id));
                      }}
                      onEdit={() => startEditing(task.id)}
                      onMove={(dir) => moveTask(idx, dir)}
                      onDeleteRequest={() => setDeleteCandidate(task.id)}
                    />
                    
                    {/* Render the Form directly beneath the task card if editing */}
                    {editingTaskId === task.id && (
                      <div className="mt-3 animate-in fade-in slide-in-from-top-2">
                        <TaskForm
                          initial={task}
                          onSave={handleEditSave}
                          onCancel={() => setEditingTaskId(null)}
                          isDemoQuest={isDemoQuest}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Add New Task Form */}
              {addingNew && newTaskDraft && (
                <div className="animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex items-center gap-2 my-4">
                    <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-3">Create New Task</span>
                    <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                  </div>
                  <TaskForm
                    initial={newTaskDraft}
                    onSave={handleNewTaskSave}
                    onCancel={() => { setAddingNew(false); setNewTaskDraft(null); }}
                    isDemoQuest={isDemoQuest}
                  />
                </div>
              )}

              {/* Add Task Button */}
              {!addingNew && (
                isDemoQuest ? (
                  <div className="w-full border border-dashed border-amber-300 dark:border-amber-700 rounded-lg h-12 flex items-center justify-center gap-2 bg-amber-50/50 dark:bg-amber-950/10">
                    <Lock className="h-4 w-4 text-amber-500" />
                    <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
                      Subscribe to add & edit tasks
                    </span>
                  </div>
                ) : (
                  <Button variant="outline"
                    className="w-full border-dashed h-12 gap-2 hover:border-primary hover:bg-primary/5 hover:text-primary transition-colors bg-white dark:bg-slate-950"
                    onClick={startAddingTask}>
                    <Plus className="h-4 w-4" />
                    Add New Task
                  </Button>
                )
              )}
            </>
          )}
        </CardContent>

        {!isFetchingTasks && (
          <CardFooter className="border-t border-slate-100 dark:border-slate-800 pt-4 flex justify-between items-center bg-white dark:bg-slate-950 rounded-b-xl">
            <p className="text-sm font-medium text-muted-foreground">
              Total: {tasks.length} User Tasks
            </p>
            <Button onClick={handleSaveTasks} disabled={isSavingTasks || (tasks.every((t) => !t._isDirty && !t._isNew) && !addingNew)} className="min-w-[160px] shadow-md">
              {isSavingTasks ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save Task Layout
            </Button>
          </CardFooter>
        )}
      </Card>

      {/* ── Delete confirmation ── */}
      <AlertDialog open={!!deleteCandidate} onOpenChange={(open) => !open && setDeleteCandidate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this task?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the task from the interface. Click <strong>Save Task Layout</strong> to apply this deletion to the database permanently.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={() => deleteCandidate && deleteTask(deleteCandidate)}>
              Delete Task
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── TaskRow ─────────────────────────────────────────────────

interface TaskRowProps {
  task: EditableTask;
  index: number;
  total: number;
  isExpanded: boolean;
  isEditing: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onMove: (dir: "up" | "down") => void;
  onDeleteRequest: () => void;
}

function TaskRow({ task, index, total, isExpanded, isEditing, onToggle, onEdit, onMove, onDeleteRequest }: TaskRowProps) {
  const stageColor = STAGE_COLORS[task.stage as Stage] ?? "bg-slate-100 text-slate-600 border-slate-200";

  return (
    <div className={`flex flex-col bg-white dark:bg-slate-950 rounded-xl border transition-all duration-200 overflow-hidden ${
      isEditing ? "border-primary/60 shadow-md ring-1 ring-primary/20"
      : isExpanded ? "border-primary/30 shadow-sm"
      : task._isNew ? "border-green-400/50 bg-green-50/10 dark:bg-green-950/10"
      : task._isDirty ? "border-amber-400/50 bg-amber-50/10 dark:bg-amber-950/10"
      : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-sm"
    }`}>
      
      <div className="p-4 flex flex-col h-full cursor-pointer select-none" onClick={onToggle}>
        {/* Card Header (Badges & Actions) */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex gap-2 flex-wrap">
            <Badge variant="outline" className={`text-[10px] h-5 px-2 ${stageColor}`}>
              {task.stage}
            </Badge>
            {task._isNew && <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px] h-5 px-1.5 hover:bg-green-100">New</Badge>}
            {task._isDirty && !task._isNew && <Badge variant="outline" className="border-amber-400 text-amber-600 text-[10px] h-5 px-1.5">Edited</Badge>}
          </div>
          
          <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-primary hover:bg-primary/10" onClick={onEdit} title="Edit task">
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20" onClick={onDeleteRequest}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Card Body (Title & Type) */}
        <div className="mb-4">
          <h4 className={`font-semibold text-sm leading-tight ${!task.title ? "text-muted-foreground italic" : "text-foreground"}`}>
            {task.title || "Untitled task"}
          </h4>
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mt-2 bg-slate-50 dark:bg-slate-900 w-fit px-2 py-1 rounded-md border dark:border-slate-800">
            {verificationIcon(task.verificationType)}
            {task.verificationType.replace(/_/g, " ").toUpperCase()}
          </p>
        </div>

        {/* Card Footer (Points & Sorting) */}
        <div className="mt-auto pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <span className="text-sm font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
            {task.points} PTS
          </span>
          
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <Button variant="outline" size="icon" className="h-6 w-6 rounded-md" disabled={index === 0} onClick={() => onMove("up")}>
              <ChevronUp className="h-3 w-3" />
            </Button>
            <Button variant="outline" size="icon" className="h-6 w-6 rounded-md" disabled={index === total - 1} onClick={() => onMove("down")}>
              <ChevronDown className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 ml-1" onClick={onToggle}>
              {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Expanded Read-Only View */}
      {isExpanded && !isEditing && (
        <div className="border-t border-slate-100 dark:border-slate-800 px-4 py-3 bg-slate-50 dark:bg-slate-900/50">
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs text-muted-foreground">
            {task.description && <div className="col-span-2 text-foreground/90 italic mb-1">"{task.description}"</div>}
            
            <div><span className="font-medium">Category:</span> <span className="text-foreground">{task.category}</span></div>
            <div><span className="font-medium">Action:</span> <span className="text-foreground">{task.action}</span></div>
            
            {task.targetPlatform && <div><span className="font-medium">Platform:</span> <span className="text-foreground">{task.targetPlatform}</span></div>}
            {task.targetServerId && <div><span className="font-medium">Server ID:</span> <span className="text-foreground">{task.targetServerId}</span></div>}
            {task.targetHandle && <div className="col-span-2"><span className="font-medium">Target:</span> <span className="text-foreground">{task.targetHandle}</span></div>}
            
            {task.url && <div className="col-span-2"><span className="font-medium">URL:</span> <a href={task.url} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline break-all ml-1">{task.url}</a></div>}
            {task.targetContractAddress && <div className="col-span-2"><span className="font-medium">Contract:</span> <span className="font-mono text-[10px] text-foreground break-all ml-1">{task.targetContractAddress}</span></div>}
            
            {task.minAmount && <div><span className="font-medium">Min Amount:</span> <span className="text-foreground">{task.minAmount}</span></div>}
            {task.minTxCount && <div><span className="font-medium">Min TX:</span> <span className="text-foreground">{task.minTxCount}</span></div>}
            {task.minDays && <div><span className="font-medium">Min Days:</span> <span className="text-foreground">{task.minDays}</span></div>}
            
            {task.startDate && <div><span className="font-medium">Starts:</span> <span className="text-foreground ml-1">{new Date(task.startDate).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</span></div>}
            {task.endDate && <div><span className="font-medium">Ends:</span> <span className="text-foreground ml-1">{new Date(task.endDate).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</span></div>}
          </div>
          <Button size="sm" variant="outline" className="mt-3 w-full h-8 text-xs bg-white dark:bg-slate-950" onClick={onEdit}>
            <Edit2 className="h-3 w-3 mr-2" /> Edit Task Details
          </Button>
        </div>
      )}
    </div>
  );
}