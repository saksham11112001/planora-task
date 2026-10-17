/**
 * The Form MSME-1 filing schedule.
 *
 * WHAT THE FORM ASKS FOR
 * ----------------------
 * Form MSME-1 is the half-yearly return filed with the Registrar in respect of
 * outstanding payments to MICRO OR SMALL enterprises. Per supplier it wants:
 *
 *   name of the supplier
 *   PAN of the supplier
 *   amount outstanding
 *   the date from which the amount is outstanding
 *   reason for the delay in payment
 *
 * The module already produced an audit log. An audit log is not a return: the
 * firm still had to decide who belonged in it and transpose the columns by
 * hand. This builds the schedule itself.
 *
 * WHO BELONGS IN THE RETURN
 * -------------------------
 * MICRO AND SMALL ONLY. Medium enterprises are outside the return, exactly as
 * they are outside section 43B(h) — so a medium supplier with a large balance
 * is correctly absent, and is reported under `excluded` so its absence is
 * visible rather than looking like an omission.
 *
 * Also excluded: suppliers who declared they are not an MSME, suppliers who
 * never answered (nothing to report, and the presumption pack covers them),
 * and anyone whose balance is nil.
 *
 * Pure: the period's as-on date and the declarations are passed in.
 */

export type ExclusionReason =
  | 'medium_enterprise'  // outside the return by statute
  | 'not_msme'           // declared not registered
  | 'no_declaration'     // never answered — see the presumption pack
  | 'nil_balance'        // nothing outstanding to report

export const EXCLUSION_TEXT: Record<ExclusionReason, string> = {
  medium_enterprise: 'Medium enterprise — outside the scope of Form MSME-1',
  not_msme:          'Declared not registered under the MSMED Act',
  no_declaration:    'No declaration received for this period',
  nil_balance:       'Nil outstanding balance',
}

export interface Form1Input {
  /** Carried through to the row so the UI can address it when filling the
   *  buyer-side fields the form requires. */
  vendorId:     string
  vendorName:   string
  pan:          string | null
  category:     'micro' | 'small' | 'medium' | null
  isNotMsme:    boolean
  status:       'pending' | 'emailed' | 'submitted' | 'not_msme'
  /** Outstanding as on the period end. */
  outstanding:  number | null
  /** Date from which it has been outstanding — derived from the invoice
   *  ledger where one exists, otherwise entered by the firm. */
  dueFromDate:  string | null
  /** The buyer's own stated reason for the delay. */
  delayReason:  string | null
}

export interface Form1Row {
  serial:       number
  vendorId:     string
  vendorName:   string
  pan:          string
  category:     'micro' | 'small'
  outstanding:  number
  dueFromDate:  string
  delayReason:  string
  /** Fields the form requires that are not on file yet. The return cannot be
   *  filed until these are filled, so they are named rather than silently
   *  left blank. */
  missing:      Array<'pan' | 'dueFromDate' | 'delayReason'>
}

export interface Form1Excluded {
  vendorName: string
  reason:     ExclusionReason
  outstanding: number | null
}

export interface Form1Schedule {
  rows:     Form1Row[]
  excluded: Form1Excluded[]
  totalOutstanding: number
  /** Rows that cannot be filed as they stand. */
  incompleteCount:  number
}

/**
 * Build the schedule.
 *
 * Rows are ordered by descending balance: the largest exposures are what a
 * reviewer checks first, and it makes the schedule stable between runs.
 */
export function buildForm1(declarations: Form1Input[]): Form1Schedule {
  const rows: Form1Row[] = []
  const excluded: Form1Excluded[] = []

  for (const d of declarations) {
    if (d.isNotMsme || d.status === 'not_msme') {
      excluded.push({ vendorName: d.vendorName, reason: 'not_msme', outstanding: d.outstanding })
      continue
    }
    if (d.status !== 'submitted') {
      excluded.push({ vendorName: d.vendorName, reason: 'no_declaration', outstanding: d.outstanding })
      continue
    }
    if (d.category === 'medium') {
      excluded.push({ vendorName: d.vendorName, reason: 'medium_enterprise', outstanding: d.outstanding })
      continue
    }
    if (d.category !== 'micro' && d.category !== 'small') {
      // Answered, but without a category. Not reportable, and not the same as
      // never answering.
      excluded.push({ vendorName: d.vendorName, reason: 'no_declaration', outstanding: d.outstanding })
      continue
    }
    const amount = d.outstanding ?? 0
    if (!(amount > 0)) {
      excluded.push({ vendorName: d.vendorName, reason: 'nil_balance', outstanding: d.outstanding })
      continue
    }

    const missing: Form1Row['missing'] = []
    if (!d.pan?.trim())         missing.push('pan')
    if (!d.dueFromDate)         missing.push('dueFromDate')
    if (!d.delayReason?.trim()) missing.push('delayReason')

    rows.push({
      serial: 0,                    // assigned after sorting
      vendorId:    d.vendorId,
      vendorName:  d.vendorName,
      pan:         d.pan?.trim() ?? '',
      category:    d.category,
      outstanding: Math.round(amount * 100) / 100,
      dueFromDate: d.dueFromDate ?? '',
      delayReason: d.delayReason?.trim() ?? '',
      missing,
    })
  }

  rows.sort((a, b) => b.outstanding - a.outstanding || a.vendorName.localeCompare(b.vendorName))
  rows.forEach((r, i) => { r.serial = i + 1 })

  excluded.sort((a, b) => a.vendorName.localeCompare(b.vendorName))

  return {
    rows, excluded,
    totalOutstanding: Math.round(rows.reduce((s, r) => s + r.outstanding, 0) * 100) / 100,
    incompleteCount:  rows.filter(r => r.missing.length > 0).length,
  }
}
