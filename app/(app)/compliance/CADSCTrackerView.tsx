'use client'
import { useState, useEffect, useCallback } from 'react'
import { ShieldCheck, AlertTriangle, Clock, Edit2, Check, X, Search, RefreshCw } from 'lucide-react'
import { toast } from '@/store/appStore'

/* ── Types ─────────────────────────────────────────────────────── */
interface ClientDSC {
  id: string
  name: string
  color: string
  email?: string | null
  custom_fields?: Record<string, any> | null
  // derived
  dsc_expiry: string | null      // ISO date
  dsc_holder: string | null      // name of person whose DSC it is
  daysLeft: number | null        // null = not set
}

interface Props {
  userRole: string
}

/* ── Helpers ────────────────────────────────────────────────────── */
function todayStr() { return new Date().toISOString().slice(0, 10) }

function daysUntil(dateStr: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr); target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function getDSCStatus(daysLeft: number | null): {
  label: string; color: string; bg: string; border: string; icon: 'ok' | 'warn' | 'danger' | 'none'
} {
  if (daysLeft === null) return { label: 'Not set', color: '#94a3b8', bg: '#f8fafc', border: '#e2e8f0', icon: 'none' }
  if (daysLeft < 0)     return { label: `Expired ${Math.abs(daysLeft)}d ago`, color: '#dc2626', bg: '#fef2f2', border: '#fecaca', icon: 'danger' }
  if (daysLeft === 0)   return { label: 'Expires today!', color: '#dc2626', bg: '#fef2f2', border: '#fecaca', icon: 'danger' }
  if (daysLeft <= 7)    return { label: `${daysLeft}d left`, color: '#dc2626', bg: '#fef2f2', border: '#fecaca', icon: 'danger' }
  if (daysLeft <= 30)   return { label: `${daysLeft}d left`, color: '#d97706', bg: '#fffbeb', border: '#fde68a', icon: 'warn' }
  return { label: `${daysLeft}d left`, color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', icon: 'ok' }
}

/* ── Component ──────────────────────────────────────────────────── */
export function CADSCTrackerView({ userRole }: Props) {
  const [clients,   setClients]   = useState<ClientDSC[]>([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [editId,    setEditId]    = useState<string | null>(null)
  const [editExpiry, setEditExpiry] = useState('')
  const [editHolder, setEditHolder] = useState('')
  const [saving,    setSaving]    = useState(false)
  const [filterStatus, setFilterStatus] = useState<'all' | 'danger' | 'warn' | 'ok' | 'none'>('all')

  const canManage = ['owner', 'admin', 'manager'].includes(userRole)

  /* ── Load clients ── */
  const loadClients = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/clients')
      const json = await res.json()
      const raw: any[] = Array.isArray(json) ? json : (json.data ?? [])
      const today = todayStr()

      const enriched: ClientDSC[] = raw.map((c: any) => {
        const cf = c.custom_fields ?? {}
        const expiry = cf._dsc_expiry ?? null
        const daysLeft = expiry ? daysUntil(expiry) : null
        return {
          id: c.id, name: c.name, color: c.color ?? '#94a3b8',
          email: c.email ?? null, custom_fields: cf,
          dsc_expiry: expiry, dsc_holder: cf._dsc_holder ?? null, daysLeft,
        }
      })

      // Sort: danger first, then warn, then ok, then none
      const order = (c: ClientDSC) => {
        if (c.daysLeft === null) return 4
        if (c.daysLeft <= 7)    return 0
        if (c.daysLeft <= 30)   return 1
        return 2
      }
      enriched.sort((a, b) => order(a) - order(b) || a.name.localeCompare(b.name))
      setClients(enriched)
    } catch (e) {
      console.error('[DSCTracker] loadClients failed:', e)
      toast.error('Failed to load client data — please refresh')
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadClients() }, [loadClients])

  /* ── Save DSC data ── */
  async function saveDSC(clientId: string) {
    if (!editExpiry) { toast.error('Please enter an expiry date'); return }
    setSaving(true)
    try {
      const client = clients.find(c => c.id === clientId)
      const res = await fetch(`/api/clients/${clientId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          custom_fields: {
            ...(client?.custom_fields ?? {}),
            _dsc_expiry: editExpiry,
            _dsc_holder: editHolder.trim() || null,
          },
        }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error ?? 'Save failed') }
      else {
        toast.success('DSC details updated')
        setEditId(null)
        loadClients()
      }
    } catch { toast.error('Save failed') }
    setSaving(false)
  }

  function startEdit(c: ClientDSC) {
    setEditId(c.id)
    setEditExpiry(c.dsc_expiry ?? '')
    setEditHolder(c.dsc_holder ?? '')
  }

  /* ── Filter + search ── */
  const visible = clients.filter(c => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false
    if (filterStatus !== 'all') {
      const st = getDSCStatus(c.daysLeft)
      if (st.icon !== filterStatus) return false
    }
    return true
  })

  /* ── Stats ── */
  const total   = clients.length
  const danger  = clients.filter(c => c.daysLeft !== null && c.daysLeft <= 7).length
  const warn    = clients.filter(c => c.daysLeft !== null && c.daysLeft > 7 && c.daysLeft <= 30).length
  const notSet  = clients.filter(c => c.daysLeft === null).length

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>

      {/* ── Header ── */}
      <div style={{ padding: '14px 20px 12px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldCheck style={{ width: 16, height: 16, color: '#d97706' }}/>
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>DSC Expiry Tracker</h2>
            <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>Track Digital Signature Certificates for all clients — get alerts 30 days before renewal</p>
          </div>
        </div>

        {/* ── Stats strip ── */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[
            { label: 'Total clients',  value: total,  color: 'var(--text-primary)', bg: 'var(--surface-subtle)', border: 'var(--border)', filter: 'all' as const },
            { label: '⚠ Expiring / expired (≤7d)', value: danger, color: '#dc2626', bg: '#fef2f2', border: '#fecaca', filter: 'danger' as const },
            { label: '⏰ Expiring soon (8–30d)',    value: warn,   color: '#d97706', bg: '#fffbeb', border: '#fde68a', filter: 'warn' as const },
            { label: 'DSC not set',    value: notSet, color: '#94a3b8', bg: 'var(--surface-subtle)', border: 'var(--border)', filter: 'none' as const },
          ].map(stat => (
            <button key={stat.filter}
              onClick={() => setFilterStatus(filterStatus === stat.filter ? 'all' : stat.filter)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                border: `1px solid ${filterStatus === stat.filter ? stat.color : stat.border}`,
                background: filterStatus === stat.filter ? stat.bg : 'var(--surface)',
                boxShadow: filterStatus === stat.filter ? `0 0 0 2px ${stat.color}30` : 'none',
                transition: 'all 0.12s',
              }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: stat.color, lineHeight: 1 }}>{stat.value}</span>
              <span style={{ fontSize: 11, color: stat.color }}>{stat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, maxWidth: 260, background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: 20, padding: '4px 12px' }}>
          <Search style={{ width: 12, height: 12, color: 'var(--text-muted)', flexShrink: 0 }}/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clients…"
            style={{ flex: 1, fontSize: 12, border: 'none', outline: 'none', background: 'transparent', color: 'var(--text-primary)', fontFamily: 'inherit' }}/>
          {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--text-muted)', padding: 0, lineHeight: 1 }}>×</button>}
        </div>

        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>{visible.length} client{visible.length !== 1 ? 's' : ''}</span>

        <button onClick={loadClients} title="Refresh"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface-subtle)', cursor: 'pointer', color: 'var(--text-muted)' }}>
          <RefreshCw style={{ width: 13, height: 13 }}/>
        </button>
      </div>

      {/* ── Info banner ── */}
      {danger > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 20px', background: 'rgba(220,38,38,0.06)', borderBottom: '1px solid #fecaca', flexShrink: 0 }}>
          <AlertTriangle style={{ width: 14, height: 14, color: '#dc2626', flexShrink: 0 }}/>
          <span style={{ fontSize: 12, color: '#991b1b', fontWeight: 500 }}>
            {danger} client{danger !== 1 ? 's have' : ' has'} DSC expiring within 7 days or already expired — renew urgently.
          </span>
        </div>
      )}

      {/* ── Table ── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '48px', color: 'var(--text-muted)', fontSize: 13 }}>
            <div style={{ width: 18, height: 18, border: '2px solid var(--border)', borderTopColor: '#d97706', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }}/>
            Loading clients…
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        ) : visible.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '56px 24px', color: 'var(--text-muted)', textAlign: 'center' }}>
            <ShieldCheck style={{ width: 36, height: 36, marginBottom: 12, opacity: 0.3 }}/>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>No clients match</div>
            <div style={{ fontSize: 12 }}>{search ? 'Try a different search' : 'No clients found'}</div>
          </div>
        ) : (
          <>
            {/* Column headers */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 140px 120px 90px', padding: '6px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface-subtle)', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', position: 'sticky', top: 0, zIndex: 2 }}>
              <span>Client</span>
              <span>DSC Holder</span>
              <span>Expiry Date</span>
              <span style={{ textAlign: 'center' }}>Status</span>
              <span style={{ textAlign: 'center' }}>Action</span>
            </div>

            {visible.map(c => {
              const st     = getDSCStatus(c.daysLeft)
              const isEdit = editId === c.id
              return (
                <div key={c.id} style={{
                  display: 'grid', gridTemplateColumns: '1fr 160px 140px 120px 90px',
                  alignItems: 'center', padding: '0 20px', minHeight: 46,
                  borderBottom: '1px solid var(--border-light)',
                  borderLeft: `3px solid ${st.icon === 'danger' ? '#fca5a5' : st.icon === 'warn' ? '#fde68a' : st.icon === 'ok' ? '#bbf7d0' : 'transparent'}`,
                  background: isEdit ? 'rgba(13,148,136,0.04)' : 'var(--surface)',
                  transition: 'background 0.1s',
                }}>
                  {/* Client name */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, flexShrink: 0 }}/>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                    {c.email && <span style={{ fontSize: 10, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>{c.email}</span>}
                  </div>

                  {/* DSC Holder */}
                  <div>
                    {isEdit ? (
                      <input value={editHolder} onChange={e => setEditHolder(e.target.value)}
                        placeholder="Holder name…"
                        style={{ width: '100%', fontSize: 12, border: '1.5px solid var(--brand)', borderRadius: 6, padding: '3px 8px', outline: 'none', fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--text-primary)' }}/>
                    ) : (
                      <span style={{ fontSize: 12, color: c.dsc_holder ? 'var(--text-secondary)' : 'var(--text-muted)', fontStyle: c.dsc_holder ? 'normal' : 'italic' }}>
                        {c.dsc_holder ?? '—'}
                      </span>
                    )}
                  </div>

                  {/* Expiry Date */}
                  <div>
                    {isEdit ? (
                      <input type="date" value={editExpiry} onChange={e => setEditExpiry(e.target.value)}
                        style={{ fontSize: 12, border: '1.5px solid var(--brand)', borderRadius: 6, padding: '3px 8px', outline: 'none', fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--text-primary)' }}/>
                    ) : (
                      <span style={{ fontSize: 12, fontWeight: c.dsc_expiry ? 500 : 400, color: c.dsc_expiry ? 'var(--text-primary)' : 'var(--text-muted)', fontStyle: c.dsc_expiry ? 'normal' : 'italic' }}>
                        {c.dsc_expiry ? fmtDate(c.dsc_expiry) : 'Not set'}
                      </span>
                    )}
                  </div>

                  {/* Status badge */}
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 99, background: st.bg, color: st.color, border: `1px solid ${st.border}`, whiteSpace: 'nowrap' }}>
                      {st.icon === 'danger' && <AlertTriangle style={{ width: 9, height: 9 }}/>}
                      {st.icon === 'warn'   && <Clock style={{ width: 9, height: 9 }}/>}
                      {st.icon === 'ok'     && <ShieldCheck style={{ width: 9, height: 9 }}/>}
                      {st.label}
                    </span>
                  </div>

                  {/* Action */}
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
                    {canManage && (
                      isEdit ? (
                        <>
                          <button onClick={() => saveDSC(c.id)} disabled={saving}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 6, border: 'none', background: '#0d9488', color: '#fff', cursor: 'pointer', transition: 'opacity 0.1s', opacity: saving ? 0.6 : 1 }}>
                            <Check style={{ width: 12, height: 12 }}/>
                          </button>
                          <button onClick={() => setEditId(null)} disabled={saving}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)', cursor: 'pointer' }}>
                            <X style={{ width: 12, height: 12 }}/>
                          </button>
                        </>
                      ) : (
                        <button onClick={() => startEdit(c)}
                          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface-subtle)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 11, fontWeight: 500, fontFamily: 'inherit', transition: 'all 0.12s' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--brand)'; (e.currentTarget as HTMLElement).style.color = 'var(--brand)' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)' }}>
                          <Edit2 style={{ width: 10, height: 10 }}/> Edit
                        </button>
                      )
                    )}
                  </div>
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
