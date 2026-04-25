# Planora Task — Codebase Transfer Document
> Use this at the start of a new chat to give the AI full context. Last updated: 2026-04-25 (Session 12)

---

## TECH STACK

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15.1.0 (App Router, `force-dynamic`) |
| UI | React 19, TypeScript 5, Tailwind CSS 4 |
| Database | Supabase (Postgres + Auth + Storage) |
| Background jobs | Inngest 3.25 (event-driven functions) |
| Email | Resend 4.0 |
| Charts | Recharts 2.13 |
| State | Zustand 5.0 |
| Excel export | ExcelJS + XLSX |
| Payments | Razorpay (webhooks) |
| Deployment | Vercel |

---

## DATABASE TABLES (Supabase)

| Table | Key columns |
|-------|-------------|
| `users` | `id, name, email, avatar_url, phone_number` |
| `organisations` | `id, name, plan, trial_ends_at` |
| `org_members` | `user_id, org_id, role (owner/admin/manager/member/viewer), is_active` |
| `tasks` | `id, org_id, title, description, status (todo/in_progress/in_review/completed), priority, due_date, assignee_id, approver_id, approval_status (pending/approved/rejected), approval_required, is_recurring, is_archived, parent_task_id, project_id, client_id, custom_fields (jsonb), estimated_hours, completed_at, approved_by, approved_at, created_by, sort_order` |
| `projects` | `id, org_id, name, color, status, due_date, client_id, owner_id, is_archived` |
| `clients` | `id, org_id, name, color, status (active/inactive), email, phone, company, website, industry, notes, custom_fields (jsonb)` — custom_fields used for: DSC data (`_dsc_expiry`, `_dsc_holder`), GST data (`gstin`, `pan`, `gst_status`, `gst_state`, `gst_reg_date`) |
| `time_logs` | `id, org_id, task_id, project_id, user_id, hours, is_billable` |
| `task_attachments` | `id, task_id, org_id, file_url, file_name` |
| `task_comments` | `id, task_id, org_id, user_id, content` |
| `ca_master_tasks` | `id, org_id, name, attachment_count, attachment_headers, is_active, priority, dates (jsonb), days_before_due` |
| `ca_client_assignments` | `id, org_id, client_id, master_task_id (→ ca_master_tasks), assignee_id` — FK join syntax: `master_task:ca_master_tasks(id, name, priority, dates, days_before_due)` |
| `ca_task_instances` | `id, org_id, assignment_id (→ ca_client_assignments), due_date` — keyed as `${assignment_id}__${due_date}` to prevent re-spawn |
| `notifications` | `id, org_id, user_id, type, read, data (jsonb)` |
| `recurring_tasks` | `id, org_id, title, frequency, next_run, assignee_id, project_id, client_id` |

**Important FK join syntax** (must be explicit in `.select()`):
```
assignee:users!tasks_assignee_id_fkey(id, name, avatar_url)
approver:users!tasks_approver_id_fkey(id, name)
creator:users!tasks_created_by_fkey(id, name)
projects(id, name, color)
```
`select('*')` does NOT auto-include these joined objects.

---

## ROLE PERMISSIONS GRID

| Operation | Owner | Admin | Manager | Member | Viewer |
|-----------|-------|-------|---------|--------|--------|
| View all tasks (Monitor page) | ✅ | ✅ | ✅ | ✅ | ✅ |
| View all tasks (My Tasks, Calendar, Inbox, Recurring) | ✅ | ✅ | Assignee/approver only | Assignee/approver only | Assignee/approver only |
| "Assigned by me" section (My Tasks) | ✅ | ✅ | ❌ | ❌ | ❌ |
| can_view_all_tasks flag override | N/A (always all) | N/A (always all) | Grants full view-all if set | Grants full view-all if set | Grants full view-all if set |
| Create task | ✅ | ✅ | ✅ | ✅ | ❌ |
| Edit any task | ✅ | ✅ | ✅ | Own assigned only | ❌ |
| Delete / archive task | ✅ | ✅ | ✅ | ❌ | ❌ |
| Change assignee | ✅ | ✅ | ✅ | ❌ | ❌ |
| Submit for approval | ✅ bypass | ✅ bypass | If assignee | If assignee | ❌ |
| Approve / Reject | ✅ bypass | ✅ bypass | If designated approver | If designated approver | ❌ |
| Pending approval tasks (My Tasks) | ✅ all org | ✅ all org | Only where approver_id = self | Only where approver_id = self | Only where approver_id = self |
| Set approver | ✅ | ✅ | ✅ | ❌ | ❌ |
| Create recurring task | ✅ | ✅ | ✅ | ✅ | ❌ |
| Manage CA compliance | ✅ | ✅ | ❌ | ❌ | ❌ |

### Task Visibility Rules (enforced at DB query level in page.tsx files)

**Rule:** `canViewAll = ['owner','admin'].includes(role) || can_view_all_tasks === true`

| Page | canViewAll = true | canViewAll = false (any role) |
|------|------------------|-------------------------------|
| My Tasks (`/tasks`) | All non-archived top-level org tasks | `.or('assignee_id.eq.X,approver_id.eq.X')` |
| Calendar (`/calendar`) | All tasks with due_date in ±6mo window | `.or('assignee_id.eq.X,approver_id.eq.X')` |
| Inbox (`/inbox`) | All one-time non-compliance org tasks | `.or('assignee_id.eq.X,approver_id.eq.X')` |
| Recurring (`/recurring`) | All recurring templates in org | `.or('assignee_id.eq.X,approver_id.eq.X')` |

The `can_view_all_tasks` column lives on `org_members` (BOOLEAN DEFAULT FALSE). It is toggled per-user by owners/admins in **Settings › Members** and cannot be set on owner/admin members.

**Approval flow:**
1. Assignee (or owner/admin) submits → `status: in_review`, `approval_status: pending`
2. Designated approver (or owner/admin) approves → `status: completed`, `approval_status: approved`
3. Reject → `status: todo`, `approval_status: rejected`
4. No approver + `approval_required=false` → auto-completes on submit
5. No approver + `approval_required=true` → blocked, error `NO_APPROVER`

---

## FILE STRUCTURE

### Root Config
```
next.config.ts          — Next.js config (optimization, headers, caching)
  — experimental.staleTimes: { dynamic: 0 }  ← kills router cache (added Session 4)
    forces every dynamic-route navigation to fetch fresh RSC payload from server
middleware.ts           — Supabase JWT refresh + route protection
tailwind.config.ts      — Tailwind CSS v4 config
vercel.json             — Vercel deployment config
types/index.ts          — TypeScript interfaces: User, Org, Task, Project, Client
  — Task.updated_at?: string  ← added Session 4
  — Task.approver_id?: string | null  ← added Session 4
  — Task.approver?: { id: string; name: string } | null  ← added Session 4
store/appStore.ts       — Zustand: session, toast notifications, filter state
  — FilterState fields: clientId, priority, status, search, assigneeId,
    dueDateFrom, dueDateTo, creatorId  ← "Assigned by" filter (added Session 3)
    createdFrom, createdTo, updatedFrom, updatedTo  ← date range filters (added Session 4)
  — setFilter(key, value) / resetFilters() — used by UniversalFilterBar
lib/utils/permissionGate.ts  — NEW (Session 4): server-side permission gate
  — DEFAULT_PERMISSIONS: mirrors PermissionsView.tsx exactly (30 permissions)
  — fetchOrgPermissions(supabase, orgId): React cache()-wrapped, reads org_settings.role_permissions
  — canDo(supabase, orgId, role, permission): owner/admin always true; checks matrix
  — assertCan(supabase, orgId, role, permission): returns {error, status:403} or null
```

### app/ — Pages & API Routes

#### Auth & Public
```
app/layout.tsx                        — Root HTML layout, theme detection
app/page.tsx                          — Landing page (unauthenticated)
app/login/page.tsx                    — Login with email/Google OAuth
app/auth/callback/route.ts            — OAuth callback handler
app/onboarding/page.tsx               — New org onboarding flow
```

#### Protected App Layout
```
app/(app)/layout.tsx                  — Auth guard + org validation wrapper
  — uses cached.ts helpers + Promise.all for parallel membership+profile  ← Session 11
  — passes user.created_at to AppShell (for walkthrough first-time detection)  ← Session 12
app/(app)/AppShell.tsx                — Main shell: sidebar + header + routing
  — Props.user now includes created_at: string  ← Session 12
  — Renders <WalkthroughOverlay userId={user.id} userCreatedAt={user.created_at}/>  ← Session 12
```

