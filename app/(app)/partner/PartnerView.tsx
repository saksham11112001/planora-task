'use client'
import { useEffect, useState, useCallback } from 'react'
import { useAppStore, toast } from '@/store/appStore'
import {
  Copy, Check, Users, TrendingUp, IndianRupee, Clock,
  Award, ChevronRight, Download, Building2, RefreshCw,
  BadgeCheck, Wallet, AlertCircle, QrCode, ExternalLink,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────
interface ReferredOrg {
  org_id:    string
  name:      string
  plan_tier: string
  status:    string
  joined_at: string
  is_paying: boolean
}

interface Commission {
  id:               string
  referred_org_id:  string
  event:            string
  plan_tier:        string
  commission_paise: number
  status:           string
  created_at:       string
}

interface Payout {
  id:           string
  amount_paise: number
  status:       string
  created_at:   string
  processed_at: string | null
}

interface PartnerData {
  referral_code: string
  referral_link: string
  tier:          'bronze' | 'silver' | 'gold'
  rate_percent:  number
  next_tier:     { name: string; at: number; current: number } | null
  stats: {
    total_referred:      number
    active_referred:     number
    paying_referred:     number
    total_earned_paise:  number
    pending_paise:       number
    this_month_paise:    number
  }
  referred:     ReferredOrg[]
  commissions:  Commission[]
  payouts:      Payout[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const TIER_COLORS = {
  bronze: { bg: '#fef3c7', text: '#92400e', border: '#f59e0b' },
  silver: { bg: '#f1f5f9', text: '#334155', border: '#94a3b8' },
  gold:   { bg: '#fefce8', text: '#854d0e', border: '#eab308' },
}

const PLAN_LABELS: Record<string, string> = {
  free:     'Free',
  starter:  'Starter',
  pro:      'Pro',
  business: 'Business',
}

const STATUS_COLORS: Record<string, string> = {
  active:   '#16a34a',
  trialing: '#2563eb',
  past_due: '#dc2626',
  cancelled:'#94a3b8',
}

function rupees(paise: number) {
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Component ─────────────────────────────────────────────────────────────────
export function PartnerView() {
  const org = useAppStore(s => s.session?.org)

  const [data,    setData]    = useState<PartnerData | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied,  setCopied]  = useState(false)

  // Payout form
  const [showPayout,   setShowPayout]   = useState(false)
  const [accountNo,    setAccountNo]    = useState('')
  const [ifsc,         setIfsc]         = useState('')
  const [accountName,  setAccountName]  = useState('')
  const [payoutBusy,   setPayoutBusy]   = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/partner')
      if (!res.ok) { toast.error('Failed to load partner data'); return }
      setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  function copyLink() {
    if (!data) return
    navigator.clipboard.writeText(data.referral_link)
    setCopied(true)
    toast.success('Referral link copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  async function requestPayout() {
    if (!accountNo.trim() || !ifsc.trim() || !accountName.trim()) {
      toast.error('Please fill in all bank details')
      return
    }
    setPayoutBusy(true)
    try {
      const res = await fetch('/api/partner/payout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_no: accountNo, ifsc, account_name: accountName }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Payout request failed'); return }
      toast.success('Payout request submitted! We will process it within 3-5 business days.')
      setShowPayout(false)
      setAccountNo(''); setIfsc(''); setAccountName('')
      fetchData()
    } finally {
      setPayoutBusy(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--brand)' }} />
      </div>
    )
  }

  if (!data) return null

  const tier       = data.tier
  const tc         = TIER_COLORS[tier]
  const stats      = data.stats
  const canPayout  = stats.pending_paise >= 50000  // ₹500 min

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 16px' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 28 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--fg)' }}>Partner Portal</h1>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, letterSpacing: '0.06em',
              background: tc.bg, color: tc.text, border: `1px solid ${tc.border}`, textTransform: 'uppercase',
            }}>
              {tier === 'gold' ? '★ ' : ''}{tier}
            </span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>
            Earn {data.rate_percent}% commission for every client who pays after joining via your referral link.
          </p>
        </div>
        <button onClick={fetchData} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* ── Tier progress ──────────────────────────────────────────────────── */}
      {data.next_tier && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 18px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <Award size={18} style={{ color: tc.border, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>
              <span>{data.next_tier.current} / {data.next_tier.at} active referrals to {data.next_tier.name}</span>
              <span style={{ textTransform: 'capitalize', fontWeight: 600, color: tc.text }}>{tier} → {data.next_tier.name}</span>
            </div>
            <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(100, (data.next_tier.current / data.next_tier.at) * 100)}%`, background: tc.border, borderRadius: 3, transition: 'width 0.4s' }} />
            </div>
          </div>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
            {data.next_tier.name === 'silver' ? '15%' : '20%'} commission at {data.next_tier.name}
          </span>
        </div>
      )}

      {/* ── Referral link card ─────────────────────────────────────────────── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <ExternalLink size={16} style={{ color: 'var(--brand)' }} />
          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--fg)' }}>Your Referral Link</span>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 240, display: 'flex', alignItems: 'center', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {data.referral_link}
          </div>
          <button onClick={copyLink} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
            background: copied ? '#16a34a' : 'var(--brand)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0,
          }}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
        </div>
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <QrCode size={13} />
          <span>Share this link with CAs and business owners. When they sign up and pay, you earn {data.rate_percent}%.</span>
        </div>
      </div>

      {/* ── Stats grid ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 28 }}>
        {[
          { icon: <Users size={18} />,       label: 'Total Referred',    value: stats.total_referred,                  color: '#2563eb' },
          { icon: <BadgeCheck size={18} />,  label: 'Paying Clients',    value: stats.paying_referred,                 color: '#16a34a' },
          { icon: <TrendingUp size={18} />,  label: 'This Month',        value: rupees(stats.this_month_paise),        color: '#8b5cf6' },
          { icon: <IndianRupee size={18} />, label: 'Total Earned',      value: rupees(stats.total_earned_paise),      color: '#0891b2' },
          { icon: <Clock size={18} />,       label: 'Pending Balance',   value: rupees(stats.pending_paise),           color: '#f59e0b' },
        ].map(card => (
          <div key={card.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px' }}>
            <div style={{ color: card.color, marginBottom: 8 }}>{card.icon}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--fg)', marginBottom: 2 }}>{card.value}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{card.label}</div>
          </div>
        ))}
      </div>

      {/* ── Payout section ─────────────────────────────────────────────────── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Wallet size={16} style={{ color: 'var(--brand)' }} />
            <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--fg)' }}>Earnings & Payouts</span>
          </div>
          {!showPayout && (
            <button
              onClick={() => canPayout ? setShowPayout(true) : toast.info('Minimum ₹500 approved balance needed to request a payout')}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                background: canPayout ? 'var(--brand)' : 'var(--border)', color: canPayout ? '#fff' : 'var(--muted)',
                border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: canPayout ? 'pointer' : 'not-allowed',
              }}
            >
              <Download size={14} /> Request Payout
            </button>
          )}
        </div>

        {!canPayout && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#92400e', background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}>
            <AlertCircle size={14} />
            Commissions are approved monthly. Minimum ₹500 balance required to withdraw.
          </div>
        )}

        {showPayout && (
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 14, background: 'var(--bg)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)', marginBottom: 12 }}>
              Bank Details — Payout of {rupees(stats.pending_paise)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              {[
                { label: 'Account Holder Name', val: accountName, set: setAccountName, placeholder: 'As per bank records' },
                { label: 'Account Number',       val: accountNo,  set: setAccountNo,  placeholder: '1234567890' },
                { label: 'IFSC Code',            val: ifsc,       set: (v: string) => setIfsc(v.toUpperCase()), placeholder: 'HDFC0001234', colSpan: false },
              ].map(f => (
                <div key={f.label} style={{ gridColumn: f.label === 'Account Holder Name' ? 'span 2' : 'span 1' }}>
                  <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>{f.label}</label>
                  <input
                    value={f.val}
                    onChange={e => f.set(e.target.value)}
                    placeholder={f.placeholder}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, background: 'var(--surface)', color: 'var(--fg)', boxSizing: 'border-box' }}
                  />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={requestPayout} disabled={payoutBusy} style={{ padding: '8px 16px', background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: payoutBusy ? 'not-allowed' : 'pointer', opacity: payoutBusy ? 0.7 : 1 }}>
                {payoutBusy ? 'Submitting…' : 'Submit Request'}
              </button>
              <button onClick={() => setShowPayout(false)} style={{ padding: '8px 16px', background: 'var(--border)', color: 'var(--fg)', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Payout history */}
        {data.payouts.length > 0 && (
          <div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Payout History</div>
            {data.payouts.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid var(--border)', fontSize: 13 }}>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--fg)' }}>{rupees(p.amount_paise)}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>Requested {fmtDate(p.created_at)}</div>
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, textTransform: 'capitalize',
                  background: p.status === 'paid' ? '#dcfce7' : p.status === 'rejected' ? '#fee2e2' : '#fef9c3',
                  color:      p.status === 'paid' ? '#15803d' : p.status === 'rejected' ? '#991b1b'  : '#a16207',
                }}>
                  {p.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Referred clients table ─────────────────────────────────────────── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 28 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Building2 size={16} style={{ color: 'var(--brand)' }} />
          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--fg)' }}>Referred Clients ({data.referred.length})</span>
        </div>
        {data.referred.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
            <Users size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
            <div style={{ fontWeight: 600, marginBottom: 4 }}>No referrals yet</div>
            <div>Share your referral link with CAs and business owners to get started.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--bg)' }}>
                  {['Organisation', 'Joined', 'Plan', 'Status', 'Commission'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.referred.map((r, i) => {
                  const earned = data.commissions.filter(c => c.referred_org_id === r.org_id).reduce((s, c) => s + c.commission_paise, 0)
                  return (
                    <tr key={r.org_id} style={{ borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--fg)' }}>{r.name}</td>
                      <td style={{ padding: '12px 16px', color: 'var(--muted)' }}>{fmtDate(r.joined_at)}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20,
                          background: r.is_paying ? '#dbeafe' : '#f1f5f9',
                          color:      r.is_paying ? '#1d4ed8' : '#64748b',
                        }}>
                          {PLAN_LABELS[r.plan_tier] ?? r.plan_tier}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ color: STATUS_COLORS[r.status] ?? '#64748b', fontSize: 12, fontWeight: 600, textTransform: 'capitalize' }}>
                          ● {r.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', color: earned > 0 ? '#16a34a' : 'var(--muted)', fontWeight: earned > 0 ? 600 : 400 }}>
                        {earned > 0 ? rupees(earned) : r.is_paying ? 'Pending approval' : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── How it works ───────────────────────────────────────────────────── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--fg)', marginBottom: 14 }}>How the Partner Program Works</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            ['Share your link', `Send your referral link (code: ${data.referral_code}) to CA firms and business owners.`],
            ['They sign up & pay', 'When they upgrade to a paid Planora plan, you earn a commission on their payment.'],
            [`Earn ${data.rate_percent}% commission`, `Your current tier is ${tier.toUpperCase()}. Refer more clients to unlock Silver (15%) and Gold (20%).`],
            ['Monthly payouts', 'Commissions are approved monthly. Request a bank transfer once you hit ₹500 balance.'],
          ].map(([title, desc], i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--brand)', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                {i + 1}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--fg)', marginBottom: 2 }}>{title}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
