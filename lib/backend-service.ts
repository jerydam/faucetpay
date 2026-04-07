import { BrowserProvider } from 'ethers';
import { appendDivviReferralData, reportTransactionToDivvi } from './divvi-integration';
import { FAUCET_ABI_CUSTOM } from './abis';

const API_URL = "https://faucetdrop-backend.onrender.com";
const ENABLE_DIVVI_REFERRAL = true;
const DEBUG_MODE = process.env.NODE_ENV === 'development';

interface ClaimPayload {
  userAddress: string;
  faucetAddress: string;
  chainId: number;
  secretCode?: string;
  divviReferralData?: string;
}

interface DivviIntegrationResult {
  isApplicable: boolean;
  isWorking: boolean;
  data?: string;
  error?: string;
  debugInfo?: any;
}

interface RequestLogData {
  userAddress: string;
  faucetAddress: string;
  chainId: number;
  hasDivviData: boolean;
  divviDataLength: number;
  timestamp: string;
  payload?: string;
  divviDebugInfo?: any;
}

interface DebugInfo {
  chainId: number;
  isSupportedNetwork: boolean;
  enabled: boolean;
  timestamp: string;
  reason?: string;
  rawData?: {
    value: string;
    type: string;
    length: number;
    isEmpty: boolean;
  };
  validation?: {
    isValid: boolean;
    fixed: string;
    error?: string;
  };
  processedData?: string;
  errorType?: string;
  errorMessage?: string;
}

interface SecretCodeData {
  faucet_address: string;
  secret_code: string;
  start_time: number;
  end_time: number;
  is_valid: boolean;
  is_expired: boolean;
  is_future: boolean;
  created_at?: string;
  time_remaining: number;
}

const SUPPORTED_CHAIN_IDS = [
  1,      // Ethereum Mainnet
  42220,  // Celo Mainnet
  11155111,
  44787,  // Celo Testnet
  62320,  // Custom Network
  1135,   // Lisk
  4202,   // Lisk Testnet
  8453,   // Base
  84532,  // Base Testnet
  42161,  // Arbitrum One
  421614, // Arbitrum Sepolia
  137,    // Polygon Mainnet
  56,
];

// ─── Core Error Extractor ────────────────────────────────────────────────────
async function extractBackendError(response: Response): Promise<string> {
  try {
    const responseText = await response.text();
    const errorData = JSON.parse(responseText);

    // FastAPI validation errors (422) come as an array
    if (Array.isArray(errorData.detail)) {
      return errorData.detail.map((d: any) => d.msg).join(', ');
    }

    // Return the exact string from the backend — no wrapping
    if (typeof errorData.detail === 'string') return errorData.detail;
    if (typeof errorData.message === 'string') return errorData.message;
    if (typeof errorData.error === 'string') return errorData.error;

    return `Server error: ${response.status}`;
  } catch {
    return `Request failed with status: ${response.status} ${response.statusText}`;
  }
}

// ─── Optional chains where Divvi should be disabled ─────────────────────────
const DIVVI_DISABLED_CHAINS: number[] = [];

function isSupportedNetwork(chainId: number): boolean {
  return SUPPORTED_CHAIN_IDS.includes(chainId);
}

export function shouldUseDivvi(chainId: number): boolean {
  if (!ENABLE_DIVVI_REFERRAL) return false;
  if (!isSupportedNetwork(chainId)) return false;
  if (DIVVI_DISABLED_CHAINS.includes(chainId)) {
    debugLog(`Divvi disabled for specific chain: ${chainId}`);
    return false;
  }
  return true;
}

function debugLog(message: string, data?: any) {
  if (DEBUG_MODE) {
    console.log(`🔍 [Divvi Debug] ${message}`, data ? data : '');
  }
}

function errorLog(message: string, error?: any) {
  console.error(`❌ [Divvi Error] ${message}`, error ? error : '');
}

function successLog(message: string, data?: any) {
  console.log(`✅ [Divvi Success] ${message}`, data ? data : '');
}

