
// supabase/functions/analytics-api/index.ts
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
    const url = new URL(req.url)
    const endpoint = url.pathname.split('/').pop()

    switch (endpoint) {
      case 'dashboard':
        return await handleDashboard(req)
      case 'claims':
        return await handleClaims(req)
      case 'stats':
        return await handleStats(req)
      default:
        return new Response(
          JSON.stringify({ error: 'Endpoint not found' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 404,
          }
        )
    }

  } catch (error) {
    console.error('API error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error' 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})

async function handleDashboard(req: Request) {
  if (req.method === 'GET') {
    // Try cache first
    const { data: cachedData } = await supabase
      .from('cache_data')
      .select('data, updated_at')
      .eq('cache_key', 'dashboard_data')
      .or('expires_at.is.null,expires_at.gt.now()')
      .single()

    if (cachedData) {
      return new Response(
        JSON.stringify({
          data: cachedData.data,
          cached: true,
          lastUpdated: cachedData.updated_at
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Fallback to latest snapshot
    const { data: snapshot } = await supabase
      .from('analytics_snapshots')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    return new Response(
      JSON.stringify({
        data: snapshot || {
          totalClaims: 0,
          uniqueUsers: 0,
          totalFaucets: 0,
          totalTransactions: 0,
          monthlyChange: { claims: '+0%', users: '+0%', faucets: '+0%', transactions: '+0%' }
        },
        cached: false
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  if (req.method === 'POST') {
    // Trigger background refresh
    const refreshResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/refresh-analytics`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ dataType: 'dashboard' })
    })

    return new Response(
      JSON.stringify({ 
        message: 'Background refresh initiated',
        success: refreshResponse.ok 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
}

async function handleClaims(req: Request) {
  const { data: cachedData } = await supabase
    .from('cache_data')
    .select('data, updated_at')
    .eq('cache_key', 'user_claims_data')
    .or('expires_at.is.null,expires_at.gt.now()')
    .single()

  return new Response(
    JSON.stringify({
      data: cachedData?.data || { claims: [], faucetRankings: [], totalClaims: 0 },
      cached: !!cachedData,
      lastUpdated: cachedData?.updated_at
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  )
}

async function handleStats(req: Request) {
  const { data: stats } = await supabase.rpc('get_cache_stats')
  
  return new Response(
    JSON.stringify({ stats }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  )
}