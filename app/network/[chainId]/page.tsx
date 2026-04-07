"use client"

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWallet } from "@/hooks/use-wallet";
import { useNetwork, Network } from "@/hooks/use-network";
import { useToast } from "@/hooks/use-toast";
import { buildFaucetSlug } from "@/lib/faucet-slug";
import LoadingPage from "@/components/loading";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FactoryType } from "@/lib/faucet";
import { formatUnits, Contract, ZeroAddress, JsonRpcProvider } from "ethers";
import { Coins, Clock, Search, Filter, SortAsc, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ERC20_ABI } from "@/lib/abis";
import { Header } from "@/components/header";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

// ─── Supabase client ──────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const DEFAULT_FAUCET_IMAGE = "/default.jpeg";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Lightweight row from `network_faucets` table */

interface FaucetMeta {
  faucetAddress: string;
  slug?: string;           // ✅ added
  isClaimActive: boolean;
  isEther: boolean;
  createdAt?: string | number;
  tokenSymbol?: string;
  name?: string;
  owner?: string;
  factoryAddress: string;
  factoryType?: FactoryType;
}

/** Full row from `faucet_details` table */
interface FaucetData {
  faucetAddress: string;
  slug?: string;
  name?: string;
  tokenSymbol?: string;
  tokenDecimals?: number;
  isEther: boolean;
  balance?: bigint;
  claimAmount?: bigint;
  startTime?: string | number;
  endTime?: string | number;
  isClaimActive: boolean;
  token?: string;
  network?: Network;
  createdAt?: string | number;
  description?: string;
  imageUrl?: string;
  owner?: string;
  factoryAddress: string;
  faucetType?: FactoryType;
}

const FILTER_OPTIONS = {
  ALL: "all",
  ACTIVE: "active",
  INACTIVE: "inactive",
  NATIVE: "native",
  ERC20: "erc20",
} as const;

const SORT_OPTIONS = {
  DEFAULT: "default",
  NAME_ASC: "name_asc",
  NAME_DESC: "name_desc",
} as const;

type FilterOption = (typeof FILTER_OPTIONS)[keyof typeof FILTER_OPTIONS];
type SortOption = (typeof SORT_OPTIONS)[keyof typeof SORT_OPTIONS];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getNativeTokenSymbol = (networkName: string): string => {
  switch (networkName) {
    case "Celo": return "CELO";
    case "Lisk": return "ETH";
    case "Arbitrum":
    case "Base":
    case "Ethereum": return "ETH";
    case "BNB": return "BNB";
   
    default: return "ETH";
  }
};

const getDefaultDescription = (networkName: string, ownerAddress: string): string =>
  `This is a faucet on ${networkName} by ${ownerAddress.slice(0, 6)}...${ownerAddress.slice(-4)}`;

// ─── Supabase fetchers ────────────────────────────────────────────────────────

/**
 * Fetches ALL lightweight meta for one chain from `network_faucets`.
 * Used to build the full sorted/filtered list for pagination.
 */
async function fetchAllMetaFromSupabase(chainId: number): Promise<FaucetMeta[]> {
  const { data, error } = await supabase
    .from("network_faucets")
    .select(
      "faucet_address, slug, is_claim_active, is_ether, start_time, token_symbol, faucet_name, owner_address, factory_address, factory_type"
    ) // 👈 Added 'slug' here
    .eq("chain_id", chainId);

  if (error) throw new Error(`network_faucets: ${error.message}`);

  return (data ?? []).map((r) => ({
    faucetAddress:  r.faucet_address,
    isClaimActive:  r.is_claim_active === true || r.is_claim_active === "true" || r.is_claim_active === 1,
    isEther:        r.is_ether === true || r.is_ether === "true" || r.is_ether === 1,
    slug:           r.slug,
    createdAt:      r.start_time,
    tokenSymbol:    r.token_symbol,
    name:           r.faucet_name,
    owner:          r.owner_address,
    factoryAddress: r.factory_address,
    factoryType:    r.factory_type as FactoryType,
  }));
}

/**
 * Fetches full details for a specific page of faucet addresses from `faucet_details`.
 */
