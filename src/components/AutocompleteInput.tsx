'use client'
import { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

interface Suggestion {
  label: string
  [key: string]: string
}

interface Props {
  value: string
  onChange: (value: string) => void
  onSelect: (suggestion: Suggestion) => void
  fetchUrl: (q: string) => string
  placeholder?: string
  icon?: React.ReactNode
  className?: string
  inputClassName?: string
  minChars?: number
}

export default function AutocompleteInput({
  value, onChange, onSelect, fetchUrl,
  placeholder, icon, className, inputClassName, minChars = 2,
}: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (value.length < minChars) { setSuggestions([]); setOpen(false); return }

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(fetchUrl(value))
        const data = await res.json()
        setSuggestions(data.results || [])
        setOpen(true)
        setActiveIdx(-1)
      } catch { setSuggestions([]) }
    }, 200)

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [value])

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
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || !suggestions.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, suggestions.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); select(suggestions[activeIdx]) }
    if (e.key === 'Escape') setOpen(false)
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="flex items-center border border-gray-200 rounded-lg focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-100 transition-all bg-white">
        {icon && <span className="ml-3 text-gray-400 shrink-0">{icon}</span>}
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length && setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          className={cn('flex-1 px-3 py-2.5 text-sm bg-transparent outline-none', inputClassName)}
        />
      </div>

      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {suggestions.map((s, i) => (
            <li key={i}
              onMouseDown={() => select(s)}
              className={cn(
                'px-4 py-2.5 text-sm cursor-pointer transition-colors',
                i === activeIdx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
              )}>
              {s.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
