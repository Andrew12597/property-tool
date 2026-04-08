import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { geocodeAddress, haversineKm } from '@/lib/geocode'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const {
    address, radiusKm = 1, minPrice, maxPrice,
    minLandSize, maxLandSize, soldAfterMonths = 12, propertyTypes
  } = await request.json()

  // Step 1: Geocode search address
  const coord = await geocodeAddress(address + ', Australia')
  if (!coord) {
    return NextResponse.json({ error: 'Could not locate that address. Try including suburb and state.' }, { status: 400 })
  }

  const { lat, lng } = coord

  // Step 2: Bounding box for radius
  const latDelta = radiusKm / 111
  const lngDelta = radiusKm / (111 * Math.cos(lat * Math.PI / 180))

  // Step 3: Find suburbs within bounding box
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

  // Step 4: Filter by actual Haversine distance
  const nearbySuburbs = suburbs
    .filter(s => haversineKm(lat, lng, s.lat, s.lng) <= radiusKm)
    .map(s => s.suburb)

  if (!nearbySuburbs.length) {
    return NextResponse.json({ results: [], lat, lng })
  }

  // Step 5: Query property sales
  const soldAfterDate = new Date()
  soldAfterDate.setMonth(soldAfterDate.getMonth() - soldAfterMonths)

  let query = supabase
    .from('property_sales')
    .select('*')
    .in('suburb', nearbySuburbs)
    .gte('sold_date', soldAfterDate.toISOString().slice(0, 10))
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
