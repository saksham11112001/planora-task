'use client'
import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

const ACCENT = '#0d9488'

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

interface Props {
  partner: Partner
  msmeInvites: Invite[]
  partnerInvites: Invite[]
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function Toast({ msg, type }: { msg: string; type: 'success' | 'error' }) {
  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      background: type === 'success' ? '#0f172a' : '#dc2626',
      color: '#fff', padding: '12px 24px', borderRadius: 10, fontSize: 13, fontWeight: 600,
      boxShadow: '0 8px 32px rgba(0,0,0,0.2)', zIndex: 9999, whiteSpace: 'nowrap',
    }}>
      {msg}
    </div>
  )
}

export function PartnerDashboard({ partner, msmeInvites: initMsme, partnerInvites: initPartner }: Props) {
  const APP_URL = typeof window !== 'undefined' ? window.location.origin : ''
  const msmeReferralUrl    = `${APP_URL}/msme-landing?ref=${partner.referral_code}`
  const partnerReferralUrl = `${APP_URL}/partners/join?ref=${partner.referral_code}`

  const [msmeInvites,    setMsmeInvites]    = useState<Invite[]>(initMsme)
  const [partnerInvites, setPartnerInvites] = useState<Invite[]>(initPartner)

  const [msmeEmails,    setMsmeEmails]    = useState('')
  const [partnerEmails, setPartnerEmails] = useState('')
  const [msmeBusy,      setMsmeBusy]      = useState(false)
  const [partnerBusy,   setPartnerBusy]   = useState(false)
  const [copiedMsme,    setCopiedMsme]    = useState(false)
  const [copiedPartner, setCopiedPartner] = useState(false)
  const [toast,         setToast]         = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  function copyMsme() {
    navigator.clipboard.writeText(msmeReferralUrl)
    setCopiedMsme(true); setTimeout(() => setCopiedMsme(false), 2000)
    showToast('MSME Tracker link copied!')
  }

  function copyPartner() {
    navigator.clipboard.writeText(partnerReferralUrl)
    setCopiedPartner(true); setTimeout(() => setCopiedPartner(false), 2000)
    showToast('Partner invite link copied!')
  }

  const sendInvites = useCallback(async (type: 'msme' | 'partner') => {
    const raw    = type === 'msme' ? msmeEmails : partnerEmails
    const emails = raw.split(/[\n,;]+/).map(e => e.trim()).filter(Boolean)
    if (emails.length === 0) { showToast('Enter at least one email', 'error'); return }
    if (emails.length > 20)  { showToast('Max 20 emails per batch', 'error'); return }

    if (type === 'msme') setMsmeBusy(true); else setPartnerBusy(true)
    try {
      const res  = await fetch('/api/partner-portal/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails, invite_type: type }),
      })
      const json = await res.json()
      if (!res.ok) { showToast(json.error ?? 'Failed to send invites', 'error'); return }

      showToast(`${json.sent} invite${json.sent !== 1 ? 's' : ''} sent!`)
      if (type === 'msme') { setMsmeEmails(''); setMsmeInvites(json.invites ?? []) }
      else                 { setPartnerEmails(''); setPartnerInvites(json.invites ?? []) }
    } catch { showToast('Network error', 'error') }
    finally { if (type === 'msme') setMsmeBusy(false); else setPartnerBusy(false) }
  }, [msmeEmails, partnerEmails])

  async function handleLogout() {
    await createClient().auth.signOut()
    window.location.href = '/partners/login'
  }

  const msmeSignedUp    = msmeInvites.filter(i => i.signed_up).length
  const partnerSignedUp = partnerInvites.filter(i => i.signed_up).length

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', colorScheme: 'light' }}>

      {/* ── Nav ── */}
      <nav style={{
        background: '#fff', borderBottom: '1px solid #e2e8f0',
        padding: '0 24px', height: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🤝</div>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>Partner Portal</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 13, color: '#64748b' }}>Hi, {partner.name}</span>
          <button
            onClick={handleLogout}
            style={{ fontSize: 13, color: '#64748b', background: 'none', border: '1px solid #e2e8f0', borderRadius: 7, padding: '5px 12px', cursor: 'pointer' }}
          >
            Logout
          </button>
        </div>
      </nav>

      {/* ── Body ── */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 16px' }}>

        {/* Welcome */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: '0 0 4px' }}>Hey {partner.name.split(' ')[0]}! 👋</h1>
          <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>
            Your code: <strong style={{ fontFamily: 'monospace', color: ACCENT }}>{partner.referral_code}</strong> · Share it, earn on every paid signup.
          </p>
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 32 }}>
          {[
            { label: 'MSME invites out',    value: msmeInvites.length,    color: ACCENT },
            { label: 'Signed up',           value: msmeSignedUp,          color: '#2563eb' },
            { label: 'Partner invites out', value: partnerInvites.length, color: '#7c3aed' },
            { label: 'Partners joined',     value: partnerSignedUp,       color: '#16a34a' },
          ].map(s => (
            <div key={s.label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '16px 18px' }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Two invite cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 20 }}>

          {/* ── Card 1: MSME Tracker ── */}
          <InviteCard
            icon="📦"
            title="Refer a CA / Business Friend"
            description="Know a CA or business that needs MSME compliance sorted? Send them your link — you earn when they upgrade."
            accentColor={ACCENT}
            referralUrl={msmeReferralUrl}
            copied={copiedMsme}
            onCopy={copyMsme}
            emails={msmeEmails}
            onEmailsChange={setMsmeEmails}
            busy={msmeBusy}
            onSend={() => sendInvites('msme')}
            invites={msmeInvites}
          />

          {/* ── Card 2: Partner Program ── */}
          <InviteCard
            icon="🤝"
            title="Grow Your Network"
            description="Know someone who can refer clients too? Bring them in as a partner — when they earn, you do too."
            accentColor="#7c3aed"
            referralUrl={partnerReferralUrl}
            copied={copiedPartner}
            onCopy={copyPartner}
            emails={partnerEmails}
            onEmailsChange={setPartnerEmails}
            busy={partnerBusy}
            onSend={() => sendInvites('partner')}
            invites={partnerInvites}
          />
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: '#94a3b8', marginTop: 32 }}>
          With you since {fmtDate(partner.created_at)} · Ping us at info@sng-adwisers.com
        </p>
      </div>

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  )
}

