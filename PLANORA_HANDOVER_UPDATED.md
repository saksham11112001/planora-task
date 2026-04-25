# PLANORA v2 — Updated Handover Document
**GitHub:** saksham11112001/planora-task  
**Live URL:** sng-adwisers.com  
**Stack:** Next.js 15.5 · Supabase (xjaybcthnneppfdgmtaq) · Tailwind v4 · Inngest · Resend · Vercel  
**Last Updated:** 2026-04-25 (Session 12)

---

## 1. CRITICAL RULES — NEVER BREAK

1. **NEVER** use `approver:users!tasks_approver_id_fkey` in Supabase joins — FK doesn't exist  
   ✅ Use `approver:users!tasks_approver_id_fkey(id, name)` — this works (tasks table has approver_id FK)
2. **ALWAYS** `.maybeSingle()` not `.single()` unless you're 100% sure a row exists
3. **NEVER** hardcode `is_recurring: false` in tasks API — read from request body
4. `TaskDetailPanel` is a **centered modal** (z-50 backdrop), NOT a sidebar drawer
5. Landing/login/privacy/terms pages: **always light mode**, never inherit dark theme
6. `'use client'` must be **FIRST LINE** of every client component
7. Approval decision: map `'approve' → 'approved'`, `'reject' → 'rejected'` before Inngest call
8. Excel template uses **Python/openpyxl** (`scripts/generate_template.py`) — SheetJS CE has no data validation
9. Board view is **DEFAULT** tab in MyTasksView (not List)
10. InboxView and RecurringView: use `&&` conditionals, **NEVER ternaries** `? () : null` — SWC crashes
11. `canManage` must be defined before use in any component
12. Do not auto-expand subtasks on mount — load only when user clicks
13. **NEW:** When dragging to "Pending approval" kanban col, use `POST /api/tasks/:id/approve` with `{ decision: 'submit' }` — NOT a plain PATCH. Plain PATCH won't set `approval_status: 'pending'` and approver won't be notified.
14. **NEW:** Import template sample rows now have `[SAMPLE]` prefix — `isSampleRow()` catches them
15. **NEW:** Project `member_ids uuid[]` column controls visibility. NULL = org-wide. Only owner sees all.
16. **NEW:** All hardcoded light bg colors (`#f0fdfa`, `#f5f3ff` etc.) break dark mode — always use `rgba(color, 0.12)` or CSS vars instead.

---

## 2. SUPABASE TABLES

### ✅ KEEP (16 core tables)
```
billing_events, clients, email_daily_log, organisations, org_members,
org_settings, org_feature_settings, product_subscriptions, projects,
tasks, task_activity, task_attachments, task_comments, users,
notification_preferences, user_profiles
```

### ❌ DELETE (legacy merged tables)
```
coupons, flow_appraisal_overrides, flow_appraisal_summary, flow_instances,
flow_stage_comments, flow_stage_instances, flow_stages_template, flow_templates,
workspaces
```

### Schema additions made in this session
```sql
-- Projects member visibility (run this if not done)
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS member_ids uuid[] DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_projects_member_ids ON public.projects USING GIN (member_ids);
```

---

## 3. COMPLETE FILE STRUCTURE

### Root Config
```
next.config.ts              – ESLint/TS errors ignored, compress on
tailwind.config.ts          – Tailwind v4
middleware.ts               – Auth: redirect /login if no session; cookies via response.cookies.set() (NOT headers.append)
types/index.ts              – Task, Project, Client types + STATUS_CONFIG, PRIORITY_CONFIG
store/appStore.ts           – Zustand: toast queue, global session state
app/globals.css             – CSS vars, dark mode overrides (55KB+). ALL color fixes go here.
```

### Auth Flow
```
app/login/page.tsx                     – Google OAuth + magic link
app/auth/callback/route.ts             – Handles PKCE (magic links) + redirects to /auth/confirm for Google
app/auth/confirm/page.tsx (NEW)        – Client-side: reads #access_token from hash, calls setSession(), then /api/auth/provision
app/api/auth/provision/route.ts (NEW)  – Upserts public.users row after implicit OAuth flow
app/onboarding/page.tsx                – Create org → org_members owner row → /dashboard
```

**Google OAuth flow (implicit, post-fix):**
```
Login → Google → /auth/callback (no ?code) → /auth/confirm
  → supabase.auth.setSession({access_token, refresh_token})  ← key fix
  → POST /api/auth/provision  → /dashboard or /onboarding
```

**Magic link flow (PKCE, unchanged):**
```
Login → email → /auth/callback?code=XXX → exchangeCodeForSession → /dashboard
```

