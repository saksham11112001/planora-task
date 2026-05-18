'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChecklistStep {
  id:       string
  emoji:    string
  label:    string
  detail:   string
  href:     string
  pageVisit?: string   // pathname that auto-completes this step
}

const STEPS: ChecklistStep[] = [
  {
    id:        'tour',
    emoji:     '🎬',
    label:     'Watch the product tour',
    detail:    'A 90-second walkthrough of every feature in Planora.',
    href:      '/walkthrough',
  },
  {
    id:        'client',
    emoji:     '👤',
    label:     'Add your first client',
    detail:    'Enter GSTIN and business details auto-fill. Compliance tasks generate automatically.',
    href:      '/clients',
    pageVisit: '/clients',
  },
  {
    id:        'compliance',
    emoji:     '⚖️',
    label:     'Generate compliance tasks',
    detail:    'Select tasks (GSTR, TDS, ITR…), pick clients, and Planora creates everything on the right due dates.',
    href:      '/compliance',
    pageVisit: '/compliance',
  },
  {
    id:        'team',
    emoji:     '👥',
    label:     'Invite a team member',
    detail:    'Settings → Team → Invite. They get an email link and can log in immediately.',
    href:      '/settings',
    pageVisit: '/settings',
  },
  {
    id:        'task',
    emoji:     '✅',
    label:     'Create a quick task',
    detail:    'Quick Tasks are for ad-hoc work outside compliance — calls, drafts, follow-ups.',
    href:      '/tasks',
    pageVisit: '/tasks',
  },
  {
    id:        'recurring',
    emoji:     '🔁',
    label:     'Set up a recurring task',
    detail:    'Repeat Tasks auto-spawn a fresh copy on schedule. Monthly, quarterly, or custom.',
    href:      '/recurring',
    pageVisit: '/recurring',
  },
  {
    id:        'calendar',
    emoji:     '📅',
    label:     'Check the deadline calendar',
    detail:    'Every task due date for all clients and team members in one view.',
    href:      '/calendar',
    pageVisit: '/calendar',
  },
  {
    id:        'approval',
    emoji:     '✔️',
    label:     'Review the approval workflow',
    detail:    'My Tasks → Needs Approval. When a team member submits work, you approve or return it here.',
    href:      '/tasks',
  },
]

const PREFIX   = 'planora_ob_v1_'
const MAX_DAYS = 30

function key(userId: string, stepId: string) {
  return `${PREFIX}${userId}_${stepId}`
}
function dismissKey(userId: string) {
  return `${PREFIX}${userId}_dismissed`
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  userId:        string
  userCreatedAt: string
}

