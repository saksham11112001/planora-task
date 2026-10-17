/**
 * Reading and writing half-yearly MSME declarations.
 *
 * The period dimension lives in msme_declarations (one row per vendor per
 * half-year); msme_vendors stays the vendor master and the billing ledger.
 * See supabase/migrations/add_msme_declarations.sql for why it is split that
 * way.
 *
 * TWO COUNTERS, TWO MEANINGS
 * --------------------------
 * msme_vendors.email_count used to answer two different questions at once:
 *
 *   "how many reminders has this vendor had?"   — must restart each half-year
 *   "has this vendor ever consumed a slot?"     — must NEVER restart
 *
 * Half-yearly cycles make those irreconcilable. One number cannot reset in
 * April and also stay consumed forever, and the anti-gaming scheme depends on
 * the second meaning: every slot gate counts rows with email_count > 0,
 * including soft-deleted ones.
 *
 * So they are now separate:
 *
 *   msme_vendors.email_count       lifetime total, monotonic. THE SLOT LEDGER.
 *                                  Never reset, never decremented. Every
 *                                  existing billing gate keeps working.
 *   msme_declarations.email_count  reminders sent for THIS half-year, 1..max.
 *                                  What the reminder cron reads and the
 *                                  "maximum N emails" cap applies to.
 *
 * A pleasant consequence: a vendor already paid for in September costs no new
 * slot in March. Their lifetime count is above zero, so the `email_count === 0`
 * gate that consumes a slot simply does not fire.
 *
 * The pure functions here are exported separately from the Supabase ones so
 * the carry-forward and mirror rules can be tested without a database.
 */

// Explicit .ts extension: tsconfig sets allowImportingTsExtensions with
// bundler resolution, and it is what lets the unit tests load this module
// under `node --experimental-strip-types`, which does not resolve extensionless
// relative imports.
import { CARRY_FORWARD_FIELDS, describePeriod, isValidPeriodEnd } from './periods.ts'
// Splits .in() filters so a 500-vendor bulk send cannot produce a query string
// long enough to come back 414 — which reads as "no rows" to code that only
// checks `data`.
import { chunk } from '../supabase/fetchAll.ts'

/** Columns selected for a declaration. Kept in one place so the period view,
 *  the form and the mirror cannot drift apart. */
export const DECLARATION_COLS =
  'id, org_id, vendor_id, period_end, status, is_not_msme, udyam_number, pan, ' +
  'udyam_registered_on, msme_category, nature_of_business, outstanding_amount, ' +
  'cert_url, proof_url, declarant_name, declared_at, consent_at, submitted_at, ' +
  'email_count, last_emailed_at, email_bounced, bounce_reason, created_at, updated_at'

export interface Declaration {
  id:          string
  org_id:      string
  vendor_id:   string
  period_end:  string
  status:      'pending' | 'emailed' | 'submitted' | 'not_msme'
  is_not_msme: boolean
  udyam_number:        string | null
  pan:                 string | null
  udyam_registered_on: string | null
  msme_category:       string | null
  nature_of_business:  string | null
  outstanding_amount:  number | null
  cert_url:            string | null
  proof_url:           string | null
  declarant_name:      string | null
  declared_at:         string | null
  consent_at:          string | null
  submitted_at:        string | null
  email_count:         number
  last_emailed_at:     string | null
  email_bounced:       boolean
  bounce_reason:       string | null
}

/**
 * The fields a declaration mirrors back onto its vendor row.
 *
 * Deliberately excludes email_count and last_emailed_at: those are the slot
 * ledger on the vendor row and must not be overwritten by a per-period value.
 */
export const MIRRORED_FIELDS = [
  'status', 'is_not_msme', 'udyam_number', 'pan', 'udyam_registered_on',
  'msme_category', 'nature_of_business', 'outstanding_amount',
  'cert_url', 'proof_url', 'declarant_name', 'declared_at', 'consent_at',
  'submitted_at',
] as const

/**
 * What to pre-fill when a vendor is asked again for a new half-year.
 *
 * This is the whole point of carrying a declaration forward: a returning
 * vendor confirms details they already gave and types one new number, rather
 * than re-keying a form they filled six months ago.
 *
 * outstanding_amount and proof_url are NOT carried — see CARRY_FORWARD_FIELDS.
 * Carrying the balance would let a vendor confirm a stale figure without ever
 * looking at it, which is the one thing the return must get right.
 *
 * Returns a plain object ready to spread into an insert.
 */
