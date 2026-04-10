// ============================================
// COMPREHENSIVE TASK VERIFICATION SYSTEM
// ============================================

import { toast } from "sonner";

const API_BASE_URL = "https://identical-vivi-faucetdrops-41e9c56b.koyeb.app";
const VERIFIER_API_URL = "https://identical-vivi-faucetdrops-41e9c56b.koyeb.app";

// ============================================
// TYPE DEFINITIONS
// ============================================

export type VerificationType =
  | "auto_social"
  | "auto_tx"
  | "manual_link"
  | "manual_upload"
  | "system_referral"
  | "system_daily"
  | "none"
  | "onchain";

export type TaskStage = "Beginner" | "Intermediate" | "Advance" | "Legend" | "Ultimate";

export interface QuestTask {
  id: string;
  title: string;
  description: string;
  targetHandle?: string;
  points: number | string;
  category: "social" | "trading" | "swap" | "referral" | "content" | "general";
  targetContractAddress?: string;
  verificationType: VerificationType;
  url: string;
  stage: TaskStage;
  required: boolean;
  action: string;
  isSystem?: boolean;
  
  // On-chain specific fields
  minAmount?: string | number;
  minTxCount?: string | number;
  minDays?: string | number;
  targetChainId?: string;
  targetPlatform?: string;
  
  // System task fields
  minReferrals?: number | string;
  isRecurring?: boolean;
  recurrenceInterval?: number;
  minDurationHours?: number | string;
}

export interface TaskVerificationConfig {
  requiresProofUrl: boolean;
  requiresFile: boolean;
  requiresNotes: boolean;
  autoComplete: boolean;
  verificationEngine: "social" | "onchain" | "manual" | "instant";
  placeholderText?: string;
  inputLabel?: string;
  helperText?: string;
}

// ============================================
// VERIFICATION CONFIGURATION MAP
// ============================================

