/**
 * Import NSW VG weekly sales data for 2026 onwards.
 * Fetches all Mondays from Jan 2026 up to 2 weeks ago (files publish with a lag).
 *
 * Usage:
 *   $env:SUPABASE_SERVICE_KEY="eyJ..." ; node scripts/import-weekly.mjs
 *
 * Flags:
 *   --from YYYYMMDD   Start from this Monday (default: 20260105)
 *   --skip-geocoding  Skip the geocoding step at the end
 *   --dry-run         Print URLs that would be fetched without downloading
 */

import { createClient } from '@supabase/supabase-js'
import JSZip from 'jszip'
import { existsSync } from 'fs'

// ── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL = 'https://ssxbduvljrvnbjnuypkl.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY

if (!SUPABASE_KEY) {
  console.error('\n❌  Missing SUPABASE_SERVICE_KEY\n')
  console.error('Run with:')
  console.error('  $env:SUPABASE_SERVICE_KEY="eyJ..." ; node scripts/import-weekly.mjs\n')
  process.exit(1)
}

const SKIP_GEOCODING = process.argv.includes('--skip-geocoding')
const DRY_RUN = process.argv.includes('--dry-run')

const fromArgIdx = process.argv.indexOf('--from')
const fromArg = process.argv.find(a => a.startsWith('--from='))?.split('=')[1]
  || (fromArgIdx !== -1 ? process.argv[fromArgIdx + 1] : null)

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── Date helpers ──────────────────────────────────────────────────────────────

function toYYYYMMDD(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

/**
 * Generate all Mondays between startDate and endDate (inclusive).
 */
function getMondaysBetween(startDate, endDate) {
  const mondays = []
  const d = new Date(startDate)
  // Snap to next Monday if not already a Monday (1 = Monday)
  const day = d.getDay()
  if (day !== 1) {
    d.setDate(d.getDate() + ((8 - day) % 7))
  }
  while (d <= endDate) {
    mondays.push(new Date(d))
    d.setDate(d.getDate() + 7)
  }
  return mondays
}

// ── NSW VG Parser (B-record format) ──────────────────────────────────────────

function parseNSWVG(content) {
  const records = []
  for (const raw of content.split('\n')) {
    const line = raw.trim().replace(/\r$/, '')
    if (!line.startsWith('B;')) continue
    const cols = line.split(';')
    if (cols.length < 16) continue

    const price = parseInt(cols[15]?.replace(/[^0-9]/g, '') || '0')
    if (!price || price < 10000) continue

    const dateRaw = cols[14]?.trim()
    let sold_date = null
    if (dateRaw?.length === 8 && /^\d{8}$/.test(dateRaw)) {
      sold_date = `${dateRaw.slice(0, 4)}-${dateRaw.slice(4, 6)}-${dateRaw.slice(6, 8)}`
    }
    if (!sold_date) continue

    let land_size = parseFloat(cols[11]?.trim() || '') || null
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

async function parseZip(zip, allRecords, suburbSet) {
  for (const [filename, zipFile] of Object.entries(zip.files)) {
    if (zipFile.dir) continue
    const ext = filename.split('.').pop()?.toLowerCase()
    if (ext === 'zip') {
      const innerBuf = await zipFile.async('arraybuffer')
      const innerZip = await JSZip.loadAsync(innerBuf)
      await parseZip(innerZip, allRecords, suburbSet)
    } else if (ext === 'dat' || ext === 'txt' || ext === 'DAT') {
      const text = await zipFile.async('string')
      const records = parseNSWVG(text)
      allRecords.push(...records)
      for (const r of records) suburbSet.add(`${r.suburb}|${r.state}`)
    }
  }
}

// ── Geocoding ─────────────────────────────────────────────────────────────────

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function geocodeSuburb(suburb, state) {
  try {
    const q = encodeURIComponent(`${suburb} ${state} Australia`)
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${q}&countrycodes=au&format=json&limit=1`,
      { headers: { 'User-Agent': 'PropertyTool/1.0 (private use)' } }
    )
    const data = await res.json()
    if (!data.length) return null
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
  } catch { return null }
}

// ── Fetch already-imported weeks ──────────────────────────────────────────────

async function getImportedWeeks() {
  const { data, error } = await supabase
    .from('weekly_imports')
    .select('week_date')
  if (error) {
    // Table might not exist yet — return empty
    return new Set()
  }
  return new Set((data || []).map(r => r.week_date))
}

async function markWeekImported(weekDate, recordCount) {
  await supabase
    .from('weekly_imports')
    .upsert({ week_date: weekDate, record_count: recordCount, imported_at: new Date().toISOString() },
      { onConflict: 'week_date' })
}

// ── Main ──────────────────────────────────────────────────────────────────────

// Default: start from first Monday of 2026 (2026-01-05)
const startDate = fromArg
  ? new Date(`${fromArg.slice(0, 4)}-${fromArg.slice(4, 6)}-${fromArg.slice(6, 8)}`)
  : new Date('2026-01-05')

// End: 2 weeks ago to allow for publication lag
const endDate = new Date()
endDate.setDate(endDate.getDate() - 14)

const mondays = getMondaysBetween(startDate, endDate)

if (!mondays.length) {
  console.log('\nNo weeks to import — try again next week.\n')
  process.exit(0)
}

console.log(`\n📅 Weekly NSW VG import: ${toYYYYMMDD(startDate)} → ${toYYYYMMDD(endDate)}`)
console.log(`   ${mondays.length} weeks to check\n`)

if (DRY_RUN) {
  console.log('🔍 Dry run — URLs that would be fetched:')
  for (const d of mondays) {
    console.log(`  https://www.valuergeneral.nsw.gov.au/__psi/weekly/${toYYYYMMDD(d)}.zip`)
  }
  console.log()
  process.exit(0)
}

// Check which weeks are already imported
const importedWeeks = await getImportedWeeks()
const toImport = mondays.filter(d => !importedWeeks.has(toYYYYMMDD(d)))

if (!toImport.length) {
  console.log('✅ All weeks already imported. Nothing to do.\n')
  process.exit(0)
}

console.log(`📦 ${importedWeeks.size} weeks already imported, fetching ${toImport.length} new weeks...\n`)

const allRecords = []
const suburbSet = new Set()
let skipped = 0

for (const monday of toImport) {
  const dateStr = toYYYYMMDD(monday)
  const url = `https://www.valuergeneral.nsw.gov.au/__psi/weekly/${dateStr}.zip`
  process.stdout.write(`  ${dateStr}... `)

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'PropertyTool/1.0 (private use)' },
      signal: AbortSignal.timeout(60000),
    })

    if (!res.ok) {
      if (res.status === 404) {
        console.log('not found (skipping)')
        skipped++
        continue
      }
      throw new Error(`HTTP ${res.status}`)
    }

    const buffer = await res.arrayBuffer()
    const zip = await JSZip.loadAsync(buffer)
    const beforeCount = allRecords.length
    await parseZip(zip, allRecords, suburbSet)
    const weekRecords = allRecords.length - beforeCount
    console.log(`${weekRecords.toLocaleString()} records`)
    await markWeekImported(dateStr, weekRecords)

  } catch (err) {
    console.log(`error: ${err.message}`)
  }
}