export function OnboardingChecklist({ userId, userCreatedAt }: Props) {
  const router   = useRouter()
  const pathname = usePathname()

  const [mounted,    setMounted]    = useState(false)
  const [visible,    setVisible]    = useState(false)
  const [collapsed,  setCollapsed]  = useState(false)
  const [completed,  setCompleted]  = useState<Record<string, boolean>>({})
  const [expanding,  setExpanding]  = useState<string | null>(null)

  // ── Bootstrap on mount ────────────────────────────────────────────────────
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return

    // Only show for accounts < MAX_DAYS old
    const ageMs = Date.now() - new Date(userCreatedAt).getTime()
    if (ageMs > MAX_DAYS * 24 * 60 * 60 * 1000) return

    // Don't show if permanently dismissed
    if (localStorage.getItem(dismissKey(userId)) === 'permanent') return

    // Load completion state
    const state: Record<string, boolean> = {}
    STEPS.forEach(s => {
      state[s.id] = localStorage.getItem(key(userId, s.id)) === '1'
    })
    setCompleted(state)
    setVisible(true)
    // Start collapsed on return visits (after first 3 days)
    const ageDays = ageMs / (24 * 60 * 60 * 1000)
    setCollapsed(ageDays > 3)
  }, [mounted, userId, userCreatedAt])

  // ── Auto-complete based on page visits ───────────────────────────────────
  useEffect(() => {
    if (!visible) return
    STEPS.forEach(s => {
      if (!s.pageVisit) return
      if (pathname.startsWith(s.pageVisit) && !completed[s.id]) {
        markDone(s.id)
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, visible])

  // ── Helpers ───────────────────────────────────────────────────────────────
  const markDone = useCallback((stepId: string) => {
    localStorage.setItem(key(userId, stepId), '1')
    setCompleted(prev => ({ ...prev, [stepId]: true }))
  }, [userId])

  function handleStepClick(step: ChecklistStep) {
    setExpanding(step.id)
    setTimeout(() => {
      markDone(step.id)
      setExpanding(null)
      router.push(step.href)
    }, 350)
  }

  function dismiss(permanent = false) {
    if (permanent) {
      localStorage.setItem(dismissKey(userId), 'permanent')
    }
    setVisible(false)
  }

  // ── Derived state ─────────────────────────────────────────────────────────
  const doneCount = Object.values(completed).filter(Boolean).length
  const total     = STEPS.length
  const pct       = Math.round((doneCount / total) * 100)
  const allDone   = doneCount === total

  if (!mounted || !visible) return null

  // ── Minimal pill when collapsed ────────────────────────────────────────────
  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        style={{
          position: 'fixed', bottom: 80, right: 20, zIndex: 999,
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 14px', borderRadius: 24,
          background: 'var(--surface)',
          border: '1.5px solid var(--border)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          cursor: 'pointer', fontFamily: 'inherit',
        }}
        aria-label="Open setup checklist"
      >
        {/* Arc progress ring */}
        <svg width="28" height="28" viewBox="0 0 28 28">
          <circle cx="14" cy="14" r="11" fill="none" stroke="var(--border)" strokeWidth="2.5"/>
          <circle cx="14" cy="14" r="11" fill="none" stroke="var(--brand)" strokeWidth="2.5"
            strokeDasharray={`${2 * Math.PI * 11 * pct / 100} 999`}
            strokeLinecap="round" transform="rotate(-90 14 14)"/>
          <text x="14" y="18" textAnchor="middle" fontSize="7" fontWeight="700" fill="var(--brand)">
            {doneCount}/{total}
          </text>
        </svg>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
          Setup guide
        </span>
      </button>
    )
  }

  // ── Full panel ─────────────────────────────────────────────────────────────
  return (
    <div
      role="complementary"
      aria-label="Onboarding checklist"
      style={{
        position: 'fixed', bottom: 20, right: 20, zIndex: 999,
        width: 320, maxHeight: '80vh',
        background: 'var(--surface)',
        border: '1.5px solid var(--border)',
        borderRadius: 16,
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden', fontFamily: 'inherit',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '14px 16px 12px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface-subtle)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
            {allDone ? '🎉 Setup complete!' : '🚀 Get started'}
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={() => setCollapsed(true)}
              style={{ padding: '2px 6px', borderRadius: 6, border: '1px solid var(--border)',
                background: 'transparent', cursor: 'pointer', fontSize: 14, color: 'var(--text-secondary)', fontFamily: 'inherit' }}
              title="Minimise"
              aria-label="Minimise checklist"
            >−</button>
            <button
              onClick={() => dismiss(false)}
              style={{ padding: '2px 6px', borderRadius: 6, border: '1px solid var(--border)',
                background: 'transparent', cursor: 'pointer', fontSize: 14, color: 'var(--text-secondary)', fontFamily: 'inherit' }}
              title="Close"
              aria-label="Close checklist"
            >×</button>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            flex: 1, height: 6, background: 'var(--border)',
            borderRadius: 3, overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', borderRadius: 3,
              width: `${pct}%`,
              background: allDone ? '#16a34a' : 'var(--brand)',
              transition: 'width 0.4s ease',
            }}/>
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: allDone ? '#16a34a' : 'var(--brand)', flexShrink: 0 }}>
            {doneCount}/{total}
          </span>
        </div>

        {allDone && (
          <p style={{ fontSize: 12, color: '#16a34a', margin: '8px 0 0', lineHeight: 1.4 }}>
            You&apos;ve set up everything. Your firm is ready to run on Planora.
          </p>
        )}
      </div>

      {/* Steps list */}
      <div style={{ overflowY: 'auto', flex: 1, background: 'var(--surface)' }}>
        {STEPS.map((step, i) => {
          const done = !!completed[step.id]
          const isExpanding = expanding === step.id
          return (
            <div
              key={step.id}
              style={{
                borderBottom: i < STEPS.length - 1 ? '1px solid var(--border-light)' : 'none',
                transition: 'background 0.15s',
              }}
            >
              <div
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '12px 16px',
                  opacity: isExpanding ? 0.6 : 1,
                  cursor: done ? 'default' : 'pointer',
                  transition: 'opacity 0.2s',
                }}
                onClick={() => !done && handleStepClick(step)}
                role={done ? undefined : 'button'}
                tabIndex={done ? -1 : 0}
                onKeyDown={e => { if (!done && (e.key === 'Enter' || e.key === ' ')) handleStepClick(step) }}
                aria-label={done ? `${step.label} — completed` : `${step.label} — click to start`}
              >
                {/* Checkbox */}
                <div style={{
                  width: 20, height: 20, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: done ? 'var(--brand)' : 'transparent',
                  border: done ? '2px solid var(--brand)' : '2px solid var(--border)',
                  transition: 'all 0.25s',
                }}>
                  {done && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5.5L4 7.5L8 3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: 14 }}>{step.emoji}</span>
                    <span style={{
                      fontSize: 13, fontWeight: 600,
                      color: done ? 'var(--text-muted)' : 'var(--text-primary)',
                      textDecoration: done ? 'line-through' : 'none',
                    }}>
                      {step.label}
                    </span>
                  </div>
                  {!done && (
                    <p style={{
                      margin: 0, fontSize: 12, color: 'var(--text-muted)',
                      lineHeight: 1.4,
                    }}>
                      {step.detail}
                    </p>
                  )}
                </div>

                {/* Arrow */}
                {!done && (
                  <span style={{
                    fontSize: 16, color: 'var(--brand)', flexShrink: 0, marginTop: 1,
                    opacity: isExpanding ? 0 : 1, transition: 'opacity 0.2s',
                  }}>→</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div style={{
        padding: '10px 16px',
        borderTop: '1px solid var(--border)',
        background: 'var(--surface-subtle)',
        flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <button
          onClick={() => router.push('/walkthrough')}
          style={{
            fontSize: 12, color: 'var(--brand)', background: 'transparent',
            border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit',
            textDecoration: 'underline',
          }}
        >
          Rewatch tour
        </button>
        <button
          onClick={() => dismiss(true)}
          style={{
            fontSize: 12, color: 'var(--text-muted)', background: 'transparent',
            border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit',
          }}
          title="Dismiss this checklist permanently"
        >
          Don&apos;t show again
        </button>
      </div>
    </div>
  )
}
