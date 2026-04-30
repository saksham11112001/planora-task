'use client'
import { useState, useMemo } from 'react'
import { Plus, Receipt, CheckCircle2, Clock, AlertCircle, Send, Trash2, X, IndianRupee } from 'lucide-react'
import { toast } from '@/store/appStore'
import { fmtDate } from '@/lib/utils/format'

interface InvoiceItem { description: string; quantity: number; rate: number; amount: number }
interface Invoice {
  id: string; invoice_number: string; status: string
  issue_date: string; due_date: string | null
  subtotal: number; tax_rate: number; tax_amount: number; discount: number; total: number
  notes: string | null; created_at: string; paid_at: string | null
  clients: { id: string; name: string; color: string } | null
  items: InvoiceItem[]
}
interface Client { id: string; name: string; color: string; email?: string | null }

interface Props {
  invoices:      Invoice[]
  clients:       Client[]
  canManage:     boolean
  currentUserId: string
}

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  draft:     { label: 'Draft',     color: '#64748b', bg: '#f1f5f9', icon: Clock },
  sent:      { label: 'Sent',      color: '#0891b2', bg: '#e0f2fe', icon: Send },
  paid:      { label: 'Paid',      color: '#16a34a', bg: '#dcfce7', icon: CheckCircle2 },
  overdue:   { label: 'Overdue',   color: '#dc2626', bg: '#fee2e2', icon: AlertCircle },
  cancelled: { label: 'Cancelled', color: '#94a3b8', bg: '#f8fafc', icon: X },
}

const EMPTY_ITEM = (): InvoiceItem => ({ description: '', quantity: 1, rate: 0, amount: 0 })

function fmtINR(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n)
}

