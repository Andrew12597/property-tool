'use client'
import { useState } from 'react'
import { MapPin, Search, TrendingUp, DollarSign, Database, Navigation } from 'lucide-react'
import { formatCurrencyFull, formatNumber, cn } from '@/lib/utils'
import Link from 'next/link'

interface SoldProperty {
  id: number
  address: string
  suburb: string
  state: string
  postcode: string | null
  price: number
  sold_date: string
  land_size: number | null
  property_type: string | null
  pricePerM2: number | null
}

const PROPERTY_TYPES = ['House', 'Land']

export default function CompsPage() {
  const [searchMode, setSearchMode] = useState<'radius' | 'street'>('radius')

  // Radius mode
  const [address, setAddress] = useState('')
  const [radiusKm, setRadiusKm] = useState(1)

  // Street mode
  const [streetName, setStreetName] = useState('')
  const [suburbFilter, setSuburbFilter] = useState('')

  // Common filters
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [minLand, setMinLand] = useState('')
  const [maxLand, setMaxLand] = useState('')
  const [soldAfterMonths, setSoldAfterMonths] = useState(24)
  const [propertyTypes, setPropertyTypes] = useState<string[]>([])

  const [results, setResults] = useState<SoldProperty[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)
  const [noSuburbs, setNoSuburbs] = useState(false)

  const toggleType = (t: string) =>
    setPropertyTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])

  const search = async () => {
    if (searchMode === 'radius' && !address.trim()) return
    if (searchMode === 'street' && !streetName.trim()) return

    setLoading(true)
    setError(null)
    setSearched(true)
    setNoSuburbs(false)

    try {
      const body: any = {
        mode: searchMode,
        minPrice: minPrice ? parseInt(minPrice) : undefined,
        maxPrice: maxPrice ? parseInt(maxPrice) : undefined,
        minLandSize: minLand ? parseInt(minLand) : undefined,
        maxLandSize: maxLand ? parseInt(maxLand) : undefined,
        soldAfterMonths,
        propertyTypes: propertyTypes.length ? propertyTypes : undefined,
      }

      if (searchMode === 'radius') {
        body.address = address
        body.radiusKm = radiusKm
      } else {
        body.streetName = streetName
        body.suburb = suburbFilter
      }

      const res = await fetch('/api/comps-internal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Search failed')
      if (data.noSuburbs) { setNoSuburbs(true); setResults([]); return }

      const sales: SoldProperty[] = (data.results || []).map((r: any) => ({
        ...r,
        pricePerM2: r.price && r.land_size ? Math.round(r.price / r.land_size) : null,
      }))
      setResults(sales)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const avgPrice = results.length ? results.reduce((s, r) => s + r.price, 0) / results.length : 0
  const avgPricePerM2 = (() => {
    const withM2 = results.filter(r => r.pricePerM2)
    return withM2.length ? withM2.reduce((s, r) => s + r.pricePerM2!, 0) / withM2.length : 0
  })()

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Comps Finder</h1>
        <p className="text-sm text-gray-500 mt-0.5">Search sold properties from NSW/QLD government data</p>
      </div>

      {/* Search form */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">

        {/* Mode toggle */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg mb-4">
          {([['radius', MapPin, 'Suburb / Radius'], ['street', Navigation, 'Street Name']] as const).map(([id, Icon, label]) => (
            <button key={id} onClick={() => setSearchMode(id)}
              className={cn('flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-semibold transition-all',
                searchMode === id ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700')}>
              <Icon size={13} />{label}
            </button>
          ))}
        </div>

        {/* Radius mode inputs */}
        {searchMode === 'radius' && (
          <div className="flex gap-3 mb-4">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Suburb or address</label>
              <div className="flex items-center border border-gray-200 rounded-lg focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-100 transition-all">
                <MapPin size={15} className="ml-3 text-gray-400 shrink-0" />
                <input type="text" value={address} onChange={e => setAddress(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && search()}
                  placeholder="Parramatta NSW"
                  className="flex-1 px-3 py-2.5 text-sm bg-transparent outline-none" />
              </div>
            </div>
            <div className="w-28">
              <label className="block text-xs font-medium text-gray-600 mb-1">Radius</label>
              <div className="flex items-center border border-gray-200 rounded-lg">
                <input type="number" value={radiusKm} onChange={e => setRadiusKm(parseFloat(e.target.value) || 1)}
                  step={0.5} min={0.5} onFocus={e => e.target.select()}
                  className="flex-1 px-3 py-2.5 text-sm outline-none w-0" />
                <span className="pr-3 text-gray-400 text-sm">km</span>
              </div>
            </div>
          </div>
        )}

        {/* Street mode inputs */}
        {searchMode === 'street' && (
          <div className="flex gap-3 mb-4">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Street name</label>
              <div className="flex items-center border border-gray-200 rounded-lg focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-100 transition-all">
                <Navigation size={15} className="ml-3 text-gray-400 shrink-0" />
                <input type="text" value={streetName} onChange={e => setStreetName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && search()}
                  placeholder="George Street"
                  className="flex-1 px-3 py-2.5 text-sm bg-transparent outline-none" />
              </div>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Suburb (optional)</label>
              <input type="text" value={suburbFilter} onChange={e => setSuburbFilter(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && search()}
                placeholder="e.g. Sydney"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-blue-400" />
            </div>
          </div>
        )}

        {/* Common filters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Sold within</label>
            <div className="flex items-center border border-gray-200 rounded-lg bg-white">
              <input type="number" value={soldAfterMonths} onChange={e => setSoldAfterMonths(parseInt(e.target.value) || 24)} min={1} onFocus={e => e.target.select()} className="flex-1 px-3 py-2 text-sm outline-none" />
              <span className="pr-3 text-gray-400 text-sm">mths</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Min price</label>
            <div className="flex items-center border border-gray-200 rounded-lg bg-white">
              <span className="pl-3 text-gray-400 text-sm">$</span>
              <input type="number" value={minPrice} onChange={e => setMinPrice(e.target.value)} onFocus={e => e.target.select()} placeholder="Any" className="flex-1 px-2 py-2 text-sm outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Max price</label>
            <div className="flex items-center border border-gray-200 rounded-lg bg-white">
              <span className="pl-3 text-gray-400 text-sm">$</span>
              <input type="number" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} onFocus={e => e.target.select()} placeholder="Any" className="flex-1 px-2 py-2 text-sm outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Min land (m²)</label>
            <input type="number" value={minLand} onChange={e => setMinLand(e.target.value)} onFocus={e => e.target.select()} placeholder="Any" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-blue-400" />
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Property type</label>
            <div className="flex flex-wrap gap-2">
              {PROPERTY_TYPES.map(t => (
                <button key={t} onClick={() => toggleType(t)}
                  className={cn('px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                    propertyTypes.includes(t) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300')}>
                  {t}
                </button>
              ))}
              <span className="text-xs text-gray-400 self-center ml-1">Note: govt data doesn't split House/Unit/Duplex</span>
            </div>
          </div>

          <button onClick={search}
            disabled={loading || (searchMode === 'radius' ? !address.trim() : !streetName.trim())}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors shrink-0">
            <Search size={15} />
            {loading ? 'Searching…' : 'Find Comps'}
          </button>
        </div>
      </div>

      {/* No suburb data banner */}
      {noSuburbs && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6">
          <p className="font-semibold text-amber-800 text-sm mb-1">No suburb data near this address</p>
          <p className="text-amber-700 text-sm">You need to import government property sales data first.</p>
          <Link href="/admin/import" className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors">
            <Database size={14} /> Go to Import Data
          </Link>
        </div>
      )}

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-6">{error}</div>}

      {results.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: 'Properties found', value: results.length.toString(), icon: MapPin },
              { label: 'Average sale price', value: formatCurrencyFull(avgPrice), icon: DollarSign },
              { label: 'Avg $/m²', value: avgPricePerM2 ? `$${formatNumber(avgPricePerM2)}` : '—', icon: TrendingUp },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
                <div className="bg-blue-50 rounded-lg p-2 text-blue-600"><Icon size={18} /></div>
                <div>
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="font-semibold text-gray-900 text-sm">{value}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Results</p>
              <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-1 rounded-full">NSW/QLD Govt Data</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Address</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Sale Price</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Land m²</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">$/m²</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Sold</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {results.sort((a, b) => b.sold_date.localeCompare(a.sold_date)).map((p, i) => (
                    <tr key={p.id} className={cn('border-b border-gray-50', i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50')}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 leading-snug">{p.address}</p>
                        <p className="text-xs text-gray-400">{p.suburb}, {p.state}</p>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900 tabular-nums">{formatCurrencyFull(p.price)}</td>
                      <td className="px-4 py-3 text-right text-gray-600 tabular-nums">{p.land_size ? formatNumber(p.land_size) : '—'}</td>
                      <td className="px-4 py-3 text-right text-gray-600 tabular-nums">{p.pricePerM2 ? `$${formatNumber(p.pricePerM2)}` : '—'}</td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {new Date(p.sold_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{p.property_type ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {searched && !loading && results.length === 0 && !error && !noSuburbs && (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-400">
          <MapPin size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No sold properties found matching your filters.</p>
          <p className="text-xs mt-1">Try widening the radius or date range.</p>
        </div>
      )}
    </div>
  )
}