export const getVerificationConfig = (
  task: QuestTask
): TaskVerificationConfig => {
  const { verificationType, action, category, targetPlatform } = task;

  // 1. INSTANT REWARDS (No verification)
  if (verificationType === "none") {
    return {
      requiresProofUrl: false,
      requiresFile: false,
      requiresNotes: false,
      autoComplete: true,
      verificationEngine: "instant",
      helperText: "This task will be completed automatically when you interact with it.",
    };
  }

  // 2. SOCIAL MEDIA TASKS (API Verification)
  if (verificationType === "auto_social") {
    const isTweetTask = ["quote", "like & retweet", "comment"].includes(action || "");
    const isFollowTask = action === "follow";

    return {
      requiresProofUrl: true,
      requiresFile: false,
      requiresNotes: false,
      autoComplete: false,
      verificationEngine: "social",
      inputLabel: isTweetTask
        ? "Tweet/Post URL"
        : isFollowTask
        ? "Your Profile URL (for verification)"
        : "Link to Proof",
      placeholderText: isTweetTask
        ? "https://x.com/username/status/..."
        : isFollowTask
        ? "https://x.com/yourusername"
        : "https://...",
      helperText: isTweetTask
        ? `Paste the link to your ${action} that mentions ${task.targetHandle || "@FaucetDrops"}`
        : isFollowTask
        ? "We'll verify that you're following the required account"
        : "Provide a link to verify your completion",
    };
  }

  // 3. ON-CHAIN VERIFICATION (RPC/Explorer Check)
  if (verificationType === "onchain") {
    return {
      requiresProofUrl: false,
      requiresFile: false,
      requiresNotes: false,
      autoComplete: false,
      verificationEngine: "onchain",
      helperText: getOnChainHelperText(task),
    };
  }

  // 4. MANUAL LINK SUBMISSION
  if (verificationType === "manual_link") {
    return {
      requiresProofUrl: true,
      requiresFile: false,
      requiresNotes: true,
      autoComplete: false,
      verificationEngine: "manual",
      inputLabel: category === "trading" ? "Transaction Hash" : "Proof URL",
      placeholderText:
        category === "trading"
          ? "0x1234567890abcdef..."
          : "https://...",
      helperText:
        category === "trading"
          ? "Paste the transaction hash from the blockchain explorer"
          : "Provide a link that proves you completed this task",
    };
  }

  // 5. MANUAL FILE UPLOAD
  if (verificationType === "manual_upload") {
    return {
      requiresProofUrl: false,
      requiresFile: true,
      requiresNotes: true,
      autoComplete: false,
      verificationEngine: "manual",
      helperText: "Upload a screenshot or image proving you completed this task",
    };
  }

  // 6. SYSTEM TASKS (Share on X, Referral, Check-in)
  if (verificationType === "system_referral" || verificationType === "system_daily") {
    return {
      requiresProofUrl: false,
      requiresFile: false,
      requiresNotes: false,
      autoComplete: true,
      verificationEngine: "instant",
    };
  }

  // Default fallback
  return {
    requiresProofUrl: true,
    requiresFile: false,
    requiresNotes: true,
    autoComplete: false,
    verificationEngine: "manual",
    placeholderText: "https://...",
    helperText: "Provide proof of completion",
  };
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function getOnChainHelperText(task: QuestTask): string {
  const { action, minAmount, minTxCount, minDays } = task;

  switch (action) {
    case "hold_token":
      return `We'll check if your wallet holds at least ${minAmount || "a minimum amount"} of the required token.`;
    case "hold_nft":
      return `We'll verify that you own at least 1 NFT from the specified collection.`;
    case "tx_count":
      return `Your wallet must have at least ${minTxCount || "a minimum number of"} transactions on-chain.`;
    case "wallet_age":
      return `Your wallet must be at least ${minDays || "a minimum number of"} days old.`;
    default:
      return "We'll verify this requirement automatically using blockchain data.";
  }
}

// ============================================
// UNIFIED VERIFICATION HANDLER
// ============================================

export async function verifyTask(
  task: QuestTask,
  userWalletAddress: string,
  faucetAddress: string,
  submissionData: {
    proofUrl: string;
    file: File | null;
    notes: string;
  },
  userProfile: any
): Promise<{ success: boolean; message: string }> {
  const config = getVerificationConfig(task);

  // 1. VALIDATION PHASE
  if (config.requiresProofUrl && !submissionData.proofUrl.trim()) {
    return { success: false, message: "Proof URL is required" };
  }

  if (config.requiresFile && !submissionData.file) {
    return { success: false, message: "File upload is required" };
  }

  // 2. LOG SUBMISSION TO DATABASE (Always do this first)
  const formData = new FormData();
  formData.append("walletAddress", userWalletAddress);
  formData.append("taskId", task.id);
  formData.append("submissionType", task.verificationType);

  // Determine proof URL based on verification type
  let finalProofUrl = "";
  if (config.requiresProofUrl) {
    finalProofUrl = submissionData.proofUrl.trim();
  } else if (task.verificationType === "onchain") {
    finalProofUrl = "onchain-verified";
  } else if (task.action === "watch" || task.action === "visit") {
    finalProofUrl = task.url || "";
  }

  formData.append("submittedData", finalProofUrl);
  if (submissionData.notes) formData.append("notes", submissionData.notes);
  if (submissionData.file) formData.append("file", submissionData.file);

  // Log to database
  const dbResponse = await fetch(
    `${API_BASE_URL}/api/quests/${faucetAddress}/submissions`,
    {
      method: "POST",
      body: formData,
    }
  );

  const dbResult = await dbResponse.json();
  if (!dbResult.success) {
    return { success: false, message: dbResult.message || "Database submission failed" };
  }

  // 3. VERIFICATION ROUTING BASED ON ENGINE TYPE
  try {
    switch (config.verificationEngine) {
      case "instant":
        // Auto-complete tasks (watch video, visit page, etc.)
        return { success: true, message: `Task completed! +${task.points} points` };

      case "social":
        return await verifySocialTask(task, submissionData, userProfile);

      case "onchain":
        return await verifyOnChainTask(task, userWalletAddress);

      case "manual":
        // Manual review required
        return {
          success: true,
          message: "Submission sent for review. You'll be notified when approved.",
        };

      default:
        return { success: false, message: "Unknown verification type" };
    }
  } catch (error: any) {
    console.error("Verification error:", error);
    return { success: false, message: error.message || "Verification failed" };
  }
}

// ============================================
// SOCIAL VERIFICATION ENGINE
// ============================================

async function verifySocialTask(
  task: QuestTask,
  submissionData: { proofUrl: string },
  userProfile: any
): Promise<{ success: boolean; message: string }> {
  // Determine task type for the scraper
  const taskTypeMap: Record<string, string> = {
    follow: "follow",
    quote: "tweet_content",
    "like & retweet": "tweet_content",
    comment: "tweet_content",
  };

  const taskType = taskTypeMap[task.action || ""] || "tweet_content";

  // Determine target criteria
  let targetCriteria = "";
  if (task.action === "follow") {
    targetCriteria = task.targetHandle || "@FaucetDrops";
  } else {
    // For tweets, we look for the handle mention
    targetCriteria = task.targetHandle || "@FaucetDrops";
  }

  const verifyRes = await fetch(`${VERIFIER_API_URL}/verify/social`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      taskType: taskType,
      proofUrl: submissionData.proofUrl,
      targetCriteria: targetCriteria,
      userHandle: userProfile?.twitter_handle || "",
    }),
  });

  const verifyJson = await verifyRes.json();

  if (!verifyJson.success || !verifyJson.verified) {
    throw new Error("Social verification failed. Please check your submission.");
  }

  return { success: true, message: `Social task verified! +${task.points} points` };
}

