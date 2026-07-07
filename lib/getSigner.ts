// lib/getSigner.ts
import { type JsonRpcSigner } from "ethers"

type SignerGetter = () => Promise<JsonRpcSigner | null>

let _getActiveSigner: SignerGetter | null = null

export function registerSignerGetter(fn: SignerGetter) {
  _getActiveSigner = fn
}

export async function getActiveSigner(
  { retries = 3, delayMs = 400 }: { retries?: number; delayMs?: number } = {}
): Promise<JsonRpcSigner> {
  if (!_getActiveSigner) {
    throw new Error("Wallet not initialized — please connect your wallet first")
  }

  for (let attempt = 0; attempt < retries; attempt++) {
    const s = await _getActiveSigner()
    if (s) return s
    if (attempt < retries - 1) {
      await new Promise(r => setTimeout(r, delayMs))
    }
  }

  throw new Error("Could not get signer — wallet not connected or session expired")
}