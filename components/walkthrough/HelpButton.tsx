'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

// ─── FAQ data ─────────────────────────────────────────────────────────────────

interface FAQItem {
  q: string
  a: string
}

const FAQ: FAQItem[] = [
  {
    q: 'How do compliance tasks get generated?',
    a: 'Go to CA Compliance → select the filing types (GSTR, TDS, ITR, etc.) → pick the clients → click Generate. Planora creates one task per client per filing, due on the correct statutory date. You only do this once per financial year.',
  },
  {
    q: 'What is the difference between Quick Tasks and CA Compliance tasks?',
    a: 'CA Compliance tasks are generated from the statutory calendar — GST, TDS, ITR, ROC, etc. Quick Tasks (My Tasks → + New Task) are for anything else: client calls, drafting letters, internal work, follow-ups. Both appear on the same Kanban board.',
  },
  {
    q: 'How do I add clients in bulk?',
    a: 'Clients → click Import → download the Excel template → fill in client names, GSTINs, emails, phone numbers → upload. Planora validates each row and shows errors inline before importing. Alternatively, clients with a GSTIN auto-fill their business name when you type the GSTIN.',
  },
  {
    q: 'How does the approval workflow work?',
    a: '1. A team member completes a task and clicks the Submit for Review button. 2. The task moves to "Pending Review" status. 3. The assigned approver gets an in-app notification and email. 4. The approver goes to My Tasks → Needs Approval → clicks the task → Approve or Return with a comment. Returned tasks go back to the assignee.',
  },
  {
    q: 'How do recurring tasks auto-spawn?',
    a: 'When you create a Recurring Task (Sidebar → Repeat Tasks → + New), you set the frequency and due date. Every night at midnight, Planora checks which recurring tasks are due to spawn and creates a fresh task instance for each. The template (master) never moves — only spawned instances have statuses.',
  },
  {
    q: 'How do I invite team members?',
    a: 'Settings → Team → Invite Member → enter their email and select a role (Admin, Manager, or Member). They get an email with a one-click login link. Once they log in, they can be assigned tasks. Roles control what each person can see: Owner and Admin bypass all permission checks.',
  },
  {
    q: 'How do I mark a NIL return?',
    a: 'Open any CA Compliance task → click the task title to open the detail panel → check the "Mark as NIL Return" checkbox at the top. This marks the task as completed with no filing and records it in the audit trail. Useful for clients with no transactions in a period.',
  },
  {
    q: 'How do I attach documents to a task?',
    a: 'Open any task → in the detail panel, scroll to Attachments → drag & drop files or click Upload. For CA Compliance tasks, documents upload into named columns (Acknowledgement, Computation, Challan, Others) — you can also paste a Google Drive or Dropbox link instead of uploading.',
  },
  {
    q: 'How do I set up multiple organisations?',
    a: 'Sidebar → bottom of the left panel → click your org name → + Create New Organisation. Each org has its own clients, team, tasks, and billing. You can switch between orgs from the same sidebar. One login manages unlimited organisations.',
  },
  {
    q: 'What happens when the trial ends?',
    a: 'After 14 days, you move to the Free plan automatically — no card charged. Free plan keeps core features available but restricts some paid features (compliance module, advanced reports). A yellow banner appears at the top. Go to Settings → Billing to upgrade anytime.',
  },
  {
    q: 'How do I block a task on another task?',
    a: 'Open the task → in the detail panel, find the "Blocked by" section → search for and link the blocking task. The task card shows a blocked indicator and the detail panel shows the blocking task name and its current status. Great for dependencies like "ITR Filing is blocked by Form 16 collection".',
  },
  {
    q: 'How do I see what my team is working on?',
    a: 'Sidebar → Monitor. It shows every team member\'s task count, overdue tasks, progress bars, and a live activity feed. You can also go to My Tasks → Assigned by Me to see tasks you\'ve delegated and their current status.',
  },
  {
    q: 'Can I filter tasks by client or due date?',
    a: 'Yes. In My Tasks (Board or List view), use the filter bar at the top to filter by: client, assignee, priority, due date range, and status. In CA Compliance, you can filter by client, month, and filing type. Filters persist while you\'re on the page.',
  },
  {
    q: 'How do I report a bug or problem?',
    a: 'Click the "?" icon in the header or sidebar → Report an Issue. Describe what happened, attach a screenshot if helpful, and submit. The team is notified immediately and will respond by email.',
  },
]

// ─── Component ─────────────────────────────────────────────────────────────────

