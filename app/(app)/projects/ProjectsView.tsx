'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Plus, FolderOpen, Clock, Trash2 } from 'lucide-react'
import { ProjectStatusBadge } from '@/components/ui/Badge'
import { fmtDate } from '@/lib/utils/format'

interface Project {
  id: string; name: string; color: string; status: string
  due_date?: string | null; client: { id: string; name: string; color: string } | null
}
interface Props {
  projects: Project[]
  counts: Record<string, { total: number; done: number }>
  clients: { id: string; name: string; color: string }[]
  canManage: boolean
}

export function ProjectsView({ projects, counts, clients, canManage }: Props) {
  const [clientFilter, setClientFilter] = useState('')

  const visible = clientFilter ? projects.filter(p => p.client?.id === clientFilter) : projects
  const active    = visible.filter(p => p.status === 'active')
  const onHold    = visible.filter(p => p.status === 'on_hold')
  const completed = visible.filter(p => p.status === 'completed')

  async function deleteProject(projectId: string, projectName: string) {
    if (!confirm(`Archive project "${projectName}"? All tasks will be preserved in Trash.`)) return
    const res = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' })
    if (res.ok) {
      window.location.reload()
    } else {
      const d = await res.json().catch(() => ({}))
      alert(d.error ?? 'Could not delete project')
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-sm text-gray-500 mt-1">{visible.length} projects{clientFilter ? ' for selected client' : ' total'}</p>
        </div>
        {canManage && (
          <Link href="/projects/new" className="btn btn-brand flex items-center gap-2">
            <Plus className="h-4 w-4"/> New project
          </Link>
        )}
      </div>

      {/* Client filter */}
      {clients.length > 0 && (
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:20 }}>
          <span style={{ fontSize:12, color:'var(--text-muted)', fontWeight:600 }}>Filter by client:</span>
          <select value={clientFilter} onChange={e => setClientFilter(e.target.value)}
            style={{ padding:'5px 12px', borderRadius:20, fontSize:12, cursor:'pointer', outline:'none',
              border: clientFilter ? '1px solid var(--brand)' : '1px solid var(--border)',
              background: clientFilter ? 'rgba(13,148,136,0.08)' : 'var(--surface-subtle)',
              color: clientFilter ? 'var(--brand)' : 'var(--text-secondary)',
              fontWeight: clientFilter ? 600 : 400, fontFamily:'inherit', appearance:'none', paddingRight:24 }}>
            <option value=''>All clients</option>
            {clients.map(cl => <option key={cl.id} value={cl.id}>{cl.name}</option>)}
          </select>
          {clientFilter && <button onClick={() => setClientFilter('')}
            style={{ fontSize:11, color:'var(--text-muted)', background:'none', border:'none', cursor:'pointer' }}>
            ✕ Clear
          </button>}
        </div>
      )}

      {visible.length === 0 && (
        <div className="card text-center py-16">
          <FolderOpen className="h-12 w-12 text-gray-200 mx-auto mb-3"/>
          <p className="text-sm text-gray-400">{clientFilter ? 'No projects for this client' : 'No projects yet'}</p>
          {canManage && !clientFilter && <Link href="/projects/new" className="btn btn-brand mt-4">Create project</Link>}
        </div>
      )}

      {[{ label: 'Active', items: active }, { label: 'On hold', items: onHold }, { label: 'Completed', items: completed }].map(group => {
        if (group.items.length === 0) return null
        return (
          <div key={group.label} className="mb-8">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{group.label} ({group.items.length})</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {group.items.map(p => {
                const cnt      = counts[p.id] ?? { total: 0, done: 0 }
                const progress = cnt.total > 0 ? Math.round((cnt.done / cnt.total) * 100) : 0
                return (
                  <div key={p.id} className="relative group/card">
                  {canManage && (
                    <button
                      onClick={e => { e.preventDefault(); deleteProject(p.id, p.name) }}
                      title="Archive project"
                      className="absolute top-3 right-3 z-10 opacity-0 group-hover/card:opacity-100 transition-opacity"
                      style={{
                        width: 28, height: 28, borderRadius: 7, border: 'none',
                        background: '#fef2f2', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#dc2626',
                      }}>
                      <Trash2 style={{ width: 13, height: 13 }}/>
                    </button>
                  )}
                  <Link href={`/projects/${p.id}`}
                    className="card-elevated p-5 hover:shadow-md transition-shadow block">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-lg flex items-center justify-center text-white flex-shrink-0" style={{ background: p.color }}>
                          <FolderOpen className="h-4 w-4"/>
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-gray-900 truncate">{p.name}</h3>
                          {p.client && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <div className="h-2 w-2 rounded-sm" style={{ background: p.client.color }}/>
                              <span className="text-xs text-gray-400 truncate">{p.client.name}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <ProjectStatusBadge status={p.status as any}/>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>{cnt.done}/{cnt.total} tasks</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: p.color }}/>
                      </div>
                    </div>
                    {p.due_date && (
                      <div className="flex items-center gap-1 mt-3 text-xs text-gray-400">
                        <Clock className="h-3 w-3"/>
                        Due {fmtDate(p.due_date, { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    )}
                  </Link>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
