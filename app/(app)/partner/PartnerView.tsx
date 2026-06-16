'use client'
import { useEffect, useState, useCallback } from 'react'
import { useAppStore, toast } from '@/store/appStore'
import {
  Copy, Check, Users, TrendingUp, IndianRupee, Clock,
  Award, ChevronRight, Download, Building2, RefreshCw,
  BadgeCheck, Wallet, AlertCircle, QrCode, ExternalLink,
  Mail, Send, X,
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

interface PartnerInvite {
  id:           string
  email:        string
  invite_count: number
  last_sent_at: string
  created_at:   string
}

interface PartnerData {
  referral_code: string
  referral_link: string
  msme_link:     string
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
  referred:      ReferredOrg[]
  commissions:   Commission[]
  payouts:       Payout[]
  invites_sent:  number
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
  const [copied,      setCopied]      = useState(false)
  const [copiedMsme,  setCopiedMsme]  = useState(false)

  // Payout form
  const [showPayout,   setShowPayout]   = useState(false)
  const [accountNo,    setAccountNo]    = useState('')
  const [ifsc,         setIfsc]         = useState('')
  const [accountName,  setAccountName]  = useState('')
  const [payoutBusy,   setPayoutBusy]   = useState(false)

  // Invite form
  const [invites,      setInvites]      = useState<PartnerInvite[]>([])
  const [inviteEmails, setInviteEmails] = useState('')
  const [inviteBusy,   setInviteBusy]  = useState(false)
  const [invitesDone,  setInvitesDone]  = useState<{ sent: number; failed: number } | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [partnerRes, invitesRes] = await Promise.all([
        fetch('/api/partner'),
        fetch('/api/partner/invite'),
      ])
      if (!partnerRes.ok) { toast.error('Failed to load partner data'); return }
      setData(await partnerRes.json())
      if (invitesRes.ok) {
        const inv = await invitesRes.json()
        setInvites(inv.invites ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  function copyLink() {
    if (!data) return
    navigator.clipboard.writeText(data.referral_link)
    setCopied(true)
    toast.success('Planora referral link copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  function copyMsmeLink() {
    if (!data) return
    navigator.clipboard.writeText(data.msme_link)
    setCopiedMsme(true)
    toast.success('MSME Tracker referral link copied!')
    setTimeout(() => setCopiedMsme(false), 2000)
  }

  async function sendInvites() {
    const emails = inviteEmails.split(/[\s,;]+/).map(e => e.trim()).filter(Boolean)
    if (emails.length === 0) { toast.error('Enter at least one email address'); return }
    if (emails.length > 20)  { toast.error('Maximum 20 emails at a time'); return }
    setInviteBusy(true)
    setInvitesDone(null)
    try {
      const res  = await fetch('/api/partner/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails }),
      })
      const json = await res.json()
      if (!res.ok && json.sent === undefined) { toast.error(json.error ?? 'Failed to send invites'); return }
      setInvitesDone({ sent: json.sent, failed: json.failed })
      if (json.sent > 0) {
        setInviteEmails('')
        toast.success(`${json.sent} invite${json.sent > 1 ? 's' : ''} sent!`)
        // Refresh invite list
        const inv = await fetch('/api/partner/invite')
        if (inv.ok) setInvites((await inv.json()).invites ?? [])
      }
      if (json.failed > 0) toast.error(`${json.failed} email${json.failed > 1 ? 's' : ''} failed to send`)
    } finally {
      setInviteBusy(false)
    }
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
            Earn {data.rate_percent}% commission for every client who upgrades to a paid plan via your referral link — on Planora or MSME Tracker.
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <ExternalLink size={16} style={{ color: 'var(--brand)' }} />
          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--fg)' }}>Your Referral Links</span>
          <span style={{ fontSize: 11, color: 'var(--muted)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 20, padding: '2px 8px' }}>
            Code: {data.referral_code}
          </span>
        </div>

        {/* Planora link */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
            Planora — Practice Management
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
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        {/* MSME Tracker link */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
            MSME Tracker — Vendor Email Automation
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 240, display: 'flex', alignItems: 'center', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {data.msme_link}
            </div>
            <button onClick={copyMsmeLink} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
              background: copiedMsme ? '#16a34a' : '#0891b2', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0,
            }}>
              {copiedMsme ? <Check size={14} /> : <Copy size={14} />}
              {copiedMsme ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        <div style={{ marginTop: 14, fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <QrCode size={13} />
          <span>Share either link — both use the same referral code. When the referred client upgrades to a paid plan, you earn {data.rate_percent}% commission.</span>
        </div>
      </div>

      {/* ── Stats grid ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 28 }}>
        {[
          { icon: <Users size={18} />,       label: 'Total Referrals',         value: stats.total_referred,             color: '#2563eb' },
          { icon: <Mail size={18} />,        label: 'Direct Invites Sent',     value: data.invites_sent,                color: '#0d9488' },
          { icon: <BadgeCheck size={18} />,  label: 'On a Paid Plan',          value: stats.paying_referred,            color: '#16a34a' },
          { icon: <TrendingUp size={18} />,  label: 'Commissions This Month',  value: rupees(stats.this_month_paise),   color: '#8b5cf6' },
          { icon: <IndianRupee size={18} />, label: 'Total Paid Out',          value: rupees(stats.total_earned_paise), color: '#0891b2' },
          { icon: <Clock size={18} />,       label: 'Awaiting Payout',         value: rupees(stats.pending_paise),      color: '#f59e0b' },
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

      {/* ── Invite by Email (MSME Tracker) ────────────────────────────────── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Mail size={16} style={{ color: '#0d9488' }} />
          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--fg)' }}>Invite to MSME Tracker</span>
        </div>
        <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 16px', lineHeight: 1.6 }}>
          Enter email addresses below — we'll send each person a personalised invite to try MSME Tracker with your referral code embedded. Separate multiple emails with commas or new lines.
        </p>

        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <textarea
            value={inviteEmails}
            onChange={e => setInviteEmails(e.target.value)}
            placeholder={'ca@example.com\naccounts@firm.in, rajesh@vendor.com'}
            rows={3}
            style={{
              flex: 1, minWidth: 240, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8,
              fontSize: 13, color: 'var(--fg)', background: 'var(--bg)', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5,
            }}
          />
          <button
            onClick={sendInvites}
            disabled={inviteBusy || !inviteEmails.trim()}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px',
              background: inviteBusy ? 'var(--border)' : '#0d9488', color: inviteBusy ? 'var(--muted)' : '#fff',
              border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
              cursor: inviteBusy || !inviteEmails.trim() ? 'not-allowed' : 'pointer', flexShrink: 0,
            }}
          >
            <Send size={14} />
            {inviteBusy ? 'Sending…' : 'Send Invites'}
          </button>
        </div>

        <p style={{ fontSize: 11, color: 'var(--muted)', margin: '8px 0 0' }}>
          Max 20 emails per batch. Each invite includes your referral code so sign-ups are tracked automatically.
        </p>

        {/* Invite history */}
        {invites.length > 0 && (
          <div style={{ marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
              Invite History ({invites.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              {invites.map((inv, i) => (
                <div key={inv.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 14px',
                  background: 'var(--bg)', borderTop: i > 0 ? '1px solid var(--border)' : 'none', fontSize: 13,
                }}>
                  <div style={{ fontWeight: 500, color: 'var(--fg)' }}>{inv.email}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                      {inv.invite_count > 1 ? `${inv.invite_count}× sent` : 'Sent'} · {fmtDate(inv.last_sent_at)}
                    </span>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                      background: '#f0fdfa', color: '#0d9488',
                    }}>
                      Invited
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── How it works ───────────────────────────────────────────────────── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--fg)', marginBottom: 14 }}>How the Partner Program Works</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            ['Share your referral links', `Use your Planora link for CA firms or your MSME Tracker link for business owners. Both links use the same referral code (${data.referral_code}).`],
            ['They sign up & upgrade', 'When the person you referred upgrades to any paid plan on Planora or MSME Tracker, a commission is created for you.'],
            [`Earn ${data.rate_percent}% commission`, `Your current tier is ${tier.toUpperCase()}. Reach 5 active referrals for Silver (15%) and 10 for Gold (20%).`],
            ['Monthly payouts', 'Commissions are reviewed and approved monthly. Request a bank transfer once your approved balance reaches ₹500.'],
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
