/**
 * Carry CA compliance assignments from one financial year into the next.
 *
 * WHY THIS EXISTS
 * ---------------
 * Master tasks are unique on (org_id, code, financial_year), so every new
 * financial year gets a brand new set of rows with brand new ids. An
 * assignment is keyed on (master_task_id, client_id), which binds it to ONE
 * year's rows.
 *
 * So on the day a firm switches the calendar to a new financial year:
 *   - the new year's master tasks have no assignments at all
 *   - the old year's assignments point at dates that are now in the past,
 *     and the spawner skips past dates
 *   - therefore NOT ONE compliance task is created, for any client, and
 *     nothing in the app says so
 *
 * Re-ticking 80 tasks across 50 clients by hand is not a recovery plan. This
 * module plans the carry-forward; the route applies it.
 *
 * Pure: no Supabase, no clock. Everything it needs is passed in, so the
 * matching rules can be tested without a database.
 */

/** A master task row, reduced to what matching needs. */
export interface MasterRef {
  id:             string
  code:           string
  financial_year: string
}

/** An existing assignment, reduced to what carrying forward needs. */
export interface AssignmentRef {
  id:              string
  master_task_id:  string
  client_id:       string
  assignee_id:     string | null
  approver_id:     string | null
  end_date:        string | null
  is_active:       boolean
}

export interface RolloverPlanItem {
  client_id:          string
  from_master_id:     string
  to_master_id:       string
  code:               string
  assignee_id:        string | null
  approver_id:        string | null
  /** Inclusive lower bound for spawning in the new year. */
  start_date:         string
  /** Carried only when it still falls inside the new year. */
  end_date:           string | null
}

export type SkipReason =
  | 'inactive'            // the assignment is paused; carrying it would un-pause it
  | 'ended'               // its end date is before the new year even starts
  | 'no_matching_task'    // the task does not exist in the new year's calendar
  | 'already_assigned'    // the client already has this task in the new year

export interface RolloverPlan {
  create: RolloverPlanItem[]
  skipped: { client_id: string; code: string; reason: SkipReason }[]
}

/**
 * First day of a financial year written as "2027-28".
 *
 * India's financial year runs April to March, which is what every date in
 * this module's catalogue assumes.
 */
export function fyStartDate(fy: string): string | null {
  const m = /^(\d{4})-(\d{2})$/.exec(fy.trim())
  if (!m) return null
  const startYear = Number(m[1])
  if (!Number.isInteger(startYear) || startYear < 2000 || startYear > 2100) return null
  // The second half is a two-digit year and must follow on from the first,
  // so "2026-28" is a typo rather than a range this should accept.
  const expectedEnd = String((startYear + 1) % 100).padStart(2, '0')
  if (m[2] !== expectedEnd) return null
  return `${startYear}-04-01`
}

/**
 * Work out what to create. Nothing here writes; the caller decides whether to
 * apply the plan or just show it.
 *
 * Matching is by `code`, not by name or id. Codes are the stable identity of
 * a task across years — a master row's id changes every year by construction,
 * and names get edited.
 */
export function planRollover(
  fromAssignments: AssignmentRef[],
  fromMasters:     MasterRef[],
  toMasters:       MasterRef[],
  existingToAssignments: AssignmentRef[],
  toFy:            string,
): RolloverPlan {
  const plan: RolloverPlan = { create: [], skipped: [] }

  const start = fyStartDate(toFy)
  if (!start) return plan

  const fromById   = new Map(fromMasters.map(m => [m.id, m]))
  const toByCode   = new Map(toMasters.map(m => [m.code, m]))

  // What the client already has in the target year, so re-running the
  // rollover is a no-op rather than a pile of duplicates.
  const alreadyThere = new Set(
    existingToAssignments.map(a => `${a.client_id}__${a.master_task_id}`),
  )

  for (const asgn of fromAssignments) {
    const fromMaster = fromById.get(asgn.master_task_id)
    if (!fromMaster) continue          // not part of the year being rolled

    const code = fromMaster.code

    // A paused assignment is paused deliberately. Carrying it forward as
    // active would quietly resume work the firm stopped.
    if (!asgn.is_active) {
      plan.skipped.push({ client_id: asgn.client_id, code, reason: 'inactive' })
      continue
    }

    // The client was wound down before the new year began.
    if (asgn.end_date && asgn.end_date < start) {
      plan.skipped.push({ client_id: asgn.client_id, code, reason: 'ended' })
      continue
    }

    const toMaster = toByCode.get(code)
    if (!toMaster) {
      // The task is not in the new year's calendar — a statute may have been
      // withdrawn, or the new year's defaults were never loaded. Either way
      // inventing a master row here would be a guess.
      plan.skipped.push({ client_id: asgn.client_id, code, reason: 'no_matching_task' })
      continue
    }

    if (alreadyThere.has(`${asgn.client_id}__${toMaster.id}`)) {
      plan.skipped.push({ client_id: asgn.client_id, code, reason: 'already_assigned' })
      continue
    }

    plan.create.push({
      client_id:      asgn.client_id,
      from_master_id: fromMaster.id,
      to_master_id:   toMaster.id,
      code,
      assignee_id:    asgn.assignee_id,
      approver_id:    asgn.approver_id,
      // Pinned to the first day of the new year, NOT left null.
      //
      // Null falls back to the assignment's created_at, which is the moment
      // the rollover is run. Roll over in June and every April and May
      // obligation would be treated as "before this client started" and never
      // created. The client did not start in June; the YEAR did.
      start_date:     start,
      // An end date inside the new year is a real wind-down instruction and
      // must survive. One before the year started was filtered out above.
      end_date:       asgn.end_date,
    })
  }

  return plan
}
