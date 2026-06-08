'use client'
import { useState, useEffect, useCallback } from 'react'

interface Credential {
  id: string
  portal_name: string
  username: string
  password_enc: string
  notes: string | null
  updated_at: string
}

interface Props {
  clientId: string
  canManage: boolean
}

const PORTAL_OPTIONS = ['Income Tax Portal', 'GST Portal', 'MCA21', 'TRACES', 'TAN Portal', 'EPFO', 'ESI Portal', 'Custom']

const emptyForm = { portal_name: 'Income Tax Portal', custom_portal: '', username: '', password: '', notes: '' }

export function ClientCredentialsSection({ clientId, canManage }: Props) {
  const [creds, setCreds] = useState<Credential[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ...emptyForm })
  const [submitting, setSubmitting] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/client-credentials?client_id=${clientId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to load credentials')
      setCreds(data.credentials ?? data ?? [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => { load() }, [load])

  function toggleReveal(id: string) {
    setRevealed(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function openAdd() {
    setForm({ ...emptyForm })
    setEditId(null)
    setShowForm(true)
  }

  function openEdit(c: Credential) {
    const isCustom = !PORTAL_OPTIONS.slice(0, -1).includes(c.portal_name)
    setForm({
      portal_name: isCustom ? 'Custom' : c.portal_name,
      custom_portal: isCustom ? c.portal_name : '',
      username: c.username,
      password: '',
      notes: c.notes ?? '',
    })
    setEditId(c.id)
    setShowForm(true)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const resolvedPortal = form.portal_name === 'Custom' ? form.custom_portal : form.portal_name
      const body: Record<string, string> = {
        client_id: clientId,
        portal_name: resolvedPortal,
        username: form.username,
        notes: form.notes,
      }
      if (form.password) body.password_enc = btoa(form.password)

      const res = editId
        ? await fetch(`/api/client-credentials/${editId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        : await fetch('/api/client-credentials', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
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

  async function deleteCred(id: string) {
    if (!confirm('Delete this credential?')) return
    try {
      const res = await fetch(`/api/client-credentials/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      setCreds(prev => prev.filter(c => c.id !== id))
    } catch (e: any) {
      setError(e.message)
    }
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', background: 'var(--surface)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>🔑 Portal Credentials</span>
          <span style={{
            fontSize: '11px', fontWeight: 700, color: '#7c3aed',
            background: 'rgba(124,58,237,0.1)', borderRadius: '20px', padding: '2px 8px',
          }}>{creds.length}</span>
        </div>
        {canManage && (
          <button
            onClick={openAdd}
            style={{ fontSize: '12px', fontWeight: 600, color: '#fff', background: '#7c3aed', border: 'none', borderRadius: '7px', padding: '6px 14px', cursor: 'pointer' }}>
            + Add Credential
          </button>
        )}
      </div>

      {/* Warning banner */}
      <div style={{ fontSize: '12px', color: '#92400e', background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(217,119,6,0.25)', borderRadius: '7px', padding: '8px 12px', marginBottom: '16px', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
        <span>⚠️</span>
        <span>Credentials are visible only to Managers, Admins, and Owners. Keep this information confidential.</span>
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
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Portal *</label>
              <select required value={form.portal_name} onChange={e => setForm(f => ({ ...f, portal_name: e.target.value }))}
                style={{ width: '100%', fontSize: '13px', border: '1px solid var(--border)', borderRadius: '6px', padding: '6px 10px', background: 'var(--surface)', color: 'var(--text-primary)' }}>
                {PORTAL_OPTIONS.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            {form.portal_name === 'Custom' && (
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Portal Name *</label>
                <input required value={form.custom_portal} onChange={e => setForm(f => ({ ...f, custom_portal: e.target.value }))}
                  placeholder="Enter portal name"
                  style={{ width: '100%', fontSize: '13px', border: '1px solid var(--border)', borderRadius: '6px', padding: '6px 10px', background: 'var(--surface)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
              </div>
            )}
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Username *</label>
              <input required value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                placeholder="Username / PAN / Email"
                style={{ width: '100%', fontSize: '13px', border: '1px solid var(--border)', borderRadius: '6px', padding: '6px 10px', background: 'var(--surface)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>{editId ? 'New Password (leave blank to keep)' : 'Password *'}</label>
              <input type="password" required={!editId} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder={editId ? 'Enter new password to update' : 'Password'}
                style={{ width: '100%', fontSize: '13px', border: '1px solid var(--border)', borderRadius: '6px', padding: '6px 10px', background: 'var(--surface)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Notes</label>
              <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="e.g. 2FA via email"
                style={{ width: '100%', fontSize: '13px', border: '1px solid var(--border)', borderRadius: '6px', padding: '6px 10px', background: 'var(--surface)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="submit" disabled={submitting}
              style={{ fontSize: '12px', fontWeight: 600, color: '#fff', background: submitting ? '#6b7280' : '#7c3aed', border: 'none', borderRadius: '6px', padding: '7px 16px', cursor: submitting ? 'not-allowed' : 'pointer' }}>
              {submitting ? 'Saving…' : editId ? 'Save Changes' : 'Add Credential'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditId(null) }}
              style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'none', border: '1px solid var(--border)', borderRadius: '6px', padding: '7px 14px', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Table */}
      {loading ? (
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>Loading…</p>
      ) : creds.length === 0 ? (
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>No credentials saved yet</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Portal', 'Username', 'Password', 'Notes', 'Last Updated', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '6px 10px', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {creds.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 10px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{c.portal_name}</td>
                  <td style={{ padding: '10px 10px', color: 'var(--text-primary)', fontFamily: 'monospace' }}>{c.username}</td>
                  <td style={{ padding: '10px 10px', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontFamily: 'monospace', color: 'var(--text-primary)', letterSpacing: revealed[c.id] ? 'normal' : '2px' }}>
                        {revealed[c.id] ? (() => { try { return atob(c.password_enc) } catch { return c.password_enc } })() : '••••••••'}
                      </span>
                      <button onClick={() => toggleReveal(c.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', fontSize: '14px', lineHeight: 1 }}
                        title={revealed[c.id] ? 'Hide' : 'Reveal'}>
                        {revealed[c.id] ? '🙈' : '👁'}
                      </button>
                    </div>
                  </td>
                  <td style={{ padding: '10px 10px', color: 'var(--text-muted)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.notes ?? '—'}</td>
                  <td style={{ padding: '10px 10px', color: 'var(--text-muted)', whiteSpace: 'nowrap', fontSize: '12px' }}>
                    {new Date(c.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td style={{ padding: '10px 10px', whiteSpace: 'nowrap' }}>
                    {canManage && (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => openEdit(c)}
                          style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'none', border: '1px solid var(--border)', borderRadius: '5px', padding: '4px 9px', cursor: 'pointer' }}>
                          Edit
                        </button>
                        <button onClick={() => deleteCred(c.id)}
                          style={{ fontSize: '11px', color: '#dc2626', background: 'none', border: '1px solid #fecaca', borderRadius: '5px', padding: '4px 9px', cursor: 'pointer' }}>
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
