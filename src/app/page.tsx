'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Calculator, MapPin, Search, ArrowRight, Trash2, TrendingUp, Clock, ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { formatCurrencyFull, formatPercent } from '@/lib/utils'
import Logo from '@/components/Logo'

interface SavedAnalysis {
  id: string
  name: string
  mode: 'max-buy' | 'check-deal'
  inputs: Record<string, any>
  result: Record<string, any>
  created_at: string
}

const tools = [
  { href: '/feasibility', icon: Calculator, label: 'Feasibility', color: 'bg-blue-50 text-blue-700', border: 'border-blue-100' },
  { href: '/comps', icon: MapPin, label: 'Comps', color: 'bg-emerald-50 text-emerald-700', border: 'border-emerald-100' },
  { href: '/listings', icon: Search, label: 'Listings', color: 'bg-purple-50 text-purple-700', border: 'border-purple-100' },
]

function dealRating(result: Record<string, any>, mode: string) {
  const margin = mode === 'max-buy' ? result.expectedMarginOnGRV : result.marginOnGRV
  if (!margin) return null
  if (margin >= 0.20) return { label: 'GREAT', color: 'bg-emerald-100 text-emerald-700' }
  if (margin >= 0.15) return { label: 'GOOD', color: 'bg-blue-100 text-blue-700' }
  if (margin >= 0.08) return { label: 'TIGHT', color: 'bg-amber-100 text-amber-700' }
  return { label: 'LOSS', color: 'bg-red-100 text-red-700' }
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  const hrs = Math.floor(mins / 60)
  const days = Math.floor(hrs / 24)
  if (days > 0) return `${days}d ago`
  if (hrs > 0) return `${hrs}h ago`
  if (mins > 0) return `${mins}m ago`
  return 'just now'
}

export default function Home() {
  const router = useRouter()
  const [analyses, setAnalyses] = useState<SavedAnalysis[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/analyses')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setAnalyses(data) })
      .finally(() => setLoading(false))
  }, [])

  const deleteAnalysis = async (id: string) => {
    setDeleting(id)
    await fetch('/api/analyses', { method: 'DELETE', body: JSON.stringify({ id }), headers: { 'Content-Type': 'application/json' } })
    setAnalyses(a => a.filter(x => x.id !== id))
    setDeleting(null)
  }

  const openAnalysis = (a: SavedAnalysis) => {
    const params = new URLSearchParams({
      saved: JSON.stringify({ mode: a.mode, inputs: a.inputs, result: a.result })
    })
    router.push(`/feasibility?${params}`)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">

      {/* ── Hero ── */}
      <div className="flex items-center gap-4 pt-2">
        <Logo size={52} />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Property Tool</h1>
          <p className="text-sm text-gray-400 mt-0.5">Development feasibility &amp; deal analysis</p>
        </div>
      </div>

      {/* ── Quick actions ── */}
      <div className="grid grid-cols-3 gap-3">
        {tools.map(({ href, icon: Icon, label, color, border }) => (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center gap-2 py-5 rounded-xl border ${border} ${color} hover:opacity-80 transition-opacity font-medium text-sm`}
          >
            <Icon size={22} />
            {label}
          </Link>
        ))}
      </div>

      {/* ── Saved analyses ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Saved Analyses</h2>
          <Link href="/feasibility" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
            New <ChevronRight size={12} />
          </Link>
        </div>

        {loading && (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
            <p className="text-sm text-gray-400">Loading…</p>
          </div>
        )}

        {!loading && analyses.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
            <TrendingUp size={32} className="mx-auto mb-3 text-gray-200" />
            <p className="text-sm font-medium text-gray-500 mb-1">No saved analyses yet</p>
            <p className="text-xs text-gray-400 mb-4">Run the feasibility calculator and save your results here</p>
            <Link href="/feasibility" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
              <Calculator size={14} /> Open Calculator
            </Link>
          </div>
        )}

        {!loading && analyses.length > 0 && (
          <div className="space-y-2">
            {analyses.map(a => {
              const rating = dealRating(a.result, a.mode)
              const isMaxBuy = a.mode === 'max-buy'
              const keyValue = isMaxBuy ? a.result.idealBuyPrice : a.result.profit
              const keyLabel = isMaxBuy ? 'Max buy price' : 'Profit'
              const margin = isMaxBuy ? a.result.expectedMarginOnGRV : a.result.marginOnGRV
              return (
                <div key={a.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-gray-300 transition-colors">
                  <button
                    onClick={() => openAnalysis(a)}
                    className="w-full flex items-center gap-4 px-4 py-4 text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-900 text-sm truncate">{a.name}</span>
                        {rating && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${rating.color}`}>
                            {rating.label}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span className="capitalize">{isMaxBuy ? 'Max Buy' : 'Check Deal'}</span>
                        <span>·</span>
                        <span>{a.inputs.state}</span>
                        <span>·</span>
                        <span>{a.inputs.numDwellings} dwellings</span>
                        <span>·</span>
                        <Clock size={10} className="inline" /> {timeAgo(a.created_at)}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-gray-400">{keyLabel}</p>
                      <p className="font-bold text-gray-900">{keyValue ? formatCurrencyFull(keyValue) : '—'}</p>
                      {margin != null && <p className="text-xs text-gray-400">{formatPercent(margin)} margin</p>}
                    </div>
                    <ArrowRight size={15} className="text-gray-300 shrink-0" />
                  </button>
                  <div className="border-t border-gray-100 px-4 py-2 flex justify-end">
                    <button
                      onClick={() => deleteAnalysis(a.id)}
                      disabled={deleting === a.id}
                      className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                    >
                      <Trash2 size={12} />
                      {deleting === a.id ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}
