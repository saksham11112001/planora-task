'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

// ─── FAQ data ─────────────────────────────────────────────────────────────────

interface FAQItem {
  q: string
  a: string
  category: string
}

const FAQ: FAQItem[] = [
  // ── CA Compliance ──────────────────────────────────────────────────────────
  {
    category: 'CA Compliance',
    q: 'How do compliance tasks get generated?',
    a: 'Go to CA Compliance → select the filing types (GSTR, TDS, ITR, etc.) → pick the clients → click Generate. Floatup creates one task per client per filing, due on the correct statutory date. You only do this once per financial year.',
  },
  {
    category: 'CA Compliance',
    q: 'What does the "Spawn tasks now" button do?',
    a: '"Spawn tasks now" manually triggers task generation for the current period without waiting for the nightly cron. Use it when you have just added new clients mid-month and want their compliance tasks to appear immediately on the Kanban board. It is safe to click multiple times — Floatup skips tasks that already exist.',
  },
  {
    category: 'CA Compliance',
    q: 'What is Active vs Paused in CA Compliance?',
    a: 'Active means the task is live — it appears on the Kanban board, sends reminders, and is included in reports. Paused means the task is temporarily suspended — it stays in the system but does not appear on the board and generates no reminders. Use Pause for clients who have temporarily stopped filing (e.g. dormant company, suspended GSTIN). You can un-pause at any time.',
  },
  {
    category: 'CA Compliance',
    q: 'What is "Days before" in the compliance calendar?',
    a: '"Days before" sets how many days before the statutory due date Floatup creates the task on the board. For example, if GSTR-1 is due on the 11th and Days before = 7, the task appears on the 4th. This gives your team a head start. You can change the default per filing type in CA Compliance → Manage Templates.',
  },
  {
    category: 'CA Compliance',
    q: 'How do I mark a NIL return?',
    a: 'Open any CA Compliance task → click the task title to open the detail panel → check the "Mark as NIL Return" checkbox at the top. This marks the task as completed with no filing and records it in the audit trail. Useful for clients with no transactions in a period.',
  },
  {
    category: 'CA Compliance',
    q: 'How do I attach documents to a compliance task?',
    a: 'Open the task → in the detail panel, scroll to Attachments → drag & drop files or click Upload. For CA Compliance tasks, documents upload into named columns (Acknowledgement, Computation, Challan, Others) — you can also paste a Google Drive or Dropbox link instead of uploading.',
  },
  {
    category: 'CA Compliance',
    q: 'How do I import compliance tasks via CSV?',
    a: 'CA Compliance → click "Import CSV" at the top → download the template → fill in client names, filing types, due dates, and assignees → upload. This is useful if you are migrating from a spreadsheet. Floatup validates every row before importing and shows errors inline.',
  },
  {
    category: 'CA Compliance',
    q: 'I imported successfully but my compliance tasks are not showing up on the board — why?',
    a: 'Import only brings in your client and task data — it does not automatically create task instances on the Kanban board. You need to spawn them manually. Go to CA Compliance → click "Spawn tasks now". Floatup will generate a task for every client and filing type whose trigger date has already passed. Tasks appear on the board within a few seconds. If they still do not appear, check two things: (1) the client\'s status is Active (not Paused or Inactive), and (2) the filing types you expect are enabled in CA Compliance → Manage Templates. The nightly cron also runs at 7 AM IST every day and will spawn any remaining tasks automatically.',
  },
  {
    category: 'CA Compliance',
    q: 'What is the DSC Tracker?',
    a: 'DSC Tracker (CA Compliance → DSC Tracker tab) lets you record each client\'s Digital Signature Certificate expiry date. Floatup shows a colour-coded status: green (valid), amber (expiring within 30 days), red (expired). You can filter by status and export the list. No reminders are sent automatically — it is a reference dashboard only.',
  },

  // ── Tasks & Kanban ─────────────────────────────────────────────────────────
  {
    category: 'Tasks & Kanban',
    q: 'What is the difference between Quick Tasks and CA Compliance tasks?',
    a: 'CA Compliance tasks are generated from the statutory calendar — GST, TDS, ITR, ROC, etc. Quick Tasks (My Tasks → + New Task) are for anything else: client calls, drafting letters, internal work, follow-ups. Both appear on the same Kanban board.',
  },
  {
    category: 'Tasks & Kanban',
    q: 'How does the Kanban board work?',
    a: 'The Kanban board (My Tasks → Board view) has columns: To Do, In Progress, Pending Review, and Done. Drag any task card left or right to move it between statuses. You can also open the task and change its status from the detail panel. Filters at the top let you narrow by assignee, client, priority, or due date.',
  },
  {
    category: 'Tasks & Kanban',
    q: 'How do I move a task to "Pending Review" for approval?',
    a: 'Open the task card → click "Submit for Review" in the detail panel. This moves it to the Pending Review column and notifies the approver. Do not drag the card manually to Pending Review — always use the Submit button so the approval workflow fires correctly.',
  },
  {
    category: 'Tasks & Kanban',
    q: 'How do I see tasks assigned to me vs assigned by me?',
    a: 'My Tasks defaults to tasks assigned to you. Switch to "Assigned by me" using the tab at the top of My Tasks to see tasks you have delegated to others and their current status. You can filter by assignee, client, or status from that view as well.',
  },
  {
    category: 'Tasks & Kanban',
    q: 'How does the approval workflow work?',
    a: '1. A team member completes a task and clicks the Submit for Review button. 2. The task moves to "Pending Review" status. 3. The assigned approver gets an in-app notification and email. 4. The approver goes to My Tasks → Needs Approval → clicks the task → Approve or Return with a comment. Returned tasks go back to the assignee.',
  },
  {
    category: 'Tasks & Kanban',
    q: 'How do I block a task on another task?',
    a: 'Open the task → in the detail panel, find the "Blocked by" section → search for and link the blocking task. The task card shows a blocked indicator and the detail panel shows the blocking task name and its current status. Great for dependencies like "ITR Filing is blocked by Form 16 collection".',
  },
  {
    category: 'Tasks & Kanban',
    q: 'How do I set task priority?',
    a: 'Open the task → click the Priority field in the detail panel → choose Low, Medium, High, or Urgent. Priority is shown as a coloured dot on the Kanban card. You can also filter the board by priority using the filter bar at the top of My Tasks.',
  },
  {
    category: 'Tasks & Kanban',
    q: 'How do I add comments to a task?',
    a: 'Open the task detail panel → scroll to the Comments section at the bottom → type your message and press Enter or click Send. Comments support @mentions — type @ followed by a team member\'s name to notify them. All comments are stored in the audit trail.',
  },
  {
    category: 'Tasks & Kanban',
    q: 'How do I delete a task?',
    a: 'Open the task detail panel → click the three-dot menu (⋯) at the top right of the panel → Delete. Only Owners, Admins, and Managers can delete tasks. Deleting is permanent and cannot be undone. For compliance tasks, consider using the Pause option instead of deleting, so the audit trail is preserved.',
  },
  {
    category: 'Tasks & Kanban',
    q: 'Can I filter tasks by client or due date?',
    a: 'Yes. In My Tasks (Board or List view), use the filter bar at the top to filter by: client, assignee, priority, due date range, and status. In CA Compliance, you can filter by client, month, and filing type. Filters persist while you\'re on the page.',
  },

  // ── Recurring Tasks ────────────────────────────────────────────────────────
  {
    category: 'Recurring Tasks',
    q: 'How do recurring tasks auto-spawn?',
    a: 'When you create a Recurring Task (Sidebar → Repeat Tasks → + New), you set the frequency and due date. Every night at midnight, Floatup checks which recurring tasks are due to spawn and creates a fresh task instance for each. The template (master) never moves — only spawned instances have statuses.',
  },
  {
    category: 'Recurring Tasks',
    q: 'What frequencies are supported for recurring tasks?',
    a: 'Floatup supports: Daily, Every N days, Weekly on specific days (e.g. every Monday), Bi-weekly, Monthly on a specific date (e.g. 15th of every month), Monthly on the last day, Quarterly, and Annual (31 Jul, 30 Sep, 31 Dec, 31 Mar or any month). You can also set custom day combinations like every Monday + Wednesday + Friday.',
  },
  {
    category: 'Recurring Tasks',
    q: 'Can I edit a recurring task without affecting past instances?',
    a: 'Yes. Editing the recurring template (master) only affects future spawned instances — past and current instances are not changed. Open the template in Sidebar → Repeat Tasks → click the template → Edit. If you need to change a single instance only, open that specific spawned task on the board and edit it there.',
  },

  // ── Clients ────────────────────────────────────────────────────────────────
  {
    category: 'Clients',
    q: 'How do I add clients in bulk?',
    a: 'Clients → click Import → download the Excel template → fill in client names, GSTINs, emails, phone numbers → upload. Floatup validates each row and shows errors inline before importing. Alternatively, clients with a GSTIN auto-fill their business name when you type the GSTIN.',
  },
  {
    category: 'Clients',
    q: 'How do I pause or deactivate a client?',
    a: 'Clients → click the client → Edit → set Status to Inactive. Inactive clients are hidden from the main client list (use the "Show inactive" toggle to view them) and their compliance tasks are automatically paused. This is useful when a client\'s engagement ends but you want to preserve their history.',
  },
  {
    category: 'Clients',
    q: 'What is the client portal?',
    a: 'The client portal lets your clients view their own task status, download filed documents, and track due dates — without needing a Floatup login. Clients → select a client → Portal tab → copy the magic link and share it with your client. The link is unique per client and never expires unless you regenerate it.',
  },

  // ── Monitor & Reports ──────────────────────────────────────────────────────
  {
    category: 'Monitor & Reports',
    q: 'How do I see what my team is working on?',
    a: 'Sidebar → Monitor. It shows every team member\'s task count, overdue tasks, progress bars, and a live activity feed. You can also go to My Tasks → Assigned by Me to see tasks you\'ve delegated and their current status.',
  },
  {
    category: 'Monitor & Reports',
    q: 'What does the Monitor section show?',
    a: 'Monitor has three views: Team (task counts, overdue counts, and completion rate per person), Activity (a real-time feed of every task status change, comment, and approval), and Projects (progress bars per project with task breakdown). Use it for daily stand-ups or to spot bottlenecks before deadlines.',
  },
  {
    category: 'Monitor & Reports',
    q: 'How do I check the deadline calendar?',
    a: 'Sidebar → Calendar. It shows every task due date for all clients and team members in a monthly calendar view. Click any date to see a list of tasks due that day. You can filter by assignee or client using the controls at the top. Use this for planning ahead and spotting busy filing periods.',
  },

  // ── Team & Settings ────────────────────────────────────────────────────────
  {
    category: 'Team & Settings',
    q: 'How do I invite team members?',
    a: 'Settings → Team → Invite Member → enter their email and select a role (Admin, Manager, or Member). They get an email with a one-click login link. Once they log in, they can be assigned tasks. Roles control what each person can see: Owner and Admin bypass all permission checks.',
  },
  {
    category: 'Team & Settings',
    q: 'What is the difference between Owner, Admin, Manager, and Member roles?',
    a: 'Owner: full control, billing access, cannot be removed. Admin: same as Owner for all features except billing. Manager: can create/edit/delete tasks, manage clients, view all team tasks. Member: can only work on tasks assigned to them — cannot see other team members\' tasks or client lists unless assigned. Viewer: read-only access across the org.',
  },
  {
    category: 'Team & Settings',
    q: 'How do I change a team member\'s role?',
    a: 'Settings → Team → find the member → click the role badge next to their name → select the new role from the dropdown. Role changes take effect immediately. You cannot change the Owner\'s role — to transfer ownership, contact support.',
  },
  {
    category: 'Team & Settings',
    q: 'How do I customise role permissions?',
    a: 'Settings → Roles & Permissions → select a role → toggle individual permissions on or off. Fine-grained controls include: who can approve tasks, who can generate compliance tasks, who can invite members, who can view billing. Owner and Admin always bypass these checks and cannot be restricted.',
  },
  {
    category: 'Team & Settings',
    q: 'How do I manage notification preferences?',
    a: 'Settings → Notifications. You can choose between Immediate (each event sends a separate email) and Digest (Floatup batches all notifications into a morning and evening summary email). Digest is the default and recommended for busy teams. You can also toggle specific notification types on or off.',
  },
  {
    category: 'Team & Settings',
    q: 'How do I hide or show navigation items in the sidebar?',
    a: 'Settings → Navigation → toggle sections on or off. For example, if your firm does not use the Projects module, you can hide it from the sidebar entirely. Changes apply to everyone in the org. Owner and Admin can always access hidden sections from Settings.',
  },
  {
    category: 'Team & Settings',
    q: 'How do I update my profile name or avatar?',
    a: 'Click your avatar in the top-right corner of the app → Profile → edit your name and upload a photo. Email cannot be changed from within the app — it is tied to your login provider (Google, Microsoft, or email+password). To change your login email, contact support.',
  },
  {
    category: 'Team & Settings',
    q: 'How do I reset my password?',
    a: 'On the login page, click "Forgot password?" → enter your email → check your inbox for a reset link. The link expires in 1 hour. If you log in via Google or Microsoft, you cannot set a password — use those providers to sign in instead.',
  },
  {
    category: 'Team & Settings',
    q: 'How do I set up multiple organisations?',
    a: 'Sidebar → bottom of the left panel → click your org name → + Create New Organisation. Each org has its own clients, team, tasks, and billing. You can switch between orgs from the same sidebar. One login manages unlimited organisations.',
  },

  // ── Billing & Plans ────────────────────────────────────────────────────────
  {
    category: 'Billing & Plans',
    q: 'What happens when the trial ends?',
    a: 'After 14 days, you move to the Free plan automatically — no card charged. Free plan keeps core features available but restricts some paid features (compliance module, advanced reports). A yellow banner appears at the top. Go to Settings → Billing to upgrade anytime.',
  },
  {
    category: 'Billing & Plans',
    q: 'What is included in each plan tier?',
    a: 'Free: basic task management, up to 3 team members, no compliance module. Starter: compliance module, up to 10 team members, basic reports. Pro: everything in Starter + recurring tasks, approval workflows, client portal, advanced reports. Business: everything in Pro + custom role permissions, priority support, unlimited team members.',
  },
  {
    category: 'Billing & Plans',
    q: 'How do I upgrade or change my plan?',
    a: 'Settings → Billing → click "Change plan" → select the new tier → enter payment details. Upgrades are instant. Downgrades take effect at the end of the current billing cycle. If you downgrade and exceed the new plan\'s limits (e.g. too many team members), you will be prompted to remove excess members before the downgrade applies.',
  },
  {
    category: 'Billing & Plans',
    q: 'How do I get an invoice or receipt?',
    a: 'Settings → Billing → Invoices section → download any past invoice as PDF. Invoices are also emailed automatically to the billing email after each payment. To change the billing email, click "Billing details" in that same section.',
  },

  // ── App & Search ───────────────────────────────────────────────────────────
  {
    category: 'App & Search',
    q: 'How do I use the global search?',
    a: 'Press Ctrl+K (Cmd+K on Mac) or click the search bar at the top. You can search tasks by title, clients by name or GSTIN, and team members by name. Results appear instantly as you type. Press Enter to open the first result or use arrow keys to navigate.',
  },
  {
    category: 'App & Search',
    q: 'How do I switch between dark mode and light mode?',
    a: 'Click the moon/sun icon in the top-right header bar. Your preference is saved and persists across sessions and devices (tied to your account, not the browser). The app defaults to your operating system\'s theme on first login.',
  },
  {
    category: 'App & Search',
    q: 'How do I report a bug or problem?',
    a: 'Click the "?" button at the bottom-left of any page → Report an issue. Describe what happened, attach a screenshot if helpful, and submit. The team is notified immediately and will respond by email within one business day.',
  },
]

