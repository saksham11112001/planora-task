/**
 * Udyam certificate re-verification.
 *
 * WHY
 * ---
 * A Udyam certificate states the classification at the date of registration.
 * Classification is not permanent: it is reviewed from the enterprise's own
 * ITR and GST filings, so an enterprise that registered as micro in 2021 may
 * be small or medium now.
 *
 * That matters more than it looks, because section 43B(h) reaches MICRO and
 * SMALL suppliers only. So a stale certificate cuts both ways:
 *
 *   still micro/small, stale certificate  → the exposure is real but the firm
 *                                           is relying on out-of-date evidence
 *   reclassified to medium                → the firm has been provisioning for
 *                                           a disallowance that does not apply
 *
 * Either way the remedy is the same: ask the vendor to confirm. This module
 * says who to ask, and why.
 *
 * Pure: `today` is passed in.
 */

/**
 * How old a certificate may be before it is treated as needing confirmation.
 *
 * One year, because that is the point at which reclassification can first
 * have happened — Udyam details are refreshed from the returns an enterprise
 * files annually. A longer threshold would be more comfortable and less
 * truthful.
 */
export const UDYAM_FRESH_DAYS = 365

export type FreshnessStatus =
  | 'fresh'           // registered recently enough to rely on
  | 'stale'           // old enough that classification may have moved
  | 'undated'         // declared MSME but gave no registration date
  | 'not_applicable'  // not an MSME, or never told us

export interface FreshnessInput {
  vendorName:        string
  category:          'micro' | 'small' | 'medium' | null
  isNotMsme?:        boolean
  /** Date on the Udyam certificate, YYYY-MM-DD, or null. */
  udyamRegisteredOn: string | null
  today:             string
}

export interface FreshnessResult {
  vendorName:   string
  status:       FreshnessStatus
  /** Whole days since registration, or null when undated. */
  ageDays:      number | null
  ageYears:     number | null
  /**
   * Does a change of classification change this vendor's 43B(h) treatment?
   *
   * True for micro and small, where reclassification to medium would remove
   * the exposure entirely. False for medium, where it is already outside the
   * section and a change can only bring it in — still worth knowing, but not
   * the same risk.
   */
  affects43b:   boolean
  reason:       string
}

function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00Z`).getTime()
  const b = new Date(`${to}T00:00:00Z`).getTime()
  if (Number.isNaN(a) || Number.isNaN(b)) return 0
  return Math.round((b - a) / 86400_000)
}

export function assessFreshness(o: FreshnessInput): FreshnessResult {
  const base = { vendorName: o.vendorName, ageDays: null as number | null,
                 ageYears: null as number | null, affects43b: false }

  // A declared non-MSME has no certificate to age, and an unknown status is a
  // chase-for-a-declaration problem rather than a re-verification one.
  if (o.isNotMsme || (o.category !== 'micro' && o.category !== 'small' && o.category !== 'medium')) {
    return { ...base, status: 'not_applicable',
             reason: o.isNotMsme ? 'Declared not an MSME' : 'MSME status not yet declared' }
  }

  const affects43b = o.category === 'micro' || o.category === 'small'

  if (!o.udyamRegisteredOn || !/^\d{4}-\d{2}-\d{2}$/.test(o.udyamRegisteredOn)) {
    return { ...base, affects43b, status: 'undated',
             reason: 'No Udyam registration date on file — age of the classification is unknown' }
  }

  const ageDays  = Math.max(0, daysBetween(o.udyamRegisteredOn, o.today))
  const ageYears = Math.round((ageDays / 365.25) * 10) / 10

  if (ageDays <= UDYAM_FRESH_DAYS) {
    return { ...base, ageDays, ageYears, affects43b, status: 'fresh',
             reason: `Registered ${ageYears} year(s) ago` }
  }

  return {
    ...base, ageDays, ageYears, affects43b, status: 'stale',
    reason: affects43b
      ? `Registered ${ageYears} year(s) ago — if reclassified as medium, section 43B(h) would no longer apply`
      : `Registered ${ageYears} year(s) ago — if reclassified as micro or small, section 43B(h) would begin to apply`,
  }
}

export interface FreshnessSummary {
  stale:   FreshnessResult[]
  undated: FreshnessResult[]
  fresh:   FreshnessResult[]
  /** Of the stale and undated, how many would change 43B(h) treatment. */
  affecting43bCount: number
}

/** Assess a book, keeping only what a firm needs to act on at the top. */
export function assessBook(vendors: FreshnessInput[]): FreshnessSummary {
  const out: FreshnessSummary = { stale: [], undated: [], fresh: [], affecting43bCount: 0 }
  for (const v of vendors) {
    const r = assessFreshness(v)
    if (r.status === 'stale')   out.stale.push(r)
    if (r.status === 'undated') out.undated.push(r)
    if (r.status === 'fresh')   out.fresh.push(r)
    if ((r.status === 'stale' || r.status === 'undated') && r.affects43b) out.affecting43bCount++
  }
  // Oldest first — the ones most likely to have moved.
  out.stale.sort((a, b) => (b.ageDays ?? 0) - (a.ageDays ?? 0))
  out.undated.sort((a, b) => a.vendorName.localeCompare(b.vendorName))
  return out
}
