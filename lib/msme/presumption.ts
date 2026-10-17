/**
 * The non-response presumption pack.
 *
 * WHY THIS EXISTS
 * ---------------
 * Every vendor email already states:
 *
 *   "If we do not receive any reply within 15 days of receiving this email, we
 *    shall presume your organisation is not registered under the MSMED Act,
 *    2006."
 *
 * That presumption is what lets a company close its MSME-1 return for the
 * suppliers who never answered. But the presumption is only worth anything if
 * the company can SHOW it asked: who was written to, at what address, on which
 * dates, and that nothing came back. Before this, that evidence existed only
 * as rows in a database — the firm had to reconstruct it by hand if anyone
 * ever queried the return.
 *
 * This module decides who the presumption may fairly be applied to, and
 * assembles the evidence for each one. It is pure and testable: no clock of
 * its own, no database.
 *
 * WHAT IT REFUSES TO DO
 * ---------------------
 * It does not treat every silent vendor as presumed non-MSME. Three groups are
 * deliberately held back, because including them would produce a document that
 * overstates its own case:
 *
 *   never contacted — no request was ever sent, so there is nothing to presume
 *                     from. This is the dangerous one: a firm that imported
 *                     200 vendors and emailed 40 must not get a pack asserting
 *                     a presumption over the other 160.
 *   window open     — fewer than 15 days since the first request. The company's
 *                     own email promised that window; honouring it is the
 *                     reason the presumption holds.
 *   undeliverable   — the address bounced or the vendor unsubscribed, so the
 *                     request was never received. The email's wording turns on
 *                     "receiving this email", so these need a different channel
 *                     (post or courier), not a presumption.
 */

/** The reply window the vendor email itself promises, in days. */
export const PRESUMPTION_WINDOW_DAYS = 15

export type PresumptionStatus =
  | 'presumed'         // asked, window elapsed, no reply — the presumption applies
  | 'window_open'      // asked, but the promised window has not elapsed
  | 'undeliverable'    // bounced or unsubscribed: never received the request
  | 'responded'        // answered, so no presumption is needed
  | 'never_contacted'  // never asked — nothing to presume from

export const PRESUMPTION_LABEL: Record<PresumptionStatus, string> = {
  presumed:        'Presumed not registered under the MSMED Act, 2006',
  window_open:     'Reply window still open',
  undeliverable:   'Could not be delivered — request not received',
  responded:       'Responded',
  never_contacted: 'Never contacted',
}

export interface PresumptionInput {
  vendorName:  string
  vendorEmail: string
  /** The declaration status for the period in question. */
  status:      'pending' | 'emailed' | 'submitted' | 'not_msme'
  /** Did the address bounce, or did the vendor unsubscribe? */
  emailBounced: boolean
  /** Every send date for THIS period, ISO. Order does not matter. */
  emailDates:  string[]
  /** The org's today, YYYY-MM-DD. */
  today:       string
}

export interface PresumptionEntry {
  vendorName:  string
  vendorEmail: string
  status:      PresumptionStatus
  /** Send dates for the period, oldest first. */
  emailDates:  string[]
  /** First request date, YYYY-MM-DD, or null if never contacted. */
  firstEmailOn: string | null
  /** Last request date, YYYY-MM-DD, or null. */
  lastEmailOn:  string | null
  /** Date the promised window closes, YYYY-MM-DD, or null. */
  windowClosesOn: string | null
  /** Days still to run on the window; 0 once it has closed. */
  daysRemaining: number
}

/** Shift an ISO date by N days in UTC. Local time would move the result by a
 *  day depending on where the host sits. */
function shiftDays(iso: string, delta: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return iso
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00Z`).getTime()
  const b = new Date(`${to}T00:00:00Z`).getTime()
  if (Number.isNaN(a) || Number.isNaN(b)) return 0
  return Math.round((b - a) / 86400_000)
}

/**
 * Classify one vendor.
 *
 * The order of the checks is the argument the pack has to make, in sequence:
 * they answered, or we could not reach them, or we never asked, or we asked
 * and waited the promised time. Only the last of those is a presumption.
 */
export function classifyPresumption(o: PresumptionInput): PresumptionEntry {
  const dates = [...new Set(
    o.emailDates
      .filter(Boolean)
      .map(d => d.slice(0, 10))
      .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)),
  )].sort()

  const firstEmailOn = dates[0] ?? null
  const lastEmailOn  = dates.length ? dates[dates.length - 1] : null
  // The window runs from the FIRST request, which is the one that carried the
  // 15-day notice. Measuring from the last would restart the clock on every
  // follow-up, so a diligently chased vendor would never become presumable.
  const windowClosesOn = firstEmailOn
    ? shiftDays(firstEmailOn, PRESUMPTION_WINDOW_DAYS)
    : null
  const daysRemaining = windowClosesOn
    ? Math.max(0, daysBetween(o.today, windowClosesOn))
    : 0

  const base = { vendorName: o.vendorName, vendorEmail: o.vendorEmail,
                 emailDates: dates, firstEmailOn, lastEmailOn, windowClosesOn, daysRemaining }

  // They answered. Nothing to presume, whichever way they answered.
  if (o.status === 'submitted' || o.status === 'not_msme') {
    return { ...base, status: 'responded' }
  }

  // Never asked — checked before the bounce flag, because a vendor who has
  // never been emailed for this period cannot have bounced for it, and
  // "never contacted" is the more accurate thing to tell the firm.
  if (!firstEmailOn) return { ...base, status: 'never_contacted' }

  // The request did not arrive, so the 15-day notice was never received.
  if (o.emailBounced) return { ...base, status: 'undeliverable' }

  // Asked, and the promised window has not closed yet.
  if (daysRemaining > 0) return { ...base, status: 'window_open' }

  return { ...base, status: 'presumed' }
}

export interface PresumptionPack {
  presumed:       PresumptionEntry[]
  windowOpen:     PresumptionEntry[]
  undeliverable:  PresumptionEntry[]
  responded:      PresumptionEntry[]
  neverContacted: PresumptionEntry[]
}

/**
 * Build the whole pack, grouped.
 *
 * Every vendor lands in exactly one group, and the groups the presumption does
 * NOT cover are returned too — a firm needs to see that 12 vendors were never
 * contacted at all, not have them quietly dropped from a document whose whole
 * purpose is completeness.
 */
export function buildPresumptionPack(vendors: PresumptionInput[]): PresumptionPack {
  const pack: PresumptionPack = {
    presumed: [], windowOpen: [], undeliverable: [], responded: [], neverContacted: [],
  }
  const bucket: Record<PresumptionStatus, keyof PresumptionPack> = {
    presumed: 'presumed', window_open: 'windowOpen', undeliverable: 'undeliverable',
    responded: 'responded', never_contacted: 'neverContacted',
  }
  for (const v of vendors) {
    const entry = classifyPresumption(v)
    pack[bucket[entry.status]].push(entry)
  }
  // Alphabetical within each group: the pack is read as a list, and a stable
  // order makes two exports of the same period comparable.
  for (const key of Object.keys(pack) as (keyof PresumptionPack)[]) {
    pack[key].sort((a, b) => a.vendorName.localeCompare(b.vendorName))
  }
  return pack
}
