"use client"
import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { FaucetsCreatedChart } from "./charts/faucet-created-chart"
import { TransactionsPerDayChart } from "./charts/transactions-per-day"
import { NewUsersChart } from "./charts/new-users-chart"
import { UserClaimsChart } from "./charts/user-claims-chart"
import { BarChart3, PieChart, TrendingUp, Users, Loader2, RefreshCw } from "lucide-react"
import { createContext, useContext } from "react"
import { useDashboard, DashboardData } from "@/hooks/useDashboard"

// ─── Context ────────────────────────────────────────────────────────────────

interface DashboardContextType {
  data: DashboardData | null
  loading: boolean
  refreshing: boolean
  manualRefresh: () => void
}

const DashboardContext = createContext<DashboardContextType>({
  data: null,
  loading: true,
  refreshing: false,
  manualRefresh: () => {},
})

export const useDashboardContext = () => useContext(DashboardContext)

// ─── Skeleton / Error ────────────────────────────────────────────────────────

function StatCardSkeleton() {
  return (
    <div className="bg-white dark:bg-[#020817] rounded-xl border border-slate-200 dark:border-slate-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="h-4 w-24 bg-slate-100 dark:bg-slate-800 animate-pulse rounded" />
        <div className="h-5 w-5 bg-slate-100 dark:bg-slate-800 animate-pulse rounded" />
      </div>
      <div className="h-8 w-20 bg-slate-100 dark:bg-slate-800 animate-pulse rounded" />
    </div>
  )
}

