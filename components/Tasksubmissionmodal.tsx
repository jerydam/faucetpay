// ============================================
// DYNAMIC TASK SUBMISSION MODAL
// ============================================

import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  X,
  Loader2,
  AlertTriangle,
  Twitter,
  Link,
  Upload,
  Zap,
  Play,
  ExternalLink,
  CheckCircle2,
  Shield,
  Code,
} from "lucide-react";
import { toast } from "sonner";
import {
  getVerificationConfig,
  verifyTask,
  validateSubmission,
  type TaskVerificationConfig,
  type QuestTask,
} from "./task-verification-system";

interface SubmissionModalProps {
  task: QuestTask;
  isOpen: boolean;
  onClose: () => void;
  onSubmitSuccess: () => void;
  userWalletAddress: string;
  faucetAddress: string;
  userProfile: any;
  participantData: any;
}

export function TaskSubmissionModal({
  task,
  isOpen,
  onClose,
  onSubmitSuccess,
  userWalletAddress,
  faucetAddress,
  userProfile,
  participantData,
}: SubmissionModalProps) {
  const [submissionData, setSubmissionData] = useState({
    proofUrl: "",
    notes: "",
    file: null as File | null,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const config: TaskVerificationConfig = getVerificationConfig(task);

  if (!isOpen) return null;

  // ============================================
  // HANDLERS
  // ============================================

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size exceeds 5MB limit.");
      e.target.value = "";
      return;
    }

    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      if (img.width > 2048 || img.height > 2048) {
        toast.error("Image dimensions exceed 2048x2048px limit.");
        e.target.value = "";
        setSubmissionData((prev) => ({ ...prev, file: null }));
      } else {
        setSubmissionData((prev) => ({ ...prev, file }));
      }
    };
  };

  const handleSubmit = async () => {
    // Validation
    const validation = validateSubmission(task, submissionData);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await verifyTask(
        task,
        userWalletAddress,
        faucetAddress,
        submissionData,
        userProfile
      );

      if (result.success) {
        toast.success(result.message);
        onSubmitSuccess();
        onClose();
      } else {
        toast.error(result.message);
      }
    } catch (error: any) {
      toast.error(error.message || "Submission failed");
    } finally {
      setIsSubmitting(false);
      setSubmissionData({ proofUrl: "", notes: "", file: null });
    }
  };

  const handleInstantAction = async (actionType: "watch" | "visit") => {
    // Open the URL
    window.open(task.url, "_blank", "noopener,noreferrer");

    // Submit automatically
    await handleSubmit();
  };

  const handleSocialShare = () => {
    if (!participantData?.referral_id) {
      toast.error("Referral link not available");
      return;
    }

    const cleanUrl = window.location.href.split("?")[0];
    const refLink = `${cleanUrl}?ref=${participantData.referral_id}`;
    const text = `I'm participating in this awesome quest on @FaucetDrops!\nJoin me here: ${refLink}`;

    window.open(
      `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  // ============================================
  // RENDER TASK-SPECIFIC CONTENT
  // ============================================

  const renderTaskContent = () => {
    // 1. INSTANT REWARDS (Watch Video / Visit Page)
    if (config.verificationEngine === "instant") {
      if (task.action === "watch") {
        return (
          <div className="space-y-6">
            <div className="rounded-xl overflow-hidden border bg-black aspect-video relative shadow-lg">
              {task.url.includes("youtube.com") || task.url.includes("youtu.be") ? (
                <iframe
                  width="100%"
                  height="100%"
                  src={task.url
                    .replace("watch?v=", "embed/")
                    .replace("youtu.be/", "www.youtube.com/embed/")
                    .split("&")[0]}
                  title="Video"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white/70 bg-gradient-to-b from-black/60 to-black/90">
                  <Play className="h-16 w-16 opacity-70 mb-4" />
                  <p className="text-lg font-medium">Video preview not available</p>
                </div>
              )}
            </div>

            <Button
              size="lg"
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold h-12"
              onClick={() => handleInstantAction("watch")}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Claiming...
                </>
              ) : (
                "Watch Video & Claim Points"
              )}
            </Button>
          </div>
        );
      }

      if (task.action === "visit") {
        return (
          <div className="space-y-6 text-center">
            <div className="p-10 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-2xl border border-blue-100 dark:border-blue-900/50">
              <ExternalLink className="mx-auto h-14 w-14 text-blue-500 mb-5 opacity-90" />
              <h4 className="text-xl font-semibold mb-3">Visit Project Website</h4>
              <p className="text-muted-foreground mb-8 max-w-sm mx-auto">
                Opening the website will automatically add{" "}
                <strong>{task.points} points</strong> to your profile.
              </p>

              <Button
                size="lg"
                className="bg-blue-600 hover:bg-blue-700 text-white px-12 h-14 font-bold text-lg shadow-lg"
                onClick={() => handleInstantAction("visit")}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Visit Website & Get Points"
                )}
              </Button>
            </div>
          </div>
        );
      }
    }

    // 2. SHARE ON X (SYSTEM TASK)
    if (task.id === "sys_share_x" || task.action === "share_quest") {
      return (
        <div className="space-y-6">
          <div className="p-6 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/40 dark:to-yellow-950/30 rounded-xl border border-amber-200 dark:border-amber-800 text-center">
            <div className="mx-auto w-16 h-16 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center mb-4 shadow-md">
              <Twitter className="h-8 w-8 text-[#1DA1F2]" />
            </div>
            <h4 className="text-lg font-semibold mb-3">Share this Quest on X</h4>
            <p className="text-sm text-muted-foreground mb-5">
              Post about this quest including @FaucetDrops and your referral link
            </p>

            <Button
              size="lg"
              className="bg-[#1DA1F2] hover:bg-[#0c8cdf] text-white w-full mb-5"
              onClick={handleSocialShare}
            >
              <Twitter className="mr-2 h-5 w-5" />
              Compose & Post on X
            </Button>

            <p className="text-xs text-amber-700 dark:text-amber-300">
              Make sure your tweet contains @FaucetDrops and the referral link
            </p>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Link className="h-4 w-4" />
              Paste link to your tweet (required)
            </Label>
            <Input
              placeholder="https://x.com/yourusername/status/..."
              value={submissionData.proofUrl}
              onChange={(e) =>
                setSubmissionData((prev) => ({
                  ...prev,
                  proofUrl: e.target.value.trim(),
                }))
              }
              className="font-mono text-sm focus-visible:ring-amber-500"
            />
            <p className="text-xs text-muted-foreground italic">
              This link will be reviewed manually.
            </p>
          </div>
        </div>
      );
    }

    // 3. ON-CHAIN VERIFICATION
    if (config.verificationEngine === "onchain") {
      return (
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-purple-100 dark:bg-purple-900/20 rounded-full flex items-center justify-center">
            <Zap className="h-8 w-8 text-purple-600" />
          </div>
          <h4 className="text-lg font-semibold">Wallet Check Required</h4>
          <p className="text-muted-foreground text-sm">{config.helperText}</p>

          {task.targetContractAddress && (
            <div className="text-xs bg-slate-100 dark:bg-slate-900 p-3 rounded border font-mono break-all">
              <span className="font-semibold">Target contract:</span>{" "}
              {task.targetContractAddress.slice(0, 6)}...
              {task.targetContractAddress.slice(-4)}
            </div>
          )}

          <Button
            size="lg"
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold h-12"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              "Verify Wallet Status"
            )}
          </Button>
        </div>
      );
    }

    // 4. SOCIAL MEDIA TASKS (API Auto-Verify)
    if (config.verificationEngine === "social") {
      return (
        <div className="space-y-6">
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-900 dark:text-blue-300">
                  Automatic Verification
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                  {config.helperText}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Link className="h-4 w-4" />
              {config.inputLabel}
            </Label>
            <Input
              placeholder={config.placeholderText}
              value={submissionData.proofUrl}
              onChange={(e) =>
                setSubmissionData((prev) => ({
                  ...prev,
                  proofUrl: e.target.value.trim(),
                }))
              }
              className="font-mono text-sm"
            />
          </div>
        </div>
      );
    }

    // 5. MANUAL LINK SUBMISSION
    if (config.verificationEngine === "manual" && config.requiresProofUrl) {
      return (
        <div className="space-y-6">
          <div className="p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg flex items-center gap-2 text-orange-600 dark:text-orange-400 text-sm">
            <AlertTriangle className="h-4 w-4" />
            <span>This submission will be reviewed manually by the quest creator.</span>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">
              {config.inputLabel || "Proof URL"}
            </Label>
            <Input
              placeholder={config.placeholderText || "https://..."}
              value={submissionData.proofUrl}
              onChange={(e) =>
                setSubmissionData((prev) => ({
                  ...prev,
                  proofUrl: e.target.value.trim(),
                }))
              }
              className={
                task.category === "trading" ? "font-mono text-sm" : ""
              }
            />
            {config.helperText && (
              <p className="text-xs text-muted-foreground">{config.helperText}</p>
            )}
          </div>
        </div>
      );
    }

    // 6. MANUAL FILE UPLOAD
    if (config.verificationEngine === "manual" && config.requiresFile) {
      return (
        <div className="space-y-6">
          <div className="p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg flex items-center gap-2 text-orange-600 dark:text-orange-400 text-sm">
            <AlertTriangle className="h-4 w-4" />
            <span>Upload proof - Admin will review your submission.</span>
          </div>

          <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-8 flex flex-col items-center justify-center relative bg-slate-50/50 dark:bg-slate-900">
            <Input
              type="file"
              accept="image/*"
              className="absolute inset-0 opacity-0 cursor-pointer h-full"
              onChange={handleFileSelect}
            />
            <Upload className="h-8 w-8 text-slate-400 mb-2" />
            <p className="text-sm font-semibold">Click to upload screenshot</p>
            <p className="text-xs text-muted-foreground mt-1">
              Max 5MB, 2048x2048px
            </p>
            {submissionData.file && (
              <div className="mt-3 flex items-center gap-2 bg-green-50 dark:bg-green-900/20 px-3 py-1 rounded">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-700 dark:text-green-400">
                  {submissionData.file.name}
                </span>
              </div>
            )}
          </div>
        </div>
      );
    }

    return null;
  };

  // ============================================
  // MAIN RENDER
  // ============================================

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <Card className="w-full max-w-lg shadow-2xl border-0 dark:bg-slate-900 animate-in zoom-in-95 duration-200">
        <CardHeader className="bg-slate-50 dark:bg-slate-950 border-b dark:border-slate-800 pb-5 relative">
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4 h-8 w-8 rounded-full"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>
          <CardTitle className="text-xl pr-10">{task.title}</CardTitle>
          <CardDescription className="text-base font-medium mt-1">
            {task.description}
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
          {renderTaskContent()}

          {/* Optional Notes Field (for manual tasks) */}
          {config.requiresNotes && (
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase text-muted-foreground">
                Notes (Optional)
              </Label>
              <Textarea
                placeholder="Add any extra details or comments..."
                value={submissionData.notes}
                onChange={(e) =>
                  setSubmissionData({ ...submissionData, notes: e.target.value })
                }
                className="resize-none dark:bg-slate-950 min-h-[80px]"
                rows={3}
              />
            </div>
          )}
        </CardContent>

        {/* Footer with Submit Button (only for non-instant tasks) */}
        {!config.autoComplete && (
          <CardFooter className="justify-between border-t p-5 dark:border-slate-800">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>

            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !validateSubmission(task, submissionData).valid}
              className="bg-primary hover:bg-primary/90 min-w-[160px]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Task"
              )}
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}