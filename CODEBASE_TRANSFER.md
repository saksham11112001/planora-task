# Planora Task — Codebase Transfer Document
> Use this at the start of a new chat to give the AI full context. Last updated: 2026-04-14 (Session 8)

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
| `clients` | `id, org_id, name, color, status (active/inactive)` |
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
app/(app)/AppShell.tsx                — Main shell: sidebar + header + routing
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
app/(app)/compliance/CATasksView.tsx  — CA Tasks tab (step 4 in ComplianceShell)
  — patchStatus: now reads d.error from response body, surfaces real API error  ← Session 7
  — filterAssignee state: '' | 'unassigned' | memberId  ← Session 7
    Toolbar: "All assignees / ⊘ Unassigned / <member>" select — included in activeFilters
  — doMasterUpdate(data) + updateMasterAssignment() refactored  ← Session 8
    doMasterUpdate accepts params directly (no state dependency)
    If task was UNASSIGNED (assignee_id===null): auto-calls doMasterUpdate immediately (no popup)
    If task was ALREADY ASSIGNED: shows masterUpdatePrompt popup to confirm overwrite
  — masterUpdatePrompt state + updateMasterAssignment(): when assignee_id changes in
    onUpdated, show popup asking to also PATCH ca_client_assignments.assignee_id  ← Session 7
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
app/api/tasks/[id]/comments/route.ts  — Comments CRUD
app/api/tasks/[id]/attachments/route.ts — Attachments upload/delete

app/api/projects/route.ts             — Projects list/create
  — POST: assertCan(projects.create)  ← Session 4
app/api/projects/[id]/route.ts        — Project CRUD
  — PATCH: assertCan(projects.edit)  ← Session 4
  — DELETE: assertCan(projects.delete)  ← Session 4
app/api/clients/route.ts              — Clients list/create
  — POST: assertCan(clients.create)  ← Session 4
app/api/clients/[id]/route.ts         — Client CRUD
  — PATCH: assertCan(clients.edit)  ← Session 4
  — DELETE: assertCan(clients.delete)  ← Session 4
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
components/search/SearchModal.tsx     — Global search (Cmd+K)

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

---

## HOW TO START A NEW CHAT

Paste this at the top of the new chat:

> "I'm continuing work on Planora Task — a Next.js 15 SaaS task manager with Supabase, Inngest, and Resend. Here is the full codebase structure and context: [paste this document]. Please read it carefully before making any changes."

Then describe the specific change you want to make.