function validateAndFixHexData(data: string): { isValid: boolean; fixed: string; error?: string } {
  if (!data || typeof data !== 'string') {
    return { isValid: false, fixed: '', error: 'Data is empty or not a string' };
  }

  const trimmed = data.trim();
  if (trimmed === '') {
    return { isValid: false, fixed: '', error: 'Data is empty after trimming' };
  }

  const hexPattern = /^(0x)?[0-9a-fA-F]+$/;
  if (!hexPattern.test(trimmed)) {
    return { isValid: false, fixed: '', error: 'Data contains non-hex characters' };
  }

  const fixed = trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`;

  const hexPart = fixed.slice(2);
  if (hexPart.length % 2 !== 0) {
    return { isValid: false, fixed: '', error: 'Hex data has odd length (incomplete bytes)' };
  }

  return { isValid: true, fixed };
}

// ─── Network Helpers ─────────────────────────────────────────────────────────
async function safeGetNetwork(provider: BrowserProvider, maxRetries: number = 3): Promise<{ chainId: number }> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      debugLog(`Attempting to get network (attempt ${attempt}/${maxRetries})`);

      if (attempt > 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const network = await provider.getNetwork();
      const chainId = Number(network.chainId);

      successLog(`Successfully got network on attempt ${attempt}`, { chainId });
      return { chainId };

    } catch (error: any) {
      lastError = error as Error;
      errorLog(`Network fetch attempt ${attempt} failed`, error);

      if (error.message.includes('network changed') && attempt < maxRetries) {
        debugLog('Network change detected, will retry with delay');
        continue;
      }

      if (!error.message.includes('network changed')) {
        throw error;
      }
    }
  }

  throw new Error(`Failed to get network after ${maxRetries} attempts. Last error: ${lastError?.message}`);
}

async function getChainIdFromWindow(): Promise<number | null> {
  try {
    if (typeof window !== 'undefined' && window.ethereum) {
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      return parseInt(chainId, 16);
    }
  } catch (error: any) {
    debugLog('Failed to get chainId from window.ethereum', error);
  }
  return null;
}

async function getRobustChainId(provider: BrowserProvider): Promise<number> {
  try {
    // BrowserProvider is already bound to the correct network
    const network = await safeGetNetwork(provider);
    return network.chainId;
  } catch (error: any) {
    // Only fall back to window.ethereum if provider fails
    debugLog('Provider network fetch failed, falling back to window.ethereum', error);
    const windowChainId = await getChainIdFromWindow();
    if (windowChainId) return windowChainId;
    throw error;
  }
}

// ─── Divvi ───────────────────────────────────────────────────────────────────
async function processDivviReferralData(chainId: number, userAddress: string): Promise<{
  data?: string;
  error?: string;
  debugInfo: DebugInfo;
}> {
  const debugInfo: DebugInfo = {
    chainId,
    isSupportedNetwork: isSupportedNetwork(chainId),
    enabled: ENABLE_DIVVI_REFERRAL,
    timestamp: new Date().toISOString()
  };

  if (!ENABLE_DIVVI_REFERRAL) {
    debugLog('Divvi referral is disabled globally');
    return { debugInfo: { ...debugInfo, reason: 'disabled' } };
  }

  if (!isSupportedNetwork(chainId)) {
    debugLog(`Network not supported by Divvi (chainId: ${chainId}). Bypassing Divvi integration.`);
    return { debugInfo: { ...debugInfo, reason: 'unsupported_network' } };
  }

  if (DIVVI_DISABLED_CHAINS.includes(chainId)) {
    debugLog(`Divvi disabled for specific chain: ${chainId}`);
    return { debugInfo: { ...debugInfo, reason: 'chain_disabled' } };
  }

  if (!userAddress) {
    debugLog('No user address provided for Divvi referral');
    return { debugInfo: { ...debugInfo, reason: 'no_user_address' } };
  }

  try {
    debugLog('Attempting to get Divvi referral data...', { userAddress, chainId });

    const rawData = appendDivviReferralData('', userAddress as `0x${string}`);

    debugInfo.rawData = {
      value: rawData,
      type: typeof rawData,
      length: rawData?.length || 0,
      isEmpty: !rawData || rawData.trim() === ''
    };

    debugLog('Raw Divvi data received:', debugInfo.rawData);

    if (!rawData || rawData.trim() === '') {
      const error = 'appendDivviReferralData returned empty or null data';
      debugLog(error);
      return { error, debugInfo: { ...debugInfo, reason: 'empty_data' } };
    }

    const validation = validateAndFixHexData(rawData);
    debugInfo.validation = validation;

    if (!validation.isValid) {
      const error = `Invalid hex data: ${validation.error}`;
      errorLog(error, { rawData, validation });
      return { error, debugInfo: { ...debugInfo, reason: 'invalid_hex' } };
    }

    successLog('Successfully processed Divvi referral data', {
      userAddress,
      chainId,
      original: rawData,
      fixed: validation.fixed,
      length: validation.fixed.length
    });

    return {
      data: validation.fixed,
      debugInfo: { ...debugInfo, reason: 'success', processedData: validation.fixed }
    };

  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    errorLog('Failed to process Divvi referral data', { error: errorMessage, stack: error instanceof Error ? error.stack : undefined });

    return {
      error: errorMessage,
      debugInfo: {
        ...debugInfo,
        reason: 'exception',
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        errorMessage
      }
    };
  }
}

async function reportToDivvi(txHash: string, chainId: number): Promise<void> {
  if (!shouldUseDivvi(chainId)) {
    debugLog(`Skipping Divvi reporting - ${!ENABLE_DIVVI_REFERRAL ? 'disabled globally' : 'unsupported chain'} (chainId: ${chainId})`);
    return;
  }

  try {
    debugLog(`Reporting transaction to Divvi: ${txHash} on chain ${chainId}`);
    await reportTransactionToDivvi(txHash as `0x${string}`, chainId);
    successLog('Transaction reported to Divvi successfully');
  } catch (error: any) {
    errorLog('Failed to report transaction to Divvi', error);

    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      console.error(`
🚫 CORS Error Detected - Transaction reporting to Divvi failed
📋 Error Details:
   - This is a Cross-Origin Resource Sharing (CORS) issue
   - The Divvi API doesn't allow requests from your current domain
   - Your main transaction was still successful!

💡 Recommended Solutions:
   1. Move Divvi reporting to your backend server (recommended)
   2. Contact Divvi support to allowlist your domain
   3. Use a proxy server for development
   4. Skip Divvi reporting in development mode

🔧 Quick Fix for Development:
   Set ENABLE_DIVVI_REFERRAL=false or add domain check
      `);
    }
  }
}

// ─── Admin ───────────────────────────────────────────────────────────────────
export async function getSecretCodeForAdmin(
  userAddress: string,
  faucetAddress: string,
  chainId: number
): Promise<{ secretCode: string; isValid: boolean; isFuture: boolean }> {
  try {
    const response = await fetch(`${API_URL}/get-secret-code-for-admin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userAddress, faucetAddress, chainId }),
    });

    if (!response.ok) {
      const errorMessage = await extractBackendError(response);
      throw new Error(errorMessage);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error("Server indicated failure");
    }

    return {
      secretCode: result.secretCode,
      isValid: result.isValid,
      isFuture: result.isFuture
    };
  } catch (error: any) {
    console.error("Error fetching admin secret code:", error);
    throw error;
  }
}

