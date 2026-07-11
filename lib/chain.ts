import {
  createWalletClient,
  createPublicClient,
  custom,
  http,
  type Chain,
} from "viem";

export const CELO_CHAIN_ID = 42220;

export const CELO_CONFIG = {
  id: CELO_CHAIN_ID,
  name: "Celo Mainnet",
  shortName: "Celo",
  rpcUrl: "https://forno.celo.org",
  explorerUrl: "https://celoscan.io",
  explorerName: "CeloScan",
  nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
  contracts: {
    // `||` (not `??`) on purpose — blank-but-declared env vars (e.g. an
    // unfilled .env template) must still fall through to the real address.
    dropsToken: (process.env.NEXT_PUBLIC_DROPS_CONTRACT_CELO ||
      "0x9825670865B896738CF8E6c98d093aD5b40F0A11") as `0x${string}`,
    quizHub: (process.env.NEXT_PUBLIC_QUIZ_HUB_CELO ||
      "0xd73170170E002b45eA4AA51e7E93302D61c30173") as `0x${string}`,
    dropsRedeemPool: (process.env.NEXT_PUBLIC_DROPS_REDEEM_POOL_CELO ||
      "0x636685bCFeEf6Baeb05872f01e69405077eAF633") as `0x${string}`,
    gToken: "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A" as `0x${string}`,
  },
} as const;

// ── Add to lib/chain.ts ──────────────────────────────────────────

export const CELO_QUIZ_FACTORY = (process.env.NEXT_PUBLIC_QUIZ_FACTORY_CELO ||
  "0x45aF94C51188C2f1cBAa060Bd9Ee4a37e416Ed1F") as `0x${string}`;

/**
 * Drop-in replacement for the deleted use-network getNetworkByChainId.
 * PrimeIQ is Celo-only — returns the Celo config with factory addresses,
 * or null for any other chain so callers can show "unsupported network".
 */
export function getNetworkByChainId(chainId?: number | null) {
  if (chainId !== CELO_CHAIN_ID) return null;
  return {
    name: CELO_CONFIG.name,
    chainId: CELO_CHAIN_ID,
    explorerUrl: CELO_CONFIG.explorerUrl,
    nativeCurrency: CELO_CONFIG.nativeCurrency,
    factories: {
      quiz: CELO_QUIZ_FACTORY,
    },
  };
}
/** Kept as a function for drop-in compatibility with existing call sites — always returns Celo. */
export function getChainConfig(_chainId?: number | null) {
  return CELO_CONFIG;
}

/** Hex chain ID for wallet_switchEthereumChain / wallet_addEthereumChain */
export function toHexChainId(): string {
  return `0x${CELO_CHAIN_ID.toString(16)}`;
}

function toAddEthereumChainParams() {
  const c = CELO_CONFIG;
  return {
    chainId: toHexChainId(),
    chainName: c.name,
    nativeCurrency: c.nativeCurrency,
    rpcUrls: [c.rpcUrl],
    blockExplorerUrls: [c.explorerUrl],
  };
}

/**
 * Switch the injected wallet to Celo, adding it if needed.
 * MiniPay is always on Celo already, so this is mostly a no-op safety net
 * for the rare case someone opens the app in a general injected wallet.
 */
export async function ensureCeloNetwork(): Promise<void> {
  if (!window.ethereum) throw new Error("No wallet detected.");
  const current = await (window.ethereum as any).request({ method: "eth_chainId" });
  if (parseInt(current, 16) === CELO_CHAIN_ID) return;

  try {
    await (window.ethereum as any).request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: toHexChainId() }],
    });
  } catch (switchErr: any) {
    if (switchErr.code === 4902) {
      await (window.ethereum as any).request({
        method: "wallet_addEthereumChain",
        params: [toAddEthereumChainParams()],
      });
    } else {
      throw switchErr;
    }
  }
}

/** viem Chain object for Celo, built without importing "viem/chains". */
export function toViemChain(): Chain {
  const cfg = CELO_CONFIG;
  return {
    id:             cfg.id,
    name:           cfg.name,
    nativeCurrency: cfg.nativeCurrency,
    rpcUrls:        { default: { http: [cfg.rpcUrl] } },
    blockExplorers: { default: { name: cfg.explorerName, url: cfg.explorerUrl } },
  } as Chain;
}

/** viem WalletClient using the injected provider (MiniPay). Use for writes. */
export function makeWalletClient() {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("No injected wallet found.");
  }
  return createWalletClient({
    chain:     toViemChain(),
    transport: custom(window.ethereum!),
  });
}

/** viem PublicClient using Celo's RPC. Use for reads and waitForTransactionReceipt. */
export function makePublicClient() {
  return createPublicClient({
    chain:     toViemChain(),
    transport: http(CELO_CONFIG.rpcUrl),
  });
}