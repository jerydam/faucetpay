import {
    JsonRpcSigner,
    Contract,
    Interface,
    isAddress,
    parseUnits,
    ZeroAddress,
} from "ethers";

import { ERC20_ABI, QUIZ_FACTORY_ABI, QUIZ_ABI } from "./abis";

import { getNetworkByChainId } from "@/lib/chain";

import { toast } from "sonner";
import { withAttribution, LEGACY_TX } from "./attribution-tag";

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
    poolAmount: string;
    claimWindowDuration?: number;
}

const BACKEND_ADDRESS = process.env.NEXT_PUBLIC_BACKEND_WALLET;

// ── 1. Deploy QuizReward ──────────────────────────────────────────────────────
export async function deployQuizReward(
    signer: JsonRpcSigner,
    chainId: number,
    config: Pick<QuizRewardConfig, "name" | "tokenAddress" | "isNativeToken" | "claimWindowDuration">
): Promise<DeployResult> {
    const targetNetwork = getNetworkByChainId(chainId);
    const factoryAddress = targetNetwork?.factories?.quiz;

    if (!factoryAddress || !isAddress(factoryAddress)) {
        throw new Error(`No Quiz factory deployed on chain ${chainId}`);
    }

    if (!isAddress(BACKEND_ADDRESS)) {
        throw new Error("Backend wallet addresses not configured (check NEXT_PUBLIC_BACKEND_WALLET)");
    }

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
        data: withAttribution(data),
        ...LEGACY_TX,
    });

    const receipt = await tx.wait();
    if (!receipt) throw new Error("No receipt from deploy tx");

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

// ── 2. Fund QuizReward ───────────────────────────────────────────────────────
export async function fundQuizReward(
    signer: JsonRpcSigner,
    chainId: number,
    contractAddress: string,
    reward: {
        tokenAddress: string;
        tokenDecimals: number;
        isNativeToken: boolean;
        poolAmount: string;
    }
): Promise<FundResult> {
    const signerAddress = await signer.getAddress();
    const quizContract = new Contract(contractAddress, QUIZ_ABI, signer);

    const backendFeePct = await quizContract.BACKEND_FEE_PERCENT();
    const vaultFeePct = await quizContract.VAULT_FEE_PERCENT();
    const totalFeePct = Number(backendFeePct) + Number(vaultFeePct);

    const baseAmountWei = parseUnits(reward.poolAmount, reward.tokenDecimals);
    const grossAmount = (baseAmountWei * 100n) / BigInt(100 - totalFeePct);

    const isNative = (await quizContract.token()) === ZeroAddress;

    if (isNative) {
        toast.info("Confirm funding transaction in your wallet...");
        const data = quizContract.interface.encodeFunctionData("fund", [0n]);
        const tx = await signer.sendTransaction({
            to: contractAddress,
            data: withAttribution(data),
            value: grossAmount,
            ...LEGACY_TX,
        });
        await tx.wait();
        return { txHash: tx.hash };
    } else {
        const tokenContract = new Contract(await quizContract.token(), ERC20_ABI, signer);

        const balance = await tokenContract.balanceOf(signerAddress);
        if (balance < grossAmount) throw new Error("Insufficient token balance for prize + fees.");

        let allowance = await tokenContract.allowance(signerAddress, contractAddress);
        if (allowance < grossAmount) {
            toast.info("Step 1/2: Approving tokens...");
            const approveData = tokenContract.interface.encodeFunctionData("approve", [contractAddress, grossAmount]);
            const approveTx = await signer.sendTransaction({
                to: await quizContract.token(),
                data: withAttribution(approveData),
                ...LEGACY_TX,
            });
            await approveTx.wait();
            toast.success("Approval confirmed!");

            let polls = 0;
            while (allowance < grossAmount && polls < 10) {
                await new Promise(r => setTimeout(r, 2500));
                allowance = await tokenContract.allowance(signerAddress, contractAddress);
                polls++;
            }
        }

        toast.info("Step 2/2: Funding contract...");
        const fundData = quizContract.interface.encodeFunctionData("fund", [grossAmount]);
        const tx = await signer.sendTransaction({
            to: contractAddress,
            data: withAttribution(fundData),
            ...LEGACY_TX,
        });
        await tx.wait();
        return { txHash: tx.hash };
    }
}

// ── 3. Check funded status ───────────────────────────────────────────────────
export async function getContractFundedStatus(
    signer: JsonRpcSigner,
    contractAddress: string,
    _tokenAddress: string,
    _tokenDecimals: number,
    _isNativeToken: boolean,
    requiredAmount: string
): Promise<{ isFunded: boolean; balance: string; balanceRaw: bigint }> {
    if (!contractAddress || !isAddress(contractAddress)) {
        return { isFunded: false, balance: "0", balanceRaw: 0n };
    }

    try {
        const provider = signer.provider;
        if (!provider) return { isFunded: false, balance: "0", balanceRaw: 0n };

        const quizContract = new Contract(contractAddress, QUIZ_ABI, signer);
        const contractToken = await quizContract.token();
        const isNative = contractToken === ZeroAddress;

        let balanceBig: bigint;
        if (isNative) {
            balanceBig = await provider.getBalance(contractAddress);
        } else {
            const tokenContract = new Contract(contractToken, ERC20_ABI, signer);
            balanceBig = await tokenContract.balanceOf(contractAddress);
        }

        const required = parseUnits(requiredAmount || "0", _tokenDecimals);
        const balanceFormatted = (Number(balanceBig) / 10 ** _tokenDecimals).toFixed(4);
        const isFunded = balanceBig >= required && balanceBig > 0n;

        return { isFunded, balance: balanceFormatted, balanceRaw: balanceBig };
    } catch (e) {
        console.error("Funded status check failed:", e);
        return { isFunded: false, balance: "0", balanceRaw: 0n };
    }
}