### App Shell
```
app/(app)/layout.tsx     – Loads user + org + membership. Falls back: no org → /onboarding
app/(app)/AppShell.tsx   – Sidebar + header + Suspense(PageFallback). Trial/expired banner.
app/(app)/loading.tsx    – Global app loader (branded spinner)
```

### Pages & Views

**Dashboard**
```
app/(app)/dashboard/page.tsx           – revalidate:30, parallel fetches via Promise.allSettled
app/(app)/dashboard/DashboardClient.tsx – Hero (glassmorphism MiniAppCards), quick actions, my tasks, projects, clients
```

**Tasks (My Tasks)**
```
app/(app)/tasks/page.tsx           – Parallel fetch: my tasks + approval tasks + members + clients
app/(app)/tasks/MyTasksView.tsx    – List + Board (default). Board cols: Overdue/Todo/Pending/Done.
                                     Done cols: LIST_DONE_PAGE=5 collapsed by default, click to expand.
                                     Drag to "Pending approval" → uses /approve endpoint, NOT PATCH.
app/(app)/tasks/loading.tsx        – KanbanSkeleton (matches board layout)
```

**Inbox (One-time tasks)**
```
app/(app)/inbox/page.tsx       – Parallel fetch. Role-filtered.
app/(app)/inbox/InboxView.tsx  – List + Board. Same approval-drag fix as MyTasksView.
app/(app)/inbox/loading.tsx    – TaskListSkeleton
```

**Recurring Tasks**
```
app/(app)/recurring/page.tsx        – 4 parallel queries (was sequential, fixed). Fetches approver join.
app/(app)/recurring/RecurringView.tsx – List + Board. Inline create has: title/freq/date/assignee/APPROVER/client.
                                        Grid: '1fr 7rem 5rem 6rem 6rem 5rem 4.5rem' (7 cols with approver)
app/(app)/recurring/loading.tsx     – TaskListSkeleton with column headers
```

**Projects**
```
app/(app)/projects/page.tsx               – Filters by member_ids (strict: even admins gated, only owner sees all)
app/(app)/projects/ProjectsView.tsx       – Card grid with client filter
app/(app)/projects/new/NewProjectForm.tsx – Member multi-select (pill buttons). member_ids sent to API.
app/(app)/projects/[projectId]/page.tsx   – Parallel fetch. Passes projectOwnerId to ProjectView.
app/(app)/projects/[projectId]/ProjectView.tsx – List + Board. InlineTaskRow gets projectOwnerId → auto-fills approver.
app/(app)/projects/[projectId]/edit/ProjectEditForm.tsx – Editable member_ids field.
```

**Clients**
```
app/(app)/clients/page.tsx              – Client list with search
app/(app)/clients/[clientId]/page.tsx   – Client detail: tasks + projects
app/(app)/clients/new/NewClientForm.tsx
app/(app)/clients/[clientId]/edit/
```

**Calendar**
```
app/(app)/calendar/page.tsx       – Parallel fetch: tasks + clients + members. Enriches tasks with client.
app/(app)/calendar/CalendarView.tsx – Member filter (pill buttons, managers only via canViewAll).
                                      Client filter. 4 task-type filter pills. Month stats strip.
                                      PRIORITY_BG uses rgba() colors (dark mode safe).
```

**Approvals**
```
app/(app)/approvals/page.tsx        – Managers only. Parallel fetch: pending + history + clients + members.
app/(app)/approvals/ApprovalsView.tsx – Pending table + 7-day history. Approve/Reject buttons.
                                        All bg colors now rgba() (dark mode fixed).
```

**Team**
```
app/(app)/team/page.tsx       – Members with stats
app/(app)/team/TeamView.tsx   – Role editing (inline dropdown). Bulk invite (multiple emails at once).
                                Remove member: 2-step inline confirm (no modal). Uses PATCH is_active:false.
```

**Settings**
```
app/(app)/settings/page.tsx                    – Lists sections. SettingsClient has live search.
app/(app)/settings/SettingsClient.tsx          – Search bar. Icon bg: ${color}20 (rgba, dark safe). Hover: var(--surface-hover).
app/(app)/settings/features/page.tsx           – Passes plan tier to FeaturesView.
app/(app)/settings/features/FeaturesView.tsx   – PLAN GATING: pro features locked on free/starter.
                                                  Shows 🔒 badge. Toggle blocked with toast.
app/(app)/settings/members/MembersView.tsx     – Old member management (Settings path)
app/(app)/settings/billing/BillingView.tsx     – Plan display + upgrade
app/(app)/settings/trash/TrashView.tsx         – 30-day soft delete recovery
app/(app)/settings/appearance/AppearanceView.tsx
app/(app)/settings/notifications/NotifView.tsx
app/(app)/settings/permissions/PermissionsView.tsx
app/(app)/settings/categories/CategoriesForm.tsx
app/(app)/settings/custom-fields/CustomFieldsSettingsForm.tsx
app/(app)/settings/tasks/TaskSettingsForm.tsx
app/(app)/settings/organisation/OrgForm.tsx
```