function ErrorCard({ message }: { message: string }) {
  return (
    <Card className="bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-900/50">
      <CardContent className="pt-6">
        <p className="text-sm text-center text-red-600 dark:text-red-400">{message}</p>
      </CardContent>
    </Card>
  )
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({
  title,
  value,
  icon: Icon,
  loading,
  lastUpdated,
}: {
  title: string
  value?: number
  icon: React.ElementType
  loading: boolean
  lastUpdated?: string
}) {
  if (loading) return <StatCardSkeleton />

  return (
    <div className="bg-white dark:bg-[#020817] rounded-xl border border-slate-200 dark:border-slate-800 p-4 hover:shadow-md dark:hover:bg-slate-800/70 transition-all">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{title}</p>
        <Icon className="h-5 w-5 text-slate-500" />
      </div>
      <div className="text-3xl font-bold text-slate-900 dark:text-white">
        {value?.toLocaleString() ?? 0}
      </div>
      {lastUpdated && (
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
          Updated: {new Date(lastUpdated).toLocaleTimeString()}
        </p>
      )}
    </div>
  )
}

// ─── Provider ────────────────────────────────────────────────────────────────

function DashboardProvider({ children }: { children: React.ReactNode }) {
  const dashboard = useDashboard()
  return (
    <DashboardContext.Provider value={dashboard}>
      {children}
    </DashboardContext.Provider>
  )
}

// ─── Main Content ────────────────────────────────────────────────────────────

function DashboardContent() {
  const { data, loading, refreshing, manualRefresh } = useDashboardContext()
  const [liveDrops, setLiveDrops] = useState<number | undefined>(undefined)

  const isLoading = loading && !data

  // Fetch the live total drops directly from the new endpoint to ensure it stays in sync
  useEffect(() => {
    const fetchLiveDrops = async (forceRefresh = false) => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://faucetdrops-indexer.onrender.com"
        // limit=1 ensures the response is instant, we just want the `json.total`
        const response = await fetch(`${apiUrl}/api/claims?limit=1`, {
          cache: forceRefresh ? 'no-store' : 'default'
        })
        if (response.ok) {
          const json = await response.json()
          if (json.success) setLiveDrops(json.total)
        }
      } catch (error) {
        console.error("Failed to fetch live drops count:", error)
      }
    }

    fetchLiveDrops()

    // Refresh every 5 minutes
    const interval = setInterval(() => fetchLiveDrops(), 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  // Force a fresh fetch when the user clicks the manual refresh button
  useEffect(() => {
    if (refreshing) {
      const fetchLiveDrops = async () => {
        try {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://faucetdrops-indexer.onrender.com"
          const response = await fetch(`${apiUrl}/api/claims?limit=1`, { cache: 'no-store' })
          if (response.ok) {
            const json = await response.json()
            if (json.success) setLiveDrops(json.total)
          }
        } catch (error) {
          // Ignore
        }
      }
      fetchLiveDrops()
    }
  }, [refreshing])


  return (
    <div className="w-full min-h-screen bg-gray-50 dark:bg-gray-950 border-dashed border-2 border-gray-200 dark:border-gray-800 p-4 md:p-6 lg:p-8 transition-colors duration-300">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="text-center md:text-left">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
              Analytics Dashboard
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2">
              Live data from all supported chains
            </p>
            {isLoading && (
              <div className="flex items-center justify-center md:justify-start mt-2">
                <Loader2 className="h-4 w-4 animate-spin mr-2 text-slate-500 dark:text-slate-400" />
                <span className="text-sm text-slate-500 dark:text-slate-400">Loading analytics...</span>
              </div>
            )}
          </div>

          {/* Refresh button */}
          <button
            onClick={manualRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all disabled:opacity-50 mt-1 shrink-0"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">{refreshing ? "Refreshing..." : "Refresh"}</span>
          </button>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <StatCard
            title="Total Faucets"
            value={data?.total_faucets}
            icon={BarChart3}
            loading={isLoading}
            lastUpdated={data?.last_updated}
          />
          <StatCard
            title="Total Transactions"
            value={data?.total_transactions}
            icon={TrendingUp}
            loading={isLoading}
          />
          <StatCard
            title="Unique Users"
            value={data?.total_unique_users}
            icon={Users}
            loading={isLoading}
          />
          <StatCard
            title="Total Drops"
            value={liveDrops ?? data?.total_claims}
            icon={PieChart}
            loading={isLoading && liveDrops === undefined}
          />
        </div>

        {/* Charts */}
        <Tabs defaultValue="faucets" className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 h-auto bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl p-1 shadow-sm">
            {[
              { value: "faucets", label: "Faucets Created", short: "Faucets" },
              { value: "transactions", label: "Transactions", short: "Transactions" },
              { value: "users", label: "New Users", short: "Users" },
              { value: "claims", label: "Drops", short: "Drops" },
            ].map(({ value, label, short }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="text-xs md:text-sm px-2 py-2 md:px-4 rounded-lg data-[state=active]:bg-slate-900 dark:data-[state=active]:bg-[#020817] data-[state=active]:text-white text-slate-600 dark:text-slate-400"
              >
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden">{short}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="faucets" className="space-y-4 mt-6">
            <ChartCard title="Faucets Created" icon={BarChart3} description="New faucets created across all networks">
              <FaucetsCreatedChart />
            </ChartCard>
          </TabsContent>

          <TabsContent value="transactions" className="space-y-4 mt-6">
            <ChartCard title="Transactions" icon={TrendingUp} description="Total transactions across all networks">
              <TransactionsPerDayChart />
            </ChartCard>
          </TabsContent>

          <TabsContent value="users" className="space-y-4 mt-6">
            <ChartCard title="New Users" icon={Users} description="Unique users joining across all networks">
              <NewUsersChart />
            </ChartCard>
          </TabsContent>

          <TabsContent value="claims" className="space-y-4 mt-6">
            <ChartCard title="Drops" icon={PieChart} description="Drops made across all networks">
              <UserClaimsChart />
            </ChartCard>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

function ChartCard({
  title,
  icon: Icon,
  description,
  children,
}: {
  title: string
  icon: React.ElementType
  description: string
  children: React.ReactNode
}) {
  return (
    <Card className="bg-white dark:bg-[#020817] border-slate-200 dark:border-slate-800 shadow-sm">
      <CardHeader className="px-4 md:px-6">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <CardTitle className="text-lg md:text-xl text-slate-900 dark:text-white">{title}</CardTitle>
        </div>
        <CardDescription className="text-sm text-slate-500 dark:text-slate-400">{description}</CardDescription>
      </CardHeader>
      <CardContent className="px-4 md:px-6">
        <div className="w-full overflow-hidden">{children}</div>
      </CardContent>
    </Card>
  )
}

// ─── Export ──────────────────────────────────────────────────────────────────

export function AnalyticsDashboard() {
  return (
    <DashboardProvider>
      <DashboardContent />
    </DashboardProvider>
  )
}