async function fetchPageDetailsFromSupabase(addresses: string[]): Promise<Record<string, any>> {
  if (addresses.length === 0) return {};

  const { data, error } = await supabase
    .from("faucet_details")
    .select("*")
    .in("faucet_address", addresses.map((a) => a.toLowerCase()));

  if (error) throw new Error(`faucet_details: ${error.message}`);

  // Index by address for O(1) lookup
  const map: Record<string, any> = {};
  for (const row of data ?? []) {
    map[row.faucet_address.toLowerCase()] = row;
  }
  return map;
}

// ─── Sub-components (unchanged from original) ─────────────────────────────────

function useWindowSize() {
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const handleResize = () =>
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  return windowSize;
}

function usePreviousPage() {
  const router = useRouter();
  const [canGoBack, setCanGoBack] = useState(false);
  useEffect(() => { setCanGoBack(window.history.length > 1); }, []);
  const goBack = useCallback(() => {
    if (canGoBack) router.back(); else router.push("/");
  }, [router, canGoBack]);
  return { goBack, canGoBack };
}

function TokenBalance({
  tokenAddress, tokenSymbol, tokenDecimals, isNativeToken, networkChainId,
}: {
  tokenAddress: string; tokenSymbol: string; tokenDecimals: number;
  isNativeToken: boolean; networkChainId: number;
}) {
  const { provider, address } = useWallet();
  const [balance, setBalance] = useState("0");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBalance = async () => {
      if (!provider || !address || !networkChainId) { setBalance("0"); setLoading(false); return; }
      try {
        setLoading(true);
        let bal: bigint;
        if (isNativeToken) {
          bal = await provider.getBalance(address);
        } else if (tokenAddress === ZeroAddress) {
          bal = BigInt(0);
        } else {
          const contract = new Contract(tokenAddress, ERC20_ABI, provider);
          bal = await contract.balanceOf(address);
        }
        setBalance(Number(formatUnits(bal, tokenDecimals)).toFixed(4));
      } catch { setBalance("0"); }
      finally { setLoading(false); }
    };
    fetchBalance();
  }, [provider, address, tokenAddress, tokenDecimals, isNativeToken, networkChainId]);

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-2 sm:p-3 md:p-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <span className="text-xs sm:text-sm md:text-base font-medium">Your Balance:</span>
          <span className="text-xs sm:text-sm md:text-base font-semibold truncate max-w-full sm:max-w-[180px] md:max-w-[200px]">
            {loading ? "Loading..." : `${balance} ${tokenSymbol}`}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function FaucetCard({ faucet, onNetworkSwitch }: { faucet: FaucetData; onNetworkSwitch: () => Promise<void> }) {
  const { chainId } = useWallet();
  const isOnCorrectNetwork = chainId === faucet.network?.chainId;
  
  const [startCountdown, setStartCountdown] = useState("");
  const [endCountdown, setEndCountdown] = useState("");
  
  // NEW: State to hold the live onchain status
  const [onchainIsActive, setOnchainIsActive] = useState<boolean | null>(null);

  // NEW: Fetch onchain status on component mount
  useEffect(() => {
    let isMounted = true;

    const fetchOnchainStatus = async () => {
      if (!faucet.faucetAddress || !faucet.network?.rpcUrl) {
        if (isMounted) setOnchainIsActive(faucet.isClaimActive);
        return;
      }

      try {
        // Create an independent provider so this works regardless of the user's wallet state
        const safeRpc = Array.isArray(faucet.network.rpcUrl) ? faucet.network.rpcUrl[0] : faucet.network.rpcUrl;
        const rpcProvider = new JsonRpcProvider(safeRpc);

        // Minimal ABI to read the isClaimActive state variable/function
        const abi = ["function isClaimActive() view returns (bool)"];
        const contract = new Contract(faucet.faucetAddress, abi, rpcProvider);

        const active = await contract.isClaimActive();

        if (isMounted) setOnchainIsActive(active);
      } catch (error) {
        console.warn(`Failed to fetch onchain status for ${faucet.faucetAddress}:`, error);
        // Fallback to database value if the RPC call fails
        if (isMounted) setOnchainIsActive(faucet.isClaimActive);
      }
    };

    fetchOnchainStatus();

    return () => {
      isMounted = false;
    };
  }, [faucet.faucetAddress, faucet.network, faucet.isClaimActive]);

  // Use the onchain status if loaded, otherwise fallback to the database status
  const displayIsActive = onchainIsActive !== null ? onchainIsActive : faucet.isClaimActive;

  useEffect(() => {
    const update = () => {
      const now = Date.now();
      const start = Number(faucet.startTime || 0) * 1000;
      const end   = Number(faucet.endTime   || 0) * 1000;

      const fmt = (diff: number) => {
        const d = Math.floor(diff / 86400000);
        const h = Math.floor((diff % 86400000) / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        return `${d}d ${h}h ${m}m`;
      };

      if (!start) setStartCountdown("Inactive");
      else if (start > now) setStartCountdown(`${fmt(start - now)} until active`);
      else setStartCountdown("Already Active");

      // Updated to use displayIsActive
      if (end > now && displayIsActive) setEndCountdown(`${fmt(end - now)} until inactive`);
      else if (end > 0 && end <= now) setEndCountdown("Ended");
      else setEndCountdown("N/A");
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [faucet.startTime, faucet.endTime, displayIsActive]);

  const displayTokenSymbol =
    faucet.tokenSymbol ||
    (faucet.isEther ? getNativeTokenSymbol(faucet.network?.name || "Ethereum") : "TOK");

  return (
    <Card className="relative w-full max-w-[400px] mx-auto">
      <CardHeader className="pb-1 sm:pb-2 px-3 sm:px-4">
        <CardTitle className="text-sm sm:text-base md:text-lg flex items-center justify-between">
          <span className="truncate">{faucet.name || `${displayTokenSymbol} Faucet`}</span>
          <div className="flex items-center gap-2">
            {/* Updated to reflect loading and onchain state */}
            <span className={`text-[10px] sm:text-xs md:text-sm px-1.5 sm:px-2 py-0.5 rounded-full ${
              displayIsActive
                ? "bg-green-500/20 text-green-600 dark:text-green-400"
                : "bg-red-500/20 text-red-600 dark:text-red-400"
            }`}>
              {onchainIsActive === null ? "Loading..." : displayIsActive ? "Active" : "Inactive"}
            </span>
            {faucet.network && (
              <Badge
                style={{ backgroundColor: faucet.network.color }}
                className="text-white text-[10px] sm:text-xs md:text-sm font-medium px-1.5 sm:px-2 py-0.5 sm:py-1"
              >
                {faucet.network.name}
              </Badge>
            )}
          </div>
        </CardTitle>

        <div className="px-3 sm:px-4 pt-2">
          <img
            src={faucet.imageUrl || DEFAULT_FAUCET_IMAGE}
            alt={faucet.name || "Faucet"}
            className="w-full h-32 sm:h-40 object-cover rounded-lg"
            onError={(e) => { e.currentTarget.src = DEFAULT_FAUCET_IMAGE; }}
          />
        </div>

        <div className="px-3 sm:px-4 pb-2">
          <p className="text-xs text-muted-foreground line-clamp-2">
            {faucet.description ||
              (faucet.network && faucet.owner
                ? getDefaultDescription(faucet.network.name, faucet.owner)
                : `A faucet for ${displayTokenSymbol} tokens`)}
          </p>
        </div>

        <CardDescription className="text-[10px] sm:text-xs md:text-sm truncate">
          {faucet.faucetAddress}
        </CardDescription>
      </CardHeader>

      <div className="px-3 sm:px-4 pb-1 sm:pb-2">
        {isOnCorrectNetwork ? (
          <TokenBalance
            tokenAddress={faucet.token || ZeroAddress}
            tokenSymbol={displayTokenSymbol}
            tokenDecimals={faucet.tokenDecimals || 18}
            isNativeToken={faucet.isEther}
            networkChainId={faucet.network?.chainId || 0}
          />
        ) : (
          <Card className="overflow-hidden">
            <CardContent className="p-2 sm:p-3 md:p-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <span className="text-xs sm:text-sm md:text-base font-medium">Balance:</span>
                <Button
                  variant="outline" size="sm" onClick={onNetworkSwitch}
                  className="text-xs sm:text-sm md:text-base h-8 sm:h-9 w-full sm:w-auto"
                >
                  Switch to {faucet.network?.name || "Network"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <CardContent className="pb-1 sm:pb-2 px-3 sm:px-4">
        <div className="space-y-1 sm:space-y-2 text-xs sm:text-sm md:text-base">
          <div className="flex justify-between items-center gap-2">
            <span className="text-muted-foreground">Network:</span>
            <span className="font-medium truncate">{faucet.network?.name || "Unknown"}</span>
          </div>
          <div className="flex justify-between items-center gap-2">
            <span className="text-muted-foreground">Drip Amount:</span>
            <span className="font-medium truncate">
              {faucet.faucetType === "custom" ? (
                "Custom"
              ) : (
                <>
                  {faucet.claimAmount
                    ? Number(formatUnits(faucet.claimAmount, faucet.tokenDecimals || 18)).toFixed(4)
                    : "0"}{" "}
                  {displayTokenSymbol}
                </>
              )}
            </span>
          </div>
          <div className="flex justify-between items-center gap-2">
            <span className="text-muted-foreground">Type:</span>
            <span className="font-medium">{faucet.isEther ? "Native Token" : "ERC20 Token"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
            <span>{startCountdown}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
            <span>{endCountdown}</span>
          </div>
        </div>
      </CardContent>

      <CardFooter className="px-3 sm:px-4">
        <Link 
          href={`/faucet/${faucet.slug || buildFaucetSlug(faucet.name || "faucet", faucet.faucetAddress)}`} 
          className="w-full"
        >
          <Button variant="outline" className="w-full h-8 sm:h-9 md:h-10 text-xs sm:text-sm md:text-base">
            <Coins className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
            View Details
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}

function SearchAndFilterControls({
  searchTerm, setSearchTerm, filterBy, setFilterBy, sortBy, setSortBy, onClearFilters, hasActiveFilters,
}: {
  searchTerm: string; setSearchTerm: (t: string) => void;
  filterBy: FilterOption; setFilterBy: (f: FilterOption) => void;
  sortBy: SortOption; setSortBy: (s: SortOption) => void;
  onClearFilters: () => void; hasActiveFilters: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 sm:gap-4 mb-4 sm:mb-6">
      <div className="relative">
        <div className="flex items-center border border-input rounded-md h-8 sm:h-9 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search faucets by name, symbol, or address..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 h-9 sm:h-10 text-xs sm:text-sm"
          />
          {searchTerm && (
            <Button variant="ghost" size="sm" onClick={() => setSearchTerm("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0">
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        <div className="flex items-center gap-2 flex-1">
          <div className="flex items-center border border-input rounded-md h-8 sm:h-9 px-2 w-full">
            <Filter className="h-4 w-4 text-muted-foreground mr-2" />
            <Select value={filterBy} onValueChange={(v: FilterOption) => setFilterBy(v)}>
              <SelectTrigger className="border-0 shadow-none h-full p-0 text-xs sm:text-sm focus:ring-0">
                <SelectValue placeholder="Filter by..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FILTER_OPTIONS.ALL}>All Faucets</SelectItem>
                <SelectItem value={FILTER_OPTIONS.ACTIVE}>Active Only</SelectItem>
                <SelectItem value={FILTER_OPTIONS.INACTIVE}>Inactive Only</SelectItem>
                <SelectItem value={FILTER_OPTIONS.NATIVE}>Native Tokens</SelectItem>
                <SelectItem value={FILTER_OPTIONS.ERC20}>ERC20 Tokens</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-1">
          <div className="flex items-center border border-input rounded-md h-8 sm:h-9 px-2 w-full">
            <SortAsc className="h-4 w-4 text-muted-foreground mr-2" />
            <Select value={sortBy} onValueChange={(v: SortOption) => setSortBy(v)}>
              <SelectTrigger className="border-0 shadow-none h-full p-0 text-xs sm:text-sm focus:ring-0">
                <SelectValue placeholder="Sort by..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SORT_OPTIONS.DEFAULT}>Default (Active First)</SelectItem>
                <SelectItem value={SORT_OPTIONS.NAME_ASC}>Name A-Z</SelectItem>
                <SelectItem value={SORT_OPTIONS.NAME_DESC}>Name Z-A</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {hasActiveFilters && (
          <Button variant="outline" size="sm" onClick={onClearFilters}
            className="h-8 sm:h-9 text-xs sm:text-sm px-3">
            <X className="h-3 w-3 mr-1" /> Clear
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NetworkFaucets() {
  const { chainId: chainIdStr } = useParams<{ chainId: string }>();
  const router = useRouter();
  const { ensureCorrectNetwork } = useWallet();
  const { networks, setNetwork } = useNetwork();
  const { toast } = useToast();
  const isFirstLoad = useRef(true);
  const [allFaucetsMeta, setAllFaucetsMeta] = useState<FaucetMeta[]>([]);
  const [currentPageDetails, setCurrentPageDetails] = useState<FaucetData[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingPageDetails, setLoadingPageDetails] = useState(false);
  const [page, setPage] = useState(1);
  const [switchingNetwork, setSwitchingNetwork] = useState(false);
  const { width, height } = useWindowSize();

  const [searchTerm, setSearchTerm] = useState("");
  const [filterBy, setFilterBy] = useState<FilterOption>(FILTER_OPTIONS.ALL);
  const [sortBy, setSortBy] = useState<SortOption>(SORT_OPTIONS.DEFAULT);

  const chainId = chainIdStr ? parseInt(chainIdStr, 10) : NaN;
  const network = !isNaN(chainId) ? networks.find((n) => n.chainId === chainId) : undefined;

  // ── Responsive page size ────────────────────────────────────────────────────
  const calculateFaucetsPerPage = useCallback(() => {
    const columns = width < 640 ? 1 : width < 1024 ? 2 : 3;
    const rows = Math.max(1, Math.floor((height * 0.7) / 350));
    return Math.max(3, Math.min(12, rows * columns));
  }, [width, height]);

  const [faucetsPerPage, setFaucetsPerPage] = useState(calculateFaucetsPerPage());

  useEffect(() => {
    const next = calculateFaucetsPerPage();
    if (next !== faucetsPerPage) { setFaucetsPerPage(next); setPage(1); }
  }, [calculateFaucetsPerPage, faucetsPerPage]);

  // ── Client-side filter + sort on the lightweight meta list ─────────────────
  const filteredAndSortedMeta = useMemo(() => {
  let list = [...allFaucetsMeta];

  if (searchTerm.trim()) {
    const s = searchTerm.toLowerCase().trim();
    list = list.filter((f) =>
      (f.name || f.tokenSymbol || "").toLowerCase().includes(s) ||
      (f.tokenSymbol || "").toLowerCase().includes(s) ||
      f.faucetAddress.toLowerCase().includes(s)
    );
  }

  if (filterBy !== FILTER_OPTIONS.ALL) {
    list = list.filter((f) => {
      switch (filterBy) {
        case FILTER_OPTIONS.ACTIVE:   return f.isClaimActive === true;
        case FILTER_OPTIONS.INACTIVE: return f.isClaimActive !== true;
        case FILTER_OPTIONS.NATIVE:   return f.isEther;
        case FILTER_OPTIONS.ERC20:    return !f.isEther;
        default: return true;
      }
    });
  }

  list.sort((a, b) => {
    if (sortBy === SORT_OPTIONS.DEFAULT) {
      const aActive = a.isClaimActive === true;
      const bActive = b.isClaimActive === true;
      if (aActive !== bActive) return aActive ? -1 : 1; // ✅ active first
      return Number(b.createdAt || 0) - Number(a.createdAt || 0);
    }
    const an = (a.name || a.tokenSymbol || "").toLowerCase();
    const bn = (b.name || b.tokenSymbol || "").toLowerCase();
    return sortBy === SORT_OPTIONS.NAME_ASC ? an.localeCompare(bn) : bn.localeCompare(an);
  });

  return list;
}, [allFaucetsMeta, searchTerm, filterBy, sortBy]);

  const loadAllFaucetsMetadata = useCallback(async () => {
    if (!network || isNaN(chainId)) return;
    setLoadingInitial(true);
    try {
      let meta = await fetchAllMetaFromSupabase(chainId);

      // 👇 NEW: Thorough Onchain Check
      // Override the database's isClaimActive status with the live blockchain status
      // so that the frontend's global filter works perfectly.
      if (meta.length > 0 && network.rpcUrl) {
        const safeRpc = Array.isArray(network.rpcUrl) ? network.rpcUrl[0] : network.rpcUrl;
        const provider = new JsonRpcProvider(safeRpc);
        const abi = ["function isClaimActive() view returns (bool)"];

        const verifiedMeta: FaucetMeta[] = [];
        const chunkSize = 10; // Batch requests to avoid RPC rate limits

        for (let i = 0; i < meta.length; i += chunkSize) {
          const chunk = meta.slice(i, i + chunkSize);
          const chunkResults = await Promise.all(
            chunk.map(async (m) => {
              try {
                const contract = new Contract(m.faucetAddress, abi, provider);
                const activeOnchain = await contract.isClaimActive();
                return { ...m, isClaimActive: activeOnchain };
              } catch (err) {
                return m; // Fallback to database value if the RPC fails
              }
            })
          );
          verifiedMeta.push(...chunkResults);
        }
        
        meta = verifiedMeta; // Replace the DB list with our freshly verified onchain list
      }
      // 👆 END NEW

      setAllFaucetsMeta(meta);
      setPage(1);
    } catch (error) {
      console.error("❌ Error loading faucet meta:", error);
      toast({ title: "Failed to load faucet list", variant: "destructive" });
      setAllFaucetsMeta([]);
    } finally {
      setLoadingInitial(false);
    }
  }, [network, chainId, toast]);
  // ── Step 2: load FULL details for current page from Supabase ───────────────
  
const loadCurrentPageDetails = useCallback(async (
  pg: number, perPage: number, sortedMeta: FaucetMeta[]
) => {
  if (!network || isNaN(chainId) || sortedMeta.length === 0) {
    setCurrentPageDetails([]);
    setLoadingPageDetails(false);
    return;
  }

  setLoadingPageDetails(true);
  setCurrentPageDetails([]);

  try {
    const slice = sortedMeta.slice((pg - 1) * perPage, pg * perPage);
    if (slice.length === 0) return;

    const detailMap = await fetchPageDetailsFromSupabase(
      slice.map((m) => m.faucetAddress)
    );

    const faucets: FaucetData[] = slice.map((meta) => {
      const row = detailMap[meta.faucetAddress.toLowerCase()];

      let faucetType: FactoryType = meta.factoryType || "dropcode";
      if (network.factories) {
        if (network.factories.custom?.toLowerCase() === meta.factoryAddress.toLowerCase()) faucetType = "custom";
        else if (network.factories.dropcode?.toLowerCase() === meta.factoryAddress.toLowerCase()) faucetType = "dropcode";
        else if (network.factories.droplist?.toLowerCase() === meta.factoryAddress.toLowerCase()) faucetType = "droplist";
      }

      if (row) {
        return {
          faucetAddress:  row.faucet_address,
          name:           row.faucet_name,
          slug:           row.slug,
          tokenSymbol:    row.token_symbol || (row.is_ether ? getNativeTokenSymbol(network.name) : "TOK"),
          tokenDecimals:  row.token_decimals ?? 18,
          isEther:       row.is_ether === true || row.is_ether === "true" || row.is_ether === 1,
          claimAmount:    row.claim_amount ? BigInt(row.claim_amount) : undefined,
          startTime:      row.start_time,
          endTime:        row.end_time,
          isClaimActive: row.is_claim_active === true || row.is_claim_active === "true" || row.is_claim_active === 1,
          token:          row.token_address,
          network,
          createdAt:      row.start_time,
          description:    row.description || (row.owner_address ? getDefaultDescription(network.name, row.owner_address) : undefined),
          imageUrl:       row.image_url || DEFAULT_FAUCET_IMAGE,
          owner:          row.owner_address,
          factoryAddress: row.factory_address || meta.factoryAddress,
          faucetType,
        } as FaucetData;
      }

      // ✅ Fallback: use meta.slug, NOT row.slug (row is undefined here)
      return {
        faucetAddress:  meta.faucetAddress,
        name:           meta.name,
        slug:           meta.slug,
        tokenSymbol:    meta.tokenSymbol || (meta.isEther ? getNativeTokenSymbol(network.name) : "TOK"),
        tokenDecimals:  18,
        isEther:        meta.isEther,
        isClaimActive:  meta.isClaimActive,
        network,
        createdAt:      meta.createdAt,
        owner:          meta.owner,
        factoryAddress: meta.factoryAddress,
        imageUrl:       DEFAULT_FAUCET_IMAGE,
        faucetType,
      } as FaucetData;
    });

    setCurrentPageDetails(faucets);
  } catch (error) {
    console.error("❌ Error loading page details:", error);
    toast({ title: "Failed to load faucet details", variant: "destructive" });
  } finally {
    setLoadingPageDetails(false);
  }
}, [network, chainId, toast]);

  // ── Effects ─────────────────────────────────────────────────────────────────

  useEffect(() => {
  if (isNaN(chainId) || !network) {
    setLoadingInitial(false);
    toast({
      title: "Network Not Found",
      description: `Chain ID ${chainIdStr || "unknown"} is not supported`,
      variant: "destructive",
    });
    router.push("/");
    return;
  }
  isFirstLoad.current = true; // ✅ reset on network change
  loadAllFaucetsMetadata();
}, [chainId, network, router, toast, loadAllFaucetsMetadata, chainIdStr]);

useEffect(() => {
  if (loadingInitial) return;

  // ✅ On first load after meta arrives, force page=1 to avoid stale page state
  const targetPage = isFirstLoad.current ? 1 : page;
  isFirstLoad.current = false;

  if (filteredAndSortedMeta.length > 0) {
    loadCurrentPageDetails(targetPage, faucetsPerPage, filteredAndSortedMeta);
  } else {
    setCurrentPageDetails([]);
    setLoadingPageDetails(false);
  }
}, [page, faucetsPerPage, filteredAndSortedMeta, loadingInitial, loadCurrentPageDetails]);

useEffect(() => { setPage(1); }, [searchTerm, filterBy, sortBy]);
  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleNetworkSwitch = async (targetChainId: number) => {
    setSwitchingNetwork(true);
    try {
      const targetNetwork = networks.find((n) => n.chainId === targetChainId);
      if (!targetNetwork) throw new Error("Network not found");
      setNetwork(targetNetwork);
      await ensureCorrectNetwork(targetChainId);
    } catch {
      toast({ title: "Network switch failed", variant: "destructive" });
    } finally {
      setSwitchingNetwork(false);
    }
  };

  const handleClearFilters = () => {
    setSearchTerm(""); setFilterBy(FILTER_OPTIONS.ALL);
    setSortBy(SORT_OPTIONS.DEFAULT); setPage(1);
  };

  // ── Pagination helpers ──────────────────────────────────────────────────────

  const hasActiveFilters = searchTerm.trim() !== "" || filterBy !== FILTER_OPTIONS.ALL || sortBy !== SORT_OPTIONS.DEFAULT;
  const totalPages = Math.ceil(filteredAndSortedMeta.length / faucetsPerPage);
  const isLoading  = loadingInitial || loadingPageDetails;

  const getPageButtons = () => {
    const btns: React.ReactNode[] = [];
    const max = 5;
    const start = Math.max(1, page - Math.floor(max / 2));
    const end   = Math.min(totalPages, start + max - 1);

    if (start > 1) {
      btns.push(<Button key={1} variant={1 === page ? "default" : "outline"} size="sm" onClick={() => setPage(1)} className="w-8 h-8 sm:w-9 sm:h-9 text-xs sm:text-sm">1</Button>);
      if (start > 2) btns.push(<span key="s-ellipsis" className="text-xs sm:text-sm">...</span>);
    }
    for (let p = start; p <= end; p++) {
      btns.push(<Button key={p} variant={p === page ? "default" : "outline"} size="sm" onClick={() => setPage(p)} className="w-8 h-8 sm:w-9 sm:h-9 text-xs sm:text-sm">{p}</Button>);
    }
    if (end < totalPages) {
      if (end < totalPages - 1) btns.push(<span key="e-ellipsis" className="text-xs sm:text-sm">...</span>);
      btns.push(<Button key={totalPages} variant={totalPages === page ? "default" : "outline"} size="sm" onClick={() => setPage(totalPages)} className="w-8 h-8 sm:w-9 sm:h-9 text-xs sm:text-sm">{totalPages}</Button>);
    }
    return btns;
  };

  if (loadingInitial) return <LoadingPage />;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="container mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8 space-y-4 sm:space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1">
          <Header
            pageTitle={`Faucets on ${network?.name || "Unknown Network"}`}
            onRefresh={loadAllFaucetsMetadata}
            loading={isLoading}
          />
        </div>
      </div>

      <SearchAndFilterControls
        searchTerm={searchTerm} setSearchTerm={setSearchTerm}
        filterBy={filterBy} setFilterBy={setFilterBy}
        sortBy={sortBy} setSortBy={setSortBy}
        onClearFilters={handleClearFilters} hasActiveFilters={hasActiveFilters}
      />

      {isLoading ? (
        <div className="flex justify-center items-center py-8 sm:py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-b-2 border-primary mx-auto" />
            <p className="mt-3 sm:mt-4 text-xs sm:text-sm md:text-base">
              {loadingInitial ? "Loading faucet list..." : "Fetching page details..."}
            </p>
          </div>
        </div>
      ) : filteredAndSortedMeta.length === 0 ? (
        <Card className="w-full max-w-[400px] mx-auto">
          <CardContent className="flex flex-col items-center justify-center py-6 sm:py-10">
            <Coins className="h-8 w-8 sm:h-12 sm:w-12 text-muted-foreground mb-3 sm:mb-4" />
            <h3 className="text-base sm:text-xl font-medium mb-2">
              {allFaucetsMeta.length === 0 ? "No Faucets Found" : "No Matching Faucets"}
            </h3>
            <p className="text-xs sm:text-base text-muted-foreground mb-4 sm:mb-6 text-center">
              {allFaucetsMeta.length === 0
                ? `No faucets are available on ${network?.name || "this network"} yet.`
                : "Try adjusting your search or filter criteria."}
            </p>
            {allFaucetsMeta.length === 0 ? (
              <Link href="/faucet/create-faucet">
                <Button className="h-9 md:h-10 text-xs sm:text-base">Create Faucet</Button>
              </Link>
            ) : (
              <Button onClick={handleClearFilters} className="h-9 md:h-10 text-xs sm:text-base">
                Clear Filters
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs sm:text-sm text-muted-foreground">
            <span>
              Showing {filteredAndSortedMeta.length} of {allFaucetsMeta.length} faucets on{" "}
              {network?.name || "Unknown Network"}
              {hasActiveFilters && " (filtered)"}
            </span>
            {hasActiveFilters && (
              <div className="flex items-center gap-2">
                <span className="text-primary font-medium">Filters applied</span>
                <Button variant="ghost" size="sm" onClick={handleClearFilters} className="h-6 text-xs px-2">
                  Clear all
                </Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
            {currentPageDetails.map((faucet) => (
              <FaucetCard
                key={`${faucet.faucetAddress}-${network?.chainId || chainId}`}
                faucet={faucet}
                onNetworkSwitch={() => handleNetworkSwitch(faucet.network?.chainId || 0)}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-4 mt-4 sm:mt-6">
              <div className="text-xs sm:text-base text-muted-foreground text-center sm:text-left">
                Showing {(page - 1) * faucetsPerPage + 1} to{" "}
                {Math.min(page * faucetsPerPage, filteredAndSortedMeta.length)} of{" "}
                {filteredAndSortedMeta.length} faucets
              </div>
              <div className="flex items-center gap-1 sm:gap-2 flex-wrap justify-center">
                <Button variant="outline" size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1 || isLoading}
                  className="h-8 sm:h-10 text-xs sm:text-base px-2 sm:px-3">
                  Previous
                </Button>
                {getPageButtons()}
                <Button variant="outline" size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages || isLoading}
                  className="h-8 sm:h-10 text-xs sm:text-base px-2 sm:px-3">
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}