#### Core Pages
```
app/(app)/dashboard/page.tsx          — Dashboard stats (counts, recent tasks)
app/(app)/dashboard/DashboardClient.tsx — Client widgets for dashboard

app/(app)/tasks/page.tsx              — Server: fetches my tasks + approval tasks + assigned-by-me
  — export const dynamic = 'force-dynamic'  ← added Session 4
  — SELECT includes: creator:users!tasks_created_by_fkey(id, name)
  — SELECT includes: created_at, updated_at  ← added Session 4
  — Enrichment: creator: (t.creator as any) ?? null
  — Enrichment: created_at: t.created_at ?? '', updated_at: t.updated_at ?? null  ← Session 4
  — Fetches caAssignments + caInstances for owner/admin; computes upcomingCATriggers  ← Session 8
    (triggers firing in next 3 days that have not yet been spawned)
  — Passes upcomingCATriggers to MyTasksView  ← Session 8
app/(app)/tasks/MyTasksView.tsx       — Client: List / Board (Kanban) view
  — BOARD_COLS: overdue | in_progress (includes todo) | in_review (Pending approval) | completed
  — Grid: '28px 22px 1fr 120px 130px 90px 100px 28px'
    (check | circle | Task | Client | Assigned by | Due date↑ | Priority | del)
  — pendingApprovalTasks prop → converted to local state pendingTasks on mount
  — handleApproveDecision: optimistically removes from pendingTasks + restores on failure
  — Board in_review column: merges filteredTasks + pendingTasks (tasks from others)
  — "Needs your approval" section renders from pendingTasks state (not prop) → live UI
  — Inline upload button (amber arrow SVG) on compliance / approval_required task rows
  — Filters: client, priority, status, search, dueDateFrom/To, creatorId (Assigned by)
  — Filters: createdFrom/To, updatedFrom/To  ← added Session 4
  — List sections sorted by due_date ascending; "Assigned by me" toggle for managers
  — onCreated: only adds to local state if assignedToMe; always calls router.refresh()
  — Row color coding: typeAccent per compliance/recurring/project/one-time (Session 4)
    compliance=#d97706, recurring=#0d9488, project=#7c3aed, one-time=#0891b2
    borderLeft: 3px solid typeAccent; bg: tinted rgba per type
  — Board TaskCard color coding: typeAccent + typeBg + borderLeft per type (Session 4)
  — CATriggerSection component: collapsible amber-styled list of upcoming CA triggers  ← Session 8
    Shown in List view above empty state when upcomingCATriggers.length > 0 && !showAssignedByMe

app/(app)/projects/page.tsx           — Projects list
app/(app)/projects/ProjectsView.tsx   — Projects grid/list
app/(app)/projects/[projectId]/page.tsx  — Fetches project + tasks (with approver join) + members
  — export const dynamic = 'force-dynamic' (already present pre-Session 4)
  — SELECT includes: created_at, updated_at  ← added Session 4
  — taskList map: created_at: (t as any).created_at ?? '', updated_at: (t as any).updated_at ?? null  ← Session 4
app/(app)/projects/[projectId]/ProjectView.tsx  — Project board/list with inline task rows
  — "+ Assign to me" only shows when task.assignee_id is null (not just members.find() miss)
  — TaskRow() color coding: _isCaComp ? #d97706 : #7c3aed; borderLeft 3px (Session 4)
  — toggleDone submit-for-approval path: optimistic state update on API success (Session 12)
    Reads response body auto_completed flag: true → sets completed, false → sets in_review+pending
    No longer requires router.refresh() for the UI to reflect pending state

app/(app)/clients/new/NewClientForm.tsx — New client creation form (steps 1 + 2)
  — Step 1: GSTIN auto-fill section added at the top  ← Session 9
    Input: monospace, auto-uppercases, strips non-alphanumeric, max 15 chars
    Auto-triggers lookupGSTIN() when 15th character typed; manual "Fetch" button
    lookupGSTIN(): calls GET /api/gst/lookup?gstin=X; auto-fills name, company, industry, notes
    Info strip: PAN chip (monospace), state chip, gst_status (green=Active/red=other), constitution, reg date
    partial:true shows italic hint message (e.g. "Set GSTIN_API_KEY for full lookup")
    gstInfo stored in state; saved to custom_fields on submit
  — Submit: includes custom_fields { gstin, pan, gst_status, gst_state, gst_reg_date }  ← Session 9
app/(app)/clients/page.tsx            — Server wrapper: fetches clients + canManage, renders ClientsView
app/(app)/clients/ClientsView.tsx     — NEW Session 5: client component for the clients grid
  — Inline edit button (Pencil icon) → navigates to /clients/[id]/edit
  — Inline delete button (Trash2 icon) → calls DELETE /api/clients/[id] + optimistic removal
  — Per-card checkbox (top-left): teal outline when selected
  — "Select all" / "Deselect all" toggle button in header (canManage only)
  — Bulk action bar: appears when ≥1 card selected — shows count + "Delete selected" + Cancel
  — Bulk delete: parallel DELETE calls; partial success handled (success count + failure count toasts)
  — All buttons use e.preventDefault() + e.stopPropagation() to block card link navigation
  — router.refresh() called after every successful delete to sync server state
  — Edit/Delete/Checkbox only rendered when canManage = true
app/(app)/clients/[clientId]/page.tsx — Client detail with project stats
  — export const dynamic = 'force-dynamic'  ← added Session 4
app/(app)/calendar/page.tsx           — Fetches tasks with due dates + approver join
  — Fetches caAssignments + caInstances for owner/admin; computes upcomingCATriggers  ← Session 8
  — Passes upcomingCATriggers to CalendarView  ← Session 8
app/(app)/calendar/CalendarView.tsx   — Monthly calendar component
  — taskTypeBorder/Bg/Dot functions define type colors (compliance/recurring/project/quick)
  — isDone no longer overrides type colors; opacity: 0.72/0.68 used for done state instead (Session 4)
  — Legend: recurring icon color fixed to #0d9488 (was #ea580c) (Session 4)
  — Filter pill "One-time" → "Quick"; legend "One-time" → "Quick"  ← Session 8
  — upcomingCATriggers prop: ghost amber dashed cards in timeline + month grid + day panel  ← Session 8
    byTriggerDate map groups triggers by triggerDate string
    Timeline: amber dashed div with ⏰ badge after dayTasks.map()
    Month: small amber dashed pill with ⏰ emoji (up to 2 per day cell)
    Day panel: full "CA tasks triggering soon" section with title/client/dates

app/(app)/recurring/page.tsx          — Repeat tasks list (metadata title: "Repeat tasks")  ← Session 8
  — SELECT includes: creator:users!tasks_created_by_fkey(id, name)
  — SELECT includes: created_at, updated_at  ← added Session 4
  — Enrichment: creator: (t as any).creator ?? null
  — Enrichment: created_at: t.created_at ?? '', updated_at: t.updated_at ?? null  ← Session 4
app/(app)/recurring/RecurringView.tsx — Repeat task editor  ← Session 8 (renamed display text)
  — Grid: '1fr 10rem 6rem 6rem 6rem 7rem 5rem 4.5rem' (8 columns including Assigned by)
  — "Assigned by" column between Approver and Client; uses User icon from lucide-react
  — Subtask add: newSubAssignees / newSubDueDates per-task state maps
    addSubtask(taskId, title, assigneeId, dueDate) sends both fields to API
    Progressive disclosure: second row (select + date + Add) shown only when title typed
  — Inline upload button on compliance / approval_required tasks
  — Filters: creatorId (Assigned by); showAssignor on both UniversalFilterBars
  — Filters: createdFrom/To, updatedFrom/To  ← added Session 4
  — onCreated: adds to local state + calls router.refresh() via startTransition
  — Row color coding: compliance=#d97706(amber), recurring=#0d9488(teal); borderLeft 3px (Session 4)
  — Local Task interface now includes: created_at?, updated_at?, custom_fields?  ← Session 4

app/(app)/approvals/page.tsx          — Approvals queue (pending + history, with approver join)
app/(app)/approvals/ApprovalsView.tsx — Approval queue UI

app/(app)/inbox/page.tsx              — Quick tasks inbox (metadata title: "Quick tasks")  ← Session 8
  — SELECT includes: creator:users!tasks_created_by_fkey(id, name)
  — SELECT includes: created_at, updated_at  ← added Session 4
  — Enrichment: creator: (t as any).creator ?? null
  — Enrichment: created_at: (t as any).created_at ?? '', updated_at: (t as any).updated_at ?? null  ← Session 4
app/(app)/inbox/InboxView.tsx         — Client: List / Board view for quick tasks  ← Session 8 (renamed)
  — Grid: '36px 22px 1fr 100px 110px 110px 100px 80px 32px 28px' (10 columns)
    (check | circle | Task | Assignee | Client | Due date | Assigned by | Priority | expand | del)
  — "Assigned by" column after Due date: creator avatar initial + first name
  — Inline upload button (amber/grey arrow SVG) on compliance / approval_required tasks
  — Compliance subtask rows also have inline upload button
  — Filters: creatorId (Assigned by); showAssignor on both UniversalFilterBars
  — Filters: createdFrom/To, updatedFrom/To applied in visibleTasks + board columns  ← Session 4
  — Board + List both filter by creatorId
  — Row color coding: typeAccent based on compliance/recurring/project/one-time (Session 4)
    compliance=#d97706, recurring=#0d9488, project=#7c3aed, one-time=#0891b2
    borderLeft: 3px solid typeAccent; bg: tinted rgba per type
  — Board card color coding: _cardBg + borderLeft per type (Session 4)

app/(app)/time/page.tsx               — Time logs
app/(app)/reports/page.tsx            — Reports + Excel export
app/(app)/compliance/page.tsx         — CA compliance module
app/(app)/compliance/ComplianceShell.tsx — Tab shell: steps 1-5, tab router, shared members/clients fetch
  — step type widened: 1|2|3|4 → 1|2|3|4|5  ← Session 9
  — ?tab=dsctracker URL param routes to step 5  ← Session 9
  — Step 5 tab: ShieldCheck icon + "DSC Tracker" label; ChevronRight separator before it  ← Session 9
  — Step 5 content: <CADSCTrackerView userRole={userRole} />  ← Session 9
  — CAKanbanView client column headers now show overdue/due-today badges  ← Session 9
    overdueN: allTasks where _nextDueDate < today and status !== 'completed'
    dueTodayN: allTasks where _nextDueDate === today and status !== 'completed'
    Red "N overdue" badge shown when overdueN > 0; teal "N today" when only dueTodayN > 0
app/(app)/compliance/CADSCTrackerView.tsx — NEW Session 9: DSC expiry tracker component
  — 'use client'; fetches /api/clients and reads custom_fields._dsc_expiry + _dsc_holder
  — getDSCStatus(daysLeft): returns { label, color, bg, border, icon: 'ok'|'warn'|'danger'|'none' }
    danger ≤7d or expired, warn 8-30d, ok >30d, none = not set
  — Stats bar: 4 clickable filter tiles (total, danger, warn, not set) — filters the table
  — Red alert banner when any danger clients exist
  — Table columns: Client | DSC Holder | Expiry Date | Status | Action
  — Sorted: danger → warn → ok → none, then alphabetical within each group
  — Inline edit: date picker + holder name input, saves via PATCH /api/clients/{id}
    Uses custom_fields merge pattern: { _dsc_expiry, _dsc_holder } merged into existing JSONB
  — canManage gate (owner/admin/manager): edit button only shown to these roles
  — Search filter, status filter, refresh button
  — Export CSV button: downloads client name, holder, expiry, status as CSV
app/(app)/compliance/CATasksView.tsx  — CA Tasks tab (step 4 in ComplianceShell)
  — patchStatus: now reads d.error from response body, surfaces real API error  ← Session 7
  — patchStatus: fixed snapshot rollback bug — now uses prevSelTask snapshot not tasks array  ← Session 9
  — filterAssignee state: '' | 'unassigned' | memberId  ← Session 7
    Toolbar: "All assignees / ⊘ Unassigned / <member>" select — included in activeFilters
  — doMasterUpdate(data) + updateMasterAssignment() refactored  ← Session 8
    doMasterUpdate accepts params directly (no state dependency)
    If task was UNASSIGNED (assignee_id===null): auto-calls doMasterUpdate immediately (no popup)
    If task was ALREADY ASSIGNED: shows masterUpdatePrompt popup to confirm overwrite
  — masterUpdatePrompt state + updateMasterAssignment(): when assignee_id changes in
    onUpdated, show popup asking to also PATCH ca_client_assignments.assignee_id  ← Session 7
  — Health stats bar: 4 tiles above toolbar  ← Session 9
    Total tasks | Overdue (red, count from all tasks not just filtered) | Due this week (amber) | Pending approval (purple)
    Computed from tasks[] (not visible[]); only shown when tasks.length > 0 and not loading
  — Urgency chips on list rows: inline below client name  ← Session 9
    urgencyChip(due_date, status) → { label, bg, color } | null
    "Overdue Xd" red | "Due today" teal | "Xd left" amber (only for ≤7d) | null otherwise
    Hidden for completed/cancelled tasks
  — WhatsApp Reminder button in bulk action bar (green, MessageCircle icon)  ← Session 9
    Generates multi-task reminder message → opens wa.me/?text=<encoded> in new tab
    Message: "Dear Client, reminder for: • Task (Client) — due DD Mon YYYY ..."
app/(app)/monitor/page.tsx            — NEW Session 8: Monitor server page (read-only, all roles)
  — export const dynamic = 'force-dynamic'
  — Fetches ALL org tasks (no role scoping — always full org view)
  — TASK_COLS: id, title, status, priority, due_date, assignee, approver, creator, projects
  — Fetches members + clients in parallel
  — Passes tasks/members/clients/currentUserId/userRole to MonitorView
app/(app)/monitor/MonitorView.tsx     — NEW Session 8: Monitor client component
  — 'use client', fully read-only (no create/edit/delete buttons anywhere)
  — Stats bar: total | todo | inProgress | inReview | completed | overdue | unassigned | CA count
  — Filters: search, status (multi-select pill), priority, assignee, client, type, dueDateFrom/To, clear all
  — GroupBy: status (default) | assignee | client | type | none — each group collapsible
  — Task rows: 6-col grid — Task+client | Type badge | Priority | Status pill | Assignee avatar | Due date
  — Type colors: CA=#d97706, Repeat=#0d9488, Project=#7c3aed, Quick=#0891b2
  — Overdue: red text + ⚠ indicator on due date cell
  — Unassigned: amber "⊘ Unassigned" label instead of avatar
  — Opens TaskDetailPanel with userRole="viewer" to enforce fully read-only panel

app/(app)/import/page.tsx             — Data import wizard  ← renamed display text in Session 8
app/(app)/import/ImportView.tsx       — Import wizard UI
  — "Importing one-time tasks…" → "Importing quick tasks…"  ← Session 8
  — "Importing recurring tasks…" → "Importing repeat tasks…"  ← Session 8
  — Result labels: "Quick tasks" / "Repeat tasks"  ← Session 8
app/(app)/approvals/ApprovalsView.tsx — Approval queue UI
  — StatTile "One-time" → "Quick tasks"; section labels renamed  ← Session 8
app/(app)/settings/features/FeaturesView.tsx — Feature flags UI
  — 'One-time tasks' feature → 'Quick tasks'; 'Recurring tasks' → 'Repeat tasks'  ← Session 8
app/(app)/team/page.tsx               — Team members
app/(app)/profile/page.tsx            — User profile
app/(app)/settings/*/page.tsx         — Settings: org, members, permissions, billing, categories,
                                         custom-fields, features, notifications, appearance, trash
```

