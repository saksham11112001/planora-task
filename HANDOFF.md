# upFloat — session handoff

**Repo:** `saksham11112001/planora-task` · **Branch:** `claude/bold-wozniak-btpn93` · **Live:** upfloat.co
**State at handoff:** working tree clean, everything merged to `main`, **523 tests pass**, `tsc --noEmit` clean, production build compiles.
**Last merge:** PR #313 (`1f1ee5f`).

---

## 1. Who the user is and how they work

Saksham — non-technical founder. Communicates in short, directive messages ("do it", "open pr", "what to msg user"). Often forwards screenshots or pasted SQL output with little context, expecting you to work out what it means.

**Standing instructions, stated explicitly and repeatedly — these persist:**

- "Make changes very very carefully and responsibly"
- "Audit after every change nothing else is changing"
- "Ensure no other UI logic functionality is hit and only expected changes are done"
- **Never create a pull request unless explicitly asked.** They say "open pr" when they want one.

**Working rhythm that has been effective:** investigate from the code rather than assume → make the change → run `npx tsc --noEmit --skipLibCheck`, `npm test`, `npm run build` → audit the diff → commit and push → report plainly, including anything you got wrong.

They respond well to being told when something you said earlier was wrong. Several corrections mid-session were accepted without friction and improved the work.

---

## 2. Hard-won environment facts

- **No database access.** There are no Supabase credentials or `.env` in this environment and never were. Every SQL "verification" in this session ran against a throwaway local Postgres (`/usr/lib/postgresql/16/bin/initdb`, run as the `postgres` user — root cannot) loaded with fixture data copied from pasted output. **The user runs all production SQL themselves and pastes the result back.**
- **The Supabase SQL editor is not psql.** `\set` and `:'var'` are silently ignored. Any script must put a value in one literal place. This broke a script mid-session.
- **Supabase's editor shows only the last statement's result**, so a script that must report something should end in a single `SELECT`, typically a `UNION ALL` of sections.
- **psql does not stop on error** — a raised exception does NOT prevent the next statement running. A guard and the write it guards must be in **one statement** (a `DO $$ ... $$` block). This was discovered the hard way: a guard raised correctly and the delete ran anyway, removing 292 rows.
- `node_modules` vanished once mid-session (worker restart). `npm ci` restored it. If `tsc` reports "Cannot find module 'react'", that is the cause, not your code.
- `npm run lint` fails — ESLint is not installed. Pre-existing. `tsc` + tests are the only static checks.
- `next.config` has `typescript.ignoreBuildErrors` and `eslint.ignoreDuringBuilds`, **so type errors can reach production.** `tsc` must be clean.
- Node test runner (`node --experimental-strip-types --test`) **cannot resolve the `@/` alias.** Anything with tests must use relative `.ts` imports.
- Playwright + Chromium are preinstalled. Not used this session.

---

## 3. Codebase traps (learned by being bitten)

| Trap | Correct form |
|---|---|
| `NULL <> true` is NULL, not true | `.or('is_archived.is.null,is_archived.eq.false')`, never `.neq('is_archived', true)`. In SQL: `is_archived is not true`. This once hid 3 of 4 results. |
| PostgREST truncates at 1000 rows silently | `fetchAllRows` / `chunk` in `lib/supabase/fetchAll.ts` |
| `#>>` binds tighter than `\|\|` | jsonb paths need `array['a','b']` form |
| `.single()` throws on 0 rows | Always `.maybeSingle()` unless the row is guaranteed |
| FK joins need explicit hints | `assignee:users!tasks_assignee_id_fkey(id, name)` |
| `!inner` and `!column_name` are also valid after `!` | Only `*_fkey` names are constraints — see §5 |
| Repo migrations ≠ live schema | Several live columns have no migration. Ask the database, never the files. |

**From `CLAUDE.md` (project rules):** never hardcode hex colours (use CSS vars) — *except* in surfaces that are deliberately light-locked, see §6; `'use client'` must be the literal first line; `InboxView`/`RecurringView` must use `&&` not ternaries (SWC crashes); `custom_fields` PATCH merges rather than overwrites; always `normalizeFrequency()` before writing `tasks.frequency`.

---

## 4. What shipped this session (all merged)

