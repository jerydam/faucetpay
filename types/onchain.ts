import { Provider } from "ethers";

export interface OnchainTask {
  id: string;
  action: 'tx_count' | 'hold_balance' | 'hold_nft' | 'wallet_age_and_tx';
  verificationType: string;
  chainId?: number;
  isNative?: boolean;
  targetContractAddress?: string;
  decimals?: number;
  tokenType?: 'ERC721' | 'ERC1155' | 'ERC20';
  tokenId?: string; 
  minAmount?: string | number;
  minTxCount?: number;
  minDays?: number;
  points: number;
}

export interface VerificationResult {
  success: boolean;
  verified: boolean;
  message: string;
  value: any;
}