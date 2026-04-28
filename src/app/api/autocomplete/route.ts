import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Extract the street name from a full address string.
 * Handles:
 *   "24 HARGRAVE ST"       → "HARGRAVE ST"
 *   "24 A HARGRAVE ST"     → "HARGRAVE ST"  (strips unit letter)
 *   "24A HARGRAVE ST"      → "HARGRAVE ST"  (strips combined number+letter)
 *   "1/24 HARGRAVE ST"     → "HARGRAVE ST"  (strips lot/unit prefix)
 *   "UNIT 2 24 HARGRAVE ST"→ "HARGRAVE ST"  (strips UNIT token)
 */
function extractStreetName(address: string): string {
  const parts = address.trim().split(/\s+/)
  let i = 0
  // Skip "UNIT", "LOT", "SHOP", "LEVEL" etc.
  while (i < parts.length && /^(UNIT|LOT|SHOP|LEVEL|SUITE|FLAT|APT)$/i.test(parts[i])) i++
  // Skip house number tokens: digits, digits+letter (24A), fractions (1/24), letter+digits (A1)
  while (i < parts.length && /^(\d+[A-Z]?|[A-Z]?\d+|[\d]+\/[\d]+)$/i.test(parts[i])) i++
  // Skip lone single-letter unit identifiers (A, B, C …)
  while (i < parts.length && /^[A-Z]$/i.test(parts[i])) i++
  return parts.slice(i).join(' ')
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ results: [] })

  const q = request.nextUrl.searchParams.get('q')?.trim() ?? ''
  const type = request.nextUrl.searchParams.get('type') ?? 'suburb'
  const suburb = request.nextUrl.searchParams.get('suburb')?.trim() ?? ''

  // ── Preload all suburbs for client-side filtering ─────────────────────────
  if (type === 'suburb' && q === 'all') {
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '5000')
    const { data } = await supabase
      .from('suburb_centroids')
      .select('suburb, state')
      .order('suburb')
      .limit(limit)
    const results = (data || []).map(r => ({ label: `${r.suburb}, ${r.state}`, suburb: r.suburb, state: r.state }))
    return NextResponse.json({ results }, { headers: { 'Cache-Control': 'public, max-age=3600' } })
  }

  if (q.length < 2) return NextResponse.json({ results: [] })

  // ── Suburb search ─────────────────────────────────────────────────────────
  if (type === 'suburb') {
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

  // ── Street search ─────────────────────────────────────────────────────────
  if (type === 'street') {
    let query = supabase
      .from('property_sales')
      .select('address, suburb, state')
      .ilike('address', `%${q}%`)
      .limit(300)

    if (suburb) query = query.ilike('suburb', `%${suburb}%`)

    const { data } = await query

    // Build map: streetName → most common suburb
    const streetSuburbs = new Map<string, Map<string, number>>()

    for (const r of data || []) {
      const streetName = extractStreetName(r.address || '')
      if (!streetName || streetName.length < 2) continue
      if (!streetName.toUpperCase().includes(q.toUpperCase())) continue

      if (!streetSuburbs.has(streetName)) streetSuburbs.set(streetName, new Map())
      const suburbMap = streetSuburbs.get(streetName)!
      const key = `${r.suburb}|${r.state}`
      suburbMap.set(key, (suburbMap.get(key) || 0) + 1)
    }

    // For each street, pick the most common suburb
    const results = Array.from(streetSuburbs.entries())
      .map(([street, suburbMap]) => {
        const [topKey] = [...suburbMap.entries()].sort((a, b) => b[1] - a[1])[0]
        const [topSuburb, topState] = topKey.split('|')
        return {
          label: `${street} — ${topSuburb}, ${topState}`,
          street,
          suburb: topSuburb,
          state: topState,
        }
      })
      .sort((a, b) => a.street.localeCompare(b.street))
      .slice(0, 8)

    return NextResponse.json({ results })
  }

  return NextResponse.json({ results: [] })
}
