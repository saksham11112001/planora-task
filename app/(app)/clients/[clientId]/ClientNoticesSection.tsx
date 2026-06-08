'use client'
import { useState, useEffect, useCallback } from 'react'

interface Notice {
  id: string
  title: string
  notice_type: string
  portal: string
  notice_date: string
  response_due: string | null
  notes: string | null
  status: string
}

interface Props {
  clientId: string
  canManage: boolean
}

const NOTICE_TYPES = ['Income Tax', 'GST', 'ROC', 'Labour', 'Other']
const PORTALS = ['Income Tax', 'GST', 'MCA', 'TRACES', 'EPFO', 'Other']
const STATUSES = ['Action Pending', 'Response Filed', 'Closed']

function statusStyle(status: string): React.CSSProperties {
  if (status === 'Action Pending') return { background: 'rgba(217,119,6,0.12)', color: '#b45309', border: '1px solid rgba(217,119,6,0.25)' }
  if (status === 'Response Filed') return { background: 'rgba(37,99,235,0.1)', color: '#1d4ed8', border: '1px solid rgba(37,99,235,0.2)' }
  return { background: 'rgba(22,163,74,0.1)', color: '#15803d', border: '1px solid rgba(22,163,74,0.2)' }
}

const emptyForm = { title: '', notice_type: 'Income Tax', portal: 'Income Tax', notice_date: '', response_due: '', notes: '', status: 'Action Pending' }