export function InvoicesView({ invoices: init, clients, canManage }: Props) {
  const [invoices,    setInvoices]    = useState<Invoice[]>(init)
  const [showCreate,  setShowCreate]  = useState(false)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterClient, setFilterClient] = useState('')
  const [detailId,    setDetailId]    = useState<string | null>(null)
  const [deleting,    setDeleting]    = useState<string | null>(null)

  // ── Create form state ──
  const [clientId,  setClientId]  = useState('')
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10))
  const [dueDate,   setDueDate]   = useState('')
  const [items,     setItems]     = useState<InvoiceItem[]>([EMPTY_ITEM()])
  const [taxRate,   setTaxRate]   = useState(18)
  const [discount,  setDiscount]  = useState(0)
  const [notes,     setNotes]     = useState('')
  const [saving,    setSaving]    = useState(false)

  // ── Computed totals ──
  const subtotal   = items.reduce((s, i) => s + (i.amount || 0), 0)
  const discountAmt = Number(discount) || 0
  const taxAmount  = Math.round((subtotal - discountAmt) * (taxRate / 100) * 100) / 100
  const total      = subtotal - discountAmt + taxAmount

  // ── Filtered view ──
  const visible = useMemo(() => invoices.filter(inv => {
    if (filterStatus && inv.status !== filterStatus) return false
    if (filterClient && inv.clients?.id !== filterClient) return false
    return true
  }), [invoices, filterStatus, filterClient])

  // ── Summary KPIs ──
  const outstanding = invoices.filter(i => ['sent','overdue'].includes(i.status)).reduce((s, i) => s + i.total, 0)
  const paidMonth   = invoices.filter(i => i.status === 'paid' && i.paid_at && new Date(i.paid_at) >= new Date(Date.now() - 30*86400000)).reduce((s, i) => s + i.total, 0)
  const overdueAmt  = invoices.filter(i => i.status === 'overdue').reduce((s, i) => s + i.total, 0)
  const draftCount  = invoices.filter(i => i.status === 'draft').length

  function updateItem(idx: number, field: keyof InvoiceItem, val: string | number) {
    setItems(prev => {
      const next = [...prev]
      const item = { ...next[idx], [field]: val } as InvoiceItem
      if (field === 'quantity' || field === 'rate') {
        item.amount = Math.round(Number(item.quantity) * Number(item.rate) * 100) / 100
      }
      next[idx] = item
      return next
    })
  }

  async function createInvoice() {
    setSaving(true)
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId || null, issue_date: issueDate, due_date: dueDate || null, items, tax_rate: taxRate, discount, notes }),
      })
      const d = await res.json()
      if (!res.ok) { toast.error(d.error ?? 'Failed'); return }
      setInvoices(prev => [d.data, ...prev])
      toast.success(`Invoice ${d.data.invoice_number} created`)
      setShowCreate(false)
      resetForm()
    } finally { setSaving(false) }
  }

  function resetForm() {
    setClientId(''); setIssueDate(new Date().toISOString().slice(0, 10)); setDueDate('')
    setItems([EMPTY_ITEM()]); setTaxRate(18); setDiscount(0); setNotes('')
  }

  async function updateStatus(id: string, status: string) {
    const res = await fetch(`/api/invoices/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    const d = await res.json()
    if (!res.ok) { toast.error(d.error ?? 'Failed'); return }
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, ...d.data } : i))
    toast.success(`Marked as ${STATUS_CFG[status]?.label}`)
  }

  async function deleteInvoice(id: string, num: string) {
    if (!confirm(`Delete ${num}? This cannot be undone.`)) return
    setDeleting(id)
    const res = await fetch(`/api/invoices/${id}`, { method: 'DELETE' })
    if (res.ok) { setInvoices(prev => prev.filter(i => i.id !== id)); toast.success('Invoice deleted') }
    else toast.error('Delete failed')
    setDeleting(null)
  }

  const detail = detailId ? invoices.find(i => i.id === detailId) : null

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Header ── */}
      <div style={{ padding: '16px 24px 12px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(14,165,233,0.12)', border: '1px solid rgba(14,165,233,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Receipt style={{ width: 16, height: 16, color: '#0891b2' }}/>
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Invoices</h1>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>{invoices.length} invoice{invoices.length !== 1 ? 's' : ''} total</p>
            </div>
          </div>
          {canManage && (
            <button onClick={() => setShowCreate(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8,
                background: '#0891b2', color: '#fff', border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>
              <Plus style={{ width: 14, height: 14 }}/> New invoice
            </button>
          )}
        </div>

        {/* KPI strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
          {[
            { label: 'Outstanding',     value: fmtINR(outstanding), color: '#0891b2', bg: '#e0f2fe', onClick: () => setFilterStatus('sent') },
            { label: 'Paid this month', value: fmtINR(paidMonth),   color: '#16a34a', bg: '#dcfce7', onClick: () => setFilterStatus('paid') },
            { label: 'Overdue',         value: fmtINR(overdueAmt),  color: '#dc2626', bg: '#fee2e2', onClick: () => setFilterStatus('overdue') },
            { label: 'Drafts',          value: `${draftCount}`,     color: '#64748b', bg: '#f1f5f9', onClick: () => setFilterStatus('draft') },
          ].map(k => (
            <button key={k.label} onClick={k.onClick}
              style={{ background: k.bg, borderRadius: 8, padding: '10px 14px', border: `1px solid ${k.color}22`,
                cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                outline: filterStatus && k.bg.includes(k.color.slice(1,5)) ? `2px solid ${k.color}` : 'none' }}>
              <p style={{ fontSize: 11, color: k.color, fontWeight: 500, margin: '0 0 4px' }}>{k.label}</p>
              <p style={{ fontSize: 18, fontWeight: 800, color: k.color, margin: 0 }}>{k.value}</p>
            </button>
          ))}
        </div>
      </div>

      {/* ── Filters ── */}
      <div style={{ padding: '8px 24px', borderBottom: '1px solid var(--border-light)', background: 'var(--surface)', display: 'flex', gap: 8, flexShrink: 0 }}>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20, border: '1px solid var(--border)',
            background: filterStatus ? 'rgba(14,165,233,0.08)' : 'var(--surface-subtle)',
            color: 'var(--text-secondary)', fontFamily: 'inherit', cursor: 'pointer' }}>
          <option value="">All statuses</option>
          {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filterClient} onChange={e => setFilterClient(e.target.value)}
          style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20, border: '1px solid var(--border)',
            background: filterClient ? 'rgba(14,165,233,0.08)' : 'var(--surface-subtle)',
            color: 'var(--text-secondary)', fontFamily: 'inherit', cursor: 'pointer' }}>
          <option value="">All clients</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {(filterStatus || filterClient) && (
          <button onClick={() => { setFilterStatus(''); setFilterClient('') }}
            style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, border: '1px solid #dc2626',
              background: 'rgba(220,38,38,0.06)', color: '#dc2626', cursor: 'pointer', fontFamily: 'inherit' }}>
            ✕ Clear
          </button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
          {visible.length} invoice{visible.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Invoice list ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        {visible.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <Receipt style={{ width: 40, height: 40, color: 'var(--border)', margin: '0 auto 12px' }}/>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>No invoices yet</p>
            {canManage && <button onClick={() => setShowCreate(true)}
              style={{ marginTop: 12, fontSize: 13, color: '#0891b2', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
              Create your first invoice →
            </button>}
          </div>
        ) : (
          <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
            {/* Table header */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 100px 110px 120px 130px', gap: 12,
              padding: '10px 16px', background: 'var(--surface-subtle)', borderBottom: '1px solid var(--border)',
              fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <span>Invoice / Client</span>
              <span>Issue date</span>
              <span>Due date</span>
              <span style={{ textAlign: 'right' }}>Amount</span>
              <span>Status</span>
              <span></span>
            </div>

            {visible.map((inv, i) => {
              const cfg = STATUS_CFG[inv.status] ?? STATUS_CFG.draft
              const Icon = cfg.icon
              const isOverdueNow = inv.status === 'sent' && inv.due_date && inv.due_date < new Date().toISOString().slice(0, 10)
              return (
                <div key={inv.id}
                  style={{ display: 'grid', gridTemplateColumns: '1fr 160px 100px 110px 120px 130px', gap: 12,
                    padding: '12px 16px', alignItems: 'center', cursor: 'pointer',
                    borderBottom: i < visible.length - 1 ? '1px solid var(--border-light)' : 'none',
                    background: 'var(--surface)', transition: 'background 0.1s' }}
                  onClick={() => setDetailId(inv.id)}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface-subtle)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}>

                  {/* Invoice # + client */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{inv.invoice_number}</span>
                      {isOverdueNow && <span style={{ fontSize: 9, fontWeight: 700, background: '#fee2e2', color: '#dc2626', padding: '1px 6px', borderRadius: 4 }}>OVERDUE</span>}
                    </div>
                    {inv.clients && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: inv.clients.color, flexShrink: 0 }}/>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{inv.clients.name}</span>
                      </div>
                    )}
                  </div>

                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{fmtDate(inv.issue_date)}</span>
                  <span style={{ fontSize: 12, color: isOverdueNow ? '#dc2626' : 'var(--text-secondary)', fontWeight: isOverdueNow ? 600 : 400 }}>
                    {inv.due_date ? fmtDate(inv.due_date) : '—'}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', textAlign: 'right' }}>{fmtINR(inv.total)}</span>

                  {/* Status badge */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5,
                    padding: '3px 10px', borderRadius: 20, background: cfg.bg,
                    width: 'fit-content' }}>
                    <Icon style={{ width: 11, height: 11, color: cfg.color }}/>
                    <span style={{ fontSize: 11, fontWeight: 600, color: cfg.color }}>{cfg.label}</span>
                  </div>

                  {/* Actions */}
                  {canManage && (
                    <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                      {inv.status === 'draft' && (
                        <button onClick={() => updateStatus(inv.id, 'sent')}
                          style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid #0891b2',
                            background: 'rgba(8,145,178,0.08)', color: '#0891b2', cursor: 'pointer', fontFamily: 'inherit' }}>
                          Send
                        </button>
                      )}
                      {['sent','overdue'].includes(inv.status) && (
                        <button onClick={() => updateStatus(inv.id, 'paid')}
                          style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid #16a34a',
                            background: 'rgba(22,163,74,0.08)', color: '#16a34a', cursor: 'pointer', fontFamily: 'inherit' }}>
                          Mark paid
                        </button>
                      )}
                      <button onClick={() => deleteInvoice(inv.id, inv.invoice_number)}
                        disabled={deleting === inv.id}
                        style={{ padding: '3px 7px', borderRadius: 6, border: '1px solid var(--border)',
                          background: 'var(--surface)', color: '#dc2626', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                        <Trash2 style={{ width: 11, height: 11 }}/>
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Create Invoice Drawer ── */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', justifyContent: 'flex-end' }}
          onClick={e => { if (e.target === e.currentTarget) { setShowCreate(false); resetForm() } }}>
          <div style={{ width: '100%', maxWidth: 580, background: 'var(--surface)', height: '100%', display: 'flex', flexDirection: 'column',
            boxShadow: '-4px 0 40px rgba(0,0,0,0.2)' }}>

            {/* Drawer header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>New Invoice</h2>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>Invoice will be auto-numbered</p>
              </div>
              <button onClick={() => { setShowCreate(false); resetForm() }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                <X style={{ width: 18, height: 18 }}/>
              </button>
            </div>

            {/* Drawer body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

              {/* Client + dates */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelSt}>Client</label>
                  <select value={clientId} onChange={e => setClientId(e.target.value)} style={inputSt}>
                    <option value="">— No client —</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelSt}>Issue date *</label>
                  <input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} style={inputSt}/>
                </div>
                <div>
                  <label style={labelSt}>Due date</label>
                  <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={inputSt}/>
                </div>
                <div>
                  <label style={labelSt}>GST / Tax %</label>
                  <input type="number" min="0" max="100" value={taxRate} onChange={e => setTaxRate(Number(e.target.value))} style={inputSt}/>
                </div>
              </div>

              {/* Line items */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <label style={{ ...labelSt, margin: 0 }}>Line items</label>
                  <button onClick={() => setItems(p => [...p, EMPTY_ITEM()])}
                    style={{ fontSize: 11, color: '#0891b2', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0, fontFamily: 'inherit' }}>
                    + Add row
                  </button>
                </div>

                {/* Column headers */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 90px 80px 28px', gap: 6, marginBottom: 4 }}>
                  {['Description','Qty','Rate (₹)','Amount',''].map(h => (
                    <span key={h} style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
                  ))}
                </div>

                {items.map((item, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 90px 80px 28px', gap: 6, marginBottom: 6 }}>
                    <input value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)}
                      placeholder="Service / work description" style={{ ...inputSt, margin: 0 }}/>
                    <input type="number" min="0" value={item.quantity} onChange={e => updateItem(idx, 'quantity', Number(e.target.value))} style={{ ...inputSt, margin: 0, textAlign: 'right' as const }}/>
                    <input type="number" min="0" value={item.rate} onChange={e => updateItem(idx, 'rate', Number(e.target.value))} style={{ ...inputSt, margin: 0, textAlign: 'right' as const }}/>
                    <input type="number" value={item.amount} readOnly style={{ ...inputSt, margin: 0, background: 'var(--surface-subtle)', textAlign: 'right' as const }}/>
                    <button onClick={() => setItems(p => p.filter((_, i) => i !== idx))} disabled={items.length === 1}
                      style={{ background: 'none', border: 'none', cursor: items.length === 1 ? 'default' : 'pointer',
                        color: items.length === 1 ? 'var(--border)' : '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <X style={{ width: 14, height: 14 }}/>
                    </button>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div style={{ background: 'var(--surface-subtle)', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
                {[
                  ['Subtotal', fmtINR(subtotal), false],
                  ['Discount', null, true],
                  [`GST / Tax (${taxRate}%)`, fmtINR(taxAmount), false],
                ].map(([label, val, isInput]) => (
                  <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label as string}</span>
                    {isInput ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <IndianRupee style={{ width: 11, height: 11, color: 'var(--text-muted)' }}/>
                        <input type="number" min="0" value={discount} onChange={e => setDiscount(Number(e.target.value))}
                          style={{ width: 90, fontSize: 12, padding: '2px 6px', borderRadius: 6, border: '1px solid var(--border)',
                            background: 'var(--surface)', color: 'var(--text-primary)', fontFamily: 'inherit', textAlign: 'right' }}/>
                      </div>
                    ) : (
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{val as string}</span>
                    )}
                  </div>
                ))}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Total</span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: '#0891b2' }}>{fmtINR(total)}</span>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label style={labelSt}>Notes / Terms</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                  placeholder="Payment terms, bank details, thank-you message…"
                  style={{ ...inputSt, resize: 'vertical' as const, minHeight: 72 }}/>
              </div>
            </div>

            {/* Drawer footer */}
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, flexShrink: 0 }}>
              <button onClick={() => { setShowCreate(false); resetForm() }}
                style={{ flex: 1, padding: '9px', borderRadius: 8, border: '1px solid var(--border)',
                  background: 'var(--surface)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
                Cancel
              </button>
              <button onClick={createInvoice} disabled={saving}
                style={{ flex: 2, padding: '9px', borderRadius: 8, border: 'none',
                  background: saving ? 'var(--border)' : '#0891b2', color: '#fff',
                  cursor: saving ? 'default' : 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>
                {saving ? 'Creating…' : 'Create invoice'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Invoice Detail Modal ── */}
      {detail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={e => { if (e.target === e.currentTarget) setDetailId(null) }}>
          <div style={{ background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 600, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            {/* Modal header */}
            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{detail.invoice_number}</h2>
                  <div style={{ padding: '2px 10px', borderRadius: 20, background: STATUS_CFG[detail.status]?.bg, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: STATUS_CFG[detail.status]?.color }}>{STATUS_CFG[detail.status]?.label}</span>
                  </div>
                </div>
                {detail.clients && <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>{detail.clients.name}</p>}
              </div>
              <button onClick={() => setDetailId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X style={{ width: 18, height: 18 }}/>
              </button>
            </div>

            {/* Modal body */}
            <div style={{ padding: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                {[
                  ['Issue date', fmtDate(detail.issue_date)],
                  ['Due date',   detail.due_date ? fmtDate(detail.due_date) : 'Not set'],
                  ['Created',    fmtDate(detail.created_at)],
                  detail.paid_at ? ['Paid on', fmtDate(detail.paid_at)] : ['', ''],
                ].filter(([l]) => l).map(([label, value]) => (
                  <div key={label}>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 2px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
                    <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: 0 }}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Items table */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 90px 90px', gap: 8,
                  padding: '6px 10px', background: 'var(--surface-subtle)', borderRadius: '8px 8px 0 0',
                  fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <span>Description</span><span style={{ textAlign: 'right' }}>Qty</span>
                  <span style={{ textAlign: 'right' }}>Rate</span><span style={{ textAlign: 'right' }}>Amount</span>
                </div>
                {(detail.items || []).map((item, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 90px 90px', gap: 8,
                    padding: '8px 10px', borderBottom: '1px solid var(--border-light)', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-primary)' }}>{item.description || '—'}</span>
                    <span style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{item.quantity}</span>
                    <span style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{fmtINR(item.rate)}</span>
                    <span style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>{fmtINR(item.amount)}</span>
                  </div>
                ))}
              </div>

              {/* Total summary */}
              <div style={{ background: 'var(--surface-subtle)', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
                {[
                  ['Subtotal', fmtINR(detail.subtotal)],
                  detail.discount > 0 ? [`Discount`, `- ${fmtINR(detail.discount)}`] : null,
                  detail.tax_rate > 0 ? [`GST / Tax (${detail.tax_rate}%)`, fmtINR(detail.tax_amount)] : null,
                ].filter(Boolean).map(row => (
                  <div key={row![0]} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{row![0]}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{row![1]}</span>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>Total</span>
                  <span style={{ fontSize: 20, fontWeight: 800, color: '#0891b2' }}>{fmtINR(detail.total)}</span>
                </div>
              </div>

              {detail.notes && (
                <div style={{ padding: '10px 14px', background: '#fffbeb', borderRadius: 8, border: '1px solid #fde68a' }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#92400e', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Notes</p>
                  <p style={{ fontSize: 13, color: '#78350f', margin: 0, whiteSpace: 'pre-line' }}>{detail.notes}</p>
                </div>
              )}
            </div>

            {/* Modal footer actions */}
            {canManage && (
              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
                {detail.status === 'draft' && (
                  <button onClick={() => { updateStatus(detail.id, 'sent'); setDetailId(null) }}
                    style={actionBtnSt('#0891b2')}>
                    <Send style={{ width: 13, height: 13 }}/> Mark as sent
                  </button>
                )}
                {['sent','overdue'].includes(detail.status) && (
                  <button onClick={() => { updateStatus(detail.id, 'paid'); setDetailId(null) }}
                    style={actionBtnSt('#16a34a')}>
                    <CheckCircle2 style={{ width: 13, height: 13 }}/> Mark as paid
                  </button>
                )}
                {['sent','draft'].includes(detail.status) && (
                  <button onClick={() => { updateStatus(detail.id, 'cancelled'); setDetailId(null) }}
                    style={actionBtnSt('#94a3b8')}>
                    Cancel invoice
                  </button>
                )}
                <button onClick={() => { deleteInvoice(detail.id, detail.invoice_number); setDetailId(null) }}
                  style={{ marginLeft: 'auto', ...actionBtnSt('#dc2626') }}>
                  <Trash2 style={{ width: 13, height: 13 }}/> Delete
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Shared micro-styles ───────────────────────────────────────────────────────
const labelSt: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4,
}
const inputSt: React.CSSProperties = {
  width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)',
  background: 'var(--surface)', color: 'var(--text-primary)', fontSize: 13,
  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', marginBottom: 0,
}
function actionBtnSt(color: string): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 5,
    padding: '7px 14px', borderRadius: 8, border: `1px solid ${color}`,
    background: `${color}12`, color, cursor: 'pointer',
    fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
  }
}
