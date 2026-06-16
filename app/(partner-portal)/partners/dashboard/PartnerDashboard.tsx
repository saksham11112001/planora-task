'use client'
import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

const TEAL   = '#0d9488'
const PURPLE = '#7c3aed'
const DARK   = '#0f172a'
const MUTED  = '#64748b'
const BORDER = '#e2e8f0'

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

function fmtShort(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export function PartnerDashboard({ partner, msmeInvites: initMsme, partnerInvites: initPartner }: Props) {
  const APP_URL = typeof window !== 'undefined' ? window.location.origin : ''
  const msmeReferralUrl    = `${APP_URL}/msme-landing?ref=${partner.referral_code}`
  const partnerReferralUrl = `${APP_URL}/partners/join?ref=${partner.referral_code}`

  // Combine both invite lists, sorted by latest first
  const combined = [...initMsme.map(i => ({ ...i, invite_type: 'msme' as const })), ...initPartner.map(i => ({ ...i, invite_type: 'partner' as const }))]
    .sort((a, b) => new Date(b.last_sent_at).getTime() - new Date(a.last_sent_at).getTime())

  const [allInvites, setAllInvites] = useState<Invite[]>(combined)

  // Single email invite form
  const [email,     setEmail]     = useState('')
  const [invType,   setInvType]   = useState<'msme' | 'partner'>('msme')
  const [busy,      setBusy]      = useState(false)
  const [toast,     setToast]     = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  // Copy states
  const [copiedMsme,    setCopiedMsme]    = useState(false)
  const [copiedPartner, setCopiedPartner] = useState(false)

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
    const trimmed = email.trim()
    if (!trimmed) { showToast('Enter an email address', 'error'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) { showToast('Enter a valid email', 'error'); return }

    setBusy(true)
    try {
      const res  = await fetch('/api/partner-portal/invite', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ emails: [trimmed], invite_type: invType }),
      })
      const json = await res.json()
      if (!res.ok) { showToast(json.error ?? 'Failed to send invite', 'error'); return }

      if (json.sent > 0) {
        showToast(`Invite sent to ${trimmed}!`)
        setEmail('')
        // Merge the updated list back in
        if (Array.isArray(json.invites)) {
          setAllInvites(prev => {
            // Remove stale records for this type and re-add updated ones
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
  }, [email, invType])

  async function handleLogout() {
    await createClient().auth.signOut()
    window.location.href = '/partners/login'
  }

  const msmeCount    = allInvites.filter(i => i.invite_type === 'msme').length
  const partnerCount = allInvites.filter(i => i.invite_type === 'partner').length
  const signedUp     = allInvites.filter(i => i.signed_up).length

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', colorScheme: 'light', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>

      {/* ── Nav ───────────────────────────────────────────────────────────── */}
      <nav style={{
        background: '#fff', borderBottom: `1px solid ${BORDER}`,
        padding: '0 24px', height: 58,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, background: TEAL,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16,
          }}>🤝</div>
          <span style={{ fontWeight: 700, fontSize: 15, color: DARK }}>Partner Portal</span>
          <span style={{
            fontSize: 11, fontWeight: 600, color: TEAL,
            background: 'rgba(13,148,136,0.1)', border: '1px solid rgba(13,148,136,0.25)',
            borderRadius: 20, padding: '2px 8px',
          }}>by Planora</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 13, color: MUTED }}>Hi, {partner.name.split(' ')[0]} 👋</span>
          <button
            onClick={handleLogout}
            style={{ fontSize: 13, color: MUTED, background: 'none', border: `1px solid ${BORDER}`, borderRadius: 7, padding: '5px 12px', cursor: 'pointer' }}
          >
            Logout
          </button>
        </div>
      </nav>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 16px 64px' }}>

        {/* Welcome */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: DARK, margin: '0 0 4px' }}>
            Hey {partner.name.split(' ')[0]}! 🎉
          </h1>
          <p style={{ fontSize: 14, color: MUTED, margin: 0 }}>
            Your referral code: <strong style={{ fontFamily: 'monospace', color: TEAL, letterSpacing: '0.05em' }}>{partner.referral_code}</strong>
            {' · '}Partner since {fmtDate(partner.created_at)}
          </p>
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
          {[
            { label: 'MSME Invites', value: msmeCount,    color: TEAL   },
            { label: 'Partner Invites', value: partnerCount, color: PURPLE },
            { label: 'Signed Up',    value: signedUp,     color: '#16a34a' },
            { label: 'Total Sent',   value: allInvites.length, color: '#2563eb' },
          ].map(s => (
            <div key={s.label} style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: MUTED, marginTop: 4, fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── INVITE (top) ──────────────────────────────────────────────── */}
        <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: DARK, marginBottom: 4 }}>Invite someone</div>
          <p style={{ fontSize: 13, color: MUTED, margin: '0 0 16px', lineHeight: 1.6 }}>
            Enter one email address and choose what to invite them to — MSME Tracker or the Partner Program.
          </p>

          {/* Type toggle */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {(['msme', 'partner'] as const).map(t => (
              <button
                key={t}
                onClick={() => setInvType(t)}
                style={{
                  padding: '7px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  border: `1.5px solid ${invType === t ? (t === 'msme' ? TEAL : PURPLE) : BORDER}`,
                  background: invType === t ? (t === 'msme' ? `${TEAL}15` : `${PURPLE}12`) : '#fff',
                  color: invType === t ? (t === 'msme' ? TEAL : PURPLE) : MUTED,
                  transition: 'all 0.15s',
                }}
              >
                {t === 'msme' ? '📦 MSME Tracker' : '🤝 Partner Program'}
              </button>
            ))}
          </div>

          {/* Single email input + send */}
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') sendInvite() }}
              placeholder={invType === 'msme' ? 'business@example.com' : 'friend@example.com'}
              style={{
                flex: 1, padding: '10px 14px', border: `1px solid ${BORDER}`,
                borderRadius: 8, fontSize: 14, color: DARK, background: '#f8fafc', outline: 'none',
              }}
            />
            <button
              onClick={sendInvite}
              disabled={busy || !email.trim()}
              style={{
                padding: '10px 24px', borderRadius: 8, fontSize: 14, fontWeight: 600,
                background: busy || !email.trim() ? '#e2e8f0' : (invType === 'msme' ? TEAL : PURPLE),
                color: busy || !email.trim() ? '#94a3b8' : '#fff',
                border: 'none', cursor: busy || !email.trim() ? 'not-allowed' : 'pointer', flexShrink: 0,
                transition: 'background 0.15s',
              }}
            >
              {busy ? 'Sending…' : 'Send Invite ✉'}
            </button>
          </div>
          <p style={{ fontSize: 11, color: '#94a3b8', margin: '8px 0 0' }}>
            {invType === 'msme'
              ? "They'll get an email to try MSME Tracker — your referral code is embedded automatically."
              : "They'll get an email to join the Partner Program and start earning commissions."}
          </p>
        </div>

        {/* ── REFERRED / INVITED LIST (middle) ─────────────────────────── */}
        <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: DARK }}>Referral Activity</span>
            <span style={{ fontSize: 12, color: MUTED }}>{allInvites.length} total</span>
          </div>

          {allInvites.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: MUTED }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>📭</div>
              <div style={{ fontWeight: 600, color: DARK, marginBottom: 4 }}>No invites sent yet</div>
              <div style={{ fontSize: 13 }}>Enter an email above and send your first invite!</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Email', 'Invited to', 'Times sent', 'Status', 'Last sent'].map(h => (
                      <th key={h} style={{
                        padding: '9px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700,
                        color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em',
                        whiteSpace: 'nowrap', borderBottom: `1px solid ${BORDER}`,
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allInvites.map((inv, i) => (
                    <tr key={inv.id} style={{ borderTop: i > 0 ? `1px solid ${BORDER}` : 'none' }}>
                      <td style={{ padding: '11px 16px', fontWeight: 500, color: DARK, maxWidth: 220 }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                          {inv.email}
                        </span>
                      </td>
                      <td style={{ padding: '11px 16px' }}>
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20,
                          background: inv.invite_type === 'msme' ? 'rgba(13,148,136,0.1)' : 'rgba(124,58,237,0.1)',
                          color: inv.invite_type === 'msme' ? TEAL : PURPLE,
                        }}>
                          {inv.invite_type === 'msme' ? 'MSME Tracker' : 'Partner Program'}
                        </span>
                      </td>
                      <td style={{ padding: '11px 16px', color: MUTED, textAlign: 'center' }}>
                        {inv.invite_count}×
                      </td>
                      <td style={{ padding: '11px 16px' }}>
                        {inv.signed_up ? (
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: '#dcfce7', color: '#166534' }}>
                            ✓ Signed up
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: '#fef9c3', color: '#a16207' }}>
                            Invite sent
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '11px 16px', color: MUTED, fontSize: 12 }}>
                        {fmtShort(inv.last_sent_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── REFERRAL LINKS (bottom) ──────────────────────────────────── */}
        <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: DARK, marginBottom: 4 }}>Your Referral Links</div>
          <p style={{ fontSize: 13, color: MUTED, margin: '0 0 18px', lineHeight: 1.6 }}>
            Share these links directly — your code <strong style={{ fontFamily: 'monospace', color: TEAL }}>{partner.referral_code}</strong> is embedded in both.
          </p>

          {/* MSME Tracker link */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              📦 MSME Tracker
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{
                flex: 1, padding: '9px 12px', background: '#f8fafc', border: `1px solid ${BORDER}`,
                borderRadius: 8, fontSize: 12, color: MUTED, fontFamily: 'monospace',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {msmeReferralUrl}
              </div>
              <button
                onClick={copyMsme}
                style={{
                  padding: '9px 16px', background: copiedMsme ? '#dcfce7' : TEAL,
                  color: copiedMsme ? '#166534' : '#fff', border: 'none', borderRadius: 8,
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0, transition: 'background 0.2s',
                }}
              >
                {copiedMsme ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Partner Program link */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              🤝 Partner Program
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{
                flex: 1, padding: '9px 12px', background: '#f8fafc', border: `1px solid ${BORDER}`,
                borderRadius: 8, fontSize: 12, color: MUTED, fontFamily: 'monospace',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {partnerReferralUrl}
              </div>
              <button
                onClick={copyPartner}
                style={{
                  padding: '9px 16px', background: copiedPartner ? '#dcfce7' : PURPLE,
                  color: copiedPartner ? '#166534' : '#fff', border: 'none', borderRadius: 8,
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0, transition: 'background 0.2s',
                }}
              >
                {copiedPartner ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          </div>
        </div>

        {/* ── How it works ──────────────────────────────────────────────── */}
        <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: DARK, marginBottom: 14 }}>How the Partner Program works</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              ['Invite clients or friends', 'Send an email invite above or share your referral link directly on WhatsApp.'],
              ['They sign up', 'Anyone who uses your link or code gets tagged to you automatically.'],
              ['They upgrade → you earn', 'When someone you referred upgrades to a paid MSME or Planora plan, you earn a commission.'],
              ['Monthly payouts', 'Commissions are reviewed monthly. Contact us at info@sng-adwisers.com to request a payout.'],
            ].map(([title, desc], i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', background: TEAL,
                  color: '#fff', fontSize: 11, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
                }}>{i + 1}</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: DARK, marginBottom: 2 }}>{title}</div>
                  <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.6 }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: '#94a3b8', marginTop: 28 }}>
          Questions? Ping us at{' '}
          <a href="mailto:info@sng-adwisers.com" style={{ color: TEAL, textDecoration: 'none' }}>info@sng-adwisers.com</a>
        </p>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: toast.type === 'error' ? '#dc2626' : DARK,
          color: '#fff', padding: '12px 24px', borderRadius: 10, fontSize: 13, fontWeight: 600,
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)', zIndex: 9999, whiteSpace: 'nowrap',
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
