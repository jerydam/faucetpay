// useAnalyticsAPI.ts - Hook for chart components to use backend APIs

import { useState, useEffect, useCallback } from 'react'

const API_BASE_URL ='https://identical-vivi-faucetdrops-41e9c56b.koyeb.app'

interface AnalyticsResponse<T = any> {
  success: boolean
  data: T
  cachedAt: string
  message?: string
}

interface UseAnalyticsOptions {
  autoFetch?: boolean
  refreshInterval?: number // in milliseconds
}

export function useAnalyticsAPI<T = any>(
  endpoint: string, 
  options: UseAnalyticsOptions = {}
) {
  const { autoFetch = true, refreshInterval } = options
  
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastFetched, setLastFetched] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`${API_BASE_URL}/analytics/${endpoint}`)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch ${endpoint}: ${response.statusText}`)
      }
      
      const result: AnalyticsResponse<T> = await response.json()
      
      if (!result.success) {
        throw new Error(result.message || `Failed to get ${endpoint} data`)
      }
      
      setData(result.data)
      setLastFetched(result.cachedAt)
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : `Failed to fetch ${endpoint}`
      setError(errorMessage)
      console.error(`Analytics API error for ${endpoint}:`, err)
    } finally {
      setLoading(false)
    }
  }, [endpoint])

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch) {
      fetchData()
    }
  }, [autoFetch, fetchData])

  // Set up refresh interval
  useEffect(() => {
    if (refreshInterval && refreshInterval > 0) {
      const interval = setInterval(fetchData, refreshInterval)
      return () => clearInterval(interval)
    }
  }, [refreshInterval, fetchData])

  return {
    data,
    loading,
    error,
    lastFetched,
    refetch: fetchData,
    isStale: false // You could implement staleness checking here
  }
}

// Specific hooks for each analytics type
export function useDashboardAnalytics(options?: UseAnalyticsOptions) {
  return useAnalyticsAPI('dashboard', options)
}

export function useTransactionsAnalytics(options?: UseAnalyticsOptions) {
  return useAnalyticsAPI('transactions', options)
}

export function useFaucetsAnalytics(options?: UseAnalyticsOptions) {
  return useAnalyticsAPI('faucets', options)
}

export function useUsersAnalytics(options?: UseAnalyticsOptions) {
  return useAnalyticsAPI('users', options)
}

export function useClaimsAnalytics(options?: UseAnalyticsOptions) {
  return useAnalyticsAPI('claims', options)
}

// Utility functions for chart components
export function processTransactionsForChart(transactionsData: any) {
  if (!transactionsData?.transactions) return []
  
  // Group by network
  const byNetwork: { [key: string]: number } = {}
  
  transactionsData.transactions.forEach((tx: any) => {
    const network = tx.networkName || 'Unknown'
    byNetwork[network] = (byNetwork[network] || 0) + 1
  })
  
  return Object.entries(byNetwork).map(([network, count]) => ({
    network,
    transactions: count
  }))
}

export function processFaucetsForChart(faucetsData: any) {
  if (!faucetsData?.faucets) return []
  
  // Group by network
  const byNetwork: { [key: string]: number } = {}
  
  faucetsData.faucets.forEach((faucet: any) => {
    const network = faucet.networkName || faucet.network || 'Unknown'
    byNetwork[network] = (byNetwork[network] || 0) + 1
  })
  
  return Object.entries(byNetwork).map(([network, count]) => ({
    network,
    faucets: count
  }))
}

export function processUsersForChart(usersData: any, claimsData?: any) {
  if (!usersData?.users && !claimsData?.claims) return []
  
  // Use claims data to build user timeline if available
  const claims = claimsData?.claims || []
  
  // Group by date
  const usersByDate: { [key: string]: Set<string> } = {}
  
  claims.forEach((claim: any) => {
    if (claim.initiator && claim.timestamp) {
      const date = new Date(claim.timestamp * 1000).toISOString().split('T')[0]
      if (!usersByDate[date]) {
        usersByDate[date] = new Set()
      }
      usersByDate[date].add(claim.initiator.toLowerCase())
    }
  })
  
  // Convert to chart format
  const sortedDates = Object.keys(usersByDate).sort()
  let cumulative = 0
  
  return sortedDates.map(date => {
    const newUsers = usersByDate[date].size
    cumulative += newUsers
    
    return {
      date,
      newUsers,
      cumulativeUsers: cumulative
    }
  })
}

export function processClaimsForChart(claimsData: any) {
  if (!claimsData?.claims) return []
  
  // Group by faucet address
  const claimsByFaucet: { [key: string]: any } = {}
  
  claimsData.claims.forEach((claim: any) => {
    const faucetAddress = claim.faucetAddress || claim.faucet || 'unknown'
    
    if (!claimsByFaucet[faucetAddress]) {
      claimsByFaucet[faucetAddress] = {
        address: faucetAddress,
        count: 0,
        network: claim.networkName || 'Unknown',
        chainId: claim.chainId
      }
    }
    
    claimsByFaucet[faucetAddress].count += 1
  })
  
  // Sort by count and return top 10
  return Object.values(claimsByFaucet)
    .sort((a: any, b: any) => b.count - a.count)
    .slice(0, 10)
    .map((item: any, index: number) => ({
      name: `Faucet ${item.address.slice(0, 6)}...${item.address.slice(-4)}`,
      value: item.count,
      faucetAddress: item.address,
      network: item.network,
      color: `hsl(${(index * 137.508) % 360}, 70%, 60%)`
    }))
}