#### API Routes
```
app/api/tasks/route.ts                — GET list / POST create task
  — GET: SELECT now includes created_at, updated_at  ← Session 4
  — POST: assertCan(tasks.create) after membership check  ← Session 4
app/api/tasks/[id]/route.ts           — GET / PATCH / DELETE single task
  — PATCH: managers can update all fields incl. assignee_id, approver_id
  — PATCH: assertCan(tasks.complete / tasks.assign / tasks.edit_own / tasks.edit)  ← Session 4
  — DELETE: assertCan(tasks.delete)  ← Session 4
  — PATCH subtask-incomplete gate: `&& !isOwnerOrAdmin` — owner/admin can force-complete  ← Session 7
app/api/tasks/[id]/approve/route.ts   — POST: submit / approve / reject
  — submit: assignee OR isOwnerOrAdmin
  — approve/reject: designated approver OR isOwnerOrAdmin
  — CA compliance: checks attachment_count vs ca_master_tasks before submit
  — submit subtask gate: `!isOwnerOrAdmin &&` — owner/admin can force-submit  ← Session 7
  — approve subtask gate: `!isOwnerOrAdmin &&` — owner/admin can force-approve  ← Session 7
  — both gates filter _compliance_subtask:true rows before counting  ← Session 10
app/api/admin/fix-compliance-tasks/route.ts — POST: owner/admin one-shot cleanup of stale _compliance_subtask rows  ← Session 10
app/api/tasks/route.ts (GET)
  — ca_compliance=true param: server-side JSONB filter + raised cap (2000 vs 500)  ← Session 11
app/api/tasks/[id]/comments/route.ts  — Comments CRUD
app/api/tasks/[id]/attachments/route.ts — Attachments upload/delete

app/api/projects/route.ts             — Projects list/create
  — POST: assertCan(projects.create)  ← Session 4
app/api/projects/[id]/route.ts        — Project CRUD
  — PATCH: assertCan(projects.edit)  ← Session 4
  — DELETE: assertCan(projects.delete)  ← Session 4
app/api/clients/route.ts              — Clients list/create
  — POST: assertCan(clients.create)  ← Session 4
  — POST: now accepts custom_fields (JSONB) in body  ← Session 9
app/api/clients/[id]/route.ts         — Client CRUD
  — PATCH: assertCan(clients.edit)  ← Session 4
  — PATCH: custom_fields merge — fetches existing JSONB then spreads new keys over it  ← Session 9
    Pattern: { ...(existing?.custom_fields ?? {}), ...(body.custom_fields as object) }
    Prevents overwriting unrelated keys (e.g. DSC keys when saving GST keys)
  — DELETE: assertCan(clients.delete)  ← Session 4
app/api/gst/lookup/route.ts           — NEW Session 9: GST number lookup proxy
  — GET /api/gst/lookup?gstin=XX (auth-gated: must be logged-in org member)
  — Validates GSTIN format: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
  — With GSTIN_API_KEY env var: POSTs to Surepass KYC API → full business data
    (name, trade_name, gst_status, state, address, pincode, constitution, nature_of_business,
     registration_date) + parsed PAN + state from format
  — Without key: parses GSTIN format only → returns pan (digits 2-11) + state (STATE_CODES map)
    Returns { partial: true, message: "Set GSTIN_API_KEY..." }
  — On API error/404: returns partial:true with parsed fallback instead of 500
  — STATE_CODES: 01-99 → Indian state names (all 36 states + UTs)
app/api/recurring/route.ts            — Recurring tasks CRUD
  — POST: assertCan(recurring.create)  ← Session 4
  — PATCH: assertCan(recurring.edit)  ← Session 4
app/api/time-logs/route.ts            — Time logs CRUD
  — POST: assertCan(time.log)  ← Session 4
app/api/team/route.ts                 — Team members CRUD
  — POST: assertCan(team.invite)  ← Session 4
  — PATCH deactivate: assertCan(team.remove)  ← Session 4
  — PATCH role change: assertCan(team.change_role)  ← Session 4
app/api/search/route.ts               — Global search
app/api/reports/export/route.ts       — Excel export
app/api/import/route.ts               — File import
app/api/ca/master/route.ts            — CA master tasks CRUD
app/api/ca/trigger/route.ts           — Trigger compliance task spawn
app/api/inngest/route.ts              — Inngest event handler endpoint
app/api/onboarding/route.ts           — Org creation
app/api/settings/organisation/route.ts — PATCH: assertCan(settings.org)  ← Session 4
app/api/settings/tasks/route.ts       — POST: assertCan(settings.tasks)  ← Session 4
app/api/settings/*/route.ts           — Other settings endpoints
app/api/ai/describe-task/route.ts     — AI task description
```

### components/
```
components/tasks/TaskDetailPanel.tsx  — Side panel for task details
  — approverInfo = (task as any)?.approver  ← null if page didn't select approver join
  — isDesignatedApprover: includes isOwnerOrAdmin
  — canEdit = canManage || isAssignee
  — Shows "Any manager can approve" only when approverInfo is null AND no approver_id
  — Subtask add row: progressive disclosure — assignee select + due date shown only
    when title input has content; Escape clears all three fields
  — Created date row: shows task.created_at formatted with toLocaleString  ← Session 4
  — Last modified row: shows (task as any).updated_at formatted with toLocaleString  ← Session 4
    IMPORTANT: must use toLocaleString (not toLocaleDateString) to include hour/minute/hour12

components/tasks/InlineTaskRow.tsx    — Editable row in project/list views
components/tasks/InlineOneTimeTask.tsx — Inline create one-time task
  — Title row glorified when empty: teal left-border accent + tinted bg; circle full opacity  ← Session 7
  — Input fontSize:15 / fontWeight:600 (from 14/500); placeholder "What needs to be done?"  ← Session 7
  — .iot-title-input::placeholder CSS: teal 55% opacity, italic  ← Session 7
  — Divider thickens (2px brand tint) when empty, hairline once typed  ← Session 7
  — All transitions 0.25s ease so effects fade naturally as user types  ← Session 7
components/tasks/InlineRecurringTask.tsx — Inline create repeat task  ← Session 8 (renamed)
  — Same glorification treatment as InlineOneTimeTask  ← Session 7
  — .irt-title-input::placeholder; placeholder "What repeats? Name this task…"  ← Session 7
  — RefreshCw icon at full opacity when empty → 45% once typed  ← Session 7
  — Toast: "Repeat task created ✓"; button label "Add repeat task"  ← Session 8
components/tasks/CustomFieldsPanel.tsx — Custom fields editor in TaskDetailPanel
components/tasks/MentionTextarea.tsx  — @mention textarea for comments
components/tasks/CompletionAttachModal.tsx — Attach files when completing task

components/layout/Sidebar.tsx         — Left nav sidebar
  — SI component calls router.refresh() on every link click (when not already active)
    to force server-component re-fetch and show latest data
  — Nav labels: "Quick tasks" (was "One-time tasks"), "Repeat tasks" (was "Recurring tasks")  ← Session 8
  — Monitor nav item added to Organisation section: Eye icon → /monitor (all roles)  ← Session 8

components/layout/Header.tsx          — Top header with user menu
  — Quick-create label: "Repeat task" (was "Recurring task")  ← Session 8
components/clients/QuickAddClientModal.tsx — Quick-add client modal (used in task creation flows)
  — GSTIN auto-fill section added  ← Session 9
    Same pattern as NewClientForm: auto-triggers at 15 chars, fills name + company + gstInfo chips
    Saves { gstin, pan, gst_status, gst_state } to custom_fields on create
components/search/SearchModal.tsx     — Global search (Cmd+K)
components/walkthrough/WalkthroughOverlay.tsx  — NEW Session 12: first-time user onboarding walkthrough
  — 10-step feature tour + 1 welcome + 1 done = 12 cards total
  — Only shows to accounts < 7 days old (userCreatedAt check) — never to existing users
  — Per-user localStorage key: planora_wt_v1_${userId} — dismissed once, never returns
  — createPortal to document.body (z-index 99999) — renders above all app content
  — 4-quadrant spotlight overlay with pulsing teal ring on sidebar nav targets
  — Smart tooltip positioning: right → left → below → above of spotlight
  — useRouter().push(step.path) on Next (forward only) — navigates user to each feature's page
  — Quick Tasks step has action CTA "Create your first task" → /inbox (dismisses tour on click)
  — Progress bar, clickable step dots, Skip/Back/Next/Start/Let's go buttons
  — Welcome + Done: centered modal, 80px emoji icon, feature chips

components/filters/UniversalFilterBar.tsx — Shared filter UI
  — Props: showSearch, showPriority, showStatus, showAssignee, showAssignor, showDueDate
  — showCreatedDate?: boolean  — shows Created date range filter  ← Session 4
  — showUpdatedDate?: boolean  — shows Last modified date range filter  ← Session 4
  — showAssignor?: boolean  — shows "Assigned by" pill using store.creatorId
  — creatorId filter state stored in Zustand (see store/appStore.ts)
  — CREATED_PRESETS / UPDATED_PRESETS: Today / Last 7d / Last 30d / Last 90d / Custom
  — Preset + custom date range UI matches existing Due Date filter pattern

components/ui/Toast.tsx               — Toast notification system
components/ui/Badge.tsx               — Status/priority badges
components/ui/DatePicker.tsx          — Date picker component
components/ui/UpgradeWall.tsx         — Paid plan upsell modal
components/theme/ThemeProvider.tsx    — Dark/light theme context
```

### lib/
```
lib/supabase/client.ts                — Browser Supabase client
lib/supabase/server.ts                — Server Supabase client (SSR)
lib/supabase/admin.ts                 — Admin client (bypasses RLS)
lib/supabase/cached.ts                — Cached: getSessionUser, getOrgMembership

lib/inngest/client.ts                 — Inngest client + event type definitions
lib/inngest/functions/onTaskAssigned.ts   — Email on task assigned
lib/inngest/functions/onApproval.ts       — Email on approval request/result
lib/inngest/functions/dailyReminders.ts   — Daily due-date reminder emails
lib/inngest/functions/recurringSpawn.ts   — Creates recurring task instances
lib/inngest/functions/caComplianceSpawn.ts — Spawns CA compliance tasks

lib/email/send.ts                     — Core email sender
lib/email/templates/approvalEmail.ts  — Approval notification template
lib/email/templates/taskAssigned.ts   — Assignment notification template

lib/utils/format.ts                   — fmtDate, fmtHours, todayStr, etc.
lib/utils/planGate.ts                 — Feature availability by plan tier
lib/utils/cn.ts                       — Tailwind classname merge (clsx + twMerge)
lib/utils/permissionGate.ts           — NEW Session 4: server-side permission gate (see Root Config above)
lib/hooks/useOrgSettings.ts           — Org settings React hook
  — OrgSettings interface now includes: rolePermissions: RolePermissions | null  ← Session 4
  — fetchSettings() fetches /api/settings/permissions in parallel with other settings  ← Session 4
  — Exports: checkPermission(rolePermissions, role, permission): boolean  ← Session 4
    owner/admin always true; falls back to DEFAULT_PERMISSIONS if null
lib/whatsapp/send.ts                  — WhatsApp notifications
lib/compliance/index.ts               — CA compliance task logic
lib/data/caDefaultTasks.ts            — Default CA task templates
```

---

## KEY BUGS FIXED (ALL SESSIONS)

---

### SESSION 1 FIXES

### 1. Recurring task not showing in My Tasks immediately
- **Root cause**: `RecurringView.tsx` `onCreated` had no `router.refresh()` call
- **Fix**: Added `startT(() => router.refresh())` to `onCreated` in `RecurringView.tsx`

