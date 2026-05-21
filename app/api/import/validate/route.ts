import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse }       from 'next/server'
import type { NextRequest }   from 'next/server'
import { getApiOrgMembership } from '@/lib/supabase/apiActiveOrg'

export const maxDuration = 30
export const dynamic = 'force-dynamic'

// ── Minimal shared helpers (read-only, no DB writes) ─────────────────────────
type Row = string[]
type SheetMap = Record<string, Row[]>

function norm(s: string) { return (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '') }
function alphaNum(s: string) { return s.toLowerCase().replace(/[^a-z0-9]/g, '') }
function cleanText(s: string) {
  return (s ?? '')
    .replace(/[​-‍﻿ ]/g, ' ')
    .replace(/['']/g, "'").replace(/[""]/g, '"').replace(/\s+/g, ' ').trim()
}
function cell(row: Row, idx: number) { return idx >= 0 ? cleanText(String(row[idx] ?? '')) : '' }
function findCol(headers: Row, ...keys: string[]) {
  for (const k of keys) {
    const idx = headers.findIndex(h => norm(h).includes(norm(k)))
    if (idx !== -1) return idx
  }
  return -1
}
function isLikelyInstructionRow(row: Row) {
  const j = row.map(cleanText).join(' ').toLowerCase()
  return j.includes('yyyy-mm-dd') || j.includes('must match') || j.includes('clear title') ||
    j.includes('optional') || j.includes('select from') || j.includes('enter email') || j.includes('type here')
}
function isSampleRow(row: Row) {
  const j = row.map(cleanText).join(' ').toLowerCase()
  const filled = row.filter(v => cleanText(v).length > 0).length
  if (filled === 0) return true
  return j.includes('[sample]') || j.includes('@yourcompany.com') || j.includes('must match') ||
    j.includes('yyyy-mm-dd') || j.includes('clear title') || j.includes('select from dropdown') ||
    j.includes('enter email') || j.includes('type here') || j.includes('e.g.') || j.includes('(sample)')
}
function getDataRows(rows: Row[], hdrIdx: number) {
  const out = rows.slice(hdrIdx + 1)
  if (out.length > 0 && isLikelyInstructionRow(out[0])) return out.slice(1)
  return out
}
function findSheetName(sheets: SheetMap, preds: Array<(n: string) => boolean>) {
  return Object.keys(sheets).find(n => preds.some(f => f(n)))
}

async function parseXlsx(buffer: ArrayBuffer): Promise<SheetMap> {
  const XLSX = await import('xlsx')
  const wb = XLSX.read(new Uint8Array(buffer), { type: 'array', raw: false, cellDates: true })
  const result: SheetMap = {}
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name]
    const rows = XLSX.utils.sheet_to_json<Row>(ws, { header: 1, defval: '', raw: false })
    result[name] = rows as Row[]
  }
  return result
}

// ── Report shape ──────────────────────────────────────────────────────────────
export interface SheetReport {
  found: boolean
  rowCount: number
  errors: string[]
  warnings: string[]
  info: string[]
}

function makeSheet(): SheetReport {
  return { found: false, rowCount: 0, errors: [], warnings: [], info: [] }
}

