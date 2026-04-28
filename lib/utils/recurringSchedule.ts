/**
 * Shared helpers for recurring-task frequency handling.
 * Used by /api/recurring (POST + PATCH) and /api/recurring/[id] (PATCH).
 */

// ── Granular → DB-column mapping ─────────────────────────────────────────────
// The `tasks.frequency` column only allows: daily | weekly | bi_weekly | monthly | quarterly | annual
export function normalizeFrequency(freq: string): string {
  if (freq.startsWith('weekly_'))    return 'weekly'
  if (freq.startsWith('monthly_'))   return 'monthly'
  if (freq.startsWith('quarterly_')) return 'quarterly'
  if (freq.startsWith('annual_'))    return 'annual'
  return freq
}

// ── Annual fixed-date variants ────────────────────────────────────────────────
const ANNUAL_FIXED: Record<string, [number, number]> = {
  annual_31jul: [6, 31],   // [month 0-indexed, day]
  annual_30sep: [8, 30],
  annual_31dec: [11, 31],
  annual_31mar: [2, 31],
}

// ── Quarter-end months (0-indexed) ───────────────────────────────────────────
const QUARTER_ENDS = [2, 5, 8, 11] // Mar, Jun, Sep, Dec

/**
 * Given a granular frequency value and a reference date string (YYYY-MM-DD),
 * returns the nearest NEXT occurrence date as YYYY-MM-DD.
 *
 * Handles every variant in InlineRecurringTask's FREQUENCIES list:
 *   weekly_mon … weekly_sun
 *   monthly_1, monthly_7, …, monthly_last
 *   quarterly_13, quarterly_15, quarterly_25, quarterly_last
 *   annual_31jul, annual_30sep, annual_31dec, annual_31mar
 *   annual, quarterly, monthly, weekly, bi_weekly, daily
 */
export function nextOccurrence(freq: string, from: string): string {
  const ref = new Date(from)
  ref.setHours(0, 0, 0, 0)

  // ── Annual with a fixed calendar date ────────────────────────────────────
  if (freq in ANNUAL_FIXED) {
    const [mo, day] = ANNUAL_FIXED[freq]
    for (let yr = ref.getFullYear(); yr <= ref.getFullYear() + 1; yr++) {
      const lastOfMonth = new Date(yr, mo + 1, 0).getDate()
      const c = new Date(yr, mo, Math.min(day, lastOfMonth))
      if (c > ref) return c.toISOString().split('T')[0]
    }
  }

  // ── Quarterly with a fixed day within the quarter-end month ──────────────
  // Scan forward month-by-month (max 15 months) for the next quarter-end month
  // where the specific day lies in the future.
  if (freq.startsWith('quarterly_')) {
    const suffix = freq.replace('quarterly_', '')
    for (let offset = 0; offset <= 15; offset++) {
      const probe = new Date(ref.getFullYear(), ref.getMonth() + offset, 1)
      const probeMonth = probe.getMonth()
      if (!QUARTER_ENDS.includes(probeMonth)) continue
      const yr       = probe.getFullYear()
      const lastDay  = new Date(yr, probeMonth + 1, 0).getDate()
      const day      = suffix === 'last' ? lastDay : Math.min(parseInt(suffix) || 15, lastDay)
      const c        = new Date(yr, probeMonth, day)
      if (c > ref) return c.toISOString().split('T')[0]
    }
  }

  // ── Monthly with a fixed day of month ────────────────────────────────────
  if (freq.startsWith('monthly_')) {
    const suffix = freq.replace('monthly_', '')
    for (let offset = 0; offset <= 2; offset++) {
      const probe   = new Date(ref.getFullYear(), ref.getMonth() + offset, 1)
      const yr      = probe.getFullYear()
      const mo      = probe.getMonth()
      const lastDay = new Date(yr, mo + 1, 0).getDate()
      const day     = suffix === 'last' ? lastDay : Math.min(parseInt(suffix) || 1, lastDay)
      const c       = new Date(yr, mo, day)
      if (c > ref) return c.toISOString().split('T')[0]
    }
  }

  // ── Multi-day weekly: weekly_days:mon,wed,fri ────────────────────────────
  if (freq.startsWith('weekly_days:')) {
    const DAY_MAP: Record<string, number> = { sun:0, mon:1, tue:2, wed:3, thu:4, fri:5, sat:6 }
    const targets = freq.replace('weekly_days:', '').split(',')
      .map(d => DAY_MAP[d.trim()] ?? 1)
      .sort((a, b) => a - b)
    const refDay = ref.getDay()
    const next = targets.find(d => d > refDay)
    const diff  = next !== undefined ? next - refDay : targets[0] + 7 - refDay
    return new Date(ref.getTime() + diff * 86_400_000).toISOString().split('T')[0]
  }

  // ── Multi-day monthly: monthly_days:1,15,25 ──────────────────────────────
  if (freq.startsWith('monthly_days:')) {
    const days = freq.replace('monthly_days:', '').split(',').map(Number).sort((a, b) => a - b)
    const refDay = ref.getDate()
    for (const day of days) {
      const lastDay = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate()
      const candidate = Math.min(day, lastDay)
      if (candidate > refDay) return new Date(ref.getFullYear(), ref.getMonth(), candidate).toISOString().split('T')[0]
    }
    const yr = ref.getMonth() === 11 ? ref.getFullYear() + 1 : ref.getFullYear()
    const mo = (ref.getMonth() + 1) % 12
    const lastDay = new Date(yr, mo + 1, 0).getDate()
    return new Date(yr, mo, Math.min(days[0], lastDay)).toISOString().split('T')[0]
  }

  // ── Weekly with a fixed weekday ──────────────────────────────────────────
  if (freq.startsWith('weekly_')) {
    const DAY_MAP: Record<string, number> = {
      weekly_sun: 0, weekly_mon: 1, weekly_tue: 2, weekly_wed: 3,
      weekly_thu: 4, weekly_fri: 5, weekly_sat: 6,
    }
    const target = DAY_MAP[freq] ?? 1
    let diff = target - ref.getDay()
    if (diff <= 0) diff += 7
    return new Date(ref.getTime() + diff * 86_400_000).toISOString().split('T')[0]
  }

  // ── Every-N-days (generated by custom_daily: every_3_days, every_5_days, …) ─
  const everyNMatch = freq.match(/^every_(\d+)_days$/)
  if (everyNMatch) {
    const n = Math.max(1, parseInt(everyNMatch[1]))
    return new Date(ref.getTime() + n * 86_400_000).toISOString().split('T')[0]
  }

  // ── Base frequencies ─────────────────────────────────────────────────────
  const d = new Date(ref)
  switch (freq) {
    case 'daily':     d.setDate(d.getDate() + 1);          break
    case 'weekly':    d.setDate(d.getDate() + 7);          break
    case 'bi_weekly': d.setDate(d.getDate() + 14);         break
    case 'monthly':   d.setMonth(d.getMonth() + 1);        break
    case 'quarterly': d.setMonth(d.getMonth() + 3);        break
    case 'annual':    d.setFullYear(d.getFullYear() + 1);  break
    default:          d.setDate(d.getDate() + 7);          break
  }
  return d.toISOString().split('T')[0]
}