### 2. Task assigned to someone else ended up on Sachit (creator)
- **Root cause A**: `MyTasksView.tsx` `onCreated` added ALL new tasks to local `tasks` state regardless of `assignee_id`
- **Fix A**: Added `assignedToMe` check — only adds to state if `assignee_id === currentUserId`
- **Root cause B**: `ProjectView.tsx` showed "+ Assign to me" when `members.find()` returned undefined (member not in local array) even though `task.assignee_id` was already set
- **Fix B**: Changed condition to check `!task.assignee_id` directly instead of `!assignee`

### 3. Owner/admin blocked from submit/approve operations
- **Root cause**: `/api/tasks/[id]/approve/route.ts` had hard guards with no owner/admin bypass
- **Fix**: Added `isOwnerOrAdmin = ['owner','admin'].includes(mb.role)` bypass to all three decision paths (submit, approve, reject)

### 4. "Any manager can approve" shown even when specific approver is designated
- **Root cause**: Multiple pages were missing the `approver:users!tasks_approver_id_fkey(id, name)` join in their SELECT queries. `TaskDetailPanel` derives `approverInfo` from `(task as any)?.approver` — null when join not fetched
- **Fixed pages**:
  - `app/(app)/approvals/page.tsx` — added approver join to both pending + history queries, added `approver: t.approver ?? null` to `enrichTask`
  - `app/(app)/calendar/page.tsx` — added `approver_id, approval_status, approval_required, approver join` to SELECT + enrichment
  - `app/(app)/projects/[projectId]/page.tsx` — added `approver_id, approver join` to SELECT + `approver: (t.approver as any) ?? null` to taskList map

### 5. My Tasks Kanban "To do" column removed
- **Fix**: Removed `todo` from `BOARD_COLS` in `MyTasksView.tsx`; updated `in_progress` filter to also capture `status === 'todo'` tasks

---

### SESSION 2 FIXES

### 6. Inline subtask add missing assignee + due date
- **Root cause**: `TaskDetailPanel` subtask add form only had a title input
- **Fix**: Added `newSubAssigneeId` / `newSubDueDate` states; second row (assignee select + date picker + Add button) shown only when title has content (progressive disclosure). Escape clears all fields.
- **Also done in**: `RecurringView.tsx` with per-task state maps `newSubAssignees` / `newSubDueDates`

### 7. "Assigned by" filter and column missing everywhere
- **Root cause**: `creatorId` was not in the Zustand filter store; creator FK join was missing from most page queries; no UI for the filter
- **Fix**:
  - `store/appStore.ts`: added `creatorId: string` to `FilterState`, initial `''`, to `resetFilters`
  - `UniversalFilterBar`: added `showAssignor?: boolean` prop + "Assigned by" PillSelect
  - `tasks/page.tsx`: already had creator join; enriched `creator`
  - `recurring/page.tsx` + `inbox/page.tsx`: added `creator:users!tasks_created_by_fkey(id, name)` to SELECT and enrichment
  - `MyTasksView` / `RecurringView` / `InboxView`: filter on `creatorId`, show column in grid, pass `showAssignor` to both filter bars

### 8. Sidebar navigation didn't refresh stale data
- **Root cause**: Next.js `<Link>` uses client-side navigation which does NOT re-run server components by default; cached data was shown
- **Fix**: `Sidebar.tsx` `SI` component now calls `router.refresh()` on every link click when not already on that page

### 9. Inline upload button for compliance / approval_required tasks
- **Added**: Small amber arrow-up SVG `<label>` wrapping `<input type="file">` in the title cell of compliance tasks and `approval_required` tasks, on all three views (MyTasksView, RecurringView, InboxView)
- **Pattern**: `e.stopPropagation()` on both `<label onClick>` and `<input onClick>` to prevent TaskDetailPanel opening; POST to `/api/tasks/${id}/attachments` with `FormData`; compliance subtask rows in InboxView also get upload buttons

---

### SESSION 3 FIXES

