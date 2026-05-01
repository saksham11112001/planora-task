'use client'
import { useState, useEffect, useCallback } from 'react'
import { Plus, X, DollarSign, Receipt, ChevronDown, Trash2, Edit3, Eye, Check, Send, AlertCircle, Search, Filter } from 'lucide-react'
import { toast } from '@/store/appStore'
import type { Invoice, InvoiceStatus } from '@/types'
import { INVOICE_STATUS_CONFIG as STATUS_CFG } from '@/types'

interface Client { id: string; name: string; color: string }
interface Props {
  invoices:   any[]
  clients:    Client[]
  canManage:  boolean
  orgId:      string
}

// ── helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(n)
}

function calcTotals(items: LineItem[], gstRate: number, discountAmount: number) {
  const subtotal   = items.reduce((s, it) => s + it.qty * it.price, 0)
  const gst_amount = Math.round(subtotal * gstRate / 100 * 100) / 100
  const total      = Math.round((subtotal + gst_amount - discountAmount) * 100) / 100
  return { subtotal, gst_amount, total }
}

interface LineItem {
  id?:       string
  task_id?:  string | null
  desc:      string
  qty:       number
  price:     number
  task?:     { id: string; title: string } | null
}

// ── Create / Edit modal ───────────────────────────────────────────────────────

