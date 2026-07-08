// lib/getSigner.ts
import { type JsonRpcSigner } from "ethers"

type SignerGetter = () => Promise<JsonRpcSigner | null>

let _getActiveSigner: SignerGetter | null = null
let _readyResolve: (() => void) | null = null
const _ready = new Promise<void>(resolve => { _readyResolve = resolve })

export function registerSignerGetter(fn: SignerGetter) {
  _getActiveSigner = fn
  _readyResolve?.()
  _readyResolve = null
}

export async function getActiveSigner(
  { retries = 3, delayMs = 400, initTimeoutMs = 3000 }:
  { retries?: number; delayMs?: number; initTimeoutMs?: number } = {}
): Promise<JsonRpcSigner> {
  if (!_getActiveSigner) {
    // WalletProvider may not have registered yet — give it a moment
    await Promise.race([_ready, new Promise(r => setTimeout(r, initTimeoutMs))])
  }

  if (!_getActiveSigner) {
    throw new Error("Wallet not initialized — please connect your wallet first")
  }

  for (let attempt = 0; attempt < retries; attempt++) {
    const s = await _getActiveSigner()
    if (s) return s
    if (attempt < retries - 1) await new Promise(r => setTimeout(r, delayMs))
  }

  throw new Error("Could not get signer — wallet not connected or session expired")
}