// lib/attribution-tag.ts
// ERC-8021 attribution suffix — lets Celo trace transactions back to this app.
// window.location.hostname is browser-only, so this must never be evaluated
// at module scope (Next.js renders "use client" files during SSR too).
import { toDataSuffix, codeFromHostname } from "@celo/attribution-tags";
import type { Hex, Address } from "viem";
import { isMiniPay } from "./minipay";
import { pickFeeCurrency, sendCip64 } from "./fee-currency";

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
// Used as the fallback path when explicit CIP-64 isn't possible.
export const LEGACY_TX = { type: 0 } as const;

/** Wrap a viem tx hash so call sites can keep using tx.hash / tx.wait(). */
function wrapHash(signer: any, hash: string) {
  return {
    hash,
    wait: (confirms = 1) => signer.provider.waitForTransaction(hash, confirms),
  } as unknown as import("ethers").ContractTransactionResponse;
}

/** True for a wallet-side "user cancelled" — must propagate, never trigger a retry send. */
function isUserRejection(err: any): boolean {
  const code = err?.code ?? err?.cause?.code;
  if (code === 4001) return true;
  const msg = String(err?.shortMessage ?? err?.message ?? "").toLowerCase();
  return msg.includes("user rejected") || msg.includes("user denied") || msg.includes("rejected the request");
}

/**
 * Raw tagged send — explicit CIP-64 stablecoin gas in MiniPay, with a
 * legacy-tx fallback (where MiniPay still applies implicit fee abstraction).
 * Applies the attribution suffix internally — do NOT pre-wrap data.
 */
export async function sendTaggedRaw(
  signer: any,
  tx: { to: string; data?: string; value?: bigint },
) {
  const data = withAttribution(tx.data);

  if (isMiniPay()) {
    try {
      const from = (await signer.getAddress()) as Address;
      const feeCurrency = await pickFeeCurrency(from);
      if (feeCurrency) {
        const hash = await sendCip64({
          account: from,
          to: tx.to as Address,
          data: data as Hex,
          value: tx.value,
          feeCurrency,
        });
        return wrapHash(signer, hash);
      }
    } catch (err) {
      // A user cancelling the CIP-64 prompt is a real rejection, not a reason
      // to silently fire a second (legacy) transaction the user never agreed to.
      if (isUserRejection(err)) throw err;
      console.warn("[feeCurrency] CIP-64 send failed, falling back to legacy:", err);
    }
  }

  return signer.sendTransaction({ to: tx.to, data, value: tx.value, ...LEGACY_TX });
}

/**
 * Send an ethers v6 Contract write with the attribution suffix appended,
 * explicit stablecoin feeCurrency in MiniPay, and legacy-type fallback.
 * Use in place of `contract.method(...)` for any state-changing call.
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
  return sendTaggedRaw(signer, {
    to: populated.to,
    data: populated.data,
    value: populated.value,
  });
}