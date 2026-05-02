'use client'
import { useState, useMemo } from 'react'
import { useRouter }         from 'next/navigation'
import Link                  from 'next/link'
import { Plus, Users2, Pencil, Trash2, Search, X } from 'lucide-react'
import { toast }             from '@/store/appStore'
import { ClientGroupsSection } from './ClientGroupsSection'

type Client = {
  id: string
  name: string
  color: string
  status: string
  email?: string | null
  company?: string | null
  industry?: string | null
  group_id?: string | null
}

type Group = { id: string; name: string; color: string; notes: string | null }

interface Props {
  initialClients: Client[]
  initialGroups:  Group[]
  canManage: boolean
}

export function ClientsView({ initialClients, initialGroups, canManage }: Props) {
  const router          = useRouter()
  const [clients, setClients]   = useState<Client[]>(initialClients)
  const [deleting, setDeleting] = useState<Set<string>>(new Set())
  const [search, setSearch]     = useState('')

  /* ── single delete ── */
  async function handleDelete(id: string, name: string, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    setDeleting(prev => new Set(prev).add(id))
    const res = await fetch(`/api/clients/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setClients(prev => prev.filter(c => c.id !== id))
      toast.success('Client deleted')
      router.refresh()
    } else {
      const d = await res.json().catch(() => ({}))
      toast.error(d.error ?? 'Failed to delete client')
    }
    setDeleting(prev => { const s = new Set(prev); s.delete(id); return s })
  }

  /* ── filtered + grouped by first letter ── */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return clients
    return clients.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.company ?? '').toLowerCase().includes(q) ||
      (c.email ?? '').toLowerCase().includes(q) ||
      (c.industry ?? '').toLowerCase().includes(q)
    )
  }, [clients, search])

  const letterGroups = useMemo(() => {
    const map = new Map<string, Client[]>()
    for (const c of [...filtered].sort((a, b) => a.name.localeCompare(b.name))) {
      const letter = c.name[0]?.toUpperCase() ?? '#'
      const key = /[A-Z]/.test(letter) ? letter : '#'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(c)
    }
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === '#') return 1
      if (b === '#') return -1
      return a.localeCompare(b)
    })
  }, [filtered])

  /* ── render ── */
  return (
    <div className="p-6">
      {/* ── header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Clients</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {clients.length} client{clients.length !== 1 ? 's' : ''}
            {search && filtered.length !== clients.length ? ` · ${filtered.length} matching` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {canManage && (
            <Link href="/clients/new" className="btn btn-brand" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus style={{ width: 15, height: 15 }}/> New client
            </Link>
          )}
        </div>
      </div>

      {/* ── search bar ── */}
      {clients.length > 0 && (
        <div style={{ position: 'relative', maxWidth: 400, marginBottom: 24 }}>
          <Search style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search clients by name, company, email…"
            style={{
              width: '100%', paddingLeft: 34, paddingRight: search ? 34 : 12,
              height: 38, fontSize: 13, border: '1.5px solid var(--border)',
              borderRadius: 9, background: 'var(--surface)', color: 'var(--text-primary)',
              outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
            }}
            onFocus={e => (e.target as HTMLElement).style.borderColor = 'var(--brand)'}
            onBlur={e => (e.target as HTMLElement).style.borderColor = 'var(--border)'}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex' }}>
              <X style={{ width: 14, height: 14 }} />
            </button>
          )}
        </div>
      )}

      {/* ── empty state ── */}
      {clients.length === 0 ? (
        <div className="card text-center py-16">
          <Users2 style={{ width: 48, height: 48, color: 'var(--text-muted)', margin: '0 auto 12px' }}/>
          <h3 className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>No clients yet</h3>
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>Add your first client to link projects to them</p>
          {canManage && <Link href="/clients/new" className="btn btn-brand">Add client</Link>}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)', fontSize: 14 }}>
          No clients match &quot;{search}&quot;
        </div>
      ) : (
        <div>
          {letterGroups.map(([letter, group]) => (
            <div key={letter} style={{ marginBottom: 28 }}>
              {/* Letter divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                  background: 'var(--brand)', color: '#fff',
                  fontWeight: 800, fontSize: 15,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {letter}
                </div>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                  {group.length} client{group.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Client rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {group.map(c => {
                  const isDeleting = deleting.has(c.id)
                  return (
                    <div key={c.id} style={{ position: 'relative', opacity: isDeleting ? 0.5 : 1 }}>
                      <Link
                        href={`/clients/${c.id}`}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '10px 14px', borderRadius: 10,
                          border: '1.5px solid var(--border)',
                          background: 'var(--surface)',
                          textDecoration: 'none',
                          transition: 'border-color 0.12s, box-shadow 0.12s',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--brand)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none' }}>
                        {/* Avatar */}
                        <div style={{
                          height: 38, width: 38, borderRadius: 10,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: c.color, color: '#fff',
                          fontWeight: 700, fontSize: 16, flexShrink: 0,
                        }}>
                          {c.name[0]?.toUpperCase()}
                        </div>

                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {c.name}
                            </span>
                            <span style={{
                              fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 600, flexShrink: 0,
                              background: c.status === 'active' ? 'rgba(22,163,74,0.12)' : c.status === 'prospect' ? 'rgba(217,119,6,0.12)' : 'rgba(100,116,139,0.1)',
                              color:      c.status === 'active' ? '#16a34a'              : c.status === 'prospect' ? '#d97706'              : '#64748b',
                            }}>
                              {c.status}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 2 }}>
                            {c.company  && <span style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.company}</span>}
                            {c.email    && <span style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.email}</span>}
                            {c.industry && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.industry}</span>}
                          </div>
                        </div>
                      </Link>

                      {/* Actions — positioned absolutely to not interfere with link */}
                      {canManage && (
                        <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: 4, zIndex: 2 }}>
                          <Link
                            href={`/clients/${c.id}/edit`}
                            onClick={e => e.stopPropagation()}
                            title="Edit client"
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              width: 28, height: 28, borderRadius: 6,
                              border: '1.5px solid var(--border)',
                              background: 'var(--surface)',
                              color: 'var(--text-secondary)',
                              textDecoration: 'none',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover, #f1f5f9)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface)')}>
                            <Pencil style={{ width: 12, height: 12 }}/>
                          </Link>
                          <button
                            onClick={e => handleDelete(c.id, c.name, e)}
                            disabled={isDeleting}
                            title="Delete client"
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              width: 28, height: 28, borderRadius: 6,
                              border: '1.5px solid rgba(220,38,38,0.25)',
                              background: 'rgba(220,38,38,0.05)',
                              color: '#dc2626',
                              cursor: isDeleting ? 'not-allowed' : 'pointer',
                            }}>
                            <Trash2 style={{ width: 12, height: 12 }}/>
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Client Groups ── */}
      <ClientGroupsSection
        initialGroups={initialGroups}
        allClients={clients.map(c => ({ id: c.id, name: c.name, color: c.color, status: c.status, group_id: c.group_id ?? null }))}
        canManage={canManage}
      />
    </div>
  )
}
