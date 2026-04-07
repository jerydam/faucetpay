import React, { useEffect, useState } from 'react';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Check, AlertCircle, Clock, Copy, Link, Share2, ExternalLink,
  User, XCircle, RefreshCw, Droplets, Zap, ChevronRight, CheckCircle2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TokenBalance } from "@/components/token-balance";
import { formatUnits } from 'ethers';
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { toast } from 'sonner';
import { cn } from "@/lib/utils";

// ─── Helpers ────────────────────────────────────────────────────────────────

// Helper to reliably extract exact error messages from Web3/HTTP errors
const extractErrorMessage = (error: any): string => {
  // Helper function to clean up backend-service.ts string formatting
  const cleanString = (str: string) => str.replace(/^.*?\(\d{3}\):\s*/, '').replace(/^Error:\s*/, '');

  if (typeof error === 'string') return cleanString(error);
  
  // 1. Matches the custom error object structure from your backend-service.ts logs
  if (error?.errorData?.detail) {
    const detail = error.errorData.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) return detail.map((d: any) => d.msg).join(', ');
  }

  // 2. FastAPI specific error handling inside a standard Axios response
  if (error?.response?.data?.detail) {
    const detail = error.response.data.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) return detail.map((d: any) => d.msg).join(', ');
  }

  // 3. Standard Node/Express and generic API error handling
  if (error?.response?.data?.message) return error.response.data.message;
  if (error?.response?.data?.error) return error.response.data.error;
  
  // 4. Blockchain specific error handling (Ethers/Viem)
  if (error?.reason) return error.reason; // Ethers.js revert reason
  if (error?.shortMessage) return error.shortMessage; // Viem errors
  
  // 5. Catch standard JS Errors (like the one thrown by backend-service.ts:1162)
  if (error?.message) {
    return cleanString(error.message);
  }
  
  return "Failed to drop token. Please try again.";
};

const getPlatformIcon = (platform: string): string => {
  switch (platform.toLowerCase()) {
    case 'telegram':  return '📱';
    case 'discord':   return '💬';
    case '𝕏': case 'x': return '𝕏';
    case 'youtube':   return '📺';
    case 'instagram': return '📷';
    case 'tiktok':    return '🎵';
    case 'facebook':  return '📘';
    default:          return '🔗';
  }
};

const getActionText = (platform: string): string => {
  switch (platform.toLowerCase()) {
    case 'telegram': case 'discord': return 'Join';
    case 'youtube':  return 'Subscribe';
    default:         return 'Follow';
  }
};

const handleCopyFaucetLink = async (): Promise<void> => {
  try {
    await navigator.clipboard.writeText(window.location.href);
    toast.success("Faucet link copied to clipboard!");
  } catch (err: any) {
    toast.error(extractErrorMessage(err) || "Failed to copy the link. Please try again.");
  }
};

// ─── Types ───────────────────────────────────────────────────────────────────
interface SocialMediaLink {
  platform: string;
  url: string;
  handle: string;
  action: string;
}

interface FaucetUserViewProps {
  faucetAddress: string;
  faucetDetails: any;
  faucetType: 'dropcode' | 'droplist' | 'custom' | null;
  tokenSymbol: string;
  tokenDecimals: number;
  selectedNetwork: any;
  address: string | null;
  isConnected: boolean;
  hasClaimed: boolean;
  userIsWhitelisted: boolean;
  hasCustomAmount: boolean;
  userCustomClaimAmount: bigint;
  dynamicTasks: SocialMediaLink[];
  allAccountsVerified: boolean;
  secretCode: string;
  setSecretCode: (code: string) => void;
  usernames: Record<string, string>;
  setUsernames: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  verificationStates: Record<string, boolean>;
  setVerificationStates: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  isVerifying: boolean;
  faucetMetadata: { description?: string; imageUrl?: string };
  customXPostTemplate: string;
  handleBackendClaim: () => Promise<void>;
  handleFollowAll: () => void;
  generateXPostContent: (amount: string) => string;
  txHash: string | null;
  showFollowDialog: boolean;
  setShowFollowDialog: (open: boolean) => void;
  showVerificationDialog: boolean;
  setShowVerificationDialog: (open: boolean) => void;
  showClaimPopup: boolean;
  setShowClaimPopup: (open: boolean) => void;
  handleVerifyAllTasks: () => Promise<void>;
}

