import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'

function parseNSWVG(content: string) {
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
    const address = [cols[7]?.trim(), cols[8]?.trim()].filter(Boolean).join(' ')
    const suburb = cols[9]?.trim().toUpperCase()
    const postcode = cols[10]?.trim()
    if (!suburb) continue
    records.push({ address, suburb, state: 'NSW', postcode, price, sold_date, land_size, property_type })
  }
  return records
}

async function parseZip(zip: JSZip, all: any[]) {
  for (const [, file] of Object.entries(zip.files)) {
    if (file.dir) continue
    const ext = (file.name.split('.').pop() || '').toLowerCase()
    if (ext === 'zip') {
      const buf = await file.async('arraybuffer')
      await parseZip(await JSZip.loadAsync(buf), all)
    } else if (ext === 'dat' || ext === 'txt') {
      all.push(...parseNSWVG(await file.async('string')))
    }
  }
}

function getMondaysSince(startDate: Date, endDate: Date) {
  const mondays: string[] = []
  const d = new Date(startDate)
  const day = d.getDay()
  if (day !== 1) d.setDate(d.getDate() + ((8 - day) % 7))
  while (d <= endDate) {
    mondays.push(d.toISOString().slice(0, 10).replace(/-/g, ''))
    d.setDate(d.getDate() + 7)
  }
  return mondays
}

// POST /api/sync-weekly — import all missing weeks up to 2 weeks ago
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 7) // 1 week lag

  const allMondays = getMondaysSince(new Date('2026-01-05'), cutoff)

  // Which weeks already imported?
  const { data: existing } = await supabase.from('weekly_imports').select('week_date')
  const imported = new Set((existing || []).map(r => r.week_date))
  const toImport = allMondays.filter(w => !imported.has(w))

  if (!toImport.length) {
    return NextResponse.json({ message: 'Already up to date', weeks: 0, records: 0 })
  }

  let totalRecords = 0
  const weekResults: { week: string; records: number; status: string }[] = []

  for (const dateStr of toImport) {
    const url = `https://www.valuergeneral.nsw.gov.au/__psi/weekly/${dateStr}.zip`
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'PropertyTool/1.0' },
        signal: AbortSignal.timeout(30000),
      })
      if (!res.ok) {
        weekResults.push({ week: dateStr, records: 0, status: res.status === 404 ? 'not_yet_available' : `error_${res.status}` })
        continue
      }

      const buf = await res.arrayBuffer()
      const zip = await JSZip.loadAsync(buf)
      const records: any[] = []
      await parseZip(zip, records)

      // Deduplicate
      const seen = new Set<string>()
      const deduped = records.filter(r => {
        const k = `${r.address}|${r.suburb}|${r.state}|${r.sold_date}|${r.price}`
        if (seen.has(k)) return false
        seen.add(k); return true
      })

      // Upload in batches
      for (let i = 0; i < deduped.length; i += 500) {
        await supabase.from('property_sales')
          .upsert(deduped.slice(i, i + 500), { onConflict: 'address,suburb,state,sold_date,price', ignoreDuplicates: true })
      }

      // Track
      await supabase.from('weekly_imports').upsert(
        { week_date: dateStr, record_count: deduped.length, imported_at: new Date().toISOString() },
        { onConflict: 'week_date' }
      )

      totalRecords += deduped.length
      weekResults.push({ week: dateStr, records: deduped.length, status: 'ok' })

    } catch (err: any) {
      weekResults.push({ week: dateStr, records: 0, status: `error: ${err.message}` })
    }
  }

  return NextResponse.json({
    weeks: weekResults.filter(w => w.status === 'ok').length,
    records: totalRecords,
    details: weekResults,
  })
}

// GET /api/sync-weekly — return status (latest import, missing weeks)
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 7)
  const allMondays = getMondaysSince(new Date('2026-01-05'), cutoff)

  const { data: existing } = await supabase
    .from('weekly_imports')
    .select('week_date, record_count, imported_at')
    .order('week_date', { ascending: false })

  const imported = new Set((existing || []).map(r => r.week_date))
  const missing = allMondays.filter(w => !imported.has(w))

  return NextResponse.json({
    latestWeek: existing?.[0]?.week_date ?? null,
    latestImportedAt: existing?.[0]?.imported_at ?? null,
    totalWeeksImported: existing?.length ?? 0,
    missingWeeks: missing,
  })
}
