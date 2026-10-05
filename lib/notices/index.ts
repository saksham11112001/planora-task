/**
 * Shared helpers for the notices module.
 *
 * The one thing to understand before touching this file: client_notices has
 * TWO value conventions living in the same columns.
 *
 * The table's defaults are snake_case ('action_pending', 'income_tax'), but
 * the per-client UI that has been in production writes Title Case
 * ('Action Pending', 'Income Tax'). Neither column has a CHECK constraint, so
 * the database accepted both and real rows exist in both shapes.
 *
 * Rather than migrate live data — a rewrite of a firm's tax-notice history to
 * fix a cosmetic inconsistency is not worth the risk — everything reading
 * these columns normalises first. New writes use the snake_case form.
 */

export const NOTICE_STATUSES = ['action_pending', 'response_filed', 'closed'] as const
export type NoticeStatus = typeof NOTICE_STATUSES[number]

export const NOTICE_STATUS_LABEL: Record<NoticeStatus, string> = {
  action_pending: 'Action pending',
  response_filed: 'Response filed',
  closed:         'Closed',
}

export const NOTICE_PORTALS = ['income_tax', 'gst', 'mca', 'traces', 'epfo', 'other'] as const
export type NoticePortal = typeof NOTICE_PORTALS[number]

export const NOTICE_PORTAL_LABEL: Record<NoticePortal, string> = {
  income_tax: 'Income Tax',
  gst:        'GST',
  mca:        'MCA',
  traces:     'TRACES',
  epfo:       'EPFO',
  other:      'Other',
}

export const NOTICE_SOURCES = ['manual', 'import', 'api'] as const
export type NoticeSource = typeof NOTICE_SOURCES[number]

export interface Notice {
  id:             string
  org_id:         string
  client_id:      string
  title:          string
  notice_type:    string
  portal:         string
  notice_date:    string | null
  response_due:   string | null
  status:         string
  notes:          string | null
  source:         string | null
  external_ref:   string | null
  synced_at:      string | null
  assigned_to:    string | null
  demand_amount:  number | null
  section:        string | null
  created_at:     string
}

/**
 * Fold any stored spelling onto the canonical key.
 *
 *   'Action Pending' -> 'action_pending'
 *   'action_pending' -> 'action_pending'
 *   'Response Filed' -> 'response_filed'
 *
 * Anything unrecognised falls back to 'action_pending': an unknown status is
 * far more likely to be an open notice than a closed one, and treating it as
 * open means it stays visible instead of silently dropping off the list.
 */
export function normaliseStatus(raw: string | null | undefined): NoticeStatus {
  const key = String(raw ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_')
  return (NOTICE_STATUSES as readonly string[]).includes(key)
    ? key as NoticeStatus
    : 'action_pending'
}

/** Same fold for the portal column. Unknown values become 'other'. */
export function normalisePortal(raw: string | null | undefined): NoticePortal {
  const key = String(raw ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_')
  return (NOTICE_PORTALS as readonly string[]).includes(key)
    ? key as NoticePortal
    : 'other'
}

/**
 * Is this notice past its response deadline and still open?
 *
 * `today` is passed in rather than read from the clock so the caller can use
 * the ORG's today — a notice due 'today' is not overdue, and which day that
 * is depends on the firm's timezone.
 */
export function isOverdue(n: Pick<Notice, 'response_due' | 'status'>, today: string): boolean {
  if (!n.response_due) return false
  if (normaliseStatus(n.status) === 'closed') return false
  return n.response_due < today
}

/** Open notices whose deadline is within `days`, inclusive of today. */
export function isDueSoon(
  n: Pick<Notice, 'response_due' | 'status'>, today: string, days = 7,
): boolean {
  if (!n.response_due) return false
  if (normaliseStatus(n.status) === 'closed') return false
  if (n.response_due < today) return false          // overdue is its own bucket
  const limit = new Date(`${today}T00:00:00Z`)
  limit.setUTCDate(limit.getUTCDate() + days)
  return n.response_due <= limit.toISOString().slice(0, 10)
}
