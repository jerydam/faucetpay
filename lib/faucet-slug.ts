
const BACKEND = "https://identical-vivi-faucetdrops-41e9c56b.koyeb.app"

// ── Types ──────────────────────────────────────────────────────────────────────

export type FaucetDetailRow = {
  faucet_address: string
  chain_id: number
  network_name: string
  factory_address: string
  factory_type: string           // 'dropcode' | 'droplist' | 'custom'
  faucet_name: string
  slug: string                   // e.g. "social-faucet-ab1234"
  token_address: string
  token_symbol: string
  token_decimals: number
  is_ether: boolean
  balance: string                // raw BigInt string
  claim_amount: string           // raw BigInt string
  start_time: number             // unix timestamp
  end_time: number               // unix timestamp
  is_claim_active: boolean
  is_paused: boolean
  owner_address: string
  use_backend: boolean
  image_url: string
  description: string
  updated_at?: string
}

// ── Slug helpers (must mirror backend Python logic exactly) ────────────────────

export function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")   // strip emoji / punctuation
    .replace(/[\s_]+/g, "-")    // spaces / underscores → hyphen
    .replace(/-+/g, "-")        // collapse consecutive hyphens
    .replace(/^-|-$/g, "")      // trim edges
}

/**
 * Build the canonical slug for a faucet.
 * Mirrors  build_faucet_slug(name, faucet_address)  in main.py
 *
 * "Social Faucet" / "0x...ab1234"  →  "social-faucet-ab1234"
 */
export function buildFaucetSlug(name: string, faucetAddress: string): string {
  const addrSuffix = faucetAddress.slice(-6).toLowerCase()
  return `${nameToSlug(name)}-${addrSuffix}`
}

/** Returns true if the string looks like an EVM 0x address */
export function isAddress(param: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/i.test(param)
}

// ── API fetchers ───────────────────────────────────────────────────────────────

/**
 * Look up a faucet by slug via the backend endpoint.
 * Exact match on the `slug` column — indexed, fast.
 * Returns null on 404 or network error (never throws).
 */
export async function getFaucetBySlug(slug: string): Promise<FaucetDetailRow | null> {
  try {
    const res = await fetch(`${BACKEND}/api/faucet/slug/${encodeURIComponent(slug)}`)
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`${res.status}`)
    return (await res.json()) as FaucetDetailRow
  } catch (err) {
    console.warn(`getFaucetBySlug("${slug}"):`, err)
    return null
  }
}

/**
 * Look up a faucet by its 0x address via the backend.
 * Returns null if not found.
 */
export async function getFaucetByAddress(
  address: string,
  chainId?: number
): Promise<FaucetDetailRow | null> {
  try {
    const res = await fetch(`${BACKEND}/api/faucet/${address.toLowerCase()}`)
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`${res.status}`)
    const row = (await res.json()) as FaucetDetailRow
    if (chainId && row.chain_id !== chainId) return null
    return row
  } catch (err) {
    console.warn(`getFaucetByAddress("${address}"):`, err)
    return null
  }
}

/**
 * Main entry point used by FaucetDetails page.
 *
 * Resolves a URL param (slug OR 0x address) → FaucetDetailRow.
 * After calling this, use row.faucet_address for ALL subsequent API calls.
 *
 * @param param    URL path segment: "social-faucet-ab1234" or "0xABC..."
 * @param chainId  Optional hint (from ?networkId= query param) for 0x lookups
 */
export async function resolveFaucetParam(
  param: string,
  chainId?: number
): Promise<FaucetDetailRow | null> {
  return isAddress(param)
    ? getFaucetByAddress(param, chainId)   // old-style 0x URL (backward compat)
    : getFaucetBySlug(param)               // canonical slug URL
}
