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
