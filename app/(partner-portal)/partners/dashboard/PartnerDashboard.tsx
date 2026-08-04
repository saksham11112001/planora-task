'use client'
import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import PartnerTour from './PartnerTour'
import { PARTNER_TIERS, tierForSignups, msmeCommissionPaise } from '@/lib/partner/tiers'

const TEAL   = '#0d9488'
const PURPLE = '#7c3aed'
const DARK   = '#0f172a'
const MUTED  = '#64748b'
const BORDER = '#e2e8f0'
const BG     = '#f8fafc'
const WHITE  = '#ffffff'

// Tier-based MSME referral incentive (Bronze 5% / Silver 10% / Gold 20% of pack
// price) — rates and thresholds come from the shared lib/partner/tiers.ts,
// the same module the server-side withdrawal balance uses.

// 'about' is the combined home page: what the programme is (left) and the
// invite form (right), side by side — so a first-time partner reads how it
// works and can act on it without moving between tabs.
type Tab = 'about' | 'kpis' | 'withdrawals'

const NAV_ITEMS: { id: Tab; icon: string; label: string }[] = [
  { id: 'about',       icon: '🏠', label: 'Start Here' },
  { id: 'kpis',        icon: '📊', label: 'My KPIs' },
  { id: 'withdrawals', icon: '💰', label: 'Get Paid' },
]

interface Partner {
  id: string
  name: string
  email: string
  referral_code: string
  status: string
  created_at: string
}

interface Invite {
  id: string
  email: string
  invite_type: 'msme' | 'partner'
  invite_count: number
  last_sent_at: string
  signed_up: boolean
}

interface Withdrawal {
  id: string
  amount_paise: number
  status: 'requested' | 'processing' | 'paid' | 'rejected'
  account_name: string
  bank_account: string
  bank_ifsc: string
  upi_id: string | null
  admin_note: string | null
  created_at: string
  processed_at: string | null
}

interface PackInfo {
  packTier: string
  amountPaise: number
  paidAt: string
}

interface Props {
  partner: Partner
  msmeInvites: Invite[]
  partnerInvites: Invite[]
  withdrawals: Withdrawal[]
  packByEmail: Record<string, PackInfo>
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtShort(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function getTier(signedUp: number): { label: string; color: string; bg: string; next: string | null; ratePct: number } {
  const t = tierForSignups(signedUp)
  if (t.key === 'gold')   return { label: 'Gold Partner',   color: '#b45309', bg: '#fef3c7', next: null, ratePct: t.ratePct }
  if (t.key === 'silver') return { label: 'Silver Partner', color: '#475569', bg: '#f1f5f9', next: `${10 - signedUp} more sign-ups for Gold (20%)`, ratePct: t.ratePct }
  if (t.key === 'bronze') return { label: 'Bronze Partner', color: '#92400e', bg: '#fef9c3', next: `${5 - signedUp} more sign-ups for Silver (10%)`, ratePct: t.ratePct }
  return { label: 'Starter', color: MUTED, bg: BG, next: '1 sign-up to Bronze', ratePct: t.ratePct }
}

function packTierLabel(tier: string): string {
  const map: Record<string, string> = {
    pack_5: 'Pack 5', pack_10: 'Pack 10', pack_20: 'Pack 20',
    pack_50: 'Pack 50', pack_100: 'Pack 100',
  }
  return map[tier] ?? tier
}

function withdrawalStatusBadge(status: Withdrawal['status']) {
  const styles: Record<string, { bg: string; color: string; label: string }> = {
    requested:  { bg: '#fef9c3', color: '#a16207', label: 'Requested' },
    processing: { bg: '#dbeafe', color: '#1d4ed8', label: 'Processing' },
    paid:       { bg: '#dcfce7', color: '#166534', label: 'Paid' },
    rejected:   { bg: '#fee2e2', color: '#dc2626', label: 'Rejected' },
  }
  const s = styles[status] ?? styles.requested
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', border: `1px solid ${BORDER}`,
  borderRadius: 8, fontSize: 14, color: DARK, background: WHITE,
  outline: 'none', colorScheme: 'light', boxSizing: 'border-box',
}

export function PartnerDashboard({ partner, msmeInvites: initMsme, partnerInvites: initPartner, withdrawals: initWithdrawals, packByEmail }: Props) {
  const APP_URL = typeof window !== 'undefined' ? window.location.origin : ''
  const msmeReferralUrl    = `${APP_URL}/msme-landing?ref=${partner.referral_code}`
  const partnerReferralUrl = `${APP_URL}/partners/join?ref=${partner.referral_code}`

  const combined = [...initMsme.map(i => ({ ...i, invite_type: 'msme' as const })), ...initPartner.map(i => ({ ...i, invite_type: 'partner' as const }))]
    .sort((a, b) => new Date(b.last_sent_at).getTime() - new Date(a.last_sent_at).getTime())

  const [activeTab,  setActiveTab]  = useState<Tab>('about')
  const [showTour,   setShowTour]   = useState(false)
  const [allInvites, setAllInvites] = useState<Invite[]>(combined)
  const [emails,     setEmails]     = useState<string[]>([''])
  const [invType,    setInvType]    = useState<'msme' | 'partner'>('msme')
  const [busy,       setBusy]       = useState(false)
  const [toast,      setToast]      = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [copiedMsme,    setCopiedMsme]    = useState(false)
  const [copiedPartner, setCopiedPartner] = useState(false)

  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>(initWithdrawals)
  const [earnedPaise, setEarnedPaise] = useState<number | null>(null)
  const [availPaise,  setAvailPaise]  = useState<number | null>(null)
  const [hasPending,  setHasPending]  = useState(initWithdrawals.some(w => w.status === 'requested' || w.status === 'processing'))
  const [wdAmount,    setWdAmount]    = useState('')
  const [wdName,      setWdName]      = useState('')
  const [wdAccount,   setWdAccount]   = useState('')
  const [wdIfsc,      setWdIfsc]      = useState('')
  const [wdUpi,       setWdUpi]       = useState('')
  const [wdBusy,      setWdBusy]      = useState(false)
  const [balLoaded,   setBalLoaded]   = useState(false)

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  function copyMsme() {
    navigator.clipboard.writeText(msmeReferralUrl)
    setCopiedMsme(true); setTimeout(() => setCopiedMsme(false), 2000)
    showToast('MSME Tracker referral link copied!')
  }

  function copyPartner() {
    navigator.clipboard.writeText(partnerReferralUrl)
    setCopiedPartner(true); setTimeout(() => setCopiedPartner(false), 2000)
    showToast('Partner invite link copied!')
  }

  const sendInvite = useCallback(async () => {
    const valid = emails.map(e => e.trim()).filter(e => e.length > 0)
    if (valid.length === 0) { showToast('Enter at least one email address', 'error'); return }
    const badEmail = valid.find(e => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
    if (badEmail) { showToast(`Invalid email: ${badEmail}`, 'error'); return }

    setBusy(true)
    try {
      const res  = await fetch('/api/partner-portal/invite', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ emails: valid, invite_type: invType }),
      })
      const json = await res.json()
      if (!res.ok) { showToast(json.error ?? 'Failed to send invite', 'error'); return }

      if (json.sent > 0) {
        showToast(json.sent === 1 ? `Invite sent to ${valid[0]}!` : `${json.sent} invites sent!`)
        setEmails([''])
        if (Array.isArray(json.invites)) {
          setAllInvites(prev => {
            const kept    = prev.filter(i => i.invite_type !== invType)
            const updated = json.invites.map((i: Invite) => ({ ...i, invite_type: invType }))
            return [...kept, ...updated].sort((a, b) => new Date(b.last_sent_at).getTime() - new Date(a.last_sent_at).getTime())
          })
        }
      } else {
        showToast('Could not deliver the invite — check the email address', 'error')
      }
    } catch { showToast('Network error', 'error') }
    finally  { setBusy(false) }
  }, [emails, invType])

