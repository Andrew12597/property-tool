'use client'
import { useMemo } from 'react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ReferenceLine
} from 'recharts'

interface Sale {
  price: number
  sold_date: string
  property_type?: string | null
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

function formatPrice(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}k`
  return `$${v}`
}

export default function PriceTrendChart({ sales }: Props) {
  const data = useMemo(() => {
    // Group by year-month
    const byMonth = new Map<string, number[]>()
    for (const s of sales) {
      if (!s.sold_date || !s.price) continue
      const key = s.sold_date.slice(0, 7) // YYYY-MM
      if (!byMonth.has(key)) byMonth.set(key, [])
      byMonth.get(key)!.push(s.price)
    }

    return Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, prices]) => ({
        month,
        label: new Date(month + '-01').toLocaleDateString('en-AU', { month: 'short', year: '2-digit' }),
        median: Math.round(median(prices)),
        avg: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
        count: prices.length,
      }))
  }, [sales])

  if (data.length < 2) return null

  const overallMedian = Math.round(median(sales.map(s => s.price)))

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-900 text-sm">Price Trend</h3>
          <p className="text-xs text-gray-400 mt-0.5">Median & average sale price by month</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">Overall median</p>
          <p className="font-bold text-gray-900">{formatPrice(overallMedian)}</p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={formatPrice}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={false}
            width={56}
          />
          <Tooltip
            formatter={(value: number, name: string) => [
              formatPrice(value),
              name === 'median' ? 'Median' : 'Average'
            ]}
            labelFormatter={(label, payload) => {
              const count = payload?.[0]?.payload?.count
              return `${label}${count ? ` (${count} sales)` : ''}`
            }}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
          />
          <Legend
            formatter={v => v === 'median' ? 'Median' : 'Average'}
            wrapperStyle={{ fontSize: 12 }}
          />
          <ReferenceLine y={overallMedian} stroke="#e5e7eb" strokeDasharray="4 4" />
          <Line
            type="monotone"
            dataKey="median"
            stroke="#2563eb"
            strokeWidth={2}
            dot={data.length < 24 ? { r: 3, fill: '#2563eb' } : false}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="avg"
            stroke="#93c5fd"
            strokeWidth={1.5}
            strokeDasharray="4 2"
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
