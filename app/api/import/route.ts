import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse }       from 'next/server'
import type { NextRequest }   from 'next/server'
import { COMPLIANCE_TASKS }   from '@/lib/data/complianceTasks'

// Build a lookup map for compliance tasks by title (case-insensitive)
const COMPLIANCE_MAP = new Map(COMPLIANCE_TASKS.map(t => [t.title.toLowerCase().trim(), t]))
function findComplianceTask(title: string) {
  return COMPLIANCE_MAP.get(title.toLowerCase().trim()) ?? null
}

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
  if (idx < 0) return ''
  const raw = String(row[idx] ?? '')
  // Strip common formatting artifacts from paste: zero-width spaces, non-breaking spaces,
  // smart quotes, leading/trailing whitespace, and multiple internal spaces
  return raw
    .replace(/[​‌‍﻿ ]/g, ' ')  // zero-width + non-breaking spaces
    .replace(/[‘’]/g, "'")   // smart single quotes
    .replace(/[“”]/g, '"')   // smart double quotes
    .replace(/\s+/g, ' ')              // collapse multiple spaces
    .trim()
}

const VALID_ROLES     = ['owner','admin','manager','member','viewer']
const VALID_PRIORITY  = ['none','low','medium','high','urgent']
const VALID_STATUS    = ['todo','in_progress','completed','blocked','cancelled']
const VALID_FREQ      = ['daily','weekly','bi_weekly','monthly','quarterly','annual']
const VALID_CL_STATUS = ['active','inactive','lead']