  async function loadBalance() {
    if (balLoaded) return
    const res = await fetch('/api/partner-portal/withdraw')
    if (!res.ok) return
    const json = await res.json()
    setEarnedPaise(json.earned_paise)
    setAvailPaise(json.available_paise)
    setHasPending(json.has_pending)
    setWithdrawals(json.withdrawals ?? [])
    setBalLoaded(true)
  }

  async function submitWithdrawal() {
    const amtNum = parseFloat(wdAmount)
    if (isNaN(amtNum) || amtNum <= 0) { showToast('Enter a valid amount', 'error'); return }
    const amtPaise = Math.round(amtNum * 100)
    if (amtPaise < 50000) { showToast('Minimum withdrawal amount is ₹500', 'error'); return }
    if (!wdName.trim())    { showToast('Account holder name is required', 'error'); return }
    if (!wdAccount.trim()) { showToast('Bank account number is required', 'error'); return }
    if (!wdIfsc.trim())    { showToast('IFSC code is required', 'error'); return }

    setWdBusy(true)
    try {
      const res = await fetch('/api/partner-portal/withdraw', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          amount_paise:  amtPaise,
          account_name:  wdName.trim(),
          bank_account:  wdAccount.trim(),
          bank_ifsc:     wdIfsc.trim().toUpperCase(),
          upi_id:        wdUpi.trim() || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) { showToast(json.error ?? 'Failed to submit request', 'error'); return }

      showToast('Withdrawal request submitted!')
      setWdAmount(''); setWdName(''); setWdAccount(''); setWdIfsc(''); setWdUpi('')
      if (json.withdrawals) setWithdrawals(json.withdrawals)
      if (json.available_paise !== undefined) setAvailPaise(json.available_paise)
      if (json.earned_paise   !== undefined) setEarnedPaise(json.earned_paise)
      setHasPending(true)
    } catch { showToast('Network error', 'error') }
    finally  { setWdBusy(false) }
  }

  async function handleLogout() {
    await createClient().auth.signOut()
    document.cookie = 'upfloat_active_org=; Max-Age=0; path=/'
    window.location.href = '/partners/login'
  }

  const msmeSignedUp    = allInvites.filter(i => i.invite_type === 'msme'    && i.signed_up).length
  const partnerSignedUp = allInvites.filter(i => i.invite_type === 'partner' && i.signed_up).length
  const totalSignedUp   = msmeSignedUp + partnerSignedUp
  const totalSent       = allInvites.length
  const msmePaidCount   = allInvites.filter(i => i.invite_type === 'msme' && i.signed_up && packByEmail[i.email.toLowerCase()]).length
  const tier            = getTier(totalSignedUp)
  // Sign-ups needed for the next tier up — null once Gold is reached.
  const nextTierAt      = PARTNER_TIERS.find(t => t.minSignups > totalSignedUp)?.minSignups ?? null
  // Tier rate × each referred user's purchased pack — same formula as the
  // server's withdrawal balance (shared lib/partner/tiers.ts).
  const commissionEst   = Object.values(packByEmail).reduce(
    (sum, p) => sum + msmeCommissionPaise(p.amountPaise, tier.ratePct), 0) / 100
  const paidDeducted    = initWithdrawals.filter(w => w.status !== 'rejected').reduce((s, w) => s + w.amount_paise, 0)
  const displayEarned   = earnedPaise !== null ? earnedPaise / 100 : commissionEst
  const displayAvail    = availPaise  !== null ? availPaise  / 100 : Math.max(0, commissionEst - paidDeducted / 100)

