"use client"

import { useEffect, useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Coins, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { formatUnits } from "ethers";

// Matches the backend response from /api/claims
type ApiClaim = {
  claimer: string;
  faucet: string;
  faucet_name: string;
  slug?: string; // <-- Populated directly from the database by the backend
  amount: string; 
  token_symbol: string;
  token_decimals: number;
  is_ether: boolean;
  time: number;
  network: string;
  chain_id: number;
  transaction_type: string;
};

export function FaucetList() {
  const { toast } = useToast();
  
  const [claims, setClaims] = useState<ApiClaim[]>([]);
  const [loadingClaims, setLoadingClaims] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  
  const claimsPerPage = isMobile ? 5 : 10;

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const loadClaims = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) setRefreshing(true);
    else setLoadingClaims(true);
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://faucetdrops-indexer.onrender.com";
      const response = await fetch(`${apiUrl}/api/claims?limit=5000`, {
        cache: forceRefresh ? 'no-store' : 'default'
      });

      if (!response.ok) throw new Error(`API returned ${response.status}`);

      const data = await response.json();

      if (data.success) {
        setClaims(data.claims);
        setLastUpdated(data.last_updated);
        setPage(1);

        if (forceRefresh) {
          toast({ title: "Drops refreshed", description: `Loaded recent drops from the database.` });
        }
      }
    } catch (error) {
      console.error("Error loading drops:", error);
      toast({
        title: "Failed to load drops",
        description: error instanceof Error ? error.message : "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setLoadingClaims(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => { loadClaims(); }, [loadClaims]);
  useEffect(() => {
    const interval = setInterval(() => loadClaims(), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadClaims]);
  useEffect(() => { setPage(1); }, [isMobile]);

  const handleRefresh = () => loadClaims(true);

  const totalPages = Math.ceil(claims.length / claimsPerPage);
  const paginatedClaims = claims.slice((page - 1) * claimsPerPage, page * claimsPerPage);

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg sm:text-xl">Recent Drops</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={loadingClaims || refreshing} className="flex items-center gap-2 text-sm">
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setIsExpanded(!isExpanded)} className="flex items-center gap-2 text-sm">
              {isExpanded ? <><ChevronUp className="h-4 w-4" /> Collapse</> : <><ChevronDown className="h-4 w-4" /> View Drops</>}
            </Button>
          </div>
        </div>
        {isExpanded && claims.length > 0 && (
          <div className="text-sm text-muted-foreground">
            Total: {claims.length} drops • Last updated: {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : 'Never'}
          </div>
        )}
      </CardHeader>
      
      {isExpanded && (
        <CardContent>
          {loadingClaims ? (
            <div className="flex justify-center items-center py-10 sm:py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto"></div>
                <p className="mt-4 text-sm sm:text-base">Loading drops history...</p>
              </div>
            </div>
          ) : claims.length === 0 ? (
            <div className="text-center py-8 sm:py-12">
              <Coins className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-lg font-medium mb-2">No Drops Found</h3>
            </div>
          ) : (
            <>
              {/* Mobile View */}
              <div className="block sm:hidden space-y-3">
                {paginatedClaims.map((claim, index) => {
                  const displayName = claim.faucet_name || `Faucet ${claim.faucet.slice(0, 6)}...${claim.faucet.slice(-4)}`;
                  
                  // 👇 TRUTH FROM DATABASE: Use DB slug, fallback to 0x address if DB slug is missing
                  const targetUrlParam = claim.slug || claim.faucet;
                  
                  return (
                    <Card key={`${claim.faucet}-${claim.time}-${index}`} className="p-3">
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between items-start">
                          <span className="text-muted-foreground">Dropee:</span>
                          <span className="font-mono text-right break-all max-w-[150px]">
                            {claim.claimer.slice(0, 6)}...{claim.claimer.slice(-4)}
                          </span>
                        </div>
                        <div className="flex justify-between items-start">
                          <span className="text-muted-foreground">Faucet:</span>
                          <Link href={`/faucet/${targetUrlParam}?networkId=${claim.chain_id}`} className="text-blue-600 hover:underline text-right max-w-[150px] truncate">
                            {displayName}
                          </Link>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Amount:</span>
                          <span className="font-medium">
                            {Number(formatUnits(claim.amount, claim.token_decimals)).toFixed(4)} {claim.token_symbol}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Network:</span>
                          <span className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">{claim.network}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Time:</span>
                          <span className="text-right">{new Date(claim.time * 1000).toLocaleString()}</span>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>

              {/* Desktop Table View */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs sm:text-sm">Dropee</TableHead>
                      <TableHead className="text-xs sm:text-sm">Faucet</TableHead>
                      <TableHead className="text-xs sm:text-sm">Amount</TableHead>
                      <TableHead className="text-xs sm:text-sm">Network</TableHead>
                      <TableHead className="text-xs sm:text-sm">Timestamp</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedClaims.map((claim, index) => {
                      const displayName = claim.faucet_name || `Faucet ${claim.faucet.slice(0, 6)}...${claim.faucet.slice(-4)}`;
                      
                      // 👇 TRUTH FROM DATABASE: Use DB slug, fallback to 0x address if DB slug is missing
                      const targetUrlParam = claim.slug || claim.faucet;
                      
                      return (
                        <TableRow key={`${claim.faucet}-${claim.time}-${index}`}>
                          <TableCell className="text-xs sm:text-sm font-mono">
                            <div className="max-w-[120px] truncate" title={claim.claimer}>{claim.claimer}</div>
                          </TableCell>
                          <TableCell className="text-xs sm:text-sm">
                            <Link href={`/faucet/${targetUrlParam}?networkId=${claim.chain_id}`} className="text-blue-600 hover:underline max-w-[120px] truncate block" title={displayName}>
                              {displayName}
                            </Link>
                          </TableCell>
                          <TableCell className="text-xs sm:text-sm">
                            {Number(formatUnits(claim.amount, claim.token_decimals)).toFixed(4)} {claim.token_symbol}
                          </TableCell>
                          <TableCell className="text-xs sm:text-sm">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 dark:bg-gray-800">{claim.network}</span>
                          </TableCell>
                          <TableCell className="text-xs sm:text-sm">
                            {new Date(claim.time * 1000).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}