"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  CheckCircle,
  Smartphone,
  QrCode,
  Loader2,
  AlertCircle,
  Droplets,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type VerificationStatus = "idle" | "loading" | "waiting" | "verified" | "failed";

export interface SelfVerificationModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  account: string;
  onSuccess: (data: {
    verified: boolean;
    timestamp: number;
    userAddress: string;
  }) => void;
}

// ─── Disclosure config — keep in sync with /api/verify ───────────────────────

const DISCLOSURE_CONFIG = {
  minimumAge: 15,
  ofac: false,
  excludedCountries: [] as string[],
  nationality: true,
  name: true,
  dateOfBirth: true,
  gender: true,
};

// ─── Component ────────────────────────────────────────────────────────────────

export function SelfVerificationModal({
  isOpen,
  onOpenChange,
  account,
  onSuccess,
}: SelfVerificationModalProps) {
  const [selfApp, setSelfApp] = useState<any>(null);
  const [universalLink, setUniversalLink] = useState<string>("");
  const [status, setStatus] = useState<VerificationStatus>("idle");
  const [isMobile, setIsMobile] = useState(false);
  const [QRComponent, setQRComponent] = useState<React.ComponentType<any> | null>(null);

  // Hold library refs so we import once
  const libRef = useRef<{
    SelfAppBuilder: any;
    getUniversalLink: ((app: any) => string) | null;
  }>({ SelfAppBuilder: null, getUniversalLink: null });

  // Detect mobile once
  useEffect(() => {
    setIsMobile(/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent));
  }, []);

  // Dynamically import Self libraries on modal open
  useEffect(() => {
    if (!isOpen || !account) return;

    // Already loaded
    if (libRef.current.SelfAppBuilder) {
      buildSelfApp();
      return;
    }

    setStatus("loading");

    Promise.all([
      import("@selfxyz/qrcode"),
      import("@selfxyz/core"),
    ])
      .then(([qrMod, coreMod]) => {
        libRef.current.SelfAppBuilder = qrMod.SelfAppBuilder;
        libRef.current.getUniversalLink = coreMod.getUniversalLink;
        // Store the QR wrapper as state so React can render it safely
        setQRComponent(() => qrMod.SelfQRcodeWrapper);
        buildSelfApp(qrMod.SelfAppBuilder, coreMod.getUniversalLink);
      })
      .catch((err) => {
        console.error("Failed to load Self libraries:", err);
        setStatus("failed");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, account]);

  function buildSelfApp(
    AppBuilder?: any,
    getLink?: ((app: any) => string) | null
  ) {
    const Builder = AppBuilder ?? libRef.current.SelfAppBuilder;
    const linkFn = getLink ?? libRef.current.getUniversalLink;
    if (!Builder || !account) return;

    try {
      const app = new Builder({
        version: 2,
        appName: "FaucetDrops",
        scope: "faucetdrop",
        endpoint:
          typeof window !== "undefined"
            ? `${window.location.origin}/api/verify`
            : "/api/verify",
        logoBase64: "/logo.png",
        userId: account.toLowerCase(),
        endpointType: "staging_https" as const,
        userIdType: "hex" as const,
        userDefinedData: "FaucetDrops Identity Verification",
        disclosures: DISCLOSURE_CONFIG,
      }).build();

      setSelfApp(app);
      if (linkFn) setUniversalLink(linkFn(app));
      setStatus("idle");
    } catch (err) {
      console.error("Failed to build Self app:", err);
      setStatus("failed");
    }
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setStatus("idle");
      setSelfApp(null);
      setUniversalLink("");
    }
    onOpenChange(open);
  };

  const handleSuccess = () => {
    setStatus("waiting");
    setTimeout(() => {
      const data = {
        verified: true,
        timestamp: Date.now(),
        userAddress: account.toLowerCase(),
      };
      localStorage.setItem(
        `verification_${account.toLowerCase()}`,
        JSON.stringify(data)
      );
      setStatus("verified");
      onSuccess(data);
      setTimeout(() => handleOpenChange(false), 2000);
    }, 1500);
  };

  const handleError = () => {
    setStatus("failed");
    localStorage.removeItem(`verification_${account.toLowerCase()}`);
  };

  const openSelfApp = () => {
    if (universalLink) window.open(universalLink, "_blank");
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  const renderBody = () => {
    if (status === "verified") {
      return (
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-blue-500/10 border-2 border-blue-500/30 flex items-center justify-center">
              <Droplets className="h-10 w-10 text-blue-500" />
            </div>
            <div className="absolute -top-1 -right-1 bg-green-500 rounded-full p-1 border-2 border-background">
              <CheckCircle className="h-4 w-4 text-white" />
            </div>
          </div>
          <div>
            <p className="font-bold text-lg">Identity Verified!</p>
            <p className="text-sm text-muted-foreground mt-1">
              Your 💧 drop badge has been added to your profile.
            </p>
          </div>
        </div>
      );
    }

    if (status === "waiting") {
      return (
        <div className="flex flex-col items-center gap-3 py-10">
          <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
          <p className="text-sm text-muted-foreground">Confirming your proof…</p>
        </div>
      );
    }

    if (status === "failed") {
      return (
        <div className="space-y-4 py-2">
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 flex gap-3">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-destructive">Verification failed</p>
              <p className="text-xs text-muted-foreground mt-1">
                Possible causes: age under 15, invalid/expired document, or a
                network issue. Try again or check your Self app.
              </p>
            </div>
          </div>
          <Button className="w-full" variant="outline" onClick={() => setStatus("idle")}>
            Try Again
          </Button>
        </div>
      );
    }

    if (status === "loading" || !selfApp || !QRComponent) {
      return (
        <div className="flex flex-col items-center gap-3 py-10">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Preparing verification…</p>
        </div>
      );
    }

    // Main verification UI
    return (
      <div className="space-y-5">
        {/* What we verify */}
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 space-y-1.5">
          <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
            What we verify
          </p>
          {[
            "Minimum age of 15 years",
            "Valid government-issued document",
            "Zero-knowledge proof — your data stays private",
          ].map((item) => (
            <div key={item} className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle className="h-3 w-3 text-blue-500 shrink-0" />
              {item}
            </div>
          ))}
        </div>

        {/* QR Code — desktop */}
        {!isMobile && (
          <div className="hidden sm:flex flex-col items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <QrCode className="h-4 w-4" />
              Scan with the Self app
            </div>
            <div className="bg-white p-4 rounded-xl border shadow-sm">
              <QRComponent
                selfApp={selfApp}
                onSuccess={handleSuccess}
                onError={handleError}
                size={220}
              />
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Don&apos;t have the app?{" "}
              <a
                href="https://selfprotocol.xyz"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                Download Self
              </a>
            </p>
          </div>
        )}

        {/* Mobile deep-link */}
        <div className={isMobile ? "block" : "sm:hidden"}>
          <Button onClick={openSelfApp} className="w-full" size="lg">
            <Smartphone className="mr-2 h-4 w-4" />
            Open Self App
          </Button>
          <p className="text-xs text-center text-muted-foreground mt-2">
            Opens the Self app directly on your device
          </p>
        </div>

        {/* Desktop: also offer deep-link */}
        {!isMobile && (
          <div className="hidden sm:block border-t pt-3 text-center">
            <p className="text-xs text-muted-foreground mb-2">On your phone?</p>
            <Button variant="outline" size="sm" onClick={openSelfApp}>
              <Smartphone className="mr-2 h-3 w-3" />
              Open Self App Directly
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-500" />
            Verify Your Identity
            <Badge
              variant="secondary"
              className="ml-auto text-[10px] bg-blue-500/10 text-blue-600 border-blue-500/20"
            >
              <Droplets className="h-3 w-3 mr-1" />
              Earn 💧 badge
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Complete a one-time zero-knowledge proof with Self Protocol and earn
            the verified 💧 drop badge on your FaucetDrops profile.
          </DialogDescription>
        </DialogHeader>

        {renderBody()}
      </DialogContent>
    </Dialog>
  );
}

export default SelfVerificationModal;