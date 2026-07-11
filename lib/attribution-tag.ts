// lib/attribution-tag.ts
// ERC-8021 attribution suffix — lets Celo trace transactions back to this app.
// window.location.hostname is browser-only, so this must never be evaluated
// at module scope (Next.js renders "use client" files during SSR too).
import { toDataSuffix, codeFromHostname } from "@celo/attribution-tags";
import type { Hex } from "viem";

let cached: Hex | null = null;

export function getAttributionSuffix(): Hex | undefined {
  if (typeof window === "undefined") return undefined;
  if (cached) return cached;
  try {
    cached = toDataSuffix(codeFromHostname(window.location.hostname)) as Hex;
    return cached;
  } catch {
    return undefined;
  }
}

/** Appends the attribution suffix to existing calldata (or returns a bare suffix for value-only sends). */
export function withAttribution(data?: string): string {
  const suffix = getAttributionSuffix();
  if (!suffix) return data ?? "0x";
  return (data ?? "0x") + suffix.slice(2);
}

// MiniPay ignores EIP-1559 fields and expects legacy transactions only.
// Spread this into every sendTransaction call so ethers never auto-populates
// maxFeePerGas / maxPriorityFeePerGas against Celo's post-L2 (OP-stack) RPC.
export const LEGACY_TX = { type: 0 } as const;

/**
 * Send an ethers v6 Contract write with the attribution suffix appended and
 * the transaction pinned to legacy type — the two MiniPay-compliance fields
 * every on-chain write in this app needs. Use in place of `contract.method(...)`
 * whenever the call sends a transaction (not a view/read).
 */
export async function sendTagged(
  contract: import("ethers").Contract,
  method: string,
  args: any[] = [],
  overrides: Record<string, any> = {},
) {
  const populated = await (contract[method] as any).populateTransaction(...args, overrides);
  const signer = contract.runner as any;
  if (!signer?.sendTransaction) throw new Error("Contract has no signer runner to send from.");
  return signer.sendTransaction({
    ...populated,
    data: withAttribution(populated.data),
    ...LEGACY_TX,
  });
}
