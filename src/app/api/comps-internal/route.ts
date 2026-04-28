import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { geocodeAddress, haversineKm } from '@/lib/geocode'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const {
    mode = 'radius',          // 'radius' | 'street'
    address, radiusKm = 1,
    streetName, suburb,       // for street mode
    minPrice, maxPrice,
    minLandSize, maxLandSize, soldAfterMonths = 12, propertyTypes
  } = await request.json()

  const soldAfterDate = new Date()
  soldAfterDate.setMonth(soldAfterDate.getMonth() - soldAfterMonths)
  const soldAfterStr = soldAfterDate.toISOString().slice(0, 10)

  // ── Street search mode ────────────────────────────────────────────────────
  if (mode === 'street') {
    if (!streetName?.trim()) {
      return NextResponse.json({ error: 'Enter a street name to search.' }, { status: 400 })
    }

    let query = supabase
      .from('property_sales')
      .select('*')
      .ilike('address', `%${streetName.trim()}%`)
      .gte('sold_date', soldAfterStr)
      .order('sold_date', { ascending: false })
      .limit(300)

    if (suburb?.trim()) query = query.ilike('suburb', `%${suburb.trim()}%`)
    if (minPrice) query = query.gte('price', minPrice)
    if (maxPrice) query = query.lte('price', maxPrice)
    if (minLandSize) query = query.gte('land_size', minLandSize)
    if (maxLandSize) query = query.lte('land_size', maxLandSize)
    if (propertyTypes?.length) query = query.in('property_type', propertyTypes)

    const { data: sales, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ results: sales || [] })
  }

  // ── Radius search mode ────────────────────────────────────────────────────
  const coord = await geocodeAddress(address + ', Australia')
  if (!coord) {
    return NextResponse.json({ error: 'Could not locate that address. Try including suburb and state.' }, { status: 400 })
  }

  const { lat, lng } = coord
  const latDelta = radiusKm / 111
  const lngDelta = radiusKm / (111 * Math.cos(lat * Math.PI / 180))

  const { data: suburbs } = await supabase
    .from('suburb_centroids')
    .select('suburb, state, lat, lng')
    .gte('lat', lat - latDelta * 1.5)
    .lte('lat', lat + latDelta * 1.5)
    .gte('lng', lng - lngDelta * 1.5)
    .lte('lng', lng + lngDelta * 1.5)

  if (!suburbs?.length) {
    return NextResponse.json({ results: [], lat, lng, noSuburbs: true })
  }

  const nearbySuburbs = suburbs
    .filter(s => haversineKm(lat, lng, s.lat, s.lng) <= radiusKm)
    .map(s => s.suburb)

  if (!nearbySuburbs.length) {
    return NextResponse.json({ results: [], lat, lng })
  }

  let query = supabase
    .from('property_sales')
    .select('*')
    .in('suburb', nearbySuburbs)
    .gte('sold_date', soldAfterStr)
    .order('sold_date', { ascending: false })
    .limit(200)

  if (minPrice) query = query.gte('price', minPrice)
  if (maxPrice) query = query.lte('price', maxPrice)
  if (minLandSize) query = query.gte('land_size', minLandSize)
  if (maxLandSize) query = query.lte('land_size', maxLandSize)
  if (propertyTypes?.length) query = query.in('property_type', propertyTypes)

  const { data: sales, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ results: sales || [], lat, lng })
}