// ─── Small reusables ─────────────────────────────────────────────────────────
const InfoRow = ({
  icon: Icon,
  label,
  value,
  valueClass,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  valueClass?: string;
}) => (
  <div className="flex items-center justify-between py-2.5 border-b last:border-0">
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span>{label}</span>
    </div>
    <span className={cn("text-xs font-semibold text-right max-w-[55%] truncate", valueClass)}>
      {value}
    </span>
  </div>
);

const StatusPill = ({ active }: { active: boolean }) =>
  active ? (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-green-500/15 text-green-600 border border-green-200/60">
      <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
      Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-red-500/10 text-red-600 border border-red-200/60">
      <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
      Inactive
    </span>
  );

const Spinner = ({ className }: { className?: string }) => (
  <div className={cn("h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin", className)} />
);

// ─── Main Component ───────────────────────────────────────────────────────────
const FaucetUserView: React.FC<FaucetUserViewProps> = ({
  faucetDetails,
  faucetType,
  tokenSymbol,
  tokenDecimals,
  selectedNetwork,
  address,
  hasClaimed,
  userIsWhitelisted,
  hasCustomAmount,
  userCustomClaimAmount,
  dynamicTasks,
  allAccountsVerified,
  secretCode,
  setSecretCode,
  usernames,
  setUsernames,
  verificationStates,
  isVerifying,
  faucetMetadata,
  handleBackendClaim,
  handleFollowAll,
  generateXPostContent,
  showFollowDialog,
  setShowFollowDialog,
  showVerificationDialog,
  setShowVerificationDialog,
  showClaimPopup,
  setShowClaimPopup,
  handleVerifyAllTasks,
}) => {
  const [simulationAttempt, setSimulationAttempt] = useState(0);
  const [simulatingState, setSimulatingState] = useState<'idle' | 'verifying' | 'error'>('idle');
  const [isProcessingClaim, setIsProcessingClaim] = useState(false);

  // ─── Error Handling Wrappers ────────────────────────────────────────────────

  const executeClaim = async () => {
    setIsProcessingClaim(true);
    try {
      await handleBackendClaim();
    } catch (error: any) {
      console.error("Claim Error:", error);
      toast.error(extractErrorMessage(error));
    } finally {
      setIsProcessingClaim(false);
    }
  };

  const startVerificationSimulation = () => {
    setShowFollowDialog(false);
    setShowVerificationDialog(true);
    setSimulatingState('verifying');

    if (simulationAttempt === 0) {
      setTimeout(() => { setSimulatingState('error'); setSimulationAttempt(1); }, 7000);
    } else {
      setTimeout(async () => {
        try {
          await handleVerifyAllTasks();
          setSimulatingState('idle');
        } catch (error: any) {
          console.error("Verification Error:", error);
          setSimulatingState('error');
          toast.error(extractErrorMessage(error));
        }
      }, 4000);
    }
  };

  // ────────────────────────────────────────────────────────────────────────────

  const canClaim = (() => {
    if (!faucetDetails?.isClaimActive || hasClaimed || !allAccountsVerified) return false;
    switch (faucetType) {
      case 'dropcode':
        return faucetDetails.backendMode
          ? secretCode.length === 6 && /^[A-Z0-9]{6}$/.test(secretCode)
          : true;
      case 'droplist': return userIsWhitelisted;
      case 'custom':   return hasCustomAmount && userCustomClaimAmount > 0;
      default:         return false;
    }
  })();

  const claimedAmount =
    faucetType === 'custom' && hasCustomAmount
      ? formatUnits(userCustomClaimAmount, tokenDecimals)
      : faucetDetails?.claimAmount
      ? formatUnits(faucetDetails.claimAmount, tokenDecimals)
      : "0";

  const shouldShowSecretCodeInput = faucetType === 'dropcode' && faucetDetails?.backendMode;
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
  const timer = setInterval(() => {
    setCurrentTime(Date.now());
  }, 1000);

  // Always clean up your intervals!
  return () => clearInterval(timer);
}, []);
  const handleShareOnX = () => {
    const shareText = encodeURIComponent(generateXPostContent(claimedAmount));
    window.open(`https://x.com/intent/tweet?text=${shareText}`, "_blank");
    setShowClaimPopup(false);
  };

  const getAllUsernamesProvided = () =>
    dynamicTasks.length === 0 ||
    dynamicTasks.every(t => usernames[t.platform]?.trim().length > 0);

 const renderCountdown = (timestamp: number, prefix: string, startTimeMs?: number): string => {
  if (timestamp === 0) return "N/A";
  
  // NEW: If we are rendering the "End" time, and the faucet hasn't started yet, 
  // show the fixed duration instead of a moving countdown.
  if (prefix === "End" && startTimeMs && startTimeMs > currentTime) {
      const duration = timestamp * 1000 - startTimeMs;
      const d  = Math.floor(duration / 86400000);
      const h = Math.floor((duration % 86400000) / 3600000);
      const m  = Math.floor((duration % 3600000) / 60000);
      return `${d}d ${h}h ${m}m (Duration)`; 
  }

  // Normal countdown logic
  const diff = timestamp * 1000 - currentTime; 
  
  if (diff <= 0) return prefix === "Start" ? "Active" : "Ended";
  
  const days  = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins  = Math.floor((diff % 3600000) / 60000);
  const secs  = Math.floor((diff % 60000) / 1000);
  
  return `${days}d ${hours}h ${mins}m ${secs}s`;
};

  const tasksNeeded = dynamicTasks.length > 0 && !allAccountsVerified;
  const faucetTypeLabel =
    faucetType === 'dropcode' ? 'DropCode' :
    faucetType === 'droplist' ? 'DropList' :
    faucetType === 'custom'   ? 'Custom'   : '';

  const buttonIsLoading = isVerifying || isProcessingClaim;

  return (
    <>
      {/* ── Top action bar ── */}
      <div className="flex items-center justify-end mb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopyFaucetLink}
          className="h-8 text-xs gap-1.5"
        >
          <Link className="h-3.5 w-3.5" /> Copy Faucet Link
        </Button>
      </div>

      <Card className="w-full mx-auto overflow-hidden">
        {/* ── Header ── */}
        <CardHeader className="px-5 sm:px-6 pb-4 border-b bg-muted/10">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-lg sm:text-xl font-semibold leading-tight">
                {faucetDetails.name || tokenSymbol} Faucet
              </CardTitle>
              <div className="flex flex-wrap items-center gap-1.5">
                {selectedNetwork && (
                  <Badge
                    style={{ backgroundColor: selectedNetwork.color }}
                    className="text-white text-[10px] px-2 py-0.5"
                  >
                    {selectedNetwork.name}
                  </Badge>
                )}
                {faucetTypeLabel && (
                  <Badge variant="secondary" className="text-[10px] px-2 py-0.5 capitalize">
                    {faucetTypeLabel}
                  </Badge>
                )}
                <StatusPill active={faucetDetails.isClaimActive} />
              </div>
            </div>
          </div>

          {/* Address / eligibility row */}
          {address && (
            <div className="mt-3 pt-3 border-t border-dashed space-y-1.5">
              <div className="flex items-start gap-2">
                <span className="text-xs text-muted-foreground mt-0.5 shrink-0">Wallet</span>
                <span className="text-xs font-mono font-semibold break-all text-foreground/80">{address}</span>
              </div>
              {faucetType === 'droplist' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Drop-list</span>
                  {userIsWhitelisted ? (
                    <span className="text-xs text-green-600 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Eligible
                    </span>
                  ) : (
                    <span className="text-xs text-red-500 font-semibold flex items-center gap-1">
                      <XCircle className="h-3 w-3" /> Not listed
                    </span>
                  )}
                </div>
              )}
              {faucetType === 'custom' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Allocation</span>
                  {hasCustomAmount ? (
                    <span className="text-xs text-green-600 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Has allocation
                    </span>
                  ) : (
                    <span className="text-xs text-red-500 font-semibold flex items-center gap-1">
                      <XCircle className="h-3 w-3" /> No allocation
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </CardHeader>

        {/* ── Banner image + description ── */}
        {(faucetMetadata?.imageUrl || faucetMetadata?.description) && (
          <div className="px-5 sm:px-6 pt-4 space-y-3">
            {faucetMetadata.imageUrl && (
              <img
                src={faucetMetadata.imageUrl}
                alt={faucetDetails?.name || 'Faucet'}
                className="w-full h-44 object-cover rounded-xl border"
              />
            )}
            {faucetMetadata.description && (
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed bg-muted/30 rounded-lg px-4 py-3 border border-dashed">
                {faucetMetadata.description}
              </p>
            )}
          </div>
        )}

        {/* ── Token Balance ── */}
        <div className="px-5 sm:px-6 pt-4">
          <TokenBalance
            tokenAddress={faucetDetails.token}
            tokenSymbol={tokenSymbol}
            tokenDecimals={tokenDecimals}
            isNativeToken={faucetDetails.isEther}
            networkChainId={selectedNetwork?.chainId}
          />
        </div>

        {/* ── Stats grid ── */}
        <CardContent className="px-5 sm:px-6 pt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {/* Drip amount */}
            <div className="flex flex-col gap-1 rounded-xl border bg-muted/20 p-4">
              <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <Droplets className="h-3 w-3" />
                {faucetType === 'custom' ? 'Your Amount' : 'Drip Amount'}
              </span>
              <span className="text-xl font-bold truncate">
                {faucetType === 'custom'
                  ? address
                    ? hasCustomAmount
                      ? `${formatUnits(userCustomClaimAmount, tokenDecimals)}`
                      : <span className="text-sm text-muted-foreground">No allocation</span>
                    : <span className="text-sm text-muted-foreground">Connect wallet</span>
                  : faucetDetails.claimAmount
                  ? formatUnits(faucetDetails.claimAmount, tokenDecimals)
                  : '0'}
              </span>
              {faucetType !== 'custom' && (
                <span className="text-xs text-muted-foreground">{tokenSymbol}</span>
              )}
            </div>

            {/* Status */}
            <div className="flex flex-col gap-1 rounded-xl border bg-muted/20 p-4">
              <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <Zap className="h-3 w-3" /> Status
              </span>
              <div className="mt-1">
                <StatusPill active={faucetDetails.isClaimActive} />
              </div>
              {hasClaimed && (
                <span className="text-[10px] text-muted-foreground mt-1">Already claimed</span>
              )}
            </div>
          </div>

          {/* Timing row */}
          <div className="rounded-xl border bg-muted/20 px-4 divide-y">
            <InfoRow
              icon={Clock}
              label="Starts"
              value={renderCountdown(Number(faucetDetails.startTime), "Start")}
            />
            <InfoRow
              icon={Clock}
              label="Ends"
              value={renderCountdown(
                  Number(faucetDetails.endTime), 
                  "End", 
                  Number(faucetDetails.startTime) * 1000 // Pass the start time in milliseconds
              )}
            />
          </div>

          {/* Drop Code input */}
          {shouldShowSecretCodeInput && (
            <div className="space-y-2">
              <Label htmlFor="secret-code" className="text-xs font-medium">
                Drop Code
              </Label>
              <Input
                id="secret-code"
                placeholder="6-character code (e.g. ABC123)"
                value={secretCode}
                onChange={(e) => setSecretCode(e.target.value.toUpperCase())}
                maxLength={6}
                className="text-sm font-mono tracking-widest uppercase"
              />
              <p className="text-xs text-muted-foreground">
                Enter the alphanumeric code provided by the faucet admin.
              </p>
            </div>
          )}

          {/* Task progress strip (when tasks exist) */}
          {dynamicTasks.length > 0 && (
            <div
              className={cn(
                "rounded-xl border px-4 py-3 flex items-center justify-between gap-2",
                allAccountsVerified
                  ? "bg-green-50 dark:bg-green-950/20 border-green-200/60 dark:border-green-800/30"
                  : "bg-amber-50 dark:bg-amber-950/10 border-amber-200/50 dark:border-amber-800/30"
              )}
            >
              <div className="flex items-center gap-2">
                {allAccountsVerified ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                )}
                <span className={cn(
                  "text-xs font-medium",
                  allAccountsVerified ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-400"
                )}>
                  {allAccountsVerified
                    ? `All ${dynamicTasks.length} task${dynamicTasks.length !== 1 ? 's' : ''} verified`
                    : `${dynamicTasks.length} task${dynamicTasks.length !== 1 ? 's' : ''} required to claim`}
                </span>
              </div>
              {!allAccountsVerified && (
                <ChevronRight className="h-4 w-4 text-amber-400 shrink-0" />
              )}
            </div>
          )}
        </CardContent>

        {/* ── Footer CTA ── */}
        <CardFooter className="flex flex-col gap-2.5 px-5 sm:px-6 pb-5">
          {/* Tasks button — only show when tasks exist */}
          {dynamicTasks.length > 0 && (
            <Button
              className="w-full gap-2"
              onClick={handleFollowAll}
              disabled={allAccountsVerified}
              variant={allAccountsVerified ? "secondary" : "default"}
            >
              {allAccountsVerified ? (
                <><Check className="h-4 w-4" /> Tasks Verified — Ready to Drip</>
              ) : (
                <><AlertCircle className="h-4 w-4" /> Complete Tasks to Unlock Drip</>
              )}
            </Button>
          )}

          {/* Drip button */}
          <Button
            className="w-full gap-2"
            variant={canClaim ? "default" : "outline"}
            onClick={executeClaim}
            disabled={!address || !canClaim || buttonIsLoading}
          >
            {buttonIsLoading && <Spinner />}
            <Droplets className="h-4 w-4" />
            {!address
              ? "Connect Wallet to Drip"
              : buttonIsLoading
              ? "Processing…"
              : hasClaimed
              ? "Already Dripped"
              : "Drip Tokens"}
          </Button>
        </CardFooter>
      </Card>

      {/* ══════════════════════ DIALOGS ══════════════════════ */}

      {/* Tasks Dialog */}
      <Dialog open={showFollowDialog} onOpenChange={setShowFollowDialog}>
        <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              Complete Required Tasks
            </DialogTitle>
            <DialogDescription>
              {dynamicTasks.length > 0
                ? "Finish these tasks and enter your usernames to unlock claiming."
                : "No tasks required for this faucet."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-3 overflow-y-auto flex-1 min-h-0">
            {dynamicTasks.length === 0 ? (
              <div className="flex flex-col items-center py-10 gap-3">
                <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <Check className="h-6 w-6 text-green-600" />
                </div>
                <p className="text-sm font-semibold text-green-600">No Tasks Required!</p>
              </div>
            ) : (
              dynamicTasks.map((task) => {
                const verified = verificationStates[task.platform];
                return (
                  <div
                    key={task.platform}
                    className={cn(
                      "rounded-xl border p-4 space-y-3 transition-colors",
                      verified
                        ? "bg-green-50 dark:bg-green-950/20 border-green-200/60"
                        : "bg-card border-border"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{getPlatformIcon(task.platform)}</span>
                        <div>
                          <p className="text-sm font-semibold">{task.action} {task.handle}</p>
                          <a
                            href={task.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-0.5"
                          >
                            <ExternalLink className="h-3 w-3" />
                            {getActionText(task.platform)} on {task.platform}
                          </a>
                        </div>
                      </div>
                      <Badge
                        variant={verified ? "secondary" : "outline"}
                        className={cn(
                          "text-[10px] shrink-0",
                          verified && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        )}
                      >
                        {verified
                          ? <><Check className="h-3 w-3 mr-1" /> Verified</>
                          : <><AlertCircle className="h-3 w-3 mr-1" /> Pending</>}
                      </Badge>
                    </div>
                    {!verified && (
                      <div className="space-y-1.5">
                        <Label htmlFor={`un-${task.platform}`} className="text-xs font-medium">
                          Your {task.platform} username
                        </Label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                          <Input
                            id={`un-${task.platform}`}
                            placeholder="username (without @)"
                            value={usernames[task.platform] || ''}
                            onChange={(e) =>
                              setUsernames(prev => ({ ...prev, [task.platform]: e.target.value }))
                            }
                            className="text-xs pl-9 h-9"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter className="shrink-0 pt-2 border-t">
            <Button
              onClick={startVerificationSimulation}
              className="w-full gap-2"
              disabled={!getAllUsernamesProvided() || allAccountsVerified || dynamicTasks.length === 0}
            >
              {allAccountsVerified ? (
                <><Check className="h-4 w-4" /> All Tasks Verified</>
              ) : (
                "Verify All Tasks"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Verification Dialog */}
      <Dialog open={showVerificationDialog} onOpenChange={setShowVerificationDialog}>
        <DialogContent className="w-[95vw] max-w-sm">
          <DialogHeader>
            <DialogTitle>Verifying Tasks</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">

            {simulatingState === 'verifying' && (
              <>
                <div className="h-14 w-14 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Checking your tasks…</p>
                  <p className="text-xs text-muted-foreground">This may take a few seconds</p>
                </div>
              </>
            )}

            {simulatingState === 'error' && (
              <>
                <div className="h-14 w-14 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <XCircle className="h-7 w-7 text-red-500" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-red-600">Verification Failed</p>
                  <p className="text-xs text-muted-foreground">
                    Unable to confirm the task. Please complete it and try again.
                  </p>
                </div>
                <Button size="sm" onClick={startVerificationSimulation} className="gap-2 mt-1">
                  <RefreshCw className="h-3.5 w-3.5" /> Try Again
                </Button>
              </>
            )}

            {simulatingState === 'idle' && allAccountsVerified && (
              <>
                <div className="h-14 w-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <Check className="h-7 w-7 text-green-600" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-green-600">All Tasks Verified!</p>
                  <p className="text-xs text-muted-foreground">You can now drip your tokens.</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => setShowVerificationDialog(false)}
                  className="mt-1"
                >
                  Continue to Drip
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Claim Success Dialog */}
      <Dialog open={showClaimPopup} onOpenChange={setShowClaimPopup}>
        <DialogContent className="w-[95vw] max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-2xl">🎉</span> Drip Successful!
            </DialogTitle>
            <DialogDescription>
              You received{" "}
              <strong className="text-foreground font-bold">
                {claimedAmount} {tokenSymbol}
              </strong>{" "}
              — nice!
            </DialogDescription>
          </DialogHeader>

          <div className="py-3">
            <div className="rounded-xl bg-muted/40 border border-dashed px-4 py-3 text-center">
              <p className="text-xs text-muted-foreground">Amount received</p>
              <p className="text-2xl font-bold mt-0.5">
                {claimedAmount}{" "}
                <span className="text-base font-medium text-muted-foreground">{tokenSymbol}</span>
              </p>
            </div>
            <p className="text-xs text-muted-foreground text-center mt-3">
              Share your drop on 𝕏 to help spread the word!
            </p>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button onClick={handleShareOnX} className="flex-1 gap-2">
              <Share2 className="h-4 w-4" /> Share on 𝕏
            </Button>
            <Button variant="outline" onClick={() => setShowClaimPopup(false)} className="flex-1">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FaucetUserView;