export function carryForward(prev: Partial<Declaration> | null | undefined): Record<string, unknown> {
  if (!prev) return {}
  const out: Record<string, unknown> = {}
  for (const f of CARRY_FORWARD_FIELDS) {
    const v = (prev as Record<string, unknown>)[f]
    // undefined means "column not selected"; null is a real carried value
    // only for is_not_msme, where false is the meaningful default.
    if (v !== undefined && v !== null) out[f] = v
  }
  return out
}

/**
 * Which declaration the vendor row should mirror, and the patch to apply.
 *
 * The mirror is the LATEST declaration by period_end. It is a cache that can
 * always be recomputed from this function, never a second source of truth —
 * which is what lets the existing read paths (notably the certificate
 * download route) keep working against the vendor row untouched.
 */
export function mirrorPatch(declarations: Partial<Declaration>[]): Record<string, unknown> | null {
  if (!declarations.length) return null
  const latest = declarations.reduce((a, b) =>
    (b.period_end ?? '') > (a.period_end ?? '') ? b : a)
  const patch: Record<string, unknown> = {}
  for (const f of MIRRORED_FIELDS) {
    const v = (latest as Record<string, unknown>)[f]
    if (v !== undefined) patch[f] = v
  }
  return patch
}

/* ========================================================================== *
 * Supabase-facing helpers. `admin` is a service-role client; every caller has
 * already resolved org_id and run its permission gate.
 * ========================================================================== */

type Admin = {
  from: (t: string) => any
}

/** Read one vendor's declaration for a period, or null. */
export async function getDeclaration(
  admin: Admin, vendorId: string, periodEnd: string,
): Promise<Declaration | null> {
  const { data } = await admin
    .from('msme_declarations')
    .select(DECLARATION_COLS)
    .eq('vendor_id', vendorId)
    .eq('period_end', periodEnd)
    .maybeSingle()
  return (data as Declaration | null) ?? null
}

/** The most recent declaration STRICTLY BEFORE a period — the one to carry
 *  forward from. Ordered by period_end so it works however many cycles the
 *  vendor has been through, and skips a half-year they were not asked about. */
export async function getPreviousDeclaration(
  admin: Admin, vendorId: string, periodEnd: string,
): Promise<Declaration | null> {
  const { data } = await admin
    .from('msme_declarations')
    .select(DECLARATION_COLS)
    .eq('vendor_id', vendorId)
    .lt('period_end', periodEnd)
    .order('period_end', { ascending: false })
    .limit(1)
  return ((data as Declaration[] | null) ?? [])[0] ?? null
}

/**
 * Get or create the declaration for (vendor, period), pre-filled from the
 * vendor's previous declaration.
 *
 * Idempotent and race-safe: two concurrent sends for the same period both
 * reach the insert, the unique constraint rejects the loser, and it re-reads
 * the winner's row rather than failing the request.
 */
export async function ensureDeclaration(
  admin: Admin,
  opts: { orgId: string; vendorId: string; periodEnd: string },
): Promise<Declaration | null> {
  const { orgId, vendorId, periodEnd } = opts
  if (!isValidPeriodEnd(periodEnd)) return null

  const existing = await getDeclaration(admin, vendorId, periodEnd)
  if (existing) return existing

  const prev = await getPreviousDeclaration(admin, vendorId, periodEnd)

  const { data, error } = await admin
    .from('msme_declarations')
    .insert({
      org_id: orgId, vendor_id: vendorId, period_end: periodEnd,
      status: 'pending',
      // Pre-filled at creation, not just at render time, so the firm can see
      // last period's details while waiting for the vendor to confirm them.
      ...carryForward(prev),
    })
    .select(DECLARATION_COLS)
    .maybeSingle()

  if (error) {
    // 23505 = unique violation: another request created it first.
    if ((error as { code?: string }).code === '23505') {
      return getDeclaration(admin, vendorId, periodEnd)
    }
    console.error('[msme/declarations] insert failed:', error.message)
    return null
  }
  return (data as Declaration | null) ?? null
}

/**
 * Batch form of ensureDeclaration, for the bulk send.
 *
 * Calling ensureDeclaration per vendor would be three round trips each — 1500
 * for a 500-vendor batch, which would not finish inside the request. This does
 * it in a fixed handful of queries regardless of batch size.
 *
 * Returns a map of vendor_id → declaration. A vendor missing from the map
 * could not be given one; the caller must not treat that as "no declaration
 * exists", because sending on that assumption would restart their cycle.
 */
