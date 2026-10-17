/**
 * Comparing one reporting half-year against the one before it.
 *
 * WHY
 * ---
 * Only possible now that declarations are per period. The first cycle is a
 * data-collection exercise; from the second onwards the interesting questions
 * are all comparative, and they are the ones that make a firm open the module
 * again six months later:
 *
 *   whose balance grew, and by how much
 *   who has newly become an MSME — new exposure under 43B(h)
 *   who answered last time and has gone quiet — the response rate decaying
 *   whose category moved, which can take them in or out of 43B(h) entirely
 *
 * Pure: both periods' declarations are passed in.
 */

export type ChangeKind =
  | 'balance_up'        // declared more outstanding than last period
  | 'balance_down'      // declared less
  | 'newly_msme'        // was not an MSME (or unknown), now is
  | 'newly_not_msme'    // was an MSME, now declares it is not
  | 'category_changed'  // micro ↔ small ↔ medium
  | 'newly_silent'      // answered last period, has not this period
  | 'newly_responded'   // silent last period, answered this one
  | 'first_declaration' // no previous declaration at all

export interface PeriodSide {
  status:             'pending' | 'emailed' | 'submitted' | 'not_msme' | 'none'
  isNotMsme:          boolean
  category:           'micro' | 'small' | 'medium' | null
  outstandingAmount:  number | null
}

export interface CompareInput {
  vendorId:   string
  vendorName: string
  current:    PeriodSide
  /** Null when the vendor has no declaration for the previous period. */
  previous:   PeriodSide | null
}

export interface VendorChange {
  vendorId:    string
  vendorName:  string
  kinds:       ChangeKind[]
  /** Positive when the balance grew. Null when either side is unstated. */
  balanceDelta: number | null
  previousAmount: number | null
  currentAmount:  number | null
  previousCategory: 'micro' | 'small' | 'medium' | null
  currentCategory:  'micro' | 'small' | 'medium' | null
}

/** Did this side actually answer? */
function answered(s: PeriodSide): boolean {
  return s.status === 'submitted' || s.status === 'not_msme'
}

/** Is this side an MSME, as far as we know? */
function isMsme(s: PeriodSide): boolean {
  return !s.isNotMsme && (s.category === 'micro' || s.category === 'small' || s.category === 'medium')
}

export function compareVendor(o: CompareInput): VendorChange {
  const kinds: ChangeKind[] = []
  const cur = o.current
  const prev = o.previous

  const currentAmount  = cur.outstandingAmount ?? null
  const previousAmount = prev?.outstandingAmount ?? null
  // Only meaningful when BOTH sides stated a figure. Treating an unstated
  // balance as zero would report a vendor who simply has not answered yet as
  // having cleared their balance.
  const balanceDelta = currentAmount !== null && previousAmount !== null
    ? Math.round((currentAmount - previousAmount) * 100) / 100
    : null

  if (!prev || prev.status === 'none') {
    kinds.push('first_declaration')
  } else {
    if (answered(prev) && !answered(cur)) kinds.push('newly_silent')
    if (!answered(prev) && answered(cur)) kinds.push('newly_responded')

    // Status changes are only claimed when BOTH sides answered. A vendor who
    // has not replied yet this period has not "become" anything.
    if (answered(prev) && answered(cur)) {
      if (!isMsme(prev) && isMsme(cur))  kinds.push('newly_msme')
      if (isMsme(prev)  && !isMsme(cur)) kinds.push('newly_not_msme')
      if (isMsme(prev) && isMsme(cur) && prev.category !== cur.category) {
        kinds.push('category_changed')
      }
    }

    if (balanceDelta !== null && balanceDelta > 0) kinds.push('balance_up')
    if (balanceDelta !== null && balanceDelta < 0) kinds.push('balance_down')
  }

  return {
    vendorId: o.vendorId, vendorName: o.vendorName, kinds,
    balanceDelta, previousAmount, currentAmount,
    previousCategory: prev?.category ?? null,
    currentCategory:  cur.category,
  }
}

export interface PeriodComparison {
  changes: VendorChange[]
  /** Vendors with at least one change worth a firm's attention. */
  notable: VendorChange[]
  totals: {
    previousOutstanding: number
    currentOutstanding:  number
    delta:               number
    newlyMsme:        number
    newlyNotMsme:     number
    newlySilent:      number
    newlyResponded:   number
    categoryChanged:  number
    firstDeclaration: number
  }
}

/** Changes that are worth surfacing rather than merely recording. A balance
 *  moving is normal; the rest are not. */
const NOTABLE: ChangeKind[] = [
  'newly_msme', 'newly_not_msme', 'category_changed', 'newly_silent',
]

export function comparePeriods(vendors: CompareInput[]): PeriodComparison {
  const changes = vendors.map(compareVendor)
  const totals = {
    previousOutstanding: 0, currentOutstanding: 0, delta: 0,
    newlyMsme: 0, newlyNotMsme: 0, newlySilent: 0, newlyResponded: 0,
    categoryChanged: 0, firstDeclaration: 0,
  }
  for (const c of changes) {
    totals.previousOutstanding += c.previousAmount ?? 0
    totals.currentOutstanding  += c.currentAmount  ?? 0
    if (c.kinds.includes('newly_msme'))        totals.newlyMsme++
    if (c.kinds.includes('newly_not_msme'))    totals.newlyNotMsme++
    if (c.kinds.includes('newly_silent'))      totals.newlySilent++
    if (c.kinds.includes('newly_responded'))   totals.newlyResponded++
    if (c.kinds.includes('category_changed'))  totals.categoryChanged++
    if (c.kinds.includes('first_declaration')) totals.firstDeclaration++
  }
  totals.previousOutstanding = Math.round(totals.previousOutstanding * 100) / 100
  totals.currentOutstanding  = Math.round(totals.currentOutstanding * 100) / 100
  totals.delta = Math.round((totals.currentOutstanding - totals.previousOutstanding) * 100) / 100

  const notable = changes
    .filter(c => c.kinds.some(k => NOTABLE.includes(k)))
    .sort((a, b) => a.vendorName.localeCompare(b.vendorName))

  return { changes, notable, totals }
}

export const CHANGE_LABEL: Record<ChangeKind, string> = {
  balance_up:        'Balance increased',
  balance_down:      'Balance reduced',
  newly_msme:        'Newly declared as MSME',
  newly_not_msme:    'Now declares it is not an MSME',
  category_changed:  'MSME category changed',
  newly_silent:      'Responded last period, silent this period',
  newly_responded:   'Responded for the first time',
  first_declaration: 'First declaration',
}
