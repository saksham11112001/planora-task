# Planora Task — Codebase Transfer Document
> Use this at the start of a new chat to give the AI full context. Last updated: 2026-04-08 (Session 3)

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
middleware.ts           — Supabase JWT refresh + route protection
tailwind.config.ts      — Tailwind CSS v4 config
vercel.json             — Vercel deployment config
types/index.ts          — TypeScript interfaces: User, Org, Task, Project, Client
store/appStore.ts       — Zustand: session, toast notifications, filter state
  — FilterState fields: clientId, priority, status, search, assigneeId,
    dueDateFrom, dueDateTo, creatorId  ← "Assigned by" filter (added Session 3)
  — setFilter(key, value) / resetFilters() — used by UniversalFilterBar
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
  — SELECT includes: creator:users!tasks_created_by_fkey(id, name)
  — Enrichment: creator: (t.creator as any) ?? null
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
  — List sections sorted by due_date ascending; "Assigned by me" toggle for managers
  — onCreated: only adds to local state if assignedToMe; always calls router.refresh()

app/(app)/projects/page.tsx           — Projects list
app/(app)/projects/ProjectsView.tsx   — Projects grid/list
app/(app)/projects/[projectId]/page.tsx  — Fetches project + tasks (with approver join) + members
app/(app)/projects/[projectId]/ProjectView.tsx  — Project board/list with inline task rows
  — "+ Assign to me" only shows when task.assignee_id is null (not just members.find() miss)

app/(app)/clients/[clientId]/page.tsx — Client detail with project stats
app/(app)/calendar/page.tsx           — Fetches tasks with due dates + approver join
app/(app)/calendar/CalendarView.tsx   — Monthly calendar component

app/(app)/recurring/page.tsx          — Recurring tasks list
  — SELECT includes: creator:users!tasks_created_by_fkey(id, name)
  — Enrichment: creator: (t as any).creator ?? null
app/(app)/recurring/RecurringView.tsx — Recurring task editor
  — Grid: '1fr 10rem 6rem 6rem 6rem 7rem 5rem 4.5rem' (8 columns including Assigned by)
  — "Assigned by" column between Approver and Client; uses User icon from lucide-react
  — Subtask add: newSubAssignees / newSubDueDates per-task state maps
    addSubtask(taskId, title, assigneeId, dueDate) sends both fields to API
    Progressive disclosure: second row (select + date + Add) shown only when title typed
  — Inline upload button on compliance / approval_required tasks
  — Filters: creatorId (Assigned by); showAssignor on both UniversalFilterBars
  — onCreated: adds to local state + calls router.refresh() via startTransition

app/(app)/approvals/page.tsx          — Approvals queue (pending + history, with approver join)
app/(app)/approvals/ApprovalsView.tsx — Approval queue UI

app/(app)/inbox/page.tsx              — One-time tasks inbox (all tasks for org)
  — SELECT includes: creator:users!tasks_created_by_fkey(id, name)
  — Enrichment: creator: (t as any).creator ?? null
app/(app)/inbox/InboxView.tsx         — Client: List / Board view for one-time tasks
  — Grid: '36px 22px 1fr 100px 110px 110px 100px 80px 32px 28px' (10 columns)
    (check | circle | Task | Assignee | Client | Due date | Assigned by | Priority | expand | del)
  — "Assigned by" column after Due date: creator avatar initial + first name
  — Inline upload button (amber/grey arrow SVG) on compliance / approval_required tasks
  — Compliance subtask rows also have inline upload button
  — Filters: creatorId (Assigned by); showAssignor on both UniversalFilterBars
  — Board + List both filter by creatorId

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
app/api/tasks/[id]/route.ts           — GET / PATCH / DELETE single task
  — PATCH: managers can update all fields incl. assignee_id, approver_id
app/api/tasks/[id]/approve/route.ts   — POST: submit / approve / reject
  — submit: assignee OR isOwnerOrAdmin
  — approve/reject: designated approver OR isOwnerOrAdmin
  — CA compliance: checks attachment_count vs ca_master_tasks before submit
app/api/tasks/[id]/comments/route.ts  — Comments CRUD
app/api/tasks/[id]/attachments/route.ts — Attachments upload/delete

app/api/projects/route.ts             — Projects list/create
app/api/projects/[id]/route.ts        — Project CRUD
app/api/clients/route.ts              — Clients list/create
app/api/clients/[id]/route.ts         — Client CRUD
app/api/recurring/route.ts            — Recurring tasks CRUD
app/api/time-logs/route.ts            — Time logs CRUD
app/api/team/route.ts                 — Team members CRUD
app/api/search/route.ts               — Global search
app/api/reports/export/route.ts       — Excel export
app/api/import/route.ts               — File import
app/api/ca/master/route.ts            — CA master tasks CRUD
app/api/ca/trigger/route.ts           — Trigger compliance task spawn
app/api/inngest/route.ts              — Inngest event handler endpoint
app/api/onboarding/route.ts           — Org creation
app/api/settings/*/route.ts           — Settings endpoints
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
  — showAssignor?: boolean  — shows "Assigned by" pill using store.creatorId
  — creatorId filter state stored in Zustand (see store/appStore.ts)

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
lib/hooks/useOrgSettings.ts           — Org settings React hook
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

---

## HOW TO START A NEW CHAT

Paste this at the top of the new chat:

> "I'm continuing work on Planora Task — a Next.js 15 SaaS task manager with Supabase, Inngest, and Resend. Here is the full codebase structure and context: [paste this document]. Please read it carefully before making any changes."

Then describe the specific change you want to make.
