/**
 * Matching a creditors ledger to tracked vendors.
 *
 * WHY
 * ---
 * The hardest question on the vendor form is the outstanding balance: the
 * vendor has to look it up, and whatever they say is their view of the ledger,
 * not the buyer's. Meanwhile the buyer already HAS the number — it is sitting
 * in Tally or Busy as a creditors balance. Importing it turns the vendor's job
 * from "find and state a figure" into "confirm a figure", which is the single
 * biggest thing that moves response rates.
 *
 * The work is matching ledger party names to tracked vendors. Accounting
 * ledgers are written by humans over years: "Acme Steel Co. (P) Ltd",
 * "ACME STEEL", "Acme Steel Co Pvt Ltd - Mumbai" are all one supplier.
 *
 * HOW IT MATCHES, AND WHAT IT REFUSES TO GUESS
 * --------------------------------------------
 * In order of confidence:
 *   1. GSTIN — a 15-character legal identifier. Exact, so it is tried first.
 *   2. Normalised name — case, punctuation, and the company-suffix noise that
 *      carries no identity ("pvt", "ltd", "private limited", "& co") removed.
 *   3. Nothing. An AMBIGUOUS name — one that normalises to the same thing as
 *      two different tracked vendors — is reported as ambiguous and left for a
 *      human. Picking one would silently attach a balance, and therefore a
 *      statutory declaration, to the wrong supplier.
 *
 * Fuzzy/edit-distance matching is deliberately NOT used. It would turn a
 * confident "no match, please check" into a plausible wrong answer, and the
 * cost of a wrong match here is a misfiled return.
 *
 * Pure: no database, no clock.
 */

/** Company-form noise that carries no identity. Longest first, so "private
 *  limited" is removed before "limited" can match part of it. */
const SUFFIX_NOISE = [
  'private limited', 'public limited', 'pvt limited', 'pvt ltd', 'private ltd',
  'limited', 'ltd', 'llp', 'pvt', 'incorporated', 'inc', 'corporation', 'corp',
  'company', 'and company', '& company', 'and co', '& co', 'co',
  'enterprises', 'enterprise', 'industries', 'industry',
]

/**
 * Reduce a party name to its identifying core.
 *
 * Lowercased, accents and punctuation stripped, company forms removed, runs of
 * whitespace collapsed. "Acme Steel Co. (P) Ltd." and "ACME  STEEL" both
 * become "acme steel".
 */
