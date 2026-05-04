'use client'
import { useState, useCallback } from 'react'
import { TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react'
import { formatCurrencyFull, cn } from '@/lib/utils'

interface SuburbGrowth {
  suburb: string
  state: string
  recent_median: number
  prior_median: number
  growth_pct: number
  recent_count: number
  prior_count: number
}

type Period = '3m' | '6m' | '1y' | '2y'
type PropType = 'all' | 'House' | 'Land'
type View = 'gainers' | 'all' | 'losers'

const PERIOD_LABELS: Record<Period, string> = {
  '3m': '3 months',
  '6m': '6 months',
  '1y': '1 year',
  '2y': '2 years',
}

function getPeriodDates(period: Period) {
  const now = new Date()
  const months = period === '3m' ? 3 : period === '6m' ? 6 : period === '1y' ? 12 : 24
  const recentEnd   = new Date(now)
  const recentStart = new Date(now)
  recentStart.setMonth(recentStart.getMonth() - months)
  const priorEnd   = new Date(recentStart)
  const priorStart = new Date(recentStart)
  priorStart.setMonth(priorStart.getMonth() - months)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  return {
    recentStart: fmt(recentStart),
    recentEnd:   fmt(recentEnd),
    priorStart:  fmt(priorStart),
    priorEnd:    fmt(priorEnd),
  }
}

function GrowthBadge({ pct }: { pct: number }) {
  if (pct >= 0.5) return (
    <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
      <TrendingUp size={13} />+{pct.toFixed(1)}%
    </span>
  )
  if (pct <= -0.5) return (
    <span className="inline-flex items-center gap-1 text-red-600 font-bold">
      <TrendingDown size={13} />{pct.toFixed(1)}%
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 text-gray-500 font-semibold">
      <Minus size={13} />{pct.toFixed(1)}%
    </span>
  )
}

function GrowthBar({ pct, max }: { pct: number; max: number }) {
  const w = max > 0 ? Math.abs(pct) / max * 100 : 0
  return (
    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
      <div
        className={cn('h-full rounded-full', pct >= 0 ? 'bg-emerald-400' : 'bg-red-400')}
        style={{ width: `${Math.min(w, 100)}%` }}
      />
    </div>
  )
}

export default function GrowthPage() {
  const [period, setPeriod]     = useState<Period>('1y')
  const [propType, setPropType] = useState<PropType>('House')
  const [minSales, setMinSales] = useState(5)
  const [view, setView]         = useState<View>('gainers')

  const [results, setResults]   = useState<SuburbGrowth[]>([])
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [searched, setSearched] = useState(false)

  const run = useCallback(async (p = period, pt = propType, ms = minSales) => {
    setLoading(true)
    setError(null)
    const { recentStart, recentEnd, priorStart, priorEnd } = getPeriodDates(p)
    const params = new URLSearchParams({
      recent_start: recentStart,
      recent_end:   recentEnd,
      prior_start:  priorStart,
      prior_end:    priorEnd,
      min_sales:    String(ms),
      state:        'NSW',
      ...(pt !== 'all' ? { property_types: pt } : {}),
    })
    try {
      const res  = await fetch(`/api/growth?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setResults(data)
      setSearched(true)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [period, propType, minSales])

  // Filter results by view
  const filtered = results.filter(r =>
    view === 'all'    ? true :
    view === 'gainers' ? r.growth_pct >= 0 :
    r.growth_pct < 0
  )
  const maxAbs = Math.max(...filtered.map(r => Math.abs(r.growth_pct)), 1)

  // Top 3 for hero cards
  const topThree = results.filter(r => r.growth_pct > 0).slice(0, 3)

  const periodDates = getPeriodDates(period)

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">Suburb Growth</h1>
        <p className="text-sm text-gray-500 mt-0.5">Median price change by suburb — NSW</p>
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-5 space-y-3">
        {/* Period */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Compare period</p>
          <div className="grid grid-cols-4 gap-1.5">
            {(['3m','6m','1y','2y'] as Period[]).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={cn(
                  'py-2 rounded-lg text-sm font-medium border transition-colors text-center',
                  period === p
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-700'
                )}>
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
            Recent: {periodDates.recentStart} → {periodDates.recentEnd}<br className="sm:hidden" />
            <span className="hidden sm:inline"> · </span>Prior: {periodDates.priorStart} → {periodDates.priorEnd}
          </p>
        </div>

        {/* Property type */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Property type</p>
          <div className="flex gap-1.5">
            {(['all','House','Land'] as PropType[]).map(t => (
              <button key={t} onClick={() => setPropType(t)}
                className={cn(
                  'flex-1 py-2 rounded-lg text-sm font-medium border transition-colors',
                  propType === t
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                )}>
                {t === 'all' ? 'All types' : t}
              </button>
            ))}
          </div>
        </div>

        {/* Min sales */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Min sales per period</p>
          <div className="flex gap-1.5">
            {[3, 5, 10, 20].map(n => (
              <button key={n} onClick={() => setMinSales(n)}
                className={cn(
                  'flex-1 py-2 rounded-lg text-sm font-medium border transition-colors',
                  minSales === n
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                )}>
                {n}+
              </button>
            ))}
          </div>
        </div>

        {/* Run */}
        <button onClick={() => run(period, propType, minSales)} disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Loading…' : 'Run'}
        </button>
      </div>

      {/* ── Error ───────────────────────────────────────────────────────── */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 mb-4">
          {error}
        </div>
      )}

      {/* ── Results ─────────────────────────────────────────────────────── */}
      {searched && !loading && (
        <>
          {/* Hero top 3 */}
          {topThree.length > 0 && (
            <div className="flex gap-3 mb-5 overflow-x-auto pb-1 sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0">
              {topThree.map((r, i) => (
                <div key={r.suburb} className={cn(
                  'bg-white border rounded-xl p-4 shrink-0 w-52 sm:w-auto',
                  i === 0 ? 'border-emerald-300 shadow-sm' : 'border-gray-200'
                )}>
                  {i === 0 && (
                    <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-1">🏆 Top growth</p>
                  )}
                  <p className="font-bold text-gray-900 text-sm">{r.suburb}</p>
                  <p className="text-2xl font-bold text-emerald-600 mt-1">+{r.growth_pct.toFixed(1)}%</p>
                  <p className="text-xs text-gray-400 mt-2">{formatCurrencyFull(r.prior_median)} → {formatCurrencyFull(r.recent_median)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{r.recent_count} sales</p>
                </div>
              ))}
            </div>
          )}

          {/* View toggle */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-500">
              {results.length} suburb{results.length !== 1 ? 's' : ''} with enough data
            </p>
            <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
              {([['gainers','Gainers'],['all','All'],['losers','Declines']] as [View,string][]).map(([v,l]) => (
                <button key={v} onClick={() => setView(v)}
                  className={cn(
                    'px-3 py-1 rounded-md text-xs font-medium transition-all',
                    view === v ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                  )}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Table — desktop */}
          <div className="hidden sm:block bg-white border border-gray-200 rounded-xl overflow-hidden mb-20">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-8">#</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Suburb</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Prior median</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Recent median</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Growth</th>
                  <th className="px-4 py-3 w-32"></th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Sales</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={r.suburb} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{r.suburb}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{formatCurrencyFull(r.prior_median)}</td>
                    <td className="px-4 py-3 text-right text-gray-800 font-medium">{formatCurrencyFull(r.recent_median)}</td>
                    <td className="px-4 py-3 text-right"><GrowthBadge pct={r.growth_pct} /></td>
                    <td className="px-4 py-3"><GrowthBar pct={r.growth_pct} max={maxAbs} /></td>
                    <td className="px-4 py-3 text-right text-gray-400 text-xs">{r.recent_count}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-gray-400 text-sm">No suburbs found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Cards — mobile */}
          <div className="sm:hidden space-y-2 mb-24">
            {filtered.map((r, i) => (
              <div key={r.suburb} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div>
                    <span className="text-xs text-gray-400 mr-1.5">#{i + 1}</span>
                    <span className="font-semibold text-gray-900 text-sm">{r.suburb}</span>
                  </div>
                  <GrowthBadge pct={r.growth_pct} />
                </div>
                <GrowthBar pct={r.growth_pct} max={maxAbs} />
                <div className="flex gap-3 text-xs text-gray-500 mt-2">
                  <span>{formatCurrencyFull(r.prior_median)} → {formatCurrencyFull(r.recent_median)}</span>
                  <span className="ml-auto">{r.recent_count} sales</span>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="text-center text-gray-400 text-sm py-10">No suburbs found</div>
            )}
          </div>
        </>
      )}

      {!searched && !loading && (
        <div className="text-center py-16 text-gray-400">
          <TrendingUp size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Select your filters and press <strong>Run</strong></p>
        </div>
      )}
    </div>
  )
}
