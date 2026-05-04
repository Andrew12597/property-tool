import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const p = request.nextUrl.searchParams
  const recentStart = p.get('recent_start')!
  const recentEnd   = p.get('recent_end')!
  const priorStart  = p.get('prior_start')!
  const priorEnd    = p.get('prior_end')!
  const propTypes   = p.get('property_types')   // comma-separated or null
  const minSales    = parseInt(p.get('min_sales') ?? '5')
  const state       = p.get('state') ?? 'NSW'

  const { data, error } = await supabase.rpc('get_suburb_growth', {
    p_recent_start:    recentStart,
    p_recent_end:      recentEnd,
    p_prior_start:     priorStart,
    p_prior_end:       priorEnd,
    p_property_types:  propTypes ? propTypes.split(',') : null,
    p_min_sales:       minSales,
    p_state:           state,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
