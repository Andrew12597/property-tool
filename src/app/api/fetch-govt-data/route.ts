import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import JSZip from 'jszip'

function parseNSWVG(content: string) {
  const records: any[] = []
  for (const raw of content.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith(';') || !line.includes(';')) continue
    const cols = line.split(';')
    if (cols.length < 13) continue

    const price = parseInt(cols[12]?.replace(/[^0-9]/g, '') || '0')
    if (!price || price < 10000) continue

    const dateRaw = cols[11]?.trim()
    let sold_date: string | null = null
    if (dateRaw?.length === 8 && /^\d{8}$/.test(dateRaw)) {
      sold_date = `${dateRaw.slice(0, 4)}-${dateRaw.slice(4, 6)}-${dateRaw.slice(6, 8)}`
    } else if (dateRaw?.includes('/')) {
      const p = dateRaw.split('/')
      if (p.length === 3) sold_date = `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`
    }
    if (!sold_date) continue

    let land_size: number | null = parseFloat(cols[8]?.trim() || '') || null
    if (land_size && cols[9]?.trim() === 'H') land_size = Math.round(land_size * 10000)
    if (land_size && (land_size > 100000 || land_size < 10)) land_size = null

    const code = cols[7]?.trim()
    const property_type = code === 'A' ? 'House' : code === 'C' ? 'Land' : code === 'D' || code === 'E' ? 'Commercial' : null

    const address = cols[5]?.trim()
    const suburb = cols[6]?.trim().toUpperCase()
    if (!address || !suburb) continue

    records.push({ address, suburb, state: 'NSW', price, sold_date, land_size, property_type })
  }
  return records
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { url } = await request.json()
  if (!url) return NextResponse.json({ error: 'No URL provided' }, { status: 400 })

  // Download the file
  let fileRes: Response
  try {
    fileRes = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PropertyTool/1.0)' },
      signal: AbortSignal.timeout(30000),
    })
    if (!fileRes.ok) throw new Error(`HTTP ${fileRes.status}`)
  } catch (err: any) {
    return NextResponse.json({ error: `Download failed: ${err.message}` }, { status: 400 })
  }

  const contentType = fileRes.headers.get('content-type') || ''
  const buffer = await fileRes.arrayBuffer()
  let records: any[] = []

  // ZIP file — extract all DAT/txt files inside
  if (url.toLowerCase().endsWith('.zip') || contentType.includes('zip')) {
    const zip = await JSZip.loadAsync(buffer)
    for (const [filename, file] of Object.entries(zip.files)) {
      if (file.dir) continue
      const ext = filename.split('.').pop()?.toLowerCase()
      if (ext === 'dat' || ext === 'txt' || ext === 'csv') {
        const text = await file.async('string')
        records.push(...parseNSWVG(text))
      }
    }
  } else {
    // Plain text/CSV
    const text = new TextDecoder().decode(buffer)
    records = parseNSWVG(text)
  }

  if (!records.length) {
    return NextResponse.json({ error: 'No valid records found in the file. Check the URL points to a NSW Valuer General data file.' }, { status: 400 })
  }

  // Insert into Supabase in batches
  const batchSize = 500
  let inserted = 0
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize)
    await supabase.from('property_sales').upsert(batch, { onConflict: 'address,suburb,state,sold_date,price' })
    inserted += batch.length
  }

  // Return unique suburbs for client-side geocoding
  const suburbSet = new Set<string>()
  for (const r of records) suburbSet.add(`${r.suburb}|${r.state}`)
  const suburbs = Array.from(suburbSet).map(s => {
    const [suburb, state] = s.split('|')
    return { suburb, state }
  })

  return NextResponse.json({ records: inserted, suburbs })
}
