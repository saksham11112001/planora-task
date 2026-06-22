# PLANORA v2 — Updated Handover Document
**GitHub:** saksham11112001/planora-task  
**Live URL:** sng-adwisers.com  
**Stack:** Next.js 15.5 · Supabase (xjaybcthnneppfdgmtaq) · Tailwind v4 · Inngest · Resend · Vercel  
**Last Updated:** 2026-06-22 (Session 21)

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
17. **NEW (Sessions 14–17):** Portal dropdown/modal pattern — any dropdown or modal that could be clipped by parent `overflow`/`transform` must use `createPortal(..., document.body)` + `position: fixed` + `onMouseDown` for backdrop (never `onClick`). See AI_CONTEXT_CODEBASE.md "Portal Dropdown Pattern".
18. **NEW (Sessions 14–17):** Phone number is the identity anchor for trials — one phone = one account = one trial. Phone is required at org creation (`app/api/onboarding`). `users.phone_number` has a unique partial index (NULLs allowed). Never skip phone validation in onboarding.
19. **NEW (Sessions 14–17):** Referral anti-abuse has 7 guards including org age gate (48h), user-ID overlap, phone overlap, circular ring, and network ring. Constants: `MAX_EXTENSION_DAYS=42`, `EXTENSION_PER_REFERRAL=7`, `MIN_ORG_AGE_HOURS=48`. All guard failures return a single generic error (no enumeration).
20. **NEW (Sessions 14–17):** Digest email mode is the default for ALL orgs (when no `org_feature_settings.notification_frequency` record exists, `getOrgNotifMode` returns `'digest'`). Every notification handler MUST check `getOrgNotifMode` or `getOrgNotifModeForUser` before calling a direct send function.
21. **NEW (Sessions 18–19):** MSME Vendor Compliance Tracker — separate module at `/msme`. Vendors added via form; owner/admin/manager only. Razorpay payment gate for vendor reports (₹99/vendor). Bulk email via Resend (`POST /api/msme/shoot`). Magic-link share for client-facing vendor list. Tables: `msme_vendors`, `msme_payments`. SQL: `supabase/migrations/create_msme_tracker.sql` + `add_msme_payment_status.sql`.
22. **NEW (Sessions 18–19):** Partner Portal — `/partner` (owner only). CAs earn commissions (Bronze 10% 1–4 referrals / Silver 15% 5–9 / Gold 20% 10+) when orgs join via their referral link. Tables: `partner_commissions`, `partner_payouts`. API: `GET /api/partner` (tier + stats + referred list), `POST /api/partner/payout` (min ₹500, no double-payout guard). Sidebar shows Handshake icon for owners only.
32. **NEW (Session 21):** MSME Vendor email template redesigned (JLL-inspired) — dark `#0f172a` header with large org name, conversational tone body, DPDP Act 2023 compliance notice box, consent checkbox note, full-width teal CTA, numbered notes section, "Questions? Contact us" footer with contact person. Template file: `lib/email/templates/msmeVendorEmail.ts`.
33. **NEW (Session 21):** Contact person fields (name, email, phone) saved in `org_feature_settings` as `msme_contact_person` key. Added to **Email Schedule modal only** (not a separate popup). Sent with every vendor email; appears in footer as "Questions? Contact us: [name] · [phone] / [email]".
34. **NEW (Session 21):** MSME pack pricing — quarterly-only display (`quarterly_label` field on `MsmeAddonPack`). No annual total shown — subtitle reads "payable annually · + 18% GST".
35. **NEW (Session 21):** MSME add-on vendor slots — after hitting pack limit, partner can buy `+20 / +50 / +100` additional slots via Razorpay. Stored in `org_feature_settings` as `msme_addon_slots.extra_slots`. Counted alongside pack limit in `/api/msme/vendors` and `/api/msme/vendors/[id]/shoot-email`.
36. **NEW (Session 21):** MSME coupon codes — `MSME_COUPON_CODES` env var (format: `CODE1:20,CODE2:50` = code:discount_percent). Validated server-side at `/api/msme/coupon` (GET). Applied in `/api/msme/pay` (POST) before Razorpay order creation.
37. **NEW (Session 21):** Referral tagging fixed end-to-end:
    - MSME landing (`/msme-landing?ref=CODE`): `useSearchParams` reads `ref`, all CTA links pass it to `/login?...&ref=CODE`. Wrapped in `<Suspense>` for Next.js static pre-render.
    - Login page already stores `ref` in `sessionStorage('upfloat_ref_code')`.
    - Onboarding API (`/api/onboarding`): now also checks `standalone_partners.referral_code` (was only checking `organisations.referral_code`). On match, sets `partner_portal_invites.signed_up = true`.
    - Partner join (`/api/partner-portal/profile` POST): after creating new partner, marks referring partner's `partner_portal_invites.signed_up = true`.
