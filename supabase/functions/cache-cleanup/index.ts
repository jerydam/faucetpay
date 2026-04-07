
// supabase/functions/cache-cleanup/index.ts
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
    console.log('Starting cache cleanup...')

    // Clean expired cache entries
    const { data: cleanupResult, error } = await supabase
      .rpc('clean_expired_cache')

    if (error) {
      throw new Error(`Cache cleanup failed: ${error.message}`)
    }

    console.log(`Cleaned ${cleanupResult} expired cache entries`)

    // Clean old background jobs (keep last 1000)
    const { error: jobCleanupError } = await supabase
      .from('background_jobs')
      .delete()
      .not('id', 'in', `(
        SELECT id FROM background_jobs 
        ORDER BY created_at DESC 
        LIMIT 1000
      )`)

    if (jobCleanupError) {
      console.warn('Job cleanup failed:', jobCleanupError.message)
    }

    // Clean old analytics snapshots (keep last 100)
    const { error: analyticsCleanupError } = await supabase
      .from('analytics_snapshots')
      .delete()
      .not('id', 'in', `(
        SELECT id FROM analytics_snapshots 
        ORDER BY created_at DESC 
        LIMIT 100
      )`)

    if (analyticsCleanupError) {
      console.warn('Analytics cleanup failed:', analyticsCleanupError.message)
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        cleaned_cache_entries: cleanupResult,
        message: 'Cache cleanup completed successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Cache cleanup failed:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Cache cleanup failed' 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
