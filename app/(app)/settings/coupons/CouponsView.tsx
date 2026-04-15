'use client'
import { useState } from 'react'
import {
  Plus, Copy, Check, Trash2, ToggleLeft, ToggleRight, Tag,
  Percent, Gift, X, Search, RefreshCw,
} from 'lucide-react'
import { toast } from '@/store/appStore'

/* ─── Types ────────────────────────────────────────────────────── */
interface CouponRedemptionCount {
  count: number
}

interface Coupon {
  id:                  string
  code:                string
  description:         string | null
  discount_type:       'free_plan' | 'percent' | 'fixed_inr'
  discount_percent:    number | null
  discount_inr:        number | null
  plan_tier:           string | null
  duration_months:     number
  max_uses:            number | null
  uses_count:          number
  expires_at:          string | null
  is_active:           boolean
  created_at:          string
  coupon_redemptions?: CouponRedemptionCount[]
}

interface Props { initialCoupons: Coupon[] }

/* ─── Helpers ──────────────────────────────────────────────────── */
const PLAN_COLORS: Record<string, { bg: string; color: string }> = {
  free:     { bg: '#f1f5f9', color: '#64748b' },
  starter:  { bg: '#f0fdfa', color: '#0d9488' },
  pro:      { bg: '#f5f3ff', color: '#7c3aed' },
  business: { bg: '#ecfeff', color: '#0891b2' },
}

type DiscountType = 'free_plan' | 'percent' | 'fixed_inr'

const TYPE_META: Record<DiscountType, { label: string; icon: React.ElementType; bg: string; color: string }> = {
  free_plan:  { label: 'Free plan',  icon: Gift,    bg: '#f0fdf4', color: '#16a34a' },
  percent:    { label: '% Discount', icon: Percent,  bg: '#fff7ed', color: '#ea580c' },
  fixed_inr:  { label: '₹ Off',      icon: Tag,      bg: '#fdf2f8', color: '#db2777' },
}

