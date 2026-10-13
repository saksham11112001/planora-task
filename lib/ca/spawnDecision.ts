/**
 * The single rule that decides whether a CA compliance occurrence should be
 * created right now.
 *
 * WHY THIS EXISTS
 * ---------------
 * Three places asked the same question and answered it differently:
 *
 *   - the nightly cron        (lib/inngest/functions/caComplianceSpawn.ts)
 *   - "Spawn tasks now"       (app/api/ca/trigger/route.ts)
 *   - the Missed Tasks report (app/api/ca/missed/route.ts)
 *
 * The important divergence: the manual route skipped an occurrence when a
 * matching TASK existed OR its spawn record existed, while the cron looked
 * only at the spawn record. The manual route's own comment explains why the
 * task check is needed — "guards against ca_task_instances being out of
 * sync". So a task with a missing spawn record was invisible to the cron,
 * which re-attempted it every single night; the unique index rejected the
 * insert, no spawn record was ever written, and it retried forever.
 *
 * Rules that live in one place cannot drift. Everything below is pure, so it
 * is testable without a database, and `today` is passed in because it must be
 * the ORG's today, never the server's.
 */

/** Shift an ISO date by N days, in UTC. Local time would shift the result by
 *  a day depending on where the host sits. */
function shiftDays(iso: string, delta: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return iso
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
}

export type SkipReason =
  | 'already_exists'   // a task or a spawn record is already there
  | 'before_start'     // earlier than the client's start date
  | 'after_end'        // later than the client's end date
  | 'not_due_yet'      // its trigger date has not arrived
  | 'too_old'          // past, and outside the back-fill window

export type SpawnDecision =
  | { spawn: true }
  | { spawn: false; reason: SkipReason }

export interface SpawnInput {
  /** Due date of this occurrence, YYYY-MM-DD. */
  dueDate:       string
  /** Client start date, YYYY-MM-DD. Occurrences before it are never created. */
  startDate:     string
  /** Client end date, YYYY-MM-DD, or null for open-ended. */
  endDate:       string | null
  /** How many days before the due date the task is created. */
  daysBeforeDue: number
  /** The ORG's today, YYYY-MM-DD. */
  today:         string
  /**
   * How far back to reach for an occurrence whose date has already passed.
   *
   *   number — the nightly cron's bounded back-fill
   *   null   — no limit, which is what "Spawn tasks now" means: the whole
   *            point of pressing it is to catch up on what was missed
   */
  graceDays:     number | null
  /** A ca_task_instances row exists for this (assignment, due date). */
  hasInstance:   boolean
  /**
   * A task exists for this (title, client, due date).
   *
   * ARCHIVED AND COMPLETED ROWS COUNT. The question is "was this obligation
   * ever created?", not "is it on the board now". Excluding archived rows is
   * what caused completed-then-archived tasks to be created a second time.
   */
  hasTask:       boolean
}

/**
 * Existence is tested FIRST, deliberately.
 *
 * A task created before someone later set a start date would otherwise be
 * reported as "before_start" — an explanation for an absence that is not
 * absent. It is also the cheapest check.
 */
export function decideSpawn(o: SpawnInput): SpawnDecision {
  if (o.hasInstance || o.hasTask) return { spawn: false, reason: 'already_exists' }

  if (o.dueDate < o.startDate) return { spawn: false, reason: 'before_start' }
  if (o.endDate && o.dueDate > o.endDate) return { spawn: false, reason: 'after_end' }

  // The task appears `daysBeforeDue` ahead of its deadline. Negative or
  // missing values are treated as zero rather than shifting the window the
  // wrong way.
  const triggerDate = shiftDays(o.dueDate, -Math.max(0, o.daysBeforeDue || 0))
  if (triggerDate > o.today) return { spawn: false, reason: 'not_due_yet' }

  // Past its date. Whether that is still worth creating depends on who is
  // asking: a nightly run reaches back a bounded number of days, a human
  // pressing "catch up" reaches back indefinitely.
  if (o.graceDays !== null && o.dueDate < shiftDays(o.today, -o.graceDays)) {
    return { spawn: false, reason: 'too_old' }
  }

  return { spawn: true }
}

/** Human-readable reason, for the detail log the trigger route returns. */
export function skipReasonText(reason: SkipReason, o: SpawnInput): string {
  switch (reason) {
    case 'already_exists': return 'already spawned'
    case 'before_start':   return `before start_date (${o.startDate})`
    case 'after_end':      return `after end_date (${o.endDate})`
    case 'not_due_yet':    return `trigger date not reached yet (today=${o.today})`
    case 'too_old':        return `older than the ${o.graceDays}-day back-fill window`
  }
}


/* ========================================================================== *
 * REPORTING VIEW
 *
 * The Missed Tasks report asks the same question as the spawner but wants a
 * different vocabulary: it needs to name the benign cases so a firm can see
 * that 529 "not triggered" rows were correct behaviour and only 33 were real.
 *
 * It lives in this file, and delegates to decideSpawn above, because the
 * report MUST agree with what the spawner would actually do. Two files
 * restating the same rules is exactly how they drift.
 * ========================================================================== */

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
  // Delegates to the spawner's own rule engine rather than restating it.
  // The report must agree with what the spawner would actually do, and the
  // only way to guarantee that is to ask the same function.
  //
  // graceDays: null — the report asks "should this exist by now?", which has
  // no back-fill horizon. A date too old for the nightly run to reach is
  // still missing; it just needs the button rather than a night's wait.
  const decision = decideSpawn({
    dueDate: o.dueDate, startDate: o.startDate, endDate: o.endDate,
    daysBeforeDue: o.daysBeforeDue, today: o.today,
    graceDays: null,
    hasInstance: o.exists, hasTask: false,
  })

  if (decision.spawn) return 'missed'
  switch (decision.reason) {
    case 'already_exists': return 'present'
    case 'before_start':   return 'before_start'
    case 'after_end':      return 'after_end'
    case 'not_due_yet':    return 'not_due_yet'
    // Unreachable with graceDays null, but a missing branch here would be a
    // silent misclassification rather than a type error.
    case 'too_old':        return 'missed'
  }
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
  const limit = new Date(`${today}T00:00:00Z`)
  if (Number.isNaN(limit.getTime())) return false
  limit.setUTCDate(limit.getUTCDate() - graceDays)
  return dueDate >= limit.toISOString().slice(0, 10)
}