38. **NEW (Session 21):** MSME landing page hero rewritten for CA/accountant audience: "Waiting for your clients to set up MSME compliance before audit?" / "Get your clients' MSME compliance ready with just a click of a button". CTA renamed "Get Started Free". "Track payment timelines" language removed throughout.
39. **NEW (Session 21):** Partner commission reduced from ₹500 → ₹200 per paid MSME pack referral. Updated in both `PartnerDashboard.tsx` (display) and `withdraw/route.ts` (balance computation). Partner-to-partner referral remains ₹0.
40. **NEW (Session 21):** Partner portal "already registered" fix — `signUp` error on join page now redirects to `/partners/login?already=1` instead of showing raw error. Login page shows info message for `?already=1`.
25. **NEW (Session 20):** Standalone Partner Portal withdrawal feature — partners can request payouts (min ₹500) via bank transfer from `/partners/dashboard`. New `standalone_partner_withdrawals` table. API: `GET /api/partner-portal/withdraw` (balance), `POST /api/partner-portal/withdraw` (submit request with IFSC validation, no-duplicate-pending guard). Dashboard shows full withdrawal history with status badges (requested/processing/paid/rejected).
26. **NEW (Session 20):** Partner portal referral transparency — signed-up MSME referrals now show pack tier purchased, amount paid (₹), and date. Commission per row shown. Data fetched via `users` → `org_members` → `msme_pack_payments` join in server component.
27. **NEW (Session 20):** Standalone partner portal dark mode fix — `app/(partner-portal)/layout.tsx` now forces light mode via `color-scheme: light !important` CSS and `document.documentElement.classList.remove('dark')` script. Same fix applied to `app/(msme)/layout.tsx` and `app/msme/form/[token]/layout.tsx`.
28. **NEW (Session 20):** MSME login redirect — `app/auth/callback/route.ts` detects if `host` header starts with `msme.` and uses `/msme` as default redirect (instead of `/dashboard`).
29. **NEW (Session 20):** MSME export email audit trail — `MsmeView.tsx` export now generates a second Excel sheet "Email Audit Trail" from `/api/msme/email-logs` (new route). Columns: Vendor Name, Vendor Email, Email Attempt #, Date Sent, Time Sent, Opened On, Status When Sent, Current Status, Response Received On.
30. **NEW (Session 20):** Partner portal `invite_count` bug fixed — was always resetting to 1 on every send. Now uses select-first-then-insert-or-update pattern in `/api/partner-portal/invite`.
31. **NEW (Session 20):** MSME logout button moved to top navbar in `app/(msme)/layout.tsx` (`MsmeLogoutButton.tsx` client component, signs out and redirects to `/login?redirect=/msme`).
23. **NEW (Sessions 18–19):** Reports revamp — `ReportsFetcher.tsx` now computes trajectory (12-week AreaChart), status breakdown (PieChart donut), action items (overdue by assignee / pending approvals / unassigned urgent), and top/bottom 3 performers — all from the existing 90-day tasks query (zero extra DB hits). `ReportsCharts.tsx` has 4 tabs: Overview, Team Performance, Action Items (executive summarized view for owners/admins), Time.
24. **NEW (Sessions 18–19):** Walkthrough enhanced — now 20 slides. Added `msme-tracker` and `partner-portal` slides with SVG illustrations. Updated `welcome`, `reports`, `done` slides with richer detail. Storage key: `planora_wt_v3_${userId}`. Shows to accounts < 14 days old. `standalone` prop renders as full page.

---

## 2. SUPABASE TABLES