// ─── Secret Code Retrieval ────────────────────────────────────────────────────
export async function retrieveSecretCode(faucetAddress: string): Promise<string> {
  try {
    console.log(`🔍 Retrieving secret code for faucet: ${faucetAddress}`);

    const response = await fetch(`${API_URL}/secret-code/${faucetAddress}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      const errorMessage = await extractBackendError(response);
      throw new Error(errorMessage);
    }

    const result = await response.json();

    if (!result.success || !result.data) {
      throw new Error('Invalid response format from server');
    }

    const secretData: SecretCodeData = result.data;

    console.log(`✅ Secret code retrieved:`, {
      code: secretData.secret_code,
      isValid: secretData.is_valid,
      isExpired: secretData.is_expired,
      timeRemaining: secretData.time_remaining
    });

    if (secretData.is_expired) {
      throw new Error(`Secret code has expired`);
    }

    if (secretData.is_future) {
      throw new Error(`Secret code is not yet active`);
    }

    if (!secretData.is_valid) {
      throw new Error(`Secret code is not currently valid`);
    }

    return secretData.secret_code;

  } catch (error: any) {
    console.error('❌ Error retrieving secret code:', error);
    throw error;
  }
}

export async function getAllSecretCodes(): Promise<SecretCodeData[]> {
  try {
    console.log('🔍 Retrieving all secret codes...');

    const response = await fetch(`${API_URL}/secret-codes`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      const errorMessage = await extractBackendError(response);
      throw new Error(errorMessage);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error('Invalid response format from server');
    }

    console.log(`✅ Retrieved ${result.count} secret codes`);
    return result.codes || [];

  } catch (error: any) {
    console.error('❌ Error retrieving all secret codes:', error);
    throw error;
  }
}

export async function getValidSecretCodes(): Promise<SecretCodeData[]> {
  try {
    console.log('🔍 Retrieving valid secret codes...');

    const response = await fetch(`${API_URL}/secret-codes/valid`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      const errorMessage = await extractBackendError(response);
      throw new Error(errorMessage);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error('Invalid response format from server');
    }

    console.log(`✅ Retrieved ${result.count} valid secret codes`);
    return result.codes || [];

  } catch (error: any) {
    console.error('❌ Error retrieving valid secret codes:', error);
    throw error;
  }
}

// ─── Storage Helpers ──────────────────────────────────────────────────────────
export function getFromStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (error: any) {
    console.warn('Failed to read from localStorage:', error);
    return null;
  }
}

export function setToStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (error: any) {
    console.warn('Failed to write to localStorage:', error);
  }
}

// ─── Debug Helpers ────────────────────────────────────────────────────────────
export async function debugClaimRequest(
  userAddress: string,
  faucetAddress: string,
  secretCode: string,
  chainId: number
) {
  console.log('🔍 Debugging claim request parameters...');

  const validation = {
    userAddress: {
      value: userAddress,
      isValid: /^0x[a-fA-F0-9]{40}$/.test(userAddress),
      isEmpty: !userAddress,
      length: userAddress?.length
    },
    faucetAddress: {
      value: faucetAddress,
      isValid: /^0x[a-fA-F0-9]{40}$/.test(faucetAddress),
      isEmpty: !faucetAddress,
      length: faucetAddress?.length
    },
    secretCode: {
      value: secretCode,
      isValid: /^[A-Z0-9]{6}$/.test(secretCode || ''),
      isEmpty: !secretCode,
      length: secretCode?.length,
      pattern: secretCode ? secretCode.match(/^[A-Z0-9]{6}$/) : null
    },
    chainId: {
      value: chainId,
      isValid: SUPPORTED_CHAIN_IDS.includes(chainId),
      type: typeof chainId,
      validChains: SUPPORTED_CHAIN_IDS
    }
  };

  console.log('📊 Validation Results:', validation);

  const errors = [];
  if (!validation.userAddress.isValid) {
    errors.push(`Invalid userAddress: ${userAddress} (length: ${validation.userAddress.length})`);
  }
  if (!validation.faucetAddress.isValid) {
    errors.push(`Invalid faucetAddress: ${faucetAddress} (length: ${validation.faucetAddress.length})`);
  }
  if (!validation.secretCode.isValid) {
    errors.push(`Invalid secretCode: "${secretCode}" (length: ${validation.secretCode.length}, pattern match: ${validation.secretCode.pattern})`);
  }
  if (!validation.chainId.isValid) {
    errors.push(`Invalid chainId: ${chainId} (type: ${validation.chainId.type}, valid: ${validation.chainId.validChains})`);
  }

  if (errors.length > 0) {
    console.error('❌ Validation Errors Found:', errors);
    return { valid: false, errors };
  }

  console.log('✅ All parameters valid');
  return { valid: true, errors: [] };
}

export async function debugCustomClaimRequest(
  userAddress: string,
  faucetAddress: string,
  chainId: number
) {
  console.log('🔍 Debugging custom claim request parameters...');

  const validation = {
    userAddress: {
      value: userAddress,
      isValid: /^0x[a-fA-F0-9]{40}$/.test(userAddress),
      isEmpty: !userAddress,
      length: userAddress?.length
    },
    faucetAddress: {
      value: faucetAddress,
      isValid: /^0x[a-fA-F0-9]{40}$/.test(faucetAddress),
      isEmpty: !faucetAddress,
      length: faucetAddress?.length
    },
    chainId: {
      value: chainId,
      isValid: SUPPORTED_CHAIN_IDS.includes(chainId),
      type: typeof chainId,
      validChains: SUPPORTED_CHAIN_IDS
    }
  };

  console.log('📊 Custom Claim Validation Results:', validation);

  const errors = [];
  if (!validation.userAddress.isValid) {
    errors.push(`Invalid userAddress: ${userAddress} (length: ${validation.userAddress.length})`);
  }
  if (!validation.faucetAddress.isValid) {
    errors.push(`Invalid faucetAddress: ${faucetAddress} (length: ${validation.faucetAddress.length})`);
  }
  if (!validation.chainId.isValid) {
    errors.push(`Invalid chainId: ${chainId} (type: ${validation.chainId.type}, valid: ${validation.chainId.validChains})`);
  }

  if (errors.length > 0) {
    console.error('❌ Custom Claim Validation Errors Found:', errors);
    return { valid: false, errors };
  }

  console.log('✅ All custom claim parameters valid');
  return { valid: true, errors: [] };
}

// ─── Claim Functions ──────────────────────────────────────────────────────────
export async function claimCustomViaBackend(
  userAddress: string,
  faucetAddress: string,
  provider: BrowserProvider
): Promise<{ success: boolean; txHash: string; divviDebug?: any }> {
  try {
    debugLog('Input to claimCustomViaBackend', { userAddress, faucetAddress });

    if (typeof window === 'undefined' || !window.ethereum) {
      throw new Error("Wallet not detected. Please install MetaMask or another Ethereum wallet in a supported browser.");
    }

    if (!provider) {
      throw new Error("Provider not initialized. Please ensure your wallet is connected.");
    }

    const chainId = await getRobustChainId(provider);

    if (!SUPPORTED_CHAIN_IDS.includes(chainId)) {
      throw new Error(`Unsupported chainId: ${chainId}. Please switch to a supported network: ${SUPPORTED_CHAIN_IDS.join(', ')}`);
    }

    debugLog(`Starting custom drop process for chainId: ${chainId}`);

    const cleanUserAddress = userAddress.trim();
    const cleanFaucetAddress = faucetAddress.trim();

    console.log('🧹 Cleaned parameters for custom claim:', {
      userAddress: cleanUserAddress,
      faucetAddress: cleanFaucetAddress,
      chainId,
      divviSupported: shouldUseDivvi(chainId)
    });

    let payload: any = {
      userAddress: cleanUserAddress,
      faucetAddress: cleanFaucetAddress,
      chainId
    };

    if (shouldUseDivvi(chainId)) {
      const divviResult = await processDivviReferralData(chainId, cleanUserAddress);

      if (divviResult.data) {
        payload.divviReferralData = divviResult.data;
        successLog('Added Divvi referral data to custom claim payload', {
          length: divviResult.data.length,
          preview: `${divviResult.data.slice(0, 20)}...`
        });
      } else if (divviResult.error) {
        debugLog(`Proceeding without Divvi data: ${divviResult.error}`);
      }
    } else {
      debugLog(`Skipping Divvi integration for unsupported chain: ${chainId}`);
    }

    const requestLog: RequestLogData = {
      userAddress: cleanUserAddress,
      faucetAddress: cleanFaucetAddress,
      chainId,
      hasDivviData: !!payload.divviReferralData,
      divviDataLength: payload.divviReferralData?.length || 0,
      timestamp: new Date().toISOString()
    };

    if (DEBUG_MODE) {
      requestLog.payload = JSON.stringify(payload, null, 2);
    }

    debugLog('Sending custom drop request', requestLog);

    const response = await fetch(`${API_URL}/claim-custom`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    console.log('📥 Custom claim response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorMessage = await extractBackendError(response);
      errorLog('Custom claim backend request failed', { status: response.status });
      throw new Error(errorMessage);
    }

    const result = await response.json();
    successLog('Custom drop request successful', { success: result.success, txHash: result.txHash });

    if (result.success && result.txHash && shouldUseDivvi(chainId)) {
      setTimeout(() => { reportToDivvi(result.txHash, chainId); }, 100);
    } else if (result.success && result.txHash) {
      debugLog(`Custom claim successful but not reporting to Divvi (unsupported chain: ${chainId})`);
    }

    if (DEBUG_MODE) {
      result.divviDebug = {
        chainSupported: shouldUseDivvi(chainId),
        divviUsed: !!payload.divviReferralData
      };
    }

    return result;
  } catch (error: any) {
    errorLog('Error in claimCustomViaBackend', error);
    console.error('❌ Comprehensive error in claimCustomViaBackend:', {
      error: error.message,
      stack: error.stack,
      userAddress,
      faucetAddress,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}

export async function checkCustomAllocation(
  userAddress: string,
  faucetAddress: string,
  provider: BrowserProvider
): Promise<{ hasAllocation: boolean; amount?: string; error?: string }> {
  try {
    debugLog('Checking custom allocation', { userAddress, faucetAddress });

    if (!provider) {
      throw new Error("Provider not initialized");
    }

    const chainId = await getRobustChainId(provider);

    const { Contract } = await import("ethers");
    const faucetContract = new Contract(faucetAddress, FAUCET_ABI_CUSTOM, provider);

    const hasCustomAmount = await faucetContract.hasCustomClaimAmount(userAddress);

    if (!hasCustomAmount) {
      return { hasAllocation: false };
    }

    const customAmount = await faucetContract.getCustomClaimAmount(userAddress);
    const formattedAmount = customAmount.toString();

    successLog('Custom allocation found', { userAddress, faucetAddress, amount: formattedAmount });

    return { hasAllocation: true, amount: formattedAmount };

  } catch (error: any) {
    errorLog('Error checking custom allocation', error);
    return {
      hasAllocation: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function claimNoCodeViaBackend(
  userAddress: string,
  faucetAddress: string,
  provider: BrowserProvider
): Promise<{ success: boolean; txHash: string; divviDebug?: any }> {
  try {
    debugLog('Input to claimNoCodeViaBackend', { userAddress, faucetAddress });

    if (typeof window === 'undefined' || !window.ethereum) {
      throw new Error("Wallet not detected. Please install MetaMask or another Ethereum wallet in a supported browser.");
    }

    if (!provider) {
      throw new Error("Provider not initialized. Please ensure your wallet is connected.");
    }

    const chainId = await getRobustChainId(provider);

    if (!SUPPORTED_CHAIN_IDS.includes(chainId)) {
      throw new Error(`Unsupported chainId: ${chainId}. Please switch to a supported network: ${SUPPORTED_CHAIN_IDS.join(', ')}`);
    }

    debugLog(`Starting drop process for chainId: ${chainId}`);

    const cleanUserAddress = userAddress.trim();
    const cleanFaucetAddress = faucetAddress.trim();

    console.log('🧹 Cleaned parameters for no-code claim:', {
      userAddress: cleanUserAddress,
      faucetAddress: cleanFaucetAddress,
      chainId,
      divviSupported: shouldUseDivvi(chainId)
    });

    let payload: ClaimPayload = {
      userAddress: cleanUserAddress,
      faucetAddress: cleanFaucetAddress,
      chainId
    };

    if (shouldUseDivvi(chainId)) {
      const divviResult = await processDivviReferralData(chainId, cleanUserAddress);

      if (divviResult.data) {
        payload.divviReferralData = divviResult.data;
        successLog('Added Divvi referral data to payload', {
          length: divviResult.data.length,
          preview: `${divviResult.data.slice(0, 20)}...`
        });
      } else if (divviResult.error) {
        debugLog(`Proceeding without Divvi data: ${divviResult.error}`);
      }
    } else {
      debugLog(`Skipping Divvi integration for unsupported chain: ${chainId}`);
    }

    const requestLog: RequestLogData = {
      userAddress: cleanUserAddress,
      faucetAddress: cleanFaucetAddress,
      chainId,
      hasDivviData: !!payload.divviReferralData,
      divviDataLength: payload.divviReferralData?.length || 0,
      timestamp: new Date().toISOString()
    };

    if (DEBUG_MODE) {
      requestLog.payload = JSON.stringify(payload, null, 2);
    }

    debugLog('Sending drop request without code', requestLog);

    const response = await fetch(`${API_URL}/claim-no-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorMessage = await extractBackendError(response);
      errorLog('claim request failed', { status: response.status });
      throw new Error(errorMessage);
    }

    const result = await response.json();
    successLog('Drop request without code successful', { success: result.success, txHash: result.txHash });

    if (result.success && result.txHash && shouldUseDivvi(chainId)) {
      setTimeout(() => { reportToDivvi(result.txHash, chainId); }, 100);
    } else if (result.success && result.txHash) {
      debugLog(`No-code claim successful but not reporting to Divvi (unsupported chain: ${chainId})`);
    }

    if (DEBUG_MODE) {
      result.divviDebug = {
        chainSupported: shouldUseDivvi(chainId),
        divviUsed: !!payload.divviReferralData
      };
    }

    return result;
  } catch (error: any) {
    errorLog('Error in claimNoCodeViaBackend', error);
    throw error;
  }
}