export function normaliseName(raw: string): string {
  let s = (raw ?? '')
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')  // drop accents
    // "(P)" is a very common Indian ledger shorthand for Private.
    .replace(/\(\s*p\s*\)/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')                        // punctuation → space
    .replace(/\s+/g, ' ')
    .trim()

  // Strip trailing company forms repeatedly: "steel co pvt ltd" sheds three.
  let changed = true
  while (changed) {
    changed = false
    for (const suffix of SUFFIX_NOISE) {
      if (s === suffix) break                            // never empty the name
      if (s.endsWith(` ${suffix}`)) {
        s = s.slice(0, -(suffix.length + 1)).trim()
        changed = true
        break
      }
    }
  }
  return s
}

/** GSTIN reduced to a comparable form. Not validated — a ledger may hold a
 *  malformed one, and that is the firm's data to fix, not a reason to drop
 *  the row. */
export function normaliseGstin(raw?: string | null): string {
  return (raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/** A vendor already tracked in the module. */
export interface VendorRef {
  id:          string
  vendorName:  string
  gstin?:      string | null
}

/** One row of an imported creditors ledger. */
export interface LedgerRow {
  /** 1-based row number in the uploaded file, for the error report. */
  rowNo:        number
  partyName:    string
  gstin?:       string | null
  invoiceNo?:   string | null
  /** YYYY-MM-DD. */
  invoiceDate?: string | null
  amount?:      number | null
  paidAmount?:  number | null
  paymentDate?: string | null
  agreementDays?: number | null
}

export type MatchBy = 'gstin' | 'name'

export type SkipReason =
  | 'no_party_name'
  | 'no_match'
  | 'ambiguous_name'
  | 'invalid_date'
  | 'invalid_amount'

export interface MatchedRow {
  rowNo:       number
  vendorId:    string
  vendorName:  string
  matchedBy:   MatchBy
  invoiceNo:   string | null
  invoiceDate: string
  amount:      number
  paidAmount:  number
  paymentDate: string | null
  agreementDays: number | null
}

export interface SkippedRow {
  rowNo:     number
  partyName: string
  reason:    SkipReason
  /** For an ambiguous name, the candidates a human must choose between. */
  candidates?: string[]
}

export interface LedgerMatchResult {
  matched: MatchedRow[]
  skipped: SkippedRow[]
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Coerce a spreadsheet cell to a number, or null.
 *
 * Number(null) is 0 and Number('') is 0, which is the trap this exists to
 * close. Left to plain coercion, a ledger row with a blank amount imported as
 * a zero-rupee invoice, and a blank agreement column became "0 days agreed" —
 * a stricter limit than the statutory 15, so an invoice paid promptly would be
 * computed as a section 15 breach.
 */
function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'string' && v.trim() === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function isRealDate(s: string): boolean {
  if (!ISO_DATE.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  // Round-trip guards against 2026-02-31, which Date happily rolls forward.
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

/**
 * Match ledger rows to vendors.
 *
 * Every row comes back in exactly one list, with a reason when it was not
 * matched — a silent drop in a financial import is how a balance goes missing
 * from a return without anyone noticing.
 */
export function matchLedger(rows: LedgerRow[], vendors: VendorRef[]): LedgerMatchResult {
  const byGstin = new Map<string, VendorRef>()
  for (const v of vendors) {
    const g = normaliseGstin(v.gstin)
    if (g) byGstin.set(g, v)
  }

  // Normalised name → every vendor that reduces to it. A name shared by two
  // vendors is not usable as an identifier, which is what makes a row
  // ambiguous rather than matched.
  const byName = new Map<string, VendorRef[]>()
  for (const v of vendors) {
    const n = normaliseName(v.vendorName)
    if (!n) continue
    byName.set(n, [...(byName.get(n) ?? []), v])
  }

  const result: LedgerMatchResult = { matched: [], skipped: [] }

  for (const row of rows) {
    const partyName = (row.partyName ?? '').trim()
    if (!partyName && !normaliseGstin(row.gstin)) {
      result.skipped.push({ rowNo: row.rowNo, partyName, reason: 'no_party_name' })
      continue
    }

    let vendor: VendorRef | undefined
    let matchedBy: MatchBy = 'gstin'

    const g = normaliseGstin(row.gstin)
    if (g) vendor = byGstin.get(g)

    if (!vendor) {
      const candidates = byName.get(normaliseName(partyName)) ?? []
      if (candidates.length === 1) {
        vendor = candidates[0]
        matchedBy = 'name'
      } else if (candidates.length > 1) {
        // Two tracked vendors share this name. Choosing one would attach a
        // statutory declaration to the wrong supplier.
        result.skipped.push({
          rowNo: row.rowNo, partyName, reason: 'ambiguous_name',
          candidates: candidates.map(c => c.vendorName),
        })
        continue
      }
    }

    if (!vendor) {
      result.skipped.push({ rowNo: row.rowNo, partyName, reason: 'no_match' })
      continue
    }

    const invoiceDate = (row.invoiceDate ?? '').trim()
    if (!isRealDate(invoiceDate)) {
      result.skipped.push({ rowNo: row.rowNo, partyName, reason: 'invalid_date' })
      continue
    }
    const paymentDate = (row.paymentDate ?? '').trim()
    if (paymentDate && !isRealDate(paymentDate)) {
      result.skipped.push({ rowNo: row.rowNo, partyName, reason: 'invalid_date' })
      continue
    }

    const amount = numOrNull(row.amount)
    if (amount === null || amount < 0) {
      result.skipped.push({ rowNo: row.rowNo, partyName, reason: 'invalid_amount' })
      continue
    }
    // Clamped to the invoice: a ledger that shows more settled than billed is
    // a data error, and carrying it through would produce a negative balance.
    const paidAmount = Math.min(Math.max(0, numOrNull(row.paidAmount) ?? 0), amount)

    // Null means NO written agreement, which section 15 reads as 15 days. It
    // must stay null rather than becoming 0, which would read as "due the same
    // day" and manufacture breaches.
    const agreed = numOrNull(row.agreementDays)

    result.matched.push({
      rowNo: row.rowNo,
      vendorId: vendor.id, vendorName: vendor.vendorName, matchedBy,
      invoiceNo: (row.invoiceNo ?? '').toString().trim() || null,
      invoiceDate, amount, paidAmount,
      paymentDate: paymentDate || null,
      agreementDays: agreed !== null && agreed >= 0 ? Math.trunc(agreed) : null,
    })
  }

  return result
}

export const SKIP_REASON_TEXT: Record<SkipReason, string> = {
  no_party_name:  'No party name or GSTIN in this row',
  no_match:       'No tracked vendor matches this party — add the vendor first',
  ambiguous_name: 'More than one tracked vendor has this name — assign it by hand',
  invalid_date:   'Invoice or payment date is missing or not a real date',
  invalid_amount: 'Amount is missing or not a non-negative number',
}
