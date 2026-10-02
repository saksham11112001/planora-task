/**
 * Shared types and pure helpers for the Attendance & Leave module.
 *
 * Everything here is pure — no Supabase, no fetch — so it can be imported by
 * server routes and client views alike, and unit-tested without a database.
 */

export const LEAVE_TYPES = [
  'casual', 'sick', 'earned', 'unpaid', 'comp_off', 'maternity', 'other',
] as const
export type LeaveType = typeof LEAVE_TYPES[number]

export const LEAVE_TYPE_LABEL: Record<LeaveType, string> = {
  casual:    'Casual leave',
  sick:      'Sick leave',
  earned:    'Earned leave',
  unpaid:    'Unpaid leave',
  comp_off:  'Comp off',
  maternity: 'Maternity / paternity',
  other:     'Other',
}

export const LEAVE_STATUSES = ['pending', 'approved', 'rejected', 'cancelled'] as const
export type LeaveStatus = typeof LEAVE_STATUSES[number]

export const ATTENDANCE_STATUSES = ['present', 'half_day', 'on_leave', 'holiday', 'absent'] as const
export type AttendanceStatus = typeof ATTENDANCE_STATUSES[number]

export const ATTENDANCE_STATUS_LABEL: Record<AttendanceStatus, string> = {
  present:  'Present',
  half_day: 'Half day',
  on_leave: 'On leave',
  holiday:  'Holiday',
  absent:   'Absent',
}

export interface AttendanceRecord {
  id:              string
  org_id:          string
  user_id:         string
  work_date:       string
  check_in_at:     string | null
  check_out_at:    string | null
  check_in_lat:    number | null
  check_in_lng:    number | null
  check_in_label:  string | null
  check_out_lat:   number | null
  check_out_lng:   number | null
  check_out_label: string | null
  status:          AttendanceStatus
  source:          'self' | 'manual'
  notes:           string | null
  recorded_by:     string | null
}

export interface LeaveRequest {
  id:            string
  org_id:        string
  user_id:       string
  leave_type:    LeaveType
  start_date:    string
  end_date:      string
  half_day:      boolean
  days_count:    number
  reason:        string | null
  status:        LeaveStatus
  decided_by:    string | null
  decided_at:    string | null
  decision_note: string | null
  created_at:    string
}

export interface LeaveBalance {
  id:         string
  user_id:    string
  year:       number
  leave_type: LeaveType
  entitled:   number
  used:       number
}

/* ── Pure helpers ─────────────────────────────────────────────────────────── */

export function isLeaveType(v: unknown): v is LeaveType {
  return typeof v === 'string' && (LEAVE_TYPES as readonly string[]).includes(v)
}

export function isAttendanceStatus(v: unknown): v is AttendanceStatus {
  return typeof v === 'string' && (ATTENDANCE_STATUSES as readonly string[]).includes(v)
}

/** YYYY-MM-DD, strictly. Guards against '2026-13-45' and against Date parsing
 *  a garbage string into something plausible. */
export function isIsoDate(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const d = new Date(`${v}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
}

/**
 * Working days between two ISO dates, inclusive, excluding Saturday and
 * Sunday.
 *
 * Deliberately simple: no public-holiday calendar, because upFloat has no
 * holiday table and inventing one per country would be guesswork. A firm that
 * needs a holiday excluded adjusts the request. The count is a default the
 * approver can see and the balance arithmetic uses — not a payroll authority.
 *
 * Iterates in UTC so a host in any timezone counts the same days.
 */
export function workingDaysBetween(startIso: string, endIso: string): number {
  if (!isIsoDate(startIso) || !isIsoDate(endIso)) return 0
  const start = new Date(`${startIso}T00:00:00Z`)
  const end   = new Date(`${endIso}T00:00:00Z`)
  if (end < start) return 0

  let days = 0
  const cur = new Date(start)
  // Bounded: a request longer than ~2 years is rejected by the API before it
  // reaches here, so this cannot spin.
  while (cur <= end) {
    const dow = cur.getUTCDay()      // 0 Sun … 6 Sat
    if (dow !== 0 && dow !== 6) days++
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return days
}

/**
 * The days a leave request consumes from a balance.
 * A half day is always exactly 0.5 and only valid on a single date.
 */
export function leaveDaysCount(startIso: string, endIso: string, halfDay: boolean): number {
  if (halfDay) return startIso === endIso ? 0.5 : 0
  return workingDaysBetween(startIso, endIso)
}

/** Hours between check-in and check-out, to one decimal. Null while open. */
export function workedHours(r: Pick<AttendanceRecord, 'check_in_at' | 'check_out_at'>): number | null {
  if (!r.check_in_at || !r.check_out_at) return null
  const ms = new Date(r.check_out_at).getTime() - new Date(r.check_in_at).getTime()
  if (!Number.isFinite(ms) || ms <= 0) return null
  return Math.round((ms / 3_600_000) * 10) / 10
}

/**
 * Do two date ranges overlap? Used to reject a leave request that collides
 * with one the member already has pending or approved.
 */
export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd
}
