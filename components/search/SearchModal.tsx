'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, FolderOpen, CheckSquare, Users2, ArrowRight } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { cn } from '@/lib/utils/cn'
import { TaskDetailPanel } from '@/components/tasks/TaskDetailPanel'
import type { Task } from '@/types'

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

  // Task detail panel state
  const [panelTask,    setPanelTask]    = useState<Task | null>(null)
  const [panelLoading, setPanelLoading] = useState(false)
  const [members,      setMembers]      = useState<{id:string;name:string}[]>([])
  const [clients,      setClients]      = useState<{id:string;name:string;color:string}[]>([])
  const [metaLoaded,   setMetaLoaded]   = useState(false)

  useEffect(() => {
    if (searchOpen) { setTimeout(() => inputRef.current?.focus(), 60); setQuery(''); setResults([]); setSelIdx(0) }
  }, [searchOpen])

  // Lazy load members + clients once on first task open
  const loadMeta = useCallback(async () => {
    if (metaLoaded) return
    try {
      const [teamRes, clientRes] = await Promise.all([
        fetch('/api/team'),
        fetch('/api/clients'),
      ])
      const teamData   = await teamRes.json()
      const clientData = await clientRes.json()
      const memberList = (teamData.data ?? []).map((m: any) => ({
        id: m.users?.id ?? m.user_id,
        name: m.users?.name ?? 'Unknown',
      }))
      const clientList = Array.isArray(clientData) ? clientData : (clientData.data ?? [])
      setMembers(memberList)
      setClients(clientList.map((c: any) => ({ id: c.id, name: c.name, color: c.color ?? '#0d9488' })))
      setMetaLoaded(true)
    } catch {}
  }, [metaLoaded])

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

  async function openTaskPanel(taskId: string) {
    setPanelLoading(true)
    loadMeta()  // kick off meta load in background
    try {
      const res  = await fetch(`/api/tasks/${taskId}`)
      const data = await res.json()
      if (data?.data) setPanelTask(data.data as Task)
    } finally { setPanelLoading(false) }
    // Close search overlay but keep panel open
    setSearchOpen(false)
  }

  function navigate(result: Result) {
    if (result.type === 'task') {
      openTaskPanel(result.id)
    } else {
      router.push(result.url)
      setSearchOpen(false)
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape')     { setSearchOpen(false) }
    if (e.key === 'ArrowDown')  { e.preventDefault(); setSelIdx(i => Math.min(i + 1, results.length - 1)) }
    if (e.key === 'ArrowUp')    { e.preventDefault(); setSelIdx(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && results[selIdx]) { navigate(results[selIdx]) }
  }

  const typeIcon = (t: string) =>
    t === 'project' ? <FolderOpen className="h-3.5 w-3.5"/> :
    t === 'client'  ? <Users2     className="h-3.5 w-3.5"/> :
                      <CheckSquare className="h-3.5 w-3.5"/>

  const typeColor = (t: string) =>
    t === 'project' ? '#7c3aed' : t === 'client' ? '#0891b2' : '#0d9488'

  return (
    <>
      {/* Task detail panel rendered globally (outside search overlay) */}
      {panelLoading && (
        <div style={{ position:'fixed', inset:0, zIndex:10000, display:'flex', alignItems:'center', justifyContent:'center',
          background:'rgba(0,0,0,0.15)', pointerEvents:'none' }}>
          <div style={{ background:'var(--surface)', borderRadius:12, padding:'16px 24px',
            fontSize:13, color:'var(--text-muted)', boxShadow:'0 8px 32px rgba(0,0,0,0.15)' }}>
            Opening task…
          </div>
        </div>
      )}
      <TaskDetailPanel
        task={panelTask}
        members={members}
        clients={clients}
        onClose={() => setPanelTask(null)}
        onUpdated={() => setPanelTask(null)}
      />

      {!searchOpen ? null : (
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
                    const hint   = { task: '— click to open detail', project: '', client: '' }
                    return (
                      <div key={type}>
                        <div className="px-4 py-1.5 flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                            {labels[type]} ({group.length})
                          </span>
                          {hint[type] && (
                            <span style={{ fontSize:9, color:'var(--text-muted)', fontStyle:'italic' }}>
                              {hint[type]}
                            </span>
                          )}
                        </div>
                        {group.map(r => {
                          const globalIdx = results.indexOf(r)
                          return (
                            <button key={r.id} onClick={() => navigate(r)}
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
                              {r.type === 'task'
                                ? <span style={{ fontSize:10, color:'var(--brand)', flexShrink:0, fontWeight:600,
                                    padding:'2px 6px', borderRadius:4, background:'var(--brand-light)' }}>
                                    Open →
                                  </span>
                                : <ArrowRight className="h-3.5 w-3.5 text-gray-300 flex-shrink-0"/>
                              }
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
      )}
    </>
  )
}