export async function claimViaBackend(
  userAddress: string,
  faucetAddress: string,
  provider: BrowserProvider,
  secretCode: string
): Promise<{ success: boolean; txHash: string; divviDebug?: any }> {
  try {
    console.log('🚀 Starting claim process...');

    const chainId = await getRobustChainId(provider);

    // Validate parameters with the detected chainId
    const validation = await debugClaimRequest(userAddress, faucetAddress, secretCode, chainId);

    if (!validation.valid) {
      throw new Error(`Invalid request parameters: ${validation.errors.join(', ')}`);
    }

    if (!SUPPORTED_CHAIN_IDS.includes(chainId)) {
      throw new Error(`Unsupported chainId: ${chainId}. Please switch to a supported network: ${SUPPORTED_CHAIN_IDS.join(', ')}`);
    }

    const cleanUserAddress = userAddress.trim();
    const cleanFaucetAddress = faucetAddress.trim();
    const cleanSecretCode = secretCode.trim().toUpperCase();

    console.log('🧹 Cleaned parameters:', {
      userAddress: cleanUserAddress,
      faucetAddress: cleanFaucetAddress,
      secretCode: cleanSecretCode,
      chainId,
      divviSupported: shouldUseDivvi(chainId)
    });

    let claimPayload: ClaimPayload = {
      userAddress: cleanUserAddress,
      faucetAddress: cleanFaucetAddress,
      secretCode: cleanSecretCode,
      chainId
    };

    if (shouldUseDivvi(chainId)) {
      const divviResult = await processDivviReferralData(chainId, cleanUserAddress);

      if (divviResult.data) {
        claimPayload.divviReferralData = divviResult.data;
        successLog('Added Divvi referral data to claim payload', {
          length: divviResult.data.length,
          preview: `${divviResult.data.slice(0, 20)}...`
        });
      } else if (divviResult.error) {
        debugLog(`Proceeding without Divvi data: ${divviResult.error}`);
      }
    } else {
      debugLog(`Skipping Divvi integration for unsupported chain: ${chainId}`);
    }

    console.log('📤 Sending claim request:', {
      ...claimPayload,
      divviReferralData: claimPayload.divviReferralData ? 'Present' : 'Not included'
    });

    const claimResponse = await fetch(`${API_URL}/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(claimPayload),
    });

    console.log('📥 Claim response status:', claimResponse.status, claimResponse.statusText);

    if (!claimResponse.ok) {
      const errorMessage = await extractBackendError(claimResponse);
      throw new Error(errorMessage);
    }

    const claimResult = await claimResponse.json();
    console.log('✅ Claim successful:', claimResult);

    if (claimResult.txHash && shouldUseDivvi(chainId)) {
      setTimeout(() => { reportToDivvi(claimResult.txHash, chainId); }, 100);
    } else if (claimResult.txHash) {
      debugLog(`Claim successful but not reporting to Divvi (unsupported chain: ${chainId})`);
    }

    return {
      success: true,
      txHash: claimResult.txHash,
      divviDebug: {
        claimTx: claimResult.txHash,
        chainSupported: shouldUseDivvi(chainId),
        divviUsed: !!claimPayload.divviReferralData
      }
    };

  } catch (error: any) {
    throw error;
  }
}