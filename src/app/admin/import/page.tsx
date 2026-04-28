'use client'
import { useState, useRef } from 'react'
import { Upload, CheckCircle, AlertCircle, Database, MapPin, Link as LinkIcon } from 'lucide-react'

interface ParsedRecord {
  address: string
  suburb: string
  state: string
  price: number
  sold_date: string
  land_size: number | null
  property_type: string | null
}

type Step = 'idle' | 'parsing' | 'geocoding' | 'uploading' | 'done' | 'error'

function parseNSWVG(content: string): ParsedRecord[] {
  const lines = content.split('\n')
  const records: ParsedRecord[] = []

  for (const raw of lines) {
    const line = raw.trim()
    if (!line || line.startsWith(';') || line.startsWith('B;') === false && !line.match(/^[A-Z];/)) {
      // Try to parse anyway if it has semicolons
      if (!line.includes(';')) continue
    }

    const cols = line.split(';')
    if (cols.length < 13) continue

    const price = parseInt(cols[12]?.replace(/[^0-9]/g, '') || '0')
    if (!price || price < 10000) continue

    const dateRaw = cols[11]?.trim()
    let sold_date: string | null = null
    if (dateRaw && dateRaw.length === 8 && /^\d{8}$/.test(dateRaw)) {
      sold_date = `${dateRaw.slice(0, 4)}-${dateRaw.slice(4, 6)}-${dateRaw.slice(6, 8)}`
    } else if (dateRaw && dateRaw.includes('/')) {
      // DD/MM/YYYY format
      const parts = dateRaw.split('/')
      if (parts.length === 3) sold_date = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
    }
    if (!sold_date) continue

    let land_size: number | null = parseFloat(cols[8]?.trim() || '') || null
    const areaType = cols[9]?.trim()
    if (land_size && areaType === 'H') land_size = Math.round(land_size * 10000)
    if (land_size && land_size > 100000) land_size = null // skip obviously wrong values

    const propertyCode = cols[7]?.trim()
    let property_type: string | null = null
    if (propertyCode === 'A') property_type = 'House'
    else if (propertyCode === 'C') property_type = 'Land'
    else if (propertyCode === 'D' || propertyCode === 'E') property_type = 'Commercial'

    const address = cols[5]?.trim()
    const suburb = cols[6]?.trim().toUpperCase()

    if (!address || !suburb) continue

    records.push({ address, suburb, state: 'NSW', price, sold_date, land_size, property_type })
  }

  return records
}

function parseGenericCSV(content: string): ParsedRecord[] {
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase())
  const records: ParsedRecord[] = []

  const col = (row: string[], name: string) => {
    const idx = headers.indexOf(name)
    return idx >= 0 ? row[idx]?.replace(/"/g, '').trim() : ''
  }

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',')
    const price = parseInt(col(cols, 'price')?.replace(/[^0-9]/g, '') || '0')
    if (!price || price < 10000) continue

    const suburb = col(cols, 'suburb')?.toUpperCase()
    const state = col(cols, 'state')?.toUpperCase() || 'NSW'
    if (!suburb) continue

    let sold_date = col(cols, 'date')
    // Try to normalise date to YYYY-MM-DD
    if (sold_date && sold_date.includes('/')) {
      const parts = sold_date.split('/')
      if (parts.length === 3) {
        if (parts[2].length === 4) sold_date = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
        else sold_date = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`
      }
    }
    if (!sold_date) continue

    const land_size = parseFloat(col(cols, 'land_size') || '') || null

    records.push({
      address: col(cols, 'address'),
      suburb,
      state,
      price,
      sold_date,
      land_size,
      property_type: col(cols, 'property_type') || null,
    })
  }

  return records
}

async function geocodeSuburb(suburb: string, state: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const q = encodeURIComponent(`${suburb} ${state} Australia`)
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&countrycodes=au&format=json&limit=1`, {
      headers: { 'User-Agent': 'PropertyTool/1.0' }
    })
    const data = await res.json()
    if (!data.length) return null
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
  } catch {
    return null
  }
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

