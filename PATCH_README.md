# Planora v2 — Patch Bundle (Build-Fixed)
## April 2026

Extract this zip and **replace** files in your repo. Paths mirror your repo exactly.

---

## Files in This Patch

| File | Fix |
|------|-----|
| `app/(app)/tasks/MyTasksView.tsx` | #1 Kanban DnD + client filter + done pagination |
| `app/(app)/inbox/InboxView.tsx` | #1 #5 #6 Kanban DnD + client filter + rich cards + done pagination |
| `app/(app)/projects/ProjectsView.tsx` | #3 Team member multi-checkbox + project visibility |
| `app/(app)/team/TeamView.tsx` | #7 Remove member with confirmation modal |
| `app/(app)/loading.tsx` | #2 Page skeleton loader |
| `app/api/tasks/[id]/approve/route.ts` | #1 Approval drag-to-column Inngest sync |
| `app/api/projects/[id]/route.ts` | #3 custom_fields PATCH merge support |
| `app/api/team/route.ts` | #7 DELETE member endpoint |
| `app/api/import/route.ts` | #4 Robust sample row skip |
| `components/tasks/InlineOneTimeTask.tsx` | #6 Client + assignee + due date inline |
| `components/ui/AppLoader.tsx` | #2 Fancy loader + Spinner + PageSkeleton |
| `components/layout/NavigationProgress.tsx` | #2 Route-change progress bar |
| `lib/hooks/useKanbanDnd.ts` | NEW — zero-dependency native HTML5 DnD hook |
| `app/loader-animations.css` | #2 CSS keyframe animations |

**No new npm packages required.** DnD uses native HTML5 drag events.

---

## Two Manual Steps After Copy

### 1. Add CSS animations
Paste the contents of `app/loader-animations.css` into your `app/globals.css`.

### 2. Add NavigationProgress to AppShell
In `app/(app)/AppShell.tsx`, add near the top of the JSX:
```tsx
import { Suspense } from 'react'
import NavigationProgress from '@/components/layout/NavigationProgress'

// Inside return():
<Suspense fallback={null}>
  <NavigationProgress />
</Suspense>
```

---

## Fix Details

### #1 — Kanban drag-to-approval
**Root cause:** Dragging to "Pending Approval" called plain PATCH, so Inngest never fired and the approver never saw the task.
**Fix:** Drop onto `in_review` now calls `POST /api/tasks/:id/approve { decision: 'submit' }` — runs the full approval flow with Inngest email. Both MyTasksView and InboxView fixed.
**DnD:** Switched to a custom `useKanbanDnd` hook using native HTML5 drag events — no new npm package needed.

### #2 — Loaders
- `AppLoader` (full-page spinner with Planora branding)
- `PageSkeleton` (shimmer kanban skeleton in `loading.tsx`)
- `NavigationProgress` (teal→orange top bar on every route change)

### #3 — Project team members
Multi-checkbox picker on each project card. Stored in `projects.custom_fields._members` (JSON array). No DB migration needed. Admins see all; owners + assigned members see theirs.

### #4 — Import sample row skip
12 regex patterns: "yourcompany.com", "Sample", "Example", "Replace me", "John Doe", decoration rows, blank rows, etc. Skipped count returned in response.

### #5 — Done column pagination
5 tasks shown with "Load more". Counter shows full total.

### #6 — Inline task rich info
InlineOneTimeTask expands to show Client, Assign To, Due Date, Priority. Enter = save, Escape = cancel.

### #7 — Remove team member
⋮ menu per member → confirmation modal → DELETE /api/team. Guards: cannot remove yourself or the last admin. Unassigns their tasks on removal.

---

## Critical Rules Preserved
- ✅ No `approver:users!tasks_approver_id_fkey` joins
- ✅ `.maybeSingle()` everywhere  
- ✅ `'use client'` is FIRST line of every client component
- ✅ InboxView uses `&&` not ternaries (SWC-safe)
- ✅ Approval maps `'approve'→'approved'`, `'reject'→'rejected'` before Inngest
