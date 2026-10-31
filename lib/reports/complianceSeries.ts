/**
 * The Compliance / Other Tasks daily series on the Reports tab.
 *
 * WHY THIS LIVES HERE
 * -------------------
 * It used to sit inside ReportsCharts.tsx, which meant the arithmetic behind
 * four lines on a chart a firm reads every morning had no tests — a .tsx file
 * full of JSX cannot be imported by the node test runner. Pulled out as a pure
 * module so it can be.
 *
 * WHAT IT FIXES
 * -------------
 * The daily points read `status` as it is NOW and applied it to every past day:
 *
 *     noDueDate: t => !t.due_date && t.created_at <= ds && !closed(t.status)
 *
 * So the chart looked like a trend and was not one. A task finished last week
 * vanished from the whole history rather than showing as open back then, and
 * Overdue could only ever climb, because today's open tasks were counted
 * against every past day their due date had passed. A firm reading it could
 * not tell a growing backlog from a steady one.
 *
 * Each day is now evaluated as it actually stood, using completed_at.
 */

export interface ComplianceRawTask {
  id: string; title: string; status: string; priority: string
  due_date: string | null; created_at: string; completed_at: string | null
  custom_fields: Record<string, unknown> | null
  assignee_id: string | null; client_id: string | null
  is_recurring?: boolean | null; parent_recurring_id?: string | null
}

export interface ComplianceDayData {
  date: string; dateKey: string
  addedC: number; completedC: number; noDueDateC: number; overdueC: number
  addedNC: number; completedNC: number; noDueDateNC: number; overdueNC: number
}

export interface ComplianceSummary {
  date: string
  overdueC: number; overdueNC: number
  noDueDateC: number; noDueDateNC: number
  addedTodayC: number; addedTodayNC: number
  completedTodayC: number; completedTodayNC: number
  pendingC: number; pendingNC: number
}

const CLOSED = ['completed', 'cancelled']

/**
 * A recurring TEMPLATE, as distinct from one of its occurrences.
 *
 * A template carries no due_date by design — it has next_occurrence_date
 * instead — so every one of them landed in the "No Due Date" bucket and
 * inflated it with rows that are not outstanding work at all, just the rule
 * that generates it. The occurrences it spawns DO have due dates and are
 * counted normally.
 */
export function isRecurringTemplate(t: ComplianceRawTask): boolean {
  return t.is_recurring === true && !t.parent_recurring_id
}

/**
 * Was this task still open at the END of day `ds` (YYYY-MM-DD)?
 *
 * The question the daily series actually needs, and the one the old code did
 * not ask. Order matters:
 *
 *   1. Not created yet  -> it cannot have been open.
 *   2. Cancelled        -> excluded from every day. There is no cancelled_at
 *                          column, so there is no honest way to place it in
 *                          time. Counting it as open until today would be a
 *                          guess that inflates the backlog; this at least
 *                          errs towards under-reporting rather than alarm.
 *   3. completed_at set -> open only on days before it was finished. This is
 *                          the whole point: finished work stays in the history
 *                          up to the day it was finished.
 *   4. status completed, no completed_at -> a data gap. Treated as closed
 *                          throughout rather than open forever, which is what
 *                          "no timestamp" would otherwise produce.
 */
export function wasOpenOn(t: ComplianceRawTask, ds: string): boolean {
  const endOfDay = `${ds}T23:59:59`
  if (!t.created_at || t.created_at > endOfDay) return false
  if (t.status === 'cancelled') return false
  if (t.completed_at) return t.completed_at > endOfDay
  if (t.status === 'completed') return false
  return true
}

function fmtDay(d: Date) {
  return `${d.getDate().toString().padStart(2, '0')}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getFullYear().toString().slice(2)}`
}

/**
 * Build the daily series and today's summary.
 *
 * `localDayStr` is injected rather than imported so this module stays free of
 * app paths and the tests can pin a timezone-independent day string.
 *
 * NOTE ON OVERDUE: `due_date` is read as it is now, because the table keeps no
 * history of it. A deadline moved after the fact therefore redraws the past.
 * Fixing that needs an audit trail the schema does not have, so it stays a
 * known limitation rather than a silent one.
 */
export function buildComplianceData(
  rawTasks: ComplianceRawTask[],
  days: number,
  memberFilter: string,
  localDayStr: (d: Date) => string,
  now: Date = new Date(),
): { daily: ComplianceDayData[]; summary: ComplianceSummary } {
  // Repeat-task TEMPLATES are removed once, here, so no figure this function
  // produces can count them. Excluding at the source rather than per figure:
  // an earlier pass added the test to the four No Due Date counts and left the
  // other ten still counting templates. One filter cannot drift out of step
  // with itself.
  const withoutTemplates = rawTasks.filter(t => !isRecurringTemplate(t))
  const filtered = memberFilter
    ? withoutTemplates.filter(t => t.assignee_id === memberFilter)
    : withoutTemplates

  const today = localDayStr(now)
  const caT = filtered.filter(t => t.custom_fields?._ca_compliance === true)
  const ncT = filtered.filter(t => !t.custom_fields?._ca_compliance)

  const dayOf = (set: ComplianceRawTask[], ds: string) => ({
    added:     set.filter(t => t.created_at?.startsWith(ds)).length,
    completed: set.filter(t => t.completed_at?.startsWith(ds)).length,
    noDueDate: set.filter(t => !t.due_date && wasOpenOn(t, ds)).length,
    // `created_at` is covered by wasOpenOn, so a task created after this day
    // can no longer be reported as overdue on it.
    overdue:   set.filter(t => t.due_date && t.due_date < ds && wasOpenOn(t, ds)).length,
  })

  const daily = Array.from({ length: days }, (_, i) => {
    const d  = new Date(now.getTime() - (days - 1 - i) * 86400000)
    const ds = localDayStr(d)
    const c  = dayOf(caT, ds)
    const nc = dayOf(ncT, ds)
    return {
      date:    fmtDay(d),
      dateKey: ds,
      addedC: c.added, completedC: c.completed, noDueDateC: c.noDueDate, overdueC: c.overdue,
      addedNC: nc.added, completedNC: nc.completed, noDueDateNC: nc.noDueDate, overdueNC: nc.overdue,
    }
  })

  const open = (set: ComplianceRawTask[]) => set.filter(t => !CLOSED.includes(t.status))
  const summary: ComplianceSummary = {
    date:             now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    overdueC:         open(caT).filter(t => t.due_date && t.due_date < today).length,
    overdueNC:        open(ncT).filter(t => t.due_date && t.due_date < today).length,
    noDueDateC:       open(caT).filter(t => !t.due_date).length,
    noDueDateNC:      open(ncT).filter(t => !t.due_date).length,
    addedTodayC:      caT.filter(t => t.created_at?.startsWith(today)).length,
    addedTodayNC:     ncT.filter(t => t.created_at?.startsWith(today)).length,
    completedTodayC:  caT.filter(t => t.completed_at?.startsWith(today)).length,
    completedTodayNC: ncT.filter(t => t.completed_at?.startsWith(today)).length,
    pendingC:         open(caT).length,
    pendingNC:        open(ncT).length,
  }
  return { daily, summary }
}
