export interface VerificationDisclosures {
  nationality?: string;
  name?: string;
  dateOfBirth?: string | null;
  gender?: string | null;
  minimumAge?: number;
}

export interface VerificationData {
  verified: boolean;
  timestamp: number;
  userAddress: string;
  verificationData?: any;
  disclosures?: VerificationDisclosures;
}

export interface VerificationResult {
  nationality?: string;
  name?: string;
  dateOfBirth?: string;
  gender?: string;
  minimumAge?: number;
}

export interface VerificationResponse {
  status: 'success' | 'error';
  result: boolean;
  message?: string;
  credentialSubject?: any;
  timestamp?: string;
  reason?: string;
  error_code?: string;
  details?: any;
}

export interface VerificationStatusResponse {
  status: 'success' | 'error';
  verified: boolean;
  timestamp?: string;
  attestationId?: string;
  discloseOutput?: any;
  isExpired?: boolean;
  message?: string;
  userId?: string;
  reason?: string;
  error_code?: string;
}

export type VerificationStatus = 'idle' | 'waiting' | 'verified' | 'failed';

export interface SelfAppConfig {
  version: number;
  appName: string;
  scope: string;
  endpoint: string;
  logoBase64: string;
  userId: string;
  endpointType: string;
  userIdType: string;
  userDefinedData: string;
  disclosures: {
    minimumAge: number;
    ofac: boolean;
    excludedCountries: string[];
    nationality: boolean;
    name: boolean;
    dateOfBirth: boolean;
    gender: boolean;
  };
}