### ✅ KEEP (28 core tables)
```
billing_events, clients, email_daily_log, organisations, org_members,
org_settings, org_feature_settings, product_subscriptions, projects,
tasks, task_activity, task_attachments, task_comments, users,
notification_preferences, user_profiles,
invoices, invoice_items,                  ← Session 13 (add_billable_invoices.sql)
referral_redemptions,                     ← Session 13 (add_org_codes_trial.sql) + Sessions 14–17 (redeemer_owner_phone column)
notification_queue,                       ← digest email system
ca_master_tasks, ca_client_assignments, ca_task_instances,
msme_vendors, msme_payments,              ← Sessions 18–19 (create_msme_tracker.sql + add_msme_payment_status.sql)
partner_commissions, partner_payouts,     ← Sessions 18–19 (add_partner_portal.sql)
standalone_partner_withdrawals            ← Session 20 (add_standalone_partner_withdrawals.sql)
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

### Schema additions — Session 20
```sql
-- Standalone partner withdrawal requests (supabase/migrations/add_standalone_partner_withdrawals.sql)
CREATE TABLE IF NOT EXISTS standalone_partner_withdrawals (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id      uuid        NOT NULL REFERENCES standalone_partners(id) ON DELETE CASCADE,
  amount_paise    integer     NOT NULL,
  account_name    text        NOT NULL,
  bank_account    text        NOT NULL,
  bank_ifsc       text        NOT NULL,
  upi_id          text,
  status          text        NOT NULL DEFAULT 'requested'
                              CHECK (status IN ('requested', 'processing', 'paid', 'rejected')),
  admin_note      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  processed_at    timestamptz
);
CREATE INDEX IF NOT EXISTS idx_standalone_partner_withdrawals_partner
  ON standalone_partner_withdrawals(partner_id);
```

### Schema additions — Sessions 18–19
```sql
-- MSME Vendor Compliance Tracker (supabase/migrations/create_msme_tracker.sql)
CREATE TABLE msme_vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name text NOT NULL, udyam_number text, gstin text, pan text,
  email text, phone text, address text, category text,
  registration_date date, status text DEFAULT 'active',
  notes text, custom_fields jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
-- RLS: org members read own org's vendors; managers+ write

-- MSME Payment Gate (supabase/migrations/add_msme_payment_status.sql)
CREATE TABLE msme_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  vendor_id uuid REFERENCES msme_vendors(id),
  razorpay_order_id text, razorpay_payment_id text,
  amount_paise int NOT NULL, status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

-- Partner Portal (supabase/migrations/add_partner_portal.sql)
CREATE TABLE partner_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_org_id uuid NOT NULL REFERENCES organisations(id),
  referred_org_id uuid NOT NULL REFERENCES organisations(id),
  event text NOT NULL, plan_tier text,
  commission_paise int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',  -- pending | approved | paid
  payout_id uuid, created_at timestamptz DEFAULT now()
);
CREATE TABLE partner_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_org_id uuid NOT NULL REFERENCES organisations(id),
  amount_paise int NOT NULL,
  status text NOT NULL DEFAULT 'requested',  -- requested | processing | paid | rejected
  bank_details jsonb, note text,
  created_at timestamptz DEFAULT now(), processed_at timestamptz
);
-- RLS: partner org owner reads/writes own rows
```

### Schema additions — Sessions 13–17
```sql
-- Session 13: Billable tasks + Invoices (supabase/migrations/add_billable_invoices.sql)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_billable bool DEFAULT false;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS billable_amount numeric(12,2);
-- Creates: invoices, invoice_items tables + RLS + indexes + auto updated_at trigger

-- Session 13: Trial + Referral + Join codes (supabase/migrations/add_org_codes_trial.sql)
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS trial_started_at timestamptz;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS trial_extension_days int DEFAULT 0;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS referral_code text UNIQUE;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS join_code text UNIQUE;
-- Creates: referral_redemptions table with UNIQUE(redeemer_org_id)

-- Sessions 14–17: Anti-abuse phone identity anchor (supabase/migrations/anti_abuse_referral.sql)
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique_idx ON users (phone_number) WHERE phone_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS rr_redeemer_referrer_idx ON referral_redemptions (redeemer_org_id, referrer_org_id);
CREATE INDEX IF NOT EXISTS orgs_created_at_idx ON organisations (created_at);
ALTER TABLE referral_redemptions ADD COLUMN IF NOT EXISTS redeemer_owner_phone TEXT;

