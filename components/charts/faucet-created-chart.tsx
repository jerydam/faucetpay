// ─── faucets-created-chart.tsx ────────────────────────────────────────────────
'use client';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useDashboardContext } from "@/components/analytics-dashboard";

const NETWORK_COLORS: Record<string, string> = {
  Celo:      '#35D07F',
  Lisk:      '#4A90D9',
  Arbitrum:  '#28A0F0',
  Base:      '#0052FF',
  BNB:       '#F3BA2F',
 
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const value = payload[0].value;
  const color = NETWORK_COLORS[label] ?? "#0052FF";
  return (
    <div
      className="rounded-xl border border-border/60 shadow-2xl px-4 py-3 min-w-[140px]"
      style={{
        background: "hsl(var(--card))",
        borderLeft: `3px solid ${color}`,
      }}
    >
      <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">{label}</p>
      <p className="text-2xl font-bold" style={{ color }}>{value.toLocaleString()}</p>
      <p className="text-xs text-muted-foreground mt-0.5">faucets deployed</p>
    </div>
  );
};

const CustomBar = (props: any) => {
  const { x, y, width, height, fill, isHovered } = props;
  const radius = 6;
  return (
    <g>
      {/* Glow layer */}
      {isHovered && (
        <rect
          x={x - 4}
          y={y - 4}
          width={width + 8}
          height={height + 4}
          rx={radius + 2}
          fill={fill}
          opacity={0.12}
        />
      )}
      {/* Main bar */}
      <path
        d={`
          M${x + radius},${y}
          H${x + width - radius}
          Q${x + width},${y} ${x + width},${y + radius}
          V${y + height}
          H${x}
          V${y + radius}
          Q${x},${y} ${x + radius},${y}
          Z
        `}
        fill={fill}
        opacity={isHovered ? 1 : 0.82}
        style={{ transition: "opacity 0.2s" }}
      />
      {/* Shimmer highlight */}
      <path
        d={`
          M${x + radius},${y}
          H${x + width - radius}
          Q${x + width},${y} ${x + width},${y + radius}
          V${y + height * 0.4}
          H${x}
          V${y + radius}
          Q${x},${y} ${x + radius},${y}
          Z
        `}
        fill="white"
        opacity={0.08}
      />
    </g>
  );
};

export function FaucetsCreatedChart() {
  const { data, loading } = useDashboardContext();
  const [hoveredNetwork, setHoveredNetwork] = useState<string | null>(null);

  if (loading || !data) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="animate-spin h-8 w-8 text-muted-foreground" />
      </div>
    );
  }

  const sorted = [...data.network_faucets].sort((a, b) => b.faucets - a.faucets);
  const maxVal = sorted[0]?.faucets || 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1">Faucet Distribution</p>
          <h3 className="text-2xl sm:text-3xl font-bold">{data.total_faucets.toLocaleString()}</h3>
          <p className="text-sm text-muted-foreground">across {sorted.length} networks</p>
        </div>

        {/* Mini network legend pills */}
        <div className="flex flex-wrap justify-end gap-1.5 max-w-[200px] sm:max-w-none">
          {sorted.map((net) => (
            <button
              key={net.network}
              onMouseEnter={() => setHoveredNetwork(net.network)}
              onMouseLeave={() => setHoveredNetwork(null)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-full border border-border/60 text-xs transition-all duration-200 hover:border-transparent hover:shadow-sm"
              style={
                hoveredNetwork === net.network
                  ? { backgroundColor: `${NETWORK_COLORS[net.network] ?? "#0052FF"}22`, borderColor: NETWORK_COLORS[net.network] ?? "#0052FF" }
                  : {}
              }
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: NETWORK_COLORS[net.network] ?? "#0052FF" }}
              />
              <span className="text-muted-foreground">{net.network}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Bar chart */}
      <ResponsiveContainer width="100%" height={280}>
        <BarChart
          data={sorted}
          margin={{ top: 12, right: 4, left: -8, bottom: 0 }}
          barCategoryGap="32%"
          onMouseLeave={() => setHoveredNetwork(null)}
        >
          <CartesianGrid
            strokeDasharray="4 4"
            vertical={false}
            stroke="hsl(var(--border))"
            strokeOpacity={0.5}
          />
          <XAxis
            dataKey="network"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))", fontWeight: 500 }}
            interval={0}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            width={28}
          />
          <Tooltip content={<CustomTooltip />} cursor={false} />
          <Bar
            dataKey="faucets"
            shape={(props: any) => (
              <CustomBar
                {...props}
                isHovered={hoveredNetwork === props.network || hoveredNetwork === null ? true : false}
              />
            )}
            onMouseEnter={(d: any) => setHoveredNetwork(d.network)}
            onMouseLeave={() => setHoveredNetwork(null)}
          >
            {sorted.map((entry) => (
              <Cell
                key={entry.network}
                fill={NETWORK_COLORS[entry.network] ?? "#0052FF"}
                opacity={
                  hoveredNetwork === null || hoveredNetwork === entry.network ? 1 : 0.35
                }
                style={{ transition: "opacity 0.25s" }}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Bottom stat strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-border/50">
        {sorted.map((net) => {
          const pct = ((net.faucets / data.total_faucets) * 100).toFixed(1);
          const color = NETWORK_COLORS[net.network] ?? "#0052FF";
          return (
            <div key={net.network} className="flex items-center gap-2.5 px-1">
              <div
                className="h-7 w-1 rounded-full shrink-0"
                style={{ backgroundColor: color }}
              />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">{net.network}</p>
                <p className="text-sm font-bold tabular-nums">
                  {net.faucets.toLocaleString()}
                  <span className="text-xs font-normal text-muted-foreground ml-1">{pct}%</span>
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}