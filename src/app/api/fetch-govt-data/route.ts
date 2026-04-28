import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import JSZip from 'jszip'

function parseNSWVG(content: string) {
  // B-record format: B;district;propId;...;streetNum;streetName;suburb;postcode;area;areaType;contractDate;settlementDate;price;;zoning;propType
  const records: any[] = []
  for (const raw of content.split('\n')) {
    const line = raw.trim().replace(/\r$/, '')
    if (!line.startsWith('B;')) continue
    const cols = line.split(';')
    if (cols.length < 16) continue

    const price = parseInt(cols[15]?.replace(/[^0-9]/g, '') || '0')
    if (!price || price < 10000) continue

    const dateRaw = cols[14]?.trim()
    let sold_date: string | null = null
    if (dateRaw?.length === 8 && /^\d{8}$/.test(dateRaw)) {
      sold_date = `${dateRaw.slice(0, 4)}-${dateRaw.slice(4, 6)}-${dateRaw.slice(6, 8)}`
    }
    if (!sold_date) continue

    let land_size: number | null = parseFloat(cols[11]?.trim() || '') || null
    if (land_size && cols[12]?.trim() === 'H') land_size = Math.round(land_size * 10000)
    if (land_size && (land_size > 500000 || land_size < 10)) land_size = null

    const propType = cols[17]?.trim()
    const property_type = propType === 'R' ? 'House' : propType === 'V' ? 'Land' : null

    const streetNum = cols[7]?.trim()
    const streetName = cols[8]?.trim()
    const suburb = cols[9]?.trim().toUpperCase()
    const postcode = cols[10]?.trim()
    const address = [streetNum, streetName].filter(Boolean).join(' ')
    if (!suburb) continue

    records.push({ address, suburb, state: 'NSW', postcode, price, sold_date, land_size, property_type })
  }
  return records
}

async function parseZip(zip: JSZip, allRecords: any[]) {
  for (const [, file] of Object.entries(zip.files)) {
    if (file.dir) continue
    const ext = (file.name.split('.').pop() || '').toLowerCase()
    if (ext === 'zip') {
      const innerBuf = await file.async('arraybuffer')
      const innerZip = await JSZip.loadAsync(innerBuf)
      await parseZip(innerZip, allRecords)
    } else if (ext === 'dat' || ext === 'txt') {
      const text = await file.async('string')
      allRecords.push(...parseNSWVG(text))
    }
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { url, trackWeek } = await request.json()
  if (!url) return NextResponse.json({ error: 'No URL provided' }, { status: 400 })

  let fileRes: Response
  try {
    fileRes = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PropertyTool/1.0)' },
      signal: AbortSignal.timeout(60000),
    })
    if (!fileRes.ok) throw new Error(`HTTP ${fileRes.status} — file not found`)
  } catch (err: any) {
    return NextResponse.json({ error: `Download failed: ${err.message}` }, { status: 400 })
  }

  const buffer = await fileRes.arrayBuffer()
  const records: any[] = []

  const contentType = fileRes.headers.get('content-type') || ''
  if (url.toLowerCase().endsWith('.zip') || contentType.includes('zip')) {
    const zip = await JSZip.loadAsync(buffer)
    await parseZip(zip, records)
  } else {
    const text = new TextDecoder().decode(buffer)
    records.push(...parseNSWVG(text))
  }

  if (!records.length) {
    return NextResponse.json({ error: 'No valid records found in the file.' }, { status: 400 })
  }

  // Deduplicate within batch
  const seen = new Set<string>()
  const deduped = records.filter(r => {
    const key = `${r.address}|${r.suburb}|${r.state}|${r.sold_date}|${r.price}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  // Insert in batches
  const batchSize = 500
  let inserted = 0
  for (let i = 0; i < deduped.length; i += batchSize) {
    const batch = deduped.slice(i, i + batchSize)
    await supabase
      .from('property_sales')
      .upsert(batch, { onConflict: 'address,suburb,state,sold_date,price', ignoreDuplicates: true })
    inserted += batch.length
  }

  // Track weekly import if requested
  if (trackWeek) {
    await supabase
      .from('weekly_imports')
      .upsert({ week_date: trackWeek, record_count: inserted, imported_at: new Date().toISOString() },
        { onConflict: 'week_date' })
  }

  // Return unique suburbs for geocoding
  const suburbSet = new Set<string>()
  for (const r of deduped) suburbSet.add(`${r.suburb}|${r.state}`)
  const suburbs = Array.from(suburbSet).map(s => {
    const [suburb, state] = s.split('|')
    return { suburb, state }
  })

  return NextResponse.json({ records: inserted, suburbs })
}