if (!allRecords.length) {
  console.log(`\n⚠️  No records parsed (${skipped} weeks not found yet).\n`)
  process.exit(0)
}

// Deduplicate
const seen = new Set()
const dedupedRecords = allRecords.filter(r => {
  const key = `${r.address}|${r.suburb}|${r.state}|${r.sold_date}|${r.price}`
  if (seen.has(key)) return false
  seen.add(key)
  return true
})

console.log(`\n✅ ${dedupedRecords.length.toLocaleString()} unique records across ${suburbSet.size} unique suburbs\n`)

// Upload in batches
console.log('⬆️  Uploading to Supabase...')
const BATCH = 1000
let uploaded = 0
for (let i = 0; i < dedupedRecords.length; i += BATCH) {
  const batch = dedupedRecords.slice(i, i + BATCH)
  const { error } = await supabase
    .from('property_sales')
    .upsert(batch, { onConflict: 'address,suburb,state,sold_date,price', ignoreDuplicates: true })
  if (error) console.error(`  Batch error at ${i}: ${error.message}`)
  uploaded += batch.length
  if (uploaded % 10000 === 0 || uploaded === dedupedRecords.length) {
    process.stdout.write(`\r  ${uploaded.toLocaleString()} / ${dedupedRecords.length.toLocaleString()}`)
  }
}
console.log(`\n\n✅ Upload complete\n`)

// Geocode new suburbs
if (SKIP_GEOCODING) {
  console.log('⏭️  Skipping geocoding (--skip-geocoding flag set)\n')
  process.exit(0)
}

const suburbs = Array.from(suburbSet).map(s => {
  const [suburb, state] = s.split('|')
  return { suburb, state }
})

const { data: existing } = await supabase
  .from('suburb_centroids')
  .select('suburb, state')
const existingSet = new Set((existing || []).map(s => `${s.suburb}|${s.state}`))
const toGeocode = suburbs.filter(s => !existingSet.has(`${s.suburb}|${s.state}`))

if (!toGeocode.length) {
  console.log('📍 All suburbs already geocoded.\n')
  process.exit(0)
}

console.log(`📍 Geocoding ${toGeocode.length} new suburbs (~${Math.ceil(toGeocode.length * 1.15 / 60)} min)...\n`)

const geocoded = []
for (let i = 0; i < toGeocode.length; i++) {
  const { suburb, state } = toGeocode[i]
  process.stdout.write(`\r  ${i + 1}/${toGeocode.length}: ${suburb.padEnd(30)}`)
  const coord = await geocodeSuburb(suburb, state)
  if (coord) geocoded.push({ suburb, state, lat: coord.lat, lng: coord.lng })
  await sleep(1150)
}

if (geocoded.length) {
  await supabase
    .from('suburb_centroids')
    .upsert(geocoded, { onConflict: 'suburb,state' })
}

console.log(`\n\n✅ Done! ${geocoded.length} suburbs geocoded.\n`)