  return (
    <div style={{ height: '100vh', background: BG, colorScheme: 'light', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", color: DARK, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {showTour && <PartnerTour onDone={() => setShowTour(false)} onTabChange={setActiveTab} />}

      {/* Top nav */}
      <nav data-tour="partner-nav" style={{
        background: WHITE, borderBottom: `1px solid ${BORDER}`,
        padding: '0 24px', height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 50, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: TEAL, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, color: WHITE }}>P</div>
          <span style={{ fontWeight: 700, fontSize: 15, color: DARK }}>Partner Portal</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: TEAL, background: 'rgba(13,148,136,0.1)', border: '1px solid rgba(13,148,136,0.25)', borderRadius: 20, padding: '2px 8px' }}>by upFloat</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: tier.bg, border: `1.5px solid ${tier.color}50`, borderRadius: 20, padding: '3px 12px', display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: tier.color }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: tier.color }}>{tier.label}</span>
          </div>
          <span style={{ fontSize: 13, color: MUTED }}>Hi, {partner.name.split(' ')[0]}</span>
          <button onClick={() => setShowTour(true)} style={{ fontSize: 12, fontWeight: 600, color: TEAL, background: 'rgba(13,148,136,0.1)', border: '1px solid rgba(13,148,136,0.3)', borderRadius: 7, padding: '5px 12px', cursor: 'pointer', colorScheme: 'light' }}>
            ? Take a tour
          </button>
          <button onClick={handleLogout} style={{ fontSize: 12, color: MUTED, background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 7, padding: '5px 12px', cursor: 'pointer', colorScheme: 'light' }}>
            Logout
          </button>
        </div>
      </nav>

      {/* Mobile tab bar */}
      <div style={{ display: 'flex', background: WHITE, borderBottom: `1px solid ${BORDER}`, overflowX: 'auto', flexShrink: 0 }} className="partner-mobile-tabs">
        {NAV_ITEMS.map(item => (
          <button key={item.id} onClick={() => setActiveTab(item.id)} style={{
            flex: '1 0 auto', padding: '10px 14px', fontSize: 12,
            fontWeight: activeTab === item.id ? 700 : 500,
            color: activeTab === item.id ? TEAL : MUTED,
            background: 'none', border: 'none',
            borderBottom: `2px solid ${activeTab === item.id ? TEAL : 'transparent'}`,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, whiteSpace: 'nowrap',
          }}>
            <span>{item.icon}</span><span>{item.label}</span>
          </button>
        ))}
      </div>

      {/* Sidebar + content */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>

        {/* Sidebar */}
        <aside data-tour="partner-sidebar" style={{ width: 220, background: WHITE, borderRight: `1px solid ${BORDER}`, padding: '24px 0', flexShrink: 0, display: 'flex', flexDirection: 'column' }} className="partner-sidebar">
          <div style={{ padding: '0 16px 14px', borderBottom: `1px solid #f1f5f9`, marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Partner Portal</div>
            <div style={{ fontSize: 12, color: TEAL, fontFamily: 'monospace', fontWeight: 700, marginTop: 4 }}>{partner.referral_code}</div>
          </div>

          {NAV_ITEMS.map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id)} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              width: '100%', padding: '10px 20px', fontSize: 13,
              fontWeight: activeTab === item.id ? 700 : 500,
              color: activeTab === item.id ? TEAL : '#334155',
              background: activeTab === item.id ? 'rgba(13,148,136,0.08)' : 'none',
              border: 'none', borderLeft: `3px solid ${activeTab === item.id ? TEAL : 'transparent'}`,
              cursor: 'pointer', textAlign: 'left',
            }}>
              <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
            </button>
          ))}

          {/* Mini KPI in sidebar */}
          <div data-tour="partner-quick-stats" style={{ padding: '14px 16px', borderTop: `1px solid #f1f5f9` }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Quick Stats</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: MUTED }}>Earned</span>
                <span style={{ fontWeight: 700, color: TEAL }}>₹{displayEarned.toLocaleString('en-IN')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: MUTED }}>Sign-ups</span>
                <span style={{ fontWeight: 700, color: DARK }}>{totalSignedUp}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: MUTED }}>Available</span>
                <span style={{ fontWeight: 700, color: displayAvail >= 500 ? '#16a34a' : '#dc2626' }}>₹{displayAvail.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '32px 32px 80px', overscrollBehavior: 'contain' }}>

          {/* ── About ─────────────────────────────────────────────────── */}
          {/* ── Start Here: what this is + send invites, side by side ─── */}
          {activeTab === 'about' && (
            <div>
              {/* Hero — plain language, states the deal immediately */}
              <div style={{ background: `linear-gradient(135deg, ${DARK} 0%, #1e293b 60%, #134e4a 100%)`, borderRadius: 16, padding: '32px 32px', marginBottom: 22, position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', border: '2px solid rgba(13,148,136,0.2)', pointerEvents: 'none' }} />
                <div style={{ position: 'relative' }}>
                  <h1 style={{ fontSize: 27, fontWeight: 800, color: WHITE, margin: '0 0 12px', lineHeight: 1.25 }}>
                    Hi {partner.name.split(' ')[0]} — here is the whole idea in one line.
                  </h1>
                  {invType === 'msme' ? (
                    <p style={{ margin: '0 0 18px', fontSize: 16, color: '#e2e8f0', lineHeight: 1.7, maxWidth: 640 }}>
                      You introduce a business to <strong style={{ color: WHITE }}>MSME Tracker</strong>. They use it to collect
                      MSME declarations from their vendors. When they take a paid plan, <strong style={{ color: WHITE }}>you get a
                      referral incentive of {tier.ratePct}% of what they pay</strong>.
                    </p>
                  ) : (
                    <p style={{ margin: '0 0 18px', fontSize: 16, color: '#e2e8f0', lineHeight: 1.7, maxWidth: 640 }}>
                      You invite someone to join the <strong style={{ color: WHITE }}>Partner Program</strong>. They introduce
                      businesses to MSME Tracker themselves. Their sign-up <strong style={{ color: WHITE }}>counts towards your
                      tier</strong> — and a higher tier raises your rate on every business you have already referred.
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ background: 'rgba(13,148,136,0.18)', border: '1px solid rgba(13,148,136,0.45)', color: '#5eead4', borderRadius: 20, padding: '6px 14px', fontSize: 13, fontWeight: 600 }}>
                      Your tier: {tier.label} · {tier.ratePct}%
                    </span>
                    <span style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)', color: '#cbd5e1', borderRadius: 20, padding: '6px 14px', fontSize: 13, fontWeight: 600 }}>
                      Your code: {partner.referral_code}
                    </span>
                    <span style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)', color: '#cbd5e1', borderRadius: 20, padding: '6px 14px', fontSize: 13, fontWeight: 600 }}>
                      {invType === 'msme'
                        ? 'Paid out from ₹500'
                        : nextTierAt !== null
                          ? `${totalSignedUp} of ${nextTierAt} sign-ups to the next tier`
                          : 'Top tier reached'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Two halves: understand it (left) · do it (right) */}
              <div className="partner-split" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start', marginBottom: 22 }}>

                {/* LEFT — what it is and how it works. Follows the invite-type
                    switcher on the right, so the guide always describes the thing
                    the partner is currently inviting someone to. */}
                <div className="partner-explain" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {invType === 'msme' ? (
                    <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 22, borderLeft: `4px solid ${TEAL}` }}>
                      <div style={{ fontWeight: 800, fontSize: 16, color: DARK, marginBottom: 10 }}>What is MSME Tracker?</div>
                      <p style={{ margin: '0 0 12px', fontSize: 14, color: '#334155', lineHeight: 1.7 }}>
                        A business uploads its list of vendors. Each vendor is asked for their MSME (Udyam) details.
                        Vendors who do not reply get reminders. The business ends up with an audit log showing who
                        declared what, and when.
                      </p>
                      <p style={{ margin: 0, fontSize: 14, color: '#334155', lineHeight: 1.7 }}>
                        They need this because of <strong>Section 43B(h)</strong>: payments to MSME vendors must be made
                        within 45 days, or the expense is disallowed. To follow the rule they first have to know which
                        vendors are MSMEs.
                      </p>
                    </div>
                  ) : (
                    <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 22, borderLeft: `4px solid ${PURPLE}` }}>
                      <div style={{ fontWeight: 800, fontSize: 16, color: DARK, marginBottom: 10 }}>What is the Partner Program?</div>
                      <p style={{ margin: '0 0 12px', fontSize: 14, color: '#334155', lineHeight: 1.7 }}>
                        It is the programme you are in right now. Someone you invite gets their own partner portal,
                        their own referral code, and can introduce businesses to MSME Tracker just as you do.
                      </p>
                      <p style={{ margin: 0, fontSize: 14, color: '#334155', lineHeight: 1.7 }}>
                        Inviting a partner does not pay you directly. What it does is move you up a tier — and the
                        higher rate then applies to <strong>every</strong> business you have referred, including the
                        ones from before.
                      </p>
                    </div>
                  )}

                  <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 22 }}>
                    <div style={{ fontWeight: 800, fontSize: 16, color: DARK, marginBottom: 14 }}>What you need to do</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
                      {(invType === 'msme'
                        ? [
                            ['Send an invite', 'Use the box on the right, or share your link. Your code is added for you.'],
                            ['They sign up', 'Anyone who joins through your link stays linked to you — even if they sign up weeks later.'],
                            ['They buy a plan', `You receive ${tier.ratePct}% of what they pay. Introduce more businesses and the rate rises: 5% → 10% → 20%.`],
                            ['You get paid', 'Ask for a payout once you are above ₹500. It reaches your bank in 3–5 working days.'],
                          ]
                        : [
                            ['Send an invite', 'Use the box on the right, or share your partner link. Your code is added for you.'],
                            ['They join as a partner', 'They get their own portal and referral code, and start introducing businesses themselves.'],
                            ['Your tier moves up', nextTierAt !== null
                              ? `You are at ${totalSignedUp} sign-up${totalSignedUp === 1 ? '' : 's'}. At ${nextTierAt} you reach the next tier.`
                              : 'You are already at the top tier, so further sign-ups do not change your rate.'],
                            ['Your rate rises on everything', 'The new rate applies to every business you have referred, not just the ones after it.'],
                          ]
                      ).map(([title, desc], i) => (
                        <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                          <div style={{ width: 24, height: 24, borderRadius: '50%', background: invType === 'msme' ? TEAL : PURPLE, color: WHITE, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{i + 1}</div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13.5, color: DARK, marginBottom: 2 }}>{title}</div>
                            <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.6 }}>{desc}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Referral incentive rates */}
                  <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 22 }}>
                    <div style={{ fontWeight: 800, fontSize: 16, color: DARK, marginBottom: 4 }}>Your referral incentive</div>
                    <p style={{ margin: '0 0 14px', fontSize: 13, color: MUTED, lineHeight: 1.6 }}>
                      Based on how many people have signed up through you. Reach a new level and the higher rate
                      applies to everything you have referred.
                    </p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {PARTNER_TIERS.filter(t => t.key !== 'starter').map(pt => {
                        const colors: Record<string, string> = { bronze: '#92400e', silver: '#475569', gold: '#b45309' }
                        const active = tier.ratePct === pt.ratePct
                        return (
                          <div key={pt.key} style={{ flex: 1, textAlign: 'center', padding: '12px 6px', borderRadius: 10, border: `1.5px solid ${active ? colors[pt.key] : BORDER}`, background: active ? `${colors[pt.key]}12` : BG }}>
                            <div style={{ fontSize: 19, fontWeight: 800, color: colors[pt.key] }}>{pt.ratePct}%</div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: DARK, marginTop: 2 }}>{pt.label}</div>
                            <div style={{ fontSize: 11, color: MUTED }}>{pt.minSignups}+ sign-ups</div>
                          </div>
                        )
                      })}
                    </div>
                    <p style={{ margin: '12px 0 0', fontSize: 12, color: MUTED, lineHeight: 1.6 }}>
                      {invType === 'msme'
                        ? 'Inviting someone to the Partner Program does not carry an incentive — only businesses who take a paid plan do.'
                        : 'Partner sign-ups are not paid on their own, but they do count towards the sign-up totals above — which is how they raise your rate.'}
                    </p>
                  </div>
                </div>

                {/* RIGHT — act on it now */}
                <div className="partner-act" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div data-tour="partner-invite-form" style={{ background: WHITE, border: `2px solid ${invType === 'msme' ? TEAL : PURPLE}`, borderRadius: 12, padding: 24, boxShadow: `0 4px 16px ${invType === 'msme' ? 'rgba(13,148,136,0.10)' : 'rgba(124,58,237,0.10)'}` }}>
                  <div style={{ fontWeight: 800, fontSize: 17, color: DARK, marginBottom: 4 }}>Start here — send your first invite</div>
                  <p style={{ fontSize: 13, color: MUTED, margin: '0 0 16px', lineHeight: 1.6 }}>
                    Pick who you are inviting, type their email, and press send. We write the email for you.
                    The guide alongside changes to match your choice.
                  </p>

                  <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                    {(['msme', 'partner'] as const).map(t => (
                      <button key={t} onClick={() => setInvType(t)} style={{
                        padding: '7px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                        border: `1.5px solid ${invType === t ? (t === 'msme' ? TEAL : PURPLE) : BORDER}`,
                        background: invType === t ? (t === 'msme' ? `${TEAL}15` : `${PURPLE}12`) : WHITE,
                        color: invType === t ? (t === 'msme' ? TEAL : PURPLE) : MUTED,
                        colorScheme: 'light',
                      }}>
                        {t === 'msme' ? 'MSME Tracker' : 'Partner Program'}
                      </button>
                    ))}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {emails.map((em, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                          type="email"
                          value={em}
                          onChange={e => { const next = [...emails]; next[idx] = e.target.value; setEmails(next) }}
                          onKeyDown={e => { if (e.key === 'Enter') sendInvite() }}
                          placeholder={invType === 'msme' ? 'business@example.com' : 'friend@example.com'}
                          style={{ ...inputStyle, flex: 1, width: 'auto' }}
                        />
                        {emails.length > 1 && (
                          <button onClick={() => setEmails(emails.filter((_, i) => i !== idx))} style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${BORDER}`, background: WHITE, color: '#94a3b8', fontSize: 18, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', colorScheme: 'light' }}>×</button>
                        )}
                      </div>
                    ))}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <button onClick={() => setEmails([...emails, ''])} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: `1.5px dashed ${BORDER}`, background: WHITE, color: MUTED, cursor: 'pointer', colorScheme: 'light' }}>
                        <span style={{ fontSize: 18, lineHeight: 1, marginTop: -1 }}>+</span> Add another email
                      </button>
                      <div style={{ flex: 1 }} />
                      <button onClick={sendInvite} disabled={busy || !emails.some(e => e.trim())} style={{
                        padding: '10px 24px', borderRadius: 8, fontSize: 14, fontWeight: 600,
                        background: busy || !emails.some(e => e.trim()) ? '#e2e8f0' : (invType === 'msme' ? TEAL : PURPLE),
                        color: busy || !emails.some(e => e.trim()) ? '#94a3b8' : WHITE,
                        border: 'none', cursor: busy || !emails.some(e => e.trim()) ? 'not-allowed' : 'pointer', flexShrink: 0, colorScheme: 'light',
                      }}>
                        {busy ? 'Sending…' : emails.filter(e => e.trim()).length > 1 ? `Send ${emails.filter(e => e.trim()).length} Invites` : 'Send Invite'}
                      </button>
                    </div>
                  </div>
                  <p style={{ fontSize: 11, color: '#94a3b8', margin: '8px 0 0' }}>
                    {invType === 'msme'
                      ? 'They get a short email explaining what MSME Tracker does. Your referral code is added automatically.'
                      : 'They get an email explaining the Partner Program and how referral incentives work.'}
                  </p>
                </div>

                  {/* Referral links */}
                  <div data-tour="partner-referral" style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20, borderLeft: `4px solid #2563eb` }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: DARK, marginBottom: 4 }}>Or share your link</div>
                    <p style={{ fontSize: 13, color: MUTED, margin: '0 0 16px', lineHeight: 1.6 }}>
                      Paste these into WhatsApp or email. Your code <strong style={{ fontFamily: 'monospace', color: TEAL }}>{partner.referral_code}</strong> is already inside both.
                    </p>
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>For a business (MSME Tracker)</div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <div style={{ flex: 1, padding: '9px 12px', background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12, color: MUTED, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{msmeReferralUrl}</div>
                        <button onClick={copyMsme} style={{ padding: '9px 16px', background: copiedMsme ? '#dcfce7' : TEAL, color: copiedMsme ? '#166534' : WHITE, border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0, colorScheme: 'light' }}>
                          {copiedMsme ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>For another partner</div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <div style={{ flex: 1, padding: '9px 12px', background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12, color: MUTED, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{partnerReferralUrl}</div>
                        <button onClick={copyPartner} style={{ padding: '9px 16px', background: copiedPartner ? '#dcfce7' : PURPLE, color: copiedPartner ? '#166534' : WHITE, border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0, colorScheme: 'light' }}>
                          {copiedPartner ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Everyone you have invited — full width below */}
              {/* Referred users table */}
              <div data-tour="partner-invited-table" style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: `${TEAL}06`, borderLeft: `4px solid ${TEAL}` }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 14, color: DARK }}>Referred Users</span>
                    <span style={{ fontSize: 12, color: MUTED, marginLeft: 8 }}>— full transparency on each referral</span>
                  </div>
                  <span style={{ fontSize: 12, color: MUTED }}>{allInvites.length} total</span>
                </div>

                {allInvites.length === 0 ? (
                  <div style={{ padding: '40px 20px', textAlign: 'center', color: MUTED }}>
                    <div style={{ fontWeight: 600, color: DARK, marginBottom: 4 }}>No invites sent yet</div>
                    <div style={{ fontSize: 13 }}>Enter an email above and send your first invite!</div>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr>
                          {['Email', 'Invited to', 'Times sent', 'Sign-up', 'Pack purchased', 'Your incentive', 'Last sent'].map(h => (
                            <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: TEAL, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', borderBottom: `1.5px solid rgba(13,148,136,0.25)`, background: 'rgba(13,148,136,0.05)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {allInvites.map((inv, i) => {
                          const emailKey = inv.email.toLowerCase()
                          const pack = inv.invite_type === 'msme' && inv.signed_up ? packByEmail[emailKey] : undefined
                          return (
                            <tr key={inv.id} style={{ borderTop: i > 0 ? `1px solid ${BORDER}` : 'none', background: WHITE }}>
                              <td style={{ padding: '10px 14px', fontWeight: 500, color: DARK, maxWidth: 180 }}>
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{inv.email}</span>
                              </td>
                              <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                                <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: inv.invite_type === 'msme' ? 'rgba(13,148,136,0.1)' : 'rgba(124,58,237,0.1)', color: inv.invite_type === 'msme' ? TEAL : PURPLE }}>
                                  {inv.invite_type === 'msme' ? 'MSME Tracker' : 'Partner Program'}
                                </span>
                              </td>
                              <td style={{ padding: '10px 14px', color: MUTED, textAlign: 'center' }}>{inv.invite_count}x</td>
                              <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                                {inv.signed_up
                                  ? <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: '#dcfce7', color: '#166534' }}>✓ Signed up</span>
                                  : <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: '#fef9c3', color: '#a16207' }}>Invited</span>}
                              </td>
                              <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                                {inv.invite_type === 'msme' && inv.signed_up ? (
                                  pack ? (
                                    <div>
                                      <span style={{ fontSize: 12, fontWeight: 700, color: TEAL }}>{packTierLabel(pack.packTier)}</span>
                                      <span style={{ fontSize: 11, color: MUTED, marginLeft: 6 }}>₹{(pack.amountPaise / 100).toLocaleString('en-IN')}</span>
                                      <div style={{ fontSize: 10, color: '#94a3b8' }}>{fmtDate(pack.paidAt)}</div>
                                    </div>
                                  ) : <span style={{ fontSize: 12, color: '#94a3b8' }}>Free plan</span>
                                ) : inv.invite_type === 'partner' && inv.signed_up
                                  ? <span style={{ fontSize: 12, color: '#94a3b8' }}>Partner joined</span>
                                  : <span style={{ fontSize: 12, color: '#cbd5e1' }}>—</span>}
                              </td>
                              <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                                {inv.invite_type === 'msme' && inv.signed_up ? (
                                  pack
                                    ? <span style={{ fontSize: 13, fontWeight: 700, color: TEAL }}>₹{(msmeCommissionPaise(pack.amountPaise, tier.ratePct) / 100).toLocaleString('en-IN')} <span style={{ fontSize: 10, fontWeight: 500, color: MUTED }}>({tier.ratePct}%)</span></span>
                                    : <span style={{ fontSize: 12, color: '#94a3b8' }}>Pending purchase</span>
                                ) : inv.invite_type === 'partner' && inv.signed_up
                                  ? <span style={{ fontSize: 12, color: '#94a3b8' }}>No incentive</span>
                                  : <span style={{ fontSize: 12, color: '#cbd5e1' }}>—</span>}
                              </td>
                              <td style={{ padding: '10px 14px', color: MUTED, fontSize: 12, whiteSpace: 'nowrap' }}>{fmtShort(inv.last_sent_at)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'kpis' && (
            <div>
              <PageHeader title="My KPIs" subtitle="Your performance at a glance" />

              {/* KPI grid */}
              <div data-tour="partner-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 28 }}>
                <KpiCard label="Incentive Earned" value={`₹${commissionEst.toLocaleString('en-IN')}`} sub="estimated · pending review" accent={TEAL} top />
                <KpiCard label="Total Sign-ups"    value={String(totalSignedUp)} sub="referred users joined"  accent="#16a34a" />
                <KpiCard label="Total Invites Sent" value={String(totalSent)}   sub="emails dispatched"      accent="#2563eb" />
                <KpiCard label="MSME Invites"      value={String(allInvites.filter(i => i.invite_type === 'msme').length)}    sub="MSME Tracker"    accent={TEAL} />
                <KpiCard label="Partner Invites"   value={String(allInvites.filter(i => i.invite_type === 'partner').length)} sub="Partner Program"  accent={PURPLE} />
              </div>

              {/* Tier progress */}
              <div data-tour="partner-tier" style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '20px 24px', marginBottom: 24, borderLeft: `4px solid #b45309` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: DARK }}>Partner Tier Progress</span>
                  <div style={{ background: tier.bg, border: `1.5px solid ${tier.color}40`, borderRadius: 20, padding: '4px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: tier.color }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: tier.color }}>{tier.label}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 0 }}>
                  {PARTNER_TIERS.map((pt, i, arr) => {
                    const colors: Record<string, string> = { starter: MUTED, bronze: '#92400e', silver: '#475569', gold: '#b45309' }
                    const color    = colors[pt.key]
                    const reached  = totalSignedUp >= pt.minSignups
                    const isActive = reached && (i === arr.length - 1 || totalSignedUp < arr[i + 1].minSignups)
                    return (
                      <div key={pt.key} style={{ flex: 1, textAlign: 'center' }}>
                        <div style={{ height: 6, background: reached ? color : BORDER, borderRadius: i === 0 ? '4px 0 0 4px' : i === arr.length - 1 ? '0 4px 4px 0' : 0 }} />
                        <div style={{ marginTop: 6, fontSize: 11, fontWeight: isActive ? 700 : 500, color: isActive ? color : MUTED }}>{pt.label}</div>
                        <div style={{ fontSize: 10, color: MUTED }}>{pt.minSignups === 0 ? 'Start' : `${pt.minSignups}+`} · {pt.ratePct}%</div>
                      </div>
                    )
                  })}
                </div>
                {tier.next && (
                  <div style={{ marginTop: 14, padding: '10px 14px', background: BG, borderRadius: 8, fontSize: 12, color: MUTED }}>
                    👉 {tier.next} to unlock the next tier
                  </div>
                )}
                <div style={{ marginTop: 10, padding: '10px 14px', background: BG, borderRadius: 8, fontSize: 12, color: MUTED, lineHeight: 1.6 }}>
                  Your referral incentive: <strong style={{ color: DARK }}>{tier.ratePct}% of each pack your referred MSME users buy</strong> · Partner Program invites carry no incentive · Paid on request (min ₹500).
                </div>
              </div>

              {/* Summary breakdown */}
              <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: DARK, marginBottom: 14 }}>Breakdown</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { label: 'MSME users signed up',            value: msmeSignedUp,    color: TEAL },
                    { label: 'Partners signed up',              value: partnerSignedUp, color: PURPLE },
                    { label: 'MSME users who purchased a pack', value: msmePaidCount,   color: '#16a34a' },
                    { label: 'Estimated incentive',              value: `₹${commissionEst.toLocaleString('en-IN')}`, color: TEAL, isText: true },
                  ].map(row => (
                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: BG, borderRadius: 8 }}>
                      <span style={{ fontSize: 13, color: DARK }}>{row.label}</span>
                      <span style={{ fontSize: 15, fontWeight: 700, color: row.color }}>{row.isText ? row.value : row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Invites ───────────────────────────────────────────────── */}
          {activeTab === 'withdrawals' && (
            <div>
              <PageHeader title="Withdraw Earnings" subtitle="Request a payout to your bank account" />

              {/* Balance cards */}
              <div data-tour="partner-balance" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
                <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '16px 18px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Total Earned</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: TEAL }}>₹{displayEarned.toLocaleString('en-IN')}</div>
                  <div style={{ fontSize: 11, color: MUTED }}>estimated referral incentives</div>
                </div>
                <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '16px 18px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Available</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: displayAvail >= 500 ? '#16a34a' : '#dc2626' }}>₹{displayAvail.toLocaleString('en-IN')}</div>
                  <div style={{ fontSize: 11, color: MUTED }}>after pending/paid withdrawals</div>
                </div>
                <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '16px 18px', cursor: 'pointer' }} onClick={loadBalance}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Withdrawals</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: DARK }}>{withdrawals.length}</div>
                  <div style={{ fontSize: 11, color: hasPending ? '#a16207' : MUTED }}>{balLoaded ? (hasPending ? '1 in progress' : 'no pending') : 'click to refresh'}</div>
                </div>
              </div>

              {/* Form or status */}
              {hasPending ? (
                <div style={{ padding: '16px 20px', background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 10, fontSize: 13, color: '#92400e', marginBottom: 24 }}>
                  You have a withdrawal request in progress. You can submit a new one once it is processed.
                </div>
              ) : displayAvail < 500 ? (
                <div style={{ padding: '16px 20px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, fontSize: 13, color: '#dc2626', marginBottom: 24 }}>
                  Minimum withdrawal amount is ₹500. Your available balance is ₹{displayAvail.toLocaleString('en-IN')}.
                </div>
              ) : (
                <div data-tour="partner-withdraw-form" style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 24, marginBottom: 24 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: DARK, marginBottom: 16 }}>Request a withdrawal</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 5 }}>Amount (₹) *</label>
                      <input type="number" min="500" max={displayAvail} step="1" value={wdAmount} onChange={e => setWdAmount(e.target.value)} placeholder={`500 – ${displayAvail}`} style={inputStyle} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 5 }}>Account Holder Name *</label>
                      <input type="text" value={wdName} onChange={e => setWdName(e.target.value)} placeholder="As per bank records" style={inputStyle} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 5 }}>Bank Account Number *</label>
                      <input type="text" value={wdAccount} onChange={e => setWdAccount(e.target.value)} placeholder="e.g. 123456789012" style={inputStyle} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 5 }}>IFSC Code *</label>
                      <input type="text" value={wdIfsc} onChange={e => setWdIfsc(e.target.value.toUpperCase())} placeholder="e.g. SBIN0001234" maxLength={11} style={inputStyle} />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 5 }}>UPI ID (optional)</label>
                      <input type="text" value={wdUpi} onChange={e => setWdUpi(e.target.value)} placeholder="yourname@upi" style={inputStyle} />
                    </div>
                  </div>
                  <button onClick={submitWithdrawal} disabled={wdBusy} style={{
                    padding: '11px 28px', borderRadius: 8, fontSize: 14, fontWeight: 700,
                    background: wdBusy ? '#e2e8f0' : TEAL,
                    color: wdBusy ? '#94a3b8' : WHITE,
                    border: 'none', cursor: wdBusy ? 'not-allowed' : 'pointer', colorScheme: 'light',
                  }}>
                    {wdBusy ? 'Submitting…' : 'Submit Withdrawal Request'}
                  </button>
                  <p style={{ fontSize: 11, color: MUTED, margin: '8px 0 0' }}>
                    Our team processes requests within 3–5 business days and transfers directly to your bank account.
                  </p>
                </div>
              )}

              {/* Withdrawal history */}
              <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: `1px solid ${BORDER}`, background: `${TEAL}06`, borderLeft: `4px solid ${TEAL}` }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: DARK }}>Withdrawal History</span>
                </div>
                {withdrawals.length === 0 ? (
                  <div style={{ padding: '32px 20px', textAlign: 'center', color: MUTED, fontSize: 13 }}>No withdrawals yet.</div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr>
                          {['Date', 'Amount', 'Account', 'IFSC', 'Status', 'Note'].map(h => (
                            <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: TEAL, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', borderBottom: `1.5px solid rgba(13,148,136,0.25)`, background: 'rgba(13,148,136,0.05)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {withdrawals.map((w, i) => (
                          <tr key={w.id} style={{ borderTop: i > 0 ? `1px solid ${BORDER}` : 'none', background: WHITE }}>
                            <td style={{ padding: '10px 14px', color: MUTED, fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(w.created_at)}</td>
                            <td style={{ padding: '10px 14px', fontWeight: 700, color: DARK, whiteSpace: 'nowrap' }}>₹{(w.amount_paise / 100).toLocaleString('en-IN')}</td>
                            <td style={{ padding: '10px 14px', color: MUTED, fontSize: 12, maxWidth: 140 }}>
                              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.account_name}</div>
                              <div style={{ fontSize: 11, color: '#94a3b8' }}>····{w.bank_account.slice(-4)}</div>
                            </td>
                            <td style={{ padding: '10px 14px', color: MUTED, fontSize: 12, fontFamily: 'monospace' }}>{w.bank_ifsc}</td>
                            <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>{withdrawalStatusBadge(w.status)}</td>
                            <td style={{ padding: '10px 14px', fontSize: 12, color: MUTED, maxWidth: 160 }}>
                              {w.admin_note ?? (w.status === 'paid' && w.processed_at ? `Paid on ${fmtDate(w.processed_at)}` : '—')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <p style={{ textAlign: 'center', fontSize: 12, color: '#94a3b8', marginTop: 24 }}>
                Questions? Email <a href="mailto:info@upfloat.co" style={{ color: TEAL, textDecoration: 'none' }}>info@upfloat.co</a>
              </p>
            </div>
          )}

        </main>
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: toast.type === 'error' ? '#dc2626' : DARK, color: WHITE, padding: '12px 24px', borderRadius: 10, fontSize: 13, fontWeight: 600, boxShadow: '0 8px 32px rgba(0,0,0,0.2)', zIndex: 9999, whiteSpace: 'nowrap' }}>
          {toast.msg}
        </div>
      )}

      <style>{`
        @media (max-width: 640px) {
          .partner-sidebar { display: none !important; }
        }
        @media (min-width: 641px) {
          .partner-mobile-tabs { display: none !important; }
        }
        /* Start Here is a 50/50 split on desktop; stack it on narrow screens.
           Stacked, the invite box goes FIRST — it holds the MSME / Partner
           switcher, and that switcher rewrites the explanation below it. With
           the old order the switcher sat under the text it controls, so the
           change happened off-screen. */
        @media (max-width: 1100px) {
          .partner-split { grid-template-columns: 1fr !important; }
          .partner-act     { order: 1; }
          .partner-explain { order: 2; }
        }
      `}</style>
    </div>
  )
}

function KpiCard({ label, value, sub, accent, top }: { label: string; value: string; sub: string; accent: string; top?: boolean }) {
  return (
    <div style={{ background: top ? `${accent}08` : WHITE, border: `1.5px solid ${top ? accent : BORDER}`, borderRadius: 12, padding: '16px 18px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: top ? accent : MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: accent, lineHeight: 1, marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 11, color: MUTED }}>{sub}</div>
    </div>
  )
}

function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: DARK, margin: '0 0 4px' }}>{title}</h2>
      {subtitle && <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>{subtitle}</p>}
    </div>
  )
}