// ============================================
// ON-CHAIN VERIFICATION ENGINE
// ============================================

async function verifyOnChainTask(
  task: QuestTask,
  walletAddress: string
): Promise<{ success: boolean; message: string }> {
  // Map frontend action to backend task type
  const actionMap: Record<string, string> = {
    hold_token: "hold_token",
    hold_nft: "hold_nft",
    wallet_age: "wallet_age",
    tx_count: "tx_count",
  };

  const taskType = actionMap[task.action || ""] || "hold_token";

  // Determine threshold value
  const threshold =
    task.minAmount || task.minTxCount || task.minDays || "0";

  const verifyRes = await fetch(`${VERIFIER_API_URL}/verify/onchain`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      taskType: taskType,
      walletAddress: walletAddress,
      chainId: task.targetChainId || "42220",
      targetAddress: task.targetContractAddress || null,
      threshold: threshold.toString(),
    }),
  });

  const verifyJson = await verifyRes.json();

  if (!verifyJson.verified) {
    throw new Error("On-chain verification failed. Requirements not met.");
  }

  return { success: true, message: `Wallet verified! +${task.points} points` };
}

// ============================================
// VALIDATION HELPERS
// ============================================

export function validateSubmission(
  task: QuestTask,
  submissionData: {
    proofUrl: string;
    file: File | null;
  }
): { valid: boolean; error?: string } {
  const config = getVerificationConfig(task);

  if (config.requiresProofUrl && !submissionData.proofUrl.trim()) {
    return { valid: false, error: "Proof URL is required" };
  }

  if (config.requiresFile && !submissionData.file) {
    return { valid: false, error: "File upload is required" };
  }

  // URL validation for social tasks
  if (config.verificationEngine === "social" && submissionData.proofUrl) {
    const isValidUrl = submissionData.proofUrl.startsWith("http");
    if (!isValidUrl) {
      return { valid: false, error: "Please provide a valid URL" };
    }
  }

  return { valid: true };
}