export function HelpButton() {
  const router  = useRouter()
  const [open,     setOpen]     = useState(false)
  const [search,   setSearch]   = useState('')
  const [expanded, setExpanded] = useState<number | null>(null)
  const [mounted,  setMounted]  = useState(false)
  const drawerRef  = useRef<HTMLDivElement>(null)
  const searchRef  = useRef<HTMLInputElement>(null)

  useEffect(() => { setMounted(true) }, [])

  // Focus search when drawer opens
  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 80)
    } else {
      setSearch('')
      setExpanded(null)
    }
  }, [open])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function handle(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [open])

  const filtered = search.trim()
    ? FAQ.filter(f =>
        f.q.toLowerCase().includes(search.toLowerCase()) ||
        f.a.toLowerCase().includes(search.toLowerCase())
      )
    : FAQ

  const restartTour = useCallback(() => {
    setOpen(false)
    router.push('/walkthrough')
  }, [router])

  if (!mounted) return null

  return (
    <div ref={drawerRef} style={{ position: 'fixed', bottom: 20, left: 20, zIndex: 998, fontFamily: 'inherit' }}>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: 44, height: 44, borderRadius: '50%',
          background: open ? '#0d9488' : 'var(--surface,#fff)',
          border: '1.5px solid ' + (open ? '#0d9488' : 'var(--border,#e2e8f0)'),
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          cursor: 'pointer', fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.2s',
          color: open ? '#fff' : 'var(--fg,#0f172a)',
          fontSize: 18, fontWeight: 700,
        }}
        aria-label={open ? 'Close help' : 'Open help'}
        aria-expanded={open}
      >
        {open ? '×' : '?'}
      </button>

      {/* Drawer panel */}
      {open && (
        <div
          style={{
            position: 'absolute', bottom: 54, left: 0,
            width: 360, maxHeight: '75vh',
            background: 'var(--surface,#fff)',
            border: '1.5px solid var(--border,#e2e8f0)',
            borderRadius: 16,
            boxShadow: '0 8px 40px rgba(0,0,0,0.15)',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
          }}
          role="dialog"
          aria-label="Help and FAQ"
        >
          {/* Header */}
          <div style={{
            padding: '16px 16px 12px',
            borderBottom: '1px solid var(--border,#e2e8f0)',
            background: 'var(--surface-2,#f8fafc)',
            flexShrink: 0,
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg,#0f172a)', marginBottom: 10 }}>
              Help Centre
            </div>

            {/* Quick action buttons */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
              {[
                { label: '🎬 Watch tour',    action: restartTour },
                { label: '📖 Compliance',    action: () => { setOpen(false); router.push('/compliance') } },
                { label: '✅ Approvals',     action: () => { setOpen(false); router.push('/tasks') } },
                { label: '🔁 Recurring',     action: () => { setOpen(false); router.push('/recurring') } },
              ].map(({ label, action }) => (
                <button
                  key={label}
                  onClick={action}
                  style={{
                    padding: '5px 10px', borderRadius: 20,
                    border: '1.5px solid var(--border,#e2e8f0)',
                    background: 'var(--surface,#fff)',
                    fontSize: 12, fontWeight: 600,
                    color: 'var(--fg,#374151)',
                    cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'border-color 0.15s',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Search */}
            <input
              ref={searchRef}
              value={search}
              onChange={e => { setSearch(e.target.value); setExpanded(null) }}
              placeholder="Search 14 common questions…"
              style={{
                width: '100%', padding: '9px 12px',
                border: '1.5px solid var(--border,#e2e8f0)',
                borderRadius: 8, fontSize: 13,
                color: 'var(--fg,#0f172a)',
                background: 'var(--surface,#fff)',
                outline: 'none', boxSizing: 'border-box',
                fontFamily: 'inherit',
              }}
              aria-label="Search help articles"
            />
          </div>

          {/* FAQ list */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--muted,#94a3b8)', fontSize: 13 }}>
                No results for &ldquo;{search}&rdquo;
              </div>
            ) : (
              filtered.map((item, i) => {
                const isOpen = expanded === i
                return (
                  <div
                    key={i}
                    style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--border,#f1f5f9)' : 'none' }}
                  >
                    <button
                      onClick={() => setExpanded(isOpen ? null : i)}
                      style={{
                        width: '100%', textAlign: 'left',
                        padding: '13px 16px',
                        background: isOpen ? 'rgba(13,148,136,0.04)' : 'transparent',
                        border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'flex-start', gap: 10,
                        fontFamily: 'inherit',
                        transition: 'background 0.15s',
                      }}
                      aria-expanded={isOpen}
                    >
                      <span style={{
                        fontSize: 11, fontWeight: 700, color: '#0d9488',
                        flexShrink: 0, marginTop: 2,
                        transition: 'transform 0.2s',
                        display: 'inline-block',
                        transform: isOpen ? 'rotate(90deg)' : 'none',
                      }}>▶</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg,#0f172a)', lineHeight: 1.45 }}>
                        {item.q}
                      </span>
                    </button>

                    {isOpen && (
                      <div style={{
                        padding: '0 16px 14px 38px',
                        fontSize: 13, color: 'var(--muted,#475569)',
                        lineHeight: 1.6,
                        background: 'rgba(13,148,136,0.04)',
                      }}>
                        {item.a}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>

          {/* Footer — report issue link */}
          <div style={{
            padding: '10px 16px',
            borderTop: '1px solid var(--border,#e2e8f0)',
            background: 'var(--surface-2,#f8fafc)',
            flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 12, color: 'var(--muted,#94a3b8)' }}>
              Didn&apos;t find your answer?
            </span>
            <button
              onClick={() => { setOpen(false); router.push('/dashboard?report=1') }}
              style={{
                fontSize: 12, fontWeight: 600, color: '#0d9488',
                background: 'transparent', border: 'none',
                cursor: 'pointer', padding: 0, fontFamily: 'inherit',
                textDecoration: 'underline',
              }}
            >
              Report an issue →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
