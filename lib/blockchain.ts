import { 
  createPublicClient, 
  http, 
  parseAbi, 
  formatUnits, 
  Address, 
  Chain 
} from 'viem';
import { mainnet, polygon, optimism, arbitrum } from 'viem/chains';

// 1. Define Supported Chains & Clients
const chainMap: Record<number, Chain> = {
  1: mainnet,
  137: polygon,
  10: optimism,
  42161: arbitrum,
};

// 2. Define Verification Types
type VerificationType = 'BALANCE' | 'NFT' | 'TX_COUNT' | 'WALLET_AGE';

interface BaseRequest {
  wallet: Address;
  chainId: number;
}

interface BalanceCheck extends BaseRequest {
  type: 'BALANCE';
  tokenAddress: Address;
  minAmount: string; // Human readable amount (e.g. "10.5")
  decimals?: number; // Default 18
}

interface NFTCheck extends BaseRequest {
  type: 'NFT';
  contractAddress: Address;
}

interface TxCountCheck extends BaseRequest {
  type: 'TX_COUNT';
  minTxCount: number;
}

interface AgeCheck extends BaseRequest {
  type: 'WALLET_AGE';
  minDaysOld: number;
}

type VerificationRequest = BalanceCheck | NFTCheck | TxCountCheck | AgeCheck;

export class VerificationEngine {
  
  // Helper: Get Client for specific chain
  private getClient(chainId: number) {
    const chain = chainMap[chainId];
    if (!chain) throw new Error(`Chain ID ${chainId} not supported`);
    
    return createPublicClient({
      chain,
      transport: http() // Uses default public RPCs. Replace with Alchemy/Infura for production.
    });
  }

  // MAIN ENTRY POINT
  async verify(request: VerificationRequest): Promise<boolean> {
    switch (request.type) {
      case 'BALANCE':
        return this.verifyTokenBalance(request);
      case 'NFT':
        return this.verifyNftOwnership(request);
      case 'TX_COUNT':
        return this.verifyTxCount(request);
      case 'WALLET_AGE':
        return this.verifyWalletAge(request);
      default:
        throw new Error('Unknown verification type');
    }
  }

  // ---------------------------------------------------------
  // 1. Token Balance Check (ERC20)
  // ---------------------------------------------------------
  private async verifyTokenBalance(req: BalanceCheck): Promise<boolean> {
    const client = this.getClient(req.chainId);
    const abi = parseAbi(['function balanceOf(address owner) view returns (uint256)']);

    const balance = await client.readContract({
      address: req.tokenAddress,
      abi: abi,
      functionName: 'balanceOf',
      args: [req.wallet],
    });

    const decimals = req.decimals || 18;
    const formattedBalance = Number(formatUnits(balance, decimals));
    
    return formattedBalance >= Number(req.minAmount);
  }

  // ---------------------------------------------------------
  // 2. NFT Ownership Check (ERC721)
  // ---------------------------------------------------------
  private async verifyNftOwnership(req: NFTCheck): Promise<boolean> {
    const client = this.getClient(req.chainId);
    // balanceOf is safer than ownerOf because you don't need a specific TokenID
    const abi = parseAbi(['function balanceOf(address owner) view returns (uint256)']);

    try {
      const balance = await client.readContract({
        address: req.contractAddress,
        abi: abi,
        functionName: 'balanceOf',
        args: [req.wallet],
      });

      return balance > 0n; // Returns true if they hold at least 1
    } catch (e) {
      console.error("Failed to check NFT balance", e);
      return false;
    }
  }

  // ---------------------------------------------------------
  // 3. Transaction Count Check (Nonce)
  // ---------------------------------------------------------
  private async verifyTxCount(req: TxCountCheck): Promise<boolean> {
    const client = this.getClient(req.chainId);
    const count = await client.getTransactionCount({ address: req.wallet });
    
    return count >= req.minTxCount;
  }

  // ---------------------------------------------------------
  // 4. Wallet Age Check (First Transaction)
  // ---------------------------------------------------------
  private async verifyWalletAge(req: AgeCheck): Promise<boolean> {
    // NOTE: True "First TX" is hard via pure RPC without scanning millions of blocks.
    // OPTIMIZATION: We check if the nonce was 0 at a block N days ago.
    // If nonce > 0 at that past block, the wallet is older than N days.
    
    const client = this.getClient(req.chainId);
    const currentBlock = await client.getBlockNumber();
    
    // Estimate blocks per day (Ethereum ~12s = 7200 blocks/day)
    // Adjust this constant based on the specific chain block time
    const BLOCKS_PER_DAY = 7200n; 
    const blocksAgo = BLOCKS_PER_DAY * BigInt(req.minDaysOld);
    const targetBlock = currentBlock - blocksAgo;

    if (targetBlock < 0n) return true; // Chain is younger than the request, effectively impossible check

    try {
      const nonceAtPastBlock = await client.getTransactionCount({
        address: req.wallet,
        blockNumber: targetBlock
      });

      // If nonce was already > 0 "minDaysOld" ago, the wallet was active back then.
      return nonceAtPastBlock > 0;
    } catch (e) {
      // If the node prunes history, this might fail.
      console.warn("Could not fetch historical block. Standard RPC nodes might prune data.");
      return false;
    }
  }
}
async function main() {
  const engine = new VerificationEngine();
  const userWallet = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'; // vitalik.eth

  // 1. Check if user holds at least 100 USDC on Ethereum Mainnet
  const hasTokens = await engine.verify({
    type: 'BALANCE',
    chainId: 1,
    wallet: userWallet,
    tokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
    minAmount: '100',
    decimals: 6
  });
  console.log(`Has Tokens: ${hasTokens}`);

  // 2. Check if user owns a specific NFT (e.g., BAYC)
  const ownsNFT = await engine.verify({
    type: 'NFT',
    chainId: 1,
    wallet: userWallet,
    contractAddress: '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D'
  });
  console.log(`Owns NFT: ${ownsNFT}`);

  // 3. Check if user is a "Power User" (Has > 50 transactions)
  const isPowerUser = await engine.verify({
    type: 'TX_COUNT',
    chainId: 1,
    wallet: userWallet,
    minTxCount: 50
  });
  console.log(`Is Power User: ${isPowerUser}`);
}

main();