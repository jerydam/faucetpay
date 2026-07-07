// lib/getTokenPrice.ts
import { getGoodDollarPrice } from "./getGoodDollarPrice";
import { CELO_CHAIN_ID,  } from "./chain";

export async function getGTokenPrice(chainId: number): Promise<number> {
  switch (chainId) {
    case CELO_CHAIN_ID:
      return getGoodDollarPrice();       // existing CoinGecko flow
    default:
      throw new Error(`No price feed for chain ${chainId}`);
  }
}