**Reports, Time, Import**
```
app/(app)/reports/page.tsx    – Plan gated (starter+). UpgradeWall shown on free.
app/(app)/time/page.tsx       – Plan gated (starter+). UpgradeWall shown on free.
app/(app)/import/page.tsx     – Bulk Excel import UI
app/(app)/import/ImportView.tsx
```

### API Routes

**Auth**
```
app/api/auth/provision/route.ts (NEW) – POST: upserts public.users after OAuth
```

**Tasks**
```
app/api/tasks/route.ts           – GET (filtered), POST (create)
app/api/tasks/[id]/route.ts      – GET, PATCH, DELETE (soft: sets deleted_at)
app/api/tasks/[id]/approve/route.ts  – POST: decision=submit|approve|reject
app/api/tasks/[id]/attachments/route.ts
app/api/tasks/[id]/comments/route.ts
```

**Projects**
```
app/api/projects/route.ts        – GET (member_ids filtered), POST (saves member_ids)
app/api/projects/[id]/route.ts   – PATCH (ALLOWED includes member_ids), DELETE (archive)
```

**Team**
```
app/api/team/route.ts – GET members, POST invite (Supabase inviteUserByEmail with redirectTo=/auth/confirm),
                        PATCH role OR is_active:false (remove). Cannot remove owner or self.
```

**Import**
```
app/api/import/route.ts          – POST: parses Excel. isSampleRow() catches [SAMPLE] prefix.
app/api/import/template/route.ts – GET: generates .xlsx with [SAMPLE] prefixed example rows.
```

**Settings**
```
app/api/settings/features/route.ts      – GET/POST feature toggles (no plan check in API — enforced in UI)
app/api/settings/organisation/route.ts
app/api/settings/notifications/route.ts
app/api/settings/tasks/route.ts
app/api/settings/categories/route.ts
app/api/settings/custom-fields/route.ts
app/api/settings/permissions/route.ts
app/api/settings/billing/route.ts
```

**Onboarding**
```
app/api/onboarding/route.ts            – POST: create org + owner member + default workspace
app/api/onboarding/join-invite/route.ts – POST: add invited user to org
```

### Components

**Tasks**
```
components/tasks/TaskDetailPanel.tsx    – Centered modal. All bg colors dark-mode safe (rgba).
components/tasks/InlineOneTimeTask.tsx  – Full inline create: assignee/co-assignees/priority/due/client/approver/attach/recurring
components/tasks/InlineTaskRow.tsx      – Compact create row for project board. Gets projectOwnerId → pre-fills approver.
components/tasks/InlineRecurringTask.tsx
components/tasks/CompletionAttachModal.tsx
components/tasks/ComplianceTaskPicker.tsx  – CA compliance task dropdown
components/tasks/InlineCustomFields.tsx
components/tasks/MentionTextarea.tsx
```

**UI**
```
components/ui/Skeleton.tsx     – Dark-mode aware. Uses var(--border). 3 variants:
                                  Skeleton (base), SkeletonRows, TaskListSkeleton, KanbanSkeleton
components/ui/Toast.tsx        – All colors now rgba() — works in both modes
components/ui/Badge.tsx        – PlanBadge, RoleBadge, ProjectStatusBadge. All bg = rgba(color, 0.12)
components/ui/UpgradeWall.tsx  – Shown when canUseFeature() returns false
components/ui/RouteLoader.tsx  – Teal progress bar on navigation
components/ui/NavigationProgress.tsx
components/ui/AppLoader.tsx    – Initial hydration splash
components/ui/DatePicker.tsx
components/ui/KeyboardShortcuts.tsx
```

**Layout**
```
components/layout/Sidebar.tsx     – Dark bg (#0f172a always). Nav links. Org switcher. 
components/layout/Header.tsx      – Search, notifications (rgba bg fixed), user menu
components/auth/AuthErrorBoundary.tsx
components/search/SearchModal.tsx
components/clients/QuickAddClientModal.tsx
components/walkthrough/WalkthroughOverlay.tsx – First-time user tour (accounts < 7 days old)
  Shows 12-card walkthrough; navigates to each feature page on Next; Quick Tasks step has
  "Create your first task" CTA. localStorage key: planora_wt_v1_${userId}. SSR-safe.
components/theme/ThemeProvider.tsx – light/dark/system. Uses localStorage.
components/theme/ThemeToggle.tsx
```

