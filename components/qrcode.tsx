"use client"

import React, { useEffect, useRef, useState, useCallback } from "react";
import QRCode from "qrcode";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Link as LinkIcon, QrCode, Eye, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "next-themes";

interface QRCodeShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  faucetAddress: string;
  faucetDetails: any;
  faucetMetadata: any;
  selectedNetwork: any;
  tokenSymbol: string;
  faucetType?: string;
  secretCode?: string;
}

// ─── Canvas helpers ───────────────────────────────────────────────────────────

const loadImg = (src: string): Promise<HTMLImageElement | null> =>
  new Promise((res) => {
    if (!src) return res(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = src;
    img.onload = () => res(img);
    img.onerror = () => res(null);
  });

const roundRect = (
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) => {
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
};

const drawSparkle = (
  ctx: CanvasRenderingContext2D,
  x: number, y: number, size: number, alpha = 0.8
) => {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4 - Math.PI / 2;
    const r = i % 2 === 0 ? size : size * 0.35;
    const fn = i === 0 ? "moveTo" : "lineTo";
    ctx[fn](x + Math.cos(angle) * r, y + Math.sin(angle) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

const drawIceShield = (
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, size: number
) => {
  ctx.save();
  ctx.translate(cx, cy);

  const w = size, h = size * 1.15;
  ctx.beginPath();
  ctx.moveTo(0, -h * 0.5);
  ctx.bezierCurveTo( w * 0.55, -h * 0.5,  w * 0.55, -h * 0.05,  w * 0.55, h * 0.1);
  ctx.bezierCurveTo( w * 0.55,  h * 0.45,  0,         h * 0.6,   0,        h * 0.6);
  ctx.bezierCurveTo(-w * 0.55,  h * 0.6,  -w * 0.55,  h * 0.45, -w * 0.55, h * 0.1);
  ctx.bezierCurveTo(-w * 0.55, -h * 0.05, -w * 0.55, -h * 0.5,  0,        -h * 0.5);
  ctx.closePath();

  const grad = ctx.createLinearGradient(-w * 0.55, -h * 0.5, w * 0.55, h * 0.6);
  grad.addColorStop(0,   "#c8f0ff");
  grad.addColorStop(0.3, "#7dd3f8");
  grad.addColorStop(0.7, "#38b6e8");
  grad.addColorStop(1,   "#0284c7");
  ctx.fillStyle = grad;
  ctx.shadowColor = "rgba(56,182,232,0.6)";
  ctx.shadowBlur = size * 0.4;
  ctx.fill();
  ctx.shadowBlur = 0;

  const shine = ctx.createRadialGradient(-w * 0.15, -h * 0.25, 0, -w * 0.1, -h * 0.1, w * 0.5);
  shine.addColorStop(0,   "rgba(255,255,255,0.55)");
  shine.addColorStop(0.5, "rgba(255,255,255,0.15)");
  shine.addColorStop(1,   "rgba(255,255,255,0)");
  ctx.fillStyle = shine;
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.75)";
  ctx.lineWidth = size * 0.06;
  ctx.stroke();

  const ck = size * 0.28;
  ctx.beginPath();
  ctx.moveTo(-ck, 0);
  ctx.lineTo(-ck * 0.25, ck * 0.75);
  ctx.lineTo(ck, -ck * 0.55);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = size * 0.13;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = "rgba(255,255,255,0.6)";
  ctx.shadowBlur = size * 0.12;
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.restore();
};

const drawIceCoin = (
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number
) => {
  ctx.save();
  ctx.translate(cx, cy);

  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  const g = ctx.createLinearGradient(-r, -r, r, r);
  g.addColorStop(0,   "#d0f2ff");
  g.addColorStop(0.4, "#7dd3f8");
  g.addColorStop(1,   "#0ea5e9");
  ctx.fillStyle = g;
  ctx.shadowColor = "rgba(14,165,233,0.5)";
  ctx.shadowBlur = r * 0.6;
  ctx.fill();
  ctx.shadowBlur = 0;

  const shine = ctx.createRadialGradient(-r * 0.3, -r * 0.35, 0, -r * 0.1, -r * 0.1, r * 0.9);
  shine.addColorStop(0,   "rgba(255,255,255,0.6)");
  shine.addColorStop(1,   "rgba(255,255,255,0)");
  ctx.fillStyle = shine;
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = r * 0.08;
  ctx.stroke();

  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const sr = i % 2 === 0 ? r * 0.48 : r * 0.22;
    i === 0 ? ctx.moveTo(Math.cos(a) * sr, Math.sin(a) * sr)
            : ctx.lineTo(Math.cos(a) * sr, Math.sin(a) * sr);
  }
  ctx.closePath();
  ctx.fillStyle = "#ffffff";
  ctx.globalAlpha = 0.9;
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.restore();
};

const drawIceGift = (
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, size: number
) => {
  ctx.save();
  ctx.translate(cx, cy);

  const hw = size * 0.5, hh = size * 0.45;
  const lidH = size * 0.18;
  const iceGrad = (y0: number, y1: number) => {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0,   "#c8f0ff");
    g.addColorStop(0.5, "#7dd3f8");
    g.addColorStop(1,   "#0284c7");
    return g;
  };

  ctx.beginPath();
  ctx.rect(-hw, -hh + lidH, hw * 2, hh * 2 - lidH);
  ctx.fillStyle = iceGrad(-hh + lidH, hh);
  ctx.shadowColor = "rgba(14,165,233,0.45)";
  ctx.shadowBlur = size * 0.3;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  ctx.lineWidth = size * 0.05;
  ctx.stroke();

  ctx.beginPath();
  ctx.rect(-hw * 1.1, -hh, hw * 2.2, lidH);
  ctx.fillStyle = iceGrad(-hh, -hh + lidH);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  ctx.stroke();

  ctx.beginPath();
  ctx.rect(-size * 0.08, -hh, size * 0.16, hh * 2);
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fill();

  ctx.beginPath();
  ctx.rect(-hw * 1.1, -hh, hw * 2.2, lidH);
  ctx.beginPath();
  ctx.rect(-hw, -hh + lidH, hw * 2, size * 0.1);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fill();

  const bowR = size * 0.16;
  [-1, 1].forEach((side) => {
    ctx.save();
    ctx.translate(side * bowR * 0.7, -hh - bowR * 0.3);
    ctx.scale(side, 1);
    ctx.beginPath();
    ctx.ellipse(bowR * 0.5, -bowR * 0.2, bowR * 0.6, bowR * 0.35, Math.PI / 5, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fill();
    ctx.restore();
  });

  ctx.restore();
};

const drawIceWallet = (
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, size: number
) => {
  ctx.save();
  ctx.translate(cx, cy);

  const hw = size * 0.55, hh = size * 0.38;
  const iceG = ctx.createLinearGradient(-hw, -hh, hw, hh);
  iceG.addColorStop(0,   "#c8f0ff");
  iceG.addColorStop(0.5, "#7dd3f8");
  iceG.addColorStop(1,   "#0369a1");

  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(-hw, -hh, hw * 2, hh * 2, size * 0.12);
  else ctx.rect(-hw, -hh, hw * 2, hh * 2);
  ctx.fillStyle = iceG;
  ctx.shadowColor = "rgba(14,165,233,0.5)";
  ctx.shadowBlur = size * 0.35;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = size * 0.05;
  ctx.stroke();

  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(hw * 0.22, -hh * 0.55, hw * 0.65, hh * 1.1, size * 0.1);
  else ctx.rect(hw * 0.22, -hh * 0.55, hw * 0.65, hh * 1.1);
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = size * 0.04;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(hw * 0.55, 0, size * 0.14, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.fill();

  const shine = ctx.createRadialGradient(-hw * 0.3, -hh * 0.4, 0, 0, 0, hw);
  shine.addColorStop(0, "rgba(255,255,255,0.5)");
  shine.addColorStop(1, "rgba(255,255,255,0)");
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(-hw, -hh, hw * 2, hh * 2, size * 0.12);
  else ctx.rect(-hw, -hh, hw * 2, hh * 2);
  ctx.fillStyle = shine;
  ctx.fill();

  ctx.restore();
};

// ─── Core card renderer ───────────────────────────────────────────────────────

async function renderMarketingCard(
  qrCanvas: HTMLCanvasElement,
  opts: {
    faucetName: string;
    tokenSymbol: string;
    faucetImage: string;
    networkName: string;
    networkLogoUrl: string;
    logoPath: string;
    isDropCode?: boolean;
    secretCode?: string;
    outputSize?: { w: number; h: number };
  }
): Promise<HTMLCanvasElement> {
  // ── Canvas size — extra height when drop code is shown ────────────────
  const W = opts.outputSize?.w ?? 1080;
  const dropCodeExtraH = opts.isDropCode ? (opts.outputSize?.w ?? 1080) / 1080 * 180 : 0;
  const H = (opts.outputSize?.h ?? 1240) + dropCodeExtraH;
  const scale = W / 1080;

  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const ctx = out.getContext("2d")!;

  // ── Background gradient ────────────────────────────────────────────────
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0,   "#a8edff");
  bg.addColorStop(0.4, "#5ecef5");
  bg.addColorStop(0.7, "#38b6e8");
  bg.addColorStop(1,   "#a0e4f8");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // ── Soft swirl blobs ──────────────────────────────────────────────────
  const blobs: [number, number, number, number, number][] = [
    [0.19, 0.46, 0.35, 0.11, 0.12],
    [0.83, 0.26, 0.28, 0.09, 0.10],
    [0.50, 0.79, 0.43, 0.12, 0.10],
    [0.09, 0.86, 0.23, 0.07, 0.08],
  ];
  blobs.forEach(([bx, by, rx, ry, alpha]) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.ellipse(bx * W, by * H, rx * W, ry * H, Math.PI / 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  // ── Sparkles ──────────────────────────────────────────────────────────
  const sparkles: [number, number, number][] = [
    [0.074, 0.119, 22], [0.907, 0.172, 18], [0.056, 0.595, 16],
    [0.935, 0.529, 20], [0.185, 0.893, 14], [0.796, 0.872, 18],
    [0.398, 0.086, 12], [0.648, 0.066, 10], [0.879, 0.762, 14],
    [0.944, 0.925, 20], [0.037, 0.728, 12],
  ];
  sparkles.forEach(([sx, sy, ss]) =>
    drawSparkle(ctx, sx * W, sy * H, ss * scale, 0.85)
  );

  // ── Load images ────────────────────────────────────────────────────────
  const [mainImg, chainImg, logoImg] = await Promise.all([
    loadImg(opts.faucetImage),
    loadImg(opts.networkLogoUrl),
    loadImg(opts.logoPath),
  ]);

  // ── Branding top ──────────────────────────────────────────────────────
  const brandCy = 0.054 * H;
  if (logoImg) {
    const lh = 72 * scale;
    const lw = lh * (logoImg.width / logoImg.height);
    ctx.drawImage(logoImg, (W - lw) / 2, brandCy - lh / 2, lw, lh);
  } else {
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${64 * scale}px sans-serif`;
    ctx.textAlign = "center";
    ctx.shadowColor = "rgba(0,0,0,0.15)";
    ctx.shadowBlur = 8 * scale;
    ctx.fillText("FaucetDrops", W / 2, brandCy + 22 * scale);
    ctx.shadowBlur = 0;
  }

  // ── Central card frame ─────────────────────────────────────────────────
  const cardX = 0.093 * W;
  const cardY = 0.109 * H;
  const cardW = 0.815 * W;
  const cardH = 0.29 * H;

  ctx.save();
  ctx.shadowColor = "rgba(14,165,233,0.55)";
  ctx.shadowBlur = 40 * scale;
  ctx.strokeStyle = "rgba(255,255,255,0.88)";
  ctx.lineWidth = 5 * scale;
  roundRect(ctx, cardX, cardY, cardW, cardH, 34 * scale);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, cardX, cardY, cardW, cardH, 34 * scale);
  ctx.fill();
  ctx.restore();

  const cxCard = cardX + cardW / 2;
  const cyCard = cardY + cardH / 2;
  const radGlow = ctx.createRadialGradient(cxCard, cyCard, 10, cxCard, cyCard, cardW * 0.45);
  radGlow.addColorStop(0, "rgba(255,255,255,0.38)");
  radGlow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.save();
  ctx.fillStyle = radGlow;
  roundRect(ctx, cardX, cardY, cardW, cardH, 34 * scale);
  ctx.fill();
  ctx.restore();

  if (mainImg) {
    const pad = 28 * scale;
    ctx.save();
    roundRect(ctx, cardX + pad, cardY + pad, cardW - pad * 2, cardH - pad * 2, 18 * scale);
    ctx.clip();
    const s = Math.max((cardW - pad * 2) / mainImg.width, (cardH - pad * 2) / mainImg.height);
    const dw = mainImg.width * s, dh = mainImg.height * s;
    ctx.drawImage(mainImg,
      cardX + pad + ((cardW - pad * 2) - dw) / 2,
      cardY + pad + ((cardH - pad * 2) - dh) / 2,
      dw, dh
    );
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 5 * scale;
    roundRect(ctx, cardX, cardY, cardW, cardH, 34 * scale);
    ctx.stroke();
    ctx.restore();
  }

  // ── Corner ice-blue icons ──────────────────────────────────────────────
  const iconSz = 72 * scale;
  drawIceShield(ctx, cardX + cardW + iconSz * 0.55, cardY - iconSz * 0.1,          iconSz);
  drawIceWallet(ctx, cardX + cardW + iconSz * 0.55, cardY + cardH + iconSz * 0.1,  iconSz);
  drawIceGift  (ctx, cardX         - iconSz * 0.55, cardY + cardH + iconSz * 0.1,  iconSz);
  drawIceCoin  (ctx, cardX         - iconSz * 0.55, cardY - iconSz * 0.1,          iconSz);

  // ── Title ──────────────────────────────────────────────────────────────
  const titleY = cardY + cardH + 75 * scale;
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 ${88 * scale}px sans-serif`;
  ctx.shadowColor = "rgba(0,80,160,0.45)";
  ctx.shadowBlur = 14 * scale;
  ctx.fillText(opts.faucetName.toUpperCase(), W / 2, titleY);
  ctx.shadowBlur = 0;

  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = `bold ${48 * scale}px sans-serif`;
  ctx.fillText(`$${opts.tokenSymbol}`, W / 2, titleY + 66 * scale);

  // ── Claim badge ────────────────────────────────────────────────────────
  const badgeW = 520 * scale;
  const badgeH = 104 * scale;
  const badgeX = (W - badgeW) / 2;
  const badgeY = titleY + 110 * scale;

  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0,0,0,0.15)";
  ctx.shadowBlur = 18 * scale;
  roundRect(ctx, badgeX, badgeY, badgeW, badgeH, badgeH / 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = "#0369a1";
  ctx.font = `900 ${42 * scale}px sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("CLAIM NOW!", W / 2, badgeY + badgeH * 0.66);

  // ── QR Code ────────────────────────────────────────────────────────────
  const qrSz  = 280 * scale;
  const qrX   = (W - qrSz) / 2;
  const qrY2  = badgeY + badgeH + 50 * scale;
  const qrPad = 20 * scale;

  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0,0,0,0.18)";
  ctx.shadowBlur = 28 * scale;
  roundRect(ctx, qrX - qrPad, qrY2 - qrPad, qrSz + qrPad * 2, qrSz + qrPad * 2, 24 * scale);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.drawImage(qrCanvas, qrX, qrY2, qrSz, qrSz);

  // ── Network badge ──────────────────────────────────────────────────────
  const netLabel = opts.networkName || "Mainnet";
  const netBH    = 88 * scale;
  ctx.font = `bold ${40 * scale}px sans-serif`;
  const netTW = ctx.measureText(netLabel).width;
  const netBW = netTW + (chainImg ? 156 * scale : 72 * scale);
  const netBX = (W - netBW) / 2;
  const netBY = qrY2 + qrSz + 42 * scale;

  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.shadowColor = "rgba(0,0,0,0.12)";
  ctx.shadowBlur = 14 * scale;
  roundRect(ctx, netBX, netBY, netBW, netBH, netBH / 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  if (chainImg) {
    const iconR  = 26 * scale;
    const iconCx = netBX + 52 * scale;
    const iconCy = netBY + netBH / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(iconCx, iconCy, iconR, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(chainImg, iconCx - iconR, iconCy - iconR, iconR * 2, iconR * 2);
    ctx.restore();
  }

  ctx.fillStyle = "#0c4a6e";
  ctx.textAlign = "left";
  ctx.font = `bold ${40 * scale}px sans-serif`;
  ctx.fillText(
    netLabel,
    netBX + (chainImg ? 94 * scale : 28 * scale),
    netBY + netBH / 2 + 14 * scale
  );

  // ── Drop Code Badge ────────────────────────────────────────────────────
  if (opts.isDropCode && opts.secretCode) {
    const dcY = netBY + netBH + 36 * scale;

    // Label
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = `600 ${30 * scale}px sans-serif`;
    ctx.fillText("DROP CODE", W / 2, dcY);

    // Measure pill width based on the code text
    const codeText = opts.secretCode;
    ctx.font = `900 ${62 * scale}px monospace`;
    const codeW = ctx.measureText(codeText).width + 80 * scale;
    const codeH = 110 * scale;
    const codeX = (W - codeW) / 2;
    const codeY = dcY + 16 * scale;

    // Pill background
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.shadowColor = "rgba(0,0,0,0.18)";
    ctx.shadowBlur = 20 * scale;
    roundRect(ctx, codeX, codeY, codeW, codeH, codeH / 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Code text
    ctx.fillStyle = "#0369a1";
    ctx.font = `900 ${62 * scale}px monospace`;
    ctx.textAlign = "center";
    ctx.fillText(codeText, W / 2, codeY + codeH * 0.68);

  } else if (opts.isDropCode && !opts.secretCode) {
    // Dropcode faucet but admin hasn't retrieved the code yet — subtle hint
    const dcY = netBY + netBH + 36 * scale;
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = `italic ${28 * scale}px sans-serif`;
    ctx.fillText("Enter drop code to claim", W / 2, dcY + 40 * scale);
  }

  return out;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function QRCodeShareDialog({
  open,
  onOpenChange,
  faucetAddress,
  faucetDetails,
  faucetMetadata,
  selectedNetwork,
  tokenSymbol,
  faucetType,
  secretCode,
}: QRCodeShareDialogProps) {
  const { resolvedTheme } = useTheme();
  const webCanvasRef       = useRef<HTMLCanvasElement>(null);
  const farcasterCanvasRef = useRef<HTMLCanvasElement>(null);

  const [activeTab, setActiveTab]           = useState<"web" | "farcaster">("web");
  const [previewOpen, setPreviewOpen]       = useState(false);
  const [previewSrc, setPreviewSrc]         = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [downloading, setDownloading]       = useState(false);
  const [dlQrOnly, setDlQrOnly]             = useState(false);

  const faucetName  = faucetDetails?.name      || "Token Faucet";
  const faucetImage = faucetMetadata?.imageUrl || "/default.jpeg";

  const qrColors = {
    web:       { dark: "#2563eb", light: "#ffffff" },
    farcaster: { dark: "#7c3aed", light: "#ffffff" },
  };

 const [webUrl, setWebUrl] = useState<string>("");

useEffect(() => {
  // Captures the exact current link safely on the client
  if (typeof window !== "undefined") {
    setWebUrl(window.location.href);
  }
}, []);
  const farcasterUrl = `https://farcaster.xyz/miniapps/x8wlGgdqylmp/FaucetDrops?startapp/faucet=${faucetAddress}`;

  // ── Fixed square QR generation ────────────────────────────────────────────
  const generateQR = (canvas: HTMLCanvasElement | null, url: string, color: { dark: string; light: string }) => {
    if (!canvas || !url) return;
    QRCode.toCanvas(canvas, url, {
      width: 260,
      margin: 2,
      color: { dark: color.dark, light: color.light },
      errorCorrectionLevel: "H",
    }, (err) => { if (err) console.error("QR Error", err); });
  };

  useEffect(() => {
  // Added !webUrl check so it waits until the link is captured
  if (!open || !webUrl) return; 
  
  const t = setTimeout(() => {
    generateQR(webCanvasRef.current, webUrl, qrColors.web);
    generateQR(farcasterCanvasRef.current, farcasterUrl, qrColors.farcaster);
  }, 200);
  
  return () => clearTimeout(t);
}, [open, resolvedTheme, activeTab, webUrl]); // <-- Added webUrl to dependencies

  const getQRCanvas = (type: "web" | "farcaster") =>
    type === "web" ? webCanvasRef.current : farcasterCanvasRef.current;

  const cardOpts = (type: "web" | "farcaster") => ({
    faucetName,
    tokenSymbol,
    faucetImage,
    networkName:    selectedNetwork?.name    || "Mainnet",
    networkLogoUrl: selectedNetwork?.logoUrl || "",
    logoPath:       "/lightlogo.png",
    isDropCode:     faucetType === "dropcode",
    secretCode:     secretCode || "",
  });

  // ── Preview ───────────────────────────────────────────────────────────────
  const handlePreview = useCallback(async (type: "web" | "farcaster") => {
    const qrCanvas = getQRCanvas(type);
    if (!qrCanvas) return;
    setPreviewLoading(true);
    setPreviewOpen(true);
    setPreviewSrc(null);
    try {
      const canvas = await renderMarketingCard(qrCanvas, {
        ...cardOpts(type),
        outputSize: { w: 540, h: 620 },
      });
      setPreviewSrc(canvas.toDataURL("image/png"));
    } finally {
      setPreviewLoading(false);
    }
  }, [faucetName, tokenSymbol, faucetImage, selectedNetwork, faucetType, secretCode]);

  // ── Download full card ────────────────────────────────────────────────────
  const handleDownloadCard = useCallback(async (type: "web" | "farcaster") => {
    const qrCanvas = getQRCanvas(type);
    if (!qrCanvas) return;
    setDownloading(true);
    try {
      const canvas = await renderMarketingCard(qrCanvas, {
        ...cardOpts(type),
        outputSize: { w: 1080, h: 1240 },
      });
      const link = document.createElement("a");
      link.download = `${faucetName.replace(/\s+/g, "-")}-card.png`;
      link.href = canvas.toDataURL("image/png", 1.0);
      link.click();
      toast.success("Marketing card downloaded!");
    } catch {
      toast.error("Failed to generate card.");
    } finally {
      setDownloading(false);
    }
  }, [faucetName, tokenSymbol, faucetImage, selectedNetwork, faucetType, secretCode]);

  // ── Download QR only ──────────────────────────────────────────────────────
  const handleDownloadQROnly = useCallback((type: "web" | "farcaster") => {
    const qrCanvas = getQRCanvas(type);
    if (!qrCanvas) return;
    setDlQrOnly(true);
    try {
      const size = 600, pad = 32;
      const out = document.createElement("canvas");
      out.width  = size + pad * 2;
      out.height = size + pad * 2;
      const ctx = out.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, out.width, out.height);
      ctx.drawImage(qrCanvas, pad, pad, size, size);
      const link = document.createElement("a");
      link.download = `${faucetName.replace(/\s+/g, "-")}-qr.png`;
      link.href = out.toDataURL("image/png", 1.0);
      link.click();
      toast.success("QR code downloaded!");
    } finally {
      setDlQrOnly(false);
    }
  }, [faucetName]);

  // ── Drop code hint in the dialog UI ──────────────────────────────────────
  const showCodeHint = faucetType === "dropcode" && !secretCode;
  const showCodeBadge = faucetType === "dropcode" && !!secretCode;

  return (
    <>
      {/* ── Main share dialog ─────────────────────────────────────────────── */}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[420px] max-w-[420px] bg-background border-border p-4 overflow-hidden">
          <DialogHeader className="space-y-0.5">
            <DialogTitle className="flex items-center gap-2 text-base">
              <LinkIcon className="h-4 w-4 text-primary flex-shrink-0" />
              Share {faucetName}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Preview or download your high-quality marketing card
            </DialogDescription>
          </DialogHeader>

          {/* Drop code status banner */}
          {faucetType === "dropcode" && (
            <div className={`rounded-lg px-3 py-2 text-xs flex items-center gap-2 ${
              showCodeBadge
                ? "bg-blue-50 border border-blue-200 text-blue-700"
                : "bg-amber-50 border border-amber-200 text-amber-700"
            }`}>
              {showCodeBadge ? (
                <>
                  <span className="font-semibold">Drop code included on card:</span>
                  <span className="font-mono font-bold tracking-widest">{secretCode}</span>
                </>
              ) : (
                <>
                  <span>Retrieve the drop code first to include it on the card.</span>
                </>
              )}
            </div>
          )}

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "web" | "farcaster")}>
            <TabsList className="grid w-full grid-cols-2 bg-muted mt-2">
              <TabsTrigger value="web"       className="text-xs">Web Access</TabsTrigger>
              <TabsTrigger value="farcaster" className="text-xs">Farcaster</TabsTrigger>
            </TabsList>

            {(["web", "farcaster"] as const).map((tab) => (
              <TabsContent
                key={tab} value={tab}
                className="mt-3 flex flex-col items-center gap-2"
              >
                {/* QR preview */}
                <div className="bg-white rounded-2xl shadow-xl border border-primary/10 flex items-center justify-center w-[260px] h-[260px] flex-shrink-0">
                  <canvas
                    ref={tab === "web" ? webCanvasRef : farcasterCanvasRef}
                    className="block w-[240px] h-[240px]"
                    style={{ imageRendering: "pixelated" }}
                  />
                </div>

                {/* Action buttons */}
                <div className="w-full grid grid-cols-2 gap-2">
                  <Button
                    onClick={() => handlePreview(tab)}
                    variant="outline"
                    className="h-9 text-xs font-semibold w-full"
                    disabled={previewLoading}
                  >
                    {previewLoading ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Eye className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Preview Card
                  </Button>

                  <Button
                    onClick={() => handleDownloadQROnly(tab)}
                    variant="outline"
                    className="h-9 text-xs font-semibold w-full"
                    disabled={dlQrOnly}
                  >
                    {dlQrOnly ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <QrCode className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    QR Only
                  </Button>
                </div>

                <Button
                  onClick={() => handleDownloadCard(tab)}
                  className="w-full h-10 text-sm font-bold"
                  disabled={downloading}
                >
                  {downloading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  Download Marketing Card
                </Button>
              </TabsContent>
            ))}
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* ── Card Preview modal ────────────────────────────────────────────── */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="
          w-[95vw] max-w-[520px] p-0 overflow-hidden
          bg-zinc-950 border-zinc-800
          rounded-2xl
        ">
          {/* Header bar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
            <p className="text-sm font-semibold text-zinc-100">Card Preview</p>
            <button
              onClick={() => setPreviewOpen(false)}
              className="text-zinc-400 hover:text-zinc-100 transition-colors rounded-md p-1 hover:bg-zinc-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Preview image */}
          <div className="relative w-full bg-zinc-900 flex items-center justify-center min-h-[320px] sm:min-h-[420px] p-4">
            {previewLoading ? (
              <div className="flex flex-col items-center gap-3 text-zinc-400">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="text-sm">Generating preview…</p>
              </div>
            ) : previewSrc ? (
              <img
                src={previewSrc}
                alt="Marketing card preview"
                className="
                  w-full max-w-[340px] sm:max-w-[400px]
                  rounded-xl shadow-2xl
                  object-contain
                "
              />
            ) : (
              <p className="text-sm text-zinc-500">Preview failed to load.</p>
            )}
          </div>

          {/* Footer actions */}
          <div className="flex items-center gap-2 px-4 py-3 border-t border-zinc-800">
            <Button
              variant="ghost"
              onClick={() => setPreviewOpen(false)}
              className="flex-1 h-10 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 text-sm"
            >
              Close
            </Button>
            <Button
              onClick={() => {
                setPreviewOpen(false);
                handleDownloadCard(activeTab);
              }}
              className="flex-1 h-10 text-sm font-bold"
              disabled={downloading || previewLoading}
            >
              <Download className="mr-2 h-4 w-4" />
              Download Card
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}