export default function ImportPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [tab, setTab] = useState<'nsw' | 'file'>('nsw')
  const [nswMode, setNswMode] = useState<'annual' | 'weekly'>('annual')
  const [nswYear, setNswYear] = useState(new Date().getFullYear())
  const [nswWeekDate, setNswWeekDate] = useState('')
  const [downloadUrl, setDownloadUrl] = useState('')
  const [format, setFormat] = useState<'nsw-vg' | 'csv'>('nsw-vg')
  const [step, setStep] = useState<Step>('idle')
  const [progress, setProgress] = useState('')
  const [stats, setStats] = useState<{ salesCount: number; suburbCount: number } | null>(null)
  const [result, setResult] = useState<{ records: number; suburbs: number } | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  const loadStats = async () => {
    const res = await fetch('/api/import')
    if (res.ok) setStats(await res.json())
  }

  useState(() => { loadStats() })

  const geocodeAndUploadSuburbs = async (suburbs: { suburb: string; state: string }[]) => {
    const geocoded: { suburb: string; state: string; lat: number; lng: number }[] = []
    let geo = 0
    for (const { suburb, state } of suburbs) {
      setProgress(`Geocoding suburbs… ${++geo}/${suburbs.length} (${suburb})`)
      const coord = await geocodeSuburb(suburb, state)
      if (coord) geocoded.push({ suburb, state, ...coord })
      await sleep(1150)
    }
    if (geocoded.length) {
      setProgress('Saving suburb locations…')
      await fetch('/api/import', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geocoded),
      })
    }
    return geocoded.length
  }

  const handleSyncAll2026 = async () => {
    setStep('parsing')
    setErrorMsg('')

    // Generate all Mondays from 2026-01-05 up to 2 weeks ago
    const mondays: string[] = []
    const d = new Date('2026-01-05')
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 14)
    while (d <= cutoff) {
      mondays.push(d.toISOString().slice(0, 10).replace(/-/g, ''))
      d.setDate(d.getDate() + 7)
    }

    // Check already-imported weeks
    let importedWeeks = new Set<string>()
    try {
      const res = await fetch('/api/import?type=weekly')
      if (res.ok) {
        const data = await res.json()
        importedWeeks = new Set(data.importedWeeks || [])
      }
    } catch { /* if table doesn't exist yet, import all */ }

    const toImport = mondays.filter(w => !importedWeeks.has(w))

    if (!toImport.length) {
      setProgress('All 2026 weeks already imported!')
      setResult({ records: 0, suburbs: 0 })
      setStep('done')
      return
    }

    setProgress(`Found ${toImport.length} weeks to import (${importedWeeks.size} already done)…`)

    let totalRecords = 0
    const allSuburbs: { suburb: string; state: string }[] = []
    const suburbsSeen = new Set<string>()

    for (let i = 0; i < toImport.length; i++) {
      const dateStr = toImport[i]
      const url = `https://www.valuergeneral.nsw.gov.au/__psi/weekly/${dateStr}.zip`
      setProgress(`Importing week ${i + 1}/${toImport.length}: ${dateStr.slice(0,4)}-${dateStr.slice(4,6)}-${dateStr.slice(6,8)}…`)

      try {
        const res = await fetch('/api/fetch-govt-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, trackWeek: dateStr }),
        })
        const data = await res.json()
        if (!res.ok) {
          if (data.error?.includes('404') || data.error?.includes('not found')) continue
          console.error(`Week ${dateStr}: ${data.error}`)
          continue
        }
        totalRecords += data.records
        for (const s of (data.suburbs || [])) {
          const key = `${s.suburb}|${s.state}`
          if (!suburbsSeen.has(key)) {
            suburbsSeen.add(key)
            allSuburbs.push(s)
          }
        }
      } catch (err: any) {
        console.error(`Week ${dateStr}: ${err.message}`)
      }
    }

    setProgress(`Imported ${totalRecords.toLocaleString()} records. Geocoding ${allSuburbs.length} new suburbs…`)
    setStep('geocoding')
    const geocodedCount = await geocodeAndUploadSuburbs(allSuburbs)
    setResult({ records: totalRecords, suburbs: geocodedCount })
    setStep('done')
    loadStats()
  }

  const handleUrlImport = async (overrideUrl?: string) => {
    const url = overrideUrl ?? downloadUrl.trim()
    if (!url) return
    setStep('parsing')
    setProgress('Downloading file from government website…')
    setErrorMsg('')

    try {
      const res = await fetch('/api/fetch-govt-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Download failed')

      setProgress(`Imported ${data.records.toLocaleString()} records. Now geocoding ${data.suburbs.length} suburbs…`)
      setStep('geocoding')

      const geocodedCount = await geocodeAndUploadSuburbs(data.suburbs)

      setResult({ records: data.records, suburbs: geocodedCount })
      setStep('done')
      loadStats()
    } catch (err: any) {
      setErrorMsg(err.message || 'Import failed')
      setStep('error')
    }
  }

  const handleImport = async () => {
    const file = fileRef.current?.files?.[0]
    if (!file) return

    setStep('parsing')
    setProgress('Reading file…')
    setErrorMsg('')

    try {
      const content = await file.text()

      // Parse
      setProgress('Parsing records…')
      const records = format === 'nsw-vg' ? parseNSWVG(content) : parseGenericCSV(content)

      if (!records.length) {
        setErrorMsg('No valid records found. Check the file format.')
        setStep('error')
        return
      }

      setProgress(`Found ${records.length.toLocaleString()} records. Identifying unique suburbs…`)

      // Extract unique suburbs
      const suburbMap = new Map<string, string>() // "SUBURB|STATE" -> state
      for (const r of records) {
        suburbMap.set(`${r.suburb}|${r.state}`, r.state)
      }
      const uniqueSuburbs = Array.from(suburbMap.entries()).map(([key, state]) => ({
        suburb: key.split('|')[0],
        state,
      }))

      // Geocode suburbs
      setStep('geocoding')
      const geocodedCount = await geocodeAndUploadSuburbs(uniqueSuburbs)

      // Upload property sales in batches
      setStep('uploading')
      const batchSize = 500
      let uploaded = 0
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize)
        setProgress(`Uploading records… ${Math.min(i + batchSize, records.length).toLocaleString()} / ${records.length.toLocaleString()}`)
        await fetch('/api/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(batch),
        })
        uploaded += batch.length
      }

      setResult({ records: uploaded, suburbs: geocodedCount })
      setStep('done')
      loadStats()

    } catch (err: any) {
      setErrorMsg(err.message || 'Import failed')
      setStep('error')
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Import Property Sales Data</h1>
        <p className="text-sm text-gray-500 mt-1">Load NSW/QLD government sales data to power the Comps search — free, no API needed.</p>
      </div>

      {/* Current DB stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
            <Database size={20} className="text-blue-500" />
            <div>
              <p className="text-xs text-gray-400">Sales in database</p>
              <p className="font-bold text-gray-900">{stats.salesCount.toLocaleString()}</p>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
            <MapPin size={20} className="text-emerald-500" />
            <div>
              <p className="text-xs text-gray-400">Suburbs geocoded</p>
              <p className="font-bold text-gray-900">{stats.suburbCount.toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6">
        {([['nsw', Database, 'NSW Govt Data'], ['file', Upload, 'Upload a file']] as const).map(([id, Icon, label]) => (
          <button key={id} onClick={() => setTab(id as any)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${tab === id ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {/* NSW tab */}
      {tab === 'nsw' && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4 space-y-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Data source</p>
            <div className="flex gap-2">
              {([['annual', 'Annual (full year)'], ['weekly', 'Weekly update']] as const).map(([id, label]) => (
                <button key={id} onClick={() => setNswMode(id)}
                  className={`flex-1 py-2.5 rounded-lg border-2 text-sm font-medium transition-colors ${nswMode === id ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {nswMode === 'annual' && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Year</label>
              <select value={nswYear} onChange={e => setNswYear(parseInt(e.target.value))}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400 bg-white">
                {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-2">Full year of NSW property sales — larger file, takes longer to import.</p>
            </div>
          )}

          {nswMode === 'weekly' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Week ending (Monday)</label>
                <input type="date" value={nswWeekDate} onChange={e => setNswWeekDate(e.target.value)}
                  max={new Date().toISOString().slice(0, 10)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400 bg-white" />
                <p className="text-xs text-gray-400 mt-2">One specific week. Or use <strong>Sync all 2026 weeks</strong> below to catch up automatically.</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-blue-800 mb-1">Sync all 2026 weeks at once</p>
                <p className="text-xs text-blue-600 mb-3">Automatically fetches every Monday from Jan 2026 to 2 weeks ago. Already-imported weeks are skipped. Run this weekly to stay current.</p>
                {(step === 'idle' || step === 'error' || step === 'done') && (
                  <button onClick={handleSyncAll2026}
                    className="w-full py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors text-sm">
                    Sync all 2026 weeks
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="bg-gray-50 rounded-lg px-4 py-3 text-xs text-gray-500 font-mono break-all">
            {nswMode === 'annual'
              ? `https://www.valuergeneral.nsw.gov.au/__psi/yearly/${nswYear}.zip`
              : nswWeekDate
                ? `https://www.valuergeneral.nsw.gov.au/__psi/weekly/${nswWeekDate.replace(/-/g, '')}.zip`
                : 'Select a date above'}
          </div>

          {(step === 'idle' || step === 'error' || step === 'done') && (
            <button
              onClick={() => {
                const url = nswMode === 'annual'
                  ? `https://www.valuergeneral.nsw.gov.au/__psi/yearly/${nswYear}.zip`
                  : `https://www.valuergeneral.nsw.gov.au/__psi/weekly/${nswWeekDate.replace(/-/g, '')}.zip`
                handleUrlImport(url)
              }}
              disabled={nswMode === 'weekly' && !nswWeekDate}
              className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm">
              Import NSW Data
            </button>
          )}
        </div>
      )}

      {/* File tab */}
      {tab === 'file' && (
        <>
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">File Format</p>
            <div className="flex gap-3">
              {[
                { id: 'nsw-vg', label: 'NSW Valuer General', desc: 'Semicolon-delimited .DAT file' },
                { id: 'csv', label: 'Generic CSV', desc: 'Headers: address, suburb, state, price, date, land_size, property_type' },
              ].map(f => (
                <button key={f.id} onClick={() => setFormat(f.id as any)}
                  className={`flex-1 text-left p-3 rounded-lg border-2 transition-colors ${format === f.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <p className={`font-medium text-sm ${format === f.id ? 'text-blue-700' : 'text-gray-700'}`}>{f.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{f.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Select File</p>
            <div onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-colors">
              <Upload size={24} className="mx-auto mb-2 text-gray-400" />
              <p className="text-sm text-gray-600 font-medium">Click to select file</p>
              <p className="text-xs text-gray-400 mt-1">{format === 'nsw-vg' ? '.DAT or .txt file' : '.CSV file'}</p>
            </div>
            <input ref={fileRef} type="file" accept={format === 'nsw-vg' ? '.dat,.txt,.DAT' : '.csv'} className="hidden" />
          </div>

          {(step === 'idle' || step === 'error' || step === 'done') && (
            <button onClick={handleImport}
              className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors text-sm mb-4">
              Start Import
            </button>
          )}
        </>
      )}

      {/* Progress */}
      {(step === 'parsing' || step === 'geocoding' || step === 'uploading') && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium text-gray-700">
              {step === 'parsing' ? 'Parsing file…' : step === 'geocoding' ? 'Geocoding suburbs…' : 'Uploading to database…'}
            </p>
          </div>
          <p className="text-xs text-gray-400">{progress}</p>
          {step === 'geocoding' && (
            <p className="text-xs text-amber-600 mt-2">Geocoding takes ~1 sec per suburb to stay within free rate limits. Please keep this tab open.</p>
          )}
        </div>
      )}

      {/* Success */}
      {step === 'done' && result && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 flex items-start gap-3">
          <CheckCircle size={20} className="text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-emerald-800">Import complete</p>
            <p className="text-sm text-emerald-700 mt-1">
              {result.records.toLocaleString()} property sales imported · {result.suburbs} suburbs geocoded
            </p>
            <p className="text-xs text-emerald-600 mt-2">Head to <strong>Comps</strong> to search your data.</p>
          </div>
        </div>
      )}

      {/* Error */}
      {step === 'error' && errorMsg && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{errorMsg}</p>
        </div>
      )}
    </div>
  )
}