// ─── Component ─────────────────────────────────────────────────────────────────

const CATEGORIES = Array.from(new Set(FAQ.map(f => f.category)))

export function HelpButton() {
  const router  = useRouter()
  const [open,     setOpen]     = useState(false)
  const [search,   setSearch]   = useState('')
  const [expanded, setExpanded] = useState<number | null>(null)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
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
      setActiveCategory(null)
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

  const filtered = (() => {
    let list = FAQ
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(f =>
        f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q)
      )
    } else if (activeCategory) {
      list = list.filter(f => f.category === activeCategory)
    }
    return list
  })()

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
          background: open ? 'var(--brand)' : 'var(--surface)',
          border: '1.5px solid ' + (open ? 'var(--brand)' : 'var(--border)'),
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          cursor: 'pointer', fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.2s',
          color: open ? '#fff' : 'var(--text-primary)',
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
            width: 380, maxHeight: '80vh',
            background: 'var(--surface)',
            border: '1.5px solid var(--border)',
            borderRadius: 16,
            boxShadow: '0 8px 40px rgba(0,0,0,0.20)',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
          }}
          role="dialog"
          aria-label="Help and FAQ"
        >
          {/* Header */}
          <div style={{
            padding: '16px 16px 12px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface-subtle)',
            flexShrink: 0,
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>
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
                    border: '1.5px solid var(--border)',
                    background: 'var(--surface)',
                    fontSize: 12, fontWeight: 600,
                    color: 'var(--text-secondary)',
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
              onChange={e => { setSearch(e.target.value); setExpanded(null); setActiveCategory(null) }}
              placeholder={`Search ${FAQ.length} help articles…`}
              style={{
                width: '100%', padding: '9px 12px',
                border: '1.5px solid var(--border)',
                borderRadius: 8, fontSize: 13,
                color: 'var(--text-primary)',
                background: 'var(--surface)',
                outline: 'none', boxSizing: 'border-box',
                fontFamily: 'inherit',
              }}
              aria-label="Search help articles"
            />
          </div>

          {/* Category tabs — hidden while searching */}
          {!search.trim() && (
            <div style={{
              display: 'flex', gap: 0, overflowX: 'auto', flexShrink: 0,
              borderBottom: '1px solid var(--border)',
              background: 'var(--surface)',
              scrollbarWidth: 'none',
            }}>
              <button
                onClick={() => { setActiveCategory(null); setExpanded(null) }}
                style={{
                  padding: '8px 12px', border: 'none', cursor: 'pointer',
                  fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
                  fontFamily: 'inherit',
                  background: activeCategory === null ? 'var(--surface)' : 'transparent',
                  color: activeCategory === null ? 'var(--brand)' : 'var(--text-muted)',
                  borderBottom: activeCategory === null ? '2px solid var(--brand)' : '2px solid transparent',
                  transition: 'all 0.15s',
                }}
              >
                All ({FAQ.length})
              </button>
              {CATEGORIES.map(cat => {
                const count = FAQ.filter(f => f.category === cat).length
                const isActive = activeCategory === cat
                return (
                  <button
                    key={cat}
                    onClick={() => { setActiveCategory(isActive ? null : cat); setExpanded(null) }}
                    style={{
                      padding: '8px 12px', border: 'none', cursor: 'pointer',
                      fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
                      fontFamily: 'inherit',
                      background: isActive ? 'var(--surface)' : 'transparent',
                      color: isActive ? 'var(--brand)' : 'var(--text-muted)',
                      borderBottom: isActive ? '2px solid var(--brand)' : '2px solid transparent',
                      transition: 'all 0.15s',
                    }}
                  >
                    {cat} ({count})
                  </button>
                )
              })}
            </div>
          )}

          {/* FAQ list */}
          <div style={{ overflowY: 'auto', flex: 1, background: 'var(--surface)' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                No results for &ldquo;{search}&rdquo;
              </div>
            ) : (
              filtered.map((item, i) => {
                const isExpanded = expanded === i
                return (
                  <div
                    key={i}
                    style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--border-light)' : 'none' }}
                  >
                    <button
                      onClick={() => setExpanded(isExpanded ? null : i)}
                      style={{
                        width: '100%', textAlign: 'left',
                        padding: '12px 16px',
                        background: isExpanded ? 'rgba(13,148,136,0.08)' : 'transparent',
                        border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'flex-start', gap: 10,
                        fontFamily: 'inherit',
                        transition: 'background 0.15s',
                      }}
                      aria-expanded={isExpanded}
                    >
                      <span style={{
                        fontSize: 11, fontWeight: 700, color: 'var(--brand)',
                        flexShrink: 0, marginTop: 3,
                        transition: 'transform 0.2s',
                        display: 'inline-block',
                        transform: isExpanded ? 'rotate(90deg)' : 'none',
                      }}>▶</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {search.trim() && (
                          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--brand)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            {item.category}
                          </div>
                        )}
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.45 }}>
                          {item.q}
                        </span>
                      </div>
                    </button>

                    {isExpanded && (
                      <div style={{
                        padding: '0 16px 14px 38px',
                        fontSize: 13, color: 'var(--text-secondary)',
                        lineHeight: 1.6,
                        background: 'rgba(13,148,136,0.08)',
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
            borderTop: '1px solid var(--border)',
            background: 'var(--surface-subtle)',
            flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Didn&apos;t find your answer?
            </span>
            <button
              onClick={() => { setOpen(false); router.push('/dashboard?report=1') }}
              style={{
                fontSize: 12, fontWeight: 600, color: 'var(--brand)',
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
