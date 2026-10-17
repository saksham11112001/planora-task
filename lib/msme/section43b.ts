/**
 * Section 43B(h) exposure, and MSMED section 16 interest.
 *
 * WHAT THE LAW SAYS
 * -----------------
 * Section 43B(h) of the Income-tax Act (inserted by the Finance Act 2023,
 * effective AY 2024-25) denies a deduction for any sum payable to a MICRO or
 * SMALL enterprise beyond the time limit in section 15 of the MSMED Act, 2006.
 * The deduction is instead allowed only in the year the sum is actually paid.
 *
 * Section 15 MSMED: the buyer must pay by the date agreed IN WRITING, and in
 * no case later than 45 days from acceptance. With no written agreement the
 * limit is 15 days.
 *
 * Section 16 MSMED: where the buyer is late, interest runs from the appointed
 * day at THREE TIMES the bank rate notified by the RBI, compounded monthly.
 *
 * WHAT THIS MODULE DELIBERATELY DOES NOT DECIDE
 * ---------------------------------------------
 * Three judgement calls are surfaced as flags rather than silently resolved,
 * because each is a position a firm takes, not arithmetic:
 *
 *   MEDIUM enterprises are outside 43B(h) entirely. That one IS certain, and
 *   is applied — a medium supplier produces no disallowance.
 *
 *   TRADERS. Udyam registration is open to traders, but it was clarified that
 *   it is for priority-sector lending only, so 43B(h) is widely read as not
 *   covering goods bought from a trader. Widely read is not settled, so a
 *   trader's invoices are computed and reported SEPARATELY under
 *   `traderExposure` instead of being folded into the headline number or
 *   dropped. The firm decides which total to use.
 *
 *   The BANK RATE changes. It is a required input with no default hidden in
 *   the arithmetic, so nobody can file a figure computed from a stale rate
 *   without having passed it in.
 *
 * Everything here is pure: no clock, no database, no rate lookup.
 */

/** Section 15 limit where there is no written agreement. */
export const DEFAULT_PAYMENT_DAYS = 15
/** Section 15 outer limit, which no agreement can extend. */
export const MAX_AGREED_PAYMENT_DAYS = 45
/** Section 16 multiplier applied to the RBI bank rate. */
export const MSMED_INTEREST_MULTIPLE = 3

export type Category = 'micro' | 'small' | 'medium' | null
export type Nature   = 'manufacturer' | 'service_provider' | 'trader' | null

/** Why an invoice produced no 43B(h) exposure. */
export type ExemptReason =
  | 'medium_enterprise'   // outside 43B(h) by statute
  | 'not_msme'            // the supplier is not a registered MSME
  | 'unknown_status'      // the supplier never told us — cannot be assessed
  | 'within_time_limit'   // paid, or still payable, inside the section 15 window

export interface InvoiceInput {
  id?:           string
  invoiceNo?:    string | null
  /** Invoice date, YYYY-MM-DD. The section 15 clock runs from acceptance;
   *  the invoice date is the proxy a ledger actually carries. */
  invoiceDate:   string
  amount:        number
  paidAmount?:   number
  /** Date settled IN FULL, YYYY-MM-DD, or null while anything is outstanding. */
  paymentDate?:  string | null
  /** Days agreed in writing. Null means no agreement → 15 days. Values above
   *  the statutory 45 are clamped, because an agreement cannot extend it. */
  agreementDays?: number | null
}

export interface VendorInput {
  vendorId:    string
  vendorName:  string
  category:    Category
  nature:      Nature
  /** True when the vendor declared they are NOT an MSME. */
  isNotMsme?:  boolean
  invoices:    InvoiceInput[]
}

export interface InvoiceExposure {
  invoiceNo:    string | null
  invoiceDate:  string
  amount:       number
  /** Still unpaid, i.e. amount - paidAmount. */
  outstanding:  number
  /** Section 15 limit that applied: 15, or the agreed days up to 45. */
  allowedDays:  number
  /** Last date payment could be made without breaching section 15. */
  dueBy:        string
  /** Days actually taken, or days elapsed so far when still unpaid. */
  daysTaken:    number
  /** Days beyond the section 15 limit; 0 when inside it. */
  daysLate:     number
  breached:     boolean
  /** Amount whose deduction 43B(h) defers. Zero unless breached. */
  disallowed:   number
  /** Section 16 interest to the assessment date, compounded monthly. */
  interest:     number
  exemptReason: ExemptReason | null
}

export interface VendorExposure {
  vendorId:    string
  vendorName:  string
  category:    Category
  nature:      Nature
  /** True when this vendor's figures are reported separately — see the note
   *  on traders above. */
  isTrader:    boolean
  invoices:    InvoiceExposure[]
  totalOutstanding: number
  totalDisallowed:  number
  totalInterest:    number
  breachedCount:    number
}