### PR #310 — approver subtask gate + MSME vendor identity
- `app/api/tasks/[id]/approve/route.ts` had its own inline subtask check that omitted `is_archived`, so **deleted subtasks blocked approval**. It also ran only for non-admins, so it failed for the assigned approver and passed for admins — which read as a permissions bug. Now uses the shared `lib/utils/subtaskGate.ts`.
- MSME vendor identity changed from `(client, email)` to `(client, company, email)` so one proprietor's multiple supplier companies on a shared address are all accepted. Migration: `add_msme_vendor_name_to_uniqueness.sql` (**run**).
- Near-miss: the import route's lookup needed `vendor_name` added to its `select` or dedup would have **failed open** and doubled every vendor on re-import.

### PR #311 / #312 — bounce classification
`msme_vendors.email_bounced` was one boolean carrying three unrelated facts (opted out / mailbox full / dead address), and all three send paths read it as "never email again". A mailbox full for an hour silenced a vendor permanently. The screen called all of them "invalid email addresses ... never received your email", which was false for 9 of 10 cases shown.

- **`lib/msme/bounceKind.ts`** — `classifyBounce()` → `unsubscribed | spam | hard | soft | unknown`; `isBlockingBounce()`; `bounceCopy()`. Reads the stored text, so no migration and historical rows reclassify on deploy. SMTP code first (4xx transient, 5xx permanent, 5xx-about-storage transient), prose second, **unknown blocks**.
- Webhook stops setting `email_bounced` for soft failures.
- **The "Fix email" button had never worked**: `PATCH /api/msme/vendors/[id]` refused a change once `email_count > 0`, true of every vendor on that list. And nothing anywhere set `email_bounced` back to `false`. Both fixed — the address can be corrected for a bounced vendor, and doing so clears the block **only when the address actually changes** (so it cannot undo an unsubscribe).
- **A bug found in my own classifier by the user's real data:** `'unavailable'` was in the soft-word list, so bare `mailbox unavailable` (a *dead* mailbox — Outlook's `550 5.5.0` with the code stripped) was classified temporary. Fixed; `'temporarily unavailable'` still soft, with a test pinning that. Also added `mx of domain` → hard (43 of 143 rows).
- SQL and TypeScript classifiers were **cross-checked row by row against all 143 real strings** by extracting the `CASE` from the shipped migration file (not a copy) — they agree on all 143.

### PR #313 — network failures + funnel instrumentation
- **`lib/http/safeFetch.ts`** — never throws; reads body as text before parsing so a 502 HTML page can't blow up; prefers the server's message; treats `200` carrying `{ error }` as failure.
- **17 functions across 11 files** had the shape: loading flag on → `await fetch` → flag off on a line the throw skips. All fixed, resets moved to `finally`.
  - Worst: **`BillingView`** — Razorpay invokes its handler callback itself, *outside* the function's `try/catch`, so verification after payment was unprotected. Money already gone; button spun forever; invites paying twice.
  - `login handleMagicLink` froze the entire sign-in screen (all buttons disabled while loading).
  - `TeamView sendBulk` abandoned rows 4–20 on a row-3 throw; now catches per row.
  - `TaskDetailPanel` ×3 left phantom NIL markers/comments; `sendComment` also cleared the input, losing the text — now restored.
