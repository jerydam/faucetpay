// lib/fee-currency.ts
// Explicit CIP-64 stablecoin gas. MiniPay already applies fee abstraction
// implicitly, but setting feeCurrency ourselves makes it deterministic and
// verifiable on-chain (tx type 0x7b with feeCurrency field).
import { celo } from "viem/chains";
import {
  createWalletClient,
  createPublicClient,
  custom,
  http,
  erc20Abi,
  type Address,
  type Hex,
} from "viem";

// ⚠️ Gotcha: feeCurrency must be a REGISTERED fee currency. 18-decimal cUSD
// is its own fee currency; 6-decimal USDT/USDC must use their ADAPTER
// addresses (not the token address) or the tx is rejected.
export const FEE_TOKENS: {
  symbol: string;
  token: Address;        // ERC-20 to check the user's balance on
  feeCurrency: Address;  // what goes in the feeCurrency field
  decimals: number;
}[] = [
  {
    symbol: "cUSD",
    token: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
    feeCurrency: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
    decimals: 18,
  },
  {
    symbol: "USDT",
    token: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e",
    feeCurrency: "0x0E2A3e05bc9A16F5292A6170456A710cb89C6f72", // USDT adapter
    decimals: 6,
  },
  {
    symbol: "USDC",
    token: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C",
    feeCurrency: "0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B", // USDC adapter
    decimals: 6,
  },
];

const publicClient = createPublicClient({ chain: celo, transport: http() });

// Cache the pick per session — one multicall, not one per transaction.
let cached: { user: string; feeCurrency: Address } | null = null;

/** Pick the fee currency the user can actually pay with (largest balance). */
export async function pickFeeCurrency(user: Address): Promise<Address | undefined> {
  if (cached?.user === user.toLowerCase()) return cached.feeCurrency;
  try {
    const balances = await Promise.all(
      FEE_TOKENS.map(t =>
        publicClient.readContract({
          address: t.token,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [user],
        }).catch(() => 0n)
      )
    );
    // Normalize to 18 decimals so 6-dec tokens compare fairly (all ≈$1 pegs)
    let best = -1, bestBal = 0n;
    balances.forEach((bal, i) => {
      const norm = bal * 10n ** BigInt(18 - FEE_TOKENS[i].decimals);
      if (norm > bestBal) { bestBal = norm; best = i; }
    });
    if (best === -1 || bestBal === 0n) return undefined; // no stablecoins — let wallet decide
    cached = { user: user.toLowerCase(), feeCurrency: FEE_TOKENS[best].feeCurrency };
    return cached.feeCurrency;
  } catch {
    return undefined; // any failure → fall back to implicit MiniPay behavior
  }
}

/** Send a CIP-64 (type 0x7b) transaction via the injected provider. */
export async function sendCip64(params: {
  account: Address;
  to: Address;
  data?: Hex;
  value?: bigint;
  feeCurrency: Address;
}): Promise<Hex> {
  const wallet = createWalletClient({
    chain: celo, // viem's celo chain includes the CIP-64 serializers/formatters
    transport: custom(window.ethereum!),
  });
  return wallet.sendTransaction({
    account: params.account,
    to: params.to,
    data: params.data,
    value: params.value,
    feeCurrency: params.feeCurrency,
  });
}