"use client";

import { useWallet } from "@/hooks/use-wallet";
import { useNetwork } from "@/hooks/use-network";
import { useDashboard } from "@/hooks/useDashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Loader2, Zap, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { Network } from "@/hooks/use-network";

// ─── StatusBadge ─────────────────────────────────────────────────────────────

interface StatusBadgeProps {
  loading: boolean;
  error: boolean;
}

const StatusBadge = ({ loading, error }: StatusBadgeProps) => {
  if (loading) return (
    <div className="flex items-center text-xs text-blue-500">
      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
      Loading
    </div>
  );
  if (error) return (
    <div className="flex items-center text-xs text-amber-500">
      <AlertTriangle className="mr-1 h-3 w-3" />
      Issue
    </div>
  );
  return (
    <div className="flex items-center text-xs text-green-500">
      <Zap className="mr-1 h-3 w-3" />
      Online
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

interface NetworkGridProps {
  className?: string;
}

export function NetworkGrid({ className = "" }: NetworkGridProps) {
  const { chainId } = useWallet();
  const { networks } = useNetwork();

  // ✅ Single source of truth — same data as the analytics dashboard
  const { data, loading, error } = useDashboard();

  const currentNetwork = networks.find((n: Network) => n.chainId === chainId);

  // Match by name (case-insensitive) against faucet_data rows
  const currentNetworkFaucets = currentNetwork
    ? (data?.network_faucets ?? []).find(
        (nf) => nf.network.trim().toLowerCase() === currentNetwork.name.trim().toLowerCase()
      )
    : null;

  const totalFaucets = currentNetworkFaucets?.faucets ?? 0;

  return (
    <div className={`space-y-6 ${className}`}>
      {currentNetwork ? (
        <Link href={`/network/${currentNetwork.chainId}`}>
          <Card className="overflow-hidden shadow-lg border-2 transition-all duration-300 ease-in-out hover:shadow-xl cursor-pointer group hover:scale-[1.02] active:scale-[0.99]">
            <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-3">
                <div
                  className="h-8 w-8 rounded-full flex items-center justify-center overflow-hidden"
                  style={{ border: `2px solid ${currentNetwork.color}` }}
                >
                  <img
                    src={currentNetwork.logoUrl}
                    alt={`${currentNetwork.name} Logo`}
                    className="h-full w-full object-contain p-1"
                  />
                </div>
                <CardTitle className="text-lg font-bold truncate text-primary">
                  {currentNetwork.name}
                </CardTitle>
              </div>

              <div className="flex items-center gap-2">
                <StatusBadge loading={loading} error={!!error} />
                {/* Arrow shifts right on hover — signals navigation */}
                <span
                  className="transition-transform duration-200 group-hover:translate-x-1 font-bold"
                  style={{ color: currentNetwork.color }}
                >
                  →
                </span>
              </div>
            </CardHeader>

            <CardContent className="p-4 pt-0 grid grid-cols-2 gap-4 border-t border-dashed">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total Faucets</p>
                <p className="text-2xl font-extrabold text-card-foreground">
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  ) : (
                    totalFaucets
                  )}
                </p>
              </div>
            </CardContent>

            {/* Footer */}
            <div
              className="p-2 text-center text-xs font-medium transition-all duration-200 group-hover:text-white"
              style={{ color: currentNetwork.color }}
            >
              Explore available faucets on this network →
            </div>
          </Card>
        </Link>
      ) : (
        <Card className="p-8 text-center bg-gray-50 dark:bg-gray-900 border-dashed border-2 border-gray-300 dark:border-gray-700">
          <div className="space-y-4">
            <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center mx-auto">
              <Search className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-card-foreground mb-1">
                Network Disconnected
              </h3>
              <p className="text-sm text-muted-foreground">
                Your wallet is not connected to a supported network. Please
                switch networks to see available faucets.
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}