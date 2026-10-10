/**
 * Classify one CA compliance occurrence: should it exist, and does it?
 *
 * WHY THIS EXISTS
 * ---------------
 * A firm asked why "562 of 1110" compliance tasks had not been created. 529
 * of those were dates before the client's own start date — correct behaviour,
 * counted as failures because nothing in the app distinguished the two. The
 * genuinely missing ones were 33.
 *
 * Answering that took a hand-built spreadsheet. This module is the same
 * reasoning, in code, so the app can answer it directly.
 *
 * Pure: no Supabase, no fetch, no clock. `today` is passed in because it must
 * be the ORG's today — reading the server clock marks Indian work overdue
 * from 6:30pm the previous day.
 */

/**
 * Shift an ISO date by N days, in UTC.
 *
 * Implemented here rather than imported so this module stays dependency-free
 * and can be unit-tested directly. UTC throughout: using local time would
 * shift the result by a day on a host east or west of the date line.
 */
function shiftDays(iso: string, delta: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return iso
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
}

export type OccurrenceStatus =
  | 'present'            // the task exists — nothing to do
  | 'before_start'       // earlier than the client's start date: correctly skipped
  | 'after_end'          // later than the client's end date: correctly skipped
  | 'not_due_yet'        // its trigger date has not arrived: correctly waiting
  | 'missed'             // it should exist and does not — the only real problem

/** The statuses that are working as intended, i.e. NOT a problem. */
export const BENIGN_STATUSES: OccurrenceStatus[] =
  ['present', 'before_start', 'after_end', 'not_due_yet']

export const STATUS_LABEL: Record<OccurrenceStatus, string> = {
  present:      'Created',
  before_start: 'Before client start date',
  after_end:    'After client end date',
  not_due_yet:  'Not due to trigger yet',
  missed:       'Missing',
}

export interface OccurrenceInput {
  /** Due date of this occurrence, YYYY-MM-DD. */
  dueDate:       string
  /** Client start date, YYYY-MM-DD. Occurrences before it are never created. */
  startDate:     string
  /** Client end date, YYYY-MM-DD, or null for open-ended. */
  endDate:       string | null
  /** How many days before the due date the task is created. */
  daysBeforeDue: number
  /** Does a task or spawn record already exist for this occurrence? */
  exists:        boolean
  /** The org's today, YYYY-MM-DD. */
  today:         string
}

/**
 * The order of these checks matters and mirrors the spawner.
 *
 * `exists` is tested FIRST: a task that is already there is never a problem,
 * whatever the dates say. Testing it last would report a task created before
 * someone later set a start date as "before_start", which reads as an
 * explanation for an absence that is not absent.
 */
export function classifyOccurrence(o: OccurrenceInput): OccurrenceStatus {
  if (o.exists) return 'present'
  if (o.dueDate < o.startDate) return 'before_start'
  if (o.endDate && o.dueDate > o.endDate) return 'after_end'

  // The task is created `daysBeforeDue` ahead of the due date. Until that
  // moment arrives, its absence is expected.
  const triggerDate = shiftDays(o.dueDate, -Math.max(0, o.daysBeforeDue || 0))
  if (triggerDate > o.today) return 'not_due_yet'

  return 'missed'
}

/**
 * How long after a due date the nightly job will still create a missed task.
 *
 * The job used to skip any date already in the past, so a single failed or
 * capped run lost that date permanently — nothing ever went back for it, and
 * the only remedy was an admin noticing and pressing "Spawn tasks now".
 *
 * Seven days is chosen to cover a long weekend plus a working week, which is
 * the realistic gap before someone notices. It is deliberately NOT unbounded:
 * back-filling months of history on a schedule change would bury a team.
 */
export const SPAWN_GRACE_DAYS = 7

/**
 * Is this due date within the window the nightly job will still back-fill?
 * Dates in the future are always in scope; the grace only extends backwards.
 */
export function withinGraceWindow(dueDate: string, today: string, graceDays = SPAWN_GRACE_DAYS): boolean {
  return dueDate >= shiftDays(today, -graceDays)
}
