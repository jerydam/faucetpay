// lib/supabase-data-service.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)

// Data types for Supabase storage
export interface FaucetData {
  id?: number
  network: string
  faucets: number
  updated_at: string
}

export interface UserData {
  id?: number
  date: string
  new_users: number
  cumulative_users: number
  updated_at: string
}

export interface ClaimData {
  id?: number
  faucet_address: string
  faucet_name: string
  network: string
  chain_id: number
  claims: number
  total_amount: string
  latest_claim_time: number
  updated_at: string
}

export interface TransactionData {
  id?: number
  network: string
  chain_id: number
  total_transactions: number
  color: string
  updated_at: string
}

export interface DashboardSummary {
  id?: number
  total_faucets: number
  total_transactions: number
  unique_users: number
  total_claims: number
  updated_at: string
}

// Centralized data service
export class DataService {
  // Save faucet data
  static async saveFaucetData(data: Omit<FaucetData, 'id' | 'updated_at'>[]) {
    try {
      // Clear existing data
      await supabase.from('faucet_data').delete().neq('id', 0)
      
      // Insert new data
      const { error } = await supabase.from('faucet_data').insert(
        data.map(item => ({ ...item, updated_at: new Date().toISOString() }))
      )
      
      if (error) throw error
      console.log('Faucet data saved to Supabase')
    } catch (error) {
      console.error('Error saving faucet data to Supabase:', error)
    }
  }

  // Load faucet data
  static async loadFaucetData(): Promise<FaucetData[]> {
    try {
      const { data, error } = await supabase
        .from('faucet_data')
        .select('*')
        .order('updated_at', { ascending: false })
      
      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error loading faucet data from Supabase:', error)
      return []
    }
  }

  // Save user data
  static async saveUserData(data: Omit<UserData, 'id' | 'updated_at'>[]) {
    try {
      await supabase.from('user_data').delete().neq('id', 0)
      
      const { error } = await supabase.from('user_data').insert(
        data.map(item => ({ ...item, updated_at: new Date().toISOString() }))
      )
      
      if (error) throw error
      console.log('User data saved to Supabase')
    } catch (error) {
      console.error('Error saving user data to Supabase:', error)
    }
  }

  // Load user data
  static async loadUserData(): Promise<UserData[]> {
    try {
      const { data, error } = await supabase
        .from('user_data')
        .select('*')
        .order('date', { ascending: true })
      
      if (error) throw error
      return data || []
    } catch (error) {
      console.log('Error loading user data from Supabase:', error)
      return []
    }
  }

  // Save claim data
  static async saveClaimData(data: Omit<ClaimData, 'id' | 'updated_at'>[]) {
    try {
      await supabase.from('claim_data').delete().neq('id', 0)
      
      const { error } = await supabase.from('claim_data').insert(
        data.map(item => ({ ...item, updated_at: new Date().toISOString() }))
      )
      
      if (error) throw error
      console.log('Claim data saved to Supabase')
    } catch (error) {
      console.error('Error saving claim data to Supabase:', error)
    }
  }

  // Load claim data
  static async loadClaimData(): Promise<ClaimData[]> {
    try {
      const { data, error } = await supabase
        .from('claim_data')
        .select('*')
        .order('claims', { ascending: false })
      
      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error loading claim data from Supabase:', error)
      return []
    }
  }

  // Save transaction data
  static async saveTransactionData(data: Omit<TransactionData, 'id' | 'updated_at'>[]) {
    try {
      await supabase.from('transaction_data').delete().neq('id', 0)
      
      const { error } = await supabase.from('transaction_data').insert(
        data.map(item => ({ ...item, updated_at: new Date().toISOString() }))
      )
      
      if (error) throw error
      console.log('Transaction data saved to Supabase')
    } catch (error) {
      console.error('Error saving transaction data to Supabase:', error)
    }
  }

  // Load transaction data
  static async loadTransactionData(): Promise<TransactionData[]> {
    try {
      const { data, error } = await supabase
        .from('transaction_data')
        .select('*')
        .order('total_transactions', { ascending: false })
      
      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error loading transaction data from Supabase:', error)
      return []
    }
  }

  // Save dashboard summary
  static async saveDashboardSummary(data: Omit<DashboardSummary, 'id' | 'updated_at'>) {
    try {
      await supabase.from('dashboard_summary').delete().neq('id', 0)
      
      const { error } = await supabase.from('dashboard_summary').insert({
        ...data,
        updated_at: new Date().toISOString()
      })
      
      if (error) throw error
      console.log('Dashboard summary saved to Supabase')
    } catch (error) {
      console.error('Error saving dashboard summary to Supabase:', error)
    }
  }

  // Load dashboard summary
  static async loadDashboardSummary(): Promise<DashboardSummary | null> {
    try {
      const { data, error } = await supabase
        .from('dashboard_summary')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single()
      
      if (error) throw error
      return data
    } catch (error) {
      console.error('Error loading dashboard summary from Supabase:', error)
      return null
    }
  }

  // Check if data is fresh (within 5 minutes)
  static isDataFresh(updatedAt: string): boolean {
    const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
    const lastUpdated = new Date(updatedAt).getTime()
    return Date.now() - lastUpdated < CACHE_DURATION
  }
}