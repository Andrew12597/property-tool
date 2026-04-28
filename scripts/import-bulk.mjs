/**
 * Bulk import NSW Valuer General ZIP files into Supabase.
 * Usage: node scripts/import-bulk.mjs
 *
 * Requires SUPABASE_SERVICE_KEY env var:
 *   $env:SUPABASE_SERVICE_KEY="eyJ..." ; node scripts/import-bulk.mjs
 */

import { createClient } from '@supabase/supabase-js'
import JSZip from 'jszip'
import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'

// ── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL = 'https://ssxbduvljrvnbjnuypkl.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY

if (!SUPABASE_KEY) {
  console.error('\n❌  Missing SUPABASE_SERVICE_KEY\n')
  console.error('Run with:')
  console.error('  $env:SUPABASE_SERVICE_KEY="eyJ..." ; node scripts/import-bulk.mjs\n')
  process.exit(1)
}

const DOWNLOADS = 'C:/Users/andre/Downloads'
const SKIP_GEOCODING = process.argv.includes('--skip-geocoding')
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── NSW VG Parser ─────────────────────────────────────────────────────────────

function parseNSWVG(content) {
  // Format: B;district;propId;counter;downloadDate;;; streetNum;streetName;suburb;postcode;area;areaType;contractDate;settlementDate;price;zoning;propType;...
  const records = []
  for (const raw of content.split('\n')) {
    const line = raw.trim().replace(/\r$/, '')
    if (!line.startsWith('B;')) continue
    const cols = line.split(';')
    if (cols.length < 16) continue

    const price = parseInt(cols[15]?.replace(/[^0-9]/g, '') || '0')
    if (!price || price < 10000) continue

    const dateRaw = cols[14]?.trim() // settlement date YYYYMMDD
    let sold_date = null
    if (dateRaw?.length === 8 && /^\d{8}$/.test(dateRaw)) {
      sold_date = `${dateRaw.slice(0,4)}-${dateRaw.slice(4,6)}-${dateRaw.slice(6,8)}`
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

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Main ──────────────────────────────────────────────────────────────────────

if (!existsSync(DOWNLOADS)) {
  console.error(`Downloads folder not found: ${DOWNLOADS}`)
  process.exit(1)
}

const zipFiles = readdirSync(DOWNLOADS)
  .filter(f => /^\d{4}\.zip$/i.test(f))
  .sort()

if (!zipFiles.length) {
  console.error(`No year ZIPs found in ${DOWNLOADS} (e.g. 2024.zip)`)
  process.exit(1)
}

console.log(`\n📦 Found ${zipFiles.length} ZIP files: ${zipFiles.join(', ')}\n`)

// Parse all ZIPs
const allRecords = []
const suburbSet = new Set()

async function parseZip(zip) {
  let count = 0
  for (const [filename, zipFile] of Object.entries(zip.files)) {
    if (zipFile.dir) continue
    const ext = filename.split('.').pop()?.toLowerCase()

    if (ext === 'zip') {
      // Nested ZIP — recurse
      const innerBuf = await zipFile.async('arraybuffer')
      const innerZip = await JSZip.loadAsync(innerBuf)
      count += await parseZip(innerZip)
    } else if (ext === 'dat' || ext === 'txt' || ext === 'DAT') {
      const text = await zipFile.async('string')
      const records = parseNSWVG(text)
      allRecords.push(...records)
      count += records.length
      for (const r of records) suburbSet.add(`${r.suburb}|${r.state}`)
    }
  }
  return count
}

for (const file of zipFiles) {
  process.stdout.write(`Parsing ${file}... `)
  const buffer = readFileSync(join(DOWNLOADS, file))
  const zip = await JSZip.loadAsync(buffer)
  const count = await parseZip(zip)
  console.log(`${count.toLocaleString()} records`)
}

// Deduplicate by conflict key
const seen = new Set()
const dedupedRecords = allRecords.filter(r => {
  const key = `${r.address}|${r.suburb}|${r.state}|${r.sold_date}|${r.price}`
  if (seen.has(key)) return false
  seen.add(key)
  return true
})
console.log(`\n✅ Total: ${dedupedRecords.length.toLocaleString()} unique records across ${suburbSet.size} unique suburbs\n`)

// Upload to Supabase in batches
const allRecordsToUpload = dedupedRecords
console.log('⬆️  Uploading to Supabase...')
const BATCH = 1000
let uploaded = 0

for (let i = 0; i < allRecordsToUpload.length; i += BATCH) {
  const batch = allRecordsToUpload.slice(i, i + BATCH)
  const { error } = await supabase
    .from('property_sales')
    .upsert(batch, { onConflict: 'address,suburb,state,sold_date,price', ignoreDuplicates: true })
  if (error) console.error(`  Batch error at ${i}: ${error.message}`)
  uploaded += batch.length
  if (uploaded % 50000 === 0 || uploaded === allRecordsToUpload.length) {
    console.log(`  ${uploaded.toLocaleString()} / ${allRecordsToUpload.length.toLocaleString()}`)
  }
}

console.log(`\n✅ Upload complete: ${uploaded.toLocaleString()} records\n`)

// Geocode suburbs
if (SKIP_GEOCODING) {
  console.log('⏭️  Skipping geocoding (--skip-geocoding flag set)')
  console.log('   Run again without the flag to geocode suburbs for radius search.\n')
  process.exit(0)
}

const suburbs = Array.from(suburbSet).map(s => {
  const [suburb, state] = s.split('|')
  return { suburb, state }
})

// Skip already-geocoded suburbs
const { data: existing } = await supabase
  .from('suburb_centroids')
  .select('suburb, state')
const existingSet = new Set((existing || []).map(s => `${s.suburb}|${s.state}`))
const toGeocode = suburbs.filter(s => !existingSet.has(`${s.suburb}|${s.state}`))

console.log(`📍 Geocoding ${toGeocode.length} new suburbs (${existingSet.size} already done)...`)
console.log(`   Estimated time: ~${Math.ceil(toGeocode.length * 1.15 / 60)} minutes — keep this terminal open.\n`)

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
console.log('🏠 Your Comps search is now powered by NSW government data.\n')
