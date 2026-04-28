'use client'
import { useMemo, useState } from 'react'

interface Sale {
  price: number
  sold_date: string
}

interface Props {
  sales: Sale[]
}

function median(nums: number[]) {
  if (!nums.length) return 0
  const s = [...nums].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

function fmt(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}k`
  return `$${v}`
}

export default function PriceTrendChart({ sales }: Props) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; d: any } | null>(null)

  const points = useMemo(() => {
    const byMonth = new Map<string, number[]>()
    for (const s of sales) {
      if (!s.sold_date || !s.price) continue
      const key = s.sold_date.slice(0, 7)
      if (!byMonth.has(key)) byMonth.set(key, [])
      byMonth.get(key)!.push(s.price)
    }
    return Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, prices]) => ({
        month,
        label: new Date(month + '-15').toLocaleDateString('en-AU', { month: 'short', year: '2-digit' }),
        median: Math.round(median(prices)),
        avg: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
        count: prices.length,
        min: Math.min(...prices),
        max: Math.max(...prices),
      }))
  }, [sales])

  if (points.length < 2) return null

  const W = 900, H = 220, PL = 64, PR = 16, PT = 16, PB = 36
  const chartW = W - PL - PR
  const chartH = H - PT - PB

  const allVals = points.flatMap(p => [p.median, p.avg])
  const minY = Math.min(...allVals) * 0.92
  const maxY = Math.max(...allVals) * 1.06

  const xOf = (i: number) => PL + (i / (points.length - 1)) * chartW
  const yOf = (v: number) => PT + chartH - ((v - minY) / (maxY - minY)) * chartH

  const medPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(p.median).toFixed(1)}`).join(' ')
  const avgPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(p.avg).toFixed(1)}`).join(' ')

  // Y axis ticks
  const yTicks = 4
  const yTickVals = Array.from({ length: yTicks + 1 }, (_, i) => minY + (i / yTicks) * (maxY - minY))

  // Show every Nth label to avoid crowding
  const labelEvery = points.length > 24 ? 6 : points.length > 12 ? 3 : 1

  const overallMedian = Math.round(median(sales.map(s => s.price)))
  const first = points[0].median
  const last = points[points.length - 1].median
  const growth = ((last - first) / first * 100).toFixed(1)
  const growthPos = parseFloat(growth) >= 0

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-900 text-sm">Price Trend</h3>
          <p className="text-xs text-gray-400 mt-0.5">Median sale price by month · {sales.length} sales</p>
        </div>
        <div className="flex gap-6 text-right">
          <div>
            <p className="text-xs text-gray-400">Median</p>
            <p className="font-bold text-gray-900 text-sm">{fmt(overallMedian)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Growth</p>
            <p className={`font-bold text-sm ${growthPos ? 'text-emerald-600' : 'text-red-500'}`}>
              {growthPos ? '+' : ''}{growth}%
            </p>
          </div>
        </div>
      </div>

      <div className="relative w-full" style={{ paddingBottom: `${(H / W * 100).toFixed(1)}%` }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="absolute inset-0 w-full h-full overflow-visible"
          onMouseLeave={() => setTooltip(null)}
        >
          {/* Grid lines */}
          {yTickVals.map((v, i) => (
            <g key={i}>
              <line x1={PL} x2={W - PR} y1={yOf(v)} y2={yOf(v)} stroke="#f3f4f6" strokeWidth={1} />
              <text x={PL - 6} y={yOf(v)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="#9ca3af">
                {fmt(Math.round(v))}
              </text>
            </g>
          ))}

          {/* X axis labels */}
          {points.map((p, i) => i % labelEvery === 0 && (
            <text key={i} x={xOf(i)} y={H - 6} textAnchor="middle" fontSize={10} fill="#9ca3af">{p.label}</text>
          ))}

          {/* Avg line (dashed, light) */}
          <path d={avgPath} fill="none" stroke="#bfdbfe" strokeWidth={1.5} strokeDasharray="4 3" />

          {/* Median line */}
          <path d={medPath} fill="none" stroke="#2563eb" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

          {/* Hover areas + dots */}
          {points.map((p, i) => {
            const cx = xOf(i), cy = yOf(p.median)
            return (
              <g key={i}>
                <circle cx={cx} cy={cy} r={3} fill="#2563eb" />
                <rect
                  x={cx - (chartW / points.length / 2)}
                  y={PT}
                  width={chartW / points.length}
                  height={chartH}
                  fill="transparent"
                  onMouseEnter={e => {
                    const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect()
                    setTooltip({ x: cx / W * 100, y: cy / H * 100, d: p })
                  }}
                />
              </g>
            )
          })}
        </svg>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="absolute z-10 bg-white border border-gray-200 rounded-xl shadow-xl px-3 py-2.5 text-xs pointer-events-none -translate-x-1/2"
            style={{ left: `${tooltip.x}%`, top: `${Math.max(tooltip.y - 20, 0)}%` }}
          >
            <p className="font-semibold text-gray-700 mb-1">{tooltip.d.label}</p>
            <p className="text-gray-600">Median: <span className="font-bold text-blue-600">{fmt(tooltip.d.median)}</span></p>
            <p className="text-gray-600">Avg: <span className="font-semibold">{fmt(tooltip.d.avg)}</span></p>
            <p className="text-gray-400">{tooltip.d.count} sales</p>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-2 justify-end">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <div className="w-5 h-0.5 bg-blue-600 rounded" />
          Median
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <div className="w-5 h-0.5 bg-blue-200 rounded" style={{ borderTop: '1.5px dashed #bfdbfe' }} />
          Average
        </div>
      </div>
    </div>
  )
}