// ── Reusable invite card ──────────────────────────────────────────────────────

interface CardProps {
  icon: string
  title: string
  description: string
  accentColor: string
  referralUrl: string
  copied: boolean
  onCopy: () => void
  emails: string
  onEmailsChange: (v: string) => void
  busy: boolean
  onSend: () => void
  invites: Invite[]
}

function InviteCard({ icon, title, description, accentColor, referralUrl, copied, onCopy, emails, onEmailsChange, busy, onSend, invites }: CardProps) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
      {/* Card header */}
      <div style={{ background: `${accentColor}10`, borderBottom: `1px solid ${accentColor}20`, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 22 }}>{icon}</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>{title}</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{description}</div>
        </div>
      </div>

      <div style={{ padding: 20 }}>
        {/* Referral link */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Your link</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{
              flex: 1, padding: '8px 12px', background: '#f8fafc', border: '1px solid #e2e8f0',
              borderRadius: 7, fontSize: 12, color: '#64748b', fontFamily: 'monospace',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {referralUrl}
            </div>
            <button
              onClick={onCopy}
              style={{
                padding: '8px 14px', background: copied ? '#dcfce7' : accentColor, color: copied ? '#166534' : '#fff',
                border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
                transition: 'background 0.2s',
              }}
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Email invite */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Or email them directly</div>
          <textarea
            value={emails}
            onChange={e => onEmailsChange(e.target.value)}
            placeholder={'one@email.com\nanother@email.com'}
            rows={3}
            style={{
              width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 8,
              fontSize: 13, color: '#0f172a', background: '#f8fafc', resize: 'vertical',
              fontFamily: 'inherit', lineHeight: 1.5, boxSizing: 'border-box', outline: 'none',
            }}
          />
          <div style={{ fontSize: 11, color: '#94a3b8', margin: '4px 0 10px' }}>One email per line · Max 20</div>
          <button
            onClick={onSend}
            disabled={busy || !emails.trim()}
            style={{
              width: '100%', padding: '10px 0', background: busy || !emails.trim() ? '#e2e8f0' : accentColor,
              color: busy || !emails.trim() ? '#94a3b8' : '#fff',
              border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
              cursor: busy || !emails.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            {busy ? 'Sending…' : 'Send Invites'}
          </button>
        </div>

        {/* Invite history */}
        {invites.length > 0 && (
          <div style={{ marginTop: 20, borderTop: '1px solid #f1f5f9', paddingTop: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
              Sent ({invites.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0, border: '1px solid #f1f5f9', borderRadius: 8, overflow: 'hidden' }}>
              {invites.slice(0, 8).map((inv, i) => (
                <div key={inv.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', background: i % 2 === 0 ? '#f8fafc' : '#fff', fontSize: 13,
                  borderTop: i > 0 ? '1px solid #f1f5f9' : 'none',
                }}>
                  <span style={{ color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{inv.email}</span>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center', marginLeft: 8 }}>
                    {inv.signed_up && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: '#dcfce7', color: '#166534' }}>Signed up</span>
                    )}
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>{inv.invite_count > 1 ? `${inv.invite_count}×` : ''} {new Date(inv.last_sent_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