### Lib / Utilities
```
lib/supabase/server.ts     – createServerClient (SSR, cookie-based)
lib/supabase/client.ts     – createBrowserClient (flowType: 'implicit', detectSessionInUrl: true)
lib/supabase/admin.ts      – createClient with service role key
lib/utils/planGate.ts      – PLAN_LIMITS, effectivePlan(), canUseFeature(), isAtMemberLimit(), isAtProjectLimit()
lib/utils/format.ts        – fmtDate, isOverdue, todayStr, fmtHours
lib/utils/cn.ts            – className merge
lib/hooks/useOrgSettings.ts – Client-side org settings + feature flags
lib/inngest/client.ts      – Inngest client
lib/inngest/functions/     – onTaskAssigned, onApprovalRequested, onApprovalCompleted, onMemberInvited, etc.
lib/email/resend.ts        – Resend client + FROM address
lib/email/send.ts          – sendTaskAssignedEmail, sendDueSoonEmail, sendMemberInvitedEmail, etc.
lib/email/gate.ts          – Email daily dedup (email_daily_log)
lib/data/complianceTasks.ts – 69 CA compliance task definitions
```

---

## 4. PLAN GATE SYSTEM

### Plan Limits (lib/utils/planGate.ts)
```
free:     { members: 5,  projects: 3,   features: ['tasks','clients','recurring'] }
starter:  { members: 15, projects: 15,  features: [..., 'time_tracking','approvals','reports','custom_fields'] }
pro:      { members: 50, projects: 100, features: [..., 'api','exports','ca_compliance','import_export'] }
business: { members: -1, projects: -1,  features: [..., 'sso','audit'] }
```

### Where Gates Are Enforced

| Resource | API Gate | UI Gate |
|----------|----------|---------|
| Members | ✅ isAtMemberLimit() in POST /api/team | ✅ Error shown |
| Projects | ✅ isAtProjectLimit() in POST /api/projects | ✅ Error shown |
| Reports | ✅ canUseFeature() in page.tsx | ✅ UpgradeWall |
| Time tracking | ✅ canUseFeature() in page.tsx | ✅ UpgradeWall |
| CA compliance | ⚠️ UI only | ✅ FeaturesView locked |
| Import/Export | ⚠️ UI only | ✅ FeaturesView locked |
| Custom fields | ⚠️ UI only | ✅ FeaturesView locked |
| Tasks (count) | ❌ No hard limit | ❌ No UI gate |
| Clients (count) | ❌ No hard limit | ❌ No UI gate |

### Gaps to Address (future)
- `POST /api/tasks` — no task count limit. Add 500 task limit on free plan.
- `POST /api/clients` — no client count limit. Add 25 client limit on free plan.
- `POST /api/import` — no plan check. Import should require pro.
- Features API POST — no plan check server-side. A motivated user could call it directly.

### effectivePlan() Logic
```typescript
// Trial expired → free
// Cancelled/past_due → free
// Otherwise → plan_tier value from DB
effectivePlan({ plan_tier, status, trial_ends_at })
```

---

## 5. DARK MODE ARCHITECTURE

### CSS Variable System (app/globals.css)
```
:root (light)              html.dark (dark)
--surface: #ffffff          #1e2433
--surface-subtle: #f8fafc   #161b27
--surface-hover: (none)     #252d3d
--border: #e2e8f0           #2d3748
--text-primary: #0f172a     #f1f5f9
--text-secondary: #475569   #94a3b8
--text-muted: #94a3b8       #64748b
--brand: #0d9488            #14b8a6
--brand-light: #f0fdfa      #0f2926
```

### The Rule for Dark Mode Safe Colors
```
❌ background: '#f0fdfa'          — white box in dark mode
✅ background: 'rgba(13,148,136,0.12)'  — works in both

❌ background: bg (from QUICK_ACTIONS array with #f5f3ff)
✅ background: `${color}12`       — 7% opacity of brand color

❌ border: '#e2e8f0'
✅ border: 'var(--border)'
```

### Global CSS Overrides
The last ~6000 chars of `globals.css` contain catch-all overrides for hardcoded hex values:
```css
html.dark [style*="background: #f5f3ff"] { background: rgba(124,58,237,0.12) !important; }
/* ... covers all common light tints */
```

---

