'use client'

import { useState, useEffect, useCallback } from 'react'

const STEPS = [
  { id: 'kyc',               label: 'Collect KYC documents (PAN, Aadhaar, photograph)' },
  { id: 'gstin',             label: 'Verify GSTIN and update client profile' },
  { id: 'dsc',               label: 'Record DSC expiry date and holder name' },
  { id: 'portal_creds',      label: 'Add portal credentials (IT, GST, MCA logins)' },
  { id: 'engagement_letter', label: 'Get engagement letter / authority letter signed' },
  { id: 'prev_returns',      label: 'Collect last 3 years\' returns for review' },
  { id: 'notices',           label: 'Check for any pending IT/GST notices' },
]

interface ClientOnboardingChecklistProps {
  clientId: string
  clientName: string
  canManage: boolean
}

export default function ClientOnboardingChecklist({ clientId, clientName, canManage }: ClientOnboardingChecklistProps) {
  const storageKey  = `upfloat_client_ob_${clientId}`
  const dismissKey  = `upfloat_client_ob_${clientId}_done`

  const [dismissed, setDismissed]   = useState(true) // start hidden until hydration
  const [completed, setCompleted]   = useState<string[]>([])
  const [collapsed, setCollapsed]   = useState(false)
  const [allDone, setAllDone]       = useState(false)

  useEffect(() => {
    if (localStorage.getItem(dismissKey) === '1') {
      setDismissed(true)
      return
    }
    setDismissed(false)
    try {
      const stored: string[] = JSON.parse(localStorage.getItem(storageKey) ?? '[]')
      setCompleted(stored)
    } catch {
      setCompleted([])
    }
  }, [storageKey, dismissKey])

  const dismiss = useCallback(() => {
    localStorage.setItem(dismissKey, '1')
    setDismissed(true)
  }, [dismissKey])

  function toggle(id: string) {
    const next = completed.includes(id)
      ? completed.filter(c => c !== id)
      : [...completed, id]
    setCompleted(next)
    localStorage.setItem(storageKey, JSON.stringify(next))

    if (next.length === STEPS.length) {
      setAllDone(true)
      setTimeout(() => dismiss(), 3000)
    } else {
      setAllDone(false)
    }
  }

  if (!canManage || dismissed) return null

  const doneCount = completed.length
  const pct       = Math.round((doneCount / STEPS.length) * 100)

  return (
    <div
      style={{
        border: '1px solid #d1fae5',
        borderRadius: 10,
        background: '#f0fdf4',
        marginBottom: 24,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onClick={() => setCollapsed(c => !c)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>📋</span>
          <span style={{ fontWeight: 600, fontSize: 14, color: '#065f46' }}>
            Client Onboarding Checklist
          </span>
          <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 4 }}>
            {doneCount}/{STEPS.length} done
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={e => { e.stopPropagation(); dismiss() }}
            style={{
              fontSize: 11,
              padding: '2px 8px',
              borderRadius: 5,
              border: '1px solid #a7f3d0',
              background: 'transparent',
              color: '#6b7280',
              cursor: 'pointer',
            }}
          >
            Dismiss
          </button>
          <span style={{ fontSize: 12, color: '#6b7280' }}>{collapsed ? '▸' : '▾'}</span>
        </div>
      </div>

      {!collapsed && (
        <div style={{ padding: '0 16px 16px' }}>
          {/* Progress bar */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ height: 6, background: '#d1fae5', borderRadius: 4, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  borderRadius: 4,
                  background: '#10b981',
                  width: `${pct}%`,
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>

          {/* Steps */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {STEPS.map(step => {
              const done = completed.includes(step.id)
              return (
                <label
                  key={step.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    cursor: 'pointer',
                    fontSize: 13,
                    color: done ? '#9ca3af' : '#1f2937',
                    textDecoration: done ? 'line-through' : 'none',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={done}
                    onChange={() => toggle(step.id)}
                    style={{ width: 15, height: 15, accentColor: '#10b981', cursor: 'pointer', flexShrink: 0 }}
                  />
                  {step.label}
                </label>
              )
            })}
          </div>

          {/* Success banner */}
          {allDone && (
            <div
              style={{
                marginTop: 14,
                padding: '10px 14px',
                background: '#dcfce7',
                borderRadius: 7,
                fontSize: 13,
                color: '#166534',
                fontWeight: 600,
                textAlign: 'center',
              }}
            >
              ✅ Onboarding complete! Dismissing in a moment…
            </div>
          )}
        </div>
      )}
    </div>
  )
}
