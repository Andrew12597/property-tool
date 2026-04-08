'use client'
import { useState } from 'react'
import { MapPin, Search, ExternalLink, TrendingUp, Calendar, Ruler, DollarSign } from 'lucide-react'
import { formatCurrencyFull, formatNumber, cn } from '@/lib/utils'

interface SoldProperty {
  id: string
  address: string
  suburb: string
  state: string
  postcode: string
  price: number
  soldDate: string
  landSize: number | null
  bedrooms: number | null
  bathrooms: number | null
  propertyType: string
  url: string
  pricePerM2: number | null
}

const PROPERTY_TYPES = ['House', 'Duplex', 'Townhouse', 'Villa', 'Land']

export default function CompsPage() {
  const [address, setAddress] = useState('')
  const [radiusKm, setRadiusKm] = useState(1)
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [minLand, setMinLand] = useState('')
  const [maxLand, setMaxLand] = useState('')
  const [soldAfterMonths, setSoldAfterMonths] = useState(12)
  const [propertyTypes, setPropertyTypes] = useState<string[]>(['House'])
  const [results, setResults] = useState<SoldProperty[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)
  const [apiUnconfigured, setApiUnconfigured] = useState(false)

  const toggleType = (t: string) => {
    setPropertyTypes(prev =>
      prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
    )
  }

  const search = async () => {
    if (!address.trim()) return
    setLoading(true)
    setError(null)
    setSearched(true)

    try {
      // Step 1: geocode address
      const geoRes = await fetch(`/api/domain/geocode?address=${encodeURIComponent(address)}`)
      const geoData = await geoRes.json()

      if (!geoRes.ok || !geoData?.[0]?.addressCoordinate) {
        throw new Error('Could not locate that address. Try a full street address including suburb and state.')
      }

      const { lat, lon } = geoData[0].addressCoordinate

      // Step 2: search sold properties
      const soldAfter = new Date()
      soldAfter.setMonth(soldAfter.getMonth() - soldAfterMonths)

      const body = {
        lat,
        lng: lon,
        radiusKm,
        minPrice: minPrice ? parseInt(minPrice) : undefined,
        maxPrice: maxPrice ? parseInt(maxPrice) : undefined,
        minLandSize: minLand ? parseInt(minLand) : undefined,
        maxLandSize: maxLand ? parseInt(maxLand) : undefined,
        soldAfter: soldAfter.toISOString().slice(0, 10),
        propertyTypes,
        pageSize: 100,
      }

      const res = await fetch('/api/domain/comps', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json()

      if (!res.ok) {
        if (data.error?.includes('auth failed') || data.error?.includes('401') || data.error?.includes('400')) {
          setApiUnconfigured(true)
          throw new Error('Domain API credentials not configured. See the setup banner above.')
        }
        throw new Error(data.error || 'Search failed')
      }
      setApiUnconfigured(false)

      // Parse Domain API response
      const listings: SoldProperty[] = (data || []).map((item: any) => {
        const l = item.listing ?? item
        const price = l.priceDetails?.price ?? l.soldDetails?.soldPrice ?? null
        const landSize = l.propertyDetails?.landArea ?? null
        return {
          id: String(l.id ?? Math.random()),
          address: l.propertyDetails?.displayableAddress ?? '',
          suburb: l.propertyDetails?.suburb ?? '',
          state: l.propertyDetails?.state ?? '',
          postcode: l.propertyDetails?.postcode ?? '',
          price: price ?? 0,
          soldDate: l.soldDetails?.soldDate ?? l.dateListed ?? '',
          landSize,
          bedrooms: l.propertyDetails?.bedrooms ?? null,
          bathrooms: l.propertyDetails?.bathrooms ?? null,
          propertyType: l.propertyDetails?.propertyType ?? '',
          url: l.seoUrl ? `https://www.domain.com.au${l.seoUrl}` : '',
          pricePerM2: price && landSize ? Math.round(price / landSize) : null,
        }
      }).filter((p: SoldProperty) => p.price > 0)

      setResults(listings)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const avgPrice = results.length ? results.reduce((s, r) => s + r.price, 0) / results.length : 0
  const avgPricePerM2 = results.filter(r => r.pricePerM2).length
    ? results.filter(r => r.pricePerM2).reduce((s, r) => s + r.pricePerM2!, 0) / results.filter(r => r.pricePerM2).length
    : 0

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Comps Finder</h1>
        <p className="text-sm text-gray-500 mt-0.5">Find sold properties near any address</p>
      </div>

      {/* Search form */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-600 mb-1">Address</label>
          <div className="flex gap-2">
            <div className="flex-1 flex items-center border border-gray-200 rounded-lg focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-100 transition-all">
              <MapPin size={16} className="ml-3 text-gray-400 shrink-0" />
              <input
                type="text"
                value={address}
                onChange={e => setAddress(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && search()}
                placeholder="123 Main Street, Suburb NSW 2000"
                className="flex-1 px-3 py-2.5 text-sm bg-transparent outline-none"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Radius</label>
            <div className="flex items-center border border-gray-200 rounded-lg bg-white">
              <input type="number" value={radiusKm} onChange={e => setRadiusKm(parseFloat(e.target.value) || 1)} step={0.5} min={0.5} className="flex-1 px-3 py-2 text-sm outline-none" />
              <span className="pr-3 text-gray-400 text-sm">km</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Sold within</label>
            <div className="flex items-center border border-gray-200 rounded-lg bg-white">
              <input type="number" value={soldAfterMonths} onChange={e => setSoldAfterMonths(parseInt(e.target.value) || 12)} min={1} className="flex-1 px-3 py-2 text-sm outline-none" />
              <span className="pr-3 text-gray-400 text-sm">mths</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Min price</label>
            <div className="flex items-center border border-gray-200 rounded-lg bg-white">
              <span className="pl-3 text-gray-400 text-sm">$</span>
              <input type="number" value={minPrice} onChange={e => setMinPrice(e.target.value)} placeholder="Any" className="flex-1 px-2 py-2 text-sm outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Max price</label>
            <div className="flex items-center border border-gray-200 rounded-lg bg-white">
              <span className="pl-3 text-gray-400 text-sm">$</span>
              <input type="number" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} placeholder="Any" className="flex-1 px-2 py-2 text-sm outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Min land (m²)</label>
            <input type="number" value={minLand} onChange={e => setMinLand(e.target.value)} placeholder="Any" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-blue-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Max land (m²)</label>
            <input type="number" value={maxLand} onChange={e => setMaxLand(e.target.value)} placeholder="Any" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-blue-400" />
          </div>
        </div>

        {/* Property types */}
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
          disabled={loading || !address.trim()}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <Search size={15} />
          {loading ? 'Searching…' : 'Find Comps'}
        </button>
      </div>

      {/* API setup banner */}
      {apiUnconfigured && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <p className="font-semibold text-amber-800 text-sm mb-1">⚠ Domain API credentials not configured</p>
          <p className="text-amber-700 text-xs leading-relaxed">Add your credentials to <code className="bg-amber-100 px-1 rounded">.env.local</code> in the property-tool folder:</p>
          <pre className="mt-2 text-xs bg-amber-100 rounded-lg p-3 text-amber-900">{`DOMAIN_CLIENT_ID=your_client_id\nDOMAIN_CLIENT_SECRET=your_client_secret`}</pre>
          <p className="text-amber-600 text-xs mt-2">Find these at <span className="font-medium">developer.domain.com.au → Property Model → Credentials</span>. Restart the dev server after adding.</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-6">{error}</div>
      )}

      {/* Summary stats */}
      {results.length > 0 && (
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
      )}

      {/* Results table */}
      {results.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
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
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {results
                  .sort((a, b) => new Date(b.soldDate).getTime() - new Date(a.soldDate).getTime())
                  .map((p, i) => (
                    <tr key={p.id} className={cn('border-b border-gray-50', i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50')}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 leading-snug">{p.address}</p>
                        {(p.bedrooms || p.bathrooms) && (
                          <p className="text-xs text-gray-400">{[p.bedrooms && `${p.bedrooms}bd`, p.bathrooms && `${p.bathrooms}ba`].filter(Boolean).join(' · ')}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900 tabular-nums">{formatCurrencyFull(p.price)}</td>
                      <td className="px-4 py-3 text-right text-gray-600 tabular-nums">{p.landSize ? `${formatNumber(p.landSize)}` : '—'}</td>
                      <td className="px-4 py-3 text-right text-gray-600 tabular-nums">{p.pricePerM2 ? `$${formatNumber(p.pricePerM2)}` : '—'}</td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {p.soldDate ? new Date(p.soldDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{p.propertyType}</td>
                      <td className="px-4 py-3">
                        {p.url && (
                          <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700">
                            <ExternalLink size={14} />
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {searched && !loading && results.length === 0 && !error && (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-400">
          <MapPin size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No sold properties found matching your filters.</p>
          <p className="text-xs mt-1">Try widening the radius or date range.</p>
        </div>
      )}
    </div>
  )
}