## 6. AUTH FLOW COMPLETE REFERENCE

### New User (Google OAuth)
```
1. /login → signInWithOAuth({ provider: 'google', redirectTo: '/auth/callback' })
2. Google → supabase.co/auth/v1/callback → /auth/callback (no ?code, hash only)
3. /auth/callback → sees no ?code → redirect('/auth/confirm')
4. /auth/confirm → supabase.auth.setSession({ access_token, refresh_token from hash })
5. POST /api/auth/provision → upsert public.users row
6. router.replace('/dashboard')
7. app/(app)/layout.tsx → no org_members row → redirect('/onboarding')
8. /onboarding → create org → org_members (owner) → /dashboard ✅
```

### Invited User (email invite)
```
1. Admin → POST /api/team { email, role }
2. admin.auth.admin.inviteUserByEmail(email, { data: { invited_to_org, invited_role }, redirectTo: '/auth/confirm' })
3. User clicks email link → /auth/confirm#access_token=...
4. setSession() → POST /api/auth/provision
   → provision checks user_metadata.invited_to_org → creates org_members row
   → clears metadata
5. router.replace('/dashboard') ✅
```

### Middleware Cookie Fix (middleware.ts)
```typescript
// CRITICAL: Use response.cookies.set() NOT headers.append('Set-Cookie')
setAll(toSet) {
  toSet.forEach(({ name, value }) => request.cookies.set(name, value))
  response = NextResponse.next({ request })
  toSet.forEach(({ name, value, options }) =>
    response.cookies.set(name, value, options)  // ← this is the fix
  )
}
```

---

## 7. KEY BUGS FIXED (this session)

| Bug | Root Cause | Fix |
|-----|-----------|-----|
| Login loop after Google OAuth | PKCE cookie dropped cross-site | Switched to implicit flow + /auth/confirm page |
| Kanban drag to Pending Approval not notifying approver | Plain PATCH didn't set approval_status:pending | Use /approve endpoint with decision:submit |
| White boxes in dark mode | Hardcoded hex bg (#f0fdfa etc.) | rgba() colors + globals.css overrides |
| Recurring page slow | 4 sequential DB queries | Promise.all (saves ~600ms) |
| Calendar page slow | 3 sequential queries | Promise.all + enriched tasks |
| Import sample rows imported | isSampleRow() didn't catch realistic data | [SAMPLE] prefix in template + detection |
| Projects visible to all (wrong) | No member_ids filter | Added member_ids UUID[] column + strict filter |
| Features page no plan lock | FeaturesView had no plan prop | Pass plan from page, lock in UI with toast |
| Remove member missing from Team page | Only in Settings/Members | Added 2-step confirm + PATCH is_active:false |
| Invite link fails silently (otp_expired) | /auth/confirm showed wrong error | Parse hash error params, show correct message |
| Project view submit-for-approval required refresh | No optimistic state update in toggleDone | Read API response body; setTasks instantly |
| Walkthrough showed to all users including existing | Used orgId localStorage key, no account age check | userCreatedAt < 7 days + per-userId key |
| inngest security advisory (3.52.7) | Outdated dependency | Updated to 3.54.0 |

---

## 8. ENVIRONMENT VARIABLES (Vercel)

```
NEXT_PUBLIC_SUPABASE_URL=https://xjaybcthnneppfdgmtaq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_APP_URL=https://sng-adwisers.com    ← CRITICAL for invite redirectTo
RESEND_API_KEY=re_...
FROM_EMAIL=Planora <noreply@planora.in>
INNGEST_EVENT_KEY=...
INNGEST_SIGNING_KEY=...
```

---

## 9. PERFORMANCE NOTES

- All major pages use `Promise.all` or `Promise.allSettled` for parallel DB queries
- Dashboard uses `revalidate: 30` (cached, not force-dynamic)
- Heavy pages (tasks, inbox, recurring, calendar) use `force-dynamic`
- Loading skeletons match actual page layout (KanbanSkeleton for board, TaskListSkeleton for list)
- `optimizePackageImports` in next.config.ts for lucide-react, recharts, @supabase/supabase-js

---

## 10. INNGEST FUNCTIONS (background jobs)

```
onTaskAssigned.ts          – Email when task assigned
onApprovalRequested.ts     – Email approver when submitted
onApprovalCompleted.ts     – Email assignee when approved/rejected  
onMemberInvited.ts         – Email managers when member joins
onDueSoon.ts               – Daily due-soon reminders (7AM IST cron)
onRecurringSpawn.ts        – Daily recurring task instances (7AM IST cron)
onEscalation.ts            – Overdue task escalation
```

---
