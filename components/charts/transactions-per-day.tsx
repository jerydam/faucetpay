'use client';

import { Loader2, Activity } from "lucide-react";
import { useDashboardContext } from "@/components/analytics-dashboard";

export function TransactionsPerDayChart() {
  const { data, loading } = useDashboardContext();

  if (loading || !data) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="animate-spin h-8 w-8 text-muted-foreground" />
      </div>
    );
  }

  const total = data.total_transactions || 1;
  const sorted = [...data.network_transactions].sort(
    (a, b) => b.totalTransactions - a.totalTransactions
  );

  // SVG Donut Chart Math
  const radius = 56;
  const strokeWidth = 14;
  const circumference = 2 * Math.PI * radius;
  let currentOffset = 0;

  return (
    <div className="flex flex-col md:flex-row gap-8 items-center md:items-stretch">
      
      {/* Left: Orbital Gauge Chart */}
      <div className="relative flex flex-col items-center justify-center shrink-0 w-48 h-48 md:w-56 md:h-56">
        {/* Decorative background glow */}
        <div className="absolute inset-0 bg-primary/5 rounded-full blur-2xl pointer-events-none" />
        
        <svg viewBox="0 0 160 160" className="w-full h-full -rotate-90 relative z-10 filter drop-shadow-md">
          {/* Base Track */}
          <circle
            cx="80"
            cy="80"
            r={radius}
            fill="transparent"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-muted/20"
          />
          {/* Data Slices */}
          {sorted.map((net) => {
            const pct = net.totalTransactions / total;
            const strokeLength = pct * circumference;
            const dashOffset = -currentOffset;
            
            // Add a small gap between segments unless it's the only one
            const gap = sorted.length > 1 ? 3 : 0; 
            const visibleLength = Math.max(0, strokeLength - gap);

            currentOffset += strokeLength;

            return (
              <circle
                key={net.name}
                cx="80"
                cy="80"
                r={radius}
                fill="transparent"
                stroke={net.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${visibleLength} ${circumference}`}
                strokeDashoffset={dashOffset}
                className="transition-all duration-1000 ease-out hover:opacity-80 cursor-crosshair"
              >
                <title>{`${net.name}: ${((pct) * 100).toFixed(1)}%`}</title>
              </circle>
            );
          })}
        </svg>

        {/* Center Metric */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <Activity className="h-4 w-4 text-muted-foreground mb-1 opacity-50" />
          <span className="text-2xl md:text-3xl font-black tracking-tighter">
            {total >= 10000 ? `${(total / 1000).toFixed(1)}k` : total.toLocaleString()}
          </span>
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
            Total Txns
          </span>
        </div>
      </div>

      {/* Right: Frosted Data Matrix (Leaderboard) */}
      <div className="flex-1 w-full flex flex-col gap-3">
        {sorted.map((net, i) => {
          const pct = ((net.totalTransactions / total) * 100).toFixed(1);
          const isTop = i === 0;

          return (
            <div
              key={net.name}
              className={`group relative flex items-center justify-between p-3.5 rounded-xl border bg-background overflow-hidden transition-all duration-300 hover:shadow-md ${
                isTop ? 'shadow-sm' : ''
              }`}
              style={{
                borderColor: isTop ? `${net.color}40` : 'var(--border)',
              }}
            >
              {/* Subtle hover background glow */}
              <div 
                className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-300"
                style={{ backgroundColor: net.color }} 
              />
              
              <div className="flex items-center gap-3.5 relative z-10">
                {/* Rank & Color Pill */}
                <div className="flex items-center gap-2">
                  <span className="w-4 text-center text-xs font-bold text-muted-foreground/50">
                    {i + 1}
                  </span>
                  <div 
                    className="w-1.5 h-8 rounded-full shadow-inner" 
                    style={{ backgroundColor: net.color }} 
                  />
                </div>

                {/* Network Info */}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">{net.name}</span>
                    
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs font-medium text-muted-foreground">
                      {pct}% Dominance
                    </span>
                  </div>
                </div>
              </div>

              {/* Transaction Count */}
              <div className="relative z-10 text-right">
                <p className="font-bold tabular-nums text-sm">
                  {net.totalTransactions.toLocaleString()}
                </p>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-0.5">
                  Txns
                </p>
              </div>
            </div>
          );
        })}
      </div>
      
    </div>
  );
}