export function ClientNoticesSection({ clientId, canManage }: Props) {
  const [notices, setNotices] = useState<Notice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ...emptyForm })
  const [submitting, setSubmitting] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/notices?client_id=${clientId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to load notices')
      setNotices(data.notices ?? data ?? [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => { load() }, [load])

  function openAdd() {
    setForm({ ...emptyForm })
    setEditId(null)
    setShowForm(true)
  }

  function openEdit(n: Notice) {
    setForm({
      title: n.title,
      notice_type: n.notice_type,
      portal: n.portal,
      notice_date: n.notice_date ?? '',
      response_due: n.response_due ?? '',
      notes: n.notes ?? '',
      status: n.status,
    })
    setEditId(n.id)
    setShowForm(true)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const body = { ...form, client_id: clientId }
      const res = editId
        ? await fetch(`/api/notices/${editId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        : await fetch('/api/notices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setShowForm(false)
      setEditId(null)
      await load()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function deleteNotice(id: string) {
    if (!confirm('Delete this notice?')) return
    try {
      const res = await fetch(`/api/notices/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      setNotices(prev => prev.filter(n => n.id !== id))
    } catch (e: any) {
      setError(e.message)
    }
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', background: 'var(--surface)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>📋 Notices &amp; Correspondence</span>
          <span style={{
            fontSize: '11px', fontWeight: 700, color: '#0d9488',
            background: 'rgba(13,148,136,0.1)', borderRadius: '20px', padding: '2px 8px',
          }}>{notices.length}</span>
        </div>
        {canManage && (
          <button
            onClick={openAdd}
            style={{ fontSize: '12px', fontWeight: 600, color: '#fff', background: '#0d9488', border: 'none', borderRadius: '7px', padding: '6px 14px', cursor: 'pointer' }}>
            + Add Notice
          </button>
        )}
      </div>

      {error && (
        <div style={{ fontSize: '13px', color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '8px 12px', marginBottom: '12px' }}>
          {error}
        </div>
      )}

      {/* Inline Form */}
      {showForm && (
        <form onSubmit={submit} style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px', marginBottom: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Title *</label>
              <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Notice u/s 148 AY 2023-24"
                style={{ width: '100%', fontSize: '13px', border: '1px solid var(--border)', borderRadius: '6px', padding: '6px 10px', background: 'var(--surface)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Notice Type</label>
              <select value={form.notice_type} onChange={e => setForm(f => ({ ...f, notice_type: e.target.value }))}
                style={{ width: '100%', fontSize: '13px', border: '1px solid var(--border)', borderRadius: '6px', padding: '6px 10px', background: 'var(--surface)', color: 'var(--text-primary)' }}>
                {NOTICE_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Portal</label>
              <select value={form.portal} onChange={e => setForm(f => ({ ...f, portal: e.target.value }))}
                style={{ width: '100%', fontSize: '13px', border: '1px solid var(--border)', borderRadius: '6px', padding: '6px 10px', background: 'var(--surface)', color: 'var(--text-primary)' }}>
                {PORTALS.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Notice Date</label>
              <input type="date" value={form.notice_date} onChange={e => setForm(f => ({ ...f, notice_date: e.target.value }))}
                style={{ width: '100%', fontSize: '13px', border: '1px solid var(--border)', borderRadius: '6px', padding: '6px 10px', background: 'var(--surface)', color: 'var(--text-primary)' }} />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Response Due</label>
              <input type="date" value={form.response_due} onChange={e => setForm(f => ({ ...f, response_due: e.target.value }))}
                style={{ width: '100%', fontSize: '13px', border: '1px solid var(--border)', borderRadius: '6px', padding: '6px 10px', background: 'var(--surface)', color: 'var(--text-primary)' }} />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                style={{ width: '100%', fontSize: '13px', border: '1px solid var(--border)', borderRadius: '6px', padding: '6px 10px', background: 'var(--surface)', color: 'var(--text-primary)' }}>
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Notes</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={3} placeholder="Additional details..."
                style={{ width: '100%', fontSize: '13px', border: '1px solid var(--border)', borderRadius: '6px', padding: '6px 10px', background: 'var(--surface)', color: 'var(--text-primary)', resize: 'vertical', boxSizing: 'border-box' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="submit" disabled={submitting}
              style={{ fontSize: '12px', fontWeight: 600, color: '#fff', background: submitting ? '#6b7280' : '#0d9488', border: 'none', borderRadius: '6px', padding: '7px 16px', cursor: submitting ? 'not-allowed' : 'pointer' }}>
              {submitting ? 'Saving…' : editId ? 'Save Changes' : 'Add Notice'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditId(null) }}
              style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'none', border: '1px solid var(--border)', borderRadius: '6px', padding: '7px 14px', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* List */}
      {loading ? (
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>Loading…</p>
      ) : notices.length === 0 ? (
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>No notices recorded yet</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {notices.map(n => {
            const isOverdue = n.response_due && n.response_due < today && n.status !== 'Closed'
            return (
              <div key={n.id} style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '12px 14px', background: 'var(--surface-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{n.title}</span>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: '#7c3aed', background: 'rgba(124,58,237,0.1)', borderRadius: '20px', padding: '2px 8px' }}>{n.notice_type}</span>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: '#0369a1', background: 'rgba(3,105,161,0.1)', borderRadius: '20px', padding: '2px 8px' }}>{n.portal}</span>
                      <span style={{ fontSize: '11px', fontWeight: 600, borderRadius: '20px', padding: '2px 8px', ...statusStyle(n.status) }}>{n.status}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                      {n.notice_date && (
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          Notice: <strong>{new Date(n.notice_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong>
                        </span>
                      )}
                      {n.response_due && (
                        <span style={{ fontSize: '12px', color: isOverdue ? '#dc2626' : 'var(--text-muted)', fontWeight: isOverdue ? 700 : 400 }}>
                          Due: <strong>{new Date(n.response_due).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong>
                          {isOverdue && ' ⚠️'}
                        </span>
                      )}
                    </div>
                    {n.notes && <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>{n.notes}</p>}
                  </div>
                  {canManage && (
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      <button onClick={() => openEdit(n)}
                        style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'none', border: '1px solid var(--border)', borderRadius: '5px', padding: '4px 9px', cursor: 'pointer' }}>
                        Edit
                      </button>
                      <button onClick={() => deleteNotice(n.id)}
                        style={{ fontSize: '11px', color: '#dc2626', background: 'none', border: '1px solid #fecaca', borderRadius: '5px', padding: '4px 9px', cursor: 'pointer' }}>
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
