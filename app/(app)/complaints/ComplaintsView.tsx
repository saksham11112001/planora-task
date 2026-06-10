'use client'
import { useEffect, useState, useCallback } from 'react'

type Report = {
  id: string
  message: string
  page_url: string | null
  attachments: string[] | null
  status: 'open' | 'in_progress' | 'resolved' | 'dismissed'
  created_at: string
  reporter: { id: string; name: string; email: string } | null
  org: { id: string; name: string } | null
}

type TopPage = { path: string; count: number }

const STATUS_COLORS: Record<string, string> = {
  open:        'background:#fef2f2;color:#dc2626;border:1px solid #fecaca',
  in_progress: 'background:#fffbeb;color:#d97706;border:1px solid #fde68a',
  resolved:    'background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0',
  dismissed:   'background:#f8fafc;color:#94a3b8;border:1px solid #e2e8f0',
}

const STATUS_LABELS: Record<string, string> = {
  open: 'Open', in_progress: 'In Progress', resolved: 'Resolved', dismissed: 'Dismissed',
}

export default function ComplaintsView() {
  const [reports,   setReports]   = useState<Report[]>([])
  const [topPages,  setTopPages]  = useState<TopPage[]>([])
  const [loading,   setLoading]   = useState(true)
  const [filter,    setFilter]    = useState<string>('open')
  const [search,    setSearch]    = useState('')
  const [expanded,  setExpanded]  = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/complaints')
      if (res.ok) {
        const d = await res.json()
        setReports(d.reports ?? [])
        setTopPages(d.topPages ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/admin/complaints/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setReports(r => r.map(x => x.id === id ? { ...x, status: status as Report['status'] } : x))
  }

  const filtered = reports.filter(r => {
    const matchStatus = filter === 'all' || r.status === filter
    const q = search.toLowerCase()
    const matchSearch = !q ||
      r.message?.toLowerCase().includes(q) ||
      r.page_url?.toLowerCase().includes(q) ||
      r.reporter?.email?.toLowerCase().includes(q) ||
      r.org?.name?.toLowerCase().includes(q)
    return matchStatus && matchSearch
  })

  const counts = {
    open:        reports.filter(r => r.status === 'open').length,
    in_progress: reports.filter(r => r.status === 'in_progress').length,
    resolved:    reports.filter(r => r.status === 'resolved').length,
    dismissed:   reports.filter(r => r.status === 'dismissed').length,
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1200, margin: '0 auto', fontFamily: 'inherit' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--fg, #0f172a)', margin: 0 }}>Complaints</h1>
          <p style={{ fontSize: 13, color: 'var(--muted, #64748b)', marginTop: 4 }}>Admin view · {reports.length} total reports</p>
        </div>
        <button onClick={load} style={{ padding: '8px 16px', borderRadius: 8, border: '1.5px solid var(--border, #e2e8f0)',
          background: 'var(--surface, #fff)', color: 'var(--fg, #0f172a)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
          ↻ Refresh
        </button>
      </div>

      {/* Stat cards */}
      <div className="stat-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
        {([
          { key: 'open',        label: 'Open',        color: '#dc2626', bg: '#fef2f2' },
          { key: 'in_progress', label: 'In Progress',  color: '#d97706', bg: '#fffbeb' },
          { key: 'resolved',    label: 'Resolved',     color: '#16a34a', bg: '#f0fdf4' },
          { key: 'dismissed',   label: 'Dismissed',    color: '#94a3b8', bg: '#f8fafc' },
        ] as const).map(({ key, label, color, bg }) => (
          <button key={key} onClick={() => setFilter(key)}
            style={{ padding: '16px', borderRadius: 12, border: `2px solid ${filter === key ? color : 'var(--border,#e2e8f0)'}`,
              background: filter === key ? bg : 'var(--surface,#fff)', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color }}>{counts[key]}</div>
            <div style={{ fontSize: 12, color: 'var(--muted,#64748b)', marginTop: 2 }}>{label}</div>
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20, alignItems: 'start' }}>

        {/* Left: table */}
        <div>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search message, page, user, org…"
              style={{ flex: 1, padding: '9px 14px', border: '1.5px solid var(--border,#e2e8f0)', borderRadius: 8,
                fontSize: 13, color: 'var(--fg,#0f172a)', background: 'var(--surface,#fff)',
                outline: 'none', fontFamily: 'inherit' }} />
            <select value={filter} onChange={e => setFilter(e.target.value)}
              style={{ padding: '9px 12px', border: '1.5px solid var(--border,#e2e8f0)', borderRadius: 8,
                fontSize: 13, background: 'var(--surface,#fff)', color: 'var(--fg,#0f172a)', fontFamily: 'inherit', cursor: 'pointer' }}>
              <option value="all">All statuses</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="dismissed">Dismissed</option>
            </select>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted,#94a3b8)', fontSize: 14 }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted,#94a3b8)', fontSize: 14 }}>No complaints match this filter.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filtered.map(r => {
                const open = expanded === r.id
                const path = r.page_url ? (() => { try { return new URL(r.page_url).pathname } catch { return r.page_url } })() : null
                const ago  = (() => {
                  const ms = Date.now() - new Date(r.created_at).getTime()
                  const h = Math.floor(ms / 3600000)
                  if (h < 1) return `${Math.floor(ms/60000)}m ago`
                  if (h < 24) return `${h}h ago`
                  return `${Math.floor(h/24)}d ago`
                })()
                return (
                  <div key={r.id} style={{ border: '1.5px solid var(--border,#e2e8f0)', borderRadius: 12,
                    background: 'var(--surface,#fff)', overflow: 'hidden' }}>
                    <div onClick={() => setExpanded(open ? null : r.id)}
                      style={{ padding: '14px 16px', cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      {/* Status dot */}
                      <div style={{ width: 8, height: 8, borderRadius: '50%', marginTop: 6, flexShrink: 0,
                        background: r.status === 'open' ? '#dc2626' : r.status === 'in_progress' ? '#d97706' : r.status === 'resolved' ? '#16a34a' : '#94a3b8' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                          {path && (
                            <code style={{ fontSize: 11, background: 'var(--surface-2,#f8fafc)', padding: '2px 6px',
                              borderRadius: 4, color: '#0d9488', border: '1px solid var(--border,#e2e8f0)' }}>{path}</code>
                          )}
                          <span style={{ fontSize: 11, borderRadius: 4, padding: '2px 8px', ...Object.fromEntries(
                            STATUS_COLORS[r.status]?.split(';').map(s => { const [k,v]=s.split(':'); return [k?.trim().replace(/-([a-z])/g,(_,c)=>c.toUpperCase()),v?.trim()] }).filter(([k])=>k) ?? []
                          ) }}>{STATUS_LABELS[r.status]}</span>
                          <span style={{ fontSize: 11, color: 'var(--muted,#94a3b8)' }}>{ago}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: 13, color: 'var(--fg,#0f172a)', lineHeight: 1.5,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: open ? 'normal' : 'nowrap' }}>
                          {r.message || '(no message)'}
                        </p>
                        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--muted,#94a3b8)' }}>
                          {r.reporter?.email ?? 'anonymous'}{r.org?.name ? ` · ${r.org.name}` : ''}
                        </div>
                      </div>
                      <span style={{ color: 'var(--muted,#94a3b8)', fontSize: 16, flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
                    </div>

                    {open && (
                      <div style={{ borderTop: '1px solid var(--border,#e2e8f0)', padding: '14px 16px', background: 'var(--surface-2,#f8fafc)' }}>
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 11, color: 'var(--muted,#64748b)', marginBottom: 4 }}>Full URL</div>
                          <a href={r.page_url ?? '#'} target="_blank" rel="noreferrer"
                            style={{ fontSize: 12, color: '#0d9488', wordBreak: 'break-all' }}>{r.page_url ?? '—'}</a>
                        </div>
                        {r.attachments && r.attachments.length > 0 && (
                          <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 11, color: 'var(--muted,#64748b)', marginBottom: 4 }}>Attachments</div>
                            {r.attachments.map((u, i) => (
                              <a key={i} href={u} target="_blank" rel="noreferrer"
                                style={{ display: 'block', fontSize: 12, color: '#0d9488', marginBottom: 2 }}>
                                📎 Attachment {i + 1}
                              </a>
                            ))}
                          </div>
                        )}
                        <div style={{ fontSize: 11, color: 'var(--muted,#64748b)', marginBottom: 6 }}>Update status</div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {(['open','in_progress','resolved','dismissed'] as const).map(s => (
                            <button key={s} onClick={() => updateStatus(r.id, s)}
                              style={{ padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                                border: `1.5px solid ${r.status === s ? '#0d9488' : 'var(--border,#e2e8f0)'}`,
                                background: r.status === s ? '#0d9488' : 'var(--surface,#fff)',
                                color: r.status === s ? '#fff' : 'var(--fg,#374151)', fontWeight: r.status === s ? 600 : 400 }}>
                              {STATUS_LABELS[s]}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right: top pages panel */}
        <div style={{ border: '1.5px solid var(--border,#e2e8f0)', borderRadius: 12, background: 'var(--surface,#fff)', padding: '16px' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 4px', color: 'var(--fg,#0f172a)' }}>Most Complained Pages</h3>
          <p style={{ fontSize: 12, color: 'var(--muted,#94a3b8)', margin: '0 0 14px' }}>All-time, by path</p>
          {topPages.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--muted,#94a3b8)' }}>No data yet.</p>
          ) : topPages.map(({ path, count }, i) => {
            const max = topPages[0].count
            return (
              <div key={path} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <code style={{ color: '#0d9488', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{path}</code>
                  <span style={{ fontWeight: 700, color: 'var(--fg,#0f172a)', flexShrink: 0, marginLeft: 8 }}>{count}</span>
                </div>
                <div style={{ height: 6, background: 'var(--border,#e2e8f0)', borderRadius: 3 }}>
                  <div style={{ height: '100%', borderRadius: 3, width: `${(count/max)*100}%`,
                    background: i === 0 ? '#dc2626' : i === 1 ? '#d97706' : '#0d9488' }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
