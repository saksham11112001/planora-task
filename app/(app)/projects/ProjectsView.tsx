'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Plus, FolderOpen, Clock, Trash2, Search, LayoutGrid, List, Copy, ChevronDown, ChevronRight } from 'lucide-react'
import { fmtDate } from '@/lib/utils/format'
import { toast } from '@/store/appStore'

interface Project {
  id: string; name: string; color: string; status: string
  due_date?: string | null; client: { id: string; name: string; color: string } | null
}
interface Props {
  projects:    Project[]
  counts:      Record<string, { total: number; done: number }>
  clients:     { id: string; name: string; color: string }[]
  canManage:   boolean
  currentUserId?: string
}

const STATUS_TABS = [
  { key: 'all',       label: 'All' },
  { key: 'active',    label: 'Active' },
  { key: 'on_hold',   label: 'On hold' },
  { key: 'completed', label: 'Completed' },
]

export function ProjectsView({ projects, counts, clients, canManage }: Props) {
  const [search,       setSearch]       = useState('')
  const [clientFilter, setClientFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [viewMode,     setViewMode]     = useState<'grid' | 'list'>('grid')
  const [cloning,      setCloning]      = useState<string | null>(null)
  const [collapsed,    setCollapsed]    = useState<Set<string>>(new Set())

  function toggleGroup(key: string) {
    setCollapsed(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s })
  }

  const filtered = projects.filter(p => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false
    if (clientFilter && p.client?.id !== clientFilter) return false
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const groups = [
    { key: 'active',    label: 'Active',    color: '#0d9488', items: filtered.filter(p => p.status === 'active') },
    { key: 'on_hold',   label: 'On hold',   color: '#ca8a04', items: filtered.filter(p => p.status === 'on_hold') },
    { key: 'completed', label: 'Completed', color: '#16a34a', items: filtered.filter(p => p.status === 'completed') },
  ].filter(g => g.items.length > 0)

  async function deleteProject(id: string, name: string) {
    if (!confirm(`Archive project "${name}"? All tasks will be preserved.`)) return
    const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' })
    if (res.ok) window.location.reload()
    else { const d = await res.json().catch(() => ({})); alert(d.error ?? 'Could not delete project') }
  }

  async function cloneProject(id: string, name: string) {
    setCloning(id)
    try {
      const res = await fetch(`/api/projects/${id}/clone`, { method: 'POST' })
      const d   = await res.json()
      if (!res.ok) { toast.error(d.error ?? 'Clone failed'); return }
      toast.success(`Cloned "${name}" → "Copy of ${name}" (${d.task_count} tasks)`)
      window.location.reload()
    } finally { setCloning(null) }
  }

  /* ── Shared card renderer ── */
  function ProjectCard({ p }: { p: Project }) {
    const cnt      = counts[p.id] ?? { total: 0, done: 0 }
    const progress = cnt.total > 0 ? Math.round((cnt.done / cnt.total) * 100) : 0
    const isOnHold = p.status === 'on_hold'
    const isDone   = p.status === 'completed'

    return (
      <div className="group/card" style={{ position: 'relative' }}
        onMouseEnter={e => {
          const wrap = e.currentTarget
          const link = wrap.querySelector('.project-card-link') as HTMLElement
          if (link) { link.style.boxShadow = '0 4px 20px rgba(0,0,0,0.1)'; link.style.borderColor = p.color; link.style.transform = 'translateY(-1px)' }
          const actions = wrap.querySelector('.card-actions') as HTMLElement
          if (actions) actions.style.opacity = '1'
        }}
        onMouseLeave={e => {
          const wrap = e.currentTarget
          const link = wrap.querySelector('.project-card-link') as HTMLElement
          if (link) { link.style.boxShadow = ''; link.style.borderColor = 'var(--border)'; link.style.transform = '' }
          const actions = wrap.querySelector('.card-actions') as HTMLElement
          if (actions) actions.style.opacity = '0'
        }}>
        {/* Hover actions */}
        {canManage && (
          <div style={{
            position: 'absolute', top: 10, right: 10, zIndex: 10,
            display: 'flex', gap: 4, opacity: 0,
            transition: 'opacity 0.15s',
          }} className="card-actions">
            <button
              onClick={e => { e.preventDefault(); cloneProject(p.id, p.name) }}
              disabled={cloning === p.id}
              title="Clone project"
              style={{ width: 26, height: 26, borderRadius: 6, border: 'none',
                background: 'rgba(124,58,237,0.1)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#7c3aed', transition: 'all 0.1s' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(124,58,237,0.2)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(124,58,237,0.1)'}>
              <Copy style={{ width: 11, height: 11 }}/>
            </button>
            <button
              onClick={e => { e.preventDefault(); deleteProject(p.id, p.name) }}
              title="Archive project"
              style={{ width: 26, height: 26, borderRadius: 6, border: 'none',
                background: 'rgba(220,38,38,0.1)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#dc2626', transition: 'all 0.1s' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(220,38,38,0.2)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(220,38,38,0.1)'}>
              <Trash2 style={{ width: 11, height: 11 }}/>
            </button>
          </div>
        )}
        <Link href={`/projects/${p.id}`} className="project-card-link" style={{
          display: 'block', textDecoration: 'none',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderTop: `3px solid ${p.color}`,
          borderRadius: 10, padding: '14px 16px',
          transition: 'all 0.15s',
          opacity: isDone ? 0.72 : isOnHold ? 0.88 : 1,
        }}>
          {/* Title */}
          <div style={{ marginBottom: 10, paddingRight: 48 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)',
              overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', marginBottom: 4, lineHeight: 1.3 }}>
              {p.name}
            </h3>
            {/* Client chip */}
            {p.client ? (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600,
                background: `${p.client.color}18`, border: `1px solid ${p.client.color}44`,
                color: p.client.color,
              }}>
                <span style={{ width: 5, height: 5, borderRadius: 1, background: p.client.color, flexShrink: 0 }}/>
                {p.client.name}
              </span>
            ) : (
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>No client</span>
            )}
          </div>

          {/* Progress bar */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11,
              color: 'var(--text-muted)', marginBottom: 5 }}>
              <span>{cnt.done} / {cnt.total} tasks</span>
              <span style={{ fontWeight: 700, color: progress === 100 ? '#16a34a' : 'var(--text-secondary)' }}>
                {progress}%
              </span>
            </div>
            <div style={{ height: 4, borderRadius: 99, background: 'var(--border-light)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 99,
                width: `${progress}%`,
                background: progress === 100 ? '#16a34a' : p.color,
                transition: 'width 0.3s ease',
              }}/>
            </div>
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              padding: '2px 7px', borderRadius: 6, fontSize: 10, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.05em',
              background: isDone ? 'rgba(22,163,74,0.12)' : isOnHold ? 'rgba(202,138,4,0.12)' : 'rgba(13,148,136,0.12)',
              color: isDone ? '#16a34a' : isOnHold ? '#ca8a04' : '#0d9488',
            }}>
              {p.status.replace('_', ' ')}
            </span>
            {p.due_date && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 3,
                fontSize: 11, color: 'var(--text-muted)' }}>
                <Clock style={{ width: 10, height: 10 }}/>
                {fmtDate(p.due_date)}
              </span>
            )}
          </div>
        </Link>
      </div>
    )
  }

  /* ── List row renderer ── */
  function ProjectRow({ p }: { p: Project }) {
    const cnt      = counts[p.id] ?? { total: 0, done: 0 }
    const progress = cnt.total > 0 ? Math.round((cnt.done / cnt.total) * 100) : 0
    const isOnHold = p.status === 'on_hold'
    const isDone   = p.status === 'completed'

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
        borderBottom: '1px solid var(--border-light)', background: 'var(--surface)',
        transition: 'background 0.1s' }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface-subtle)'}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}>
        {/* Color dot */}
        <div style={{ width: 8, height: 8, borderRadius: 2, background: p.color, flexShrink: 0 }}/>
        {/* Name + client */}
        <Link href={`/projects/${p.id}`} style={{ flex: 1, minWidth: 0, textDecoration: 'none' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
            overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', display: 'block' }}>
            {p.name}
          </span>
        </Link>
        {p.client && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3,
            padding: '2px 7px', borderRadius: 99, fontSize: 11, fontWeight: 600, flexShrink: 0,
            background: `${p.client.color}18`, color: p.client.color }}>
            {p.client.name}
          </span>
        )}
        {/* Progress */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, width: 120 }}>
          <div style={{ flex: 1, height: 4, borderRadius: 99, background: 'var(--border-light)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, borderRadius: 99,
              background: progress === 100 ? '#16a34a' : p.color }}/>
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 30, textAlign: 'right' }}>
            {progress}%
          </span>
        </div>
        {/* Task count */}
        <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, width: 60, textAlign: 'right' }}>
          {cnt.done}/{cnt.total}
        </span>
        {/* Status */}
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
          padding: '2px 7px', borderRadius: 6, flexShrink: 0,
          background: isDone ? 'rgba(22,163,74,0.12)' : isOnHold ? 'rgba(202,138,4,0.12)' : 'rgba(13,148,136,0.12)',
          color: isDone ? '#16a34a' : isOnHold ? '#ca8a04' : '#0d9488' }}>
          {p.status.replace('_', ' ')}
        </span>
        {/* Due date */}
        <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, width: 80, textAlign: 'right' }}>
          {p.due_date ? fmtDate(p.due_date) : '—'}
        </span>
        {/* Actions */}
        {canManage && (
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            <button onClick={() => cloneProject(p.id, p.name)} disabled={cloning === p.id}
              title="Clone" style={{ width: 24, height: 24, borderRadius: 5, border: 'none', cursor: 'pointer',
                background: 'transparent', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onMouseEnter={e => { const el=e.currentTarget as HTMLElement; el.style.background='rgba(124,58,237,0.1)'; el.style.color='#7c3aed' }}
              onMouseLeave={e => { const el=e.currentTarget as HTMLElement; el.style.background='transparent'; el.style.color='var(--text-muted)' }}>
              <Copy style={{ width: 11, height: 11 }}/>
            </button>
            <button onClick={() => deleteProject(p.id, p.name)}
              title="Archive" style={{ width: 24, height: 24, borderRadius: 5, border: 'none', cursor: 'pointer',
                background: 'transparent', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onMouseEnter={e => { const el=e.currentTarget as HTMLElement; el.style.background='rgba(220,38,38,0.1)'; el.style.color='#dc2626' }}
              onMouseLeave={e => { const el=e.currentTarget as HTMLElement; el.style.background='transparent'; el.style.color='var(--text-muted)' }}>
              <Trash2 style={{ width: 11, height: 11 }}/>
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>Projects</h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {filtered.length} of {projects.length} project{projects.length !== 1 ? 's' : ''}
            {clientFilter ? ' · filtered by client' : ''}
          </p>
        </div>
        {canManage && (
          <Link href="/projects/new" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 8, background: 'var(--brand)',
            color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 600,
            boxShadow: '0 2px 8px rgba(13,148,136,0.35)', transition: 'all 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.9'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}>
            <Plus style={{ width: 14, height: 14 }}/> New project
          </Link>
        )}
      </div>

      {/* ── Controls bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 300 }}>
          <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
            width: 13, height: 13, color: 'var(--text-muted)', pointerEvents: 'none' }}/>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search projects…"
            style={{ width: '100%', paddingLeft: 30, paddingRight: 10, height: 34,
              fontSize: 13, border: '1px solid var(--border)', borderRadius: 8,
              background: 'var(--surface)', color: 'var(--text-primary)',
              outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
            onFocus={e => (e.target as HTMLElement).style.borderColor = 'var(--brand)'}
            onBlur={e => (e.target as HTMLElement).style.borderColor = 'var(--border)'}
          />
        </div>

        {/* Status tabs */}
        <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          {STATUS_TABS.map(t => {
            const count = t.key === 'all' ? projects.length : projects.filter(p => p.status === t.key).length
            return (
              <button key={t.key} onClick={() => setStatusFilter(t.key)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px',
                  border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: statusFilter === t.key ? 700 : 500,
                  background: statusFilter === t.key ? 'var(--brand)' : 'var(--surface)',
                  color: statusFilter === t.key ? '#fff' : 'var(--text-secondary)',
                  borderRight: '1px solid var(--border)', fontFamily: 'inherit',
                  transition: 'all 0.12s' }}>
                {t.label}
                <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 99,
                  background: statusFilter === t.key ? 'rgba(255,255,255,0.25)' : 'var(--surface-subtle)',
                  color: statusFilter === t.key ? '#fff' : 'var(--text-muted)' }}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Client filter */}
        {clients.length > 0 && (
          <select value={clientFilter} onChange={e => setClientFilter(e.target.value)}
            style={{ height: 34, padding: '0 10px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
              outline: 'none', border: clientFilter ? '1px solid var(--brand)' : '1px solid var(--border)',
              background: clientFilter ? 'rgba(13,148,136,0.08)' : 'var(--surface)',
              color: clientFilter ? 'var(--brand)' : 'var(--text-secondary)',
              fontWeight: clientFilter ? 600 : 400, fontFamily: 'inherit' }}>
            <option value=''>All clients</option>
            {clients.map(cl => <option key={cl.id} value={cl.id}>{cl.name}</option>)}
          </select>
        )}

        {/* View toggle */}
        <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginLeft: 'auto' }}>
          <button onClick={() => setViewMode('grid')}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px',
              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              background: viewMode === 'grid' ? 'var(--brand)' : 'var(--surface)',
              color: viewMode === 'grid' ? '#fff' : 'var(--text-muted)',
              fontSize: 12, transition: 'all 0.12s' }}>
            <LayoutGrid style={{ width: 13, height: 13 }}/>
          </button>
          <button onClick={() => setViewMode('list')}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px',
              border: 'none', borderLeft: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit',
              background: viewMode === 'list' ? 'var(--brand)' : 'var(--surface)',
              color: viewMode === 'list' ? '#fff' : 'var(--text-muted)',
              fontSize: 12, transition: 'all 0.12s' }}>
            <List style={{ width: 13, height: 13 }}/>
          </button>
        </div>
      </div>

      {/* ── Empty state ── */}
      {filtered.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '64px 24px', background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
          <FolderOpen style={{ width: 40, height: 40, color: 'var(--border)', marginBottom: 12 }}/>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
            {search || clientFilter || statusFilter !== 'all' ? 'No projects match your filters' : 'No projects yet'}
          </p>
          {canManage && !search && !clientFilter && statusFilter === 'all' && (
            <Link href="/projects/new" style={{
              marginTop: 12, padding: '8px 18px', borderRadius: 8, background: 'var(--brand)',
              color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
              Create your first project
            </Link>
          )}
        </div>
      )}

      {/* ── Groups ── */}
      {groups.map(grp => (
        <div key={grp.key} style={{ marginBottom: 20 }}>
          {/* Group header — only show when "all" status selected */}
          {statusFilter === 'all' && (
            <button onClick={() => toggleGroup(grp.key)}
              style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10,
                background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', fontFamily: 'inherit' }}>
              {collapsed.has(grp.key)
                ? <ChevronRight style={{ width: 14, height: 14, color: grp.color }}/>
                : <ChevronDown  style={{ width: 14, height: 14, color: grp.color }}/>
              }
              <span style={{ fontSize: 11, fontWeight: 800, color: grp.color,
                textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                {grp.label}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', padding: '1px 6px',
                borderRadius: 99, background: 'var(--surface-subtle)', border: '1px solid var(--border)' }}>
                {grp.items.length}
              </span>
            </button>
          )}

          {!collapsed.has(grp.key) && (
            viewMode === 'grid' ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
                {grp.items.map(p => <ProjectCard key={p.id} p={p}/>)}
              </div>
            ) : (
              <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                {viewMode === 'list' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 16px',
                    background: 'var(--surface-subtle)', borderBottom: '1px solid var(--border)',
                    fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
                    textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    <div style={{ width: 8, flexShrink: 0 }}/>
                    <div style={{ flex: 1 }}>Name</div>
                    <div style={{ width: 100, flexShrink: 0 }}>Client</div>
                    <div style={{ width: 120, flexShrink: 0 }}>Progress</div>
                    <div style={{ width: 60, textAlign: 'right', flexShrink: 0 }}>Tasks</div>
                    <div style={{ width: 70, flexShrink: 0 }}>Status</div>
                    <div style={{ width: 80, textAlign: 'right', flexShrink: 0 }}>Due</div>
                    {canManage && <div style={{ width: 56, flexShrink: 0 }}/>}
                  </div>
                )}
                {grp.items.map(p => <ProjectRow key={p.id} p={p}/>)}
              </div>
            )
          )}
        </div>
      ))}
    </div>
  )
}
