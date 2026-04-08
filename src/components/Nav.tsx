'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Calculator, MapPin, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

const links = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/feasibility', label: 'Feasibility', icon: Calculator },
  { href: '/comps', label: 'Comps', icon: MapPin },
  { href: '/listings', label: 'Listings', icon: Search },
]

export default function Nav() {
  const path = usePathname()
  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 flex items-center gap-1 h-14">
        <span className="font-bold text-gray-900 mr-6 text-sm tracking-wide uppercase">
          Property Tool
        </span>
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
              path === href
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            )}
          >
            <Icon size={16} />
            {label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
