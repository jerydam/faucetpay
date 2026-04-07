import { Provider } from "ethers";

export async function findFirstTxBlock(provider: Provider, address: string): Promise<number | null> {
  let low = 0;
  let high = await provider.getBlockNumber();
  let firstBlock: number | null = null;

  const totalNonce = await provider.getTransactionCount(address, 'latest');
  if (totalNonce === 0) return null;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const countAtMid = await provider.getTransactionCount(address, mid);
    
    if (countAtMid > 0) {
      firstBlock = mid;
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }
  return firstBlock;
}