import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export interface AnalyticsCache {
  id: number
  cache_key: string
  data: any
  expires_at: string | null
  created_at: string
  updated_at: string
}

export interface SyncStatus {
  id: number
  sync_type: string
  last_sync: string
  status: 'idle' | 'syncing' | 'error'
  error_message: string | null
  created_at: string
  updated_at: string
}