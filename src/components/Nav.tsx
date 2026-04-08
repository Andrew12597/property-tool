'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Home, Calculator, MapPin, Search, LogOut, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import Logo from './Logo'

const links = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/feasibility', label: 'Feasibility', icon: Calculator },
  { href: '/comps', label: 'Comps', icon: MapPin },
  { href: '/listings', label: 'Listings', icon: Search },
  { href: '/admin/import', label: 'Import', icon: Upload },
]

export default function Nav() {
  const path = usePathname()
  const router = useRouter()
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null)
    })
  }, [])

  const signOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      {/* ── Desktop top nav ── */}
      <nav className="hidden sm:flex bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-1 h-14 w-full">
          <Link href="/" className="flex items-center gap-2.5 mr-6">
            <Logo size={30} />
            <span className="font-bold text-gray-900 text-sm tracking-wide uppercase">Property Tool</span>
          </Link>

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

          <div className="ml-auto flex items-center gap-3">
            {email && (
              <span className="text-xs text-gray-400">{email}</span>
            )}
            <button
              onClick={signOut}
              title="Sign out"
              className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            >
              <LogOut size={15} />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </nav>

      {/* ── Mobile top bar ── */}
      <nav className="sm:hidden bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="flex items-center justify-between px-4 h-12">
          <Link href="/" className="flex items-center gap-2">
            <Logo size={26} />
            <span className="font-bold text-gray-900 text-sm tracking-wide uppercase">Property Tool</span>
          </Link>
          <button
            onClick={signOut}
            className="flex items-center gap-1.5 text-gray-500 text-sm font-medium py-2"
          >
            <LogOut size={15} />
            <span>Sign out</span>
          </button>
        </div>
      </nav>

      {/* ── Mobile bottom tab bar ── */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200">
        <div className="grid grid-cols-4">
          {links.map(({ href, label, icon: Icon }) => {
            const active = path === href
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex flex-col items-center justify-center py-2 gap-0.5 transition-colors',
                  active ? 'text-blue-600' : 'text-gray-400'
                )}
              >
                <Icon size={20} />
                <span className="text-[10px] font-medium">{label}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </>
  )
}
