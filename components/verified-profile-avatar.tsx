"use client";
import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Droplets, ShieldCheck, ShieldAlert } from "lucide-react";
import { ProfileSettingsModal } from "@/components/profile-settings-modal";

// ─── Shared props ─────────────────────────────────────────────────────────────

interface AvatarProps {
  displayAvatar: string;
  displayName: string;
  isVerified: boolean;
  isOwner: boolean;
}

// ─── 1. Avatar circle (clean — only the 💧 dot, no buttons) ──────────────────

export function VerifiedAvatar({
  displayAvatar,
  displayName,
  isVerified,
  isOwner,
}: AvatarProps) {
  return (
    <div className="relative group shrink-0">
      <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
        <AvatarImage src={displayAvatar} className="object-cover" />
        <AvatarFallback className="bg-primary text-white text-2xl">
          {displayName.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      {/* 💧 verified dot — top-right corner, always visible once earned */}
      {isVerified && (
        <div
          title="Identity verified via Self Protocol"
          className="
            absolute -top-1 -right-1 z-20
            w-7 h-7 rounded-full
            bg-gradient-to-br from-blue-400 to-blue-600
            border-2 border-background shadow-md
            flex items-center justify-center
            animate-in zoom-in-50 duration-300
          "
        >
          <Droplets className="h-3.5 w-3.5 text-white" />
        </div>
      )}

      {/* Gear — bottom-right, only for owner */}
      {isOwner && (
        <div className="absolute -bottom-2 -right-2 z-20 bg-background rounded-full shadow-md">
          <ProfileSettingsModal />
        </div>
      )}
    </div>  
  );
}

// ─── 2. Verify pill — sits inline next to the username heading ────────────────

export function VerifyPill({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="
        inline-flex items-center gap-1.5
        w-fit px-3 py-1 rounded-full
        text-xs font-medium
        border border-dashed border-blue-400/60
        text-blue-500 dark:text-blue-400
        bg-blue-500/5 hover:bg-blue-500/10
        hover:border-blue-400
        transition-all duration-200
        cursor-pointer select-none
      "
    >
      <ShieldAlert className="h-3.5 w-3.5" />
      Get verified
    </button>
  );
}

// ─── 3. Verified badge — replaces the pill once verified ─────────────────────

export function VerifiedBadge() {
  return (
    <span
      title="Identity verified via Self Protocol"
      className="
        inline-flex items-center gap-1.5
        px-3 py-1 rounded-full
        text-xs font-medium
        border border-blue-500/30
        text-blue-600 dark:text-blue-400
        bg-blue-500/10
        select-none
      "
    >
      <ShieldCheck className="h-3.5 w-3.5" />
      Verified
    </span>
  );
}