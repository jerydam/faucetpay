'use client';
import { useEffect, useState, useCallback, useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Loader2, ExternalLink, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const COLORS = ["#0052FF", "#35D07F", "#FFBB28", "#FF8042", "#8884d8", "#00C49F", "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4"];

const BLOCK_EXPLORERS: Record<string, string> = {
  Celo:      "https://celoscan.io/address/",
  Lisk:      "https://blockscout.lisk.com/address/",
  Arbitrum:  "https://arbiscan.io/address/",
  Base:      "https://basescan.org/address/",
  BNB:       "https://bscscan.com/address/",
};

// Type matching the /api/claims response
type ApiClaim = {
  claimer: string;
  faucet: string;
  faucet_name: string;
  amount: string;
  token_symbol: string;
  token_decimals: number;
  is_ether: boolean;
  time: number;
  network: string;
  chain_id: number;
  transaction_type: string;
};

export function UserClaimsChart() {
  const [claims, setClaims] = useState<ApiClaim[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load raw claims from the API
  const loadClaimsData = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) {
      setRefreshing(true);
    } else if (!claims) {
      setLoading(true);
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://faucetdrops-indexer.onrender.com";
      // Fetching a large limit to ensure accurate aggregation
      const response = await fetch(`${apiUrl}/api/claims?limit=5000`, {
        cache: forceRefresh ? 'no-store' : 'default'
      });

      if (!response.ok) throw new Error(`API returned ${response.status}`);
      
      const json = await response.json();
      if (json.success) setClaims(json.claims);
      
    } catch (error) {
      console.error("Error loading claims for dashboard:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [claims]);

  useEffect(() => {
    loadClaimsData();
    const interval = setInterval(() => loadClaimsData(), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadClaimsData]);

  // ─── AGGREGATE DATA ON THE CLIENT SIDE ───
  const dashboardStats = useMemo(() => {
    if (!claims) return null;

    const faucetMap = new Map<string, { 
      faucetAddress: string; 
      faucetName: string; 
      network: string; 
      totalClaims: number; 
      latestClaimTime: number;
    }>();

    // Group all claims by faucet address
    claims.forEach(claim => {
      const existing = faucetMap.get(claim.faucet);
      if (existing) {
        existing.totalClaims += 1;
        if (claim.time > existing.latestClaimTime) {
          existing.latestClaimTime = claim.time;
        }
      } else {
        faucetMap.set(claim.faucet, {
          faucetAddress: claim.faucet,
          faucetName: claim.faucet_name || `Faucet ${claim.faucet.slice(0, 6)}`,
          network: claim.network,
          totalClaims: 1,
          latestClaimTime: claim.time
        });
      }
    });

    const allFaucets = Array.from(faucetMap.values());

    // 1. Sort by VOLUME for the Pie Chart
    const faucetsByVolume = [...allFaucets].sort((a, b) => b.totalClaims - a.totalClaims);
    
    // Format top 10 for the Pie Chart
    const top10 = faucetsByVolume.slice(0, 10).map(f => ({
      name: f.faucetName,
      value: f.totalClaims,
      faucetAddress: f.faucetAddress,
      network: f.network
    }));

    // Group the rest into "Others"
    const othersCount = faucetsByVolume.slice(10).reduce((sum, f) => sum + f.totalClaims, 0);
    if (othersCount > 0) {
      top10.push({
        name: `Others (${faucetsByVolume.length - 10})`,
        value: othersCount,
        faucetAddress: "others",
        network: "Various"
      });
    }

    // 2. Sort by RECENT ACTIVITY for the Rankings Table
    const faucetsByActivity = [...allFaucets].sort((a, b) => b.latestClaimTime - a.latestClaimTime);
    
    // Add rank numbers based on recent activity
    const faucetRankings = faucetsByActivity.map((f, index) => ({ ...f, rank: index + 1 }));

    return {
      total_claims: claims.length,
      claims_pie_data: top10,
      faucet_rankings: faucetRankings
    };
  }, [claims]);

  if (loading && !claims) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="animate-spin h-8 w-8 text-muted-foreground" />
      </div>
    );
  }

  if (!dashboardStats) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-muted-foreground">Failed to load dashboard data</p>
        <Button onClick={() => loadClaimsData(true)} variant="outline">Try Again</Button>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload?.length) {
      const d = payload[0].payload;
      return (
        <div className="bg-card border border-border p-3 rounded-lg shadow-lg z-50">
          <p className="font-medium text-sm">{d.name}</p>
          <p className="text-sm">Drops: <span className="font-bold">{d.value.toLocaleString()}</span></p>
          {d.network && <p className="text-xs text-muted-foreground">{d.network}</p>}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-row justify-between items-end">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold">{dashboardStats.total_claims.toLocaleString()}</h2>
          <p className="text-muted-foreground text-sm sm:text-base">Total Drops</p>
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => loadClaimsData(true)}
          disabled={loading || refreshing}
          className="flex items-center gap-2 text-sm h-9"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refresh Stats</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
        {/* Pie Chart */}
        <Card>
          <CardHeader className="pb-2 sm:pb-4">
            <CardTitle className="text-base sm:text-lg">Top 10 Faucets by Drops</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Distribution of all claims</CardDescription>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            <ResponsiveContainer width="100%" height={300} className="sm:!h-[380px]">
              <PieChart>
                <Pie
                  data={dashboardStats.claims_pie_data}
                  cx="50%" cy="50%"
                  outerRadius="55%"
                  dataKey="value"
                >
                  {dashboardStats.claims_pie_data.map((_, i) => (
                    <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: "11px" }} iconSize={10} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Rankings Table */}
        <Card>
          <CardHeader className="pb-2 sm:pb-4">
            <CardTitle className="text-base sm:text-lg">All Active Faucets</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Ranked by volume</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[400px] sm:max-h-[460px] overflow-auto">
              <div className="min-w-[420px]">
                <table className="w-full text-xs sm:text-sm">
                  <thead className="border-b sticky top-0 bg-card z-10">
                    <tr>
                      <th className="text-left p-2 sm:p-3 font-medium text-muted-foreground w-10">#</th>
                      <th className="text-left p-2 sm:p-3 font-medium text-muted-foreground">Faucet</th>
                      <th className="text-left p-2 sm:p-3 font-medium text-muted-foreground">Network</th>
                      <th className="text-right p-2 sm:p-3 font-medium text-muted-foreground">Drops</th>
                      <th className="text-right p-2 sm:p-3 font-medium text-muted-foreground hidden sm:table-cell">Latest</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardStats.faucet_rankings.map((item) => {
                      const explorerBase = BLOCK_EXPLORERS[item.network] ?? "https://celoscan.io/address/";
                      return (
                        <tr key={item.faucetAddress} className="border-b hover:bg-muted/50 transition-colors">
                          <td className="p-2 sm:p-3 font-medium text-muted-foreground">#{item.rank}</td>
                          <td className="p-2 sm:p-3">
                            <div className="font-medium truncate max-w-[120px] sm:max-w-[160px]">{item.faucetName}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <span className="font-mono">
                                {item.faucetAddress.slice(0, 5)}…{item.faucetAddress.slice(-3)}
                              </span>
                              <a href={`${explorerBase}${item.faucetAddress}`} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-400 flex-shrink-0">
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          </td>
                          <td className="p-2 sm:p-3">
                            <Badge variant="secondary" className="text-xs px-1.5 py-0.5">{item.network}</Badge>
                          </td>
                          <td className="p-2 sm:p-3 text-right font-medium">{item.totalClaims.toLocaleString()}</td>
                          <td className="p-2 sm:p-3 text-right text-xs text-muted-foreground hidden sm:table-cell">
                            {new Date(item.latestClaimTime * 1000).toLocaleDateString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}