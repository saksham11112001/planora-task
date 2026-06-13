'use client'
import { useState, useEffect, useCallback } from 'react'

const ACCENT       = '#0d9488'
const FREE_LIMIT   = 5

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
  submitted: 'Submitted',
  not_msme:  'Non-MSME decl.',
}
const STATUS_COLOR: Record<Vendor['status'], { bg: string; text: string }> = {
  pending:   { bg: '#f1f5f9', text: '#64748b' },
  emailed:   { bg: '#fff7ed', text: '#ea580c' },
  submitted: { bg: '#f0fdf4', text: '#16a34a' },
  not_msme:  { bg: '#f0f9ff', text: '#0284c7' },
}
const CAT_LABEL: Record<string, string> = { micro: 'Micro', small: 'Small', medium: 'Medium' }
const NAT_LABEL: Record<string, string>  = { manufacturer: 'Manufacturer', service_provider: 'Service Provider', trader: 'Trader' }

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

  // Add vendor form
  const [vendorName,  setVendorName]  = useState('')
  const [vendorEmail, setVendorEmail] = useState('')
  const [gstin,       setGstin]       = useState('')
  const [addError,    setAddError]    = useState<string | null>(null)
  const [adding,      setAdding]      = useState(false)

  const canManage = ['owner', 'admin', 'manager'].includes(userRole)

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
    fetchVendors()
  }

  async function handleShootEmail(vendorId: string) {
    setShootingId(vendorId)
    const res  = await fetch(`/api/msme/vendors/${vendorId}/shoot-email`, { method: 'POST' })
    const data = await res.json()
    setShootingId(null)
    if (!res.ok) { alert(data.error ?? 'Failed to send email'); return }
    fetchVendors()
  }

  async function handleDelete(vendorId: string) {
    if (!confirm('Remove this vendor? This cannot be undone.')) return
    setDeletingId(vendorId)
    await fetch(`/api/msme/vendors/${vendorId}`, { method: 'DELETE' })
    setDeletingId(null)
    setSelectedId(null)
    fetchVendors()
  }

  const selected = vendors.find(v => v.id === selectedId) ?? null
  const filtered = filterStatus === 'all' ? vendors : vendors.filter(v => v.status === filterStatus)

  const counts = {
    pending:   vendors.filter(v => v.status === 'pending').length,
    emailed:   vendors.filter(v => v.status === 'emailed').length,
    submitted: vendors.filter(v => v.status === 'submitted').length,
    not_msme:  vendors.filter(v => v.status === 'not_msme').length,
  }

  return (
    <div style={{ padding: '24px', maxWidth: 1100, margin: '0 auto' }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>MSME Vendor Tracker</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
            Collect and track MSME registrations from vendors · {total <= FREE_LIMIT ? `${total}/${FREE_LIMIT} free` : `${FREE_LIMIT} free + ${total - FREE_LIMIT} paid`}
          </p>
        </div>
        {canManage && (
          <button onClick={() => setShowAdd(true)} style={primaryBtn}>
            + Add vendor
          </button>
        )}
      </div>

      {/* ── Stats bar ── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        {(['all', 'pending', 'emailed', 'submitted', 'not_msme'] as const).map(s => {
          const count = s === 'all' ? total : counts[s]
          const active = filterStatus === s
          return (
            <button key={s} onClick={() => setFilterStatus(s)} style={{
              padding: '8px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              border: `1.5px solid ${active ? ACCENT : 'var(--border)'}`,
              background: active ? `${ACCENT}15` : 'var(--surface)',
              color: active ? ACCENT : 'var(--text-muted)',
            }}>
              {s === 'all' ? 'All vendors' : STATUS_LABEL[s as Vendor['status']]} · {count}
            </button>
          )
        })}
      </div>

      {/* ── Free tier note ── */}
      {total >= FREE_LIMIT && (
        <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#92400e' }}>
          <strong>₹99/vendor/year</strong> — First 5 vendors are free. Additional vendors are billed at ₹99 per vendor per year. Razorpay billing will be enabled soon.
        </div>
      )}

      {/* ── Main layout: table + detail panel ── */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        {/* Table */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {loading ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)', border: '1.5px dashed var(--border)', borderRadius: 10 }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🏭</div>
              <p style={{ margin: 0, fontWeight: 600, color: 'var(--text)' }}>No vendors yet</p>
              <p style={{ margin: '6px 0 0', fontSize: 13 }}>Add vendors and shoot emails to collect MSME certificates.</p>
            </div>
          ) : (
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--surface-secondary)', borderBottom: '1px solid var(--border)' }}>
                    {['Vendor', 'Status', 'Category', 'Emails sent', 'Last emailed', ''].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((v, i) => {
                    const sc  = STATUS_COLOR[v.status]
                    const sel = selectedId === v.id
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
                          <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{v.vendor_email}</div>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ background: sc.bg, color: sc.text, padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>
                            {STATUS_LABEL[v.status]}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>
                          {v.msme_category ? CAT_LABEL[v.msme_category] : v.is_not_msme ? 'Not MSME' : '—'}
                        </td>
                        <td style={{ padding: '12px 14px', color: 'var(--text-muted)', textAlign: 'center' }}>
                          {v.email_count}/3
                        </td>
                        <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>
                          {v.last_emailed_at ? new Date(v.last_emailed_at).toLocaleDateString('en-IN') : '—'}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          {canManage && v.status !== 'submitted' && v.status !== 'not_msme' && v.email_count < 3 && (
                            <button
                              onClick={e => { e.stopPropagation(); handleShootEmail(v.id) }}
                              disabled={shootingId === v.id}
                              style={{ ...primaryBtn, padding: '5px 12px', fontSize: 12 }}
                            >
                              {shootingId === v.id ? 'Sending…' : v.email_count === 0 ? 'Shoot email' : 'Re-shoot'}
                            </button>
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

        {/* Detail panel */}
        {selected && (
          <div style={{ width: 320, flexShrink: 0, border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--surface)' }}>
            <div style={{ background: '#0f172a', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>{selected.vendor_name}</span>
              <button onClick={() => setSelectedId(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
            </div>
            <div style={{ padding: 18 }}>
              <Row label="Email"  value={selected.vendor_email} />
              {selected.gstin && <Row label="GSTIN" value={selected.gstin} />}
              <Row label="Status" value={STATUS_LABEL[selected.status]} />
              {selected.udyam_number && <Row label="Udyam No." value={selected.udyam_number} />}
              {selected.msme_category && <Row label="Category" value={CAT_LABEL[selected.msme_category]} />}
              {selected.nature_of_business && <Row label="Nature" value={NAT_LABEL[selected.nature_of_business]} />}
              {selected.outstanding_amount !== null && selected.outstanding_amount !== undefined && (
                <Row label="Outstanding (31 Mar)" value={`₹${Number(selected.outstanding_amount).toLocaleString('en-IN')}`} />
              )}
              {selected.is_not_msme && selected.declarant_name && (
                <Row label="Declaration by" value={selected.declarant_name} />
              )}
              {selected.submitted_at && (
                <Row label="Submitted on" value={new Date(selected.submitted_at).toLocaleDateString('en-IN')} />
              )}
              {selected.cert_url && !selected.cert_url.startsWith('r2:') && (
                <div style={{ marginBottom: 12 }}>
                  <a href={selected.cert_url} target="_blank" rel="noopener noreferrer" style={{ color: ACCENT, fontSize: 13, fontWeight: 600 }}>
                    Download certificate →
                  </a>
                </div>
              )}
              {selected.cert_url?.startsWith('r2:') && (
                <Row label="Certificate" value="Uploaded (R2 storage)" />
              )}

              {canManage && selected.status !== 'submitted' && selected.status !== 'not_msme' && selected.email_count < 3 && (
                <button
                  onClick={() => handleShootEmail(selected.id)}
                  disabled={shootingId === selected.id}
                  style={{ ...primaryBtn, width: '100%', marginTop: 16 }}
                >
                  {shootingId === selected.id ? 'Sending…' : selected.email_count === 0 ? 'Shoot email' : `Re-shoot (${selected.email_count}/3 sent)`}
                </button>
              )}

              {['owner', 'admin'].includes(userRole) && (
                <button
                  onClick={() => handleDelete(selected.id)}
                  disabled={deletingId === selected.id}
                  style={{ ...ghostBtn, width: '100%', marginTop: 10, color: '#dc2626', borderColor: '#fecaca' }}
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
                <input style={mi} type="text" value={vendorName} onChange={e => setVendorName(e.target.value)} required placeholder="e.g. Shree Steel Works" />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={ml}>Vendor email <span style={{ color: '#dc2626' }}>*</span></label>
                <input style={mi} type="email" value={vendorEmail} onChange={e => setVendorEmail(e.target.value)} required placeholder="vendor@example.com" />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={ml}>GSTIN (optional)</label>
                <input style={mi} type="text" value={gstin} onChange={e => setGstin(e.target.value)} placeholder="27AABCU9603R1ZX" />
              </div>
              {addError && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{addError}</p>}
              {total >= FREE_LIMIT && (
                <p style={{ color: '#92400e', fontSize: 12, background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 6, padding: '8px 12px', marginBottom: 16 }}>
                  This will be a <strong>paid vendor slot (₹99/year)</strong>. Billing will be activated soon.
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
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 10, gap: 8 }}>
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
