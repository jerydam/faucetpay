// src/components/join-droplist-button.tsx
"use client";

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Users, Loader2 } from "lucide-react";
import { useWallet } from "@/hooks/use-wallet";
import { useToast } from "@/hooks/use-toast";
import { appendDivviReferralData, reportTransactionToDivvi } from "../lib/divvi-integration";
import { Contract } from "ethers";
import { CHECKIN_ABI } from "@/lib/abis";
// --- START: Move Contract Details and Helpers from Head ---

// Smart contract details
const DROPLIST_CONTRACT_ADDRESS = "0xB8De8f37B263324C44FD4874a7FB7A0C59D8C58E";


// Helper function to safely extract error information
const getErrorInfo = (error: unknown): { code?: string | number; message: string } => {
  if (error && typeof error === "object") {
    const errorObj = error as any;
    return {
      code: errorObj.code,
      message: errorObj.message || "Unknown error occurred",
    };
  }
  return {
    message: typeof error === "string" ? error : "Unknown error occurred",
  };
};

// --- END: Contract Details and Helpers ---

export function JoinDroplistButton({
  className,
  size = "sm",
  showLabel = true,
}: {
  className?: string;
  size?: "default" | "sm" | "lg" | "icon";
  showLabel?: boolean;
}) {
  const { address, isConnected, signer, chainId, ensureCorrectNetwork } = useWallet();
  const { toast } = useToast();
  const [isJoiningDroplist, setIsJoiningDroplist] = useState(false);
  const [isDivviSubmitted, setIsDivviSubmitted] = useState(false); // Retained if needed for UI/logic
  const [droplistNotification, setDroplistNotification] = useState<string | null>(null); // Retained if needed for UI/logic

  // Handle joining droplist (Logic moved from Head)
  const handleJoinDroplist = async () => {
    if (!isConnected || !address || !signer) {
      setDroplistNotification("Please connect your wallet first");
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to join the droplist",
        variant: "destructive",
      });
      return;
    }

    // Ensure correct network (Celo, chain ID 42220)
    const isCorrectNetwork = await ensureCorrectNetwork(42220);
    if (!isCorrectNetwork) {
      setDroplistNotification("Please switch to the Celo network to join the droplist");
      toast({
        title: "Incorrect network",
        description: "Please switch to the Celo network (chain ID 42220)",
        variant: "destructive",
      });
      return;
    }

    setIsJoiningDroplist(true);
    setDroplistNotification(null);

    try {
      const contract = new Contract(DROPLIST_CONTRACT_ADDRESS, CHECKIN_ABI, signer);

      // Estimate gas
      let gasLimit: bigint;
      try {
        gasLimit = await contract.droplist.estimateGas();
      } catch (error) {
        console.error('Gas estimation error:', getErrorInfo(error));
        throw new Error('Failed to estimate gas for droplist transaction');
      }

      // Add 20% buffer using BigInt operations
      const gasLimitWithBuffer = (gasLimit * BigInt(120)) / BigInt(100);

      // Prepare transaction data
      const txData = contract.interface.encodeFunctionData("droplist", []);
      const enhancedData = appendDivviReferralData(txData, address as `0x${string}`);

      // Send transaction
      const tx = await signer.sendTransaction({
        to: DROPLIST_CONTRACT_ADDRESS,
        data: enhancedData,
        gasLimit: gasLimitWithBuffer,
      });

      console.log('Transaction sent:', tx.hash);

      // Wait for transaction confirmation
      const receipt = await tx.wait();
      
      // Report to Divvi
      await reportTransactionToDivvi(tx.hash as `0x${string}`, chainId!);

      setDroplistNotification("Successfully joined the droplist!");
      setIsDivviSubmitted(true);
      toast({
        title: "Success",
        description: "You have successfully joined the droplist!",
      });

    } catch (error) {
      console.error('Droplist join error:', getErrorInfo(error));
      const errorInfo = getErrorInfo(error);
      setDroplistNotification(`Failed to join droplist: ${errorInfo.message}`);
      toast({
        title: "Error",
        description: `Failed to join droplist: ${errorInfo.message}`,
        variant: "destructive",
      });
    } finally {
      setIsJoiningDroplist(false);
    }
  };

  return (
    <Button
      onClick={handleJoinDroplist}
      disabled={!isConnected || isJoiningDroplist}
      size={size}
      className={`flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 ${className}`}
    >
      {isJoiningDroplist ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Users className="h-4 w-4" />
      )}
      {showLabel && <span>{isJoiningDroplist ? "Droplisting..." : "Join Droplist"}</span>}
    </Button>
  );
}