### 10. Pending approval tasks missing from Kanban board
- **Root cause**: `displayTasks = showAssignedByMe ? assignedByMeTasks : filteredTasks` — `filteredTasks` is built from `tasks` state (tasks assigned TO current user). `pendingApprovalTasks` (others' tasks awaiting manager approval) is a separate prop that was never merged into `displayTasks`. The board's "Pending approval" column only looked at `displayTasks`.
- **Fix**: Compute `extraPendingForBoard = pendingTasks.filter(pt => !filteredTasks.some(t => t.id === pt.id))` before the `BOARD_COLS.map`. Board's `in_review` column now uses `[...displayTasks filter..., ...extraPendingForBoard]`.

### 11. Inline approval (Approve/Return) didn't update UI until page refresh
- **Root cause**: `handleApproveDecision` updated `tasks` state (`setTasks`), but the "Needs your approval" section rendered from the raw `pendingApprovalTasks` **prop** which is immutable on the client.
- **Fix**: `pendingApprovalTasks` prop converted to local state `const [pendingTasks, setPendingTasks] = useState<Task[]>(pendingApprovalTasks)`. `handleApproveDecision` now:
  - Optimistically: `setPendingTasks(prev => prev.filter(t => t.id !== taskId))`
  - On API failure: `setPendingTasks(prev => [pendingTaskSnapshot, ...prev])` (restores)
  - "Needs your approval" section renders from `pendingTasks` state; badge count is live.

### 12. "Assigned by" column missing from InboxView list
- **Root cause**: Grid had 9 columns with no creator slot; no filter bar `showAssignor`.
- **Fix**: Grid updated to 10 columns (`'36px 22px 1fr 100px 110px 110px 100px 80px 32px 28px'`); "Assigned by" header + creator cell added after Due date column; `showAssignor` added to List view filter bar.

---

---

### SESSION 4 FIXES

### 13. Cross-page stale data — navigating between pages showed cached data
- **Root cause A**: Next.js router cache was serving stale RSC payloads on client-side navigation
- **Fix A**: `next.config.ts` — added `experimental.staleTimes: { dynamic: 0 }` to disable router cache entirely for dynamic routes
- **Root cause B**: Several pages were missing `export const dynamic = 'force-dynamic'`, so server components were statically cached at build time
- **Fix B**: Added `force-dynamic` to `tasks/page.tsx`, `inbox/page.tsx`, `recurring/page.tsx`, `clients/[clientId]/page.tsx`, `settings/tasks/page.tsx`, `settings/notifications/page.tsx`, `settings/organisation/page.tsx`, `settings/billing/page.tsx`, `settings/members/page.tsx`

### 14. Permission toggles in PermissionsView had no enforcement — settings were saved but never read
- **Root cause**: Permission toggles stored data in `org_settings.role_permissions` (JSONB) but no API route ever read that data before mutating
- **Fix**: Created `lib/utils/permissionGate.ts` with:
  - `DEFAULT_PERMISSIONS` constant mirroring PermissionsView.tsx exactly (30 permissions)
  - `fetchOrgPermissions()` — React `cache()`-wrapped Supabase read (deduplicates within request)
  - `canDo()` — returns boolean; owner/admin always bypass
  - `assertCan()` — returns `{error, status: 403}` or `null`
- Applied `assertCan` to 20 API route mutation handlers across tasks, projects, clients, recurring, team, time-logs, settings

### 15. Created/Last modified dates not showing in TaskDetailPanel
- **Root cause 1**: All page-level Supabase SELECT strings did not include `created_at` or `updated_at`
- **Fix 1**: Added both fields to SELECT in `tasks/page.tsx`, `inbox/page.tsx`, `recurring/page.tsx`, `projects/[projectId]/page.tsx`, `api/tasks/route.ts` GET
- **Root cause 2**: Enrichment maps hardcoded `created_at: ''`, making the field always falsy
- **Fix 2**: Changed to `created_at: t.created_at ?? ''` and added `updated_at: t.updated_at ?? null` to all enrichment maps
- **Root cause 3**: `TaskDetailPanel` used `toLocaleDateString` for formatting, which silently ignores `hour`/`minute`/`hour12` options
- **Fix 3**: Changed to `toLocaleString` (must use this API for combined date + time display)
- **Root cause 4**: `types/index.ts` Task interface was missing `updated_at`
- **Fix 4**: Added `updated_at?: string` to Task type
- **Filter system**: Added `createdFrom`, `createdTo`, `updatedFrom`, `updatedTo` to Zustand `FilterState`; `UniversalFilterBar` gained `showCreatedDate`/`showUpdatedDate` props with preset + custom date range UI; all views (InboxView, MyTasksView, RecurringView) filter on these 4 fields

### 16. All tasks in CalendarView appeared green (color coding broken)
- **Root cause**: `taskTypeBorder/Bg/Dot` functions correctly returned type-based colors, but downstream in the render both timeline boxes and month-grid pills had `isDone ? '#16a34a' : borderClr` overrides — since all visible tasks were completed, everything rendered green
- **Fix**: Removed `isDone` color overrides from both timeline and month-grid render paths. Type color now always shows. Done state expressed via `opacity: 0.72` (timeline) / `0.68` (month pills) instead
- **Also fixed**: Legend recurring icon color was `#ea580c` (orange) instead of `#0d9488` (teal) to match `taskTypeBorder` function

### 19. White/light boxes appearing throughout the app in dark mode
- **Root cause 1 (new colors missing)**: Several light hex values used across the codebase had no dark-mode override in `globals.css`:
  - `#fffbeb`, `#fde68a`, `#fef3c7` — amber (billing banners, task settings notes, trash warnings)
  - `#fff1f2`, `#fff5f5` — rose/red (billing inactive badge, import error containers)
  - `#eff6ff` — blue (compliance in_progress status badge)
  - `#fdf4ff` — purple (compliance in_review status badge)
  - `#dbeafe`, `#fae8ff` — additional blue/purple light variants
  - `linear-gradient(135deg,#faf5ff,#f0fdfa)` — upsell gradient (TrashView, PermissionsView)
- **Root cause 2 (existing overrides didn't match React-rendered HTML)**: The existing override block in `globals.css` used ONLY the single-quoted selector form e.g. `[style*="background: '#fef2f2'"]`. React renders `style={{ background: '#fef2f2' }}` as `style="background: #fef2f2;"` in the DOM (no quotes). So ALL the "chip background" rules at lines 918-933 were silently failing.
- **Fix**: Replaced the entire inline-background override section with a new block that:
  - Covers 17 specific hex colors + their border counterparts
  - Includes BOTH the unquoted form (catches React-rendered) AND the quoted form (catches edge cases)
  - Adds explicit border-color overrides for amber, green, purple, red, and grey border patterns
- **Critical anti-pattern avoided**: `[style*="background: #fff"]` (unquoted) would substring-match `#fffbeb`, `#fff7ed`, etc. and override their specific amber/red rules due to CSS cascade order. Only `[style*="background: '#fff'"]` (quoted, harmless) is used for 3-digit white.
- **Only file changed**: `app/globals.css` — no component files were touched

### 18. Clients page had no inline edit/delete — required navigating into the client to manage it
- **Fix**: Extracted `ClientsView.tsx` (client component) from `clients/page.tsx` (now a thin server wrapper)
- **Edit button**: Pencil icon (top-right of each card) → navigates to `/clients/[id]/edit`
- **Delete button**: Trash2 icon (top-right of each card) → `DELETE /api/clients/[id]` with confirm dialog + optimistic UI removal + `router.refresh()`
- **Checkbox**: Teal custom checkbox (top-left of each card, canManage only) — selected cards get teal outline
- **Select all / Deselect all**: Button in header toggles all checkboxes
- **Bulk action bar**: Appears when ≥1 selected — red tinted bar with count, "Delete selected" (parallel DELETE calls), and Cancel
- **Partial failures**: Each DELETE is called independently; success/failure counts reported separately
- No changes to existing routing, edit form, or API routes

### 17. Task list rows in all views had no visual type distinction (all looked the same)
- **Root cause**: Type color logic existed in some views at very low opacity; no `borderLeft` accent was applied
- **Fix**: Applied consistent color coding across every list/board view:
  - **Type accent colors**: Compliance=`#d97706`, Recurring=`#0d9488`, Project=`#7c3aed`, One-time=`#0891b2`
  - **Every list row**: `borderLeft: 3px solid typeAccent` + subtle `rgba` background tint per type
  - **Board cards** (InboxView, MyTasksView): `background: typeBg, borderLeft: 3px solid typeAccent`
  - **ProjectView TaskRow**: compliance vs project accent (amber vs purple)
  - **RecurringView rows**: compliance vs recurring accent (amber vs teal)
  - No changes to existing task status logic, approval flow, or any other functionality

---

### SESSION 7 FIXES & FEATURES

### 20. Owner blocked from completing / submitting / approving tasks with incomplete subtasks
- **Root cause**: Three subtask-incomplete gates had no owner/admin bypass. CA compliance tasks always carry subtasks (one per attachment header). Any owner action on a CA task triggered these gates and returned 422.
- **Files fixed**:
  - `app/api/tasks/[id]/route.ts` PATCH — `if (body.status === 'completed' && !task.parent_task_id && !isOwnerOrAdmin)`
  - `app/api/tasks/[id]/approve/route.ts` submit branch — `if (!isOwnerOrAdmin && subtasks && subtasks.length > 0)`
  - `app/api/tasks/[id]/approve/route.ts` approve branch — `if (!isOwnerOrAdmin && subtasksForApprove && ...)`
- **Rule**: Owner/admin bypass ALL gates. Every new gate must include `&& !isOwnerOrAdmin` or `if (isOwnerOrAdmin) skip`.

### 21. CATasksView patchStatus swallowed real API error — always showed "Update failed"
- **Root cause**: `if (!res.ok) { setTasks(prev); toast.error('Update failed') }` — no attempt to read body
- **Fix**: `const d = await res.json().catch(() => ({}))`; `toast.error(d.error ?? 'Update failed')`
- **Pattern**: All patchStatus / inline-update handlers must read `d.error` from response body (see MyTasksView, InboxView which already do this correctly with `toast.error(d.error ?? '...')`).

### 22. CA Tasks — no way to filter unassigned tasks
- **Added**: `filterAssignee` state (`'' | 'unassigned' | memberId`) in `CATasksView`
- **Toolbar**: "All assignees / ⊘ Unassigned / \<member>" `<select>` after the Status filter
- **Filter logic**:
  ```typescript
  if (filterAssignee === 'unassigned' && t.assignee_id !== null) return false
  if (filterAssignee && filterAssignee !== 'unassigned' && t.assignee_id !== filterAssignee) return false
  ```
- Included in `activeFilters` count and reset by Clear button.

### 23. CA Tasks — no way to update recurring assignment when assigning a task
- **Added**: When `onUpdated` is called with a changed `assignee_id` on a CA task that has a `client_id`, show a popup: *"Update recurring assignment for \<client> so future '\<task>' tasks go to \<assignee>?"*
- **"Yes" flow**: `GET /api/ca/assignments?client_id=X` → find row where `master_task.name === task.title` → `PATCH /api/ca/assignments/{id} { assignee_id }` → future `caComplianceSpawn` runs use new assignee
- **State**: `masterUpdatePrompt` object + `masterUpdating` boolean (spinner + disabled buttons during PATCH)
- **Guard**: Only fires for `canManage` roles when task has a `client_id`. Tasks without client cannot have an assignment row.

### 24. Inline task name field not noticed — users filled details before task name
- **Fix**: Glorified the title row in both `InlineOneTimeTask` and `InlineRecurringTask`:
  - Teal `3px` left-accent border when empty → transparent once typing starts
  - Subtle `rgba(13,148,136,0.045)` background tint on title row → transparent once typing
  - Divider below title: `2px` brand tint when empty → `1px` hairline once typing
  - Circle / RefreshCw icon: full opacity when empty → 40–45% once typing
  - Input: `fontSize:15 / fontWeight:600` (from 14/500)
  - Placeholders: `"What needs to be done?"` / `"What repeats? Name this task…"` styled teal+italic
  - All transitions `0.25s ease` — effects fade naturally, not jarring

---

### SESSION 8 FEATURES

### 25. CA Tasks — auto-update master when assigning a previously-unassigned task
- **Problem**: Session 7 added a popup to ask "update master assignment?" whenever a task was reassigned. But for tasks that were *never* assigned, showing a confirmation popup is unnecessary friction.
- **Fix**: Refactored `updateMasterAssignment()` into `doMasterUpdate(data)` (accepts explicit params, no state dependency) + `updateMasterAssignment()` (reads `masterUpdatePrompt` state for popup path).
- **New logic in `onUpdated`**:
  - `selTask.assignee_id === null` → call `doMasterUpdate(promptData)` immediately, no popup
  - `selTask.assignee_id !== null` → set `masterUpdatePrompt`, show confirmation popup as before
- **File**: `app/(app)/compliance/CATasksView.tsx`

### 26. Upcoming CA compliance triggers shown in Calendar and Tasks (next 3 days, owner/admin only)
- **Added**: Ghost amber "not-yet-spawned" CA tasks visible before they're created, so managers can prepare.
- **Computation** (identical in both `calendar/page.tsx` and `tasks/page.tsx`):
  1. Fetch `ca_client_assignments` joined with `ca_master_tasks` (priority, dates JSONB, days_before_due)
  2. Fetch `ca_task_instances` (to know which have already been spawned: keyed `${assignment_id}__${due_date}`)
  3. For each assignment × date entry: compute `triggerDate = dueDate − days_before_due`
  4. If `triggerDate > today && triggerDate <= today+3 && not already spawned` → push to `upcomingCATriggers[]`
  5. Only computed for `isOwnerAdmin`; others receive `[]`
- **CalendarView**: `byTriggerDate` map. Renders ghost amber dashed cards in:
  - Timeline day column (after real tasks)
  - Month grid day cell (up to 2 pills, amber dashed border, ⏰ emoji)
  - Day panel side section ("CA tasks triggering soon")
- **MyTasksView**: `CATriggerSection` component — collapsible section with ⏰ header showing
  title | client | due date | spawns-on date for each upcoming trigger
- **Files**: `app/(app)/calendar/page.tsx`, `app/(app)/calendar/CalendarView.tsx`,
  `app/(app)/tasks/page.tsx`, `app/(app)/tasks/MyTasksView.tsx`

### 27. Renamed "One-time tasks" → "Quick tasks" and "Recurring tasks" → "Repeat tasks" everywhere in UI
- **Scope**: ALL user-facing display text only. Routes (`/inbox`, `/recurring`), DB fields (`is_recurring`), API params, internal variable names, and CSS class names are unchanged.
- **Files changed**:
  - `components/layout/Sidebar.tsx` — nav labels + hover tooltips
  - `components/layout/Header.tsx` — quick-create dropdown label
  - `app/(app)/dashboard/DashboardClient.tsx` — quick-action label
  - `app/(app)/inbox/page.tsx` — metadata title → "Quick tasks"
  - `app/(app)/inbox/InboxView.tsx` — h1, empty state text
  - `app/(app)/recurring/page.tsx` — metadata title → "Repeat tasks"
  - `app/(app)/recurring/RecurringView.tsx` — empty state text
  - `components/tasks/InlineRecurringTask.tsx` — toast text, button label
  - `app/(app)/calendar/CalendarView.tsx` — filter pill label, legend label
  - `app/(app)/approvals/ApprovalsView.tsx` — stat tile and section labels
  - `app/(app)/settings/features/FeaturesView.tsx` — feature names and descriptions
  - `app/(app)/import/ImportView.tsx` — progress step text and result labels

### 28. New Monitor page — read-only all-tasks view for monitor/viewer role
- **New files**: `app/(app)/monitor/page.tsx` + `app/(app)/monitor/MonitorView.tsx`
- **Purpose**: A person who only monitors task status and follows up with team members — no create/edit/delete access.
- **Server page**: Fetches ALL org tasks (no role scoping, no assignee filter) + members + clients. Passes `userRole` but MonitorView ignores it for permissions (always viewer mode).
- **Client component features**:
  - Stats bar: 8 tiles (total, todo, in_progress, in_review, completed, overdue, unassigned, CA tasks)
  - Filters: text search, status (multi-select), priority, assignee, client, type (ca/repeat/project/quick), due date range from/to, Clear all button
  - GroupBy selector: status (default) | assignee | client | type | none
  - Each group is collapsible (chevron toggle), shows count badge
  - Task rows: 6-column grid with type badge, priority badge, status pill, assignee avatar, due date
  - Overdue: red `⚠ date` indicator
  - Unassigned: amber "⊘ Unassigned" label
  - Click → opens `TaskDetailPanel` with `userRole="viewer"` (fully read-only panel)
- **Nav**: `Eye` icon in Organisation section of Sidebar, visible to all roles

---

### SESSION 9 FEATURES

### 29. CA Compliance — DSC Tracker (step 5)
- **New file**: `app/(app)/compliance/CADSCTrackerView.tsx`
- **Purpose**: Track Digital Signature Certificate expiry dates for all clients in one place.
- **Data storage**: `client.custom_fields._dsc_expiry` (ISO date string) + `_dsc_holder` (string). No schema change needed — uses existing `custom_fields` JSONB column.
- **Features**:
  - Stats bar with 4 clickable filter tiles: Total / Danger (≤7d/expired) / Warning (8-30d) / Not set
  - Red alert banner when any client is in danger zone
  - Sortable table: danger → warn → ok → none, then alphabetical
  - Inline edit: click Edit → date picker + holder name input → saves via `PATCH /api/clients/{id}` with custom_fields merge
  - Search by client name/holder; filter by status; CSV export
- **Wired into**: `ComplianceShell.tsx` as step 5 with ShieldCheck icon and "DSC Tracker" tab label; `?tab=dsctracker` URL param routes directly to it; step type widened to `1|2|3|4|5`
- **canManage gate**: only owner/admin/manager see Edit button

### 30. CA Compliance — CAKanbanView overdue/due-today badges on column headers
- **File**: `app/(app)/compliance/ComplianceShell.tsx` (CAKanbanView component inside it)
- **What changed**: Each client column header now shows a badge when tasks have past/today due dates:
  - Red "N overdue" badge when `_nextDueDate < today && status !== 'completed'`
  - Teal "N today" badge (only when no overdue) when `_nextDueDate === today && status !== 'completed'`
  - No badge shown when all tasks are on track
- Computed inline via IIFE in the column header render; uses `allTasks` (not filtered subset)

### 31. CA Tasks — health stats bar + urgency chips + WhatsApp reminder
- **File**: `app/(app)/compliance/CATasksView.tsx`
- **Health stats bar**: 4 stat tiles rendered above the toolbar when tasks exist and loading is done.
  - Tiles: Total tasks | Overdue (red highlight when >0) | Due this week (amber when >0) | Pending approval (purple when >0)
  - Counts from `tasks[]` (all tasks, ignoring current filters) so stats represent true org health
  - `weekFromNow = today + 7 days`; "pending approval" = `status === 'in_review'`
- **Urgency chips**: Inline chip in list row title cell, below client name
  - `urgencyChip(due_date, status)` helper: returns `{ label, bg, color }` or null
  - Red "Overdue Xd" | Teal "Due today" | Amber "Xd left" (only 1-7 days) | null (>7 days or completed)
  - Hidden for completed/cancelled tasks; visible only in List view (not Board)
- **WhatsApp Reminder**: Green button in bulk action bar (appears when ≥1 task checked)
  - Groups selected tasks into a single message: "Dear Client, reminder for: • Task (Client) — due date..."
  - Opens `https://wa.me/?text=<encoded>` in new tab (no phone number needed — user picks contact in WhatsApp)
  - Uses `MessageCircle` icon from lucide-react
- **Bug fixed**: `patchStatus` rollback was spreading the `tasks` array snapshot into `setSelTask` (type error). Fixed to use a separate `prevSelTask` snapshot.

### 32. GSTIN auto-fill for client creation
- **New API route**: `app/api/gst/lookup/route.ts`
  - Auth-gated: requires logged-in org member
  - GSTIN format validation regex before any external call
  - With `GSTIN_API_KEY` env var (Surepass API): returns full data — legal name, trade name, gst_status, state, address, pincode, constitution, nature of business, registration date
  - Without key: parses GSTIN format → PAN (digits 2-11) + state from STATE_CODES map (all 36 states + UTs)
  - On API error: returns partial:true with format-parsed fallback (never returns 500 to client)
  - `GSTIN_API_KEY` comment added to `.env.local` pointing to Surepass free tier (100 calls/month)
- **NewClientForm** (`app/(app)/clients/new/NewClientForm.tsx`):
  - Green GSTIN auto-fill section added before name field in Step 1
  - Auto-triggers lookup when 15th character is typed; manual "Fetch" button also available
  - Auto-fills: name, company, industry, notes (with GST status/state/entity/reg date)
  - Info strip shows: PAN chip, state chip, gst_status (green Active / red otherwise), constitution, registration date
  - `partial: true` response shows italic hint (e.g. "Set GSTIN_API_KEY in .env.local for full lookup")
  - On submit: stores `{ gstin, pan, gst_status, gst_state, gst_reg_date }` in client's `custom_fields`
- **QuickAddClientModal** (`components/clients/QuickAddClientModal.tsx`):
  - Same GSTIN section added; auto-fills name + company; shows PAN/state/status chips
  - Saves same custom_fields on create
- **clients POST API** (`app/api/clients/route.ts`): now accepts `custom_fields` body key → passed to Supabase insert
- **custom_fields PATCH merge** (`app/api/clients/[id]/route.ts`): already supported from Session 9 DSC work — fetches existing JSONB, spreads new keys over it; prevents overwriting unrelated keys

---

### SESSION 10 FIXES

### 33. Task detail panel crashed on open — entire main area replaced by error boundary
- **Symptom**: Clicking any task replaced the main content area with "Something went wrong — Your workspace couldn't load". Sidebar stayed visible (it lives outside the `<Suspense>` boundary in `AppShell.tsx`).
- **Root cause**: The `FieldRow` helper component is defined **outside** `TaskDetailPanel`'s function body. A block of project-picker modal JSX was placed inside `FieldRow`, causing it to reference state variables (`showProjectPicker`, `setShowProjectPicker`, `loadingProjects`, `availableProjects`, `selectedProjectId`, `converting`, `confirmAddToProject`) that only exist in `TaskDetailPanel`'s closure scope. Every render threw a `ReferenceError`, caught by `app/(app)/error.tsx`.
- **Fix**: Moved the entire project-picker modal (`showProjectPicker && (<div className="fixed inset-0 ...">...</div>)`) out of `FieldRow` and into `TaskDetailPanel`'s own return fragment — positioned between the main panel `<div>` and the attachment preview overlay. Stripped `FieldRow` back to a pure layout wrapper with zero state references.
- **`FieldRow` after fix**:
  ```typescript
  function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
    return (
      <div className="flex items-center gap-3 py-2.5 last:border-0"
        style={{ borderBottom: '1px solid var(--border-light)' }}>
        <div className="w-24 text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{label}</div>
        <div className="flex items-center gap-2 flex-1 min-w-0">{children}</div>
      </div>
    )
  }
  ```
- **Rule**: Helper components defined outside a parent component's function body are **pure** — they must receive all data they need via props. Never place JSX that references parent-scope state/functions inside a helper defined at module level.
- **File**: `components/tasks/TaskDetailPanel.tsx`

### 34. "Complete all subtasks first" gate fired for CA compliance tasks with no real subtasks
- **Root cause**: Old `_compliance_subtask: true` placeholder rows (attachment-header stubs, created before commit `da486c7` stopped their creation) were still present in the DB. The approve API's subtask gate queried all rows with `parent_task_id = taskId` — these stale rows were found and counted as incomplete subtasks, blocking submission even though no real subtasks were visible.
- **Fix**: Both gates in `app/api/tasks/[id]/approve/route.ts` now filter out `_compliance_subtask: true` rows before counting:
  ```typescript
  // submit gate:
  const { data: subtasks } = await supabase
    .from('tasks').select('id, status, parent_task_id, custom_fields')
    .eq('parent_task_id', id).eq('org_id', mb.org_id)
  const realSubtasks = (subtasks ?? []).filter((s: any) => s.custom_fields?._compliance_subtask !== true)
  if (!isOwnerOrAdmin && realSubtasks.length > 0) { /* check incomplete */ }

  // approve gate:
  const { data: subtasksForApprove } = await supabase
    .from('tasks').select('id, status, custom_fields').eq('parent_task_id', id).eq('org_id', mb.org_id)
  const realSubtasksForApprove = (subtasksForApprove ?? []).filter((s: any) => s.custom_fields?._compliance_subtask !== true)
  if (!isOwnerOrAdmin && realSubtasksForApprove.length > 0) { /* check incomplete */ }
  ```
- **File**: `app/api/tasks/[id]/approve/route.ts`

### 35. Subtasks assigned to different users appeared as standalone top-level tasks in My Tasks
- **Root cause**: `tasks/page.tsx` queried all tasks where `assignee_id = user.id OR approver_id = user.id`. This included subtasks (`parent_task_id != null`). A subtask assigned to User B (whose parent is assigned to User A) would appear as a floating top-level item in User B's My Tasks — with no parent context and no way to understand why it existed.
- **Fix**: After the context-task fetch loop (which already fetched parent tasks and injected them with `_context_task: true`), filter raw subtasks out of the display list:
  ```typescript
  // Remove raw subtasks from My Tasks view.
  // Users assigned only to a subtask should see the PARENT task (as a context task)
  // rather than the isolated subtask row — they manage their work via the parent's panel.
  const displayTaskList = taskList.filter((t: any) => !t.parent_task_id)
  ```
  Changed `<MyTasksView tasks={taskList as any} ...>` → `<MyTasksView tasks={displayTaskList as any} ...>`.
- **Context task UX** (pre-existing behaviour, now properly activated):
  - Parent tasks injected with `custom_fields._context_task: true` show a read-only "Context task" banner in `TaskDetailPanel`.
  - `isContextTask` disables the Complete/Submit button on the parent — the subtask assignee cannot complete the parent task, only their own subtask.
  - `canEdit = canManage || isAssignee` — subtask assignee is NOT the assignee of the parent, so the panel is fully read-only for the parent task.
  - Subtask assignees find their subtask listed inside the parent panel and can complete it there.
- **File**: `app/(app)/tasks/page.tsx`

### 36. Admin cleanup for stale `_compliance_subtask` rows left in the database
- **Background**: Commit `da486c7` stopped future creation of attachment-header subtasks. But rows already in the DB continued to trigger the subtask gate (issue 34). A one-shot idempotent cleanup was needed.
- **New endpoint**: `app/api/admin/fix-compliance-tasks/route.ts` (POST)
  - Owner/admin only (403 for others).
  - Finds all `tasks` rows in the org with `parent_task_id IS NOT NULL` AND `custom_fields @> '{"_compliance_subtask":true}'`.
  - Deletes them in a single `.delete().in('id', ids)` call.
  - Returns `{ ok, removed, message }` — safe to call multiple times (idempotent, returns `removed: 0` if none found).
- **Related**: `app/api/ca/cleanup-subtasks/route.ts` was added in commit `da486c7` as a CA-specific cleanup; this new endpoint is the broader admin-facing version.
- **Admin UI button**: Added to `MyTasksView.tsx` Tabs bar (owner/admin only, right-aligned):
  ```typescript
  const [fixLoading, setFixLoading] = useState(false)
  const isOwnerAdmin = ['owner','admin'].includes(userRole ?? '')

  async function fixComplianceTasks() {
    setFixLoading(true)
    try {
      const res = await fetch('/api/admin/fix-compliance-tasks', { method: 'POST' })
      const d   = await res.json()
      if (res.ok) { toast.success(d.message ?? 'Compliance tasks cleaned up ✓'); refresh() }
      else         toast.error(d.error ?? 'Cleanup failed')
    } catch { toast.error('Network error during cleanup') }
    finally { setFixLoading(false) }
  }
  ```
  Button renders `{isOwnerAdmin && (<button onClick={fixComplianceTasks} ...>⚙ Fix tasks</button>)}` inside the Tabs component, `marginLeft: 'auto'` to push it right.
- **Files**: `app/api/admin/fix-compliance-tasks/route.ts` (new), `app/(app)/tasks/MyTasksView.tsx`

---

### SESSION 11 — PERFORMANCE FIXES

### 37. App layout ran 3 DB queries sequentially on every page load — 1 round-trip wasted per request
- **Root cause A**: `app/(app)/layout.tsx` called `supabase.from('org_members')` and `supabase.from('users')` with sequential `await` instead of `Promise.all`. Since both queries only need `user.id` (already available after `auth.getUser()`), there was no dependency between them — they were just blocking each other.
- **Root cause B**: The layout used direct `createClient()` queries instead of the `React.cache()`-wrapped helpers in `lib/supabase/cached.ts`. When a page component (e.g. Dashboard) also called `getOrgMembership()` in the same request, the layout's unrelated query didn't share the cache — Supabase was hit twice for identical data.
- **Fix**:
  - Switched layout to import `getSessionUser`, `getOrgMembership`, `getUserProfile` from `lib/supabase/cached.ts`
  - Ran membership + profile in `Promise.all` (both only need `user.id`):
    ```typescript
    const user = await getSessionUser()
    const [membership, profile] = await Promise.all([
      getOrgMembership(user.id),
      getUserProfile(user.id),
    ])
    ```
  - Removed the now-unused `createClient` import from the layout
- **Result**: One full DB round-trip (~80ms) saved on every page load for every user. Any page component that also calls `getOrgMembership()` / `getUserProfile()` gets the cached result — zero double-fetching within a request.
- **File**: `app/(app)/layout.tsx`

### 38. Compliance Kanban Board fired 2N+2 API requests on mount (N = number of clients)
- **Root cause**: `CAKanbanView.useEffect` fetched `/api/clients` + `/api/team`, then called `loadClientTasks(clientId)` for every client via `forEach`. Each `loadClientTasks` call fired 2 requests: `/api/ca/assignments?client_id=X` + `/api/tasks?client_id=X`. With 200 clients = **402 simultaneous API calls** on mount, saturating the browser connection pool and hammering the Supabase connection pool.
- **Fix**:
  - Replaced `loadClientTasks(clientId)` + per-client `useEffect` with a single `loadAll()` function that fires 4 requests total in one `Promise.all`:
    1. `/api/clients`
    2. `/api/team`
    3. `/api/ca/assignments` (no `client_id` → returns all org assignments; the API already supported this via its optional `client_id` filter)
    4. `/api/tasks?top_level=true&ca_compliance=true&limit=2000` (server-side JSONB filter)
  - After the 4 responses arrive, groups assignments by `client_id` into a `Map`, groups CA tasks by `client_id` into a `Map`, then runs `buildTaskList({ data: clientAssigns }, { data: clientTasks })` per client in memory
  - Initialises localStorage board state per client in the same loop — no extra calls
  - Replaced per-client `clientLoading` spinner state with a single `batchLoading` boolean; all columns appear at once when the batch completes instead of filling in one by one
  - `loadAll()` is also used for post-edit refresh (`onUpdated` previously called `clients.forEach(c => loadClientTasks(c.id))` — same 400-call storm on every task edit)
- **Request count**: 402 → **4** (99% reduction for 200-client org)
- **File**: `app/(app)/compliance/ComplianceShell.tsx`

### 39. `/api/tasks` CA compliance cap was 500 rows — silently truncated for large orgs
- **Root cause**: The tasks GET route hard-capped all requests at 500 rows (`Math.min(limit, 500)`). `CATasksView` was requesting `limit=2000` but only ever got 500 rows. The Compliance Kanban batch load now fetches all CA compliance tasks in one call — it needs a higher cap.
- **Fix**: When `ca_compliance=true` is passed, the cap is raised to 2000. All other callers remain at 500.
  ```typescript
  const hardCap = sp.get('ca_compliance') === 'true' ? 2000 : 500
  const _limit  = Math.min(isNaN(parsedLimit) ? 100 : parsedLimit, hardCap)
  ```
- **File**: `app/api/tasks/route.ts`

### 40. Reports page fetched up to 5000 task rows with no date cap; overdue count could be wrong
- **Root cause**: The main task query used `.or('status.neq.completed,completed_at.gte.from90')` with `.limit(5000)`. For orgs that have been running for years, the "all non-completed tasks" portion could be enormous. The 5000-row cap would silently truncate results, making the overdue KPI tile incorrect. All aggregations (KPIs, priority breakdown, employee stats, daily trend) ran as server-side `.filter()` loops over the entire 5000-row array.
- **Fix**:
  - Added `.gte('created_at', from90)` to the main task query — limits to tasks created in the last 90 days. Employee performance stats already label themselves "last 90 days", so this is semantically accurate.
  - Lowered limit from 5000 → 2000 (90-day window produces far fewer rows)
  - Added a separate lightweight `{ count: 'exact', head: true }` query for overdue — HEAD request, zero row transfer, covers tasks of any age:
    ```typescript
    supabase.from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId).neq('is_archived', true).is('parent_task_id', null)
      .not('status', 'in', '("completed","cancelled")')
      .not('due_date', 'is', null).lt('due_date', today)
    ```
  - Used `overdueCount` from the HEAD query for the KPI tile instead of the scanned array
- **File**: `app/(app)/reports/page.tsx`

### 41. Monitor page fetched up to 3000 tasks with no date filter — slow for large orgs
- **Root cause**: Monitor fetched all non-archived top-level tasks with a flat `.limit(3000)` and no date filter. For long-running orgs, completed tasks from years past were included in every page load, bloating the JSON payload and increasing DB query time.
- **Fix**: Applied the same filter pattern used by Reports — non-completed tasks (any age) + completed tasks from last 90 days only:
  ```typescript
  const from90 = new Date(Date.now() - 90 * 86400000).toISOString()
  supabase.from('tasks')
    .select(TASK_COLS)
    ...
    .or(`status.neq.completed,completed_at.gte.${from90}`)
    .limit(1500)  // was 3000
  ```
- **No UI or interface changes**: `MonitorView` props are identical. The completed count in the stats bar now reflects "completed in last 90 days" — appropriate for a real-time monitoring dashboard.
- **File**: `app/(app)/monitor/page.tsx`

---

## PATTERNS TO KNOW

### Server component data fetching pattern
```typescript
// Always include approver join when tasks will open TaskDetailPanel
supabase.from('tasks').select(`
  id, title, status, priority, due_date,
  assignee_id, approver_id, approval_status, approval_required,
  assignee:users!tasks_assignee_id_fkey(id, name, avatar_url),
  approver:users!tasks_approver_id_fkey(id, name),
  projects(id, name, color)
`)
// Always pass through in enrichment:
approver: (t.approver as any) ?? null,
```

### Owner/admin bypass pattern (API routes)
```typescript
const isOwnerOrAdmin = ['owner', 'admin'].includes(mb.role)
if (!isAssignee && !isOwnerOrAdmin) return 403
```

### onCreated pattern (MyTasksView)
```typescript
onCreated={(newTask) => {
  if (newTask?.id) {
    const assignedToMe = !newTask.assignee_id || newTask.assignee_id === currentUserId
    if (assignedToMe) setTasks(prev => [enriched, ...prev])
  }
  refresh() // always refresh for server-side re-fetch
}}
```

### CA compliance task visibility
```typescript
// Only show CA tasks that were triggered by the compliance module
const isVisible = (t: any) => {
  const cf = t.custom_fields
  if (cf?._ca_compliance === true) return cf?._triggered === true
  return true
}
```

### Creator join pattern (for "Assigned by" filter + column)
```typescript
// In page.tsx SELECT:
creator:users!tasks_created_by_fkey(id, name)
// In enrichment map:
creator: (t as any).creator ?? null
// In view filter:
if (filterCreator && (t as any).creator?.id !== filterCreator) return false
// In grid cell:
const creator = (task as any).creator as { id:string; name:string } | null
```

### pendingApprovalTasks → local state pattern
```typescript
// In view component (MyTasksView):
const [pendingTasks, setPendingTasks] = useState<Task[]>(pendingApprovalTasks)

// In handleApproveDecision — optimistic removal:
const pendingTaskSnapshot = pendingTasks.find(t => t.id === taskId)
setPendingTasks(prev => prev.filter(t => t.id !== taskId))
// ...on failure rollback:
if (pendingTaskSnapshot) setPendingTasks(prev => [pendingTaskSnapshot, ...prev])

// In board view — merge pendingTasks into in_review column:
const extraPendingForBoard = !showAssignedByMe
  ? pendingTasks.filter(pt => !filteredTasks.some(t => t.id === pt.id))
  : []
// ...then in BOARD_COLS.map for in_review:
[...displayTasks.filter(t => t.status==='in_review'||t.approval_status==='pending'), ...extraPendingForBoard]
```

### Inline file upload button pattern (compliance / approval_required tasks)
```tsx
{(isCompliance || task.approval_required) && task.status !== 'completed' && (
  <label
    onClick={e => e.stopPropagation()}                       // prevent TaskDetailPanel
    style={{ color: isCompliance ? '#b45309' : 'var(--text-muted)', ... }}
    onMouseEnter/onMouseLeave for opacity transitions>
    <input type="file" style={{ display:'none' }}
      onClick={e => e.stopPropagation()}                     // belt+suspenders
      onChange={async e => {
        const fd = new FormData(); fd.append('file', file)
        await fetch(`/api/tasks/${task.id}/attachments`, { method:'POST', body:fd })
        toast.success / toast.error; e.target.value = ''
      }}/>
    <svg>...upload arrow...</svg>
  </label>
)}
```

### Sidebar navigation refresh pattern
```typescript
// In Sidebar.tsx SI component:
function SI({ href, active, ... }) {
  const router = useRouter()
  return (
    <Link href={href} prefetch={true}
      onClick={() => { if (!active) router.refresh() }}>
      ...
    </Link>
  )
}
// router.refresh() forces server components to re-render without full page reload.
// Essential for force-dynamic pages to show latest DB data after navigation.
```

### Permission gate pattern (server-side, Session 4)
```typescript
// In any API route mutation handler:
import { assertCan } from '@/lib/utils/permissionGate'

// After membership check:
const denied = await assertCan(supabase, mb.org_id, mb.role, 'tasks.create')
if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })

// Permission keys follow the format: '<resource>.<action>'
// Resources: tasks, projects, clients, recurring, team, settings, time
// Actions: create, edit, edit_own, delete, assign, complete, invite, remove, change_role, log, org, tasks
// owner and admin ALWAYS bypass (no DB read needed)
```

### Task type color coding pattern (Session 4)
```typescript
// Determine task type from task fields:
const isCompliance = (task as any).custom_fields?._ca_compliance === true
const isRecurring  = task.is_recurring === true && !isCompliance
const isProject    = !!task.project_id && !isRecurring && !isCompliance
// else: one-time

// Type accent colors:
const typeAccent = isCompliance ? '#d97706'
  : isRecurring ? '#0d9488'
  : isProject   ? '#7c3aed'
  : '#0891b2'  // one-time = cyan

// Background tint (list rows):
const typeBg = isCompliance ? 'rgba(234,179,8,0.09)'
  : isRecurring ? 'rgba(13,148,136,0.07)'
  : isProject   ? 'rgba(124,58,237,0.07)'
  : 'rgba(8,145,178,0.05)'

// Apply to row/card:
style={{ borderLeft: `3px solid ${typeAccent}`, background: typeBg }}

// For done/completed tasks in Calendar: use opacity instead of color override:
style={{ opacity: isDone ? 0.72 : 1, borderLeft: `3px solid ${borderClr}` }}
```

### Created/Updated date display pattern (Session 4)
```typescript
// MUST use toLocaleString (NOT toLocaleDateString — it silently ignores hour/minute/hour12)
new Date(task.created_at).toLocaleString('en-IN', {
  day: '2-digit', month: 'short', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hour12: true
})
// updated_at is cast as any since it was added after the base Task type was stabilised:
(task as any).updated_at && new Date((task as any).updated_at).toLocaleString(...)

// Page-level SELECT must include both:
.select('..., created_at, updated_at')
// Enrichment map must pass through (not hardcode ''):
created_at: t.created_at ?? '',
updated_at: t.updated_at ?? null,
```

### Force-dynamic + staleTimes pattern (Session 4)
```typescript
// next.config.ts — kills router cache for all dynamic routes:
experimental: {
  staleTimes: { dynamic: 0 },
}

// Every server page that reads DB data should have:
export const dynamic = 'force-dynamic'
// This prevents static generation and ensures fresh server-component render on every request.
// Combined with staleTimes:0, every navigation fetches latest data from DB.
```

### Owner/admin gate bypass pattern — EVERY gate must include this (Session 7)
```typescript
// ❌ WRONG — blocks owner/admin
if (subtasks.length > 0 && incomplete.length > 0) return 422

// ✅ CORRECT — owner/admin can always force through
if (!isOwnerOrAdmin && subtasks.length > 0 && incomplete.length > 0) return 422

// Rule: owner and admin bypass ALL gates, not just permission gates.
// This applies to: subtask checks, attachment checks, blocker checks, approval checks.
```

### CA task update-master pattern (Session 7 + Session 8)
```typescript
// In CATasksView.onUpdated: detect assignee change
if (canManage && 'assignee_id' in fields && fields.assignee_id &&
    fields.assignee_id !== selTask.assignee_id && selTask.client_id) {
  const member = members.find(m => m.id === fields.assignee_id)
  if (member) {
    const promptData = { assignmentClientId: selTask.client_id, masterTaskTitle: selTask.title,
      newAssigneeId: fields.assignee_id, newAssigneeName: member.name }
    if (selTask.assignee_id === null) {
      // Was unassigned → auto-update master immediately, no confirmation popup
      doMasterUpdate(promptData)
    } else {
      // Was already assigned → show popup to confirm overwrite
      setMasterUpdatePrompt(promptData)
    }
  }
}

// doMasterUpdate(data) — core logic, takes explicit params (no state dependency):
// 1. GET /api/ca/assignments?client_id={clientId}   ← includes master_task.name join
// 2. find(a => a.master_task?.name === masterTaskTitle)
// 3. PATCH /api/ca/assignments/{id} { assignee_id }
// Future caComplianceSpawn uses ca_client_assignments.assignee_id — so this
// ensures all future spawned tasks for that client+master go to the new person.

// updateMasterAssignment() — reads masterUpdatePrompt state, clears it, calls doMasterUpdate
```

### Upcoming CA triggers computation pattern (Session 8)
```typescript
// In page.tsx — owner/admin only:
type UpcomingCATrigger = {
  id: string; title: string; triggerDate: string; dueDate: string
  clientId: string | null; clientName: string | null; clientColor: string | null
  assigneeId: string | null; priority: string
}
const upcomingCATriggers: UpcomingCATrigger[] = []
if (isOwnerAdmin && caAssignments) {
  const todayS = new Date().toISOString().slice(0, 10)
  const limitD = new Date(); limitD.setDate(limitD.getDate() + 3)
  const limitS = limitD.toISOString().slice(0, 10)
  const existingSet = new Set((caInstances ?? []).map(i => `${i.assignment_id}__${i.due_date}`))
  for (const asgn of caAssignments) {
    const mt = asgn.master_task
    if (!mt?.dates) continue
    for (const [, dueDateStr] of Object.entries(mt.dates)) {
      const dueD = new Date(dueDateStr + 'T00:00:00')
      const triggerD = new Date(dueD)
      triggerD.setDate(dueD.getDate() - (mt.days_before_due ?? 7))
      const triggerS = triggerD.toISOString().slice(0, 10)
      if (triggerS > todayS && triggerS <= limitS && !existingSet.has(`${asgn.id}__${dueDateStr}`)) {
        upcomingCATriggers.push({ id: `upcoming-${asgn.id}-${dueDateStr}`, title: mt.name, ... })
      }
    }
  }
}
// Supabase queries:
supabase.from('ca_client_assignments')
  .select('id, client_id, assignee_id, master_task:ca_master_tasks(id, name, priority, dates, days_before_due)')
  .eq('org_id', mb.org_id)
supabase.from('ca_task_instances').select('assignment_id, due_date').eq('org_id', mb.org_id)
```

### Monitor / read-only viewer pattern (Session 8)
```typescript
// page.tsx — no role scoping on task query; always full org:
supabase.from('tasks').select(TASK_COLS).eq('org_id', mb.org_id)
  .neq('is_archived', true).is('parent_task_id', null)
  .order('due_date', { ascending: true, nullsFirst: false }).limit(3000)

// MonitorView — pass userRole="viewer" to TaskDetailPanel:
<TaskDetailPanel task={selectedTask} userRole="viewer" ... />

// Ghost amber CA trigger cards — use dashed borders with rgba colors only (no hex):
style={{
  background: 'rgba(234,179,8,0.05)',
  border: '1px dashed rgba(217,119,6,0.4)',
  borderLeft: '3px dashed #d97706',
  opacity: 0.72,
}}
```

### Inline form field glorification pattern (Session 7)
```tsx
// Title row: teal accent when empty, fades as user types
<div style={{
  background: title ? 'transparent' : 'rgba(13,148,136,0.045)',
  borderLeft: title ? '3px solid transparent' : '3px solid var(--brand)',
  transition: 'background 0.25s ease, border-left-color 0.25s ease',
}}>
  <YourIcon style={{ opacity: title ? 0.4 : 1, transition: 'opacity 0.25s ease' }}/>
  <input className="my-title-input" style={{ fontSize: 15, fontWeight: 600 }}/>
</div>
<div style={{ height: title ? 1 : 2,
  background: title ? 'var(--border-light)' : 'rgba(13,148,136,0.2)',
  transition: 'height 0.25s, background 0.25s' }}/>

// Placeholder styling — must use <style> tag (no inline ::placeholder support):
<style>{`.my-title-input::placeholder {
  color: rgba(13,148,136,0.55); font-weight: 500; font-style: italic;
}`}</style>
```

### custom_fields JSONB merge pattern for clients (Session 9)
```typescript
// In PATCH /api/clients/[id]:
if ('custom_fields' in body && body.custom_fields && typeof body.custom_fields === 'object') {
  const { data: existing } = await supabase
    .from('clients').select('custom_fields').eq('id', id).eq('org_id', mb.org_id).maybeSingle()
  updates.custom_fields = { ...(existing?.custom_fields ?? {}), ...(body.custom_fields as object) }
}
// NEVER do: updates.custom_fields = body.custom_fields
// That would wipe DSC keys when saving GST keys, or vice versa.
// Always fetch-then-merge so unrelated keys are preserved.

// In POST /api/clients:
const cf = (body.custom_fields && typeof body.custom_fields === 'object') ? body.custom_fields : null
// then in insert: custom_fields: cf
```

### GSTIN lookup pattern (Session 9)
```typescript
// Client-side (in any form):
async function lookupGSTIN(raw: string) {
  const g = raw.trim().toUpperCase()
  if (g.length !== 15) return        // validate length before fetching
  const res  = await fetch(`/api/gst/lookup?gstin=${encodeURIComponent(g)}`)
  const json = await res.json()
  // json.data: { gstin, pan, name, gst_status, state, constitution, registration_date, ... }
  // json.partial: true when GSTIN_API_KEY not set or API error (still has pan + state)
  // json.message: hint string when partial
}

// Auto-trigger on input change (triggers when exactly 15 chars):
onChange={e => {
  const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15)
  setGstin(v)
  if (v.length === 15) lookupGSTIN(v)   // auto-fetch, no button click needed
}}

// custom_fields to save on submit:
const gstCustomFields = gstin.length === 15 ? {
  gstin:        gstin.toUpperCase(),
  pan:          gstInfo?.pan         ?? null,
  gst_status:   gstInfo?.gst_status  ?? null,
  gst_state:    gstInfo?.state       ?? null,
  gst_reg_date: gstInfo?.registration_date ?? null,
} : undefined
```

### DSC Tracker urgency pattern (Session 9)
```typescript
// getDSCStatus(daysLeft: number | null): icon 'danger'|'warn'|'ok'|'none'
// danger: daysLeft === null? No — null → icon:'none'. daysLeft <= 7 (includes negative) → danger
// warn: 8-30 days. ok: >30 days.

// client.custom_fields._dsc_expiry format: ISO date string "2025-06-30"
// daysLeft computation:
const daysLeft = expiry
  ? Math.round((new Date(expiry + 'T00:00:00').getTime() - Date.now()) / 86400000)
  : null

// Save via PATCH (merge pattern):
await fetch(`/api/clients/${clientId}`, {
  method: 'PATCH', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ custom_fields: { _dsc_expiry: dateStr, _dsc_holder: holderName } })
})
// The PATCH handler merges this into existing JSONB — other keys (gstin, etc.) are preserved.
```

### CATasksView urgency chip pattern (Session 9)
```typescript
function urgencyChip(due_date: string | null, status: string) {
  if (!due_date || status === 'completed' || status === 'cancelled') return null
  const now = new Date(); now.setHours(0, 0, 0, 0)
  const due = new Date(due_date); due.setHours(0, 0, 0, 0)
  const diff = Math.round((due.getTime() - now.getTime()) / 86400000)
  if (diff < 0)  return { label: `Overdue ${Math.abs(diff)}d`, bg: '#fef2f2', color: '#dc2626' }
  if (diff === 0) return { label: 'Due today',                  bg: '#f0fdf4', color: '#0d9488' }
  if (diff <= 7)  return { label: `${diff}d left`,              bg: '#fefce8', color: '#b45309' }
  return null   // >7 days — no chip needed
}
// Rendered inline in the title cell, below client name dot+label
```

### WhatsApp bulk reminder pattern (Session 9)
```typescript
// In bulk action bar onClick:
const selectedTasks = tasks.filter(t => checked.has(t.id))
const lines = selectedTasks.map(t => {
  const client = t.client?.name ?? 'Client'
  const due = t.due_date
    ? new Date(t.due_date).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })
    : 'TBD'
  return `• ${t.title} (${client}) — due ${due}`
})
const msg = `Dear Client,\n\nThis is a reminder for the following pending compliance tasks:\n\n${lines.join('\n')}\n\nKindly arrange the required documents at the earliest.\n\nRegards`
window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
// wa.me/?text= opens WhatsApp web/app with pre-filled message; user picks the contact.
// No phone number required in the URL — CA manually selects client contact in WhatsApp.
```

---

---

### SESSION 12 — WALKTHROUGH, BUG FIXES & DEPENDENCY UPDATE

### 42. First-time user onboarding walkthrough
- **New file**: `components/walkthrough/WalkthroughOverlay.tsx`
- **Purpose**: Interactive product tour shown once to brand-new users so they understand all major features.
- **Trigger condition**: Account `created_at` < 7 days old AND `localStorage.planora_wt_v1_${userId}` not set. Existing users (accounts older than 7 days) never see it — even if they clear local storage. The 7-day window is generous so users who sign up but don't explore right away still see it on return.
- **Storage key change**: `planora_wt_v1_${userId}` (per-user) — NOT `planora_wt_v1_${orgId}`. Prevents re-showing for the same user across org changes or browser sessions.
- **Data flow**: `layout.tsx` passes `user.created_at` → `AppShell.tsx` Props `user.created_at: string` → `<WalkthroughOverlay userId={user.id} userCreatedAt={user.created_at}/>`.
- **Steps** (10 feature steps + Welcome + Done = 12 cards):
  1. Welcome (center, no target) — "Let's create your first task"
  2. Quick Tasks — `/inbox` — "Create your first task" action CTA
  3. Repeat Tasks — `/recurring`
  4. My Tasks — `/tasks`
  5. Projects — `/projects`
  6. Clients — `/clients`
  7. Approvals — `/approvals`
  8. Calendar — `/calendar`
  9. CA Compliance — `/compliance`
  10. Done (center, no target) — directs to add a client
- **Navigation**: `next()` calls `router.push(nextStep.path)` on forward navigation only. Back button does NOT navigate (avoids disorienting backward page jumps). The user sees the actual feature page while reading about it.
- **"Create your first task" CTA**: On the Quick Tasks step, a full-width gradient button inside the card. Clicking it calls `dismiss()` (stores the key, hides the overlay) and navigates to `/inbox` so the user lands directly in the task creation flow.
- **Architecture**:
  - `createPortal(…, document.body)` — renders above all content at z-index 99990/99999
  - `mounted` state guard — prevents SSR access to `localStorage`/`window`/`document.body`
  - 4-quadrant overlay (`top/bottom/left/right` fixed divs) around spotlight `getBoundingClientRect`
  - `SPOTLIGHT_PAD=10px` border + pulsing teal `box-shadow` ring (`wt-pulse-ring` keyframe)
  - Smart tooltip: prefers right → left → below → above based on `vpW`/`vpH` vs spotlight bounds
  - `animKey` bumped on step change re-triggers CSS keyframe animation
  - 80ms `setTimeout` on `measure()` lets navigation settle before re-measuring spotlight target
- **Files**: `components/walkthrough/WalkthroughOverlay.tsx` (new), `app/(app)/AppShell.tsx`, `app/(app)/layout.tsx`

### 43. Project view — submit for approval shows "Pending" instantly without refresh
- **Root cause**: In `ProjectView.tsx` `toggleDone()`, the approval submit path (`task.approval_required === true`) called the approve API and then only called `router.refresh()` to reflect the new state. The task's circle stayed unchanged until the server round-trip completed (~300–600ms).
- **Fix**: After `res.ok`, read the JSON response body and update local state immediately:
  ```typescript
  const data = await res.json()
  if (data.auto_completed) {
    // No approver assigned — API auto-completed the task
    const completedAt = new Date().toISOString()
    setTasks(prev => prev.map(t => t.id === task.id
      ? { ...t, status: 'completed', approval_status: 'approved', completed_at: completedAt } as Task : t))
    setSelectedTask(prev => prev?.id === task.id
      ? { ...prev, status: 'completed', approval_status: 'approved', completed_at: completedAt } as Task : prev)
    toast.success('Task completed ✓')
  } else {
    // Pending approval — clock icon and purple tint appear immediately
    setTasks(prev => prev.map(t => t.id === task.id
      ? { ...t, status: 'in_review', approval_status: 'pending' } as Task : t))
    setSelectedTask(prev => prev?.id === task.id
      ? { ...prev, status: 'in_review', approval_status: 'pending' } as Task : prev)
    toast.success('Submitted for approval ✓')
  }
  ```
- **Two paths handled**: (a) task has an approver → `in_review + pending`; (b) no approver (auto-complete) → `completed + approved`. The API already returned `auto_completed: true` for path (b); client now uses it.
- **`router.refresh()` still runs** in the background (via `startT`) to sync server state. It no longer gates the visual change.
- **File**: `app/(app)/projects/[projectId]/ProjectView.tsx`

### 44. inngest security advisory — updated to 3.54.0
- **Trigger**: Vercel build warning: "Vulnerable version of inngest detected (3.52.7). Please update to version 3.54.0 or later."
- **Fix**: `package.json` `inngest` range changed from `^3.25.0` → `^3.54.0`; `npm install` resolved to `inngest@3.54.0`.
- **File**: `package.json`

---

## HOW TO START A NEW CHAT

Paste this at the top of the new chat:

> "I'm continuing work on Planora Task — a Next.js 15 SaaS task manager with Supabase, Inngest, and Resend. Here is the full codebase structure and context: [paste this document]. Please read it carefully before making any changes."

Then describe the specific change you want to make.