export async function ensureDeclarations(
  admin: Admin,
  opts: { orgId: string; vendorIds: string[]; periodEnd: string },
): Promise<Map<string, Declaration>> {
  const { orgId, vendorIds, periodEnd } = opts
  const out = new Map<string, Declaration>()
  if (!isValidPeriodEnd(periodEnd) || vendorIds.length === 0) return out

  const readPeriod = async (ids: string[]): Promise<Declaration[]> => {
    const rows: Declaration[] = []
    for (const part of chunk(ids)) {
      const { data } = await admin
        .from('msme_declarations')
        .select(DECLARATION_COLS)
        .eq('period_end', periodEnd)
        .in('vendor_id', part)
      rows.push(...((data as Declaration[] | null) ?? []))
    }
    return rows
  }

  for (const d of await readPeriod(vendorIds)) out.set(d.vendor_id, d)

  const missing = vendorIds.filter(id => !out.has(id))
  if (missing.length === 0) return out

  // Every earlier declaration for the vendors that need one, newest first, so
  // the first row seen per vendor is the one to carry forward.
  const prevByVendor = new Map<string, Declaration>()
  for (const part of chunk(missing)) {
    const { data } = await admin
      .from('msme_declarations')
      .select(DECLARATION_COLS)
      .lt('period_end', periodEnd)
      .in('vendor_id', part)
      .order('period_end', { ascending: false })
    for (const row of (data as Declaration[] | null) ?? []) {
      if (!prevByVendor.has(row.vendor_id)) prevByVendor.set(row.vendor_id, row)
    }
  }

  // ignoreDuplicates: a concurrent send may have created some of these. The
  // re-read below picks up whichever row won, so a race costs nothing.
  const { error } = await admin
    .from('msme_declarations')
    .upsert(
      missing.map(vendorId => ({
        org_id: orgId, vendor_id: vendorId, period_end: periodEnd,
        status: 'pending',
        ...carryForward(prevByVendor.get(vendorId)),
      })),
      { onConflict: 'vendor_id,period_end', ignoreDuplicates: true },
    )
  if (error) {
    console.error('[msme/declarations] batch insert failed:', error.message)
    return out
  }

  for (const d of await readPeriod(missing)) out.set(d.vendor_id, d)
  return out
}

/**
 * The latest declaration BEFORE a period for each of several vendors.
 *
 * Used by the bulk send to decide which vendors get the "your details are
 * already on file" framing.
 */
export async function getPreviousDeclarations(
  admin: Admin, vendorIds: string[], periodEnd: string,
): Promise<Map<string, Declaration>> {
  const out = new Map<string, Declaration>()
  if (vendorIds.length === 0) return out
  for (const part of chunk(vendorIds)) {
    const { data } = await admin
      .from('msme_declarations')
      .select(DECLARATION_COLS)
      .lt('period_end', periodEnd)
      .in('vendor_id', part)
      .order('period_end', { ascending: false })
    for (const row of (data as Declaration[] | null) ?? []) {
      if (!out.has(row.vendor_id)) out.set(row.vendor_id, row)
    }
  }
  return out
}

/**
 * Recompute the vendor row's mirror from the declarations table.
 *
 * Call after every declaration write. It derives the patch rather than
 * copying the request payload, so the mirror cannot drift from the rows it
 * mirrors: if it is ever wrong, running this again fixes it.
 *
 * Best-effort by design — the declaration is already saved, and failing a
 * vendor's submission because a cache write failed would be worse than a
 * stale cache.
 */
export async function syncVendorMirror(admin: Admin, vendorId: string): Promise<void> {
  const { data } = await admin
    .from('msme_declarations')
    .select(DECLARATION_COLS)
    .eq('vendor_id', vendorId)
    .order('period_end', { ascending: false })
    .limit(1)

  const patch = mirrorPatch((data as Partial<Declaration>[] | null) ?? [])
  if (!patch) return

  const { error } = await admin.from('msme_vendors').update(patch).eq('id', vendorId)
  if (error) console.warn('[msme/declarations] mirror sync failed:', error.message)
}

/** Human label for a period, for emails and the UI. Falls back to the raw
 *  date rather than throwing, so a bad stored value cannot break a send. */
export function periodLabel(periodEnd: string | null | undefined): string {
  if (!periodEnd || !isValidPeriodEnd(periodEnd)) return periodEnd ?? ''
  return describePeriod(periodEnd).label
}
