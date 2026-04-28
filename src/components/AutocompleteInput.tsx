'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'

interface Suggestion {
  label: string
  [key: string]: string
}

// ── Client-side suburb cache (loaded once, reused across instances) ────────────
let suburbCache: Suggestion[] | null = null
let suburbCachePromise: Promise<Suggestion[]> | null = null

async function loadSuburbs(): Promise<Suggestion[]> {
  if (suburbCache) return suburbCache
  if (suburbCachePromise) return suburbCachePromise
  suburbCachePromise = fetch('/api/autocomplete?type=suburb&q=all&limit=5000')
    .then(r => r.json())
    .then(d => { suburbCache = d.results || []; return suburbCache! })
    .catch(() => [])
  return suburbCachePromise
}

function filterSuburbs(query: string, all: Suggestion[]): Suggestion[] {
  const q = query.toUpperCase().trim()
  if (!q) return []
  // Starts-with first, then contains
  const starts = all.filter(s => s.suburb.startsWith(q))
  const contains = all.filter(s => !s.suburb.startsWith(q) && s.suburb.includes(q))
  return [...starts, ...contains].slice(0, 8)
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  value: string
  onChange: (value: string) => void
  onSelect: (suggestion: Suggestion) => void
  type: 'suburb' | 'street'
  streetContext?: string   // suburb hint for street search
  placeholder?: string
  icon?: React.ReactNode
  className?: string
}

export default function AutocompleteInput({ value, onChange, onSelect, type, streetContext, placeholder, icon, className }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const [suburbs, setSuburbs] = useState<Suggestion[]>([])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Preload suburbs immediately
  useEffect(() => {
    loadSuburbs().then(setSuburbs)
  }, [])

  const updateSuggestions = useCallback((q: string) => {
    if (q.length < 2) { setSuggestions([]); setOpen(false); return }

    if (type === 'suburb') {
      const results = filterSuburbs(q, suburbs)
      setSuggestions(results)
      setOpen(results.length > 0)
      setActiveIdx(-1)
    } else {
      // Street: debounce network call
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(async () => {
        try {
          const url = `/api/autocomplete?type=street&q=${encodeURIComponent(q)}${streetContext ? `&suburb=${encodeURIComponent(streetContext)}` : ''}`
          const res = await fetch(url)
          const data = await res.json()
          setSuggestions(data.results || [])
          setOpen((data.results || []).length > 0)
          setActiveIdx(-1)
        } catch { setSuggestions([]) }
      }, 300)
    }
  }, [type, suburbs, streetContext])

  const handleChange = (v: string) => {
    onChange(v)
    updateSuggestions(v)
  }

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const select = (s: Suggestion) => {
    onSelect(s)
    setSuggestions([])
    setOpen(false)
    setActiveIdx(-1)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || !suggestions.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, suggestions.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); select(suggestions[activeIdx]) }
    else if (e.key === 'Escape') { setOpen(false); setActiveIdx(-1) }
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="flex items-center border border-gray-200 rounded-lg focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-100 transition-all bg-white">
        {icon && <span className="ml-3 text-gray-400 shrink-0">{icon}</span>}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={e => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => value.length >= 2 && suggestions.length && setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          className="flex-1 px-3 py-2.5 text-sm bg-transparent outline-none"
        />
        {value && (
          <button onClick={() => { onChange(''); setSuggestions([]); setOpen(false); inputRef.current?.focus() }}
            className="mr-2 text-gray-300 hover:text-gray-500 text-lg leading-none">×</button>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 top-[calc(100%+4px)] left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          {suggestions.map((s, i) => (
            <li key={i}
              onMouseDown={e => { e.preventDefault(); select(s) }}
              className={cn(
                'px-4 py-2.5 text-sm cursor-pointer transition-colors flex items-center gap-2',
                i === activeIdx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50',
                i > 0 && 'border-t border-gray-50'
              )}>
              {s.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
