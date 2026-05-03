export function fmtDate(date: string | null | undefined, opts?: Intl.DateTimeFormatOptions) {
  if (!date) return '—'
  const d = date.length === 10 ? new Date(date + 'T00:00:00') : new Date(date)
  if (opts) return d.toLocaleDateString('en-IN', opts)
  // Standard format: DD/MM/YYYY
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
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
