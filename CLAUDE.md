# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # Start dev server (localhost:3000)
npm run build    # Production build
npm run lint     # ESLint
npx tsc --noEmit --skipLibCheck   # Type-check without emitting
```

No test suite is configured. TypeScript + lint are the only static checks.

---

## Architecture Overview

**Next.js 15 App Router** multi-tenant SaaS for Indian CA/CPA firms. Live at **sng-adwisers.com**.

### Route Groups

| Group | Path | Description |
|---|---|---|
| Authenticated app | `app/(app)/` | All feature pages behind `AppShell` |
| Public/marketing | `app/page.tsx`, `app/professionals/page.tsx` | Landing pages — always light mode |
| Client portal | `app/portal/[token]/` | Magic-link, no auth required |
| Auth flows | `app/auth/`, `app/login/`, `app/onboarding/` | |

`app/(app)/layout.tsx` — server component that resolves user + org + membership, then renders `AppShell`. Redirects to `/onboarding` when no org membership is found.

`AppShell.tsx` — client component that hydrates the Zustand session store and mounts `WalkthroughOverlay`, `Sidebar`, `Header`, `RouteLoader`.

### Data Flow Pattern

Every page follows the same pattern:
1. **Server page** (`page.tsx`) — calls `getSessionUser()` + `getOrgMembership()` from `lib/supabase/cached.ts` (React `cache()` deduplicates across layout + page), then passes data to a `*Client.tsx` or `*View.tsx`.
2. **Client view** — fetches additional data via `fetch('/api/...')` inside `useEffect`/`useCallback`. All mutations are optimistic — update local state first, then PATCH the API, roll back on failure via a `rollback` callback passed to the `patch()` helper.

### Supabase Client Selection

| Helper | File | When to use |
|---|---|---|
| `createClient()` | `lib/supabase/server.ts` | Server Components, API Routes (uses cookie session) |
| `createClient()` | `lib/supabase/client.ts` | Client components (browser, implicit OAuth flow) |
| `createAdminClient()` | `lib/supabase/admin.ts` | Bypass RLS — invoices, org provisioning, admin ops |

**Always use `.maybeSingle()`, never `.single()`** unless the row is guaranteed to exist.

**FK joins must be explicit:** `assignee:users!tasks_assignee_id_fkey(id, name)`

### API Route Conventions

Every API route:
1. Gets user via `supabase.auth.getUser()` → 401 if missing
2. Gets `org_members` row to resolve `org_id` + `role` → all queries filter by `org_id`
3. Uses `assertCan(supabase, orgId, role, 'permission.key')` for non-manager operations
4. Returns errors via `dbError(error, 'context')` from `lib/api-error.ts`
5. Uses `createAdminClient()` only when RLS must be bypassed

When `frequency` is updated on a task the PATCH route auto-recalculates `next_occurrence_date` via `nextOccurrence(freq, today)` from `lib/utils/recurringSchedule.ts`.

### State Management

**Zustand stores** in `store/appStore.ts`:
- `useAppStore` — session (user, org, role), sidebar open state
- `useToastStore` + `toast.success/error/info()` helper — toast notifications
- `useFilterStore` — universal filter state shared across task views

### Roles & Permissions

`owner > admin > manager > member > viewer`

- Owner + Admin bypass all permission checks (hard-coded, cannot be toggled).
- Manager-level checks in the UI use `['owner','admin','manager'].includes(role)`.
- Fine-grained permissions (e.g. `tasks.assign`, `compliance.edit`) are stored per-org in `org_settings.role_permissions` and read server-side via `lib/utils/permissionGate.ts`. Default fallback is `DEFAULT_PERMISSIONS` in that file.
- Client components read permissions from `useOrgSettings()` hook (`lib/hooks/useOrgSettings.ts`), which fetches from `/api/settings`.

### Key Shared Components

| Component | Location | Notes |
|---|---|---|
| `TaskDetailPanel` | `components/tasks/TaskDetailPanel.tsx` | Centered modal (z-50 backdrop), NOT a sidebar. Opened by passing a `Task` object as `task` prop. |
| `InlineRecurringTask` | `components/tasks/InlineRecurringTask.tsx` | Exports `FrequencyPickerButton`, `FREQUENCIES`, `FREQ_LABEL`, `getFreqLabel`. |
| `FrequencyPickerButton` | (above) | Shared rich picker — use for both creating and editing recurring task frequency. Always calls `onChange` with effective freq string (no sentinels like `monthly_custom`). |
| `WalkthroughOverlay` | `components/walkthrough/WalkthroughOverlay.tsx` | 13-slide PPT-style onboarding tour. `standalone` prop renders it as a page instead of modal. Storage key prefix: `planora_wt_v3_`. |

### Frequency Strings

Granular frequency values (used in `tasks.frequency` column and by `FrequencyPickerButton`):

```
daily | every_N_days | weekly_mon…weekly_sun | weekly_days:mon,wed,fri
bi_weekly | every_N*7_days | monthly_N | monthly_last | monthly_days:1,15,25
quarterly_N | quarterly_last | annual_31jul | annual_30sep | annual_31dec | annual_31mar | annual_Nmon
```

`normalizeFrequency()` in `lib/utils/recurringSchedule.ts` maps granular → DB enum (`weekly_mon` → `weekly`). `nextOccurrence(freq, fromDateStr)` calculates the next spawn date for any format.

### CA Compliance Module

`app/(app)/compliance/` — the core module for Indian CA firms.

- `lib/data/complianceTasks.ts` — static catalogue of 69+ statutory tasks with group, priority, frequency, subtasks.
- `lib/compliance/index.ts` — org-level overrides, attachment configs, custom tasks, frequency helpers.
- `app/api/ca/` — assignments (`ca_client_assignments`), master tasks (`ca_master_tasks`), task instances.
- CA tasks are regular `tasks` rows with `custom_fields._ca_compliance = true`. Filter via `.contains('custom_fields', { _ca_compliance: true })`.
- Tasks with `custom_fields._compliance_subtask = true` are sub-steps within a CA task.
- NIL return: stored as `custom_fields._nil_return = true` on the task.

### Background Jobs (Inngest)

All async work runs via **Inngest** (`lib/inngest/`). Event names follow `noun/verb` convention (e.g. `task/assigned`, `recurring/daily-spawn`). Functions in `lib/inngest/functions/`:

- `recurringSpawn.ts` — daily cron, spawns task instances from recurring templates whose `next_occurrence_date ≤ today`.
- `caComplianceSpawn.ts` — spawns CA compliance task instances.
- `dailyReminders.ts`, `digestNotifications.ts` — notification delivery.
- `onApproval.ts`, `onComment.ts`, `onTaskAssigned.ts` — event-driven notifications.

Fire events from API routes via `inngest.send({ name, data })`.

### File Storage

Dual-path: **Cloudflare R2** (primary, zero egress) → **Supabase Storage** (fallback).

`lib/storage/r2.ts` exports `R2_CONFIGURED` boolean. Upload routes check this and fall back gracefully. Required env vars: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`.

### Plan Tiers

`free → starter → pro → business`

Plan gates are checked in API routes by reading `org.plan_tier` from the membership join. Feature toggles (nav items, modules) are stored in `org_settings.nav_features` and read client-side via `useOrgSettings()`.

---

## Critical Rules

1. **Never hardcode hex colors** — use `rgba()` or CSS vars (`var(--brand)`, `var(--surface)`, etc.) for dark mode safety.
2. **`'use client'` must be the first line** of every client component — before any imports.
3. **`InboxView` and `RecurringView`: use `&&` conditionals, never ternaries** — SWC crashes on ternaries in these files.
4. **Board view is the default tab** in `MyTasksView` (not List).
5. **Approval drag on Kanban**: use `POST /api/tasks/[id]/approve` with `{ decision: 'submit' }`, not a plain PATCH to `status`.
6. **`custom_fields` PATCH merges**, not overwrites — the server merges incoming fields over the existing object to preserve `_ca_compliance`, `_blocked_by`, etc.
7. **`tasks.frequency` DB column** only accepts the normalised enum values. Always call `normalizeFrequency()` when writing to that column from the recurring module. The granular strings (`weekly_mon`, `monthly_15`, etc.) live only in the app layer.
