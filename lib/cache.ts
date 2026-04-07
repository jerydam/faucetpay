// lib/cache.ts
"use client"

interface CacheItem<T> {
  data: T
  timestamp: number
  expiry: number // in milliseconds
}

class CacheManager {
  private cache = new Map<string, CacheItem<any>>()
  private readonly DEFAULT_EXPIRY = 5 * 60 * 1000 // 5 minutes

  set<T>(key: string, data: T, customExpiry?: number): void {
    const expiry = customExpiry || this.DEFAULT_EXPIRY
    const item: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      expiry
    }
    this.cache.set(key, item)
    
    // Also store in localStorage for persistence (if available)
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(`cache_${key}`, JSON.stringify(item))
      }
    } catch (error) {
      console.warn('localStorage not available, using memory cache only')
    }
  }

  get<T>(key: string): T | null {
    // First check memory cache
    let item = this.cache.get(key)
    
    // If not in memory, try localStorage
    if (!item && typeof window !== 'undefined' && window.localStorage) {
      try {
        const stored = localStorage.getItem(`cache_${key}`)
        if (stored) {
          item = JSON.parse(stored)
          // Restore to memory cache
          if (item) {
            this.cache.set(key, item)
          }
        }
      } catch (error) {
        console.warn('Error reading from localStorage:', error)
      }
    }

    if (!item) return null

    // Check if expired
    const now = Date.now()
    if (now - item.timestamp > item.expiry) {
      this.delete(key)
      return null
    }

    return item.data
  }

  delete(key: string): void {
    this.cache.delete(key)
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.removeItem(`cache_${key}`)
      } catch (error) {
        console.warn('Error removing from localStorage:', error)
      }
    }
  }

  clear(): void {
    this.cache.clear()
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const keys = Object.keys(localStorage)
        keys.forEach(key => {
          if (key.startsWith('cache_')) {
            localStorage.removeItem(key)
          }
        })
      } catch (error) {
        console.warn('Error clearing localStorage:', error)
      }
    }
  }

  isExpired(key: string): boolean {
    const item = this.cache.get(key)
    if (!item) return true
    
    const now = Date.now()
    return now - item.timestamp > item.expiry
  }

  getAge(key: string): number | null {
    const item = this.cache.get(key)
    if (!item) return null
    
    return Date.now() - item.timestamp
  }
}

// Export singleton instance
export const cacheManager = new CacheManager()

// Cache key constants
export const CACHE_KEYS = {
  DASHBOARD_DATA: 'dashboard_data',
  FAUCET_CLAIMS: 'faucet_claims',
  STORAGE_CLAIMS: 'storage_claims',
  FACTORY_CLAIMS: 'factory_claims',
  NETWORK_FAUCETS: (networkId: number) => `network_faucets_${networkId}`,
  NETWORK_TRANSACTIONS: (networkId: number) => `network_transactions_${networkId}`,
  USER_CLAIMS_DATA: 'user_claims_data',
  NEW_USERS_DATA: 'new_users_data',
  FAUCET_NAMES: 'faucet_names'
} as const

// Hook for using cache with React
export function useCache() {
  return {
    get: cacheManager.get.bind(cacheManager),
    set: cacheManager.set.bind(cacheManager),
    delete: cacheManager.delete.bind(cacheManager),
    clear: cacheManager.clear.bind(cacheManager),
    isExpired: cacheManager.isExpired.bind(cacheManager),
    getAge: cacheManager.getAge.bind(cacheManager)
  }
}