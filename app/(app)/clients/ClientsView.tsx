'use client'
import { useState, useMemo, useRef, useEffect } from 'react'
import { useRouter }         from 'next/navigation'
import Link                  from 'next/link'
import { Plus, Users2, Pencil, Trash2, Search, X, Building2, Mail, Tag } from 'lucide-react'
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

const STATUS_META: Record<string, { label: string; dot: string; bg: string; color: string }> = {
  active:   { label: 'Active',   dot: '#16a34a', bg: 'rgba(22,163,74,0.10)',   color: '#16a34a' },
  prospect: { label: 'Prospect', dot: '#d97706', bg: 'rgba(217,119,6,0.10)',   color: '#d97706' },
  inactive: { label: 'Inactive', dot: '#94a3b8', bg: 'rgba(100,116,139,0.10)', color: '#64748b' },
}

const STATUS_TABS = ['all', 'active', 'prospect', 'inactive'] as const
type StatusTab = typeof STATUS_TABS[number]

export function ClientsView({ initialClients, initialGroups, canManage }: Props) {
  const router = useRouter()
  const [clients, setClients]       = useState<Client[]>(initialClients)
  const [deleting, setDeleting]     = useState<Set<string>>(new Set())
  const [search, setSearch]         = useState('')
  const [statusTab, setStatusTab]   = useState<StatusTab>('all')
  const [jumpLetter, setJumpLetter] = useState<string | null>(null)
  const letterRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const searchRef  = useRef<HTMLInputElement>(null)

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

  /* ── stats ── */
  const stats = useMemo(() => ({
    total:    clients.length,
    active:   clients.filter(c => c.status === 'active').length,
    prospect: clients.filter(c => c.status === 'prospect').length,
    inactive: clients.filter(c => c.status === 'inactive').length,
  }), [clients])

  /* ── filtered + grouped by first letter ── */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return clients.filter(c => {
      if (statusTab !== 'all' && c.status !== statusTab) return false
      if (!q) return true
      return (
        c.name.toLowerCase().includes(q) ||
        (c.company ?? '').toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q) ||
        (c.industry ?? '').toLowerCase().includes(q)
      )
    })
  }, [clients, search, statusTab])

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

  const availableLetters = useMemo(() => new Set(letterGroups.map(([l]) => l)), [letterGroups])

  /* ── jump to letter ── */
  function jumpTo(letter: string) {
    setJumpLetter(letter)
    const el = letterRefs.current[letter]
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setTimeout(() => setJumpLetter(null), 1200)
  }

  /* ── keyboard shortcut: Ctrl+K / Cmd+K to focus search ── */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus() }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

  /* ── render ── */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── sticky top bar ── */}
      <div style={{
        padding: '20px 28px 0',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        {/* Row 1: Title + CTA */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              Clients
            </h1>
            <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
              {clients.length.toLocaleString()} client{clients.length !== 1 ? 's' : ''}
              {(search || statusTab !== 'all') && filtered.length !== clients.length
                ? ` · ${filtered.length.toLocaleString()} shown`
                : ''}
            </p>
          </div>
          {canManage && (
            <Link href="/clients/new" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 9, fontSize: 13, fontWeight: 600,
              background: 'var(--brand)', color: '#fff', textDecoration: 'none',
              boxShadow: '0 2px 8px rgba(13,148,136,0.25)', transition: 'opacity 0.12s',
            }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.88'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}>
              <Plus style={{ width: 14, height: 14 }}/> New client
            </Link>
          )}
        </div>

        {/* Row 2: Stats pills */}
        {clients.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            {([
              { key: 'all',      label: 'All',      count: stats.total,    bg: 'var(--surface-subtle)', color: 'var(--text-primary)', border: 'var(--border)' },
              { key: 'active',   label: 'Active',   count: stats.active,   bg: 'rgba(22,163,74,0.08)',  color: '#16a34a',             border: 'rgba(22,163,74,0.2)' },
              { key: 'prospect', label: 'Prospect', count: stats.prospect, bg: 'rgba(217,119,6,0.08)',  color: '#d97706',             border: 'rgba(217,119,6,0.2)' },
              { key: 'inactive', label: 'Inactive', count: stats.inactive, bg: 'rgba(100,116,139,0.08)',color: '#64748b',             border: 'rgba(100,116,139,0.2)' },
            ] as const).map(t => (
              <button key={t.key} onClick={() => setStatusTab(t.key as StatusTab)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '5px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600,
                  border: `1.5px solid ${statusTab === t.key ? t.color : t.border}`,
                  background: statusTab === t.key ? t.bg : 'transparent',
                  color: statusTab === t.key ? t.color : 'var(--text-muted)',
                  cursor: 'pointer', transition: 'all 0.12s',
                }}>
                {t.label}
                <span style={{
                  fontSize: 11, fontWeight: 700, minWidth: 18, height: 18,
                  borderRadius: 99, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  background: statusTab === t.key ? t.color : 'var(--border)',
                  color: statusTab === t.key ? '#fff' : 'var(--text-muted)',
                  padding: '0 5px',
                }}>
                  {t.count}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Row 3: Search */}
        {clients.length > 0 && (
          <div style={{ position: 'relative', maxWidth: 480, marginBottom: 0, paddingBottom: 14 }}>
            <Search style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input
              ref={searchRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, company, email, industry…"
              style={{
                width: '100%', paddingLeft: 34, paddingRight: search ? 34 : 12,
                height: 38, fontSize: 13, border: '1.5px solid var(--border)',
                borderRadius: 9, background: 'var(--surface-subtle)', color: 'var(--text-primary)',
                outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
              }}
              onFocus={e => { (e.target as HTMLElement).style.borderColor = 'var(--brand)'; (e.target as HTMLElement).style.background = 'var(--surface)' }}
              onBlur={e => { (e.target as HTMLElement).style.borderColor = 'var(--border)'; (e.target as HTMLElement).style.background = 'var(--surface-subtle)' }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex' }}>
                <X style={{ width: 14, height: 14 }} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Client Groups ── */}
      <div style={{ padding: '0 28px', flexShrink: 0 }}>
        <ClientGroupsSection
          initialGroups={initialGroups}
          allClients={clients.map(c => ({ id: c.id, name: c.name, color: c.color, status: c.status, group_id: c.group_id ?? null }))}
          canManage={canManage}
        />
      </div>

      {/* ── Main content area ── */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', minHeight: 0 }}>

        {/* A–Z Jump bar */}
        {letterGroups.length > 4 && (
          <div style={{
            width: 30, flexShrink: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', padding: '16px 0', gap: 1,
            borderRight: '1px solid var(--border)',
            position: 'sticky', top: 0, alignSelf: 'flex-start', height: '100vh',
            overflowY: 'auto',
          }}>
            {ALPHABET.map(l => {
              const available = availableLetters.has(l)
              const active    = jumpLetter === l
              return (
                <button key={l} onClick={() => available && jumpTo(l)} disabled={!available}
                  title={available ? `Jump to ${l}` : undefined}
                  style={{
                    width: 22, height: 18, border: 'none', borderRadius: 4,
                    background: active ? 'var(--brand)' : 'transparent',
                    color: active ? '#fff' : available ? 'var(--text-secondary)' : 'var(--text-muted)',
                    fontSize: 10, fontWeight: active ? 800 : available ? 600 : 400,
                    cursor: available ? 'pointer' : 'default',
                    opacity: available ? 1 : 0.3,
                    transition: 'all 0.1s',
                    padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                  {l}
                </button>
              )
            })}
            {availableLetters.has('#') && (
              <button onClick={() => jumpTo('#')}
                style={{ width: 22, height: 18, border: 'none', borderRadius: 4, background: jumpLetter === '#' ? 'var(--brand)' : 'transparent', color: jumpLetter === '#' ? '#fff' : 'var(--text-secondary)', fontSize: 10, fontWeight: 600, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                #
              </button>
            )}
          </div>
        )}

        {/* Client list */}
        <div style={{ flex: 1, padding: '20px 28px', minWidth: 0 }}>

          {/* ── empty states ── */}
          {clients.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 24px' }}>
              <div style={{ width: 64, height: 64, borderRadius: 18, background: 'var(--surface-subtle)', border: '2px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <Users2 style={{ width: 28, height: 28, color: 'var(--text-muted)' }}/>
              </div>
              <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>No clients yet</h3>
              <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text-muted)' }}>Add your first client to get started</p>
              {canManage && (
                <Link href="/clients/new" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 9, background: 'var(--brand)', color: '#fff', fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>
                  <Plus style={{ width: 14, height: 14 }}/> Add client
                </Link>
              )}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--text-muted)' }}>
              <Search style={{ width: 32, height: 32, margin: '0 auto 12px', opacity: 0.3 }}/>
              <p style={{ fontSize: 14, fontWeight: 500, margin: '0 0 4px', color: 'var(--text-secondary)' }}>
                No clients match your filters
              </p>
              <p style={{ fontSize: 12, margin: 0 }}>
                Try adjusting your search or status filter
              </p>
              <button onClick={() => { setSearch(''); setStatusTab('all') }}
                style={{ marginTop: 16, padding: '7px 16px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Clear filters
              </button>
            </div>
          ) : (
            <div>
              {letterGroups.map(([letter, group]) => (
                <div key={letter} style={{ marginBottom: 32 }}
                  ref={el => { letterRefs.current[letter] = el }}>

                  {/* Letter header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, position: 'sticky', top: 0, zIndex: 2, padding: '6px 0', background: 'var(--bg, #f8fafc)' }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                      background: jumpLetter === letter ? 'var(--brand)' : 'var(--surface-subtle)',
                      color: jumpLetter === letter ? '#fff' : 'var(--text-muted)',
                      border: `1.5px solid ${jumpLetter === letter ? 'var(--brand)' : 'var(--border)'}`,
                      fontWeight: 800, fontSize: 13,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.15s',
                    }}>
                      {letter}
                    </div>
                    <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, fontWeight: 500 }}>
                      {group.length}
                    </span>
                  </div>

                  {/* Client cards — compact rows with a subtle grid feel */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 8 }}>
                    {group.map(c => {
                      const isDeleting = deleting.has(c.id)
                      const sm = STATUS_META[c.status] ?? STATUS_META.inactive
                      return (
                        <div key={c.id} style={{ position: 'relative', opacity: isDeleting ? 0.5 : 1 }}>
                          <Link
                            href={`/clients/${c.id}`}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 12,
                              padding: '10px 12px',
                              paddingRight: canManage ? 76 : 12,
                              borderRadius: 10,
                              border: '1.5px solid var(--border)',
                              background: 'var(--surface)',
                              textDecoration: 'none',
                              transition: 'border-color 0.12s, box-shadow 0.12s, background 0.12s',
                            }}
                            onMouseEnter={e => {
                              const el = e.currentTarget as HTMLElement
                              el.style.borderColor = 'var(--brand)'
                              el.style.boxShadow = '0 2px 12px rgba(13,148,136,0.10)'
                              el.style.background = 'var(--surface-subtle)'
                            }}
                            onMouseLeave={e => {
                              const el = e.currentTarget as HTMLElement
                              el.style.borderColor = 'var(--border)'
                              el.style.boxShadow = 'none'
                              el.style.background = 'var(--surface)'
                            }}>

                            {/* Colour avatar */}
                            <div style={{
                              height: 36, width: 36, borderRadius: 9, flexShrink: 0,
                              background: c.color, color: '#fff',
                              fontWeight: 800, fontSize: 15,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              letterSpacing: '-0.01em',
                            }}>
                              {c.name[0]?.toUpperCase()}
                            </div>

                            {/* Main info */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {c.name}
                                </span>
                                {/* Status dot + label */}
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 3,
                                  fontSize: 10, padding: '1px 6px', borderRadius: 99, fontWeight: 600,
                                  background: sm.bg, color: sm.color, flexShrink: 0,
                                  border: `1px solid ${sm.dot}22`,
                                }}>
                                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: sm.dot, flexShrink: 0 }} />
                                  {sm.label}
                                </span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'nowrap', overflow: 'hidden' }}>
                                {c.company && (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150 }}>
                                    <Building2 style={{ width: 10, height: 10, flexShrink: 0, opacity: 0.6 }}/>{c.company}
                                  </span>
                                )}
                                {c.email && (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
                                    <Mail style={{ width: 10, height: 10, flexShrink: 0, opacity: 0.5 }}/>{c.email}
                                  </span>
                                )}
                                {!c.company && !c.email && c.industry && (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--text-muted)' }}>
                                    <Tag style={{ width: 10, height: 10, flexShrink: 0, opacity: 0.5 }}/>{c.industry}
                                  </span>
                                )}
                              </div>
                            </div>
                          </Link>

                          {/* Actions — hover-reveal via CSS opacity trick */}
                          {canManage && (
                            <div style={{
                              position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                              display: 'flex', gap: 4, zIndex: 2,
                            }}>
                              <Link
                                href={`/clients/${c.id}/edit`}
                                onClick={e => e.stopPropagation()}
                                title="Edit client"
                                style={{
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  width: 28, height: 28, borderRadius: 7,
                                  border: '1.5px solid var(--border)',
                                  background: 'var(--surface)',
                                  color: 'var(--text-secondary)',
                                  textDecoration: 'none',
                                  transition: 'background 0.1s, border-color 0.1s',
                                }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-subtle)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--brand)' }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}>
                                <Pencil style={{ width: 11, height: 11 }}/>
                              </Link>
                              <button
                                onClick={e => handleDelete(c.id, c.name, e)}
                                disabled={isDeleting}
                                title="Delete client"
                                style={{
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  width: 28, height: 28, borderRadius: 7,
                                  border: '1.5px solid rgba(220,38,38,0.2)',
                                  background: 'rgba(220,38,38,0.04)',
                                  color: '#dc2626',
                                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                                  transition: 'background 0.1s',
                                }}
                                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(220,38,38,0.10)'}
                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(220,38,38,0.04)'}>
                                <Trash2 style={{ width: 11, height: 11 }}/>
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
        </div>
      </div>
    </div>
  )
}
