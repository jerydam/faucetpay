import type { VerificationStatusResponse } from '@/types/verification';

/**
 * Check if a user is verified by calling the verification status API
 */
export async function checkVerificationStatus(userId: string): Promise<VerificationStatusResponse> {
  try {
    const response = await fetch(`/api/verify/status/${userId}`);
    const data: VerificationStatusResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error checking verification status:', error);
    return {
      status: 'error',
      verified: false,
      reason: 'Network error',
      error_code: 'NETWORK_ERROR',
    };
  }
}

/**
 * Check if user is verified from localStorage (quick check)
 */
export function checkLocalVerification(userId: string): boolean {
  if (typeof window === 'undefined') return false;
  
  try {
    const stored = localStorage.getItem(`verification_${userId.toLowerCase()}`);
    if (stored) {
      const data = JSON.parse(stored);
      if (data.verified && data.timestamp) {
        // Check if verification is not too old (30 days)
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        return data.timestamp > thirtyDaysAgo;
      }
    }
  } catch (error) {
    console.error('Error checking local verification:', error);
  }
  
  return false;
}

/**
 * Clear local verification data
 */
export function clearLocalVerification(userId: string): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem(`verification_${userId.toLowerCase()}`);
  } catch (error) {
    console.error('Error clearing local verification:', error);
  }
}

/**
 * Format wallet address for display
 */
export function formatAddress(address: string): string {
  return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "";
}

/**
 * Format timestamp for display
 */
export function formatVerificationDate(timestamp: number | string): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Validate Ethereum address format
 */
export function isValidEthereumAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Hook for verification status (if using React hooks)
 */
export function useVerificationStatus(userId: string | undefined) {
  const [isVerified, setIsVerified] = React.useState<boolean>(false);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [verificationData, setVerificationData] = React.useState<VerificationStatusResponse | null>(null);

  React.useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    // First check localStorage for quick result
    const localVerified = checkLocalVerification(userId);
    setIsVerified(localVerified);

    // Then check server for authoritative result
    checkVerificationStatus(userId).then((data) => {
      setVerificationData(data);
      setIsVerified(data.verified);
      setIsLoading(false);
    });
  }, [userId]);

  return { isVerified, isLoading, verificationData };
}

// Export React import for the hook
import React from 'react';