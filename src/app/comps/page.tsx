'use client'
import { useState } from 'react'
import { MapPin, Search, TrendingUp, DollarSign, Database, Navigation, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { formatCurrencyFull, formatNumber, cn } from '@/lib/utils'
import Link from 'next/link'
import AutocompleteInput from '@/components/AutocompleteInput'
import PriceTrendChart from '@/components/PriceTrendChart'

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

type SortKey = 'sold_date' | 'price' | 'land_size' | 'pricePerM2'
type SortDir = 'asc' | 'desc'

const PROPERTY_TYPES = ['House', 'Land']

export default function CompsPage() {
  const [searchMode, setSearchMode] = useState<'address' | 'suburb' | 'street'>('address')

  // Address mode
  const [address, setAddress] = useState('')
  const [useRadius, setUseRadius] = useState(true)
  const [radiusKm, setRadiusKm] = useState(1)

  // Suburb mode
  const [suburbOnly, setSuburbOnly] = useState('')
  const [suburbOnlyState, setSuburbOnlyState] = useState('NSW')

  // Street mode
  const [streetName, setStreetName] = useState('')
  const [suburbFilter, setSuburbFilter] = useState('')
  const [suburbState, setSuburbState] = useState('NSW')

  // Common filters
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [minLand, setMinLand] = useState('')
  const [maxLand, setMaxLand] = useState('')
  const [soldAfterMonths, setSoldAfterMonths] = useState(24)
  const [propertyTypes, setPropertyTypes] = useState<string[]>([])

  // Results + sorting
  const [results, setResults] = useState<SoldProperty[]>([])
  const [sortKey, setSortKey] = useState<SortKey>('sold_date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)
  const [noSuburbs, setNoSuburbs] = useState(false)

  const toggleType = (t: string) =>
    setPropertyTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ArrowUpDown size={12} className="text-gray-300 ml-1 inline" />
    return sortDir === 'desc'
      ? <ArrowDown size={12} className="text-blue-500 ml-1 inline" />
      : <ArrowUp size={12} className="text-blue-500 ml-1 inline" />
  }

  const sorted = [...results].sort((a, b) => {
    const va = a[sortKey] ?? (sortDir === 'desc' ? -Infinity : Infinity)
    const vb = b[sortKey] ?? (sortDir === 'desc' ? -Infinity : Infinity)
    if (va < vb) return sortDir === 'asc' ? -1 : 1
    if (va > vb) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  const search = async () => {
    if (searchMode === 'address' && !address.trim()) return
    if (searchMode === 'suburb' && !suburbOnly.trim()) return
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

      if (searchMode === 'address') {
        body.address = address
        body.radiusKm = useRadius ? radiusKm : 0.01
        body.mode = useRadius ? 'radius' : 'suburb'
        body.suburb = address
      } else if (searchMode === 'suburb') {
        body.suburb = suburbOnly
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
        <p className="text-sm text-gray-500 mt-0.5">Search 2.2M sold properties — NSW govt data 2015–2026</p>
      </div>

      {/* Search form */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">

        {/* Mode toggle */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg mb-4">
          {([['address', MapPin, 'Address'], ['suburb', Database, 'Suburb'], ['street', Navigation, 'Street']] as const).map(([id, Icon, label]) => (
            <button key={id} onClick={() => setSearchMode(id)}
              className={cn('flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-semibold transition-all',
                searchMode === id ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700')}>
              <Icon size={13} />{label}
            </button>
          ))}
        </div>

        {/* Address mode */}
        {searchMode === 'address' && (
          <div className="space-y-3 mb-4">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600 mb-1">Address or suburb</label>
                <AutocompleteInput
                  value={address}
                  onChange={setAddress}
                  onSelect={s => setAddress(s.label)}
                  type="suburb"
                  placeholder="Parramatta NSW"
                  icon={<MapPin size={15} />}
                />
              </div>
              {useRadius && (
                <div className="w-28">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Radius</label>
                  <div className="flex items-center border border-gray-200 rounded-lg bg-white">
                    <input type="number" value={radiusKm} onChange={e => setRadiusKm(parseFloat(e.target.value) || 1)}
                      step={0.5} min={0.5} onFocus={e => e.target.select()}
                      className="flex-1 px-3 py-2.5 text-sm outline-none w-0" />
                    <span className="pr-3 text-gray-400 text-sm">km</span>
                  </div>
                </div>
              )}
            </div>
            <label className="flex items-center gap-2 cursor-pointer w-fit">
              <div onClick={() => setUseRadius(v => !v)}
                className={cn('w-9 h-5 rounded-full transition-colors relative', useRadius ? 'bg-blue-500' : 'bg-gray-300')}>
                <div className={cn('absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all', useRadius ? 'left-4' : 'left-0.5')} />
              </div>
              <span className="text-xs text-gray-600">Search within radius</span>
            </label>
          </div>
        )}

        {/* Suburb-only mode */}
        {searchMode === 'suburb' && (
          <div className="flex gap-3 mb-4">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Suburb</label>
              <AutocompleteInput
                value={suburbOnly}
                onChange={v => { setSuburbOnly(v); setSuburbOnlyState('NSW') }}
                onSelect={s => { setSuburbOnly(s.suburb); setSuburbOnlyState(s.state) }}
                type="suburb"
                placeholder="e.g. Parramatta"
                icon={<MapPin size={15} />}
              />
            </div>
            <div className="w-24">
              <label className="block text-xs font-medium text-gray-600 mb-1">State</label>
              <div className="flex items-center justify-center h-[42px] border border-gray-200 rounded-lg bg-gray-50 text-sm font-medium text-gray-500 px-3">
                {suburbOnlyState || 'NSW'}
              </div>
            </div>
          </div>
        )}

        {/* Street mode inputs */}
        {searchMode === 'street' && (
          <div className="space-y-3 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Street name</label>
              <AutocompleteInput
                value={streetName}
                onChange={setStreetName}
                onSelect={s => { setStreetName(s.street); if (s.suburb) { setSuburbFilter(s.suburb); setSuburbState(s.state || 'NSW') } }}
                type="street"
                streetContext={suburbFilter}
                placeholder="George Street"
                icon={<Navigation size={15} />}
              />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600 mb-1">Suburb</label>
                <AutocompleteInput
                  value={suburbFilter}
                  onChange={v => { setSuburbFilter(v); setSuburbState('NSW') }}
                  onSelect={s => { setSuburbFilter(s.suburb); setSuburbState(s.state) }}
                  type="suburb"
                  placeholder="e.g. Sydney"
                  icon={<MapPin size={15} />}
                />
              </div>
              <div className="w-20 shrink-0">
                <label className="block text-xs font-medium text-gray-600 mb-1">State</label>
                <div className="flex items-center justify-center h-[42px] border border-gray-200 rounded-lg bg-gray-50 text-sm font-medium text-gray-500 px-2">
                  {suburbState || 'NSW'}
                </div>
              </div>
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

        <div className="space-y-3">
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
            </div>
          </div>
          <button onClick={search}
            disabled={loading || (searchMode === 'address' ? !address.trim() : searchMode === 'suburb' ? !suburbOnly.trim() : !streetName.trim())}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors">
            <Search size={15} />
            {loading ? 'Searching…' : 'Find Comps'}
          </button>
        </div>
      </div>

      {/* No suburb data */}
      {noSuburbs && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6">
          <p className="font-semibold text-amber-800 text-sm mb-1">No suburb data near this address</p>
          <p className="text-amber-700 text-sm">Geocoding may still be in progress — try again in a few minutes, or search by Street Name instead.</p>
          <Link href="/admin/import" className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors">
            <Database size={14} /> Go to Import Data
          </Link>
        </div>
      )}

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-6">{error}</div>}

      {results.length > 0 && (
        <>
          <PriceTrendChart sales={results} />

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: 'Found', value: results.length.toString(), icon: MapPin },
              { label: 'Avg price', value: formatCurrencyFull(avgPrice), icon: DollarSign },
              { label: 'Avg $/m²', value: avgPricePerM2 ? `$${formatNumber(avgPricePerM2)}` : '—', icon: TrendingUp },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
                <div className="bg-blue-50 rounded-lg p-1.5 sm:p-2 text-blue-600 shrink-0"><Icon size={16} /></div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs text-gray-500 truncate">{label}</p>
                  <p className="font-semibold text-gray-900 text-xs sm:text-sm truncate">{value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Sort bar (mobile) */}
          <div className="sm:hidden flex gap-2 mb-3 overflow-x-auto pb-1">
            {([['sold_date', 'Date'], ['price', 'Price'], ['land_size', 'Land'], ['pricePerM2', '$/m²']] as const).map(([k, label]) => (
              <button key={k} onClick={() => toggleSort(k)}
                className={cn('flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border shrink-0 transition-colors',
                  sortKey === k ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200')}>
                {label}
                {sortKey === k && (sortDir === 'desc' ? <ArrowDown size={10} /> : <ArrowUp size={10} />)}
              </button>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Results — click headers to sort</p>
              <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-1 rounded-full">NSW Govt Data</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Address</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-blue-600 select-none whitespace-nowrap" onClick={() => toggleSort('price')}>Sale Price <SortIcon k="price" /></th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-blue-600 select-none whitespace-nowrap" onClick={() => toggleSort('land_size')}>Land m² <SortIcon k="land_size" /></th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-blue-600 select-none whitespace-nowrap" onClick={() => toggleSort('pricePerM2')}>$/m² <SortIcon k="pricePerM2" /></th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-blue-600 select-none whitespace-nowrap" onClick={() => toggleSort('sold_date')}>Sold <SortIcon k="sold_date" /></th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((p, i) => (
                    <tr key={p.id} className={cn('border-b border-gray-50', i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50')}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 leading-snug">{p.address}</p>
                        <p className="text-xs text-gray-400">{p.suburb}, {p.state}{p.postcode ? ` ${p.postcode}` : ''}</p>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900 tabular-nums">{formatCurrencyFull(p.price)}</td>
                      <td className="px-4 py-3 text-right text-gray-600 tabular-nums">{p.land_size ? formatNumber(p.land_size) : '—'}</td>
                      <td className="px-4 py-3 text-right text-gray-600 tabular-nums">{p.pricePerM2 ? `$${formatNumber(p.pricePerM2)}` : '—'}</td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{new Date(p.sold_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                      <td className="px-4 py-3 text-gray-500">{p.property_type ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-2">
            {sorted.map(p => (
              <div key={p.id} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <p className="font-semibold text-gray-900 text-sm leading-snug">{p.address}</p>
                    <p className="text-xs text-gray-400">{p.suburb}{p.postcode ? ` ${p.postcode}` : ''}</p>
                  </div>
                  <p className="font-bold text-blue-700 text-sm shrink-0">{formatCurrencyFull(p.price)}</p>
                </div>
                <div className="flex gap-4 text-xs text-gray-500">
                  <span>{new Date(p.sold_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  {p.land_size && <span>{formatNumber(p.land_size)} m²</span>}
                  {p.pricePerM2 && <span>${formatNumber(p.pricePerM2)}/m²</span>}
                  {p.property_type && <span>{p.property_type}</span>}
                </div>
              </div>
            ))}
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
