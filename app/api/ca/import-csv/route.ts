import { NextResponse }     from 'next/server'
import { createClient }     from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { NextRequest }  from 'next/server'

export const maxDuration = 60

// ── Valid enum values ────────────────────────────────────────────────────────
const VALID_GROUPS = new Set([
  'GST', 'TDS / TCS', 'Income Tax', 'ROC / Company Law',
  'Accounting & MIS', 'Audit', 'Labour & Payroll', 'NGO / FCRA', 'Other',
])
const VALID_PRIORITY = new Set(['low', 'medium', 'high', 'urgent'])
const MONTH_COLS = ['apr','may','jun','jul','aug','sep','oct','nov','dec','jan','feb','mar'] as const

// ── Minimal RFC-4180-compliant CSV parser ────────────────────────────────────
function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuote = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') {
      if (inQuote && text[i + 1] === '"') { field += '"'; i++ }   // escaped quote
      else inQuote = !inQuote
    } else if (ch === ',' && !inQuote) {
      row.push(field.trim()); field = ''
    } else if ((ch === '\n' || ch === '\r') && !inQuote) {
      if (ch === '\r' && text[i + 1] === '\n') i++                // CRLF
      if (field || row.length > 0) { row.push(field.trim()); rows.push(row); row = []; field = '' }
    } else {
      field += ch
    }
  }
  if (field || row.length > 0) { row.push(field.trim()); rows.push(row) }
  return rows
}

// ── Accept YYYY-MM-DD  or  DD/MM/YYYY  or  D/M/YYYY ─────────────────────────
function parseDate(val: string): string | null {
  if (!val) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val
  const parts = val.split('/')
  if (parts.length === 3) {
    const [d, m, y] = parts
    if (y.length === 4)
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  return null
}

// ── Route handler ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: mb } = await supabase
    .from('org_members').select('org_id, role')
    .eq('user_id', user.id).eq('is_active', true).single()
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })
  if (!['owner', 'admin'].includes(mb.role))
    return NextResponse.json({ error: 'Only admins can import' }, { status: 403 })

  // ── Read multipart form ──────────────────────────────────────────────────
  let formData: FormData
  try { formData = await req.formData() }
  catch { return NextResponse.json({ error: 'Invalid multipart form' }, { status: 400 }) }

  const file = formData.get('csv') as File | null
  const fy   = ((formData.get('financial_year') as string) || '2026-27').trim()

  if (!file || file.size === 0)
    return NextResponse.json({ error: 'No CSV file provided' }, { status: 400 })
  if (!file.name.toLowerCase().endsWith('.csv'))
    return NextResponse.json({ error: 'File must be a .csv' }, { status: 400 })

  const text = await file.text()
  const allRows = parseCSV(text).filter(r => r.some(v => v))  // drop blank lines

  if (allRows.length < 2)
    return NextResponse.json({ error: 'CSV must have a header row and at least one data row' }, { status: 400 })

  // ── Map header names → column indices ───────────────────────────────────
  const headers = allRows[0].map(h => h.toLowerCase().replace(/\s+/g, '_').trim())
  const dataRows = allRows.slice(1)

  const colIdx: Record<string, number> = {}
  headers.forEach((h, i) => { colIdx[h] = i })

  const get = (row: string[], col: string) =>
    (colIdx[col] !== undefined ? (row[colIdx[col]] ?? '') : '').trim()

  // ── Parse & validate each row ────────────────────────────────────────────
  const goodRows: Record<string, unknown>[] = []
  const errors:   string[]                  = []

  dataRows.forEach((row, ri) => {
    const rowNum = ri + 2   // human-readable (1=header, 2=first data)

    const code      = get(row, 'code')
    const name      = get(row, 'name')
    const groupName = get(row, 'group_name')

    if (!code)  { errors.push(`Row ${rowNum}: "code" is required`);       return }
    if (!name)  { errors.push(`Row ${rowNum}: "name" is required`);       return }
    if (!VALID_GROUPS.has(groupName)) {
      errors.push(`Row ${rowNum}: invalid group_name "${groupName}". Must be one of: ${[...VALID_GROUPS].join(' | ')}`)
      return
    }

    const priorityRaw = get(row, 'priority') || 'medium'
    if (!VALID_PRIORITY.has(priorityRaw)) {
      errors.push(`Row ${rowNum}: invalid priority "${priorityRaw}". Use: low | medium | high | urgent`)
      return
    }

    const daysRaw   = get(row, 'days_before_due')
    const daysBefore = daysRaw ? parseInt(daysRaw, 10) : 7
    if (isNaN(daysBefore) || daysBefore < 0) {
      errors.push(`Row ${rowNum}: days_before_due must be a non-negative integer`); return
    }

    const attCountRaw = get(row, 'attachment_count')
    const attCount    = attCountRaw ? parseInt(attCountRaw, 10) : 0
    if (isNaN(attCount) || attCount < 0 || attCount > 10) {
      errors.push(`Row ${rowNum}: attachment_count must be 0–10`); return
    }

    // Due dates
    const dates: Record<string, string> = {}
    let dateErr = false
    for (const m of MONTH_COLS) {
      const raw    = get(row, `due_${m}`)
      const parsed = raw ? parseDate(raw) : null
      if (raw && !parsed) {
        errors.push(`Row ${rowNum}: invalid date for due_${m} "${raw}" — use YYYY-MM-DD or DD/MM/YYYY`)
        dateErr = true; break
      }
      if (parsed) dates[m] = parsed
    }
    if (dateErr) return

    // Attachment header labels
    const attHeaders: string[] = []
    for (let i = 1; i <= 10; i++) {
      const val = get(row, `attachment_${i}`)
      if (val) attHeaders.push(val)
    }

    // If headers are supplied, their count takes precedence over attachment_count
    const finalCount = attHeaders.length > 0 ? attHeaders.length : attCount

    goodRows.push({
      org_id:             mb.org_id,
      financial_year:     fy,
      code,
      name,
      group_name:         groupName,
      task_type:          get(row, 'task_type') || '',
      priority:           priorityRaw,
      days_before_due:    daysBefore,
      attachment_count:   finalCount,
      attachment_headers: attHeaders,
      dates,
      sort_order:         (ri + 1) * 10,
      is_active:          true,
    })
  })

  // Surface errors if every row failed
  if (goodRows.length === 0) {
    return NextResponse.json(
      { error: `No valid rows found (${errors.length} error${errors.length === 1 ? '' : 's'})`, errors },
      { status: 422 }
    )
  }

  // ── Upsert in batches of 200 ─────────────────────────────────────────────
  const admin = createAdminClient()
  const BATCH = 200
  for (let i = 0; i < goodRows.length; i += BATCH) {
    const chunk = goodRows.slice(i, i + BATCH)
    const { error: upsertErr } = await admin
      .from('ca_master_tasks')
      .upsert(chunk, { onConflict: 'org_id,code,financial_year', ignoreDuplicates: false })
    if (upsertErr)
      return NextResponse.json({ error: upsertErr.message }, { status: 500 })
  }

  return NextResponse.json({
    imported: goodRows.length,
    skipped:  dataRows.length - goodRows.length,
    errors,   // row-level warnings (non-fatal when some rows are good)
  })
}