function fmt(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function isExpired(iso: string | null): boolean {
  return iso ? new Date(iso) < new Date() : false
}

/* ─── Blank form state ─────────────────────────────────────────── */
interface FormState {
  code:             string
  description:      string
  discount_type:    DiscountType
  discount_percent: number
  plan_tier:        string
  duration_months:  number | string
  max_uses:         number | string
  expires_at:       string
  is_active:        boolean
}

const BLANK: FormState = {
  code:             '',
  description:      '',
  discount_type:    'free_plan',
  discount_percent: 50,
  plan_tier:        'pro',
  duration_months:  3,
  max_uses:         '',
  expires_at:       '',
  is_active:        true,
}

/* ─── Component ────────────────────────────────────────────────── */
export function CouponsView({ initialCoupons }: Props) {
  const [coupons,    setCoupons]    = useState<Coupon[]>(initialCoupons)
  const [search,     setSearch]     = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [showCreate, setShowCreate] = useState(false)
  const [form,       setForm]       = useState<FormState>({ ...BLANK })
  const [saving,     setSaving]     = useState(false)
  const [copied,     setCopied]     = useState<string | null>(null)
  const [deleting,   setDeleting]   = useState<string | null>(null)

  /* ── Derived ── */
  const filtered = coupons.filter(c => {
    if (
      search &&
      !c.code.toLowerCase().includes(search.toLowerCase()) &&
      !(c.description ?? '').toLowerCase().includes(search.toLowerCase())
    ) return false
    if (filterType !== 'all' && c.discount_type !== filterType) return false
    return true
  })

  const stats = {
    total:     coupons.length,
    active:    coupons.filter(c => c.is_active).length,
    freePlan:  coupons.filter(c => c.discount_type === 'free_plan').length,
    percent:   coupons.filter(c => c.discount_type === 'percent').length,
    totalUses: coupons.reduce((s, c) => s + (c.uses_count ?? 0), 0),
  }

  /* ── Copy code ── */
  function copyCode(code: string) {
    navigator.clipboard.writeText(code).catch(() => {})
    setCopied(code)
    setTimeout(() => setCopied(null), 1800)
  }

  /* ── Toggle active ── */
  async function toggleActive(c: Coupon) {
    // Optimistic
    setCoupons(cs => cs.map(x => x.id === c.id ? { ...x, is_active: !x.is_active } : x))
    const res = await fetch(`/api/admin/coupons/${c.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ is_active: !c.is_active }),
    })
    if (!res.ok) {
      setCoupons(cs => cs.map(x => x.id === c.id ? { ...x, is_active: c.is_active } : x))
      toast.error('Failed to update coupon')
    } else {
      toast.success(c.is_active ? 'Coupon deactivated' : 'Coupon activated')
    }
  }

  /* ── Delete ── */
  async function deleteCoupon(id: string) {
    setDeleting(id)
    const res = await fetch(`/api/admin/coupons/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setCoupons(cs => cs.filter(c => c.id !== id))
      toast.success('Coupon deleted')
    } else {
      toast.error('Failed to delete coupon')
    }
    setDeleting(null)
  }

  /* ── Create ── */
  async function createCoupon() {
    if (!form.code.trim()) { toast.error('Coupon code is required'); return }
    setSaving(true)

    const body: Record<string, unknown> = {
      code:            form.code.trim().toUpperCase(),
      description:     form.description.trim() || null,
      discount_type:   form.discount_type,
      duration_months: Number(form.duration_months) || 1,
      max_uses:        form.max_uses ? Number(form.max_uses) : null,
      expires_at:      form.expires_at || null,
      is_active:       form.is_active,
    }
    if (form.discount_type === 'free_plan') {
      body.plan_tier = form.plan_tier
    } else if (form.discount_type === 'percent') {
      body.discount_percent = Number(form.discount_percent)
    }

    const res = await fetch('/api/admin/coupons', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    })
    const d = await res.json() as { data?: Coupon; error?: string }
    if (res.ok && d.data) {
      setCoupons(cs => [{ ...d.data!, coupon_redemptions: [] }, ...cs])
      setForm({ ...BLANK })
      setShowCreate(false)
      toast.success(`Coupon "${d.data.code}" created!`)
    } else {
      toast.error(d.error ?? 'Failed to create coupon')
    }
    setSaving(false)
  }

  /* ── Reload ── */
  async function reload() {
    const res = await fetch('/api/admin/coupons')
    const d = await res.json() as { data?: Coupon[] }
    if (d.data) setCoupons(d.data)
  }

  function setF<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  /* ── RENDER ── */
  return (
    <div className="page-container" style={{ maxWidth: 1100 }}>

      {/* ── Page header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Coupon Management</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Create and manage discount codes for billing</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={reload}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}
          >
            <RefreshCw style={{ width: 14, height: 14 }} /> Refresh
          </button>
          <button
            onClick={() => setShowCreate(true)}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--brand)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}
          >
            <Plus style={{ width: 14, height: 14 }} /> New coupon
          </button>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
        {([
          { label: 'Total coupons',  value: stats.total,     color: '#64748b' },
          { label: 'Active',         value: stats.active,    color: '#16a34a' },
          { label: 'Free-plan',      value: stats.freePlan,  color: '#7c3aed' },
          { label: '% Discount',     value: stats.percent,   color: '#ea580c' },
          { label: 'Total redeemed', value: stats.totalUses, color: '#0891b2' },
        ] as const).map(s => (
          <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>{s.label}</p>
            <p style={{ fontSize: 26, fontWeight: 800, color: s.color, margin: '4px 0 0' }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--text-muted)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search code or description…"
            style={{ width: '100%', padding: '8px 12px 8px 32px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--surface)', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }}
            onFocus={e => { e.target.style.borderColor = 'var(--brand)' }}
            onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
          />
        </div>
        {(['all', 'free_plan', 'percent', 'fixed_inr'] as const).map(t => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            style={{ padding: '7px 14px', borderRadius: 8, border: `1.5px solid ${filterType === t ? 'var(--brand)' : 'var(--border)'}`, background: filterType === t ? 'var(--brand-light)' : 'var(--surface)', color: filterType === t ? 'var(--brand)' : 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
          >
            {t === 'all' ? 'All' : t === 'free_plan' ? 'Free plan' : t === 'percent' ? '% Discount' : '₹ Discount'}
          </button>
        ))}
      </div>

      {/* ── Table ── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 110px 90px 110px 90px 90px 90px', gap: 0, padding: '10px 16px', background: 'var(--surface-alt)', borderBottom: '1px solid var(--border)' }}>
          {['Code', 'Description / Value', 'Type', 'Plan', 'Uses', 'Expires', 'Status', 'Actions'].map(h => (
            <span key={h} style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
          ))}
        </div>

        {filtered.length === 0 && (
          <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
            No coupons found
          </div>
        )}

        {filtered.map((c, i) => {
          const tm = TYPE_META[c.discount_type]
          const TypeIcon = tm.icon
          const pc = c.plan_tier ? PLAN_COLORS[c.plan_tier] : null
          const expired = isExpired(c.expires_at)

          return (
            <div
              key={c.id}
              style={{
                display:    'grid',
                gridTemplateColumns: '160px 1fr 110px 90px 110px 90px 90px 90px',
                gap:        0,
                padding:    '13px 16px',
                alignItems: 'center',
                borderBottom: i < filtered.length - 1 ? '1px solid var(--border-light)' : 'none',
                background: !c.is_active ? 'var(--surface-subtle)' : 'transparent',
                opacity:    !c.is_active ? 0.65 : 1,
                transition: 'background 0.1s',
              }}
            >
              {/* Code */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <code style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', background: 'var(--surface-alt)', padding: '2px 7px', borderRadius: 5, letterSpacing: '0.04em', fontFamily: 'monospace' }}>
                  {c.code}
                </code>
                <button
                  onClick={() => copyCode(c.code)}
                  title="Copy code"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
                >
                  {copied === c.code
                    ? <Check style={{ width: 12, height: 12, color: '#16a34a' }} />
                    : <Copy style={{ width: 12, height: 12 }} />}
                </button>
              </div>

              {/* Description / value */}
              <div>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>
                  {c.description || '—'}
                </p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '1px 0 0' }}>
                  {c.discount_type === 'free_plan'
                    ? `${c.duration_months} month${c.duration_months !== 1 ? 's' : ''} free`
                    : c.discount_type === 'percent'
                    ? `${c.discount_percent}% off`
                    : `₹${c.discount_inr} off`}
                </p>
              </div>

              {/* Type */}
              <div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, background: tm.bg, color: tm.color }}>
                  <TypeIcon style={{ width: 10, height: 10 }} /> {tm.label}
                </span>
              </div>

              {/* Plan tier */}
              <div>
                {pc && c.plan_tier ? (
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: pc.bg, color: pc.color, textTransform: 'capitalize' }}>
                    {c.plan_tier}
                  </span>
                ) : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>}
              </div>

              {/* Uses */}
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.uses_count}</span>
                {c.max_uses ? ` / ${c.max_uses}` : ' / ∞'}
                {c.max_uses !== null && c.uses_count >= c.max_uses && (
                  <span style={{ display: 'block', fontSize: 10, color: '#dc2626', fontWeight: 600 }}>Limit reached</span>
                )}
              </div>

              {/* Expires */}
              <div style={{ fontSize: 11, color: expired ? '#dc2626' : 'var(--text-muted)' }}>
                {expired && c.expires_at ? '⚠ ' : ''}{fmt(c.expires_at)}
              </div>

              {/* Status toggle */}
              <div>
                <button
                  onClick={() => toggleActive(c)}
                  title={c.is_active ? 'Click to deactivate' : 'Click to activate'}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  {c.is_active
                    ? <><ToggleRight style={{ width: 22, height: 22, color: '#16a34a' }} /><span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>Active</span></>
                    : <><ToggleLeft style={{ width: 22, height: 22, color: '#94a3b8' }} /><span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Off</span></>}
                </button>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  onClick={() => { if (confirm(`Delete coupon "${c.code}"?`)) void deleteCoupon(c.id) }}
                  disabled={deleting === c.id}
                  title="Delete coupon"
                  style={{ padding: '5px 7px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', color: '#dc2626', display: 'flex', alignItems: 'center', opacity: deleting === c.id ? 0.5 : 1 }}
                >
                  <Trash2 style={{ width: 13, height: 13 }} />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Create coupon modal ── */}
      {showCreate && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) setShowCreate(false) }}
        >
          <div style={{ background: 'var(--surface)', borderRadius: 16, padding: '28px', width: '100%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Create Coupon</h2>
              <button
                onClick={() => setShowCreate(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 6 }}
              >
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Code */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Coupon code *</label>
                <input
                  value={form.code}
                  onChange={e => setF('code', e.target.value.toUpperCase())}
                  placeholder="e.g. SUMMER50"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--surface)', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box', fontFamily: 'monospace', letterSpacing: '0.05em', fontWeight: 600 }}
                  onFocus={e => { e.target.style.borderColor = 'var(--brand)' }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
                />
              </div>

              {/* Description */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Description</label>
                <input
                  value={form.description}
                  onChange={e => setF('description', e.target.value)}
                  placeholder="e.g. 50% off for CA firms"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--surface)', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }}
                  onFocus={e => { e.target.style.borderColor = 'var(--brand)' }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
                />
              </div>

              {/* Type */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Discount type *</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {(['free_plan', 'percent', 'fixed_inr'] as const).map(t => {
                    const tm = TYPE_META[t]
                    const TypeIcon = tm.icon
                    return (
                      <button
                        key={t}
                        onClick={() => setF('discount_type', t)}
                        style={{ padding: '10px 8px', borderRadius: 8, border: `2px solid ${form.discount_type === t ? tm.color : 'var(--border)'}`, background: form.discount_type === t ? tm.bg : 'var(--surface)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
                      >
                        <TypeIcon style={{ width: 16, height: 16, color: tm.color }} />
                        <span style={{ fontSize: 11, fontWeight: 600, color: form.discount_type === t ? tm.color : 'var(--text-muted)' }}>{tm.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Conditional fields */}
              {form.discount_type === 'free_plan' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Plan tier *</label>
                    <select
                      value={form.plan_tier}
                      onChange={e => setF('plan_tier', e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--surface)', fontSize: 13, color: 'var(--text-primary)', outline: 'none' }}
                    >
                      <option value="starter">Starter</option>
                      <option value="pro">Pro</option>
                      <option value="business">Business</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Duration (months) *</label>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={form.duration_months}
                      onChange={e => setF('duration_months', e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--surface)', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }}
                      onFocus={e => { e.target.style.borderColor = 'var(--brand)' }}
                      onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
                    />
                  </div>
                </div>
              )}

              {form.discount_type === 'percent' && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Discount % *</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={form.discount_percent}
                    onChange={e => setF('discount_percent', Number(e.target.value))}
                    placeholder="e.g. 50"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--surface)', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }}
                    onFocus={e => { e.target.style.borderColor = 'var(--brand)' }}
                    onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
                  />
                </div>
              )}

              {/* Max uses + expiry */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Max uses (blank = unlimited)</label>
                  <input
                    type="number"
                    min={1}
                    value={form.max_uses}
                    onChange={e => setF('max_uses', e.target.value)}
                    placeholder="e.g. 100"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--surface)', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }}
                    onFocus={e => { e.target.style.borderColor = 'var(--brand)' }}
                    onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Expires on (optional)</label>
                  <input
                    type="date"
                    value={form.expires_at}
                    onChange={e => setF('expires_at', e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--surface)', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }}
                    onFocus={e => { e.target.style.borderColor = 'var(--brand)' }}
                    onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
                  />
                </div>
              </div>

              {/* Active toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  onClick={() => setF('is_active', !form.is_active)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                >
                  {form.is_active
                    ? <ToggleRight style={{ width: 28, height: 28, color: '#16a34a' }} />
                    : <ToggleLeft style={{ width: 28, height: 28, color: '#94a3b8' }} />}
                </button>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>
                  {form.is_active ? 'Active — users can redeem this coupon' : 'Inactive — coupon is disabled'}
                </span>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button
                  onClick={() => void createCoupon()}
                  disabled={saving}
                  style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', background: 'var(--brand)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
                >
                  {saving ? 'Creating…' : 'Create coupon'}
                </button>
                <button
                  onClick={() => { setShowCreate(false); setForm({ ...BLANK }) }}
                  style={{ padding: '10px 18px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
