// lib/getGoodDollarPrice.ts

// ─── Correct G$ token address on Celo ────────────────────────────────────────
// Official: https://docs.gooddollar.org/frequently-asked-questions/gooddollar-protocol-and-gusd-token
const G_TOKEN_CELO = "0x62b8b11039fcfe5ab0c56e502b1c372a3d2a9c7a"; // NOT ...462a4

// ─── In-memory cache (60s TTL) ───────────────────────────────────────────────
let _cachedPrice: number | null = null;
let _cachedAt = 0;
const CACHE_TTL_MS = 60_000;

// ─── Source 1: CoinGecko ─────────────────────────────────────────────────────
async function fetchFromCoinGecko(): Promise<number> {
  const res = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=good-dollar&vs_currencies=usd",
    { headers: { Accept: "application/json" } }
  );
  if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
  const data = await res.json();
  if (data?.status?.error_code) throw new Error(`CoinGecko: ${data.status.error_message}`);
  const price = data?.["good-dollar"]?.usd;
  if (typeof price !== "number" || price <= 0) throw new Error(`Bad CoinGecko payload: ${JSON.stringify(data)}`);
  return price;
}

// ─── Source 2: GeckoTerminal — query pool directly ───────────────────────────
// Pool address for G$/CELO on Ubeswap V2 (Celo)
const GT_POOL = "0x25878951ae130014e827e6f54fd3b4cca057a7e8";

async function fetchFromGeckoTerminal(): Promise<number> {
  const res = await fetch(
    `https://api.geckoterminal.com/api/v2/networks/celo/pools/${GT_POOL}`,
    { headers: { Accept: "application/json" } }
  );
  if (!res.ok) throw new Error(`GeckoTerminal HTTP ${res.status}`);
  const data = await res.json();
  // base_token_price_usd is G$ when G$ is the base token in the pool
  const priceStr = data?.data?.attributes?.base_token_price_usd;
  const price = parseFloat(priceStr ?? "");
  if (!priceStr || isNaN(price) || price <= 0) throw new Error(`Bad GeckoTerminal payload: ${JSON.stringify(data)}`);
  return price;
}

// ─── Source 3: DexScreener ───────────────────────────────────────────────────
async function fetchFromDexScreener(): Promise<number> {
  const res = await fetch(
    `https://api.dexscreener.com/latest/dex/tokens/${G_TOKEN_CELO}`,
    { headers: { Accept: "application/json" } }
  );
  if (!res.ok) throw new Error(`DexScreener HTTP ${res.status}`);
  const data = await res.json();
  const pairs: any[] = data?.pairs ?? [];
  // Find the highest-liquidity Celo pair where G$ is the base token
  const best = pairs
    .filter((p) => p.chainId === "celo" && p.baseToken?.address?.toLowerCase() === G_TOKEN_CELO)
    .sort((a, b) => parseFloat(b.liquidity?.usd ?? "0") - parseFloat(a.liquidity?.usd ?? "0"))[0];
  const price = parseFloat(best?.priceUsd ?? "");
  if (!best || isNaN(price) || price <= 0) throw new Error(`DexScreener: no valid Celo pair found`);
  return price;
}

// ─── Public export ────────────────────────────────────────────────────────────
export async function getGoodDollarPrice(): Promise<number> {
  if (_cachedPrice && Date.now() - _cachedAt < CACHE_TTL_MS) {
    return _cachedPrice;
  }

  const sources = [
    { name: "CoinGecko",     fn: fetchFromCoinGecko     },
    { name: "GeckoTerminal", fn: fetchFromGeckoTerminal },
    { name: "DexScreener",   fn: fetchFromDexScreener   },
  ];

  for (const { name, fn } of sources) {
    try {
      const price = await fn();
      console.log(`$G price from ${name}: $${price}`);
      _cachedPrice = price;
      _cachedAt = Date.now();
      return price;
    } catch (err) {
      console.warn(`${name} failed:`, err);
    }
  }

  throw new Error("Could not fetch $G price from any source");
}