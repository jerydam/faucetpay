'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Backend URL — only used for the manual refresh trigger
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'https://faucetdrops-indexer.onrender.com';

export interface DashboardData {
  total_claims: number;
  total_unique_users: number;
  total_faucets: number;
  total_transactions: number;
  claims_pie_data: Array<{
    name: string;
    value: number;
    faucetAddress?: string;
    network?: string;
  }>;
  faucet_rankings: Array<{
    rank: number;
    faucetAddress: string;
    faucetName: string;
    network: string;
    chainId: number;
    totalClaims: number;
    latestClaimTime: number;
  }>;
  users_chart: Array<{
    date: string;
    newUsers: number;
    cumulativeUsers: number;
  }>;
  network_transactions: Array<{
    name: string;
    chainId: number;
    totalTransactions: number;
    color: string;
  }>;
  network_faucets: Array<{
    network: string;
    faucets: number;
  }>;
  last_updated: string;
}

// Fallback maps used if Supabase rows are missing these fields
const NETWORK_COLORS: Record<string, string> = {
  Celo:      '#35D07F',
  Lisk:      '#0D4477',
  Arbitrum:  '#28A0F0',
  Base:      '#0052FF',
  BNB:       '#F3BA2F',
};

const NETWORK_CHAIN_IDS: Record<string, number> = {
  Celo:      42220,
  Lisk:      1135,
  Arbitrum:  42161,
  Base:      8453,
  BNB:       56,
};

async function fetchDashboardFromSupabase(): Promise<DashboardData> {
  // All 5 tables in parallel — zero sequential waterfalls
  const [metaRes, faucetRes, userRes, claimRes, netTxRes] = await Promise.all([
    supabase.from('dashboard_meta').select('*').eq('id', 1).limit(1),
    supabase.from('faucet_data').select('*'),
    supabase.from('user_data').select('*').order('date', { ascending: true }),
    supabase.from('claim_data').select('*').order('latest_claim_time', { ascending: false }),
    supabase.from('network_tx_data').select('*'),
  ]);

  // Non-fatal — log but don't throw for optional tables
  if (faucetRes.error) throw new Error(`faucet_data: ${faucetRes.error.message}`);
  if (userRes.error)   throw new Error(`user_data: ${userRes.error.message}`);
  if (claimRes.error)  throw new Error(`claim_data: ${claimRes.error.message}`);

  const meta      = metaRes.data?.[0]  ?? {};
  const faucetRows = faucetRes.data    ?? [];
  const userRows   = userRes.data      ?? [];
  const claimRows  = claimRes.data     ?? [];
  const netTxRows  = netTxRes.data     ?? [];

  // ── network_faucets ──────────────────────────────────────────────────────
  const network_faucets = faucetRows.map((r) => ({
    network: r.network as string,
    faucets: r.faucets as number,
  }));

  // ── Scalar totals — prefer dashboard_meta (pre-computed), fall back ───────
  const total_faucets = network_faucets.reduce((s, r) => s + r.faucets, 0);
  const total_unique_users   = (meta.total_unique_users   as number) ?? (userRows.length > 0 ? (userRows[userRows.length - 1].cumulative_users as number) : 0);
  const total_claims         = (meta.total_claims         as number) ?? claimRows.reduce((s, r) => s + (r.claims as number), 0);
  const total_transactions   = (meta.total_transactions   as number) ?? claimRows.reduce((s, r) => s + ((r.total_transactions ?? r.claims) as number), 0);
  const last_updated: string  = (meta.last_updated as string) ?? new Date().toISOString();

  // ── users_chart ──────────────────────────────────────────────────────────
  const users_chart = userRows.map((r) => ({
    date:            r.date as string,
    newUsers:        r.new_users as number,
    cumulativeUsers: r.cumulative_users as number,
  }));

  // ── faucet_rankings ──────────────────────────────────────────────────────
  const faucet_rankings = claimRows.map((r, i) => ({
    rank:            (r.rank as number) ?? i + 1,
    faucetAddress:   r.faucet_address as string,
    faucetName:      r.faucet_name as string,
    network:         r.network as string,
    chainId:         (r.chain_id as number) ?? NETWORK_CHAIN_IDS[r.network as string] ?? 0,
    totalClaims:     r.claims as number,
    latestClaimTime: r.latest_claim_time as number,
  }));

  // ── network_transactions — prefer network_tx_data, fall back to claim_data 
  let network_transactions: DashboardData['network_transactions'];

  if (netTxRows.length > 0) {
    // ✅ Full data from the new dedicated table
    network_transactions = netTxRows.map((r) => ({
      name:              r.network as string,
      chainId:           (r.chain_id as number) ?? NETWORK_CHAIN_IDS[r.network as string] ?? 0,
      totalTransactions: r.total_transactions as number,
      color:             (r.color as string) ?? NETWORK_COLORS[r.network as string] ?? '#888888',
    }));
  } else {
    // Fallback: aggregate per-network from claim_data
    const networkTxMap: Record<string, number> = {};
    for (const r of claimRows) {
      const net = r.network as string;
      networkTxMap[net] = (networkTxMap[net] ?? 0) + ((r.total_transactions ?? r.claims) as number);
    }
    for (const nf of network_faucets) {
      networkTxMap[nf.network] ??= 0;
    }
    network_transactions = Object.entries(networkTxMap).map(([name, totalTransactions]) => ({
      name,
      chainId:           NETWORK_CHAIN_IDS[name] ?? 0,
      totalTransactions,
      color:             NETWORK_COLORS[name] ?? '#888888',
    }));
  }

  // ── claims_pie_data (top 10 + Others) ────────────────────────────────────
  const sorted  = [...claimRows].sort((a, b) => (b.claims as number) - (a.claims as number));
  const top10   = sorted.slice(0, 10);
  const rest    = sorted.slice(10);

  const claims_pie_data: DashboardData['claims_pie_data'] = top10.map((r) => ({
    name:          r.faucet_name as string,
    value:         r.claims as number,
    faucetAddress: r.faucet_address as string,
    network:       r.network as string,
  }));

  const othersTotal = rest.reduce((s, r) => s + (r.claims as number), 0);
  if (othersTotal > 0) {
    claims_pie_data.push({
      name:          `Others (${rest.length})`,
      value:         othersTotal,
      faucetAddress: 'others',
      network:       '',
    });
  }

  return {
    total_claims,
    total_unique_users,
    total_faucets,
    total_transactions,
    claims_pie_data,
    faucet_rankings,
    users_chart,
    network_transactions,
    network_faucets,
    last_updated,
  };
}

export function useDashboard() {
  const [data, setData]             = useState<DashboardData | null>(null);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  // Regular fetch: reads directly from Supabase (fast, no backend needed)
  const fetchDashboard = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const result = await fetchDashboardFromSupabase();
      setData(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error('Dashboard fetch error:', msg);
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Manual refresh: tells backend to re-crawl chains + update Supabase,
  // then re-reads Supabase so the UI shows the freshest data immediately.
  const manualRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      // 1. Trigger backend full refresh (awaits completion — may take ~30s)
      const res = await fetch(`${BACKEND_URL}/api/refresh`);
      if (!res.ok) {
        console.warn('Backend refresh returned non-OK, reading Supabase anyway');
      }
      // 2. Re-read from Supabase now that backend has written fresh data
      const result = await fetchDashboardFromSupabase();
      setData(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error('Manual refresh error:', msg);
      setError(msg);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  return { data, loading, refreshing, error, manualRefresh };
}