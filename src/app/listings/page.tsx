'use client'
import { useState } from 'react'
import { Search, ExternalLink, Calculator, Home, Ruler, DollarSign, Tag } from 'lucide-react'
import { formatCurrencyFull, formatNumber, cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'

interface Listing {
  id: string
  address: string
  suburb: string
  state: string
  postcode: string
  price: number | null
  priceText: string
  landSize: number | null
  bedrooms: number | null
  bathrooms: number | null
  parking: number | null
  propertyType: string
  url: string
  pricePerM2: number | null
  daysListed: number | null
  headline: string
}

const STATES = ['NSW', 'QLD', 'VIC', 'WA', 'SA']
const PROPERTY_TYPES = ['House', 'Duplex', 'Townhouse', 'Villa', 'Land']

function StatPill({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-500">
      <Icon size={12} className="text-gray-400" />
      <span className="text-gray-400">{label}</span>
      <span className="font-medium text-gray-700">{value}</span>
    </div>
  )
}

export default function ListingsPage() {
  const router = useRouter()
  const [suburb, setSuburb] = useState('')
  const [state, setState] = useState('NSW')
  const [postcode, setPostcode] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [minLand, setMinLand] = useState('')
  const [maxLand, setMaxLand] = useState('')
  const [propertyTypes, setPropertyTypes] = useState<string[]>(['House'])
  const [results, setResults] = useState<Listing[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)
  const [sortBy, setSortBy] = useState<'price' | 'pricePerM2' | 'landSize' | 'daysListed'>('price')

  const toggleType = (t: string) =>
    setPropertyTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])

  const search = async () => {
    if (!suburb.trim()) return
    setLoading(true)
    setError(null)
    setSearched(true)

    try {
      const body = {
        suburb: suburb.trim(),
        state,
        postcode: postcode.trim(),
        minPrice: minPrice ? parseInt(minPrice) : undefined,
        maxPrice: maxPrice ? parseInt(maxPrice) : undefined,
        minLandSize: minLand ? parseInt(minLand) : undefined,
        maxLandSize: maxLand ? parseInt(maxLand) : undefined,
        propertyTypes,
        pageSize: 100,
      }

      const res = await fetch('/api/domain/listings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Search failed')

      const listings: Listing[] = (data || []).map((item: any) => {
        const l = item.listing ?? item
        const pd = l.priceDetails ?? {}
        const prop = l.propertyDetails ?? {}
        const price = pd.price ?? null
        const landSize = prop.landArea ?? null
        const listed = l.dateListed ? Math.floor((Date.now() - new Date(l.dateListed).getTime()) / 86400000) : null
        return {
          id: String(l.id ?? Math.random()),
          address: prop.displayableAddress ?? '',
          suburb: prop.suburb ?? suburb,
          state: prop.state ?? state,
          postcode: prop.postcode ?? postcode,
          price,
          priceText: pd.displayPrice ?? (price ? formatCurrencyFull(price) : 'POA'),
          landSize,
          bedrooms: prop.bedrooms ?? null,
          bathrooms: prop.bathrooms ?? null,
          parking: prop.carspaces ?? null,
          propertyType: prop.propertyType ?? '',
          url: l.seoUrl ? `https://www.domain.com.au${l.seoUrl}` : '',
          pricePerM2: price && landSize ? Math.round(price / landSize) : null,
          daysListed: listed,
          headline: l.headline ?? '',
        }
      })

      setResults(listings)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const sorted = [...results].sort((a, b) => {
    if (sortBy === 'price') return (a.price ?? Infinity) - (b.price ?? Infinity)
    if (sortBy === 'pricePerM2') return (a.pricePerM2 ?? Infinity) - (b.pricePerM2 ?? Infinity)
    if (sortBy === 'landSize') return (b.landSize ?? 0) - (a.landSize ?? 0)
    if (sortBy === 'daysListed') return (b.daysListed ?? 0) - (a.daysListed ?? 0)
    return 0
  })

  const runFeasibility = (listing: Listing) => {
    // Pass listing price to feasibility via URL so user can check deal
    if (listing.price) {
      router.push(`/feasibility?price=${listing.price}&address=${encodeURIComponent(listing.address)}`)
    } else {
      router.push('/feasibility')
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Listing Search</h1>
        <p className="text-sm text-gray-500 mt-0.5">Find active for-sale listings and check key metrics</p>
      </div>

      {/* Search form */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Suburb</label>
            <input
              type="text"
              value={suburb}
              onChange={e => setSuburb(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && search()}
              placeholder="e.g. Paddington"
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">State</label>
            <select
              value={state}
              onChange={e => setState(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-blue-400 bg-white"
            >
              {STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {[
            { label: 'Min price', value: minPrice, set: setMinPrice, prefix: '$' },
            { label: 'Max price', value: maxPrice, set: setMaxPrice, prefix: '$' },
            { label: 'Min land (m²)', value: minLand, set: setMinLand },
            { label: 'Max land (m²)', value: maxLand, set: setMaxLand },
          ].map(({ label, value, set, prefix }) => (
            <div key={label}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
              <div className="flex items-center border border-gray-200 rounded-lg bg-white focus-within:border-blue-400 transition-all">
                {prefix && <span className="pl-3 text-gray-400 text-sm">{prefix}</span>}
                <input type="number" value={value} onChange={e => set(e.target.value)} placeholder="Any" className="flex-1 px-2 py-2 text-sm outline-none bg-transparent" />
              </div>
            </div>
          ))}
        </div>

        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-600 mb-2">Property types</label>
          <div className="flex flex-wrap gap-2">
            {PROPERTY_TYPES.map(t => (
              <button
                key={t}
                onClick={() => toggleType(t)}
                className={cn('px-3 py-1.5 rounded-full text-xs font-medium border transition-colors', propertyTypes.includes(t) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300')}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={search}
          disabled={loading || !suburb.trim()}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <Search size={15} />
          {loading ? 'Searching…' : 'Search Listings'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-6">{error}</div>
      )}

      {/* Sort & count */}
      {results.length > 0 && (
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500">{results.length} listings in <span className="font-medium text-gray-900">{suburb}, {state}</span></p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Sort by</span>
            {[
              { key: 'price', label: 'Price' },
              { key: 'pricePerM2', label: '$/m²' },
              { key: 'landSize', label: 'Land size' },
              { key: 'daysListed', label: 'Days listed' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setSortBy(key as any)}
                className={cn('px-3 py-1 rounded-full text-xs font-medium transition-colors', sortBy === key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Listing cards */}
      {sorted.length > 0 && (
        <div className="grid gap-3">
          {sorted.map(listing => (
            <div key={listing.id} className="bg-white border border-gray-200 rounded-xl p-5 hover:border-gray-300 hover:shadow-sm transition-all">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{listing.propertyType}</span>
                    {listing.daysListed !== null && (
                      <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', listing.daysListed > 60 ? 'bg-orange-50 text-orange-600' : 'bg-gray-100 text-gray-500')}>
                        {listing.daysListed}d listed
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold text-gray-900 text-sm leading-snug mb-1">{listing.address}</h3>
                  {listing.headline && <p className="text-xs text-gray-400 mb-3 line-clamp-1">{listing.headline}</p>}

                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                    <StatPill icon={Tag} label="Price" value={listing.priceText} />
                    {listing.landSize && <StatPill icon={Ruler} label="Land" value={`${formatNumber(listing.landSize)} m²`} />}
                    {listing.pricePerM2 && <StatPill icon={DollarSign} label="$/m²" value={`$${formatNumber(listing.pricePerM2)}`} />}
                    {listing.bedrooms && <StatPill icon={Home} label="Bed" value={String(listing.bedrooms)} />}
                  </div>
                </div>

                <div className="flex flex-col gap-2 shrink-0">
                  <button
                    onClick={() => runFeasibility(listing)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
                  >
                    <Calculator size={13} />
                    Run Feasibility
                  </button>
                  {listing.url && (
                    <a
                      href={listing.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-600 text-xs font-medium rounded-lg hover:border-gray-300 hover:bg-gray-50 transition-colors whitespace-nowrap"
                    >
                      <ExternalLink size={13} />
                      View on Domain
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {searched && !loading && results.length === 0 && !error && (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-400">
          <Search size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No listings found for {suburb}, {state}.</p>
          <p className="text-xs mt-1">Try widening your price range or removing filters.</p>
        </div>
      )}
    </div>
  )
}
