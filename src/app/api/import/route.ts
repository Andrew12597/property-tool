import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// Insert a batch of suburb centroids
export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const suburbs: { suburb: string; state: string; lat: number; lng: number }[] = await request.json()

  const { error } = await supabase
    .from('suburb_centroids')
    .upsert(suburbs, { onConflict: 'suburb,state' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// Insert a batch of property sales
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const records: any[] = await request.json()

  const { error, count } = await supabase
    .from('property_sales')
    .upsert(records, { onConflict: 'address,suburb,state,sold_date,price' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ inserted: count ?? records.length })
}

// Get counts of sales and suburbs in DB, or list of imported weekly dates
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const type = request.nextUrl.searchParams.get('type')

  if (type === 'weekly') {
    const { data, error } = await supabase
      .from('weekly_imports')
      .select('week_date')
    if (error) return NextResponse.json({ importedWeeks: [] })
    return NextResponse.json({ importedWeeks: (data || []).map(r => r.week_date) })
  }

  const { count } = await supabase
    .from('property_sales')
    .select('*', { count: 'exact', head: true })

  const { count: suburbCount } = await supabase
    .from('suburb_centroids')
    .select('*', { count: 'exact', head: true })

  return NextResponse.json({ salesCount: count ?? 0, suburbCount: suburbCount ?? 0 })
}