function InvoiceModal({ clients, invoice, onClose, onSaved }: {
  clients:   Client[]
  invoice?:  any
  onClose:   () => void
  onSaved:   (inv: any) => void
}) {
  const isEdit = !!invoice
  const [clientId,        setClientId]        = useState(invoice?.client_id ?? '')
  const [title,           setTitle]           = useState(invoice?.title ?? '')
  const [issueDate,       setIssueDate]       = useState(invoice?.issue_date ?? new Date().toISOString().slice(0,10))
  const [dueDate,         setDueDate]         = useState(invoice?.due_date ?? '')
  const [notes,           setNotes]           = useState(invoice?.notes ?? '')
  const [gstin,           setGstin]           = useState(invoice?.gstin ?? '')
  const [gstRate,         setGstRate]         = useState<number>(invoice?.gst_rate ?? 18)
  const [discountAmount,  setDiscountAmount]  = useState<number>(invoice?.discount_amount ?? 0)
  const [items,           setItems]           = useState<LineItem[]>(
    invoice?.items?.map((it: any) => ({
      id: it.id, task_id: it.task_id, desc: it.description,
      qty: it.quantity, price: it.unit_price, task: it.task,
    })) ?? [{ desc: '', qty: 1, price: 0 }]
  )
  const [unbilledTasks,   setUnbilledTasks]   = useState<any[]>([])
  const [loadingTasks,    setLoadingTasks]    = useState(false)
  const [saving,          setSaving]          = useState(false)

  const { subtotal, gst_amount, total } = calcTotals(items, gstRate, discountAmount)

  // Load unbilled tasks for the selected client
  useEffect(() => {
    if (!clientId) { setUnbilledTasks([]); return }
    setLoadingTasks(true)
    fetch(`/api/invoices/unbilled-tasks?client_id=${clientId}`)
      .then(r => r.json())
      .then(d => setUnbilledTasks(d.data ?? []))
      .catch(() => {})
      .finally(() => setLoadingTasks(false))
  }, [clientId])

  function addItem() {
    setItems(p => [...p, { desc: '', qty: 1, price: 0 }])
  }

  function removeItem(i: number) {
    setItems(p => p.filter((_, idx) => idx !== i))
  }

  function updateItem(i: number, field: keyof LineItem, val: any) {
    setItems(p => p.map((it, idx) => idx === i ? { ...it, [field]: val } : it))
  }

  function addFromTask(task: any) {
    const already = items.some(it => it.task_id === task.id)
    if (already) { toast.error('Task already added'); return }
    setItems(p => [...p, {
      task_id: task.id,
      desc:    task.title,
      qty:     1,
      price:   task.billable_amount ?? 0,
      task:    { id: task.id, title: task.title },
    }])
  }

  async function save() {
    if (!title.trim()) { toast.error('Title is required'); return }
    setSaving(true)
    try {
      const payload = {
        client_id: clientId || null,
        title: title.trim(),
        issue_date: issueDate,
        due_date: dueDate || null,
        notes: notes || null,
        gstin: gstin || null,
        gst_rate: gstRate,
        discount_amount: discountAmount,
        items: items.filter(it => it.desc.trim()).map(it => ({
          task_id:    it.task_id || null,
          description: it.desc.trim(),
          quantity:   it.qty,
          unit_price: it.price,
        })),
      }

      let res: Response
      if (isEdit) {
        // For edits: update invoice details + rebuild items
        res = await fetch(`/api/invoices/${invoice.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, subtotal, gst_amount, total }),
        })
      } else {
        res = await fetch('/api/invoices', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      const d = await res.json()
      if (!res.ok) { toast.error(d.error ?? 'Failed'); return }
      toast.success(isEdit ? 'Invoice updated' : 'Invoice created')
      onSaved(d.data)
    } finally { setSaving(false) }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 14,
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        width: '100%', maxWidth: 720, maxHeight: '92vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <Receipt style={{ width: 18, height: 18, color: 'var(--brand)' }}/>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', flex: 1 }}>
            {isEdit ? 'Edit invoice' : 'New invoice'}
          </h2>
          <button onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', display: 'flex', padding: 4, borderRadius: 6 }}>
            <X style={{ width: 16, height: 16 }}/>
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

          {/* Top fields — 2 column grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
            {/* Title */}
            <div style={{ gridColumn: '1/-1' }}>
              <Label>Invoice title *</Label>
              <input value={title} onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Web design services – April 2025"
                style={{ width: '100%', ...inputStyle }}/>
            </div>

            {/* Client */}
            <div>
              <Label>Client</Label>
              <select value={clientId} onChange={e => setClientId(e.target.value)} style={{ width:'100%', ...inputStyle }}>
                <option value="">No client</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {/* Issue date */}
            <div>
              <Label>Issue date</Label>
              <input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)}
                style={{ width: '100%', ...inputStyle, colorScheme: 'light dark' }}/>
            </div>

            {/* Due date */}
            <div>
              <Label>Due date</Label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                style={{ width: '100%', ...inputStyle, colorScheme: 'light dark' }}/>
            </div>

            {/* GSTIN */}
            <div>
              <Label>GSTIN <span style={{ fontWeight: 400, opacity: 0.5 }}>(optional)</span></Label>
              <input value={gstin} onChange={e => setGstin(e.target.value.toUpperCase())}
                placeholder="22AAAAA0000A1Z5" maxLength={15}
                style={{ width: '100%', ...inputStyle }}/>
            </div>
          </div>

          {/* Line items */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Label style={{ marginBottom: 0 }}>Line items</Label>
              {clientId && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {loadingTasks && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Loading tasks…</span>}
                  {!loadingTasks && unbilledTasks.length > 0 && (
                    <select
                      onChange={e => {
                        const t = unbilledTasks.find(t => t.id === e.target.value)
                        if (t) addFromTask(t)
                        e.target.value = ''
                      }}
                      defaultValue=""
                      style={{ ...inputStyle, fontSize: 11, padding: '3px 8px' }}>
                      <option value="" disabled>＋ Add from billable tasks ({unbilledTasks.length})</option>
                      {unbilledTasks.map((t: any) => (
                        <option key={t.id} value={t.id}>
                          {t.title}{t.billable_amount ? ` — ₹${t.billable_amount}` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>

            {/* Items table header */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 100px 30px',
              gap: 8, padding: '4px 8px', marginBottom: 2 }}>
              {['Description', 'Qty', 'Unit price', ''].map(h => (
                <span key={h} style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {items.map((it, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 100px 30px',
                  gap: 8, alignItems: 'center',
                  padding: '6px 8px', borderRadius: 8,
                  background: 'var(--surface-subtle)',
                  border: '1px solid var(--border)' }}>
                  <input value={it.desc} onChange={e => updateItem(i, 'desc', e.target.value)}
                    placeholder="Description"
                    style={{ fontSize: 13, border: 'none', outline: 'none', background: 'transparent',
                      color: 'var(--text-primary)', fontFamily: 'inherit' }}/>
                  <input type="number" min="0" step="1" value={it.qty}
                    onChange={e => updateItem(i, 'qty', Number(e.target.value) || 0)}
                    style={{ fontSize: 13, border: 'none', outline: 'none', background: 'transparent',
                      color: 'var(--text-primary)', fontFamily: 'inherit', textAlign: 'right', width: '100%' }}/>
                  <input type="number" min="0" step="0.01" value={it.price}
                    onChange={e => updateItem(i, 'price', Number(e.target.value) || 0)}
                    style={{ fontSize: 13, border: 'none', outline: 'none', background: 'transparent',
                      color: 'var(--text-primary)', fontFamily: 'inherit', textAlign: 'right', width: '100%' }}/>
                  <button onClick={() => removeItem(i)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text-muted)', display: 'flex', padding: 2 }}>
                    <X style={{ width: 12, height: 12 }}/>
                  </button>
                </div>
              ))}
            </div>

            <button onClick={addItem}
              style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8,
                padding: '5px 12px', borderRadius: 20,
                border: '1px dashed var(--border)', background: 'transparent',
                color: 'var(--brand)', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
              <Plus style={{ width: 12, height: 12 }}/> Add line item
            </button>
          </div>

          {/* Tax & discount */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
            <div>
              <Label>GST rate (%)</Label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {[0, 5, 12, 18, 28].map(r => (
                  <button key={r} onClick={() => setGstRate(r)}
                    style={{ padding: '3px 10px', borderRadius: 20, cursor: 'pointer',
                      border: gstRate === r ? '1.5px solid var(--brand)' : '1px solid var(--border)',
                      background: gstRate === r ? 'var(--brand-light)' : 'var(--surface-subtle)',
                      color: gstRate === r ? 'var(--brand)' : 'var(--text-secondary)',
                      fontSize: 12, fontWeight: gstRate === r ? 700 : 400 }}>
                    {r}%
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Discount (₹)</Label>
              <input type="number" min="0" step="0.01" value={discountAmount}
                onChange={e => setDiscountAmount(Number(e.target.value) || 0)}
                style={{ width: '100%', ...inputStyle }}/>
            </div>
          </div>

          {/* Notes */}
          <div style={{ marginBottom: 16 }}>
            <Label>Notes <span style={{ fontWeight: 400, opacity: 0.5 }}>(optional)</span></Label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              rows={2} placeholder="Payment terms, bank details, thank-you note…"
              style={{ width: '100%', ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}/>
          </div>

          {/* Totals summary */}
          <div style={{
            background: 'var(--surface-subtle)', borderRadius: 10,
            border: '1px solid var(--border)', padding: '12px 16px',
            display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            <TotalRow label="Subtotal"   value={fmt(subtotal)}/>
            {gstRate > 0 && <TotalRow label={`GST (${gstRate}%)`} value={`+ ${fmt(gst_amount)}`}/>}
            {discountAmount > 0 && <TotalRow label="Discount" value={`− ${fmt(discountAmount)}`}/>}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 6, marginTop: 2 }}>
              <TotalRow label="Total" value={fmt(total)} bold/>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0 }}>
          <button onClick={onClose}
            style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid var(--border)',
              background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={save} disabled={saving}
            style={{ padding: '7px 18px', borderRadius: 8, border: 'none',
              background: 'var(--brand)', color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create invoice'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Invoice detail drawer ─────────────────────────────────────────────────────

function InvoiceDrawer({ invoiceId, clients, canManage, onClose, onUpdated }: {
  invoiceId: string
  clients:   Client[]
  canManage: boolean
  onClose:   () => void
  onUpdated: (inv: any) => void
}) {
  const [invoice, setInvoice] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/invoices/${invoiceId}`)
      .then(r => r.json())
      .then(d => setInvoice(d.data ?? null))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [invoiceId])

  useEffect(() => { load() }, [load])

  async function setStatus(status: string) {
    const res = await fetch(`/api/invoices/${invoiceId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    const d = await res.json()
    if (!res.ok) { toast.error(d.error ?? 'Failed'); return }
    const updated = { ...invoice, status }
    setInvoice(updated)
    onUpdated(updated)
    toast.success(`Marked as ${status}`)
  }

  if (loading) return (
    <DrawerShell onClose={onClose}>
      <div style={{ display:'flex',alignItems:'center',justifyContent:'center',padding:'60px 0',color:'var(--text-muted)',fontSize:13 }}>
        Loading…
      </div>
    </DrawerShell>
  )

  if (!invoice) return (
    <DrawerShell onClose={onClose}>
      <p style={{ color:'var(--text-muted)', padding:'40px 20px', textAlign:'center' }}>Invoice not found.</p>
    </DrawerShell>
  )

  const cfg = STATUS_CFG[invoice.status as InvoiceStatus] ?? STATUS_CFG.draft
  const items: any[] = invoice.items ?? []

  return (
    <>
    <DrawerShell onClose={onClose}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
          <Receipt style={{ width:16, height:16, color:'var(--brand)' }}/>
          <span style={{ fontSize:12, color:'var(--text-muted)', fontWeight:500 }}>{invoice.invoice_number}</span>
          <span style={{ fontSize:11, fontWeight:700, padding:'2px 9px', borderRadius:99,
            background: cfg.bg, color: cfg.color, border:`1px solid ${cfg.color}33` }}>
            {cfg.label}
          </span>
        </div>
        <h2 style={{ fontSize:16, fontWeight:700, color:'var(--text-primary)', lineHeight:1.3 }}>
          {invoice.title}
        </h2>
        {invoice.client && (
          <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:6 }}>
            <div style={{ width:8, height:8, borderRadius:2, background:invoice.client.color }}/>
            <span style={{ fontSize:12, color:'var(--text-secondary)' }}>{invoice.client.name}</span>
          </div>
        )}
      </div>

      {/* Scrollable body */}
      <div style={{ flex:1, overflowY:'auto', padding:'16px 20px' }}>

        {/* Dates */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
          <InfoCard label="Issue date" value={invoice.issue_date ?? '—'}/>
          <InfoCard label="Due date"   value={invoice.due_date   ?? '—'}/>
          {invoice.gstin && <InfoCard label="GSTIN" value={invoice.gstin} style={{ gridColumn:'1/-1' }}/>}
        </div>

        {/* Line items */}
        <p style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase',
          letterSpacing:'0.06em', marginBottom:8 }}>Line items</p>
        <div style={{ borderRadius:8, border:'1px solid var(--border)', overflow:'hidden', marginBottom:16 }}>
          {items.length === 0 && (
            <p style={{ padding:'16px', fontSize:12, color:'var(--text-muted)', textAlign:'center' }}>No items</p>
          )}
          {items.map((it: any, i: number) => (
            <div key={it.id ?? i} style={{
              display:'grid', gridTemplateColumns:'1fr auto auto auto',
              gap:12, padding:'10px 14px', fontSize:12,
              borderTop: i > 0 ? '1px solid var(--border-light)' : 'none',
              alignItems:'center',
            }}>
              <span style={{ color:'var(--text-primary)', fontWeight:500 }}>{it.description}</span>
              <span style={{ color:'var(--text-muted)', textAlign:'right' }}>×{it.quantity}</span>
              <span style={{ color:'var(--text-secondary)', textAlign:'right' }}>{fmt(it.unit_price)}</span>
              <span style={{ color:'var(--text-primary)', fontWeight:600, textAlign:'right' }}>{fmt(it.amount)}</span>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div style={{ background:'var(--surface-subtle)', borderRadius:10,
          border:'1px solid var(--border)', padding:'12px 16px',
          display:'flex', flexDirection:'column', gap:6, marginBottom:16 }}>
          <TotalRow label="Subtotal" value={fmt(invoice.subtotal)}/>
          {invoice.gst_rate > 0 && (
            <TotalRow label={`GST (${invoice.gst_rate}%)`} value={`+ ${fmt(invoice.gst_amount)}`}/>
          )}
          {invoice.discount_amount > 0 && (
            <TotalRow label="Discount" value={`− ${fmt(invoice.discount_amount)}`}/>
          )}
          <div style={{ borderTop:'1px solid var(--border)', paddingTop:6, marginTop:2 }}>
            <TotalRow label="Total" value={fmt(invoice.total)} bold/>
          </div>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div style={{ padding:'12px 14px', borderRadius:8, background:'var(--surface-subtle)',
            border:'1px solid var(--border)', fontSize:12, color:'var(--text-secondary)', lineHeight:1.6 }}>
            {invoice.notes}
          </div>
        )}
      </div>

      {/* Footer actions */}
      {canManage && (
        <div style={{ padding:'14px 20px', borderTop:'1px solid var(--border)', flexShrink:0,
          display:'flex', gap:8, flexWrap:'wrap' }}>
          {invoice.status === 'draft' && (
            <ActionBtn onClick={() => setStatus('sent')} icon={<Send style={{ width:13, height:13 }}/>} label="Mark sent"/>
          )}
          {invoice.status === 'sent' && (
            <ActionBtn onClick={() => setStatus('paid')} icon={<Check style={{ width:13, height:13 }}/>} label="Mark paid" accent/>
          )}
          {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
            <ActionBtn onClick={() => setStatus('cancelled')} icon={<X style={{ width:13, height:13 }}/>} label="Cancel"/>
          )}
          <ActionBtn onClick={() => setEditing(true)} icon={<Edit3 style={{ width:13, height:13 }}/>} label="Edit"/>
        </div>
      )}
    </DrawerShell>

    {editing && (
      <InvoiceModal
        clients={clients}
        invoice={{ ...invoice, items: invoice.items }}
        onClose={() => setEditing(false)}
        onSaved={updated => { setInvoice({ ...invoice, ...updated }); onUpdated({ ...invoice, ...updated }); setEditing(false) }}
      />
    )}
    </>
  )
}

function DrawerShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 150,
      background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(1px)',
      display: 'flex', justifyContent: 'flex-end',
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        width: '100%', maxWidth: 480, background: 'var(--surface)',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.15)',
        display: 'flex', flexDirection: 'column', height: '100%',
        animation: 'slideInRight 0.2s ease',
      }}>
        <style>{`@keyframes slideInRight { from { transform: translateX(40px); opacity:0 } to { transform: translateX(0); opacity:1 } }`}</style>
        <div style={{ padding: '14px 20px', borderBottom:'1px solid var(--border)',
          display:'flex', alignItems:'center', justifyContent:'flex-end', flexShrink:0 }}>
          <button onClick={onClose}
            style={{ background:'none', border:'none', cursor:'pointer',
              color:'var(--text-muted)', display:'flex', padding:4, borderRadius:6 }}>
            <X style={{ width:16, height:16 }}/>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Main view ───────────────────────────────────────────────────────────────���─

export function InvoicesView({ invoices: initialInvoices, clients, canManage }: Props) {
  const [invoices,    setInvoices]    = useState<any[]>(initialInvoices)
  const [showCreate,  setShowCreate]  = useState(false)
  const [viewId,      setViewId]      = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterClient, setFilterClient] = useState<string>('all')
  const [search,      setSearch]      = useState('')

  // Summary stats
  const totalAll      = invoices.reduce((s, inv) => s + Number(inv.total ?? 0), 0)
  const totalPaid     = invoices.filter(i => i.status === 'paid').reduce((s, inv) => s + Number(inv.total ?? 0), 0)
  const totalPending  = invoices.filter(i => i.status === 'sent').reduce((s, inv) => s + Number(inv.total ?? 0), 0)
  const totalDraft    = invoices.filter(i => i.status === 'draft').reduce((s, inv) => s + Number(inv.total ?? 0), 0)

  // Filtered list
  const filtered = invoices.filter(inv => {
    if (filterStatus !== 'all' && inv.status !== filterStatus) return false
    if (filterClient !== 'all' && (inv.client_id ?? '') !== filterClient) return false
    if (search) {
      const q = search.toLowerCase()
      if (!inv.title.toLowerCase().includes(q) &&
          !inv.invoice_number.toLowerCase().includes(q) &&
          !(inv.client?.name ?? '').toLowerCase().includes(q)) return false
    }
    return true
  })

  function onSaved(inv: any) {
    setInvoices(prev => {
      const idx = prev.findIndex(i => i.id === inv.id)
      if (idx >= 0) { const next = [...prev]; next[idx] = { ...prev[idx], ...inv }; return next }
      return [inv, ...prev]
    })
    setShowCreate(false)
    setViewId(inv.id)
  }

  function onUpdated(inv: any) {
    setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, ...inv } : i))
  }

  return (
    <div style={{ padding: '24px', flex: 1 }}>

      {/* Page header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <Receipt style={{ width:22, height:22, color:'var(--brand)' }}/>
          <h1 style={{ fontSize:20, fontWeight:800, color:'var(--text-primary)' }}>Invoices</h1>
        </div>
        {canManage && (
          <button onClick={() => setShowCreate(true)}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 16px', borderRadius:8,
              background:'var(--brand)', color:'#fff', border:'none', fontSize:13, fontWeight:600,
              cursor:'pointer' }}>
            <Plus style={{ width:14, height:14 }}/> New invoice
          </button>
        )}
      </div>

      {/* Summary cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:24 }}>
        {[
          { label:'All invoices', value: fmt(totalAll),     color:'var(--brand)',  count: invoices.length },
          { label:'Draft',        value: fmt(totalDraft),   color:'#64748b',       count: invoices.filter(i=>i.status==='draft').length },
          { label:'Sent',         value: fmt(totalPending), color:'#0d9488',       count: invoices.filter(i=>i.status==='sent').length },
          { label:'Paid',         value: fmt(totalPaid),    color:'#16a34a',       count: invoices.filter(i=>i.status==='paid').length },
        ].map(card => (
          <div key={card.label} style={{
            padding:'14px 16px', borderRadius:10,
            background:'var(--surface)', border:'1px solid var(--border)',
          }}>
            <p style={{ fontSize:11, fontWeight:600, color:'var(--text-muted)',
              textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>
              {card.label} <span style={{ fontWeight:400, opacity:0.6 }}>({card.count})</span>
            </p>
            <p style={{ fontSize:18, fontWeight:800, color: card.color }}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16, flexWrap:'wrap' }}>
        {/* Search */}
        <div style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 12px',
          border:'1px solid var(--border)', borderRadius:8, background:'var(--surface)', flex:1, minWidth:180, maxWidth:300 }}>
          <Search style={{ width:13, height:13, color:'var(--text-muted)', flexShrink:0 }}/>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search invoices…"
            style={{ flex:1, border:'none', outline:'none', background:'transparent',
              fontSize:12, color:'var(--text-primary)', fontFamily:'inherit' }}/>
        </div>

        {/* Status filter */}
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ ...inputStyle, fontSize:12, padding:'5px 10px', width:'auto', minWidth:110 }}>
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="paid">Paid</option>
          <option value="cancelled">Cancelled</option>
        </select>

        {/* Client filter */}
        {clients.length > 0 && (
          <select value={filterClient} onChange={e => setFilterClient(e.target.value)}
            style={{ ...inputStyle, fontSize:12, padding:'5px 10px', width:'auto', minWidth:130 }}>
            <option value="all">All clients</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </div>

      {/* Invoice list */}
      {filtered.length === 0 ? (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
          padding:'60px 20px', color:'var(--text-muted)' }}>
          <Receipt style={{ width:40, height:40, opacity:0.2, marginBottom:12 }}/>
          <p style={{ fontSize:14, fontWeight:500, marginBottom:4 }}>
            {invoices.length === 0 ? 'No invoices yet' : 'No invoices match your filters'}
          </p>
          {invoices.length === 0 && canManage && (
            <button onClick={() => setShowCreate(true)}
              style={{ marginTop:12, padding:'7px 16px', borderRadius:8, border:'none',
                background:'var(--brand)', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>
              Create first invoice
            </button>
          )}
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {filtered.map(inv => {
            const cfg = STATUS_CFG[inv.status as InvoiceStatus] ?? STATUS_CFG.draft
            return (
              <div key={inv.id}
                onClick={() => setViewId(inv.id)}
                style={{
                  display:'grid', gridTemplateColumns:'1fr auto auto auto',
                  gap:16, alignItems:'center',
                  padding:'12px 16px', borderRadius:10, cursor:'pointer',
                  background:'var(--surface)', border:'1px solid var(--border)',
                  transition:'border-color 0.12s, box-shadow 0.12s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--brand-border)'
                  ;(e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(13,148,136,0.08)'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
                  ;(e.currentTarget as HTMLElement).style.boxShadow = 'none'
                }}>

                {/* Left: number + title + client */}
                <div style={{ minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                    <span style={{ fontSize:11, color:'var(--text-muted)', fontWeight:500, flexShrink:0 }}>
                      {inv.invoice_number}
                    </span>
                    {inv.client && (
                      <>
                        <span style={{ color:'var(--border)', fontSize:10 }}>·</span>
                        <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                          <div style={{ width:6, height:6, borderRadius:2, background:inv.client.color, flexShrink:0 }}/>
                          <span style={{ fontSize:11, color:'var(--text-secondary)',
                            overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
                            {inv.client.name}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                  <p style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)',
                    overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
                    {inv.title}
                  </p>
                </div>

                {/* Issue date */}
                <span style={{ fontSize:12, color:'var(--text-muted)', flexShrink:0 }}>
                  {inv.issue_date}
                </span>

                {/* Status badge */}
                <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:99,
                  background:cfg.bg, color:cfg.color, border:`1px solid ${cfg.color}33`, flexShrink:0 }}>
                  {cfg.label}
                </span>

                {/* Total */}
                <span style={{ fontSize:14, fontWeight:800, color:'var(--text-primary)', flexShrink:0 }}>
                  {fmt(inv.total)}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <InvoiceModal clients={clients} onClose={() => setShowCreate(false)} onSaved={onSaved}/>
      )}

      {/* Detail drawer */}
      {viewId && (
        <InvoiceDrawer
          invoiceId={viewId}
          clients={clients}
          canManage={canManage}
          onClose={() => setViewId(null)}
          onUpdated={onUpdated}
        />
      )}
    </div>
  )
}

// ── Small reusable sub-components ─────────────────────────────────────────────

function Label({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
      textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5, ...style }}>
      {children}
    </p>
  )
}

function TotalRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: bold ? 700 : 400 }}>{label}</span>
      <span style={{ fontSize: bold ? 15 : 12, fontWeight: bold ? 800 : 500, color: bold ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
        {value}
      </span>
    </div>
  )
}

function InfoCard({ label, value, style }: { label: string; value: string; style?: React.CSSProperties }) {
  return (
    <div style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--surface-subtle)',
      border: '1px solid var(--border)', ...style }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{label}</p>
      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{value}</p>
    </div>
  )
}

function ActionBtn({ onClick, icon, label, accent }: {
  onClick: () => void; icon: React.ReactNode; label: string; accent?: boolean
}) {
  return (
    <button onClick={onClick}
      style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px', borderRadius:8,
        border: accent ? 'none' : '1px solid var(--border)',
        background: accent ? '#16a34a' : 'var(--surface-subtle)',
        color: accent ? '#fff' : 'var(--text-secondary)',
        fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
      {icon}{label}
    </button>
  )
}

const inputStyle: React.CSSProperties = {
  fontSize: 13, padding: '7px 10px', borderRadius: 8,
  border: '1px solid var(--border)', outline: 'none',
  background: 'var(--surface-subtle)', color: 'var(--text-primary)',
  fontFamily: 'inherit',
}
