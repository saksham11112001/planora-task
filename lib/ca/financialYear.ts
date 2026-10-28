/**
 * The Indian financial year.
 *
 * WHY THIS EXISTS
 * ---------------
 * `'2026-27'` was hardcoded as the default financial year in ten places — two
 * view components, four API routes, the FY dropdown's option list and the
 * import paths. Correct while written, and silently wrong from 1 April 2027
 * onwards: the compliance calendar, Client Setup and the master-task API would
 * all have defaulted to the PREVIOUS year's calendar. A firm would have opened
 * Compliance in April, seen last year's dates, and had no reason to suspect
 * the year selector rather than their own data.
 *
 * India's financial year runs 1 April to 31 March, which is what every date in
 * the compliance catalogue assumes.
 *
 * Pure: `today` is passed in, defaulting to the clock only at the edge.
 */

/** Label for the financial year containing a date, e.g. '2026-27'. */
export function financialYearOf(today: string): string {
  // Shape-checked before parsing, NOT coerced. Number('') is 0, not NaN, so
  // slicing an empty string and trusting Number.isFinite produced a confident
  // '-1-00' for empty input. The same coercion trap has appeared three times
  // in this codebase; a regex is the only reading that cannot be fooled.
  if (typeof today !== 'string' || !/^\d{4}-\d{2}/.test(today)) return ''
  const year  = Number(today.slice(0, 4))
  const month = Number(today.slice(5, 7))
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return ''
  // Jan, Feb and Mar belong to the financial year that began the previous
  // April — the off-by-one this function exists to stop people rewriting.
  const start = month >= 4 ? year : year - 1
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`
}

/** Is this a well-formed financial-year label with consecutive halves? */
export function isValidFinancialYear(fy: unknown): fy is string {
  if (typeof fy !== 'string') return false
  const m = /^(\d{4})-(\d{2})$/.exec(fy.trim())
  if (!m) return false
  // '2026-28' is a typo, not a range.
  return m[2] === String((Number(m[1]) + 1) % 100).padStart(2, '0')
}

/** The financial year before this one. */
export function previousFinancialYear(fy: string): string {
  if (!isValidFinancialYear(fy)) return fy
  const start = Number(fy.slice(0, 4)) - 1
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`
}

/** The financial year after this one. */
export function nextFinancialYear(fy: string): string {
  if (!isValidFinancialYear(fy)) return fy
  const start = Number(fy.slice(0, 4)) + 1
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`
}

/**
 * The years to offer in a selector: last year, this year, next year.
 *
 * Derived rather than listed. The hardcoded `['2025-26','2026-27','2027-28']`
 * would have stopped offering the current year in April 2028 — the dropdown
 * simply would not have contained the year the firm was working in.
 */
export function financialYearOptions(today: string): string[] {
  const current = financialYearOf(today)
  if (!current) return []
  return [previousFinancialYear(current), current, nextFinancialYear(current)]
}

/**
 * Re-date a master task's `dates` map onto a given financial year.
 *
 * WHY THIS EXISTS
 * ---------------
 * The default catalogue in lib/data/caDefaultTasks.ts stores absolute dates
 * ('2026-10-31'), and "Load defaults" copied them into whichever financial
 * year you asked for, verbatim. Two consequences, both silent:
 *
 *   1. Entries that were never updated carried a stale year. HVAT (Return)
 *      shipped oct:'2025-10-31' on an otherwise FY-2026-27 catalogue. Loaded
 *      into FY 2026-27 it produced a task whose due date was a year in the
 *      past, so the nightly spawner classified it 'too_old' and skipped it --
 *      every night, without an error. The obligation simply never appeared.
 *
 *   2. The whole catalogue goes stale annually. Loading defaults for
 *      FY 2027-28 would have handed every firm FY 2026-27's dates.
 *
 * Rebasing on the way in removes both. The month and day are statutory and are
 * kept exactly; only the year is recomputed from which side of 1 April the
 * month falls on.
 *
 * The DATE's own month decides the year, not the map key. A few catalogue
 * entries file a date under a neighbouring key (IEC renewal sits under 'jun'
 * with a July date), and the statutory day is the thing to preserve.
 */
export function rebaseDatesToFy(
  dates: Record<string, string> | null | undefined,
  fy: string,
): Record<string, string> {
  if (!dates || typeof dates !== 'object') return {}
  // An unparseable year must not silently rewrite every date to NaN. Returning
  // the input unchanged is the only safe failure here: wrong-but-original
  // beats confidently-corrupted.
  if (!isValidFinancialYear(fy)) return { ...dates }
  const startYear = Number(fy.slice(0, 4))

  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(dates)) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      out[key] = value          // leave anything unrecognised exactly as found
      continue
    }
    const month = Number(value.slice(5, 7))
    const day   = Number(value.slice(8, 10))
    if (month < 1 || month > 12) { out[key] = value; continue }

    const year = month >= 4 ? startYear : startYear + 1

    // 29 February only exists in a leap year. Rebasing a leap date onto a
    // common year would otherwise produce '2027-02-29', which Postgres rejects
    // outright -- the whole "Load defaults" insert would fail on one date.
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
    const safeDay = month === 2 && day === 29 && !isLeap ? 28 : day

    out[key] = `${year}-${String(month).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`
  }
  return out
}
