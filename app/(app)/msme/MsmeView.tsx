'use client'
import { useState, useEffect, useCallback, useRef } from 'react'

const ACCENT     = '#0d9488'
const FREE_LIMIT = 5

interface Vendor {
  id: string
  vendor_name: string
  vendor_email: string
  gstin: string | null
  status: 'pending' | 'emailed' | 'submitted' | 'not_msme'
  udyam_number: string | null
  msme_category: 'micro' | 'small' | 'medium' | null
  nature_of_business: 'manufacturer' | 'service_provider' | 'trader' | null
  outstanding_amount: number | null
  cert_url: string | null
  is_not_msme: boolean
  declarant_name: string | null
  declared_at: string | null
  submitted_at: string | null
  email_count: number
  last_emailed_at: string | null
  is_paid: boolean
  created_at: string
}

const STATUS_LABEL: Record<Vendor['status'], string> = {
  pending:   'Not contacted',
  emailed:   'Email sent',
  submitted: 'Submitted ✓',
  not_msme:  'Non-MSME ✓',
}
const STATUS_COLOR: Record<Vendor['status'], { bg: string; text: string }> = {
  pending:   { bg: '#f1f5f9', text: '#64748b' },
  emailed:   { bg: '#fff7ed', text: '#ea580c' },
  submitted: { bg: '#f0fdf4', text: '#16a34a' },
  not_msme:  { bg: '#f0f9ff', text: '#0284c7' },
}
const CAT_LABEL: Record<string, string> = { micro: 'Micro', small: 'Small', medium: 'Medium' }
const NAT_LABEL: Record<string, string>  = {
  manufacturer: 'Manufacturer',
  service_provider: 'Service Provider',
  trader: 'Trader',
}

interface Toast { id: number; message: string; type: 'success' | 'error' }

interface Props { userRole: string }

