# Planora v2 — Patch Bundle
## April 2026

This zip contains all changed files. Extract and **replace** corresponding files in your repo.
File paths inside the zip mirror your repo structure exactly.

---

## Files Changed

| File | Issue Fixed |
|------|-------------|
| `app/(app)/tasks/MyTasksView.tsx` | #1 Kanban DnD fix + client filter + done pagination |
| `app/(app)/inbox/InboxView.tsx` | #1 #5 #6 Kanban DnD fix + client filter + rich cards + done pagination |
| `app/(app)/projects/ProjectsView.tsx` | #3 Team member multi-checkbox + project visibility |
| `app/(app)/team/TeamView.tsx` | #7 Remove member with confirmation modal |
| `app/(app)/loading.tsx` | #2 Page skeleton loader |
| `app/api/tasks/[id]/approve/route.ts` | #1 Approval drag-to-column Inngest sync |
| `app/api/projects/[id]/route.ts` | #3 custom_fields PATCH merge support |
| `app/api/team/route.ts` | #7 DELETE member endpoint |
| `app/api/import/route.ts` | #4 Robust sample row detection |
| `components/tasks/InlineOneTimeTask.tsx` | #6 Always-visible client/assignee/due date |
| `components/ui/AppLoader.tsx` | #2 Fancy loader + Spinner + PageSkeleton |
| `components/layout/NavigationProgress.tsx` | #2 Route-change progress bar |
| `app/loader-animations.css` | #2 Progress bar keyframe animations |

---

## Setup Steps

### 1. Install `@hello-pangea/dnd` (if not already)
```bash
npm install @hello-pangea/dnd
```

### 2. Add CSS animations
In your `app/globals.css` or `tailwind.css`, paste the contents of `app/loader-animations.css`.

### 3. Add NavigationProgress to AppShell
In `app/(app)/AppShell.tsx`, add:
```tsx
import NavigationProgress from '@/components/layout/NavigationProgress'
// Inside the JSX return:
<NavigationProgress />
```
Wrap in `<Suspense>` since it uses `useSearchParams`:
```tsx
import { Suspense } from 'react'
<Suspense fallback={null}><NavigationProgress /></Suspense>
```

### 4. Supabase: No schema changes needed
Team member assignments are stored as `custom_fields._members` (JSON array of user IDs) on the `projects` table — no migration needed.

---

## What Each Fix Does

### #1 — Kanban Drag-to-Approval Fix
**Root cause:** Dragging to "Pending Approval" column was calling a plain `PATCH /api/tasks/:id` with `status: 'in_review'`, but the Inngest `onApproval` function expects the task to come through `/api/tasks/:id/approve` with `decision: 'submit'` to properly notify the approver.

**Fix:** When the drop target is `in_review`, the kanban now calls `POST /api/tasks/:id/approve { decision: 'submit' }` instead of a plain PATCH — ensuring Inngest fires the approver email.

### #2 — Fancy Loaders
- `AppLoader.tsx` exports: `AppLoader` (full-page spinner), `PageSkeleton` (shimmer layout), `Spinner` (inline)
- `loading.tsx` uses `PageSkeleton` for all route transitions
- `NavigationProgress` shows a teal→orange progress bar at the top on route changes

### #3 — Project Team Members
- Multi-checkbox picker inside each project card
- Member IDs stored in `projects.custom_fields._members` (JSON array)
- Project visibility: admins see all; owners and assigned members see their projects; unassigned projects visible to all
- No database migration needed

### #4 — Import Sample Row Skip
Enhanced `isSampleRow()` function with 12 regex patterns catches: "yourcompany.com", "Sample", "Example", "replace me", "John Doe", "test client", decoration rows, and blank rows. Skipped rows are counted and returned in the response.

### #5 — Done Column Pagination
Both `MyTasksView` and `InboxView` Done columns show 5 tasks with a "Load more" button. Counter shows total count.

### #6 — Inline Task Rich Info
`InlineOneTimeTask` now shows Client, Assign To, Due Date, and Priority fields inline — always visible when focused, with keyboard support (Enter = save, Escape = cancel).

### #7 — Remove Team Member
- `TeamView` has a ⋮ menu per member with "Remove Member" option
- Confirmation modal prevents accidental removal
- Cannot remove yourself or the last admin
- `DELETE /api/team` unassigns all their tasks (sets assignee_id = null)

---

## Critical Rules Preserved
- ✅ No `approver:users!tasks_approver_id_fkey` joins
- ✅ `.maybeSingle()` everywhere
- ✅ `'use client'` is first line of every client component
- ✅ InboxView uses `&&` not ternaries
- ✅ Approval maps `'approve'→'approved'`, `'reject'→'rejected'` before Inngest
