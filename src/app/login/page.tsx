'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type View = 'password' | 'magic' | 'reset-sent' | 'magic-sent'

export default function LoginPage() {
  const router = useRouter()
  const [view, setView] = useState<View>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) return
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setView('magic-sent')
      setLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setError('Enter your email above first')
      return
    }
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: `${window.location.origin}/auth/reset` }
    )

    if (error) {
      setError(error.message)
    } else {
      setView('reset-sent')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-xl font-bold text-gray-900">Property Tool</h1>
          <p className="text-sm text-gray-500 mt-1">Private access only</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">

          {/* ── Magic link sent ── */}
          {view === 'magic-sent' && (
            <div className="text-center">
              <div className="text-4xl mb-4">📧</div>
              <h2 className="font-semibold text-gray-900 mb-2">Check your email</h2>
              <p className="text-sm text-gray-500 leading-relaxed">
                We sent a login link to <span className="font-medium text-gray-900">{email}</span>.
                Click it to sign in.
              </p>
              <button onClick={() => { setView('password'); setEmail('') }} className="text-xs text-blue-600 hover:underline mt-4 block mx-auto">
                Back to login
              </button>
            </div>
          )}

          {/* ── Password reset sent ── */}
          {view === 'reset-sent' && (
            <div className="text-center">
              <div className="text-4xl mb-4">🔑</div>
              <h2 className="font-semibold text-gray-900 mb-2">Check your email</h2>
              <p className="text-sm text-gray-500 leading-relaxed">
                We sent a password reset link to <span className="font-medium text-gray-900">{email}</span>.
              </p>
              <button onClick={() => { setView('password'); setError(null) }} className="text-xs text-blue-600 hover:underline mt-4 block mx-auto">
                Back to login
              </button>
            </div>
          )}

          {/* ── Password login ── */}
          {view === 'password' && (
            <>
              <form onSubmit={handlePasswordLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    autoComplete="email"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 bg-white outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 bg-white outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-gray-400"
                  />
                </div>

                {error && (
                  <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading || !email.trim() || !password}
                  className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm"
                >
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>
              </form>

              <div className="mt-4 flex flex-col gap-2 items-center">
                <button
                  onClick={handleForgotPassword}
                  disabled={loading}
                  className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Forgot password?
                </button>
                <button
                  onClick={() => { setView('magic'); setError(null) }}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Sign in with email link instead
                </button>
              </div>
            </>
          )}

          {/* ── Magic link login ── */}
          {view === 'magic' && (
            <>
              <form onSubmit={handleMagicLink} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Email address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 bg-white outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-gray-400"
                  />
                </div>

                {error && (
                  <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm"
                >
                  {loading ? 'Sending…' : 'Send login link'}
                </button>

                <p className="text-xs text-center text-gray-400">
                  We&apos;ll email you a magic link — no password required.
                </p>
              </form>

              <div className="mt-4 text-center">
                <button
                  onClick={() => { setView('password'); setError(null) }}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Sign in with password instead
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  )
}
