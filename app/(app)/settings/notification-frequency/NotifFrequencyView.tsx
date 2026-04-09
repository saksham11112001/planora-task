'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from '@/store/appStore'

interface Props {
  currentMode: 'immediate' | 'digest'
  isAdmin:     boolean
}

export function NotifFrequencyView({ currentMode, isAdmin }: Props) {
  const router = useRouter()
  const [mode,   setMode]   = useState<'immediate' | 'digest'>(currentMode)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/settings/notification-frequency', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ mode }),
      })
      const data = await res.json()
      if (res.ok) { toast.success('Notification frequency updated!'); router.refresh() }
      else        { toast.error(data.error ?? 'Failed to save') }
    } finally { setSaving(false) }
  }

  const options = [
    {
      value:   'immediate' as const,
      label:   'Immediate',
      desc:    'Every email is sent the moment it\'s triggered — task assigned, comment posted, approval requested, etc.',
      note:    'One email per event type per user per day (deduplication is active).',
      icon:    '⚡',
      color:   '#0d9488',
    },
    {
      value:   'digest' as const,
      label:   'Digest (twice daily)',
      desc:    'All notifications are batched and sent in two compiled summary emails per day — 8:00 AM IST and 6:00 PM IST.',
      note:    'If nothing new happened since the last digest, no email is sent. Reduces inbox noise significantly.',
      icon:    '📬',
      color:   '#7c3aed',
    },
  ]

  return (
    <div style={{ maxWidth: 560 }}>

      {/* Info banner */}
      <div style={{ padding: '12px 16px', borderRadius: 10, marginBottom: 24,
        background: 'rgba(13,148,136,0.08)', border: '1px solid rgba(13,148,136,0.2)' }}>
        <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: 0, lineHeight: 1.5 }}>
          <strong>Org-wide setting.</strong> This applies to all email notifications sent from your organisation.
          Individual members can still turn specific events on/off in their own{' '}
          <a href="/settings/notifications" style={{ color: 'var(--brand)', fontWeight: 600, textDecoration: 'none' }}>
            Notification preferences
          </a>.
        </p>
      </div>

      {/* Mode cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
        {options.map(opt => {
          const selected = mode === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => isAdmin && setMode(opt.value)}
              disabled={!isAdmin}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 14,
                padding: '16px 18px', borderRadius: 12, textAlign: 'left',
                border: selected ? `2px solid ${opt.color}` : '1.5px solid var(--border)',
                background: selected ? `rgba(${opt.color === '#0d9488' ? '13,148,136' : '124,58,237'},0.06)` : 'var(--surface)',
                cursor: isAdmin ? 'pointer' : 'not-allowed',
                opacity: !isAdmin ? 0.6 : 1,
                transition: 'all 0.15s', fontFamily: 'inherit',
                boxShadow: selected ? `0 2px 12px ${opt.color}20` : 'none',
              }}>
              {/* Radio circle */}
              <div style={{ flexShrink: 0, marginTop: 2 }}>
                <div style={{
                  width: 18, height: 18, borderRadius: '50%',
                  border: selected ? `5px solid ${opt.color}` : '2px solid var(--border)',
                  background: selected ? '#fff' : 'transparent',
                  transition: 'all 0.15s',
                }}/>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 18, lineHeight: 1 }}>{opt.icon}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: selected ? opt.color : 'var(--text-primary)' }}>
                    {opt.label}
                  </span>
                  {opt.value === 'digest' && (
                    <span style={{ fontSize: 10, fontWeight: 700, background: '#7c3aed', color: '#fff',
                      padding: '1px 7px', borderRadius: 99 }}>RECOMMENDED</span>
                  )}
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 6px', lineHeight: 1.5 }}>
                  {opt.desc}
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>
                  {opt.note}
                </p>
              </div>
            </button>
          )
        })}
      </div>

      {/* Digest schedule detail */}
      {mode === 'digest' && (
        <div style={{ padding: '14px 16px', borderRadius: 10, marginBottom: 24,
          background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.18)' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed', margin: '0 0 8px',
            textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Digest schedule
          </p>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {[
              { time: '8:00 AM IST', label: 'Morning digest', desc: 'Covers overnight activity' },
              { time: '6:00 PM IST', label: 'Evening digest', desc: 'Covers the working day' },
            ].map(d => (
              <div key={d.time} style={{ display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px', borderRadius: 8,
                background: 'var(--surface)', border: '1px solid rgba(124,58,237,0.15)',
                flex: '1 1 200px' }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(124,58,237,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  fontSize: 16 }}>🕗</div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#7c3aed', margin: 0 }}>{d.time}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '1px 0 0' }}>{d.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '10px 0 0' }}>
            If no new notifications exist at send time, the digest is skipped — no empty emails.
          </p>
        </div>
      )}

      {!isAdmin && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
          Only owners and admins can change this setting.
        </p>
      )}

      {isAdmin && (
        <button
          onClick={handleSave}
          disabled={saving || mode === currentMode}
          style={{
            padding: '10px 28px', borderRadius: 8, border: 'none',
            background: mode === currentMode ? 'var(--border)' : 'var(--brand)',
            color: mode === currentMode ? 'var(--text-muted)' : '#fff',
            fontSize: 13, fontWeight: 600, cursor: mode === currentMode ? 'default' : 'pointer',
            fontFamily: 'inherit', transition: 'all 0.15s',
          }}>
          {saving ? 'Saving…' : mode === currentMode ? 'No changes' : 'Save frequency setting'}
        </button>
      )}
    </div>
  )
}
