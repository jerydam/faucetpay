import {
    BrowserProvider,
    Contract,
    Interface,
    isAddress,
    parseUnits,
    ZeroAddress,
} from "ethers";

import { ERC20_ABI, QUIZ_FACTORY_ABI, QUIZ_ABI } from "./abis";
import { BACKEND_ADDRESS} from './faucet';

// ✅ Import the helper from your useNetwork file (adjust the path to match your project structure)
import { getNetworkByChainId } from "@/hooks/use-network"; 
import { toast } from "sonner";

// ── Divvi helpers ────────────────────────────────────────────────────────────
const appendDivviReferralData = (data: string): string => data;
const reportTransactionToDivvi = async (_hash: string, _chainId: number) => { };

export const DEFAULT_CLAIM_WINDOW = 172800; // 48 hours

// ── Types ────────────────────────────────────────────────────────────────────
export interface DeployResult {
    contractAddress: string;
    txHash: string;
}

export interface FundResult {
    txHash: string;
}

export interface QuizRewardConfig {
    name: string;
    tokenAddress: string;
    tokenDecimals: number;
    isNativeToken: boolean;
    poolAmount: string;          // human-readable e.g. "10.5"
    claimWindowDuration?: number;
}

// ── 1. Deploy QuizReward (no fund) ───────────────────────────────────────────
export async function deployQuizReward(
    provider: BrowserProvider,
    chainId: number,
    config: Pick<QuizRewardConfig, "name" | "tokenAddress" | "isNativeToken" | "claimWindowDuration">
): Promise<DeployResult> {
    // ✅ Dynamically fetch the factory address using your global network configurations
    const targetNetwork = getNetworkByChainId(chainId);
    const factoryAddress = targetNetwork?.factories?.quiz;

    if (!factoryAddress || !isAddress(factoryAddress)) {
        throw new Error(`No Quiz factory deployed on chain ${chainId}`);
    }
    
    if (!isAddress(BACKEND_ADDRESS) ) {
        throw new Error("Backend wallet addresses not configured (check NEXT_PUBLIC_BACKEND_WALLET_A/B)");
    }

    const signer = await provider.getSigner();
    const factory = new Contract(factoryAddress, QUIZ_FACTORY_ABI, signer);
    const tokenAddr = config.isNativeToken ? ZeroAddress : config.tokenAddress;

    const data = factory.interface.encodeFunctionData("createQuizReward", [
        config.name,
        tokenAddr,
        BACKEND_ADDRESS,
        config.claimWindowDuration ?? DEFAULT_CLAIM_WINDOW,
    ]);

    const tx = await signer.sendTransaction({
        to: factoryAddress,
        data: appendDivviReferralData(data),
    });

    const receipt = await tx.wait();
    if (!receipt) throw new Error("No receipt from deploy tx");
    await reportTransactionToDivvi(tx.hash, chainId);

    const iface = new Interface(QUIZ_FACTORY_ABI);
    let contractAddress = "";
    for (const log of receipt.logs) {
        try {
            const parsed = iface.parseLog(log as any);
            if (parsed?.name === "QuizRewardCreated") {
                contractAddress = parsed.args[0];
                break;
            }
        } catch { }
    }

    if (!contractAddress) throw new Error("QuizRewardCreated event not found in receipt");
    return { contractAddress, txHash: tx.hash };
}


export async function fundQuizReward(
  provider: BrowserProvider,
  chainId: number,
  contractAddress: string,
  reward: {
    tokenAddress: string;
    tokenDecimals: number;
    isNativeToken: boolean; // ← ignored now
    poolAmount: string;
  }
): Promise<FundResult> {
  const signer = await provider.getSigner();
  const signerAddress = await signer.getAddress();

  const quizContract = new Contract(contractAddress, QUIZ_ABI, signer);

  // ── READ REAL FEES (they are percent: 2 + 3 = 5) ──
  const backendFeePct = await quizContract.BACKEND_FEE_PERCENT(); // 2
  const vaultFeePct = await quizContract.VAULT_FEE_PERCENT();     // 3
  const totalFeePct = Number(backendFeePct) + Number(vaultFeePct); // 5

  const baseAmountWei = parseUnits(reward.poolAmount, reward.tokenDecimals);
  const grossAmount = (baseAmountWei * 100n) / BigInt(100 - totalFeePct); // ← correct 5% math

  console.log(`[FUND] Fees: ${totalFeePct}% | Base: ${baseAmountWei} | Gross to send: ${grossAmount}`);

  const isNative = (await quizContract.token()) === ZeroAddress;

  if (isNative) {
    toast.info("Confirm funding transaction in your wallet...");
    const tx = await quizContract.fund(0n, { value: grossAmount }); // pass 0 + send gross in value
    await tx.wait();
    return { txHash: tx.hash };
  } else {
    const tokenContract = new Contract(await quizContract.token(), ERC20_ABI, signer);

    const balance = await tokenContract.balanceOf(signerAddress);
    if (balance < grossAmount) throw new Error("Insufficient token balance for prize + fees.");

    let allowance = await tokenContract.allowance(signerAddress, contractAddress);
    if (allowance < grossAmount) {
      toast.info("Step 1/2: Approving tokens...");
      const approveTx = await tokenContract.approve(contractAddress, grossAmount);
      await approveTx.wait();
      toast.success("Approval confirmed!");

      // Poll for sync
      let polls = 0;
      while (allowance < grossAmount && polls < 10) {
        await new Promise(r => setTimeout(r, 2500));
        allowance = await tokenContract.allowance(signerAddress, contractAddress);
        polls++;
      }
    }

    toast.info("Step 2/2: Funding contract...");
    const tx = await quizContract.fund(grossAmount);
    await tx.wait();
    return { txHash: tx.hash };
  }
}


export async function getContractFundedStatus(
    provider: BrowserProvider,
    contractAddress: string,
    // These params are kept for compatibility but ignored
    _tokenAddress: string,
    _tokenDecimals: number,
    _isNativeToken: boolean,
    requiredAmount: string
): Promise<{ isFunded: boolean; balance: string; balanceRaw: bigint }> {
    if (!contractAddress || !isAddress(contractAddress)) {
        return { isFunded: false, balance: "0", balanceRaw: 0n };
    }

    try {
        const quizContract = new Contract(contractAddress, QUIZ_ABI, provider);
        const contractToken = await quizContract.token();
        const isNative = contractToken === ZeroAddress;

        console.log(`[FUNDED CHECK] Contract token: ${contractToken} → ${isNative ? "NATIVE" : "ERC20"}`);

        let balanceBig: bigint;
        if (isNative) {
            balanceBig = await provider.getBalance(contractAddress);
        } else {
            const tokenContract = new Contract(contractToken, ERC20_ABI, provider);
            balanceBig = await tokenContract.balanceOf(contractAddress);
        }

        const required = parseUnits(requiredAmount || "0", _tokenDecimals);
        const balanceFormatted = (Number(balanceBig) / 10 ** _tokenDecimals).toFixed(4);

        const isFunded = balanceBig >= required && balanceBig > 0n;

        console.log(`[FUNDED CHECK] Required: ${required}, Actual balance: ${balanceBig} → Funded: ${isFunded}`);

        return {
            isFunded,
            balance: balanceFormatted,
            balanceRaw: balanceBig,
        };
    } catch (e) {
        console.error("Funded status check failed:", e);
        return { isFunded: false, balance: "0", balanceRaw: 0n };
    }
}