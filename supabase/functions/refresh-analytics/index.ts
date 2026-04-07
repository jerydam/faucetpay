// supabase/functions/refresh-analytics/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { dataType = 'all' } = await req.json()
    
    console.log(`Starting background refresh for: ${dataType}`)
    
    // Create a background job
    const { data: job, error: jobError } = await supabase
      .from('background_jobs')
      .insert({
        job_type: `${dataType}_refresh`,
        status: 'running',
        started_at: new Date().toISOString(),
        metadata: { 
          triggered_by: 'edge_function',
          timestamp: Date.now() 
        }
      })
      .select('id')
      .single()

    if (jobError) {
      throw new Error(`Failed to create job: ${jobError.message}`)
    }

    const jobId = job.id

    try {
      switch (dataType) {
        case 'dashboard':
          await refreshDashboardData(jobId)
          break
        case 'claims':
          await refreshClaimsData(jobId)
          break
        case 'all':
          await refreshDashboardData(jobId)
          await refreshClaimsData(jobId)
          break
        default:
          throw new Error(`Invalid data type: ${dataType}`)
      }

      // Mark job as completed
      await supabase
        .from('background_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', jobId)

      console.log(`Background refresh completed for: ${dataType}`)

      return new Response(
        JSON.stringify({ 
          success: true, 
          jobId,
          message: `${dataType} refresh completed` 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )

    } catch (error) {
      // Mark job as failed
      await supabase
        .from('background_jobs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: error.message
        })
        .eq('id', jobId)

      throw error
    }

  } catch (error) {
    console.error('Background refresh failed:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Background refresh failed' 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})

async function refreshDashboardData(jobId: number) {
  console.log('Refreshing dashboard data...')
  
  // Here you would fetch fresh data from your blockchain sources
  // For example:
  
  // Mock data - replace with actual blockchain fetching logic
  const mockData = {
    totalClaims: Math.floor(Math.random() * 1000) + 500,
    uniqueUsers: Math.floor(Math.random() * 200) + 100,
    totalFaucets: Math.floor(Math.random() * 50) + 20,
    totalTransactions: Math.floor(Math.random() * 2000) + 1000,
    monthlyChange: {
      claims: '+5.2%',
      users: '+3.1%',
      faucets: '+1.8%',
      transactions: '+7.4%'
    }
  }
  
  // Save to analytics snapshots
  await supabase
    .from('analytics_snapshots')
    .insert({
      total_claims: mockData.totalClaims,
      unique_users: mockData.uniqueUsers,
      total_faucets: mockData.totalFaucets,
      total_transactions: mockData.totalTransactions,
      monthly_changes: mockData.monthlyChange
    })

  // Update cache
  await supabase
    .from('cache_data')
    .upsert({
      cache_key: 'dashboard_data',
      data: mockData,
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'cache_key'
    })

  console.log('Dashboard data refreshed successfully')
}

async function refreshClaimsData(jobId: number) {
  console.log('Refreshing claims data...')
  
  // Mock claims data - replace with actual blockchain fetching
  const mockClaims = Array.from({ length: 10 }, (_, i) => ({
    claimer: `0x${Math.random().toString(16).substr(2, 40)}`,
    faucet_address: `0x${Math.random().toString(16).substr(2, 40)}`,
    amount: (Math.random() * 1000).toString(),
    network_name: ['Celo', 'Base', 'Arbitrum', 'Lisk'][Math.floor(Math.random() * 4)],
    chain_id: [42220, 8453, 42161, 1135][Math.floor(Math.random() * 4)],
    token_symbol: ['CELO', 'ETH', 'USDC', 'TOKEN'][Math.floor(Math.random() * 4)],
    token_decimals: 18,
    is_ether: Math.random() > 0.5,
    timestamp: Math.floor(Date.now() / 1000) - Math.floor(Math.random() * 86400),
    source: 'edge_function'
  }))

  // Save claims to database
  await supabase
    .from('claims')
    .upsert(mockClaims, {
      onConflict: 'claimer,faucet_address,timestamp',
      ignoreDuplicates: true
    })

  // Process claims data for cache
  const processedData = {
    claims: mockClaims,
    totalClaims: mockClaims.length,
    faucetRankings: [] // Would process this from the claims
  }

  // Update cache
  await supabase
    .from('cache_data')
    .upsert({
      cache_key: 'user_claims_data',
      data: processedData,
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'cache_key'
    })

  console.log('Claims data refreshed successfully')
}
