import { useEffect, useCallback, useRef } from 'react'
import { updateSyncStatus, getSyncStatus } from '@/lib/database-helpers'

interface BackgroundSyncOptions {
  syncKey: string
  fetchFunction: () => Promise<any>
  interval?: number
  onSuccess?: (data: any) => void
  onError?: (error: Error) => void
}

export function useBackgroundSync(options: BackgroundSyncOptions) {
  const {
    syncKey,
    fetchFunction,
    interval = 5 * 60 * 1000,
    onSuccess,
    onError
  } = options

  const intervalRef = useRef<NodeJS.Timeout>()
  const isRunningRef = useRef(false)

  const runSync = useCallback(async () => {
    if (isRunningRef.current) return

    try {
      isRunningRef.current = true
      await updateSyncStatus(syncKey, 'syncing')

      console.log(`Starting background sync for ${syncKey}`)
      const data = await fetchFunction()
      
      await updateSyncStatus(syncKey, 'idle')
      onSuccess?.(data)
      
      console.log(`Background sync completed for ${syncKey}`)
    } catch (error) {
      console.error(`Background sync failed for ${syncKey}:`, error)
      await updateSyncStatus(syncKey, 'error', error instanceof Error ? error.message : 'Unknown error')
      onError?.(error instanceof Error ? error : new Error('Unknown error'))
    } finally {
      isRunningRef.current = false
    }
  }, [syncKey, fetchFunction, onSuccess, onError])

  const startSync = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }

    runSync()
    intervalRef.current = setInterval(runSync, interval)
    console.log(`Background sync started for ${syncKey} (every ${interval / 1000}s)`)
  }, [runSync, interval, syncKey])

  const stopSync = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = undefined
      console.log(`Background sync stopped for ${syncKey}`)
    }
  }, [syncKey])

  const checkSyncStatus = useCallback(async () => {
    return await getSyncStatus(syncKey)
  }, [syncKey])

  useEffect(() => {
    return () => {
      stopSync()
    }
  }, [stopSync])

  return {
    startSync,
    stopSync,
    runSync,
    checkSyncStatus,
    isRunning: isRunningRef.current
  }
}