// ── Route handler (read-only) ─────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, request, 'org_id, role')
  if (!mb || !['owner', 'admin', 'manager'].includes(mb.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let formData: FormData
  try { formData = await request.formData() }
  catch { return NextResponse.json({ error: 'Could not read form data' }, { status: 400 }) }

  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })
  if (!file.name.toLowerCase().endsWith('.xlsx'))
    return NextResponse.json({ error: 'Please upload an .xlsx file' }, { status: 400 })
  if (file.size > 5 * 1024 * 1024)
    return NextResponse.json({ error: 'File too large (max 5 MB)' }, { status: 400 })

  let sheets: SheetMap
  try { sheets = await parseXlsx(await file.arrayBuffer()) }
  catch { return NextResponse.json({ error: 'Could not read the file — make sure it is a valid .xlsx' }, { status: 400 }) }

  const admin = createAdminClient()
  const orgId = mb.org_id

  // Pre-load existing org data for reference checks (read-only)
  const [clientsRes, membersRes, masterRes] = await Promise.all([
    admin.from('clients').select('name').eq('org_id', orgId),
    admin.from('org_members').select('user_id, role, users!inner(email, name)').eq('org_id', orgId).eq('is_active', true),
    admin.from('ca_master_tasks').select('name').eq('org_id', orgId).eq('is_active', true),
  ])

  const existingClients = new Set(
    (clientsRes.data ?? []).map((c: any) => alphaNum(c.name.toLowerCase()))
  )
  const existingMemberEmails = new Set(
    (membersRes.data ?? []).map((m: any) => (m.users as any)?.email?.toLowerCase()).filter(Boolean)
  )
  const masterTaskNames = new Set(
    (masterRes.data ?? []).map((t: any) => alphaNum(t.name.toLowerCase()))
  )

  const VALID_ROLES      = new Set(['owner', 'admin', 'manager', 'member', 'viewer'])
  const VALID_PRIORITIES = new Set(['none', 'low', 'medium', 'high', 'urgent'])
  const VALID_FREQS      = new Set(['daily', 'weekly', 'bi_weekly', 'monthly', 'quarterly', 'half_yearly', 'annual'])

  const report: Record<string, SheetReport> = {
    members:    makeSheet(),
    clients:    makeSheet(),
    projects:   makeSheet(),
    tasks:      makeSheet(),
    onetasks:   makeSheet(),
    recurring:  makeSheet(),
    compliance: makeSheet(),
  }

  // ── Members ────────────────────────────────────────────────────────
  const memberSheet = findSheetName(sheets, [k => norm(k).includes('member'), k => norm(k).startsWith('team')])
  if (memberSheet) {
    const r = report.members; r.found = true
    const rows = sheets[memberSheet]
    const hdrIdx = rows.findIndex(row => row.some(c => norm(c) === 'email'))
    if (hdrIdx !== -1) {
      const headers = rows[hdrIdx]
      const iEmail = findCol(headers, 'email')
      const iRole  = findCol(headers, 'role')
      const drows  = getDataRows(rows, hdrIdx).filter(row => !isSampleRow(row))
      r.rowCount   = drows.length
      let newCount = 0, existCount = 0
      for (const row of drows) {
        const email = cell(row, iEmail).toLowerCase()
        const role  = cell(row, iRole).toLowerCase() || 'member'
        if (!email || !email.includes('@')) { r.errors.push(`Row with invalid email: "${cell(row, iEmail)}" — must be a valid email address`); continue }
        if (!VALID_ROLES.has(role)) { r.errors.push(`"${email}": invalid role "${role}" — must be one of owner | admin | manager | member | viewer`); continue }
        if (existingMemberEmails.has(email)) existCount++
        else newCount++
      }
      if (existCount > 0) r.info.push(`${existCount} member${existCount !== 1 ? 's' : ''} already in the org — will be skipped`)
      if (newCount > 0) r.warnings.push(`${newCount} new email${newCount !== 1 ? 's' : ''} — will receive an invite to join the org`)
    } else {
      r.errors.push('No "email" column found in Members sheet — check the header row')
    }
  }

  // ── Clients ────────────────────────────────────────────────────────
  const clientSheet = findSheetName(sheets, [k => norm(k).includes('client')])
  if (clientSheet) {
    const r = report.clients; r.found = true
    const rows = sheets[clientSheet]
    const hdrIdx = rows.findIndex(row => row.some(c => norm(c) === 'name' || norm(c).includes('clientname') || norm(c) === 'client'))
    if (hdrIdx !== -1) {
      const headers = rows[hdrIdx]
      const iName  = findCol(headers, 'clientname', 'name', 'client')
      const drows  = getDataRows(rows, hdrIdx).filter(row => !isSampleRow(row))
      r.rowCount   = drows.length
      let newCount = 0, existCount = 0
      for (const row of drows) {
        const name = cell(row, iName)
        if (!name) { r.errors.push('Row with empty client name — name is required'); continue }
        if (existingClients.has(alphaNum(name.toLowerCase()))) existCount++
        else newCount++
      }
      if (existCount > 0) r.info.push(`${existCount} client${existCount !== 1 ? 's' : ''} already exist — will be skipped`)
      if (newCount > 0) r.info.push(`${newCount} new client${newCount !== 1 ? 's' : ''} will be created`)
    }
  }

  // ── Projects ────────────────────────────────────────────────────────
  const projectSheet = findSheetName(sheets, [k => norm(k).includes('project')])
  if (projectSheet) {
    const r = report.projects; r.found = true
    const rows = sheets[projectSheet]
    const hdrIdx = rows.findIndex(row => row.some(c => norm(c).includes('projectname') || norm(c) === 'name'))
    if (hdrIdx !== -1) {
      const headers = rows[hdrIdx]
      const iName   = findCol(headers, 'projectname', 'name')
      const iStatus = findCol(headers, 'status')
      const drows   = getDataRows(rows, hdrIdx).filter(row => !isSampleRow(row))
      r.rowCount    = drows.length
      for (const row of drows) {
        const name   = cell(row, iName)
        if (!name) { r.errors.push('Row with empty project name — name is required'); continue }
        const status = cell(row, iStatus) || 'active'
        if (!['active', 'on_hold', 'completed'].includes(status))
          r.errors.push(`"${name}": invalid status "${status}" — use active | on_hold | completed`)
      }
    }
  }

  // ── Tasks (project-linked) ─────────────────────────────────────────
  const taskSheet = findSheetName(sheets, [
    k => norm(k).includes('task') && !norm(k).includes('recurring') && !norm(k).includes('one') && !norm(k).includes('onetim'),
  ])
  if (taskSheet) {
    const r = report.tasks; r.found = true
    const rows = sheets[taskSheet]
    const hdrIdx = rows.findIndex(row => row.some(c => norm(c).includes('tasktitle') || norm(c) === 'title'))
    if (hdrIdx !== -1) {
      const headers    = rows[hdrIdx]
      const iTitle     = findCol(headers, 'tasktitle', 'title')
      const iPriority  = findCol(headers, 'priority')
      const iAssignee  = findCol(headers, 'assigneeemail', 'assignee')
      const drows      = getDataRows(rows, hdrIdx).filter(row => !isSampleRow(row))
      r.rowCount       = drows.length
      let newAssignees = 0
      for (const row of drows) {
        const title = cell(row, iTitle)
        if (!title) { r.errors.push('Row with empty task title — title is required'); continue }
        const priority = cell(row, iPriority) || 'medium'
        if (!VALID_PRIORITIES.has(priority))
          r.errors.push(`"${title}": invalid priority "${priority}" — use none | low | medium | high | urgent`)
        const assigneeRaw = cell(row, iAssignee).toLowerCase()
        if (assigneeRaw && assigneeRaw.includes('@') && !existingMemberEmails.has(assigneeRaw))
          newAssignees++
      }
      if (newAssignees > 0)
        r.warnings.push(`${newAssignees} assignee email${newAssignees !== 1 ? 's' : ''} not in org — will be auto-invited as member`)
    }
  }

  // ── One-time tasks ─────────────────────────────────────────────────
  const oneTimeSheet = findSheetName(sheets, [
    k => norm(k).includes('onetime') || norm(k).includes('onetim') || norm(k).includes('inbox'),
  ])
  if (oneTimeSheet) {
    const r = report.onetasks; r.found = true
    const rows = sheets[oneTimeSheet]
    const hdrIdx = rows.findIndex(row => row.some(c => norm(c).includes('tasktitle') || norm(c) === 'title'))
    if (hdrIdx !== -1) {
      const headers    = rows[hdrIdx]
      const iTitle     = findCol(headers, 'tasktitle', 'title')
      const iPriority  = findCol(headers, 'priority')
      const iClient    = findCol(headers, 'clientname', 'client')
      const iAssignee  = findCol(headers, 'assigneeemail', 'assignee')
      const drows      = getDataRows(rows, hdrIdx).filter(row => !isSampleRow(row))
      r.rowCount       = drows.length
      let newClients = 0, newAssignees = 0
      for (const row of drows) {
        const title = cell(row, iTitle)
        if (!title) { r.errors.push('Row with empty task title — title is required'); continue }
        const priority = cell(row, iPriority) || 'medium'
        if (!VALID_PRIORITIES.has(priority))
          r.errors.push(`"${title}": invalid priority "${priority}" — use none | low | medium | high | urgent`)
        const clientName = cell(row, iClient)
        if (clientName && !clientName.toLowerCase().includes('select') && !existingClients.has(alphaNum(clientName.toLowerCase())))
          newClients++
        const assigneeRaw = cell(row, iAssignee).toLowerCase()
        if (assigneeRaw && assigneeRaw.includes('@') && !existingMemberEmails.has(assigneeRaw))
          newAssignees++
      }
      if (newClients > 0)    r.warnings.push(`${newClients} client name${newClients !== 1 ? 's' : ''} not found — will be auto-created during import`)
      if (newAssignees > 0)  r.warnings.push(`${newAssignees} assignee email${newAssignees !== 1 ? 's' : ''} not in org — will be auto-invited as member`)
    }
  }

  // ── Recurring tasks ────────────────────────────────────────────────
  const recurringSheet = findSheetName(sheets, [k => norm(k).includes('recurring')])
  if (recurringSheet) {
    const r = report.recurring; r.found = true
    const rows = sheets[recurringSheet]
    const hdrIdx = rows.findIndex(row => row.some(c => norm(c) === 'title' || norm(c).includes('tasktitle')))
    if (hdrIdx !== -1) {
      const headers = rows[hdrIdx]
      const iTitle    = findCol(headers, 'tasktitle', 'title')
      const iFreq     = findCol(headers, 'frequency', 'freq')
      const iPriority = findCol(headers, 'priority')
      const drows     = getDataRows(rows, hdrIdx).filter(row => !isSampleRow(row))
      r.rowCount      = drows.length
      for (const row of drows) {
        const title = cell(row, iTitle)
        if (!title) { r.errors.push('Row with empty task title — title is required'); continue }
        const freq = norm(cell(row, iFreq))
        if (freq && !VALID_FREQS.has(freq))
          r.errors.push(`"${title}": invalid frequency "${freq}" — use daily | weekly | bi_weekly | monthly | quarterly | half_yearly | annual`)
        const priority = cell(row, iPriority) || 'medium'
        if (!VALID_PRIORITIES.has(priority))
          r.errors.push(`"${title}": invalid priority "${priority}" — use none | low | medium | high | urgent`)
      }
    }
  }

  // ── CA Compliance ──────────────────────────────────────────────────
  const caSheet = findSheetName(sheets, [
    k => norm(k).includes('cacompliance') || (norm(k).includes('compliance') && !norm(k).includes('non')),
  ])
  if (caSheet) {
    const r = report.compliance; r.found = true
    const rows = sheets[caSheet]
    const hdrIdx = rows.findIndex(row => row.some(c => norm(c).includes('compliance') || norm(c).includes('tasktype')))
    if (hdrIdx !== -1) {
      const headers     = rows[hdrIdx]
      const iType       = findCol(headers, 'compliancetasktype', 'tasktype', 'compliance')
      const iClient     = findCol(headers, 'clientname', 'client')
      const iAssignee   = findCol(headers, 'assigneeemail', 'assignee')
      const drows       = getDataRows(rows, hdrIdx).filter(row => !isSampleRow(row))
      r.rowCount        = drows.length
      let missingMaster = 0, newClients = 0, newAssignees = 0

      if (masterTaskNames.size === 0)
        r.warnings.push('No CA Master tasks found for this org — run "Spawn tasks now" in CA Compliance after importing to generate tasks, or add master tasks first')

      for (const row of drows) {
        const typeName = cell(row, iType)
        if (!typeName) continue
        const typeNorm = typeName.toLowerCase()
        if (typeNorm.includes('select') || typeNorm.includes('dropdown') || typeNorm.includes('enter') || typeNorm.includes('e.g')) continue

        if (masterTaskNames.size > 0 && !masterTaskNames.has(alphaNum(typeNorm)))
          missingMaster++

        const clientName = cell(row, iClient)
        if (clientName && !clientName.toLowerCase().includes('select') && !existingClients.has(alphaNum(clientName.toLowerCase())))
          newClients++

        const assigneeRaw = cell(row, iAssignee).toLowerCase()
        if (assigneeRaw && assigneeRaw.includes('@') && !existingMemberEmails.has(assigneeRaw))
          newAssignees++
      }

      if (missingMaster > 0)
        r.warnings.push(`${missingMaster} task type${missingMaster !== 1 ? 's' : ''} not found in CA Master — check spelling or add them in CA Compliance → Manage Templates first`)
      if (newClients > 0)
        r.warnings.push(`${newClients} client name${newClients !== 1 ? 's' : ''} not found in your clients list — will be auto-created during import`)
      if (newAssignees > 0)
        r.warnings.push(`${newAssignees} assignee email${newAssignees !== 1 ? 's' : ''} not in org — will be auto-invited as member`)
    } else {
      r.errors.push('No compliance task type column found — make sure the header row contains "Compliance Task Type"')
    }
  }

  // ── Summary ────────────────────────────────────────────────────────
  const sheetsFound  = Object.entries(report).filter(([, v]) => v.found).map(([k]) => k)
  const totalRows    = Object.values(report).reduce((s, v) => s + v.rowCount, 0)
  const errorCount   = Object.values(report).reduce((s, v) => s + v.errors.length, 0)
  const warningCount = Object.values(report).reduce((s, v) => s + v.warnings.length, 0)

  return NextResponse.json({
    ok: errorCount === 0,
    report,
    summary: { sheetsFound, totalRows, errorCount, warningCount },
  })
}