export function MsmeView({ userRole }: Props) {
  const [vendors,      setVendors]      = useState<Vendor[]>([])
  const [total,        setTotal]        = useState(0)
  const [loading,      setLoading]      = useState(true)
  const [showAdd,      setShowAdd]      = useState(false)
  const [selectedId,   setSelectedId]   = useState<string | null>(null)
  const [shootingId,   setShootingId]   = useState<string | null>(null)
  const [deletingId,   setDeletingId]   = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [search,       setSearch]       = useState('')
  const [toasts,       setToasts]       = useState<Toast[]>([])
  const [copyingId,    setCopyingId]    = useState<string | null>(null)
  const [editingEmail, setEditingEmail] = useState<string | null>(null)
  const [editEmailVal, setEditEmailVal] = useState('')
  const [savingEmail,  setSavingEmail]  = useState(false)
  const toastRef = useRef(0)

  // Add vendor form
  const [vendorName,  setVendorName]  = useState('')
  const [vendorEmail, setVendorEmail] = useState('')
  const [gstin,       setGstin]       = useState('')
  const [addError,    setAddError]    = useState<string | null>(null)
  const [adding,      setAdding]      = useState(false)

  const canManage = ['owner', 'admin', 'manager'].includes(userRole)
  const canAdmin  = ['owner', 'admin'].includes(userRole)

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    const id = ++toastRef.current
    setToasts(t => [...t, { id, message, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500)
  }

  const fetchVendors = useCallback(async () => {
    setLoading(true)
    const res  = await fetch('/api/msme/vendors')
    const data = await res.json()
    setVendors(data.vendors ?? [])
    setTotal(data.total ?? 0)
    setLoading(false)
  }, [])

  useEffect(() => { fetchVendors() }, [fetchVendors])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setAddError(null)
    setAdding(true)
    const res  = await fetch('/api/msme/vendors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vendor_name: vendorName, vendor_email: vendorEmail, gstin }),
    })
    const data = await res.json()
    setAdding(false)
    if (!res.ok) { setAddError(data.error ?? 'Failed to add vendor'); return }
    setShowAdd(false)
    setVendorName(''); setVendorEmail(''); setGstin('')
    showToast(`${vendorName} added successfully`)
    fetchVendors()
  }

  async function handleShootEmail(vendorId: string, vendorName: string) {
    setShootingId(vendorId)
    const res  = await fetch(`/api/msme/vendors/${vendorId}/shoot-email`, { method: 'POST' })
    const data = await res.json()
    setShootingId(null)
    if (!res.ok) { showToast(data.error ?? 'Failed to send email', 'error'); return }
    showToast(`Email sent to ${vendorName} (attempt ${data.attempt}/3)`)
    fetchVendors()
  }

  async function handleDelete(vendorId: string) {
    if (!confirm('Remove this vendor? This cannot be undone.')) return
    setDeletingId(vendorId)
    const res = await fetch(`/api/msme/vendors/${vendorId}`, { method: 'DELETE' })
    setDeletingId(null)
    if (!res.ok) { showToast('Failed to remove vendor', 'error'); return }
    setSelectedId(null)
    showToast('Vendor removed')
    fetchVendors()
  }

  async function handleCopyLink(vendorId: string) {
    setCopyingId(vendorId)
    const res  = await fetch(`/api/msme/vendors/${vendorId}/shoot-email`, { method: 'POST', headers: { 'x-copy-only': '1' } })
    const data = await res.json()
    setCopyingId(null)
    if (!res.ok) { showToast(data.error ?? 'Could not generate link', 'error'); return }
    await navigator.clipboard.writeText(data.formUrl)
    showToast('Form link copied — paste it in WhatsApp or SMS')
  }

  async function handleSaveEmail(vendorId: string) {
    if (!editEmailVal.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editEmailVal)) {
      showToast('Enter a valid email address', 'error'); return
    }
    setSavingEmail(true)
    const res  = await fetch(`/api/msme/vendors/${vendorId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vendor_email: editEmailVal.trim().toLowerCase() }),
    })
    setSavingEmail(false)
    if (!res.ok) { showToast('Failed to update email', 'error'); return }
    setEditingEmail(null)
    showToast('Email updated')
    fetchVendors()
  }

  function handleExportCsv() {
    const done   = vendors.filter(v => v.status === 'submitted' || v.status === 'not_msme')
    const header = ['Vendor Name', 'Email', 'GSTIN', 'Status', 'Udyam Number', 'Category', 'Nature', 'Outstanding Amount (₹)', 'Submitted On', 'Declaration By']
    const rows   = done.map(v => [
      v.vendor_name,
      v.vendor_email,
      v.gstin ?? '',
      v.is_not_msme ? 'Non-MSME Declaration' : 'MSME Registered',
      v.udyam_number ?? '',
      v.msme_category ? CAT_LABEL[v.msme_category] : '',
      v.nature_of_business ? NAT_LABEL[v.nature_of_business] : '',
      v.outstanding_amount !== null ? String(v.outstanding_amount) : '',
      v.submitted_at ? new Date(v.submitted_at).toLocaleDateString('en-IN') : '',
      v.declarant_name ?? '',
    ])
    const csv  = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `msme-vendors-${new Date().toISOString().slice(0,10)}.csv`
    a.click(); URL.revokeObjectURL(url)
    showToast(`Exported ${done.length} completed vendors`)
  }

  const selected  = vendors.find(v => v.id === selectedId) ?? null
  const searched  = vendors.filter(v =>
    !search ||
    v.vendor_name.toLowerCase().includes(search.toLowerCase()) ||
    v.vendor_email.toLowerCase().includes(search.toLowerCase()) ||
    (v.gstin ?? '').toLowerCase().includes(search.toLowerCase())
  )
  const filtered  = filterStatus === 'all' ? searched : searched.filter(v => v.status === filterStatus)

  const completedCount = vendors.filter(v => v.status === 'submitted' || v.status === 'not_msme').length
  const exhaustedCount = vendors.filter(v => v.email_count >= 3 && v.status === 'emailed').length
  const counts = {
    pending:   vendors.filter(v => v.status === 'pending').length,
    emailed:   vendors.filter(v => v.status === 'emailed').length,
    submitted: vendors.filter(v => v.status === 'submitted').length,
    not_msme:  vendors.filter(v => v.status === 'not_msme').length,
  }
  const completionPct = total > 0 ? Math.round((completedCount / total) * 100) : 0

  return (
    <div style={{ padding: '24px', maxWidth: 1120, margin: '0 auto' }}>

      {/* ── Toast stack ── */}
      <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 100, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            background: t.type === 'error' ? '#dc2626' : '#0f172a',
            color: '#fff', padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
            boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
            animation: 'slideIn 0.2s ease',
          }}>
            {t.type === 'error' ? '⚠ ' : '✓ '}{t.message}
          </div>
        ))}
      </div>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>MSME Vendor Tracker</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
            Collect and track MSME registrations · {total <= FREE_LIMIT ? `${total}/${FREE_LIMIT} free` : `${FREE_LIMIT} free + ${total - FREE_LIMIT} paid`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {completedCount > 0 && (
            <button onClick={handleExportCsv} style={{ ...ghostBtn, display: 'flex', alignItems: 'center', gap: 6 }}>
              ↓ Export CSV
            </button>
          )}
          {canManage && (
            <button onClick={() => setShowAdd(true)} style={primaryBtn}>+ Add vendor</button>
          )}
        </div>
      </div>

      {/* ── Summary cards ── */}
      {total > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
          {/* Completion progress */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px' }}>
            <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>COMPLETION</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 26, fontWeight: 800, color: ACCENT }}>{completedCount}</span>
              <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>/ {total}</span>
            </div>
            <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, marginTop: 8 }}>
              <div style={{ height: 4, background: ACCENT, borderRadius: 2, width: `${completionPct}%`, transition: 'width 0.4s ease' }} />
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>{completionPct}% vendors responded</p>
          </div>
          {/* Awaiting response */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px' }}>
            <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>NOT CONTACTED</p>
            <span style={{ fontSize: 26, fontWeight: 800, color: counts.pending > 0 ? '#64748b' : ACCENT }}>{counts.pending}</span>
            <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>awaiting first email</p>
          </div>
          {/* Emails sent pending reply */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px' }}>
            <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>AWAITING REPLY</p>
            <span style={{ fontSize: 26, fontWeight: 800, color: counts.emailed > 0 ? '#ea580c' : ACCENT }}>{counts.emailed}</span>
            <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>email(s) sent, no response</p>
          </div>
          {/* Needs manual follow-up */}
          {exhaustedCount > 0 && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '16px 18px' }}>
              <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 600, color: '#dc2626' }}>MANUAL FOLLOW-UP</p>
              <span style={{ fontSize: 26, fontWeight: 800, color: '#dc2626' }}>{exhaustedCount}</span>
              <p style={{ margin: '4px 0 0', fontSize: 11, color: '#dc2626' }}>3 emails sent — call them</p>
            </div>
          )}
        </div>
      )}

      {/* ── Filter + search row ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {(['all', 'pending', 'emailed', 'submitted', 'not_msme'] as const).map(s => {
          const count  = s === 'all' ? total : counts[s]
          const active = filterStatus === s
          return (
            <button key={s} onClick={() => setFilterStatus(s)} style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              border: `1.5px solid ${active ? ACCENT : 'var(--border)'}`,
              background: active ? `${ACCENT}15` : 'var(--surface)',
              color: active ? ACCENT : 'var(--text-muted)',
            }}>
              {s === 'all' ? 'All' : STATUS_LABEL[s as Vendor['status']].replace(' ✓', '')} · {count}
            </button>
          )
        })}
        <input
          style={{ marginLeft: 'auto', padding: '7px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, color: 'var(--text)', background: 'var(--surface)', width: 220, outline: 'none' }}
          placeholder="Search vendor name / email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* ── Free tier note ── */}
      {total >= FREE_LIMIT && (
        <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#92400e' }}>
          <strong>₹99/vendor/year</strong> — First 5 vendors are free. Razorpay billing coming soon.
        </div>
      )}

      {/* ── Main layout ── */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        {/* Table */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {loading ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)', border: '1.5px dashed var(--border)', borderRadius: 10 }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🏭</div>
              <p style={{ margin: 0, fontWeight: 600, color: 'var(--text)' }}>{search ? 'No vendors match your search' : 'No vendors yet'}</p>
              {!search && <p style={{ margin: '6px 0 0', fontSize: 13 }}>Add vendors and shoot emails to collect their MSME certificates.</p>}
            </div>
          ) : (
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--surface-secondary)', borderBottom: '1px solid var(--border)' }}>
                    {['Vendor', 'Status', 'Category', 'Emails', 'Last emailed', 'Action'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((v, i) => {
                    const sc        = STATUS_COLOR[v.status]
                    const sel       = selectedId === v.id
                    const exhausted = v.email_count >= 3 && v.status === 'emailed'
                    return (
                      <tr
                        key={v.id}
                        onClick={() => setSelectedId(sel ? null : v.id)}
                        style={{
                          borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : undefined,
                          background: sel ? `${ACCENT}08` : 'var(--surface)',
                          cursor: 'pointer',
                        }}
                      >
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text)' }}>{v.vendor_name}</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{v.vendor_email}</div>
                          {v.gstin && <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>GSTIN: {v.gstin}</div>}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ background: exhausted ? '#fef2f2' : sc.bg, color: exhausted ? '#dc2626' : sc.text, padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
                            {exhausted ? '⚠ Needs call' : STATUS_LABEL[v.status]}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>
                          {v.msme_category ? CAT_LABEL[v.msme_category] : v.is_not_msme ? 'Not MSME' : '—'}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                          <span style={{ color: exhausted ? '#dc2626' : 'var(--text-muted)', fontWeight: exhausted ? 700 : 400 }}>{v.email_count}/3</span>
                        </td>
                        <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>
                          {v.last_emailed_at ? new Date(v.last_emailed_at).toLocaleDateString('en-IN') : '—'}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          {canManage && v.status !== 'submitted' && v.status !== 'not_msme' && v.email_count < 3 && (
                            <button
                              onClick={e => { e.stopPropagation(); handleShootEmail(v.id, v.vendor_name) }}
                              disabled={shootingId === v.id}
                              style={{ ...primaryBtn, padding: '5px 12px', fontSize: 11 }}
                            >
                              {shootingId === v.id ? 'Sending…' : v.email_count === 0 ? '✉ Shoot email' : '✉ Re-shoot'}
                            </button>
                          )}
                          {(v.status === 'submitted' || v.status === 'not_msme') && (
                            <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>✓ Done</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Detail panel ── */}
        {selected && (
          <div style={{ width: 300, flexShrink: 0, border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--surface)' }}>
            <div style={{ background: '#0f172a', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>{selected.vendor_name}</span>
              <button onClick={() => setSelectedId(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
            </div>
            <div style={{ padding: 16 }}>

              {/* Email with inline edit */}
              <div style={{ marginBottom: 12 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>EMAIL</span>
                {editingEmail === selected.id ? (
                  <div style={{ marginTop: 4, display: 'flex', gap: 6 }}>
                    <input
                      style={{ flex: 1, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, color: 'var(--text)', background: 'var(--surface)', outline: 'none' }}
                      value={editEmailVal}
                      onChange={e => setEditEmailVal(e.target.value)}
                      type="email"
                      autoFocus
                    />
                    <button onClick={() => handleSaveEmail(selected.id)} disabled={savingEmail} style={{ ...primaryBtn, padding: '6px 10px', fontSize: 11 }}>Save</button>
                    <button onClick={() => setEditingEmail(null)} style={{ ...ghostBtn, padding: '6px 8px', fontSize: 11 }}>✕</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <span style={{ fontSize: 13, color: 'var(--text)', wordBreak: 'break-all' }}>{selected.vendor_email}</span>
                    {selected.email_count === 0 && canManage && (
                      <button
                        onClick={() => { setEditingEmail(selected.id); setEditEmailVal(selected.vendor_email) }}
                        style={{ background: 'none', border: 'none', color: ACCENT, cursor: 'pointer', fontSize: 11, padding: '2px 4px', flexShrink: 0 }}
                        title="Fix email before first send"
                      >✎</button>
                    )}
                  </div>
                )}
              </div>

              {selected.gstin && <Row label="GSTIN" value={selected.gstin} />}

              {/* Status */}
              <div style={{ marginBottom: 12 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>STATUS</span>
                <div style={{ marginTop: 4 }}>
                  {(() => {
                    const sc = STATUS_COLOR[selected.status]
                    const ex = selected.email_count >= 3 && selected.status === 'emailed'
                    return <span style={{ background: ex ? '#fef2f2' : sc.bg, color: ex ? '#dc2626' : sc.text, padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
                      {ex ? '⚠ 3 emails sent — contact directly' : STATUS_LABEL[selected.status]}
                    </span>
                  })()}
                </div>
              </div>

              {/* MSME details if submitted */}
              {selected.status === 'submitted' && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                  {selected.udyam_number && <Row label="Udyam No." value={selected.udyam_number} />}
                  {selected.msme_category && <Row label="Category" value={CAT_LABEL[selected.msme_category]} />}
                  {selected.nature_of_business && <Row label="Nature" value={NAT_LABEL[selected.nature_of_business]} />}
                  {selected.outstanding_amount !== null && selected.outstanding_amount !== undefined && (
                    <Row label="Outstanding (31 Mar)" value={`₹${Number(selected.outstanding_amount).toLocaleString('en-IN')}`} />
                  )}
                  {selected.submitted_at && <Row label="Submitted on" value={new Date(selected.submitted_at).toLocaleDateString('en-IN')} />}
                  {selected.cert_url && !selected.cert_url.startsWith('r2:') && (
                    <a href={selected.cert_url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', marginTop: 8, color: ACCENT, fontSize: 12, fontWeight: 600 }}>
                      📎 Download certificate →
                    </a>
                  )}
                  {selected.cert_url?.startsWith('r2:') && (
                    <p style={{ margin: '8px 0 0', fontSize: 11, color: '#16a34a', fontWeight: 600 }}>✓ Certificate uploaded to secure storage</p>
                  )}
                </div>
              )}

              {/* Non-MSME declaration */}
              {selected.status === 'not_msme' && (
                <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                  <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: '#0284c7' }}>NON-MSME DECLARATION</p>
                  {selected.declarant_name && <Row label="Declared by" value={selected.declarant_name} />}
                  {selected.declared_at && <Row label="Date" value={new Date(selected.declared_at).toLocaleDateString('en-IN')} />}
                </div>
              )}

              {/* Email history */}
              {selected.email_count > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, margin: '0 0 4px' }}>EMAIL HISTORY</p>
                  <p style={{ fontSize: 12, color: 'var(--text)', margin: 0 }}>
                    {selected.email_count} of 3 sent · Last: {selected.last_emailed_at ? new Date(selected.last_emailed_at).toLocaleDateString('en-IN') : '—'}
                  </p>
                </div>
              )}

              {/* Actions */}
              {canManage && selected.status !== 'submitted' && selected.status !== 'not_msme' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                  {selected.email_count < 3 && (
                    <button
                      onClick={() => handleShootEmail(selected.id, selected.vendor_name)}
                      disabled={shootingId === selected.id}
                      style={{ ...primaryBtn, width: '100%' }}
                    >
                      {shootingId === selected.id ? 'Sending…' : selected.email_count === 0 ? '✉ Shoot email' : `✉ Re-shoot (${selected.email_count}/3 sent)`}
                    </button>
                  )}
                  <button
                    onClick={() => handleCopyLink(selected.id)}
                    disabled={copyingId === selected.id}
                    style={{ ...ghostBtn, width: '100%' }}
                  >
                    {copyingId === selected.id ? 'Generating…' : '🔗 Copy form link (share via WhatsApp)'}
                  </button>
                </div>
              )}

              {canAdmin && (
                <button
                  onClick={() => handleDelete(selected.id)}
                  disabled={deletingId === selected.id}
                  style={{ ...ghostBtn, width: '100%', marginTop: 10, color: '#dc2626', borderColor: '#fecaca', fontSize: 12 }}
                >
                  {deletingId === selected.id ? 'Removing…' : 'Remove vendor'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Add vendor modal ── */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 28, width: '100%', maxWidth: 420 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>Add vendor</h2>
              <button onClick={() => { setShowAdd(false); setAddError(null) }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <form onSubmit={handleAdd}>
              <div style={{ marginBottom: 16 }}>
                <label style={ml}>Vendor / Company name <span style={{ color: '#dc2626' }}>*</span></label>
                <input style={mi} type="text" value={vendorName} onChange={e => setVendorName(e.target.value)} required placeholder="e.g. Shree Steel Works" autoFocus />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={ml}>Vendor email <span style={{ color: '#dc2626' }}>*</span></label>
                <input style={mi} type="email" value={vendorEmail} onChange={e => setVendorEmail(e.target.value)} required placeholder="vendor@example.com" />
                <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>Double-check this — wrong email = vendor never receives the form</p>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={ml}>GSTIN (optional)</label>
                <input style={mi} type="text" value={gstin} onChange={e => setGstin(e.target.value)} placeholder="27AABCU9603R1ZX" />
              </div>
              {addError && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{addError}</p>}
              {total >= FREE_LIMIT && (
                <p style={{ color: '#92400e', fontSize: 12, background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 6, padding: '8px 12px', marginBottom: 16 }}>
                  This will be a <strong>paid slot (₹99/year)</strong>. Billing will be activated soon.
                </p>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" disabled={adding} style={{ ...primaryBtn, flex: 1 }}>{adding ? 'Adding…' : 'Add vendor'}</button>
                <button type="button" onClick={() => { setShowAdd(false); setAddError(null) }} style={{ ...ghostBtn, flex: 1 }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8, gap: 8 }}>
      <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{label}</span>
      <span style={{ color: 'var(--text)', fontWeight: 500, textAlign: 'right', wordBreak: 'break-all' }}>{value}</span>
    </div>
  )
}

const primaryBtn: React.CSSProperties = {
  background: ACCENT, color: '#fff', border: 'none', borderRadius: 8,
  padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
}
const ghostBtn: React.CSSProperties = {
  background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)',
  borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
}
const ml: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }
const mi: React.CSSProperties = { width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, color: 'var(--text)', background: 'var(--surface)', boxSizing: 'border-box' }
