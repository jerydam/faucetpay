// Fixed Divvi Integration

// Try different import patterns
let getReferralTag: any = null;
let submitReferral: any = null;
let importError: string | null = null;

// Track if the last tag generation was successful
// This prevents reporting transactions that weren't actually tagged
let lastTagGenerationWasSuccessful = false;

try {
  // Method 1: Named imports
  const namedImports = require("@divvi/referral-sdk");
  
  if (namedImports.getReferralTag) getReferralTag = namedImports.getReferralTag;
  if (namedImports.submitReferral) submitReferral = namedImports.submitReferral;
  
  // Method 2: Default export fallback
  if ((!getReferralTag || !submitReferral) && namedImports.default) {
    if (!getReferralTag && namedImports.default.getReferralTag) getReferralTag = namedImports.default.getReferralTag;
    if (!submitReferral && namedImports.default.submitReferral) submitReferral = namedImports.default.submitReferral;
  }
  
  // Method 3: Default is function
  if (!getReferralTag && typeof namedImports.default === 'function') {
    getReferralTag = namedImports.default;
  }
  
} catch (error: any) {
  console.error("Failed to import Divvi SDK:", error);
  importError = error.message || "Unknown import error";
}

const DIVVI_CONSUMER_ADDRESS: `0x${string}` = "0xd59B83De618561c8FF4E98fC29a1b96ABcBFB18a";

export function appendDivviReferralData(originalData: string, userAddress?: `0x${string}`): string {
  // Reset flag at the start of every attempt
  lastTagGenerationWasSuccessful = false;

  // 1. Basic Validation
  if (importError || !getReferralTag || typeof getReferralTag !== 'function') {
    console.warn("Divvi SDK unavailable, skipping tag generation.");
    return originalData;
  }

  if (!userAddress) {
    console.warn("No user address provided for Divvi tag.");
    return originalData;
  }

  try {
    // 2. Generate Tag
    const referralTag = getReferralTag({
      user: userAddress,
      consumer: DIVVI_CONSUMER_ADDRESS,
    });

    if (!referralTag) {
      console.warn("Divvi SDK returned empty tag.");
      return originalData;
    }

    // 3. Success! Set flag and return tagged data
    lastTagGenerationWasSuccessful = true;
    console.log("✅ Divvi tag appended successfully.");
    return originalData + referralTag;

  } catch (error) {
    console.error("Failed to generate Divvi referral tag:", error);
    return originalData; 
  }
}

export async function reportTransactionToDivvi(txHash: `0x${string}`, chainId: number): Promise<void> {
  // 1. Check Import Status
  if (importError || !submitReferral) {
    return; // Silently skip if SDK isn't loaded
  }

  // 2. SAFETY CHECK: Only report if we actually tagged the transaction
  // This prevents the 400 Bad Request error
  if (!lastTagGenerationWasSuccessful) {
    console.warn("Skipping Divvi report: Transaction was not successfully tagged.");
    return;
  }

  try {
    console.log(`Reporting transaction ${txHash} to Divvi...`);
    
    await submitReferral({
      txHash,
      chainId,
    });
    
    console.log("✅ Transaction successfully reported to Divvi");
  } catch (error) {
    // Log but do not throw, to prevent blocking UI flow
    console.warn("Divvi reporting failed (non-critical):", error);
  }
}
export function getDivviStatus() {
  if (importError) {
    return { status: "error", message: `Import failed: ${importError}` };
  }
  if (!getReferralTag || !submitReferral) {
    return { status: "error", message: "Divvi SDK functions not available" };
  }
  return { status: "ok", message: "Divvi SDK loaded successfully" };
} 
export function isSupportedNetwork(chainId: number): boolean {
  // Added 42161 (Arbitrum) to supported list
  return [1, 42220, 44787, 62320, 1135, 4202, 8453, 84532, 137, 42161, 421614].includes(chainId);
}