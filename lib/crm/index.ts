/**
 * Shared types and pure helpers for the CRM module (leads + proposals).
 * No Supabase, no fetch — importable from both server routes and client
 * views, and unit-testable without a database.
 */

export const LEAD_STAGES = [
  'new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost',
] as const
export type LeadStage = typeof LEAD_STAGES[number]

export const LEAD_STAGE_LABEL: Record<LeadStage, string> = {
  new:         'New',
  contacted:   'Contacted',
  qualified:   'Qualified',
  proposal:    'Proposal sent',
  negotiation: 'Negotiation',
  won:         'Won',
  lost:        'Lost',
}

/** Stages shown as pipeline columns. 'won' and 'lost' are terminal and get
 *  their own treatment rather than a column each. */
export const PIPELINE_STAGES: LeadStage[] =
  ['new', 'contacted', 'qualified', 'proposal', 'negotiation']

export const TERMINAL_STAGES: LeadStage[] = ['won', 'lost']

export const ACTIVITY_KINDS = ['note', 'call', 'email', 'meeting', 'stage_change', 'proposal'] as const
export type ActivityKind = typeof ACTIVITY_KINDS[number]

export const PROPOSAL_STATUSES = ['draft', 'sent', 'accepted', 'rejected', 'expired'] as const
export type ProposalStatus = typeof PROPOSAL_STATUSES[number]

export interface Lead {
  id:                   string
  org_id:               string
  name:                 string
  company:              string | null
  email:                string | null
  phone:                string | null
  source:               string | null
  stage:                LeadStage
  value:                number | null
  expected_close:       string | null
  owner_id:             string | null
  notes:                string | null
  converted_client_id:  string | null
  converted_at:         string | null
  lost_reason:          string | null
  created_at:           string
}

export interface ProposalItem {
  description: string
  qty:         number
  rate:        number
  amount:      number
}

export interface Proposal {
  id:         string
  org_id:     string
  lead_id:    string | null
  client_id:  string | null
  number:     string
  title:      string
  status:     ProposalStatus
  items:      ProposalItem[]
  subtotal:   number
  tax_rate:   number
  tax_amount: number
  total:      number
  valid_until: string | null
  sent_at:    string | null
  created_at: string
}

/* ── Guards ───────────────────────────────────────────────────────────────── */

export function isLeadStage(v: unknown): v is LeadStage {
  return typeof v === 'string' && (LEAD_STAGES as readonly string[]).includes(v)
}

export function isProposalStatus(v: unknown): v is ProposalStatus {
  return typeof v === 'string' && (PROPOSAL_STATUSES as readonly string[]).includes(v)
}

/* ── Money ────────────────────────────────────────────────────────────────── */

/** Round to 2dp without the floating-point surprise.
 *  Math.round(1.005 * 100) / 100 gives 1 — the epsilon nudge fixes the class
 *  of case where the binary representation sits a hair below the halfway
 *  point. Money is rounded once, here, and never re-rounded downstream. */
export function round2(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/**
 * Normalise and price a set of line items.
 *
 * Returns BOTH the cleaned items (each with its own `amount` recomputed from
 * qty x rate) and the document totals. The caller stores both: a client-sent
 * `amount` is never trusted, and a total is never recomputed on read.
 */
export function priceProposal(
  rawItems: unknown,
  rawTaxRate: unknown,
): { items: ProposalItem[]; subtotal: number; taxRate: number; taxAmount: number; total: number } {
  const list = Array.isArray(rawItems) ? rawItems : []

  const items: ProposalItem[] = list.slice(0, 100).map(raw => {
    const r    = (raw ?? {}) as Record<string, unknown>
    // Negative quantities and rates are rejected rather than clamped to a
    // credit note the UI has no concept of.
    const qty  = Math.max(0, Number(r.qty)  || 0)
    const rate = Math.max(0, Number(r.rate) || 0)
    return {
      description: String(r.description ?? '').slice(0, 300),
      qty:         round2(qty),
      rate:        round2(rate),
      // Always recomputed. Whatever the client sent is ignored.
      amount:      round2(qty * rate),
    }
  }).filter(i => i.description || i.amount > 0)

  const subtotal = round2(items.reduce((s, i) => s + i.amount, 0))

  const taxRateNum = Number(rawTaxRate)
  const taxRate    = Number.isFinite(taxRateNum) ? Math.min(100, Math.max(0, round2(taxRateNum))) : 0

  const taxAmount = round2(subtotal * (taxRate / 100))
  // Summed from the two rounded components, so the printed lines always add
  // up to the printed total.
  const total     = round2(subtotal + taxAmount)

  return { items, subtotal, taxRate, taxAmount, total }
}

/**
 * Weighted pipeline value: each open lead's value multiplied by a
 * stage-based probability. Won counts in full; lost counts nothing.
 *
 * The weights are a convention, not a forecast — stated here so the number
 * on the dashboard is explainable rather than magic.
 */
export const STAGE_WEIGHT: Record<LeadStage, number> = {
  new: 0.1, contacted: 0.2, qualified: 0.4, proposal: 0.6, negotiation: 0.8,
  won: 1, lost: 0,
}

export function weightedPipeline(leads: Pick<Lead, 'stage' | 'value'>[]): number {
  return round2(leads.reduce(
    (sum, l) => sum + (Number(l.value) || 0) * (STAGE_WEIGHT[l.stage] ?? 0),
    0,
  ))
}

/** Open pipeline value: everything not yet won or lost. */
export function openPipeline(leads: Pick<Lead, 'stage' | 'value'>[]): number {
  return round2(leads
    .filter(l => !TERMINAL_STAGES.includes(l.stage))
    .reduce((sum, l) => sum + (Number(l.value) || 0), 0))
}