-- notification_queue table (required for digest email system)
CREATE TABLE IF NOT EXISTS notification_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  user_email text NOT NULL,
  event_type text NOT NULL,
  subject text NOT NULL,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
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
app/(app)/team/page.tsx       – Members with stats. Fetches org_members.id + permissions + org_settings.role_permissions.
                                Passes isAdmin + rolePermissions to TeamView.
app/(app)/team/TeamView.tsx   – Role editing via portal dropdown (position:fixed, createPortal).
                                Permissions button (SlidersHorizontal icon, amber when overrides exist)
                                for non-owner/admin members when isAdmin; opens UserPermissionsPanel via portal.
                                Bulk invite (multiple emails at once).
                                Remove member: 2-step inline confirm (no modal). Uses PATCH is_active:false.
```

**Settings**
```
app/(app)/settings/page.tsx                    – Lists sections. SettingsClient has live search.
app/(app)/settings/SettingsClient.tsx          – Search bar. Icon bg: ${color}20 (rgba, dark safe). Hover: var(--surface-hover).
app/(app)/settings/features/page.tsx           – Passes plan tier to FeaturesView.
app/(app)/settings/features/FeaturesView.tsx   – PLAN GATING: pro features locked on free/starter.
                                                  Shows 🔒 badge. Toggle blocked with toast.
app/(app)/settings/members/MembersView.tsx     – Member management. Organisation codes card (join code + referral code).
                                                  "Have a referral code?" card (admin-only): mono input + Apply button,
                                                  calls POST /api/referral/apply, shows success banner.
app/(app)/settings/members/UserPermissionsPanel.tsx – Per-member permission overrides modal.
                                                  Fixed: createPortal to document.body, mounted guard,
                                                  position:fixed backdrop (was trapped by parent transform).
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
app/(app)/reports/page.tsx             – Plan gated (starter+). UpgradeWall shown on free.
app/(app)/reports/ReportsFetcher.tsx   – Server component: computes trajectoryData (12 weeks), statusBreakdown,
                                         actionItems (overdue/pending_approval/unassigned_urgent), top/bottom performers.
                                         All from existing 90-day tasks query — zero extra DB hits.
app/(app)/reports/ReportsCharts.tsx    – Client: 4 tabs — Overview (trajectory AreaChart + status PieChart),
                                         Team Performance (top/bottom 3 cards + BarChart), 
                                         Action Items (executive summarized view: grouped by assignee, urgency split, unassigned panel),
                                         Time (existing time log).
app/(app)/time/page.tsx                – Plan gated (starter+). UpgradeWall shown on free.
app/(app)/import/page.tsx              – Bulk Excel import UI
app/(app)/import/ImportView.tsx
```

**MSME Vendor Compliance Tracker**
```
app/(msme)/layout.tsx          – Forces light mode; shows MsmeLogoutButton in navbar when logged in
app/(msme)/MsmeLogoutButton.tsx – Client: signs out via Supabase, redirects to /login?redirect=/msme
app/(app)/msme/page.tsx        – owner/admin/manager only; redirects others to /dashboard
app/(app)/msme/MsmeView.tsx    – Client: vendor table, bulk email, magic-link share, pack upgrade modal
                                  (quarterly price, add-on slots, coupon code input), email schedule
                                  modal (also saves contact person name/email/phone). Excel export:
                                  2 sheets "MSME Vendors" + "Email Audit Trail".
app/api/msme/route.ts          – GET/POST/PATCH/DELETE vendors; limit = pack_limit + addon_slots
app/api/msme/vendors/[id]/shoot-email/route.ts – POST: send vendor email; reads msme_contact_person
                                  from org_feature_settings and passes to email template
app/api/msme/settings/route.ts – GET/PATCH: email schedule, cc_email, contact_person
app/api/msme/pay/route.ts      – POST: pack upgrade OR addon_slots Razorpay order (coupon applied);
                                  PUT: verify signature + write pack/addon to org_feature_settings
