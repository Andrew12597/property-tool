import Link from 'next/link'
import { Calculator, MapPin, Search, ArrowRight } from 'lucide-react'

const tools = [
  {
    href: '/feasibility',
    icon: Calculator,
    title: 'Feasibility Calculator',
    description: 'Find the max price to pay for a deal, or check margins on a price you already have. Covers build costs, finance, stamp duty, soft costs, and investor splits.',
    color: 'blue',
  },
  {
    href: '/comps',
    icon: MapPin,
    title: 'Comps Finder',
    description: 'Enter any address and find sold properties nearby. Filter by radius, date range, price, land size, and property type to build your comp set.',
    color: 'green',
  },
  {
    href: '/listings',
    icon: Search,
    title: 'Listing Search',
    description: 'Search active for-sale listings by suburb. See land size, price per m², zoning, and run a quick feasibility check directly from any result.',
    color: 'purple',
  },
]

const colorMap: Record<string, string> = {
  blue: 'bg-blue-50 text-blue-700 group-hover:bg-blue-100',
  green: 'bg-green-50 text-green-700 group-hover:bg-green-100',
  purple: 'bg-purple-50 text-purple-700 group-hover:bg-purple-100',
}

export default function Home() {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Property Tool</h1>
        <p className="text-gray-500">Development feasibility & property research — private.</p>
      </div>

      <div className="grid gap-4">
        {tools.map(({ href, icon: Icon, title, description, color }) => (
          <Link
            key={href}
            href={href}
            className="group flex items-start gap-5 bg-white border border-gray-200 rounded-xl p-6 hover:border-gray-300 hover:shadow-sm transition-all"
          >
            <div className={`rounded-lg p-3 transition-colors ${colorMap[color]}`}>
              <Icon size={22} />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-gray-900 mb-1">{title}</h2>
              <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
            </div>
            <ArrowRight size={18} className="text-gray-300 group-hover:text-gray-500 transition-colors mt-1 shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  )
}
