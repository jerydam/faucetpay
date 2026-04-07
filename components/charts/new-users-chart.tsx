'use client';

import { useState, useMemo } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Loader2, TrendingUp, TrendingDown, Users, BarChart2, Activity, AreaChart as AreaIcon } from "lucide-react";
import { useDashboardContext } from "@/components/analytics-dashboard";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────
type ChartMode = "area" | "bar" | "line";
type TimeRange = "7d" | "30d" | "90d" | "all";

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card/95 backdrop-blur-md px-4 py-3 shadow-2xl">
      <p className="text-xs font-medium text-muted-foreground mb-2">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-primary" />
          <span className="text-xs text-muted-foreground">{p.name}:</span>
          <span className="text-xs font-bold text-foreground">{p.value?.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Custom X Axis Tick ───────────────────────────────────────────────────────
const CustomXTick = ({ x, y, payload }: any) => (
  <text x={x} y={y + 12} textAnchor="middle" fontSize={10} fill="hsl(var(--muted-foreground))">
    {payload.value}
  </text>
);

// ─── Chart Mode Button ────────────────────────────────────────────────────────
function ModeBtn({ active, onClick, icon: Icon, label }: {
  active: boolean; onClick: () => void; icon: any; label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function NewUsersChart() {
  const { data, loading } = useDashboardContext();
  const [mode, setMode] = useState<ChartMode>("area");
  const [range, setRange] = useState<TimeRange>("30d");

  // ── Slice data by time range ──────────────────────────────────────────────
  const chartData = useMemo(() => {
    if (!data?.users_chart) return [];
    const all = data.users_chart;
    const limits: Record<TimeRange, number> = { "7d": 7, "30d": 30, "90d": 90, "all": Infinity };
    const limit = limits[range];
    return all.slice(-Math.min(limit, all.length));
  }, [data, range]);

  // ── Derived stats ─────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!chartData.length) return null;
    const total  = chartData.reduce((s, d) => s + (d.newUsers ?? 0), 0);
    const half   = Math.floor(chartData.length / 2);
    const first  = chartData.slice(0, half).reduce((s, d) => s + (d.newUsers ?? 0), 0);
    const second = chartData.slice(half).reduce((s, d) => s + (d.newUsers ?? 0), 0);
    const delta  = first > 0 ? ((second - first) / first) * 100 : 0;
    const peak   = Math.max(...chartData.map(d => d.newUsers ?? 0));
    const avg    = total / chartData.length;
    return { total, delta, peak, avg };
  }, [chartData]);

  const avgValue = stats?.avg ?? 0;

  if (loading || !data) {
    return (
      <div className="flex justify-center items-center h-64 rounded-2xl bg-card border border-border">
        <Loader2 className="animate-spin h-8 w-8 text-primary" />
      </div>
    );
  }

  const commonProps = {
    data: chartData,
    margin: { top: 12, right: 8, left: -16, bottom: 0 },
  };

  const sharedAxis = {
    xAxis: <XAxis dataKey="date" tick={<CustomXTick />} axisLine={false} tickLine={false} />,
    yAxis: <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={40} />,
    grid:  <CartesianGrid strokeDasharray="4 4" stroke="hsl(var(--border))" vertical={false} />,
    ref:   <ReferenceLine
             y={avgValue}
             stroke="hsl(var(--muted-foreground))"
             strokeOpacity={0.4}
             strokeDasharray="6 3"
             label={{ value: "avg", position: "insideTopRight", fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
           />,
  };

  return (
    <div className="rounded-2xl bg-card border border-border overflow-hidden">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="px-5 pt-5 pb-4 border-b border-border">

        {/* Title row */}
        <div className="flex items-center gap-2 mb-1">
          <Users className="h-4 w-4 text-primary" />
          <span className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
            User Growth
          </span>
        </div>
        <p className="text-3xl font-bold text-foreground tabular-nums">
          {data.total_unique_users.toLocaleString()}
        </p>
        <p className="text-sm text-muted-foreground mt-0.5 mb-4">Total unique users</p>

        {/* Stat strip — always single row, compact on mobile */}
        {stats && (
          <div className="grid grid-cols-3 gap-2">

            {/* Period */}
            <div className="flex flex-col items-center px-2 py-2 rounded-xl bg-primary/8 border border-primary/20">
              <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                Period
              </span>
              <span className="text-sm sm:text-base font-bold text-primary tabular-nums leading-snug">
                {stats.total.toLocaleString()}
              </span>
              <span className={cn(
                "text-[9px] sm:text-[10px] font-medium flex items-center gap-0.5 leading-snug",
                stats.delta >= 0 ? "text-emerald-500" : "text-rose-500"
              )}>
                {stats.delta >= 0
                  ? <TrendingUp className="h-2.5 w-2.5 flex-shrink-0" />
                  : <TrendingDown className="h-2.5 w-2.5 flex-shrink-0" />}
                {stats.delta >= 0 ? "+" : ""}{stats.delta.toFixed(1)}%
              </span>
            </div>

            {/* Peak */}
            <div className="flex flex-col items-center px-2 py-2 rounded-xl bg-muted/60 border border-border">
              <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                Peak
              </span>
              <span className="text-sm sm:text-base font-bold text-foreground tabular-nums leading-snug">
                {stats.peak.toLocaleString()}
              </span>
              <span className="text-[9px] sm:text-[10px] text-muted-foreground leading-snug">day</span>
            </div>

            {/* Avg/day */}
            <div className="flex flex-col items-center px-2 py-2 rounded-xl bg-muted/60 border border-border">
              <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                Avg/day
              </span>
              <span className="text-sm sm:text-base font-bold text-foreground tabular-nums leading-snug">
                {stats.avg.toFixed(0)}
              </span>
              <span className="text-[9px] sm:text-[10px] text-muted-foreground leading-snug">users</span>
            </div>

          </div>
        )}
      </div>

      {/* ── Controls ──────────────────────────────────────────────────────── */}
      <div className="px-5 py-3 flex items-center justify-between gap-3 flex-wrap border-b border-border">
        {/* Chart type */}
        <div className="flex items-center gap-1 bg-muted rounded-xl p-1">
          <ModeBtn active={mode === "area"} onClick={() => setMode("area")} icon={AreaIcon}  label="Area" />
          <ModeBtn active={mode === "bar"}  onClick={() => setMode("bar")}  icon={BarChart2} label="Bar" />
          <ModeBtn active={mode === "line"} onClick={() => setMode("line")} icon={Activity}  label="Line" />
        </div>

        {/* Time range */}
        <div className="flex items-center gap-1 bg-muted rounded-xl p-1">
          {(["7d", "30d", "90d", "all"] as TimeRange[]).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                "px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                range === r
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {r === "all" ? "All" : r.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* ── Chart ─────────────────────────────────────────────────────────── */}
      <div className="px-2 py-4">
        <ResponsiveContainer width="100%" height={300}>
          {mode === "area" ? (
            <AreaChart {...commonProps}>
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              {sharedAxis.grid}
              {sharedAxis.xAxis}
              {sharedAxis.yAxis}
              {sharedAxis.ref}
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }} />
              <Area
                type="monotone"
                dataKey="newUsers"
                name="New Users"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#areaGrad)"
                dot={false}
                activeDot={{ r: 5, fill: "hsl(var(--primary))", stroke: "hsl(var(--background))", strokeWidth: 2 }}
              />
            </AreaChart>
          ) : mode === "bar" ? (
            <BarChart {...commonProps} barSize={chartData.length > 30 ? 6 : 12}>
              <defs>
                <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="hsl(var(--primary))" stopOpacity={1} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                </linearGradient>
              </defs>
              {sharedAxis.grid}
              {sharedAxis.xAxis}
              {sharedAxis.yAxis}
              {sharedAxis.ref}
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted))" }} />
              <Bar dataKey="newUsers" name="New Users" fill="url(#barGrad)" radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : (
            <LineChart {...commonProps}>
              {sharedAxis.grid}
              {sharedAxis.xAxis}
              {sharedAxis.yAxis}
              {sharedAxis.ref}
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: "hsl(var(--border))" }} />
              <Line
                type="monotone"
                dataKey="newUsers"
                name="New Users"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5, fill: "hsl(var(--primary))", stroke: "hsl(var(--background))", strokeWidth: 2 }}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* ── Footer legend ──────────────────────────────────────────────────── */}
      <div className="px-5 pb-4 flex items-center gap-4 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="h-px w-4 border-t border-dashed border-muted-foreground/50 inline-block" />
          <span>Daily average</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-primary inline-block" />
          <span>New users per day</span>
        </div>
      </div>
    </div>
  );
}