app/api/msme/coupon/route.ts   – GET: validate coupon code from MSME_COUPON_CODES env var
app/api/msme/email-logs/route.ts – GET: all msme_email_log rows for org (audit export)
lib/msme/packs.ts              – MSME_PACKS (with quarterly_label) + MSME_ADDON_PACKS
lib/email/templates/msmeVendorEmail.ts – JLL-inspired template: dark header, DPDP notice,
                                  checklist box, consent note, contact person footer
app/msme-landing/MsmeLandingClient.tsx – CA-targeted hero; useSearchParams(ref) passed through
                                  all CTA links wrapped in <Suspense>
app/auth/callback/route.ts     – Detects msme. subdomain → defaults redirect to /msme
```

**Partner Portal (org-based, legacy)**
```
app/(app)/partner/page.tsx        – owner only; redirects non-owners to /dashboard
app/(app)/partner/PartnerView.tsx – Client: tier badge + progress bar, referral link copy,
                                    5 stat cards, payout request form (min ₹500),
                                    payout history, referred clients table, "How It Works" section
app/api/partner/route.ts          – GET: tier, rate, stats, referred[], commissions[], payouts[]
app/api/partner/payout/route.ts   – POST: create payout request (guard: min ₹500, no double-payout)
```

**Standalone Partner Portal (active, at /partners/**)**
```
app/(partner-portal)/layout.tsx                 – Forces light mode (color-scheme + removes html.dark)
app/(partner-portal)/partners/dashboard/page.tsx – Server: fetches partner, invites, withdrawals,
                                                    enriches signed-up MSME invites with pack purchase
                                                    data via users → org_members → msme_pack_payments
app/(partner-portal)/partners/dashboard/PartnerDashboard.tsx – Client: invite form, referral links,
                                                    Referred Users table (shows pack tier + commission
                                                    per row), Withdraw Earnings section (balance cards,
                                                    withdrawal form, withdrawal history table)
app/api/partner-portal/invite/route.ts          – POST: send invite email, track invite_count
app/api/partner-portal/withdraw/route.ts        – GET: balance (earned/available/hasPending) + history
                                                   POST: submit withdrawal (IFSC validation, min ₹500,
                                                   no-duplicate-pending guard)
Tables: standalone_partners, partner_portal_invites, standalone_partner_withdrawals
Commission: MSME paid pack referral ₹200 · Partner-to-partner referral ₹0
Balance = earned − (requested + processing + paid withdrawals)
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
app/api/onboarding/route.ts            – POST: create org + owner member + default workspace.
                                          Phone required + E.164 format validation.
                                          Phone uniqueness check (blocks if another account has it).
                                          One-trial-per-phone: blocks if any trialing org owner shares this phone.
                                          Referral code applied inline if provided (3-layer anti-abuse check).
app/api/onboarding/join-invite/route.ts – POST: add invited user to org
```

**Referral & Join**
```
app/api/referral/apply/route.ts        – POST: apply referral code post-signup (7 anti-abuse guards).
                                          Guards: org age (48h), once-per-org, user-ID overlap, phone overlap,
                                          circular ring, network ring, caller phone required.
                                          All failures return generic "Invalid or ineligible referral code".
app/api/org/join/route.ts              – POST: join org via 8-char join code (rate-limited: 10/5min).
app/api/org/rotate-join-code/route.ts  – POST: owner/admin only; generates new join code.
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
components/walkthrough/WalkthroughOverlay.tsx – First-time user tour (accounts < 14 days old)
  20-slide PPT-style walkthrough with SVG illustrations per slide. Navigates to each
  feature page on Next. `standalone` prop renders as full page instead of modal.
  localStorage key: planora_wt_v3_${userId}. SSR-safe.
  Slides: welcome, tasks, board, recurring, inbox, projects, clients, calendar,
  approvals, team, compliance, reports, msme-tracker, partner-portal, done.
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
lib/inngest/functions/     – All digest-aware: onTaskAssigned, onApproval, onComment, onMemberInvited,
                             dailyReminders (8 AM IST), digestNotifications (8:15 AM + 6 PM IST),
                             recurringSpawn, caComplianceSpawn, trialExpiry, clientDocReminders
