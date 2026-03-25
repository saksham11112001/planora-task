'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, FolderOpen, CheckSquare, Users2, ArrowRight } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { cn } from '@/lib/utils/cn'

interface Result {
  id: string; type: 'task' | 'project' | 'client'
  title: string; subtitle?: string; color?: string; status?: string; url: string
}

export function SearchModal() {
  const { searchOpen, setSearchOpen } = useAppStore()
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query,    setQuery]    = useState('')
  const [results,  setResults]  = useState<Result[]>([])
  const [loading,  setLoading]  = useState(false)
  const [selIdx,   setSelIdx]   = useState(0)
  const debounce   = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (searchOpen) { setTimeout(() => inputRef.current?.focus(), 60); setQuery(''); setResults([]); setSelIdx(0) }
  }, [searchOpen])

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    clearTimeout(debounce.current)
    debounce.current = setTimeout(async () => {
      setLoading(true)
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`)
        const d = await r.json()
        const mapped: Result[] = (d.data ?? []).map((item: any) => ({
          id:       item.id,
          type:     item.type,
          title:    item.title,
          subtitle: item.subtitle,
          color:    item.color,
          status:   item.status,
          url:      item.type === 'task'    ? '/tasks' :
                    item.type === 'project' ? `/projects/${item.id}` :
                    `/clients/${item.id}`,
        }))
        setResults(mapped)
        setSelIdx(0)
      } finally { setLoading(false) }
    }, 220)
    return () => clearTimeout(debounce.current)
  }, [query])

  function navigate(url: string) { router.push(url); setSearchOpen(false) }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape')     { setSearchOpen(false) }
    if (e.key === 'ArrowDown')  { e.preventDefault(); setSelIdx(i => Math.min(i + 1, results.length - 1)) }
    if (e.key === 'ArrowUp')    { e.preventDefault(); setSelIdx(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && results[selIdx]) { navigate(results[selIdx].url) }
  }

  if (!searchOpen) return null

  const typeIcon = (t: string) =>
    t === 'project' ? <FolderOpen className="h-3.5 w-3.5"/> :
    t === 'client'  ? <Users2     className="h-3.5 w-3.5"/> :
                      <CheckSquare className="h-3.5 w-3.5"/>

  const typeColor = (t: string) =>
    t === 'project' ? '#7c3aed' : t === 'client' ? '#0891b2' : '#0d9488'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[14vh]"
      onClick={() => setSearchOpen(false)}>
      <div className="absolute inset-0" style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(6px)' }}/>

      <div onClick={e => e.stopPropagation()} onKeyDown={onKeyDown}
        className="relative w-full max-w-xl mx-4 rounded-2xl shadow-2xl overflow-hidden" style={{background:'var(--surface)'}}>

        {/* Input */}
        <div style={{display:'flex',alignItems:'center',gap:12,padding:'16px 20px',borderBottom:'1px solid var(--border)'}}>
          <Search className="h-5 w-5 text-gray-400 flex-shrink-0"/>
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search tasks, projects, clients…"
            className="flex-1 text-base text-gray-900 bg-transparent outline-none placeholder-gray-400"/>
          {query && (
            <button onClick={() => setQuery('')} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X className="h-4 w-4"/>
            </button>
          )}
          <kbd className="text-xs bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded border border-gray-200 flex-shrink-0">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-[420px] overflow-y-auto">
          {!query && (
            <div className="py-10 text-center">
              <Search className="h-10 w-10 text-gray-200 mx-auto mb-3"/>
              <p className="text-sm text-gray-400 font-medium">Search your workspace</p>
              <p className="text-xs text-gray-300 mt-1">Tasks · Projects · Clients</p>
            </div>
          )}

          {loading && (
            <div className="py-8 text-center">
              <div className="h-5 w-5 border-2 border-teal-200 border-t-teal-600 rounded-full animate-spin mx-auto mb-2"/>
              <p className="text-sm text-gray-400">Searching…</p>
            </div>
          )}

          {!loading && query && results.length === 0 && (
            <div className="py-10 text-center">
              <p className="text-sm font-medium text-gray-900 mb-1">No results for "{query}"</p>
              <p className="text-xs text-gray-400">Try a different search term</p>
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="py-2">
              {/* Group by type */}
              {(['task','project','client'] as const).map(type => {
                const group = results.filter(r => r.type === type)
                if (!group.length) return null
                const labels = { task: 'Tasks', project: 'Projects', client: 'Clients' }
                return (
                  <div key={type}>
                    <div className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      {labels[type]} ({group.length})
                    </div>
                    {group.map((r, i) => {
                      const globalIdx = results.indexOf(r)
                      return (
                        <button key={r.id} onClick={() => navigate(r.url)}
                          className={cn('w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors',
                            globalIdx === selIdx && 'bg-teal-50')}>
                          {r.color
                            ? <div className="h-7 w-7 rounded-lg flex-shrink-0 flex items-center justify-center"
                                style={{ background: r.color + '22', color: r.color }}>
                                {typeIcon(r.type)}
                              </div>
                            : <div className="h-7 w-7 rounded-lg flex-shrink-0 flex items-center justify-center"
                                style={{ background: typeColor(r.type) + '18', color: typeColor(r.type) }}>
                                {typeIcon(r.type)}
                              </div>
                          }
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{r.title}</p>
                            {r.subtitle && <p className="text-xs text-gray-400 truncate mt-0.5">{r.subtitle}</p>}
                          </div>
                          {r.status && r.status !== 'todo' && (
                            <span className="text-xs text-gray-400 flex-shrink-0 capitalize">{r.status.replace('_', ' ')}</span>
                          )}
                          <ArrowRight className="h-3.5 w-3.5 text-gray-300 flex-shrink-0"/>
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {results.length > 0 && (
          <div className="px-4 py-2 border-t border-gray-100 flex items-center gap-3 text-xs text-gray-400">
            <span>↑↓ navigate</span>
            <span>↵ open</span>
            <span>ESC close</span>
            <span className="ml-auto">{results.length} result{results.length !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>
    </div>
  )
}
