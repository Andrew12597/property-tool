import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/autocomplete?type=suburb&q=parra
// GET /api/autocomplete?type=street&q=george&suburb=sydney
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ results: [] })

  const q = request.nextUrl.searchParams.get('q')?.trim() ?? ''
  const type = request.nextUrl.searchParams.get('type') ?? 'suburb'
  const suburb = request.nextUrl.searchParams.get('suburb')?.trim() ?? ''

  if (q.length < 2) return NextResponse.json({ results: [] })

  if (type === 'suburb') {
    // Search suburb_centroids for matching suburbs
    const { data } = await supabase
      .from('suburb_centroids')
      .select('suburb, state')
      .ilike('suburb', `${q}%`)
      .order('suburb')
      .limit(8)

    const results = (data || []).map(r => ({
      label: `${r.suburb}, ${r.state}`,
      suburb: r.suburb,
      state: r.state,
    }))
    return NextResponse.json({ results })
  }

  if (type === 'street') {
    // Get distinct street names from property_sales
    let query = supabase
      .from('property_sales')
      .select('address')
      .ilike('address', `%${q}%`)
      .limit(200)

    if (suburb) query = query.ilike('suburb', `%${suburb}%`)

    const { data } = await query

    // Extract unique street names (strip house numbers)
    const streetSet = new Set<string>()
    for (const r of data || []) {
      const parts = r.address?.split(' ')
      if (!parts || parts.length < 2) continue
      // Strip leading number(s) to get just the street name
      const streetName = parts.slice(parts[0].match(/^\d/) ? 1 : 0).join(' ')
      if (streetName.toLowerCase().includes(q.toLowerCase())) {
        streetSet.add(streetName)
      }
    }

    const results = Array.from(streetSet).sort().slice(0, 8).map(s => ({
      label: s,
      street: s,
    }))
    return NextResponse.json({ results })
  }

  return NextResponse.json({ results: [] })
}