export interface ExposureSummary {
  /** Micro and small, non-trader: the headline 43B(h) figure. */
  disallowed:     number
  interest:       number
  outstanding:    number
  breachedCount:  number
  vendorCount:    number
  /** Micro and small TRADERS, reported apart because their coverage is a
   *  position rather than settled law. */
  traderExposure: { disallowed: number; interest: number; vendorCount: number }
  /** Vendors whose status is unknown, so no assessment is possible. Chasing
   *  these is the cheapest way to shrink the unquantified risk. */
  unknownStatus:  { outstanding: number; vendorCount: number }
  vendors:        VendorExposure[]
}

function shiftDays(iso: string, delta: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return iso
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
}

function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00Z`).getTime()
  const b = new Date(`${to}T00:00:00Z`).getTime()
  if (Number.isNaN(a) || Number.isNaN(b)) return 0
  return Math.round((b - a) / 86400_000)
}

/** Round to paise. Money compared or summed as raw floats drifts, and a
 *  disallowance figure goes in a tax computation. */
function money(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * The section 15 limit for one invoice.
 *
 * An agreement is honoured only up to the statutory 45 days; beyond that the
 * cap applies, so a 90-day contract does not buy 90 days. A missing or
 * nonsensical value falls back to the no-agreement limit of 15 rather than to
 * the most generous reading.
 */
export function allowedDaysFor(agreementDays?: number | null): number {
  if (agreementDays == null || !Number.isFinite(agreementDays) || agreementDays < 0) {
    return DEFAULT_PAYMENT_DAYS
  }
  return Math.min(Math.trunc(agreementDays), MAX_AGREED_PAYMENT_DAYS)
}

/**
 * Section 16 interest: three times the bank rate, compounded MONTHLY.
 *
 * Compounded monthly, not daily or annually — the section says so, and the
 * difference over a year at 19.5% is material enough to be challenged. Part
 * months are accrued pro-rata on the final period rather than rounded up to a
 * whole month, which would overstate the liability.
 */
export function msmedInterest(
  principal: number, daysLate: number, bankRatePercent: number,
): number {
  if (principal <= 0 || daysLate <= 0 || bankRatePercent <= 0) return 0
  const annual  = (bankRatePercent * MSMED_INTEREST_MULTIPLE) / 100
  const monthly = annual / 12
  const months  = daysLate / 30.4375        // mean month length
  return money(principal * (Math.pow(1 + monthly, months) - 1))
}

/** Is this supplier inside 43B(h) at all? */
function exemptionFor(v: VendorInput): ExemptReason | null {
  if (v.isNotMsme) return 'not_msme'
  // Medium enterprises are outside 43B(h) by statute — the section names
  // micro and small only.
  if (v.category === 'medium') return 'medium_enterprise'
  if (v.category !== 'micro' && v.category !== 'small') return 'unknown_status'
  return null
}

/**
 * Assess one vendor's invoices.
 *
 * `asOn` is the date the assessment is made: for an unpaid invoice the clock
 * runs to that date, so the same ledger assessed a month later shows more
 * interest, as it should.
 */
export function assessVendor(
  v: VendorInput, asOn: string, bankRatePercent: number,
): VendorExposure {
  const exemption = exemptionFor(v)
  const isTrader  = v.nature === 'trader'

  const invoices: InvoiceExposure[] = v.invoices.map(inv => {
    const paid = Math.max(0, inv.paidAmount ?? 0)
    // Outstanding AS AT THE ASSESSMENT DATE, from the same helper that derives
    // a period-end balance — so the two cannot disagree. Computing it as
    // `amount - paid` instead counted an invoice dated after the assessment
    // date as outstanding, which both overstated the total and contradicted
    // outstandingAsOn() on the identical ledger.
    const outstanding = outstandingOn(inv, asOn)
    const allowedDays = allowedDaysFor(inv.agreementDays)
    const dueBy       = shiftDays(inv.invoiceDate, allowedDays)

    // For a settled invoice the clock stops on the payment date. For one still
    // outstanding it runs to the assessment date — a liability that is still
    // growing must not look frozen.
    const endDate   = inv.paymentDate ?? asOn
    const daysTaken = Math.max(0, daysBetween(inv.invoiceDate, endDate))
    const daysLate  = Math.max(0, daysBetween(dueBy, endDate))

    if (exemption) {
      return {
        invoiceNo: inv.invoiceNo ?? null, invoiceDate: inv.invoiceDate,
        amount: money(inv.amount), outstanding, allowedDays, dueBy,
        daysTaken, daysLate: 0, breached: false,
        disallowed: 0, interest: 0, exemptReason: exemption,
      }
    }

    const breached = daysLate > 0
    // 43B(h) defers the deduction for the sum PAYABLE beyond the limit. Once an
    // invoice is settled the sum is no longer payable, so the disallowance
    // attaches to what is still outstanding — a late-but-paid invoice carries
    // section 16 interest but no disallowance in the year of accrual.
    const disallowed = breached ? outstanding : 0
    // What section 16 interest runs on.
    //
    // A SETTLED invoice accrued interest on its full amount up to the day it
    // was paid — nothing was outstanding afterwards, but the whole sum was
    // late until then. An invoice still open accrues on what is still unpaid.
    //
    // Written plainly: the previous form was
    //   `Math.max(0, amount - paid) || amount`
    // which relied on 0 being falsy to fall back to the full amount, and
    // quietly did something different for the inconsistent case of a payment
    // date with a part-paid figure.
    const interestOn = inv.paymentDate ? money(inv.amount) : outstanding

    return {
      invoiceNo: inv.invoiceNo ?? null, invoiceDate: inv.invoiceDate,
      amount: money(inv.amount), outstanding, allowedDays, dueBy,
      daysTaken, daysLate, breached,
      disallowed,
      interest: breached ? msmedInterest(interestOn, daysLate, bankRatePercent) : 0,
      exemptReason: breached ? null : 'within_time_limit',
    }
  })

  return {
    vendorId: v.vendorId, vendorName: v.vendorName,
    category: v.category, nature: v.nature, isTrader,
    invoices,
    totalOutstanding: money(invoices.reduce((s, i) => s + i.outstanding, 0)),
    totalDisallowed:  money(invoices.reduce((s, i) => s + i.disallowed, 0)),
    totalInterest:    money(invoices.reduce((s, i) => s + i.interest, 0)),
    breachedCount:    invoices.filter(i => i.breached).length,
  }
}

/**
 * Assess a whole book.
 *
 * The headline figure covers micro and small non-traders only. Traders and
 * unknown-status vendors are totalled separately so the number a firm puts in
 * a computation is the one it actually means to defend.
 */
export function assessExposure(
  vendors: VendorInput[], asOn: string, bankRatePercent: number,
): ExposureSummary {
  const assessed = vendors.map(v => assessVendor(v, asOn, bankRatePercent))

  const summary: ExposureSummary = {
    disallowed: 0, interest: 0, outstanding: 0, breachedCount: 0, vendorCount: 0,
    traderExposure: { disallowed: 0, interest: 0, vendorCount: 0 },
    unknownStatus:  { outstanding: 0, vendorCount: 0 },
    vendors: assessed,
  }

  for (const v of assessed) {
    const unknown = v.invoices.some(i => i.exemptReason === 'unknown_status')
    if (unknown) {
      summary.unknownStatus.outstanding += v.totalOutstanding
      summary.unknownStatus.vendorCount++
      continue
    }
    if (v.totalDisallowed === 0 && v.totalInterest === 0) continue

    if (v.isTrader) {
      summary.traderExposure.disallowed += v.totalDisallowed
      summary.traderExposure.interest   += v.totalInterest
      summary.traderExposure.vendorCount++
    } else {
      summary.disallowed    += v.totalDisallowed
      summary.interest      += v.totalInterest
      summary.outstanding   += v.totalOutstanding
      summary.breachedCount += v.breachedCount
      summary.vendorCount++
    }
  }

  summary.disallowed  = money(summary.disallowed)
  summary.interest    = money(summary.interest)
  summary.outstanding = money(summary.outstanding)
  summary.traderExposure.disallowed = money(summary.traderExposure.disallowed)
  summary.traderExposure.interest   = money(summary.traderExposure.interest)
  summary.unknownStatus.outstanding = money(summary.unknownStatus.outstanding)
  return summary
}

/**
 * How much of one invoice was outstanding as on a date.
 *
 * The subtlety is that `paidAmount` is a RUNNING total with no date of its
 * own — the ledger records how much has been settled, not when each receipt
 * arrived. Only `paymentDate`, the full-settlement date, is dated. So:
 *
 *   settled on or before the date   → nothing was outstanding
 *   settled AFTER the date          → the FULL amount was outstanding, because
 *                                     paidAmount belongs to that later
 *                                     settlement. Subtracting it is what makes
 *                                     a historic balance read as zero today
 *                                     just because the invoice has since been
 *                                     paid — the error this guards against.
 *   not settled at all              → amount less paidAmount, the best the
 *                                     data supports. Exact for an assessment
 *                                     made now; a part payment received after
 *                                     a past `asOn` would understate that past
 *                                     balance, which is the one case the
 *                                     ledger cannot distinguish.
 */
function outstandingOn(inv: InvoiceInput, asOn: string): number {
  if (inv.invoiceDate > asOn) return 0
  if (inv.paymentDate) {
    return inv.paymentDate <= asOn ? 0 : Math.max(0, inv.amount)
  }
  return Math.max(0, inv.amount - Math.max(0, inv.paidAmount ?? 0))
}

/**
 * Outstanding as on a date, derived from the ledger.
 *
 * This is what replaces asking the vendor for a closing balance — and it can
 * answer for any date, so one import serves every reporting period.
 */
export function outstandingAsOn(invoices: InvoiceInput[], asOn: string): number {
  let total = 0
  for (const inv of invoices) total += outstandingOn(inv, asOn)
  return money(total)
}

/**
 * Date from which the balance has been outstanding — the oldest invoice still
 * unsettled as on the date. Form MSME-1 asks for exactly this, per supplier.
 */
export function dueFromDate(invoices: InvoiceInput[], asOn: string): string | null {
  let oldest: string | null = null
  for (const inv of invoices) {
    if (outstandingOn(inv, asOn) <= 0) continue
    if (!oldest || inv.invoiceDate < oldest) oldest = inv.invoiceDate
  }
  return oldest
}