- **`lib/analytics/events.ts`** — all PostHog event names in one place, with tests pinning the strings (renaming doesn't rename history; it splits the series silently). `safeProps()` keeps client/vendor/declarant names, emails, GSTINs, PANs, tokens out; `org_name` passes because `identify()` already sends it.
  - **The first name chosen was wrong and the call site caught it:** `signup_started` couldn't work because the Google/Microsoft buttons serve sign-in and sign-up alike. Renamed to `auth_started` with an `intent` property that is `'unknown'` where the truth is unknown. Renamed *before* shipping, while it was still free.
  - Wired: `auth_started` (4 entry points), `org_created` (pre-existing, routed through catalogue unchanged), `client_created` (3 paths).

### Earlier in session (merged before #310)
Client inactive feature (`lib/clients/deactivation.ts`); **a production outage I caused** by reading `clients.custom_fields`, a column that does not exist — every client save broke for every firm; fixed by moving the marker to `tasks.custom_fields` and surfacing the error via `dbError` instead of collapsing it to a 404. Reports restricted to owner/admin including an **unprotected export endpoint**. HVAT root cause in `lib/ca/migrateMasterDates.ts`. Mandatory-fields enforcement. Four missing `clients` columns (`add_client_gstin_pan_dsc.sql`, run).

---

## 5. Diagnostic tooling built (committed, reusable)

| File | Purpose |
|---|---|
| `supabase/migrations/repair_soft_bounce_blocks.sql` | Clears `email_bounced` on soft bounces. **Run by user.** Idempotent. |
| `supabase/migrations/cleanup_seeded_msme_vendors.sql` | Step-by-step, preview-first vendor cleanup |
| `supabase/migrations/cleanup_seeded_msme_vendors_oneshot.sql` | Single-run version. **Run by user: 200 removed, 4 kept.** Targets Saksham Test Org by id; **refuses to run unless the org name matches `/test/i`**. |
| `supabase/migrations/who_actually_uses_what.sql` | **NOT YET RUN — the open question.** Classifies each org as CA practice / MSME compliance / general / never started. |

**A schema-drift audit was also built** (extracts every `(table, column)` the code touches — 588 pairs across 55 tables — and asks the database which don't exist). It lived in the scratchpad and **has been lost to a scratchpad clear.** Worth rebuilding if schema drift is suspected; it was motivated by the outage above. Key lessons if rebuilt: strip comments before scanning (comments quote real code), only count depth-1 object keys (nested ones are `custom_fields` keys), and expand `ALLOWED`/`SELECT` const arrays (`clients.pan` appears in **no** literal anywhere).

**A stuck-spinner detector** was written (`find_stuck_spinners.py`) and also lost with the scratchpad. **The user was offered a committed CI version and has not yet answered.** Worth re-raising — the broken pattern is the one that reads most naturally.

---

## 6. Production data facts discovered

Nine organisations. The big realisation: **a 143-row bounce export the user pasted was cross-organisation** (my section-3 query had no `org_id` filter), and I initially analysed it as one firm's list. Per org:

| Org | Vendors | Blocked | Note |
|---|---|---|---|
| Saksham Test Org | 204 → 4 | — | Seeded demo data; cleaned (200 soft-deleted) |
| Secret Niko Foods LLP | 80 | 5 | All 5 **opted out** — phone calls only |
| BOMBA FOOD PVT LTD | 63 | 0 | |
| SGNG & Associates | 47 | 4 | The CA firm |
| SECRET INGREDIENT PROJECTS | 21 | 4 | |
| Bomba / Saksham Test Organisation 2 / Himanshu Singh / Lexellence | small | — | |

**SGNG's 4 blocked vendors, with likely fixes:**
- `mjs@saroverhotels.com` — almost certainly a typo for **`sarovarhotels.com`** (Sarovar Hotels is a real chain). One character.
- `info@h2oengg-solution.com` — no MX; probably the same kind of typo.
- `info@speqtalive.com` — "Message delivery failed", no diagnosis. Worth one manual retry.
- `e-sales@submarinepens.co.in` — dead mailbox, needs a new address.

**Also:** Brevo's sending IP `77.32.148.24` was on the `psbl.surriel.com` blocklist when Shyamoli's mail bounced. That is sender reputation, not a vendor problem. **Not yet checked with Brevo.**

**Slots do not come back on delete** — they count rows with `email_count > 0` *including deleted ones*, deliberately, so deleting cannot reclaim paid capacity. Told the user plainly; resetting counters for seeded data is their billing decision and was left untaken.

---

## 7. Where the conversation ended — the live thread

The user turned to **marketing and expanding the customer base**, then clarified the business model:

> "i have these 2 products and ca firms use the main upfloat and they pitch their clients to use msme this was the model that we tried using."

So it is **one acquisition engine with the CA firm as channel**, not two competing products. Secret Niko Foods / BOMBA FOOD are CA clients who were introduced.

**The finding I delivered, and which is awaiting their response:**

There are two versions of this model, and they may be selling the harder one.

1. **Referral motion (what they tried):** client signs up their own org. Needs 47 separate adoptions.
2. **Service motion (already built, apparently unnoticed):** `msme_vendors.client_id` exists, `MsmeView` has a client picker, counts group per client — **a CA firm can run MSME for all their clients from inside their own account, and the client signs up for nothing.**

**Economics strongly favour the second.** MSME is priced per vendor slot annually with a volume discount (`lib/msme/packs.ts`): ₹120/vendor at 25, **₹60/vendor at 500**. A CA buys at ₹60 and can bill clients ₹150–200/vendor as a 43B(h) service — client pays less than going alone, CA earns margin, upFloat gets one large account instead of 47 fragile ones. CAs are asked about 43B(h) anyway.

**Three gaps blocking it:**
1. `/api/referral/apply` rewards a referrer with **7 trial days (max 42)** — worth exactly nothing to a CA firm already paying for `pro`. The only referral incentive cannot be collected by the people the model depends on.
2. **No MSME affordance anywhere on a client record** — verified, zero mentions. The CA has nothing to click at the moment they'd think of it.
3. `/partners/dashboard` is a separate *affiliate* system with its own registration and commissions — wrong tool for a customer firm serving its own client.

**What I proposed and offered to build (user has not yet replied):**
> A "Run MSME declarations for this client" action on every client record, opening MSME pre-filtered to that `client_id`. Self-contained; doesn't depend on any pending decision.

**Two things I asked the user for:**
- Output of `who_actually_uses_what.sql` — would show whether any firm already uses `client_id` this way.
- A decision on the referral reward if they keep the signup motion (commission or free vendor slots; trial days don't work). **Theirs to set, not mine.**

---

## 8. Open items

**Awaiting the user:**
1. Run `who_actually_uses_what.sql` and paste output
2. Go-ahead on the client-record MSME affordance
3. Referral reward decision
4. Whether to commit the stuck-spinner detector as a CI check

**Known-open, lower priority (some long-standing):**
- Finish the funnel: `task_created`, `member_invited`, `compliance_tasks_generated`, `msme_vendors_imported`, and especially **`upgrade_viewed`** — there is currently no way to tell whether anyone looks at pricing and walks away
- Landing page has a comment stating FAQPage schema is deliberately withheld until a **visible FAQ section** exists — adding one earns the schema and helps conversion
- Settings → Tasks → **Due date: Mandatory** still needs switching on (enforcement shipped long ago)
- **A Koul & Associates GSTR 9** — stale `2025-12-31` for 2 clients, spawns 24 Dec
- 44 undated tasks; worst is a Section 8 incorporation checklist (8 steps, no assignee, since 15 April)
- June calendar: 28 ITR clients need `end_date` **cleared**, not just reactivating
- 122 orphaned spawn records
- Permissions: `time.view_all` and `monitor.view` still `manager: true`; 17 of 26 SGNG staff cannot open Monitor
- SPEQTA Taxsoft manual retry; Brevo blocklist check

---

## 9. Judgement calls worth preserving

- **Correct yourself out loud.** Several things I stated confidently were wrong — three theories on HVAT, two on the "No Due Date: 9" chart, the 129-vs-128 count, the claim that cleanup would free slots, `signup_started`, `'unavailable'` as a soft word. Stating each plainly and moving on worked well and the user never objected.
- **Test the guard, not just the happy path.** A guard that raised but didn't block (psql continuing after an error) and an undo that silently restored zero rows (the view filtered out the rows it needed) were both found *only* by testing them. Both would have looked fine in review.
- **Prefer refusing to guessing.** The ambiguous-org guard fired on real data and was right to: the markers it matched included genuine vendors of a live client. Inference would eventually have soft-deleted a real firm's list.
- **Two implementations of one rule drift.** The SQL `CASE` and the TypeScript classifier were cross-checked against all real inputs, by extracting the `CASE` from the shipped file rather than a copy. The first cross-check (13 fixtures) missed a real bug that 143 real rows caught.
- **Name things for what they can observe.** `auth_started`/`intent: 'unknown'` over `signup_started`.
- **Light-locked surfaces take fixed hex, not CSS vars.** The MSME bounce panel has hardcoded `#fff5f5`/`#fff` backgrounds, so `var(--text-secondary)` would invert in dark mode and put pale grey on near-white. `CLAUDE.md` says never hardcode hex — the exception is real and is commented at the site.