lib/email/resend.ts        – Resend client + FROM address
lib/email/send.ts          – Direct send functions (for immediate-mode orgs only)
lib/email/gate.ts          – Email daily dedup via email_daily_log table
lib/email/queue.ts         – getOrgNotifMode, getOrgNotifModeForUser, queueNotification, markQueueSent
lib/email/templates/digestEmail.ts – digestEmailHtml: groups all event types into one HTML email
lib/utils/codeGen.ts       – generateCode(), formatCode(), normaliseCode() (referral + join codes)
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
| UserPermissionsPanel appeared inline without backdrop | Modal trapped by parent CSS transform/stacking | createPortal to document.body + position:fixed backdrop |
| Team page role dropdown clipped at bottom of screen | position:absolute inside overflow container | Portal + position:fixed + viewport coordinate capture |
| CA Compliance template dropdown closed instantly on click | useEffect mousedown checked ref.contains(target) — portal content is outside ref subtree, always false | Removed useEffect; backdrop onMouseDown + panel stopPropagation |
| Digest emails sent individually per event | Assignee escalation + approver approval-digest paths called direct send functions bypassing queue | Added getOrgNotifMode check; digest → queueNotification |
| Morning digest missed items queued by dailyReminders | Both ran at 8:00 AM IST — race condition | digestMorning shifted to 8:15 AM IST |
| Multi-account referral farming | No phone identity anchor; multiple Google accounts = multiple trials | Phone required at signup; unique partial index on users.phone_number; 7-guard referral API |
| Reports Action Items was raw task table (slow to scan) | Per-task list rows with no grouping | Replaced with executive grouped view: overdue by assignee (count + urgency), approval urgency split, unassigned side-by-side capacity panel |
| Walkthrough showed generic slides with no product depth | Slides had minimal text/no illustrations | Rewrote all slides with SVG illustrations, expanded bullets, specific numbers; added MSME and Partner Portal slides |
| MSME dark-mode form inputs | Hardcoded light bg on form fields | Replaced with rgba() and CSS vars throughout MsmeView |

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
# Sessions 18–19 additions (required for MSME + Partner Portal):
RAZORPAY_KEY_ID=rzp_live_...
RAZORPAY_KEY_SECRET=...
# Cloudflare R2 for file storage (falls back to Supabase Storage if not set):
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=...
# AI features (optional — used for smart action suggestions in reports):
ANTHROPIC_API_KEY=sk-ant-...
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
onTaskAssigned.ts          – Email when task assigned. Digest mode → queueNotification(task_assigned).
onApproval.ts              – onApprovalRequested + onApprovalCompleted.
                             Both check org notification mode; digest → queueNotification.
onComment.ts               – onTaskCommented. Digest mode → queueNotification(task_commented).
onMemberInvited.ts         – Email managers when member joins. Digest mode → queueNotification(member_invited).
dailyReminders.ts          – Runs at 8:00 AM IST (2:30 UTC). 4 steps:
                             1. Due-soon tasks (1–3 days out) → digest or sendDueSoonEmail
                             2. Escalation (overdue by 1d) → managers AND assignee via digest or direct
                             3. Overdue WhatsApp pings to assignee (if opted in)
                             4. Pending approval digest to approvers → digest or sendApprovalDigestEmail
recurringSpawn.ts          – Daily recurring task instance creation.
caComplianceSpawn.ts       – Spawns CA compliance task instances.
digestNotifications.ts     – digestMorning (8:15 AM IST) + digestEvening (6:00 PM IST).
                             Fetches all pending notification_queue rows, groups by org → user,
                             sends ONE email per user per slot containing ALL pending items grouped by event type.
                             digestMorning intentionally runs at 8:15 (not 8:00) to let dailyReminders
                             finish queueing before the flush.
trialExpiry.ts             – Handles trial expiry notifications/status changes.
clientDocReminders.ts      – Client document reminders.
```

### Digest Email Architecture
```
notification_queue table → digestNotifications.ts (flushes twice daily)
                         → digestEmailHtml template (groups by event_type)
                         → ONE email per user per slot

All event handlers check getOrgNotifMode() FIRST:
  'digest'    → queueNotification({ orgId, userId, userEmail, eventType, subject })
  'immediate' → direct sendXxxEmail() call (behind acquireEmailSlot for daily dedup)

Default mode (no org_feature_settings record) = 'digest'
```

---
