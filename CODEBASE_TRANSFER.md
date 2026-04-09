# Planora Task — Codebase Transfer Document
> Use this at the start of a new chat to give the AI full context. Last updated: 2026-04-09 (Session 6)

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
| `ca_master_tasks` | `id, org_id, name, attachment_count, attachment_headers, is_active` |
| `ca_assignments` | `id, org_id, client_id, master_task_id, assignee_id, due_date` |
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
| View all tasks | ✅ | ✅ | ✅ | Own only | ❌ |
| Create task | ✅ | ✅ | ✅ | ✅ | ❌ |
| Edit any task | ✅ | ✅ | ✅ | Own assigned only | ❌ |
| Delete / archive task | ✅ | ✅ | ✅ | ❌ | ❌ |
| Change assignee | ✅ | ✅ | ✅ | ❌ | ❌ |
| Submit for approval | ✅ bypass | ✅ bypass | If assignee | If assignee | ❌ |
| Approve / Reject | ✅ bypass | ✅ bypass | If designated approver | If designated approver | ❌ |
| Set approver | ✅ | ✅ | ✅ | ❌ | ❌ |
| Create recurring task | ✅ | ✅ | ✅ | ✅ | ❌ |
| Manage CA compliance | ✅ | ✅ | ❌ | ❌ | ❌ |

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
app/(app)/calendar/CalendarView.tsx   — Monthly calendar component
  — taskTypeBorder/Bg/Dot functions define type colors (compliance/recurring/project/one-time)
  — isDone no longer overrides type colors; opacity: 0.72/0.68 used for done state instead (Session 4)
  — Legend: recurring icon color fixed to #0d9488 (was #ea580c) (Session 4)

app/(app)/recurring/page.tsx          — Recurring tasks list
  — SELECT includes: creator:users!tasks_created_by_fkey(id, name)
  — SELECT includes: created_at, updated_at  ← added Session 4
  — Enrichment: creator: (t as any).creator ?? null
  — Enrichment: created_at: t.created_at ?? '', updated_at: t.updated_at ?? null  ← Session 4
app/(app)/recurring/RecurringView.tsx — Recurring task editor
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

app/(app)/inbox/page.tsx              — One-time tasks inbox (all tasks for org)
  — SELECT includes: creator:users!tasks_created_by_fkey(id, name)
  — SELECT includes: created_at, updated_at  ← added Session 4
  — Enrichment: creator: (t as any).creator ?? null
  — Enrichment: created_at: (t as any).created_at ?? '', updated_at: (t as any).updated_at ?? null  ← Session 4
app/(app)/inbox/InboxView.tsx         — Client: List / Board view for one-time tasks
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
app/(app)/import/page.tsx             — Data import wizard
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
app/api/tasks/[id]/approve/route.ts   — POST: submit / approve / reject
  — submit: assignee OR isOwnerOrAdmin
  — approve/reject: designated approver OR isOwnerOrAdmin
  — CA compliance: checks attachment_count vs ca_master_tasks before submit
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
components/tasks/InlineRecurringTask.tsx — Inline create recurring task
components/tasks/CustomFieldsPanel.tsx — Custom fields editor in TaskDetailPanel
components/tasks/MentionTextarea.tsx  — @mention textarea for comments
components/tasks/CompletionAttachModal.tsx — Attach files when completing task

components/layout/Sidebar.tsx         — Left nav sidebar
  — SI component calls router.refresh() on every link click (when not already active)
    to force server-component re-fetch and show latest data

components/layout/Header.tsx          — Top header with user menu
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

---

## HOW TO START A NEW CHAT

Paste this at the top of the new chat:

> "I'm continuing work on Planora Task — a Next.js 15 SaaS task manager with Supabase, Inngest, and Resend. Here is the full codebase structure and context: [paste this document]. Please read it carefully before making any changes."

Then describe the specific change you want to make.
