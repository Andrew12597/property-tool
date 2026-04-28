'use client'
import { useState, useRef, useEffect } from 'react'
import { Upload, CheckCircle, AlertCircle, Database, MapPin, RefreshCw, Calendar, Clock } from 'lucide-react'

type Step = 'idle' | 'syncing' | 'geocoding' | 'uploading' | 'done' | 'error'

interface Stats {
  salesCount: number
  suburbCount: number
  latestSaleDate: string | null
  latestWeekImported: string | null
}

interface SyncStatus {
  latestWeek: string | null
  latestImportedAt: string | null
  totalWeeksImported: number
  missingWeeks: string[]
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtWeek(w: string | null) {
  if (!w) return '—'
  return `${w.slice(0, 4)}-${w.slice(4, 6)}-${w.slice(6, 8)}`
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

async function geocodeSuburb(suburb: string, state: string) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(`${suburb} ${state} Australia`)}&countrycodes=au&format=json&limit=1`,
      { headers: { 'User-Agent': 'PropertyTool/1.0' } }
    )
    const data = await res.json()
    if (!data.length) return null
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
  } catch { return null }
}

export default function ImportPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [tab, setTab] = useState<'sync' | 'annual' | 'file'>('sync')
  const [nswYear, setNswYear] = useState(new Date().getFullYear())
  const [step, setStep] = useState<Step>('idle')
  const [progress, setProgress] = useState('')
  const [syncResult, setSyncResult] = useState<{ weeks: number; records: number; details: any[] } | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [stats, setStats] = useState<Stats | null>(null)
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null)

  const loadAll = async () => {
    const [s1, s2] = await Promise.all([
      fetch('/api/import').then(r => r.ok ? r.json() : null),
      fetch('/api/sync-weekly').then(r => r.ok ? r.json() : null),
    ])
    if (s1) setStats(s1)
    if (s2) setSyncStatus(s2)
  }

  useEffect(() => { loadAll() }, [])

  // ── Manual sync ────────────────────────────────────────────────────────────
  const handleSync = async () => {
    setStep('syncing')
    setProgress('Checking for new weekly data…')
    setErrorMsg('')
    setSyncResult(null)
    try {
      const res = await fetch('/api/sync-weekly', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Sync failed')
      setSyncResult(data)
      setStep('done')
      loadAll()
    } catch (err: any) {
      setErrorMsg(err.message)
      setStep('error')
    }
  }

  // ── Annual import ──────────────────────────────────────────────────────────
  const handleAnnual = async () => {
    setStep('syncing')
    setProgress('Downloading annual data…')
    setErrorMsg('')
    setSyncResult(null)
    const url = `https://www.valuergeneral.nsw.gov.au/__psi/yearly/${nswYear}.zip`
    try {
      const res = await fetch('/api/fetch-govt-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Download failed')
      setSyncResult({ weeks: 1, records: data.records, details: [] })
      setStep('done')
      loadAll()
    } catch (err: any) {
      setErrorMsg(err.message)
      setStep('error')
    }
  }

  // ── File upload ────────────────────────────────────────────────────────────
  const handleFile = async () => {
    const file = fileRef.current?.files?.[0]
    if (!file) return
    setStep('syncing')
    setProgress('Reading file…')
    setErrorMsg('')
    setSyncResult(null)
    try {
      // Send to fetch-govt-data as a file upload isn't supported, so read & POST records
      setProgress('This feature requires re-implementation — use Sync or Annual instead.')
      setStep('error')
      setErrorMsg('File upload coming soon. Use Sync or Annual import instead.')
    } catch (err: any) {
      setErrorMsg(err.message)
      setStep('error')
    }
  }

  const busy = step === 'syncing' || step === 'geocoding' || step === 'uploading'

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Data Import</h1>
        <p className="text-sm text-gray-500 mt-1">NSW government property sales data — 2015 to present</p>
      </div>

      {/* ── Status panel ─────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Database status</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
          {[
            { icon: Database, color: 'text-blue-500', label: 'Sales records', value: stats?.salesCount?.toLocaleString() ?? '…' },
            { icon: MapPin, color: 'text-emerald-500', label: 'Suburbs geocoded', value: stats?.suburbCount?.toLocaleString() ?? '…' },
            { icon: Calendar, color: 'text-purple-500', label: 'Most recent sale', value: fmtDate(stats?.latestSaleDate ?? null) },
            { icon: Clock, color: 'text-amber-500', label: 'Latest week loaded', value: fmtWeek(syncStatus?.latestWeek ?? null) },
          ].map(({ icon: Icon, color, label, value }) => (
            <div key={label} className="flex items-start gap-2.5">
              <Icon size={16} className={`${color} mt-0.5 shrink-0`} />
              <div>
                <p className="text-xs text-gray-400 leading-tight">{label}</p>
                <p className="font-semibold text-gray-900 text-sm mt-0.5">{value}</p>
              </div>
            </div>
          ))}
        </div>

        {syncStatus && syncStatus.missingWeeks.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-amber-800">{syncStatus.missingWeeks.length} new week{syncStatus.missingWeeks.length > 1 ? 's' : ''} available</p>
              <p className="text-xs text-amber-600 mt-0.5">
                Up to {fmtWeek(syncStatus.missingWeeks[syncStatus.missingWeeks.length - 1])}
              </p>
            </div>
            <button onClick={handleSync} disabled={busy}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white text-sm font-semibold rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors shrink-0">
              <RefreshCw size={14} className={busy ? 'animate-spin' : ''} />
              Sync now
            </button>
          </div>
        )}

        {syncStatus && syncStatus.missingWeeks.length === 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5 mb-4 flex items-center justify-between">
            <p className="text-sm text-emerald-700 font-medium">✓ Data is up to date</p>
            <button onClick={handleSync} disabled={busy}
              className="flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-800 transition-colors">
              <RefreshCw size={12} className={busy ? 'animate-spin' : ''} />
              Check again
            </button>
          </div>
        )}

        <button onClick={handleSync} disabled={busy}
          className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm">
          <RefreshCw size={15} className={busy ? 'animate-spin' : ''} />
          {busy ? progress || 'Syncing…' : 'Manually sync latest weekly data'}
        </button>
        <p className="text-xs text-gray-400 text-center mt-2">Auto-runs every Tuesday at 9am · NSW Valuer General weekly files</p>
      </div>

      {/* ── Result / error ────────────────────────────────────────────────── */}
      {step === 'done' && syncResult && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3 mb-6">
          <CheckCircle size={18} className="text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-emerald-800 text-sm">
              {syncResult.records > 0 ? `${syncResult.records.toLocaleString()} new records added` : 'Already up to date'}
            </p>
            {syncResult.weeks > 0 && (
              <p className="text-xs text-emerald-600 mt-1">{syncResult.weeks} week{syncResult.weeks > 1 ? 's' : ''} imported</p>
            )}
            {syncResult.details?.filter((d: any) => d.status === 'ok').map((d: any) => (
              <p key={d.week} className="text-xs text-emerald-600">✓ {fmtWeek(d.week)} — {d.records.toLocaleString()} records</p>
            ))}
          </div>
        </div>
      )}

      {step === 'error' && errorMsg && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 mb-6">
          <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{errorMsg}</p>
        </div>
      )}

      {/* ── Tabs for other import options ────────────────────────────────── */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-4">
        {([['annual', 'Import full year'], ['file', 'Upload file']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id as any)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${tab === id ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'annual' && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <p className="text-xs text-gray-500">Import an entire year of NSW sales data. Only needed for years not already in the database (2015–2025 already loaded).</p>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Year</label>
            <select value={nswYear} onChange={e => setNswYear(parseInt(e.target.value))}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400 bg-white">
              {Array.from({ length: 12 }, (_, i) => new Date().getFullYear() - i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div className="bg-gray-50 rounded-lg px-4 py-2.5 text-xs text-gray-500 font-mono break-all">
            https://www.valuergeneral.nsw.gov.au/__psi/yearly/{nswYear}.zip
          </div>
          <button onClick={handleAnnual} disabled={busy}
            className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm">
            {busy ? 'Importing…' : `Import ${nswYear} data`}
          </button>
        </div>
      )}

      {tab === 'file' && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs text-gray-500 mb-4">Upload a NSW Valuer General .DAT file directly from your computer.</p>
          <div onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-colors">
            <Upload size={24} className="mx-auto mb-2 text-gray-400" />
            <p className="text-sm text-gray-600 font-medium">Click to select .DAT or .ZIP file</p>
          </div>
          <input ref={fileRef} type="file" accept=".dat,.txt,.DAT,.zip,.ZIP" className="hidden" />
          <p className="text-xs text-gray-400 mt-3 text-center">Coming soon — use Sync or Annual import in the meantime.</p>
        </div>
      )}
    </div>
  )
}
