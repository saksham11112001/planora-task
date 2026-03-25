import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse }       from 'next/server'
import type { NextRequest }   from 'next/server'

async function parseXlsx(buffer: ArrayBuffer): Promise<Record<string, string[][]>> {
  const XLSX = await import('xlsx')
  const wb = XLSX.read(new Uint8Array(buffer), { type: 'array', raw: false })
  const result: Record<string, string[][]> = {}
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '', raw: false })
    result[sheetName] = rows as string[][]
  }
  return result
}

function norm(s: string) { return (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '') }
function findCol(headers: string[], ...keys: string[]): number {
  for (const key of keys) {
    const idx = headers.findIndex(h => norm(h).includes(norm(key)))
    if (idx !== -1) return idx
  }
  return -1
}
function cell(row: string[], idx: number): string {
  return idx >= 0 ? String(row[idx] ?? '').trim() : ''
}
function nextOccurrence(freq: string, from: string): string {
  const d = new Date(from)
  switch (freq) {
    case 'daily':     d.setDate(d.getDate() + 1);        break
    case 'weekly':    d.setDate(d.getDate() + 7);        break
    case 'bi_weekly': d.setDate(d.getDate() + 14);       break
    case 'monthly':   d.setMonth(d.getMonth() + 1);      break
    case 'quarterly': d.setMonth(d.getMonth() + 3);      break
    case 'annual':    d.setFullYear(d.getFullYear() + 1); break
  }
  return d.toISOString().split('T')[0]
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: mb } = await supabase
    .from('org_members').select('org_id, role')
    .eq('user_id', user.id).eq('is_active', true).single()
  if (!mb || !['owner', 'admin', 'manager'].includes(mb.role))
    return NextResponse.json({ error: 'Only managers and above can import' }, { status: 403 })

  let formData: FormData
  try { formData = await request.formData() }
  catch { return NextResponse.json({ error: 'Could not read form data' }, { status: 400 }) }

  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
  if (!file.name.toLowerCase().endsWith('.xlsx'))
    return NextResponse.json({ error: 'Please upload an .xlsx file' }, { status: 400 })
  if (file.size > 5 * 1024 * 1024)
    return NextResponse.json({ error: 'File too large (max 5 MB)' }, { status: 400 })

  let sheets: Record<string, string[][]>
  try {
    const buffer = await file.arrayBuffer()
    sheets = await parseXlsx(buffer)
  } catch (e: any) {
    return NextResponse.json({ error: 'Could not parse Excel file: ' + (e?.message ?? 'unknown') }, { status: 400 })
  }

  const admin = createAdminClient()
  const orgId = mb.org_id

  const results = {
    members:   { created: 0, skipped: 0, errors: [] as string[] },
    clients:   { created: 0, skipped: 0, errors: [] as string[] },
    projects:  { created: 0, skipped: 0, errors: [] as string[] },
    tasks:     { created: 0, skipped: 0, errors: [] as string[] },
    recurring: { created: 0, skipped: 0, errors: [] as string[] },
  }

  // Email → user_id cache
  const emailCache: Record<string, string | null> = {}
  async function resolveEmail(email: string): Promise<string | null> {
    const e = email.toLowerCase().trim()
    if (!e) return null
    if (e in emailCache) return emailCache[e]
    const { data } = await admin.from('users').select('id').eq('email', e).maybeSingle()
    emailCache[e] = data?.id ?? null
    return emailCache[e]
  }

  // ── 1. MEMBERS ────────────────────────────────────────────────
  const memberSheet = Object.keys(sheets).find(k => norm(k).includes('member') || norm(k).includes('team'))
  if (memberSheet) {
    const rows = sheets[memberSheet]
    const hdrIdx = rows.findIndex(r => r.some(c => norm(c).includes('email')))
    if (hdrIdx !== -1) {
      const headers = rows[hdrIdx]
      const iName  = findCol(headers, 'fullname', 'name')
      const iEmail = findCol(headers, 'email')
      const iRole  = findCol(headers, 'role')
      for (const row of rows.slice(hdrIdx + 2)) {
        const email = cell(row, iEmail).toLowerCase()
        const name  = cell(row, iName)
        const role  = cell(row, iRole).toLowerCase() || 'member'
        if (!email || !email.includes('@')) continue
        if (!['admin','manager','member','viewer'].includes(role)) {
          results.members.errors.push(`${email}: invalid role "${role}"`); results.members.skipped++; continue
        }
        const uid = await resolveEmail(email)
        if (uid) {
          const { data: ex } = await admin.from('org_members').select('id, is_active').eq('org_id', orgId).eq('user_id', uid).maybeSingle()
          if (ex?.is_active) { results.members.skipped++; continue }
          if (ex) await admin.from('org_members').update({ is_active: true, role }).eq('id', ex.id)
          else    await admin.from('org_members').insert({ org_id: orgId, user_id: uid, role, is_active: true })
          if (name) await admin.from('users').update({ name }).eq('id', uid)
          results.members.created++
        } else {
          const { error: invErr } = await admin.auth.admin.inviteUserByEmail(email, {
            data: { invited_to_org: orgId, invited_role: role, full_name: name },
            redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
          })
          if (invErr) { results.members.errors.push(`${email}: ${invErr.message}`); results.members.skipped++ }
          else results.members.created++
        }
      }
    }
  }

  // ── 2. CLIENTS ────────────────────────────────────────────────
  const clientNameToId: Record<string, string> = {}
  const clientSheet = Object.keys(sheets).find(k => norm(k).includes('client'))
  if (clientSheet) {
    const rows = sheets[clientSheet]
    const hdrIdx = rows.findIndex(r => r.some(c => norm(c) === 'name' || norm(c).includes('clientname')))
    if (hdrIdx !== -1) {
      const headers = rows[hdrIdx]
      const iName    = findCol(headers, 'clientname', 'name')
      const iEmail   = findCol(headers, 'email')
      const iPhone   = findCol(headers, 'phone')
      const iCompany = findCol(headers, 'company')
      const iWebsite = findCol(headers, 'website')
      const iIndustry= findCol(headers, 'industry')
      const iColor   = findCol(headers, 'color', 'colour')
      const iStatus  = findCol(headers, 'status')
      const iNotes   = findCol(headers, 'notes')
      for (const row of rows.slice(hdrIdx + 2)) {
        const name = cell(row, iName)
        if (!name) continue
        const rawColor = cell(row, iColor) || '#0d9488'
        const color    = rawColor.startsWith('#') ? rawColor : `#${rawColor}`
        const status   = cell(row, iStatus) || 'active'
        // Check duplicate
        const { data: existing } = await admin.from('clients').select('id').eq('org_id', orgId).ilike('name', name).maybeSingle()
        if (existing?.id) { clientNameToId[name.toLowerCase()] = existing.id; results.clients.skipped++; continue }
        const { data: client, error: clientErr } = await admin.from('clients').insert({
          org_id:   orgId,
          name:     name.trim(),
          email:    cell(row, iEmail) || null,
          phone:    cell(row, iPhone) || null,
          company:  cell(row, iCompany) || null,
          website:  cell(row, iWebsite) || null,
          industry: cell(row, iIndustry) || null,
          color,
          status:   ['active','inactive','lead'].includes(status) ? status : 'active',
          notes:    cell(row, iNotes) || null,
          created_by: user.id,
        }).select('id').single()
        if (clientErr) { results.clients.errors.push(`"${name}": ${clientErr.message}`); results.clients.skipped++ }
        else { clientNameToId[name.toLowerCase()] = client.id; results.clients.created++ }
      }
    }
  }

  // ── 3. PROJECTS ───────────────────────────────────────────────
  const projNameToId: Record<string, string> = {}
  const projectSheet = Object.keys(sheets).find(k => norm(k).includes('project'))
  if (projectSheet) {
    const rows = sheets[projectSheet]
    const hdrIdx = rows.findIndex(r => r.some(c => norm(c).includes('projectname') || norm(c) === 'name'))
    if (hdrIdx !== -1) {
      const headers = rows[hdrIdx]
      const iName   = findCol(headers, 'projectname', 'name')
      const iColor  = findCol(headers, 'color', 'colour')
      const iStatus = findCol(headers, 'status')
      const iDue    = findCol(headers, 'duedate', 'due')
      const iOwner  = findCol(headers, 'owneremail', 'owner')
      const iClient = findCol(headers, 'clientname', 'client')
      const iBudget = findCol(headers, 'budget')
      const iHours  = findCol(headers, 'hourbudget', 'hours')
      const iDesc   = findCol(headers, 'description', 'desc')
      for (const row of rows.slice(hdrIdx + 2)) {
        const name = cell(row, iName)
        if (!name) continue
        const rawColor = cell(row, iColor) || '#0d9488'
        const color    = rawColor.startsWith('#') ? rawColor : `#${rawColor}`
        const status   = cell(row, iStatus) || 'active'
        if (!['active','on_hold','completed'].includes(status)) {
          results.projects.errors.push(`"${name}": invalid status "${status}"`); results.projects.skipped++; continue
        }
        const ownerId = cell(row, iOwner) ? (await resolveEmail(cell(row, iOwner))) ?? user.id : user.id
        // Resolve client by name (from this import or existing)
        const clientName = cell(row, iClient).toLowerCase()
        let clientId: string | null = clientNameToId[clientName] ?? null
        if (!clientId && clientName) {
          const { data: ec } = await admin.from('clients').select('id').eq('org_id', orgId).ilike('name', clientName).maybeSingle()
          clientId = ec?.id ?? null
        }
        const { data: proj, error: projErr } = await admin.from('projects').insert({
          org_id: orgId, name: name.trim(), color, status,
          due_date:     cell(row, iDue) || null,
          owner_id:     ownerId,
          client_id:    clientId,
          budget:       cell(row, iBudget) ? parseFloat(cell(row, iBudget)) : null,
          hours_budget: cell(row, iHours)  ? parseFloat(cell(row, iHours))  : null,
          description:  cell(row, iDesc) || null,
        }).select('id').single()
        if (projErr) { results.projects.errors.push(`"${name}": ${projErr.message}`); results.projects.skipped++ }
        else { projNameToId[name.toLowerCase()] = proj.id; results.projects.created++ }
      }
    }
  }

  // ── 4. TASKS ──────────────────────────────────────────────────
  const taskSheet = Object.keys(sheets).find(k => norm(k).includes('task') && !norm(k).includes('recurring'))
  if (taskSheet) {
    const rows = sheets[taskSheet]
    const hdrIdx = rows.findIndex(r => r.some(c => norm(c).includes('tasktitle') || norm(c) === 'title'))
    if (hdrIdx !== -1) {
      const headers = rows[hdrIdx]
      const iTitle    = findCol(headers, 'tasktitle', 'title')
      const iProject  = findCol(headers, 'projectname', 'project')
      const iAssignee = findCol(headers, 'assigneeemail', 'assignee')
      const iPriority = findCol(headers, 'priority')
      const iDue      = findCol(headers, 'duedate', 'due')
      const iStatus   = findCol(headers, 'status')
      const iHours    = findCol(headers, 'esthours', 'estimatedhours', 'hours')
      const iDesc     = findCol(headers, 'description', 'desc')
      const iClient   = findCol(headers, 'clientname', 'client')
      for (const row of rows.slice(hdrIdx + 2)) {
        const title = cell(row, iTitle)
        if (!title) continue
        const priority = cell(row, iPriority) || 'medium'
        if (!['none','low','medium','high','urgent'].includes(priority)) {
          results.tasks.errors.push(`"${title}": invalid priority "${priority}"`); results.tasks.skipped++; continue
        }
        const projectName = cell(row, iProject).toLowerCase()
        let projectId: string | null = projNameToId[projectName] ?? null
        if (!projectId && projectName) {
          const { data: ep } = await admin.from('projects').select('id').eq('org_id', orgId).ilike('name', projectName).maybeSingle()
          projectId = ep?.id ?? null
        }
        const clientName = cell(row, iClient).toLowerCase()
        let clientId: string | null = clientNameToId[clientName] ?? null
        if (!clientId && clientName) {
          const { data: ec } = await admin.from('clients').select('id').eq('org_id', orgId).ilike('name', clientName).maybeSingle()
          clientId = ec?.id ?? null
        }
        const assigneeId = cell(row, iAssignee) ? await resolveEmail(cell(row, iAssignee)) : null
        const status = cell(row, iStatus) || 'todo'
        const { error: taskErr } = await admin.from('tasks').insert({
          org_id: orgId, title: title.trim(),
          description: cell(row, iDesc) || null,
          status: ['todo','in_progress','completed','blocked'].includes(status) ? status : 'todo',
          priority, project_id: projectId, client_id: clientId, assignee_id: assigneeId,
          due_date: cell(row, iDue) || null,
          estimated_hours: cell(row, iHours) ? parseFloat(cell(row, iHours)) : null,
          created_by: user.id, is_recurring: false, approval_required: false,
        })
        if (taskErr) { results.tasks.errors.push(`"${title}": ${taskErr.message}`); results.tasks.skipped++ }
        else results.tasks.created++
      }
    }
  }

  // ── 5. RECURRING TASKS ────────────────────────────────────────
  const recurringSheet = Object.keys(sheets).find(k => norm(k).includes('recurring'))
  if (recurringSheet) {
    const rows = sheets[recurringSheet]
    const hdrIdx = rows.findIndex(r => r.some(c => norm(c) === 'title' || norm(c).includes('tasktitle')))
    if (hdrIdx !== -1) {
      const headers = rows[hdrIdx]
      const iTitle    = findCol(headers, 'tasktitle', 'title')
      const iFreq     = findCol(headers, 'frequency', 'freq')
      const iAssignee = findCol(headers, 'assigneeemail', 'assignee')
      const iPriority = findCol(headers, 'priority')
      const iProject  = findCol(headers, 'projectname', 'project')
      const iStart    = findCol(headers, 'startdate', 'start')
      const iDesc     = findCol(headers, 'description', 'desc')
      const VALID_FREQS = ['daily','weekly','bi_weekly','monthly','quarterly','annual']
      for (const row of rows.slice(hdrIdx + 2)) {
        const title = cell(row, iTitle)
        if (!title) continue
        const freq = norm(cell(row, iFreq))
        if (!VALID_FREQS.includes(freq)) {
          results.recurring.errors.push(`"${title}": invalid frequency "${freq}" — use: ${VALID_FREQS.join(', ')}`)
          results.recurring.skipped++; continue
        }
        const priority = cell(row, iPriority) || 'medium'
        if (!['none','low','medium','high','urgent'].includes(priority)) {
          results.recurring.errors.push(`"${title}": invalid priority "${priority}"`); results.recurring.skipped++; continue
        }
        const projectName = cell(row, iProject).toLowerCase()
        let projectId: string | null = projNameToId[projectName] ?? null
        if (!projectId && projectName) {
          const { data: ep } = await admin.from('projects').select('id').eq('org_id', orgId).ilike('name', projectName).maybeSingle()
          projectId = ep?.id ?? null
        }
        const assigneeId = cell(row, iAssignee) ? await resolveEmail(cell(row, iAssignee)) : null
        const startDate = cell(row, iStart) || new Date().toISOString().split('T')[0]
        const nextDate  = nextOccurrence(freq, startDate)
        const { error: recErr } = await admin.from('tasks').insert({
          org_id: orgId, title: title.trim(),
          description: cell(row, iDesc) || null,
          priority, status: 'todo',
          is_recurring: true, frequency: freq,
          next_occurrence_date: nextDate,
          assignee_id: assigneeId, project_id: projectId,
          created_by: user.id, approval_required: false,
        })
        if (recErr) { results.recurring.errors.push(`"${title}": ${recErr.message}`); results.recurring.skipped++ }
        else results.recurring.created++
      }
    }
  }

  const totalCreated = results.members.created + results.clients.created + results.projects.created + results.tasks.created + results.recurring.created
  return NextResponse.json({ success: true, results, totalCreated })
}
