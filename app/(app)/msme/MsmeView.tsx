'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import * as XLSX from 'xlsx'

const ACCENT      = '#0d9488'
const FREE_LIMIT  = 5
const PRICE_INR   = 99

interface Vendor {
  id: string
  vendor_name: string
  vendor_email: string
  gstin: string | null
  status: 'pending' | 'emailed' | 'submitted' | 'not_msme'
  payment_status: 'free' | 'unpaid' | 'paid'
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
const CAT_LABEL: Record<string, string>  = { micro: 'Micro', small: 'Small', medium: 'Medium' }
const NAT_LABEL: Record<string, string>  = { manufacturer: 'Manufacturer', service_provider: 'Service Provider', trader: 'Trader' }

interface Toast { id: number; message: string; type: 'success' | 'error' | 'info' }
interface ImportRow { vendor_name: string; vendor_email: string; gstin?: string }

interface Props { userRole: string }

export function MsmeView({ userRole }: Props) {
  const [vendors,       setVendors]       = useState<Vendor[]>([])
  const [total,         setTotal]         = useState(0)
  const [loading,       setLoading]       = useState(true)
  const [showAdd,       setShowAdd]       = useState(false)
  const [showImport,    setShowImport]    = useState(false)
  const [selectedId,    setSelectedId]    = useState<string | null>(null)
  const [shootingId,    setShootingId]    = useState<string | null>(null)
  const [deletingId,    setDeletingId]    = useState<string | null>(null)
  const [filterStatus,  setFilterStatus]  = useState<string>('all')
  const [search,        setSearch]        = useState('')
  const [toasts,        setToasts]        = useState<Toast[]>([])
  const [copyingId,     setCopyingId]     = useState<string | null>(null)
  const [editingEmail,  setEditingEmail]  = useState<string | null>(null)
  const [editEmailVal,  setEditEmailVal]  = useState('')
  const [savingEmail,   setSavingEmail]   = useState(false)
  const [payingId,      setPayingId]      = useState<string | null>(null)
  const toastRef = useRef(0)

  // Add vendor form
  const [vendorName,  setVendorName]  = useState('')
  const [vendorEmail, setVendorEmail] = useState('')
  const [gstin,       setGstin]       = useState('')
  const [addError,    setAddError]    = useState<string | null>(null)
  const [adding,      setAdding]      = useState(false)

  // Import state
  const [importRows,    setImportRows]    = useState<ImportRow[]>([])
  const [importPreview, setImportPreview] = useState<ImportRow[]>([])
  const [importError,   setImportError]   = useState<string | null>(null)
  const [importing,     setImporting]     = useState(false)
  const [importResult,  setImportResult]  = useState<{ inserted: number; skipped: Array<{row:number;name:string;reason:string}>; paid_slots: number } | null>(null)

  const canManage = ['owner', 'admin', 'manager'].includes(userRole)
  const canAdmin  = ['owner', 'admin'].includes(userRole)

  function showToast(message: string, type: Toast['type'] = 'success') {
    const id = ++toastRef.current
    setToasts(t => [...t, { id, message, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000)
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

  // ── Add single vendor ──────────────────────────────────────────────────────
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
    showToast(data.isPaid ? `${vendorName} added — complete payment to unlock email sending` : `${vendorName} added successfully`, data.isPaid ? 'info' : 'success')
    fetchVendors()
  }

  // ── Shoot email ────────────────────────────────────────────────────────────
  async function handleShootEmail(vendorId: string, vendorName: string) {
    setShootingId(vendorId)
    const res  = await fetch(`/api/msme/vendors/${vendorId}/shoot-email`, { method: 'POST' })
    const data = await res.json()
    setShootingId(null)
    if (res.status === 402) { showToast('Pay ₹99 to unlock email sending for this vendor', 'info'); return }
    if (!res.ok) { showToast(data.error ?? 'Failed to send email', 'error'); return }
    showToast(`Email sent to ${vendorName} (attempt ${data.attempt}/3)`)
    fetchVendors()
  }

  // ── Pay for vendor slot ────────────────────────────────────────────────────
  async function handlePay(vendorId: string) {
    setPayingId(vendorId)
    const res  = await fetch('/api/msme/pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vendor_id: vendorId }),
    })
    const data = await res.json()
    setPayingId(null)

    if (res.status === 503 && data.code === 'RAZORPAY_NOT_CONFIGURED') {
      showToast('Payment gateway coming soon. Contact us to pay manually.', 'info')
      return
    }
    if (!res.ok) { showToast(data.error ?? 'Payment initiation failed', 'error'); return }

    // Open Razorpay checkout
    const options = {
      key:         data.key_id,
      amount:      data.amount,
      currency:    data.currency,
      name:        data.org_name,
      description: `MSME Tracker — ${data.vendor_name}`,
      order_id:    data.order_id,
      handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
        const verifyRes = await fetch('/api/msme/pay', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vendor_id: vendorId,
            razorpay_order_id:   response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature:  response.razorpay_signature,
          }),
        })
        if (verifyRes.ok) {
          showToast('Payment successful — vendor slot unlocked!')
          fetchVendors()
        } else {
          showToast('Payment verification failed. Please contact support.', 'error')
        }
      },
      theme: { color: ACCENT },
    }
    // @ts-ignore — Razorpay SDK loaded via script tag when keys are configured
    const rzp = new window.Razorpay(options)
    rzp.open()
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
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

  // ── Copy link ──────────────────────────────────────────────────────────────
  async function handleCopyLink(vendorId: string) {
    setCopyingId(vendorId)
    const res  = await fetch(`/api/msme/vendors/${vendorId}/shoot-email`, { method: 'POST', headers: { 'x-copy-only': '1' } })
    const data = await res.json()
    setCopyingId(null)
    if (res.status === 402) { showToast('Pay ₹99 to unlock this vendor slot first', 'info'); return }
    if (!res.ok) { showToast(data.error ?? 'Could not generate link', 'error'); return }
    await navigator.clipboard.writeText(data.formUrl)
    showToast('Form link copied — paste in WhatsApp or SMS')
  }

  // ── Edit email ─────────────────────────────────────────────────────────────
  async function handleSaveEmail(vendorId: string) {
    if (!editEmailVal.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editEmailVal)) {
      showToast('Enter a valid email address', 'error'); return
    }
    setSavingEmail(true)
    const res = await fetch(`/api/msme/vendors/${vendorId}`, {
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

  // ── Excel/CSV import ───────────────────────────────────────────────────────
  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportError(null)
    setImportResult(null)
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const data   = new Uint8Array(ev.target!.result as ArrayBuffer)
        const wb     = XLSX.read(data, { type: 'array' })
        const sheet  = wb.Sheets[wb.SheetNames[0]]
        const raw    = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
        if (raw.length === 0) { setImportError('No rows found in file'); return }

        // Normalise column names — accept variations like "Vendor Name", "Name", "VENDOR_NAME"
        const normalise = (key: string) => key.toLowerCase().replace(/[\s_-]/g, '')
        const rows: ImportRow[] = raw.map(row => {
          const entries = Object.entries(row)
          const find = (target: string) => entries.find(([k]) => normalise(k) === target)?.[1]?.toString().trim() ?? ''
          return {
            vendor_name:  find('vendorname') || find('name') || find('company') || find('companyname') || '',
            vendor_email: find('vendoremail') || find('email') || find('emailid') || find('emailaddress') || '',
            gstin:        find('gstin') || find('gst') || undefined,
          }
        }).filter(r => r.vendor_name || r.vendor_email)

        if (rows.length === 0) {
          setImportError('Could not find "Vendor Name" or "Email" columns. Check the template format.')
          return
        }
        setImportRows(rows)
        setImportPreview(rows.slice(0, 5))
      } catch {
        setImportError('Could not read file. Please use the Excel/CSV template provided.')
      }
    }
    reader.readAsArrayBuffer(file)
    e.target.value = ''
  }

  async function handleImportSubmit() {
    setImporting(true)
    setImportError(null)
    const res  = await fetch('/api/msme/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: importRows }),
    })
    const data = await res.json()
    setImporting(false)
    if (!res.ok) { setImportError(data.error ?? 'Import failed'); return }
    setImportResult(data)
    fetchVendors()
  }

  function handleDownloadTemplate() {
    const ws  = XLSX.utils.aoa_to_sheet([
      ['Vendor Name', 'Vendor Email', 'GSTIN (optional)'],
      ['Shree Steel Works', 'contact@shreesteel.com', '27AABCU9603R1ZX'],
      ['ABC Services Pvt Ltd', 'accounts@abcservices.in', ''],
    ])
    ws['!cols'] = [{ wch: 30 }, { wch: 30 }, { wch: 20 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Vendors')
    XLSX.writeFile(wb, 'msme-vendor-import-template.xlsx')
  }

  // ── Export all vendors ─────────────────────────────────────────────────────
  function handleExport() {
    const header = ['Vendor Name', 'Email', 'GSTIN', 'Slot Type', 'Payment Status', 'Tracker Status', 'Udyam Number', 'Category', 'Nature of Business', 'Outstanding Amount (₹)', 'Emails Sent', 'Last Email Date', 'Submitted On', 'Declaration By', 'Date Added']
    const rows = vendors.map(v => [
      v.vendor_name,
      v.vendor_email,
      v.gstin ?? '',
      v.is_paid ? 'Paid slot' : 'Free',
      v.payment_status === 'free' ? 'Free' : v.payment_status === 'paid' ? 'Paid ✓' : 'Payment pending',
      v.is_not_msme ? 'Non-MSME Declaration' : STATUS_LABEL[v.status].replace(' ✓', ''),
      v.udyam_number ?? '',
      v.msme_category ? CAT_LABEL[v.msme_category] : '',
      v.nature_of_business ? NAT_LABEL[v.nature_of_business] : '',
      v.outstanding_amount !== null && v.outstanding_amount !== undefined ? v.outstanding_amount : '',
      v.email_count,
      v.last_emailed_at ? new Date(v.last_emailed_at).toLocaleDateString('en-IN') : '',
      v.submitted_at ? new Date(v.submitted_at).toLocaleDateString('en-IN') : '',
      v.declarant_name ?? '',
      new Date(v.created_at).toLocaleDateString('en-IN'),
    ])

    const ws = XLSX.utils.aoa_to_sheet([header, ...rows])
    ws['!cols'] = header.map(() => ({ wch: 22 }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'MSME Vendors')
    XLSX.writeFile(wb, `msme-vendors-${new Date().toISOString().slice(0,10)}.xlsx`)
    showToast(`Exported ${vendors.length} vendors to Excel`)
  }

  // ── Derived values ─────────────────────────────────────────────────────────
  const selected       = vendors.find(v => v.id === selectedId) ?? null
  const searched       = vendors.filter(v =>
    !search ||
    v.vendor_name.toLowerCase().includes(search.toLowerCase()) ||
    v.vendor_email.toLowerCase().includes(search.toLowerCase()) ||
    (v.gstin ?? '').toLowerCase().includes(search.toLowerCase())
  )
  const filtered = filterStatus === 'all' ? searched : filterStatus === 'unpaid'
    ? searched.filter(v => v.payment_status === 'unpaid')
    : searched.filter(v => v.status === filterStatus)

  const completedCount  = vendors.filter(v => v.status === 'submitted' || v.status === 'not_msme').length
  const exhaustedCount  = vendors.filter(v => v.email_count >= 3 && v.status === 'emailed').length
  const unpaidCount     = vendors.filter(v => v.payment_status === 'unpaid').length
  const completionPct   = total > 0 ? Math.round((completedCount / total) * 100) : 0
  const counts = {
    pending:  vendors.filter(v => v.status === 'pending').length,
    emailed:  vendors.filter(v => v.status === 'emailed').length,
    submitted:vendors.filter(v => v.status === 'submitted').length,
    not_msme: vendors.filter(v => v.status === 'not_msme').length,
  }

  return (
    <div style={{ padding: '24px', maxWidth: 1120, margin: '0 auto' }}>

      {/* ── Toasts ── */}
      <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 100, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            background: t.type === 'error' ? '#dc2626' : t.type === 'info' ? '#0284c7' : '#0f172a',
            color: '#fff', padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
            boxShadow: '0 4px 16px rgba(0,0,0,0.18)', maxWidth: 320,
          }}>
            {t.type === 'error' ? '⚠ ' : t.type === 'info' ? 'ℹ ' : '✓ '}{t.message}
          </div>
        ))}
      </div>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>MSME Vendor Tracker</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
            Collect and track MSME registrations · First 5 free, ₹{PRICE_INR}/vendor after
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {canManage && (
            <button onClick={() => { setShowImport(true); setImportRows([]); setImportPreview([]); setImportResult(null); setImportError(null) }} style={ghostBtn}>
              ↑ Import Excel
            </button>
          )}
          {vendors.length > 0 && (
            <button onClick={handleExport} style={ghostBtn}>↓ Export Excel</button>
          )}
          {canManage && (
            <button onClick={() => setShowAdd(true)} style={primaryBtn}>+ Add vendor</button>
          )}
        </div>
      </div>

      {/* ── Payment needed banner ── */}
      {unpaidCount > 0 && (
        <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <p style={{ margin: 0, fontWeight: 700, color: '#92400e', fontSize: 14 }}>
              💳 {unpaidCount} vendor{unpaidCount > 1 ? 's' : ''} locked — payment required
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#b45309' }}>
              Email sending and form links are blocked for unpaid vendor slots. ₹{PRICE_INR} per vendor per year.
            </p>
          </div>
          <button onClick={() => setFilterStatus('unpaid')} style={{ ...primaryBtn, background: '#ea580c', fontSize: 12, padding: '7px 14px' }}>
            View unpaid vendors →
          </button>
        </div>
      )}

      {/* ── Summary cards ── */}
      {total > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
          <SummaryCard label="COMPLETION" value={`${completedCount}/${total}`} sub={`${completionPct}% responded`} accent={ACCENT} progress={completionPct} />
          <SummaryCard label="NOT CONTACTED" value={String(counts.pending)} sub="awaiting first email" accent={counts.pending > 0 ? '#64748b' : ACCENT} />
          <SummaryCard label="AWAITING REPLY" value={String(counts.emailed)} sub="email sent, no response" accent={counts.emailed > 0 ? '#ea580c' : ACCENT} />
          {unpaidCount > 0 && <SummaryCard label="PAYMENT PENDING" value={String(unpaidCount)} sub={`₹${unpaidCount * PRICE_INR} total due`} accent="#ea580c" warn />}
          {exhaustedCount > 0 && <SummaryCard label="MANUAL FOLLOW-UP" value={String(exhaustedCount)} sub="3 emails sent — call them" accent="#dc2626" warn />}
        </div>
      )}

      {/* ── Filters + search ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {(['all', 'pending', 'emailed', 'submitted', 'not_msme', 'unpaid'] as const).map(s => {
          const count  = s === 'all' ? total : s === 'unpaid' ? unpaidCount : counts[s as keyof typeof counts] ?? 0
          const active = filterStatus === s
          if (s === 'unpaid' && unpaidCount === 0) return null
          return (
            <button key={s} onClick={() => setFilterStatus(s)} style={{
              padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              border: `1.5px solid ${active ? ACCENT : 'var(--border)'}`,
              background: active ? `${ACCENT}15` : 'var(--surface)',
              color: active ? ACCENT : 'var(--text-muted)',
            }}>
              {s === 'all' ? 'All' : s === 'unpaid' ? '💳 Unpaid' : STATUS_LABEL[s as Vendor['status']].replace(' ✓', '')} · {count}
            </button>
          )
        })}
        <input
          style={{ marginLeft: 'auto', padding: '7px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, color: 'var(--text)', background: 'var(--surface)', width: 220, outline: 'none' }}
          placeholder="Search name / email / GSTIN…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* ── Main layout ── */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        {/* Table */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {loading ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <EmptyState search={search} onAdd={canManage ? () => setShowAdd(true) : undefined} onImport={canManage ? () => setShowImport(true) : undefined} />
          ) : (
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--surface-secondary)', borderBottom: '1px solid var(--border)' }}>
                    {['Vendor', 'Status', 'Category', 'Emails', 'Action'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((v, i) => {
                    const sc        = STATUS_COLOR[v.status]
                    const sel       = selectedId === v.id
                    const exhausted = v.email_count >= 3 && v.status === 'emailed'
                    const locked    = v.payment_status === 'unpaid'
                    return (
                      <tr
                        key={v.id}
                        onClick={() => setSelectedId(sel ? null : v.id)}
                        style={{
                          borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : undefined,
                          background: locked ? '#fffbeb' : sel ? `${ACCENT}08` : 'var(--surface)',
                          cursor: 'pointer',
                        }}
                      >
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {locked && <span title="Payment required" style={{ fontSize: 13 }}>🔒</span>}
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--text)' }}>{v.vendor_name}</div>
                              <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{v.vendor_email}</div>
                              {v.gstin && <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>GSTIN: {v.gstin}</div>}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          {locked ? (
                            <span style={{ background: '#fff7ed', color: '#ea580c', padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
                              💳 Pay ₹{PRICE_INR}
                            </span>
                          ) : exhausted ? (
                            <span style={{ background: '#fef2f2', color: '#dc2626', padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
                              ⚠ Needs call
                            </span>
                          ) : (
                            <span style={{ background: sc.bg, color: sc.text, padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
                              {STATUS_LABEL[v.status]}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>
                          {v.msme_category ? CAT_LABEL[v.msme_category] : v.is_not_msme ? 'Not MSME' : '—'}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'center', color: locked ? '#94a3b8' : exhausted ? '#dc2626' : 'var(--text-muted)', fontWeight: exhausted ? 700 : 400 }}>
                          {locked ? '—' : `${v.email_count}/3`}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          {locked && canManage && (
                            <button
                              onClick={e => { e.stopPropagation(); handlePay(v.id) }}
                              disabled={payingId === v.id}
                              style={{ ...primaryBtn, padding: '5px 12px', fontSize: 11, background: '#ea580c' }}
                            >
                              {payingId === v.id ? 'Processing…' : `Pay ₹${PRICE_INR}`}
                            </button>
                          )}
                          {!locked && canManage && v.status !== 'submitted' && v.status !== 'not_msme' && v.email_count < 3 && (
                            <button
                              onClick={e => { e.stopPropagation(); handleShootEmail(v.id, v.vendor_name) }}
                              disabled={shootingId === v.id}
                              style={{ ...primaryBtn, padding: '5px 12px', fontSize: 11 }}
                            >
                              {shootingId === v.id ? 'Sending…' : v.email_count === 0 ? '✉ Shoot' : '✉ Re-shoot'}
                            </button>
                          )}
                          {(v.status === 'submitted' || v.status === 'not_msme') && (
                            <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 700 }}>✓ Done</span>
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
            <div style={{ background: selected.payment_status === 'unpaid' ? '#92400e' : '#0f172a', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>
                {selected.payment_status === 'unpaid' && '🔒 '}{selected.vendor_name}
              </span>
              <button onClick={() => setSelectedId(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
            </div>

            {/* Payment required block */}
            {selected.payment_status === 'unpaid' && (
              <div style={{ background: '#fff7ed', padding: '14px 16px', borderBottom: '1px solid #fed7aa' }}>
                <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: '#92400e' }}>Payment required to unlock</p>
                <p style={{ margin: '0 0 12px', fontSize: 12, color: '#b45309', lineHeight: 1.5 }}>
                  This is a paid vendor slot. Pay ₹{PRICE_INR} once to unlock email sending, form link sharing, and tracking for this vendor.
                </p>
                <button
                  onClick={() => handlePay(selected.id)}
                  disabled={payingId === selected.id}
                  style={{ ...primaryBtn, width: '100%', background: '#ea580c' }}
                >
                  {payingId === selected.id ? 'Opening payment…' : `Pay ₹${PRICE_INR} to unlock`}
                </button>
              </div>
            )}

            <div style={{ padding: 16 }}>
              {/* Email with edit */}
              <div style={{ marginBottom: 12 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>EMAIL</span>
                {editingEmail === selected.id ? (
                  <div style={{ marginTop: 4, display: 'flex', gap: 6 }}>
                    <input style={{ flex: 1, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, color: 'var(--text)', background: 'var(--surface)', outline: 'none' }}
                      value={editEmailVal} onChange={e => setEditEmailVal(e.target.value)} type="email" autoFocus />
                    <button onClick={() => handleSaveEmail(selected.id)} disabled={savingEmail} style={{ ...primaryBtn, padding: '6px 10px', fontSize: 11 }}>Save</button>
                    <button onClick={() => setEditingEmail(null)} style={{ ...ghostBtn, padding: '6px 8px', fontSize: 11 }}>✕</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <span style={{ fontSize: 13, color: 'var(--text)', wordBreak: 'break-all' }}>{selected.vendor_email}</span>
                    {selected.email_count === 0 && canManage && (
                      <button onClick={() => { setEditingEmail(selected.id); setEditEmailVal(selected.vendor_email) }}
                        style={{ background: 'none', border: 'none', color: ACCENT, cursor: 'pointer', fontSize: 11, flexShrink: 0 }}>✎</button>
                    )}
                  </div>
                )}
              </div>

              {selected.gstin && <DetailRow label="GSTIN" value={selected.gstin} />}

              {/* Slot type */}
              <div style={{ marginBottom: 12 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>SLOT TYPE</span>
                <div style={{ marginTop: 3 }}>
                  {selected.payment_status === 'free'   && <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>✓ Free slot</span>}
                  {selected.payment_status === 'unpaid' && <span style={{ fontSize: 12, color: '#ea580c', fontWeight: 700 }}>🔒 Payment required (₹{PRICE_INR})</span>}
                  {selected.payment_status === 'paid'   && <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 700 }}>✓ Paid · Unlocked</span>}
                </div>
              </div>

              {/* Status */}
              {selected.payment_status !== 'unpaid' && (
                <div style={{ marginBottom: 12 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>STATUS</span>
                  <div style={{ marginTop: 3 }}>
                    {(() => {
                      const sc = STATUS_COLOR[selected.status]
                      const ex = selected.email_count >= 3 && selected.status === 'emailed'
                      return <span style={{ background: ex ? '#fef2f2' : sc.bg, color: ex ? '#dc2626' : sc.text, padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
                        {ex ? '⚠ 3 emails sent — contact directly' : STATUS_LABEL[selected.status]}
                      </span>
                    })()}
                  </div>
                </div>
              )}

              {/* Submission details */}
              {selected.status === 'submitted' && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                  {selected.udyam_number      && <DetailRow label="Udyam No."   value={selected.udyam_number} />}
                  {selected.msme_category     && <DetailRow label="Category"    value={CAT_LABEL[selected.msme_category]} />}
                  {selected.nature_of_business&& <DetailRow label="Nature"      value={NAT_LABEL[selected.nature_of_business]} />}
                  {selected.outstanding_amount !== null && selected.outstanding_amount !== undefined && (
                    <DetailRow label="Outstanding" value={`₹${Number(selected.outstanding_amount).toLocaleString('en-IN')}`} />
                  )}
                  {selected.submitted_at && <DetailRow label="Submitted" value={new Date(selected.submitted_at).toLocaleDateString('en-IN')} />}
                  {selected.cert_url && !selected.cert_url.startsWith('r2:') && (
                    <a href={selected.cert_url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', marginTop: 8, color: ACCENT, fontSize: 12, fontWeight: 600 }}>📎 Download certificate →</a>
                  )}
                  {selected.cert_url?.startsWith('r2:') && <p style={{ margin: '6px 0 0', fontSize: 11, color: '#16a34a', fontWeight: 600 }}>✓ Certificate in secure storage</p>}
                </div>
              )}

              {selected.status === 'not_msme' && (
                <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                  <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: '#0284c7' }}>NON-MSME DECLARATION</p>
                  {selected.declarant_name && <DetailRow label="Declared by" value={selected.declarant_name} />}
                  {selected.declared_at    && <DetailRow label="Date"        value={new Date(selected.declared_at).toLocaleDateString('en-IN')} />}
                </div>
              )}

              {selected.email_count > 0 && selected.payment_status !== 'unpaid' && (
                <div style={{ marginBottom: 12 }}>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, margin: '0 0 3px' }}>EMAIL HISTORY</p>
                  <p style={{ fontSize: 12, color: 'var(--text)', margin: 0 }}>
                    {selected.email_count}/3 sent · Last: {selected.last_emailed_at ? new Date(selected.last_emailed_at).toLocaleDateString('en-IN') : '—'}
                  </p>
                </div>
              )}

              {/* Actions */}
              {canManage && selected.payment_status !== 'unpaid' && selected.status !== 'submitted' && selected.status !== 'not_msme' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {selected.email_count < 3 && (
                    <button onClick={() => handleShootEmail(selected.id, selected.vendor_name)} disabled={shootingId === selected.id} style={{ ...primaryBtn, width: '100%' }}>
                      {shootingId === selected.id ? 'Sending…' : selected.email_count === 0 ? '✉ Shoot email' : `✉ Re-shoot (${selected.email_count}/3)`}
                    </button>
                  )}
                  <button onClick={() => handleCopyLink(selected.id)} disabled={copyingId === selected.id} style={{ ...ghostBtn, width: '100%' }}>
                    {copyingId === selected.id ? 'Generating…' : '🔗 Copy form link (WhatsApp / SMS)'}
                  </button>
                </div>
              )}

              {canAdmin && (
                <button onClick={() => handleDelete(selected.id)} disabled={deletingId === selected.id}
                  style={{ ...ghostBtn, width: '100%', marginTop: 10, color: '#dc2626', borderColor: '#fecaca', fontSize: 12 }}>
                  {deletingId === selected.id ? 'Removing…' : 'Remove vendor'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Add vendor modal ── */}
      {showAdd && (
        <Modal title="Add vendor" onClose={() => { setShowAdd(false); setAddError(null) }}>
          <form onSubmit={handleAdd}>
            <Field label="Vendor / Company name *">
              <input style={mi} type="text" value={vendorName} onChange={e => setVendorName(e.target.value)} required placeholder="e.g. Shree Steel Works" autoFocus />
            </Field>
            <Field label="Vendor email *" hint="Double-check — wrong email = vendor never gets the form">
              <input style={mi} type="email" value={vendorEmail} onChange={e => setVendorEmail(e.target.value)} required placeholder="vendor@example.com" />
            </Field>
            <Field label="GSTIN (optional)">
              <input style={mi} type="text" value={gstin} onChange={e => setGstin(e.target.value)} placeholder="27AABCU9603R1ZX" />
            </Field>
            {addError && <ErrorBox>{addError}</ErrorBox>}
            {total >= FREE_LIMIT && (
              <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#92400e' }}>
                <strong>Paid slot — ₹{PRICE_INR}/year</strong><br/>
                This vendor will be added in locked state. Pay ₹{PRICE_INR} after adding to unlock email sending.
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" disabled={adding} style={{ ...primaryBtn, flex: 1 }}>{adding ? 'Adding…' : 'Add vendor'}</button>
              <button type="button" onClick={() => { setShowAdd(false); setAddError(null) }} style={{ ...ghostBtn, flex: 1 }}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Import modal ── */}
      {showImport && (
        <Modal title="Import vendors from Excel / CSV" onClose={() => setShowImport(false)} wide>
          {!importResult ? (
            <>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
                Upload an Excel (.xlsx) or CSV file with columns: <strong>Vendor Name</strong> and <strong>Vendor Email</strong>.
                GSTIN column is optional. Duplicate emails are skipped automatically.
              </p>

              <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                <label style={{ ...primaryBtn, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <input type="file" accept=".xlsx,.xls,.csv" onChange={handleImportFile} style={{ display: 'none' }} />
                  ↑ Choose file
                </label>
                <button onClick={handleDownloadTemplate} style={ghostBtn}>
                  ↓ Download template
                </button>
              </div>

              {importError && <ErrorBox>{importError}</ErrorBox>}

              {importPreview.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: '0 0 10px' }}>
                    Preview — {importRows.length} rows found{importRows.length > 5 ? ` (showing first 5)` : ''}
                  </p>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: 'var(--surface-secondary)' }}>
                          {['Vendor Name', 'Email', 'GSTIN'].map(h => <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {importPreview.map((r, i) => (
                          <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                            <td style={{ padding: '8px 12px', color: r.vendor_name ? 'var(--text)' : '#dc2626' }}>{r.vendor_name || '(missing)'}</td>
                            <td style={{ padding: '8px 12px', color: r.vendor_email ? 'var(--text)' : '#dc2626' }}>{r.vendor_email || '(missing)'}</td>
                            <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>{r.gstin || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {total + importRows.length > FREE_LIMIT && (
                    <div style={{ marginTop: 12, background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#92400e' }}>
                      <strong>Heads up:</strong> {Math.max(0, total + importRows.length - FREE_LIMIT)} of these {importRows.length} vendors will need payment (₹{PRICE_INR} each) to unlock email sending.
                      Free slots remaining: {Math.max(0, FREE_LIMIT - total)}.
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                    <button onClick={handleImportSubmit} disabled={importing} style={{ ...primaryBtn, flex: 1 }}>
                      {importing ? 'Importing…' : `Import ${importRows.length} vendors`}
                    </button>
                    <button onClick={() => { setImportRows([]); setImportPreview([]) }} style={{ ...ghostBtn, flex: 1 }}>Clear</button>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Import result */
            <div>
              <div style={{ textAlign: 'center', fontSize: 40, marginBottom: 12 }}>{importResult.inserted > 0 ? '✅' : '⚠️'}</div>
              <p style={{ textAlign: 'center', fontWeight: 700, fontSize: 16, color: 'var(--text)', margin: '0 0 8px' }}>
                {importResult.inserted} vendor{importResult.inserted !== 1 ? 's' : ''} imported
              </p>
              {importResult.paid_slots > 0 && (
                <p style={{ textAlign: 'center', fontSize: 13, color: '#ea580c', margin: '0 0 16px' }}>
                  {importResult.paid_slots} paid slot{importResult.paid_slots > 1 ? 's' : ''} — pay ₹{importResult.paid_slots * PRICE_INR} to unlock email sending
                </p>
              )}
              {importResult.skipped.length > 0 && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 14, marginBottom: 16 }}>
                  <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: '#dc2626' }}>{importResult.skipped.length} row{importResult.skipped.length !== 1 ? 's' : ''} skipped:</p>
                  {importResult.skipped.map((s, i) => (
                    <p key={i} style={{ margin: '2px 0', fontSize: 12, color: '#991b1b' }}>Row {s.row}: {s.name} — {s.reason}</p>
                  ))}
                </div>
              )}
              <button onClick={() => setShowImport(false)} style={{ ...primaryBtn, width: '100%' }}>Done</button>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub, accent, progress, warn }: {
  label: string; value: string; sub: string; accent: string; progress?: number; warn?: boolean
}) {
  return (
    <div style={{ background: warn ? '#fef2f2' : 'var(--surface)', border: `1px solid ${warn ? '#fecaca' : 'var(--border)'}`, borderRadius: 10, padding: '14px 16px' }}>
      <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 600, color: warn ? '#dc2626' : 'var(--text-muted)' }}>{label}</p>
      <span style={{ fontSize: 24, fontWeight: 800, color: accent }}>{value}</span>
      {progress !== undefined && (
        <div style={{ height: 3, background: 'var(--border)', borderRadius: 2, margin: '6px 0 4px' }}>
          <div style={{ height: 3, background: accent, borderRadius: 2, width: `${progress}%` }} />
        </div>
      )}
      <p style={{ margin: progress !== undefined ? 0 : '3px 0 0', fontSize: 11, color: warn ? '#dc2626' : 'var(--text-muted)' }}>{sub}</p>
    </div>
  )
}

function EmptyState({ search, onAdd, onImport }: { search: string; onAdd?: () => void; onImport?: () => void }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)', border: '1.5px dashed var(--border)', borderRadius: 10 }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>🏭</div>
      <p style={{ margin: 0, fontWeight: 600, color: 'var(--text)' }}>{search ? 'No vendors match your search' : 'No vendors yet'}</p>
      {!search && (
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 16, flexWrap: 'wrap' }}>
          {onAdd    && <button onClick={onAdd}    style={primaryBtn}>+ Add vendor</button>}
          {onImport && <button onClick={onImport} style={ghostBtn}>↑ Import from Excel</button>}
        </div>
      )}
    </div>
  )
}

function Modal({ title, children, onClose, wide }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 28, width: '100%', maxWidth: wide ? 560 : 420, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>{label}</label>
      {children}
      {hint && <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>{hint}</p>}
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8, gap: 8 }}>
      <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{label}</span>
      <span style={{ color: 'var(--text)', fontWeight: 500, textAlign: 'right', wordBreak: 'break-all' }}>{value}</span>
    </div>
  )
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
      <p style={{ color: '#dc2626', fontSize: 13, margin: 0 }}>{children as string}</p>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const primaryBtn: React.CSSProperties = {
  background: ACCENT, color: '#fff', border: 'none', borderRadius: 8,
  padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
}
const ghostBtn: React.CSSProperties = {
  background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)',
  borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
}
const mi: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8,
  fontSize: 14, color: 'var(--text)', background: 'var(--surface)', boxSizing: 'border-box',
}
