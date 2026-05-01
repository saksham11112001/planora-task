'use client'
import { useState } from 'react'
import { useRouter }         from 'next/navigation'
import Link                  from 'next/link'
import { Plus, Users2, Pencil, Trash2, CheckSquare } from 'lucide-react'
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

const CLIENTS_PER_PAGE = 50

export function ClientsView({ initialClients, initialGroups, canManage }: Props) {
  const router          = useRouter()
  const [clients, setClients]   = useState<Client[]>(initialClients)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState<Set<string>>(new Set())
  const [clientPage, setClientPage] = useState(0)

  /* ── single delete ── */
  async function handleDelete(id: string, name: string, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    setDeleting(prev => new Set(prev).add(id))
    const res = await fetch(`/api/clients/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setClients(prev => prev.filter(c => c.id !== id))
      setSelected(prev => { const s = new Set(prev); s.delete(id); return s })
      toast.success('Client deleted')
      router.refresh()
    } else {
      const d = await res.json().catch(() => ({}))
      toast.error(d.error ?? 'Failed to delete client')
    }
    setDeleting(prev => { const s = new Set(prev); s.delete(id); return s })
  }

  /* ── bulk delete ── */
  async function handleBulkDelete() {
    if (!selected.size) return
    if (!confirm(`Delete ${selected.size} client(s)? This cannot be undone.`)) return
    const ids = Array.from(selected)
    setDeleting(new Set(ids))
    const results = await Promise.all(
      ids.map(id => fetch(`/api/clients/${id}`, { method: 'DELETE' }).then(r => ({ id, ok: r.ok })))
    )
    const succeeded = results.filter(r => r.ok).map(r => r.id)
    const failed    = results.filter(r => !r.ok).length
    if (succeeded.length) {
      setClients(prev => prev.filter(c => !succeeded.includes(c.id)))
      setSelected(new Set())
      toast.success(`${succeeded.length} client(s) deleted`)
      router.refresh()
    }
    if (failed) toast.error(`${failed} client(s) could not be deleted`)
    setDeleting(new Set())
  }

  /* ── checkbox helpers ── */
  function toggleOne(id: string, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setSelected(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }
  function toggleAll() {
    setSelected(selected.size === clients.length ? new Set() : new Set(clients.map(c => c.id)))
  }

  /* ── render ── */
  return (
    <div className="p-6">
      {/* ── header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Clients</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{clients.length} client{clients.length !== 1 ? 's' : ''}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {canManage && clients.length > 0 && (
            <button
              onClick={toggleAll}
              title={selected.size === clients.length ? 'Deselect all' : 'Select all'}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 13, fontWeight: 500, padding: '7px 13px',
                border: '1.5px solid var(--border)', borderRadius: 8,
                background: 'var(--surface)', color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}>
              <CheckSquare style={{ width: 15, height: 15 }}/>
              {selected.size === clients.length && clients.length > 0 ? 'Deselect all' : 'Select all'}
            </button>
          )}
          {canManage && (
            <Link href="/clients/new" className="btn btn-brand" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus style={{ width: 15, height: 15 }}/> New client
            </Link>
          )}
        </div>
      </div>

      {/* ── bulk action bar ── */}
      {canManage && selected.size > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          background: 'rgba(220,38,38,0.06)', border: '1.5px solid rgba(220,38,38,0.18)',
          borderRadius: 10, padding: '10px 16px', marginBottom: 18,
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#dc2626' }}>
            {selected.size} client{selected.size !== 1 ? 's' : ''} selected
          </span>
          <button
            onClick={handleBulkDelete}
            disabled={deleting.size > 0}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 13, fontWeight: 600, padding: '6px 14px',
              background: '#dc2626', color: '#fff', border: 'none',
              borderRadius: 7, cursor: deleting.size > 0 ? 'not-allowed' : 'pointer',
              opacity: deleting.size > 0 ? 0.6 : 1,
            }}>
            <Trash2 style={{ width: 13, height: 13 }}/>
            {deleting.size > 0 ? 'Deleting…' : 'Delete selected'}
          </button>
          <button
            onClick={() => setSelected(new Set())}
            style={{
              fontSize: 13, color: 'var(--text-muted)', background: 'none',
              border: 'none', cursor: 'pointer', padding: '6px 8px',
            }}>
            Cancel
          </button>
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
      ) : (
        /* ── grid ── */
        <>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.slice(clientPage * CLIENTS_PER_PAGE, (clientPage + 1) * CLIENTS_PER_PAGE).map(c => {
            const isSelected  = selected.has(c.id)
            const isDeleting  = deleting.has(c.id)
            return (
              <div
                key={c.id}
                className="card-elevated"
                style={{
                  position: 'relative',
                  padding: 20,
                  transition: 'box-shadow 0.15s, opacity 0.15s',
                  opacity: isDeleting ? 0.5 : 1,
                  outline: isSelected ? '2px solid #0d9488' : 'none',
                  outlineOffset: 2,
                }}>

                {/* ── checkbox (top-left) ── */}
                {canManage && (
                  <button
                    onClick={e => toggleOne(c.id, e)}
                    title={isSelected ? 'Deselect' : 'Select'}
                    style={{
                      position: 'absolute', top: 10, left: 10,
                      width: 18, height: 18,
                      borderRadius: 4,
                      border: isSelected ? '2px solid #0d9488' : '2px solid var(--border)',
                      background: isSelected ? '#0d9488' : 'var(--surface)',
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      zIndex: 2, padding: 0,
                    }}>
                    {isSelected && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M1.5 5L4 7.5L8.5 2.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </button>
                )}

                {/* ── edit + delete buttons (top-right) ── */}
                {canManage && (
                  <div style={{
                    position: 'absolute', top: 10, right: 10,
                    display: 'flex', alignItems: 'center', gap: 4,
                    zIndex: 2,
                  }}>
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
                        transition: 'background 0.12s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover, #f1f5f9)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface)')}>
                      <Pencil style={{ width: 13, height: 13 }}/>
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
                        transition: 'background 0.12s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(220,38,38,0.12)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(220,38,38,0.05)')}>
                      <Trash2 style={{ width: 13, height: 13 }}/>
                    </button>
                  </div>
                )}

                {/* ── card body (clickable link) ── */}
                <Link
                  href={`/clients/${c.id}`}
                  style={{ display: 'block', textDecoration: 'none', paddingTop: canManage ? 8 : 0 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{
                      height: 44, width: 44, borderRadius: 12,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: c.color, color: '#fff',
                      fontWeight: 700, fontSize: 18, flexShrink: 0,
                    }}>
                      {c.name[0]?.toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.name}
                        </span>
                        <span style={{
                          fontSize: 11, padding: '2px 6px', borderRadius: 4, fontWeight: 600, flexShrink: 0,
                          background: c.status === 'active' ? 'rgba(22,163,74,0.12)' : c.status === 'prospect' ? 'rgba(217,119,6,0.12)' : 'rgba(100,116,139,0.1)',
                          color:      c.status === 'active' ? '#16a34a'              : c.status === 'prospect' ? '#d97706'              : '#64748b',
                        }}>
                          {c.status}
                        </span>
                      </div>
                      {c.company  && <p style={{ fontSize: 13, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.company}</p>}
                      {c.industry && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{c.industry}</p>}
                      {c.email    && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.email}</p>}
                    </div>
                  </div>
                </Link>
              </div>
            )
          })}
        </div>
        {/* ── Pagination controls ── */}
        {clients.length > CLIENTS_PER_PAGE && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 24 }}>
            <button
              onClick={() => setClientPage(p => Math.max(0, p - 1))}
              disabled={clientPage === 0}
              style={{
                padding: '6px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                border: '1.5px solid var(--border)', background: 'var(--surface)',
                color: clientPage === 0 ? 'var(--text-muted)' : 'var(--text-primary)',
                cursor: clientPage === 0 ? 'not-allowed' : 'pointer',
                opacity: clientPage === 0 ? 0.5 : 1,
              }}>
              ← Previous
            </button>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Page {clientPage + 1} of {Math.ceil(clients.length / CLIENTS_PER_PAGE)}
              {' '}·{' '}
              {Math.min((clientPage + 1) * CLIENTS_PER_PAGE, clients.length)} of {clients.length} clients
            </span>
            <button
              onClick={() => setClientPage(p => Math.min(Math.ceil(clients.length / CLIENTS_PER_PAGE) - 1, p + 1))}
              disabled={(clientPage + 1) * CLIENTS_PER_PAGE >= clients.length}
              style={{
                padding: '6px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                border: '1.5px solid var(--border)', background: 'var(--surface)',
                color: (clientPage + 1) * CLIENTS_PER_PAGE >= clients.length ? 'var(--text-muted)' : 'var(--text-primary)',
                cursor: (clientPage + 1) * CLIENTS_PER_PAGE >= clients.length ? 'not-allowed' : 'pointer',
                opacity: (clientPage + 1) * CLIENTS_PER_PAGE >= clients.length ? 0.5 : 1,
              }}>
              Next →
            </button>
          </div>
        )}
        </>
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
