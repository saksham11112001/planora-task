'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChecklistStep {
  id:        string
  emoji:     string
  label:     string
  detail:    string
  substeps:  string[]   // numbered action steps shown when expanded
  href:      string
  pageVisit?: string    // pathname that auto-completes this step
}

const STEPS: ChecklistStep[] = [
  {
    id:    'tour',
    emoji: '🎬',
    label: 'Watch the product tour',
    detail: 'A full walkthrough of every upFloat feature — clients, compliance, tasks, approvals, reports, and more. Takes about 3 minutes and answers most questions before you even ask them.',
    substeps: [
      'Click the arrow to open the tour in full-screen',
      'Use arrow keys or the Next button to move between slides',
      'Each slide shows the exact menu path to find the feature',
    ],
    href: '/walkthrough',
  },
  {
    id:        'client',
    emoji:     '👤',
    label:     'Add or import your clients',
    detail:    'Every client gets their own workspace — compliance tasks, documents, and team notes all in one place. Add manually (GSTIN auto-fills the name and state) or bulk-import from an Excel file.',
    substeps: [
      'Sidebar → Clients → click + Add Client',
      'Type the GSTIN — name, state, and entity type fill automatically',
      'To import many clients: click Import, download the template, fill it, upload',
    ],
    href:      '/clients',
    pageVisit: '/clients',
  },
  {
    id:    'groups',
    emoji: '📁',
    label: 'Organise clients into groups',
    detail: 'Groups let you manage clients by category — GST Clients, Audit Clients, Individual ITR, Manufacturing, etc. Once grouped, you can generate filings, filter Kanban, and pull reports for an entire group at once.',
    substeps: [
      'Sidebar → Clients → Groups tab → + New Group',
      'Give the group a name (e.g. "GST Clients" or "Audit Clients")',
      'Assign existing clients to the group from the client form or drag-and-drop',
    ],
    href:      '/clients',
    pageVisit: '/clients',
  },
  {
    id:        'compliance',
    emoji:     '⚖️',
    label:     'Generate compliance tasks',
    detail:    'In 3 clicks, upFloat creates one task per client with the correct statutory due date for every filing type you select. No manual entry, no missed deadlines — 69+ task types come pre-loaded.',
    substeps: [
      'Sidebar → CA Compliance → click Generate Tasks',
      'Step 1: tick the filing types — GSTR-1, GSTR-3B, TDS Q1-Q4, ITR, ROC, PF, ESI, PT…',
      'Step 2: choose clients (individual, by group, or select all)',
      'Step 3: click Generate — all tasks appear on your Kanban instantly',
    ],
    href:      '/compliance',
    pageVisit: '/compliance',
  },
  {
    id:    'nil-attach',
    emoji: '📎',
    label: 'File a return and attach documents',
    detail: 'Click any compliance task to open its detail panel. Attach the acknowledgement, computation sheet, and challan to the correct slots. For clients with no transactions this period, tick the NIL Return checkbox — no documents needed.',
    substeps: [
      'CA Compliance (or Kanban) → click any task card to open the panel',
      'To mark NIL: tick the "Mark as NIL Return" checkbox — task closes automatically',
      'To attach: click Upload File, or paste a Google Drive / Dropbox link',
      'Each task type has its own slots: Acknowledgement, Computation, Challan, Others',
    ],
    href:      '/compliance',
    pageVisit: '/compliance',
  },
  {
    id:        'team',
    emoji:     '👥',
    label:     'Invite your team members',
    detail:    'Add every staff member before assigning tasks. They receive a magic-link email and can log in immediately — no password setup, no app download. Choose a role that controls what each person can see and do.',
    substeps: [
      'Sidebar → Settings → Team tab → + Invite Member',
      'Enter their email address and choose a role: Owner / Admin / Manager / Member',
      'Member: sees only their own assigned tasks · Manager: sees all tasks, can approve work',
      'They get an email with a one-click login link',
    ],
    href:      '/settings',
    pageVisit: '/settings',
  },
  {
    id:    'task',
    emoji: '✅',
    label: 'Create a task and assign it',
    detail: 'Ad-hoc tasks are for work that is not a compliance filing — client calls, document drafts, follow-ups, internal work. Create one, set a due date and priority, and assign it to a team member. They will see it in My Tasks immediately.',
    substeps: [
      'Sidebar → My Tasks → + New Task button (top right)',
      'Enter a title, set the due date, and choose a priority (Urgent / High / Medium / Low)',
      'Assign to a team member — they get an in-app notification',
      'Optional: set an Approver — the assigned person must submit for their review when done',
    ],
    href:      '/tasks',
    pageVisit: '/tasks',
  },
  {
    id:    'kanban',
    emoji: '📊',
    label: 'Use the Kanban board to track work',
    detail: 'The Kanban board is your firm\'s visual task tracker. Every task sits in a column matching its status. Drag cards to change status. Overdue tasks are highlighted in red automatically — nothing hides in the wrong column.',
    substeps: [
      'Sidebar → My Tasks → Board tab (default view)',
      'Drag any card left or right to change its status — To Do → In Progress → In Review → Done',
      'Use the filter bar to narrow by client, assignee, priority, or date range',
      'Switch to List view (top-right toggle) for a sortable table of all tasks',
    ],
    href:      '/tasks',
    pageVisit: '/tasks',
  },
  {
    id:        'approval',
    emoji:     '✔️',
    label:     'Try the approval workflow',
    detail:    'When a team member finishes a task, they submit it for review. You get an email notification and it appears in your Needs Approval tab. Approve it (task closes with a timestamp) or return it with a comment (sends it back for revision).',
    substeps: [
      'My Tasks → Needs Approval tab — all pending reviews appear here',
      'Assignee side: open the task → click Submit for Review',
      'Approver side: click Approve to close the task, or Return with a comment to reopen it',
      'Every action is logged: who approved what and when — permanent audit trail',
    ],
    href:      '/tasks',
  },
  {
    id:        'recurring',
    emoji:     '🔁',
    label:     'Set up a recurring task',
    detail:    'For work that repeats on a schedule — monthly billing, weekly calls, quarterly reports — create it once as a template. upFloat spawns a fresh independent copy automatically before each due date. The assignee is inherited from the template.',
    substeps: [
      'Sidebar → Repeat Tasks → + New Recurring Task',
      'Choose frequency: daily / weekly on specific days / monthly / quarterly / annual',
      'Set assignee and approver — every spawned instance inherits these automatically',
      'Each instance is independent: its own status, attachments, and comments',
    ],
    href:      '/recurring',
    pageVisit: '/recurring',
  },
  {
    id:        'calendar',
    emoji:     '📅',
    label:     'Check the deadline calendar',
    detail:    'The Calendar plots every due date — compliance, recurring, and ad-hoc — on one month view. Use it for weekly planning meetings. Filter to a single team member or client to see their exact workload for the month.',
    substeps: [
      'Sidebar → Calendar',
      'Colour codes: Amber = CA filings · Violet = projects · Teal = recurring · Cyan = one-off',
      'Click any dot to open that task directly',
      'Use the filter bar to narrow to one team member\'s schedule or one client\'s deadlines',
    ],
    href:      '/calendar',
    pageVisit: '/calendar',
  },
  {
    id:    'monitor',
    emoji: '📡',
    label: 'Open Monitor to see team workload',
    detail: 'Monitor is the management dashboard — visible to Managers, Admins, and Owners. It shows every team member\'s task count, overdue items, and in-review tasks in real time. Stop asking "what\'s the status?" — the answer is always here.',
    substeps: [
      'Sidebar → Monitor (only visible to Manager / Admin / Owner roles)',
      'Workload bars show each person\'s completion rate at a glance',
      'Overdue count per person turns red — surface problems before they escalate',
      'Live activity feed shows every task update and comment with a timestamp',
    ],
    href:      '/monitor',
    pageVisit: '/monitor',
  },
  {
    id:    'reports',
    emoji: '📈',
    label: 'Explore the Reports dashboard',
    detail: 'Reports has three tabs: Overview (KPIs and 14-day task trends), Team Performance (per-member stats, on-time rate, hours logged), and Compliance Report (filing status across every client with date and member filters).',
    substeps: [
      'Sidebar → Reports',
      'Overview tab: Tasks created · Completed · Overdue · Hours logged — last 30 days',
      'Team tab: click any team member\'s row to expand their weekly trend chart',
      'Compliance tab: use the filter bar to narrow by client, member, priority, or date range',
    ],
    href:      '/reports',
    pageVisit: '/reports',
  },
  {
    id:    'multi-org',
    emoji: '🏢',
    label: 'Create or switch organisations',
    detail: 'If you manage multiple firms, partnerships, or entities — each gets its own completely isolated organisation. One login covers all of them. Switch instantly from the org switcher at the top of the sidebar with no re-login.',
    substeps: [
      'Click the organisation name at the very top of the sidebar',
      'Switch: click any other org in the dropdown — you move there instantly',
      'Create new: scroll to the bottom of the switcher → New organisation',
      'Each org has its own clients, tasks, team, and settings — nothing crosses over',
    ],
    href:      '/dashboard',
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
            You&apos;ve set up everything. Your firm is ready to run on upFloat.
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
                    <>
                      <p style={{ margin: '0 0 6px', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                        {step.detail}
                      </p>
                      {step.substeps.length > 0 && (
                        <ol style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {step.substeps.map((s, si) => (
                            <li key={si} style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                              {s}
                            </li>
                          ))}
                        </ol>
                      )}
                    </>
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