function validateDropdown(value: string, allowed: string[], fieldName: string, rowNum: number): string | null {
  if (!value) return null  // empty is ok (will use default)
  if (!allowed.includes(value.toLowerCase())) {
    return `Row ${rowNum}: "${fieldName}" must be one of: ${allowed.join(', ')} (got "${value}")`
  }
  return null
}
// Skip sample/hint rows: contain placeholder text or @yourcompany.com
function isSampleRow(row: string[]): boolean {
  const joined = row.join(' ').toLowerCase()
  return joined.includes('yourcompany.com') ||
         joined.includes('must match') ||
         joined.includes('yyyy-mm-dd') ||
         joined.includes('clear action') ||
         joined.includes('unique name') ||
         joined.includes('optional') && row.filter(c => c.trim()).length < 3
}
function nextOccurrence(freq: string, from: string): string {
  const d = new Date(from || new Date().toISOString().split('T')[0])
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
    sheets = await parseXlsx(await file.arrayBuffer())
  } catch (e: any) {
    return NextResponse.json({ error: 'Could not parse file: ' + (e?.message ?? 'unknown') }, { status: 400 })
  }

  const admin  = createAdminClient()
  const orgId  = mb.org_id

  const results = {
    members:   { created: 0, skipped: 0, errors: [] as string[] },
    clients:   { created: 0, skipped: 0, errors: [] as string[] },
    projects:  { created: 0, skipped: 0, errors: [] as string[] },
    tasks:     { created: 0, skipped: 0, errors: [] as string[] },
    onetasks:  { created: 0, skipped: 0, errors: [] as string[] },
    recurring: { created: 0, skipped: 0, errors: [] as string[] },
  }

  // ── Email → user_id cache (checks app users table) ───────────
  const emailCache: Record<string, string | null> = {}
  async function resolveEmail(email: string): Promise<string | null> {
    const e = email.toLowerCase().trim()
    if (!e || !e.includes('@')) return null
    if (e in emailCache) return emailCache[e]
    // First check app users table
    const { data: appUser } = await admin.from('users').select('id').eq('email', e).maybeSingle()
    if (appUser?.id) { emailCache[e] = appUser.id; return appUser.id }
    emailCache[e] = null
    return null
  }

  // ── Resolve user from Supabase auth (fallback for auth-only users) ──
  async function resolveAuthUser(email: string): Promise<string | null> {
    try {
      const { data } = await admin.auth.admin.listUsers({ perPage: 1000 })
      const authUser = data?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase())
      return authUser?.id ?? null
    } catch { return null }
  }

  // ── 1. MEMBERS ────────────────────────────────────────────────
  const memberSheet = Object.keys(sheets).find(k =>
    norm(k).includes('member') || norm(k).startsWith('team')
  )
  if (memberSheet) {
    const rows = sheets[memberSheet]
    const hdrIdx = rows.findIndex(r => r.some(c => norm(c) === 'email' || norm(c) === 'email'))
    if (hdrIdx !== -1) {
      const headers = rows[hdrIdx]
      const iName  = findCol(headers, 'fullname', 'name')
      const iEmail = findCol(headers, 'email')
      const iRole  = findCol(headers, 'role')

      for (const row of rows.slice(hdrIdx + 2)) {
        if (isSampleRow(row)) continue
        const email = cell(row, iEmail).toLowerCase().trim()
        const name  = cell(row, iName)
        const rawRole = cell(row, iRole).toLowerCase().trim()
        const role    = VALID_ROLES.includes(rawRole) ? rawRole : 'member'
        if (rawRole && !VALID_ROLES.includes(rawRole)) {
          errors.push(`Row ${i + 2}: role "${rawRole}" invalid — using "member". Valid: ${VALID_ROLES.join(', ')}`)
        }
        if (!email || !email.includes('@')) continue
        if (!['admin', 'manager', 'member', 'viewer'].includes(role)) {
          results.members.errors.push(`${email}: invalid role "${role}"`)
          results.members.skipped++; continue
        }

        // Check if already a member
        let uid = await resolveEmail(email)

        // If not in app users table, check Supabase auth directly
        if (!uid) uid = await resolveAuthUser(email)

        if (uid) {
          // Ensure they're in app users table
          await admin.from('users').upsert(
            { id: uid, email, name: name || email.split('@')[0] },
            { onConflict: 'id', ignoreDuplicates: true }
          )
          // Check membership
          const { data: ex } = await admin.from('org_members')
            .select('id, is_active').eq('org_id', orgId).eq('user_id', uid).maybeSingle()
          if (ex?.is_active) { results.members.skipped++; continue }
          if (ex) {
            await admin.from('org_members').update({ is_active: true, role }).eq('id', ex.id)
          } else {
            await admin.from('org_members').insert({ org_id: orgId, user_id: uid, role, is_active: true })
          }
          if (name) await admin.from('users').update({ name }).eq('id', uid)
          results.members.created++
        } else {
          // New user — invite via Supabase auth
          const { error: invErr } = await admin.auth.admin.inviteUserByEmail(email, {
            data: { invited_to_org: orgId, invited_role: role, full_name: name || null },
            redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
          })
          if (invErr) {
            // "already registered" means they exist in auth but not users table — re-resolve
            if (invErr.message?.toLowerCase().includes('already') || invErr.message?.toLowerCase().includes('registered')) {
              const authId = await resolveAuthUser(email)
              if (authId) {
                await admin.from('users').upsert(
                  { id: authId, email, name: name || email.split('@')[0] },
                  { onConflict: 'id', ignoreDuplicates: true }
                )
                const { data: ex2 } = await admin.from('org_members')
                  .select('id, is_active').eq('org_id', orgId).eq('user_id', authId).maybeSingle()
                if (!ex2?.is_active) {
                  if (ex2) await admin.from('org_members').update({ is_active: true, role }).eq('id', ex2.id)
                  else await admin.from('org_members').insert({ org_id: orgId, user_id: authId, role, is_active: true })
                  results.members.created++
                } else {
                  results.members.skipped++
                }
              } else {
                results.members.errors.push(`${email}: user exists in auth but could not be resolved`)
                results.members.skipped++
              }
            } else {
              results.members.errors.push(`${email}: ${invErr.message}`)
              results.members.skipped++
            }
          } else {
            // Invite sent successfully — also resolve their new auth ID and
            // pre-create the org_members row so they land in the org even
            // if they sign in directly without clicking the invite link.
            const newAuthId = await resolveAuthUser(email)
            if (newAuthId) {
              await admin.from('users').upsert(
                { id: newAuthId, email, name: name || email.split('@')[0] },
                { onConflict: 'id', ignoreDuplicates: true }
              )
              await admin.from('org_members').insert({
                org_id: orgId, user_id: newAuthId, role, is_active: true,
              }).onConflict ? undefined : undefined // ignore if already exists
              // upsert to be safe
              await admin.from('org_members').upsert(
                { org_id: orgId, user_id: newAuthId, role, is_active: true },
                { onConflict: 'org_id,user_id', ignoreDuplicates: false }
              )
            }
            results.members.created++
          }
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
      const iName     = findCol(headers, 'clientname', 'name')
      const iEmail    = findCol(headers, 'email')
      const iPhone    = findCol(headers, 'phone number', 'phone', 'mobile')
      const iCompany  = findCol(headers, 'company')
      const iWebsite  = findCol(headers, 'website')
      const iIndustry = findCol(headers, 'industry')
      const iColor    = findCol(headers, 'color', 'colour')
      const iStatus   = findCol(headers, 'status')
      const iNotes    = findCol(headers, 'notes')
      for (const row of rows.slice(hdrIdx + 2)) {
        if (isSampleRow(row)) continue
        const name = cell(row, iName)
        if (!name) continue
        const rawColor = cell(row, iColor) || '#0d9488'
        const color    = rawColor.startsWith('#') ? rawColor : `#${rawColor}`
        const status   = cell(row, iStatus) || 'active'
        const { data: existing } = await admin.from('clients').select('id').eq('org_id', orgId).ilike('name', name).maybeSingle()
        if (existing?.id) { clientNameToId[name.toLowerCase()] = existing.id; results.clients.skipped++; continue }
        const { data: c, error: cErr } = await admin.from('clients').insert({
          org_id: orgId, name: name.trim(),
          email:    cell(row, iEmail)    || null,
          phone_number: cell(row, iPhone) || null,
          company:  cell(row, iCompany)  || null,
          website:  cell(row, iWebsite)  || null,
          industry: cell(row, iIndustry) || null,
          color, status: ['active','inactive','lead'].includes(status) ? status : 'active',
          notes: cell(row, iNotes) || null,
          created_by: user.id,
        }).select('id').single()
        if (cErr) { results.clients.errors.push(`"${name}": ${cErr.message}`); results.clients.skipped++ }
        else { clientNameToId[name.toLowerCase()] = c.id; results.clients.created++ }
      }
    }
  }

  // ── Helper: resolve project name → id ────────────────────────
  const projNameToId: Record<string, string> = {}
  async function resolveProject(rawName: string): Promise<string | null> {
    const n = rawName.toLowerCase().trim()
    if (!n) return null
    if (projNameToId[n]) return projNameToId[n]
    const { data } = await admin.from('projects').select('id').eq('org_id', orgId).ilike('name', n).maybeSingle()
    if (data?.id) projNameToId[n] = data.id
    return data?.id ?? null
  }
  // Helper: resolve client name → id
  async function resolveClient(rawName: string): Promise<string | null> {
    const n = rawName.toLowerCase().trim()
    if (!n) return null
    if (clientNameToId[n]) return clientNameToId[n]
    const { data } = await admin.from('clients').select('id').eq('org_id', orgId).ilike('name', n).maybeSingle()
    if (data?.id) clientNameToId[n] = data.id
    return data?.id ?? null
  }

  // ── 3. PROJECTS ───────────────────────────────────────────────
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
      const iHours  = findCol(headers, 'hoursbudget', 'hours')
      const iDesc   = findCol(headers, 'description', 'desc')
      for (const row of rows.slice(hdrIdx + 2)) {
        if (isSampleRow(row)) continue
        const name = cell(row, iName)
        if (!name) continue
        const rawColor = cell(row, iColor) || '#0d9488'
        const color    = rawColor.startsWith('#') ? rawColor : `#${rawColor}`
        const status   = cell(row, iStatus) || 'active'
        if (!['active','on_hold','completed'].includes(status)) {
          results.projects.errors.push(`"${name}": invalid status "${status}"`); results.projects.skipped++; continue
        }
        const ownerId  = cell(row, iOwner) ? (await resolveEmail(cell(row, iOwner))) ?? user.id : user.id
        const clientId = await resolveClient(cell(row, iClient))
        const { data: proj, error: pErr } = await admin.from('projects').insert({
          org_id: orgId, name: name.trim(), color, status,
          due_date:     cell(row, iDue)    || null,
          owner_id:     ownerId,
          client_id:    clientId,
          budget:       cell(row, iBudget) ? parseFloat(cell(row, iBudget)) : null,
          hours_budget: cell(row, iHours)  ? parseFloat(cell(row, iHours))  : null,
          description:  cell(row, iDesc)   || null,
        }).select('id').single()
        if (pErr) { results.projects.errors.push(`"${name}": ${pErr.message}`); results.projects.skipped++ }
        else { projNameToId[name.toLowerCase()] = proj.id; results.projects.created++ }
      }
    }
  }

  // ── 4. TASKS (project tasks) ───────────────────────────────────
  const taskSheet = Object.keys(sheets).find(k =>
    norm(k).includes('task') && !norm(k).includes('recurring') && !norm(k).includes('one') && !norm(k).includes('onetim')
  )
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
        if (isSampleRow(row)) continue
        const title = cell(row, iTitle)
        if (!title) continue
        const priority = cell(row, iPriority) || 'medium'
        if (!['none','low','medium','high','urgent'].includes(priority)) {
          results.tasks.errors.push(`"${title}": invalid priority "${priority}"`); results.tasks.skipped++; continue
        }
        const projectId  = await resolveProject(cell(row, iProject))
        const clientId   = await resolveClient(cell(row, iClient))
        const assigneeData = cell(row, iAssignee) ? await resolveEmails(cell(row, iAssignee)) : { primary: null, coAssignees: [] }
        const assigneeId = assigneeData.primary
        const status     = cell(row, iStatus) || 'todo'
        const { error: tErr } = await admin.from('tasks').insert({
          org_id: orgId, title: title.trim(),
          description: cell(row, iDesc) || null,
          status: ['todo','in_progress','completed','blocked'].includes(status) ? status : 'todo',
          priority, project_id: projectId, client_id: clientId, assignee_id: assigneeId,
          due_date: cell(row, iDue) || null,
          estimated_hours: cell(row, iHours) ? parseFloat(cell(row, iHours)) : null,
          created_by: user.id, is_recurring: false, approval_required: false,
          custom_fields: assigneeData.coAssignees.length > 0 ? { _co_assignees: assigneeData.coAssignees } : null,
        })
        if (tErr) { results.tasks.errors.push(`"${title}": ${tErr.message}`); results.tasks.skipped++ }
        else results.tasks.created++
      }
    }
  }

  // ── 5. ONE-TIME TASKS (no project) ────────────────────────────
  const oneTimeSheet = Object.keys(sheets).find(k =>
    norm(k).includes('onetime') || norm(k).includes('onetim') || norm(k).includes('inbox') || norm(k).includes('one')
  )
  if (oneTimeSheet) {
    const rows = sheets[oneTimeSheet]
    const hdrIdx = rows.findIndex(r => r.some(c => norm(c).includes('tasktitle') || norm(c) === 'title'))
    if (hdrIdx !== -1) {
      const headers = rows[hdrIdx]
      const iTitle    = findCol(headers, 'tasktitle', 'title')
      const iAssignee = findCol(headers, 'assigneeemail', 'assignee')
      const iPriority = findCol(headers, 'priority')
      const iDue      = findCol(headers, 'duedate', 'due')
      const iClient   = findCol(headers, 'clientname', 'client')
      const iHours    = findCol(headers, 'esthours', 'estimatedhours', 'hours')
      const iDesc     = findCol(headers, 'description', 'desc')
      for (const row of rows.slice(hdrIdx + 2)) {
        if (isSampleRow(row)) continue
        const title = cell(row, iTitle)
        if (!title) continue
        const priority = cell(row, iPriority) || 'medium'
        if (!['none','low','medium','high','urgent'].includes(priority)) {
          results.onetasks.errors.push(`"${title}": invalid priority "${priority}"`); results.onetasks.skipped++; continue
        }
        const clientId   = await resolveClient(cell(row, iClient))
        const assigneeData2 = cell(row, iAssignee) ? await resolveEmails(cell(row, iAssignee)) : { primary: null, coAssignees: [] }
        const assigneeId = assigneeData2.primary
        // Check for compliance_task_type column
        const iCompliance = findCol(headers, 'compliancetasktype', 'compliance', 'compliancetask')
        const complianceType = cell(row, iCompliance)
        const compTask = complianceType ? findComplianceTask(complianceType) : null
        // If compliance type found, use its title and priority
        const finalTitle    = compTask ? compTask.title : title.trim()
        const finalPriority = compTask ? compTask.priority : priority

        const { data: newTask, error: tErr } = await admin.from('tasks').insert({
          org_id: orgId, title: finalTitle,
          description: cell(row, iDesc) || null,
          status: 'todo', priority: finalPriority,
          project_id: null,
          client_id: clientId,
          assignee_id: assigneeId,
          due_date: cell(row, iDue) || null,
          estimated_hours: cell(row, iHours) ? parseFloat(cell(row, iHours)) : null,
          created_by: user.id, is_recurring: false, approval_required: false,
          custom_fields: assigneeData2.coAssignees.length > 0 ? { _co_assignees: assigneeData2.coAssignees } : null,
        }).select('id').single()
        if (tErr) { results.onetasks.errors.push(`"${finalTitle}": ${tErr.message}`); results.onetasks.skipped++ }
        else {
          results.onetasks.created++
          // Create compliance subtasks if compliance task type matched
          if (compTask && newTask?.id && compTask.subtasks.length > 0) {
            const subtaskInserts = compTask.subtasks.map(s => ({
              org_id: orgId, title: s.title, status: 'todo' as const,
              priority: compTask.priority, assignee_id: assigneeId || null,
              client_id: clientId || null, due_date: cell(row, iDue) || null,
              parent_task_id: newTask.id, created_by: user.id, is_recurring: false,
              custom_fields: s.required ? { _compliance_subtask: true } : null,
            }))
            await admin.from('tasks').insert(subtaskInserts)
          }
        }
      }
    }
  }

  // ── 6. RECURRING TASKS ────────────────────────────────────────
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
      const iClient   = findCol(headers, 'clientname', 'client')
      const iStart    = findCol(headers, 'startdate', 'start')
      const iDesc     = findCol(headers, 'description', 'desc')
      const VALID_FREQS = ['daily','weekly','bi_weekly','monthly','quarterly','annual']
      for (const row of rows.slice(hdrIdx + 2)) {
        if (isSampleRow(row)) continue
        const title = cell(row, iTitle)
        if (!title) continue
        const freq = norm(cell(row, iFreq))
        if (!VALID_FREQS.includes(freq)) {
          results.recurring.errors.push(`"${title}": invalid frequency "${freq}"`); results.recurring.skipped++; continue
        }
        const priority = cell(row, iPriority) || 'medium'
        if (!['none','low','medium','high','urgent'].includes(priority)) {
          results.recurring.errors.push(`"${title}": invalid priority "${priority}"`); results.recurring.skipped++; continue
        }
        const projectId  = await resolveProject(cell(row, iProject))
        const clientId   = await resolveClient(cell(row, iClient))
        const assigneeData3 = cell(row, iAssignee) ? await resolveEmails(cell(row, iAssignee)) : { primary: null, coAssignees: [] }
        const assigneeId = assigneeData3.primary
        const startDate  = cell(row, iStart) || new Date().toISOString().split('T')[0]
        const { error: rErr } = await admin.from('tasks').insert({
          org_id: orgId, title: title.trim(),
          description: cell(row, iDesc) || null,
          priority, status: 'todo',
          is_recurring: true, frequency: freq,
          next_occurrence_date: nextOccurrence(freq, startDate),
          assignee_id: assigneeId, project_id: projectId,
          client_id: clientId,
          created_by: user.id, approval_required: false,
          custom_fields: assigneeData3.coAssignees.length > 0 ? { _co_assignees: assigneeData3.coAssignees } : null,
        })
        if (rErr) { results.recurring.errors.push(`"${title}": ${rErr.message}`); results.recurring.skipped++ }
        else results.recurring.created++
      }
    }
  }

  const totalCreated = Object.values(results).reduce((s, r) => s + r.created, 0)
  // ── 7. CA COMPLIANCE TASKS SHEET ─────────────────────────────
  const caSheet = Object.keys(sheets).find(k =>
    norm(k).includes('cacompliance') || (norm(k).includes('compliance') && !norm(k).includes('non'))
  )
  if (caSheet) {
    const caResults = { created: 0, skipped: 0, errors: [] as string[] }
    const rows = sheets[caSheet]
    const hdrIdx = rows.findIndex(r =>
      r.some(cc => norm(cc).includes('compliance') || norm(cc).includes('tasktype'))
    )
    if (hdrIdx !== -1) {
      const headers = rows[hdrIdx]
      const iType     = findCol(headers, 'compliancetasktype', 'tasktype', 'compliance')
      const iClient   = findCol(headers, 'clientname', 'client')
      const iAssignee = findCol(headers, 'assigneeemail', 'assignee')
      const iDue      = findCol(headers, 'duedate', 'due')
      const iPriority = findCol(headers, 'priority')
      const iFreq     = findCol(headers, 'frequency', 'freq')
      for (const row of rows.slice(hdrIdx + 2)) {
        if (isSampleRow(row)) continue
        const typeName = cell(row, iType); if (!typeName) continue
        const compTask = findComplianceTask(typeName)
        if (!compTask) { caResults.errors.push(`"${typeName}": not recognised`); caResults.skipped++; continue }
        const clientId   = await resolveClient(cell(row, iClient))
        const assigneeData4 = cell(row, iAssignee) ? await resolveEmails(cell(row, iAssignee)) : { primary: null, coAssignees: [] }
        const assigneeId = assigneeData4.primary
        const priority   = cell(row, iPriority) || compTask.priority
        const dueDate    = cell(row, iDue) || null
        const freqRaw    = cell(row, iFreq)
        const freqMap: Record<string,string> = { daily:'daily',weekly:'weekly',monthly:'monthly',quarterly:'quarterly',annual:'annual',yearly:'annual',biweekly:'bi_weekly',fortnightly:'bi_weekly' }
        const frequency  = freqRaw ? (freqMap[norm(freqRaw)] ?? 'monthly') : null
        const { data: newTask, error: tErr } = await admin.from('tasks').insert({
          org_id: orgId, title: compTask.title, status: 'todo', priority,
          client_id: clientId, assignee_id: assigneeId, due_date: dueDate,
          is_recurring: !!frequency, frequency: frequency ?? undefined,
          next_occurrence_date: frequency && dueDate ? dueDate : null,
          created_by: user.id, approval_required: false,
          custom_fields: assigneeData4.coAssignees.length > 0 ? { _co_assignees: assigneeData4.coAssignees } : null,
        }).select('id').single()
        if (tErr) { caResults.errors.push(`"${compTask.title}": ${tErr.message}`); caResults.skipped++ }
        else {
          caResults.created++
          if (newTask?.id && compTask.subtasks.length > 0) {
            await admin.from('tasks').insert(compTask.subtasks.map(s => ({
              org_id: orgId, title: s.title, status: 'todo' as const, priority,
              assignee_id: assigneeId || null, client_id: clientId || null, due_date: dueDate,
              parent_task_id: newTask.id, created_by: user.id, is_recurring: false,
              custom_fields: s.required ? { _compliance_subtask: true } : null,
            })))
          }
        }
      }
    }
    ;(results as any).compliance = caResults
    totalCreated += caResults.created
  }

  return NextResponse.json({ success: true, results, totalCreated })
}

async function resolveEmails(emailStr: string): Promise<{ primary: string | null; coAssignees: string[] }> {
  if (!emailStr.trim()) return { primary: null, coAssignees: [] }
  const emails = emailStr.split(',').map(e => e.trim()).filter(Boolean)
  const ids = await Promise.all(emails.map(e => resolveEmail(e)))
  const validIds = ids.filter(Boolean) as string[]
  return { primary: validIds[0] ?? null, coAssignees: validIds.slice(1) }
}

