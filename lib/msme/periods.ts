/**
 * MSME Form 1 reporting periods.
 *
 * Form MSME-1 is a HALF-YEARLY return under section 405 of the Companies Act.
 * A company reports outstanding dues to MSME suppliers as they stood on the
 * last day of each half-year:
 *
 *   half-year Oct → Mar, "as on" 31 March      — return due 30 April
 *   half-year Apr → Sep, "as on" 30 September  — return due 31 October
 *
 * The module was built around a single declaration per vendor, with the
 * outstanding amount commented as "as on 31st March". That only ever covered
 * one of the two halves, so a firm using it for the September cycle had
 * nowhere to put the second figure and no way to see the two side by side.
 *
 * A period is identified by its "as on" date (period_end), which is
 * unambiguous, sortable, and the thing the statute actually names. Everything
 * else — label, due date, which half-year, what to collect next — is derived
 * from it here, so no caller has to re-derive the calendar.
 *
 * Pure: no clock of its own, no database. `today` is always passed in.
 */

export type HalfYear = 'H1' | 'H2'

export interface MsmePeriod {
  /** "As on" date, YYYY-MM-DD. Either ...-03-31 or ...-09-30. */
  periodEnd:   string
  /** 'H1' = Apr–Sep (as on 30 Sep). 'H2' = Oct–Mar (as on 31 Mar). */
  half:        HalfYear
  /** Indian financial year this half belongs to, e.g. '2026-27'. */
  financialYear: string
  /** First day of the half-year covered. */
  periodStart: string
  /** Statutory filing deadline for the MSME-1 return. */
  dueDate:     string
  /** The "as on" date in words, e.g. '30 Sep 2026'. For emails and forms,
   *  which must name the date a vendor is being asked to report. */
  asOn:        string
  /** The half-year in words without the as-on date, e.g. 'Apr–Sep 2026'. */
  rangeLabel:  string
  /** Full display label, e.g. 'Apr–Sep 2026 (as on 30 Sep 2026)'. */
  label:       string
  /** Compact label for tabs and chips, e.g. 'H1 FY2026-27'. */
  shortLabel:  string
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function fmt(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${Number(d)} ${MONTH_NAMES[Number(m) - 1]} ${y}`
}

/** Is this a valid MSME period-end date? Only 31 Mar and 30 Sep qualify. */
export function isValidPeriodEnd(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-(03-31|09-30)$/.test(v)
}

/**
 * Describe a period from its "as on" date.
 *
 * Throws on an invalid date rather than guessing: a wrong period silently
 * files a declaration against the wrong half-year, which is the kind of
 * error nobody notices until an audit.
 */
export function describePeriod(periodEnd: string): MsmePeriod {
  if (!isValidPeriodEnd(periodEnd)) {
    throw new Error(`Not an MSME period end (expected YYYY-03-31 or YYYY-09-30): ${periodEnd}`)
  }
  const year  = Number(periodEnd.slice(0, 4))
  const isSep = periodEnd.endsWith('09-30')

  if (isSep) {
    // Apr–Sep of the same calendar year. Financial year starts that April.
    const fy = `${year}-${String((year + 1) % 100).padStart(2, '0')}`
    return {
      periodEnd,
      half:          'H1',
      financialYear: fy,
      periodStart:   `${year}-04-01`,
      dueDate:       `${year}-10-31`,
      asOn:          fmt(periodEnd),
      rangeLabel:    `Apr–Sep ${year}`,
      label:         `Apr–Sep ${year} (as on ${fmt(periodEnd)})`,
      shortLabel:    `H1 FY${fy}`,
    }
  }

  // 31 March: the half-year began the previous October, and the financial
  // year began the previous April.
  const fyStart = year - 1
  const fy      = `${fyStart}-${String(year % 100).padStart(2, '0')}`
  return {
    periodEnd,
    half:          'H2',
    financialYear: fy,
    periodStart:   `${fyStart}-10-01`,
    dueDate:       `${year}-04-30`,
    asOn:          fmt(periodEnd),
    rangeLabel:    `Oct ${fyStart}–Mar ${year}`,
    label:         `Oct ${fyStart}–Mar ${year} (as on ${fmt(periodEnd)})`,
    shortLabel:    `H2 FY${fy}`,
  }
}

/** The two periods of one Indian financial year, earliest first. */
export function periodsForFinancialYear(fy: string): MsmePeriod[] {
  const m = /^(\d{4})-(\d{2})$/.exec(fy.trim())
  if (!m) return []
  const start = Number(m[1])
  // Reject '2026-28' and similar: the halves must follow on.
  if (m[2] !== String((start + 1) % 100).padStart(2, '0')) return []
  return [
    describePeriod(`${start}-09-30`),       // H1, Apr–Sep
    describePeriod(`${start + 1}-03-31`),   // H2, Oct–Mar
  ]
}

/**
 * The period a firm can currently collect declarations for: the most recent
 * half-year that has actually closed.
 *
 * Deliberately NOT "the period whose filing deadline comes next". Every figure
 * in a declaration is "as on <period end>". If that date is still in the
 * future the question is unanswerable — on 15 March a vendor cannot state its
 * balance as on 31 March — so defaulting to an unclosed period would open the
 * form on a question nobody can answer.
 *
 * So on 15 November 2026 the current period is 30 September 2026, and it stays
 * current until 31 March 2027 arrives. A firm wanting to pre-stage the next
 * cycle picks it from the period selector; both halves of the year are always
 * listed.
 *
 * ISO dates compare correctly as strings, which is why the rule reads as the
 * rule rather than as month arithmetic.
 */
export function currentPeriod(today: string): MsmePeriod {
  const year = Number(today.slice(0, 4))
  if (today >= `${year}-09-30`) return describePeriod(`${year}-09-30`)
  if (today >= `${year}-03-31`) return describePeriod(`${year}-03-31`)
  // Jan 1 – Mar 30: the last closed half-year ended the previous September.
  return describePeriod(`${year - 1}-09-30`)
}

/** The period before this one. */
export function previousPeriod(periodEnd: string): MsmePeriod {
  const p = describePeriod(periodEnd)
  const year = Number(periodEnd.slice(0, 4))
  return p.half === 'H1'
    ? describePeriod(`${year}-03-31`)        // Sep → the March before it
    : describePeriod(`${year - 1}-09-30`)    // Mar → the September before it
}

/** The period after this one. */
export function nextPeriod(periodEnd: string): MsmePeriod {
  const p = describePeriod(periodEnd)
  const year = Number(periodEnd.slice(0, 4))
  return p.half === 'H1'
    ? describePeriod(`${year + 1}-03-31`)    // Sep → the following March
    : describePeriod(`${year}-09-30`)        // Mar → the September after it
}

/**
 * Fields a returning vendor should NOT have to type again.
 *
 * Identity and registration details do not change between half-years; the
 * outstanding figure is the whole point of the new return. Pre-filling the
 * rest is the difference between a 30-second confirmation and re-keying a
 * form the vendor already filled six months ago — which is what drives
 * response rates down on the second cycle.
 *
 * outstanding_amount and the payment proof are deliberately absent: carrying
 * a stale balance forward would let a vendor confirm a figure that is no
 * longer true without ever looking at it.
 */
export const CARRY_FORWARD_FIELDS = [
  'is_not_msme',
  'udyam_number',
  'pan',
  'udyam_registered_on',
  'msme_category',
  'nature_of_business',
  'cert_url',
] as const

export type CarryForwardField = typeof CARRY_FORWARD_FIELDS[number]
