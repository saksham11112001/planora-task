export function fmtDate(date: string | null | undefined, opts?: Intl.DateTimeFormatOptions) {
  if (!date) return '—'
  // Date-only strings (YYYY-MM-DD) must be parsed as local midnight — new Date('2026-04-15')
  // treats them as UTC, which shifts the displayed day by -1 in UTC+ timezones.
  const d = date.length === 10 ? new Date(date + 'T00:00:00') : new Date(date)
  return d.toLocaleDateString('en-IN', opts ?? { day: '2-digit', month: 'short', year: 'numeric' })
}

export function fmtDateTime(date: string | null | undefined) {
  if (!date) return '—'
  return new Date(date).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

export function fmtHours(h: number | null | undefined) {
  if (!h) return '0h'
  const hrs = Math.floor(h); const mins = Math.round((h - hrs) * 60)
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`
}

export function fmtCurrency(amount: number, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
}

export function isOverdue(dueDate: string | null | undefined, status: string) {
  if (!dueDate || status === 'completed' || status === 'cancelled') return false
  return dueDate < new Date().toISOString().split('T')[0]
}

export function todayStr() {
  return new Date().toISOString().split('T')[0]
}

export function initials(name: string) {
  return name.split(' ').slice(0,2).map(p => p[0]?.toUpperCase() ?? '').join('')
}
