import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { COMPLIANCE_TASKS } from '@/lib/data/complianceTasks'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

type SheetMap = Record<string, string[][]>

type ImportBucket = {
  created: number
  skipped: number
  errors: string[]
}

type ImportResults = {
  members: ImportBucket
  clients: ImportBucket
  projects: ImportBucket
  tasks: ImportBucket
  onetasks: ImportBucket
  recurring: ImportBucket
  compliance: ImportBucket
}

const VALID_ROLES = ['owner', 'admin', 'manager', 'member', 'viewer'] as const
const VALID_PRIORITY = ['none', 'low', 'medium', 'high', 'urgent'] as const
const VALID_STATUS = ['todo', 'in_progress', 'completed', 'blocked', 'cancelled'] as const
const VALID_PROJECT_STATUS = ['active', 'on_hold', 'completed'] as const
const VALID_FREQ = ['daily', 'weekly', 'bi_weekly', 'monthly', 'quarterly', 'annual'] as const
const VALID_CLIENT_STATUS = ['active', 'inactive', 'lead'] as const

const COMPLIANCE_MAP = new Map(
  COMPLIANCE_TASKS.map((t) => [t.title.toLowerCase().trim(), t])
)

function findComplianceTask(title: string) {
  return COMPLIANCE_MAP.get(title.toLowerCase().trim()) ?? null
}

function norm(value: string) {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function cleanCell(value: unknown): string {
  return String(value ?? '')
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, ' ')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

function cell(row: string[], idx: number): string {
  if (idx < 0) return ''
  return cleanCell(row[idx] ?? '')
}

function findCol(headers: string[], ...keys: string[]): number {
  for (const key of keys) {
    const k = norm(key)
    const idx = headers.findIndex((h) => norm(h).includes(k))
    if (idx !== -1) return idx
  }
  return -1
}

function isValidDateString(v: string): boolean {
  if (!v) return false
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const d = new Date(`${v}T00:00:00.000Z`)
  return !Number.isNaN(d.getTime())
}

function cellDate(row: string[], idx: number): string | null {
  const v = cell(row, idx)
  if (!v) return null

  if (isValidDateString(v)) return v

  const parsed = new Date(v)
  if (Number.isNaN(parsed.getTime())) return null

  const yyyy = parsed.getUTCFullYear()
  const mm = String(parsed.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(parsed.getUTCDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function nextOccurrence(freq: string, from: string): string {
  const d = new Date(`${from}T00:00:00.000Z`)
  switch (freq) {
    case 'daily':
      d.setUTCDate(d.getUTCDate() + 1)
      break
    case 'weekly':
      d.setUTCDate(d.getUTCDate() + 7)
      break
    case 'bi_weekly':
      d.setUTCDate(d.getUTCDate() + 14)
      break
    case 'monthly':
      d.setUTCMonth(d.getUTCMonth() + 1)
      break
    case 'quarterly':
      d.setUTCMonth(d.getUTCMonth() + 3)
      break
    case 'annual':
      d.setUTCFullYear(d.getUTCFullYear() + 1)
      break
  }
  return d.toISOString().slice(0, 10)
}

function isInstructionRow(row: string[]): boolean {
  const joined = row.map(cleanCell).join(' | ').toLowerCase()
  return (
    joined.includes('yyyy-mm-dd') ||
    joined.includes('optional') ||
    joined.includes('must match') ||
    joined.includes('manager | member | viewer') ||
    joined.includes('none|low|medium|high|urgent') ||
    joined.includes('active | on_hold | completed') ||
    joined.includes('todo|in_progress|completed')
  )
}

function dataRowsAfterHeader(rows: string[][], headerIndex: number): string[][] {
  const tail = rows.slice(headerIndex + 1)
  if (tail.length > 0 && isInstructionRow(tail[0])) {
    return tail.slice(1)
  }
  return tail
}

const PLACEHOLDER_EMAIL_DOMAINS = [
  '@yourcompany.com',
  '@company.com',
  '@acme.com',
  '@gargsons.com',
  '@mehraandco.com',
]

const SAMPLE_NAMES = new Set([
  'alex johnson',
  'priya sharma',
  'carlos ruiz',
  'sam gupta',
  'riya nair',
  'acme corp',
  'garg sons',
  'mehra & co',
  'website redesign',
  'mobile app v2',
  'q3 marketing push',
  'design homepage wireframes',
  'set up ci/cd pipeline',
  'write api documentation',
  'create social media calendar',
  'competitor analysis report',
])

function hasOnlyPlaceholderEmails(row: string[]): boolean {
  const emails = row
    .map(cleanCell)
    .filter((v) => v.includes('@'))
    .map((v) => v.toLowerCase())

  if (emails.length === 0) return true
  return emails.every((e) => PLACEHOLDER_EMAIL_DOMAINS.some((d) => e.includes(d)))
}

function isSampleRow(row: string[]): boolean {
  const values = row.map(cleanCell)
  const nonEmpty = values.filter(Boolean)
  if (nonEmpty.length === 0) return true

  const first = (values[0] ?? '').toLowerCase()
  if (!first) return true

  if (first.includes('replace me')) return true

  if (SAMPLE_NAMES.has(first) && hasOnlyPlaceholderEmails(values)) return true

  return false
}

async function parseXlsx(buffer: ArrayBuffer): Promise<SheetMap> {
  const XLSX = await import('xlsx')
  const wb = XLSX.read(new Uint8Array(buffer), { type: 'array', raw: false })
  const result: SheetMap = {}

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<string[]>(ws, {
      header: 1,
      defval: '',
      raw: false,
    })
    result[sheetName] = rows as string[][]
  }

  return result
}

function initBucket(): ImportBucket {
  return { created: 0, skipped: 0, errors: [] }
}

function safeLower(v: string) {
  return cleanCell(v).toLowerCase()
}

function toNullableNumber(v: string): number | null {
  if (!v) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function findSheetName(sheets: SheetMap, predicates: ((name: string) => boolean)[]): string | undefined {
  return Object.keys(sheets).find((name) => predicates.some((p) => p(name)))
}

function normalizeFreq(raw: string): string | null {
  const v = norm(raw)
  const map: Record<string, string> = {
    daily: 'daily',
    weekly: 'weekly',
    biweekly: 'bi_weekly',
    biweeklytask: 'bi_weekly',
    bi_weekly: 'bi_weekly',
    fortnightly: 'bi_weekly',
    monthly: 'monthly',
    quarterly: 'quarterly',
    annual: 'annual',
    yearly: 'annual',
  }
  return map[v] ?? null
}

async function resolveEmails(
  emailStr: string,
  resolver: (email: string) => Promise<string | null>
): Promise<{ primary: string | null; coAssignees: string[] }> {
  if (!emailStr.trim()) return { primary: null, coAssignees: [] }

  const emails = emailStr
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean)

  const ids = await Promise.all(emails.map((e) => resolver(e)))
  const validIds = ids.filter(Boolean) as string[]

  return {
    primary: validIds[0] ?? null,
    coAssignees: validIds.slice(1),
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { data: membership } = await supabase
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!membership || !['owner', 'admin', 'manager'].includes(membership.role)) {
    return NextResponse.json(
      { error: 'Only managers and above can import' },
      { status: 403 }
    )
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Could not read form data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
  }

  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    return NextResponse.json({ error: 'Please upload an .xlsx file' }, { status: 400 })
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json(
      { error: 'File too large (max 5 MB)' },
      { status: 400 }
    )
  }

  let sheets: SheetMap
  try {
    sheets = await parseXlsx(await file.arrayBuffer())
  } catch (e: any) {
    return NextResponse.json(
      { error: `Could not parse file: ${e?.message ?? 'unknown'}` },
      { status: 400 }
    )
  }

  const admin = createAdminClient()
  const orgId = membership.org_id

  const results: ImportResults = {
    members: initBucket(),
    clients: initBucket(),
    projects: initBucket(),
    tasks: initBucket(),
    onetasks: initBucket(),
    recurring: initBucket(),
    compliance: initBucket(),
  }

  const emailCache: Record<string, string | null> = {}
  const projectNameToId: Record<string, string> = {}
  const clientNameToId: Record<string, string> = {}

  try {
    const [orgMembersRes, appUsersRes, authUsersRes] = await Promise.all([
      admin
        .from('org_members')
        .select('user_id, users(id, email)')
        .eq('org_id', orgId),
      admin.from('users').select('id, email').limit(5000),
      admin.auth.admin.listUsers({ perPage: 1000 }),
    ])

    for (const m of orgMembersRes.data ?? []) {
      const email = (m.users as any)?.email?.toLowerCase?.()
      if (email && m.user_id) emailCache[email] = m.user_id
    }

    for (const u of appUsersRes.data ?? []) {
      const email = u.email?.toLowerCase?.()
      if (email && !emailCache[email]) emailCache[email] = u.id
    }

    for (const u of authUsersRes.data?.users ?? []) {
      const email = u.email?.toLowerCase?.()
      if (email && !emailCache[email]) emailCache[email] = u.id
    }
  } catch (e) {
    console.error('[import] Failed to pre-build email cache:', e)
  }

  async function resolveEmail(email: string): Promise<string | null> {
    const e = safeLower(email)
    if (!e || !e.includes('@')) return null
    return emailCache[e] ?? null
  }

  async function resolveClient(rawName: string): Promise<string | null> {
    const key = safeLower(rawName)
    if (!key) return null
    if (clientNameToId[key]) return clientNameToId[key]

    const { data } = await admin
      .from('clients')
      .select('id')
      .eq('org_id', orgId)
      .ilike('name', rawName.trim())
      .maybeSingle()

    if (data?.id) clientNameToId[key] = data.id
    return data?.id ?? null
  }

  async function resolveProject(rawName: string): Promise<string | null> {
    const key = safeLower(rawName)
    if (!key) return null
    if (projectNameToId[key]) return projectNameToId[key]

    const { data } = await admin
      .from('projects')
      .select('id')
      .eq('org_id', orgId)
      .ilike('name', rawName.trim())
      .maybeSingle()

    if (data?.id) projectNameToId[key] = data.id
    return data?.id ?? null
  }

  // 1) MEMBERS
  const membersSheet = findSheetName(sheets, [
    (n) => norm(n).includes('member'),
    (n) => norm(n).includes('team'),
  ])

  if (membersSheet) {
    const rows = sheets[membersSheet]
    const headerIndex = rows.findIndex((r) =>
      r.some((c) => norm(c) === 'email' || norm(c).includes('fullname'))
    )

    if (headerIndex !== -1) {
      const headers = rows[headerIndex]
      const iName = findCol(headers, 'fullname', 'name')
      const iEmail = findCol(headers, 'email')
      const iRole = findCol(headers, 'role')

      for (const row of dataRowsAfterHeader(rows, headerIndex)) {
        if (isSampleRow(row)) continue

        const email = safeLower(cell(row, iEmail))
        const name = cell(row, iName)
        const roleRaw = safeLower(cell(row, iRole))
        const role = VALID_ROLES.includes(roleRaw as any) ? roleRaw : 'member'

        if (!email || !email.includes('@')) continue

        if (roleRaw && !VALID_ROLES.includes(roleRaw as any)) {
          results.members.errors.push(
            `"${email}": invalid role "${roleRaw}" — defaulted to "member"`
          )
        }

        let userId = await resolveEmail(email)

        if (userId) {
          await admin.from('users').upsert(
            {
              id: userId,
              email,
              name: name || email.split('@')[0],
            },
            { onConflict: 'id' }
          )

          const { data: existingMember } = await admin
            .from('org_members')
            .select('id, is_active')
            .eq('org_id', orgId)
            .eq('user_id', userId)
            .maybeSingle()

          if (existingMember?.is_active) {
            results.members.skipped++
            continue
          }

          if (existingMember?.id) {
            await admin
              .from('org_members')
              .update({ is_active: true, role })
              .eq('id', existingMember.id)
          } else {
            await admin.from('org_members').insert({
              org_id: orgId,
              user_id: userId,
              role,
              is_active: true,
            })
          }

          if (name) {
            await admin.from('users').update({ name }).eq('id', userId)
          }

          results.members.created++
          continue
        }

        const { error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
          data: {
            invited_to_org: orgId,
            invited_role: role,
            full_name: name || null,
          },
          redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
        })

        if (inviteErr) {
          results.members.errors.push(`${email}: ${inviteErr.message}`)
          results.members.skipped++
          continue
        }

        const authLookup = await admin.auth.admin.listUsers({ perPage: 1000 })
        const invited = authLookup.data?.users?.find(
          (u) => u.email?.toLowerCase() === email
        )

        if (invited?.id) {
          emailCache[email] = invited.id

          await admin.from('users').upsert(
            {
              id: invited.id,
              email,
              name: name || email.split('@')[0],
            },
            { onConflict: 'id' }
          )

          await admin.from('org_members').upsert(
            {
              org_id: orgId,
              user_id: invited.id,
              role,
              is_active: true,
            },
            { onConflict: 'org_id,user_id' }
          )
        }

        results.members.created++
      }
    }
  }

  // 2) CLIENTS
  const clientsSheet = findSheetName(sheets, [
    (n) => norm(n).includes('client'),
  ])

  if (clientsSheet) {
    const rows = sheets[clientsSheet]
    const headerIndex = rows.findIndex((r) =>
      r.some((c) => norm(c) === 'name' || norm(c).includes('clientname'))
    )

    if (headerIndex !== -1) {
      const headers = rows[headerIndex]
      const iName = findCol(headers, 'clientname', 'name')
      const iEmail = findCol(headers, 'email')
      const iPhone = findCol(headers, 'phone', 'mobile', 'phonenumber')
      const iCompany = findCol(headers, 'company')
      const iWebsite = findCol(headers, 'website')
      const iIndustry = findCol(headers, 'industry')
      const iColor = findCol(headers, 'color', 'colour')
      const iStatus = findCol(headers, 'status')
      const iNotes = findCol(headers, 'notes')

      for (const row of dataRowsAfterHeader(rows, headerIndex)) {
        if (isSampleRow(row)) continue

        const name = cell(row, iName)
        if (!name) continue

        const existing = await admin
          .from('clients')
          .select('id')
          .eq('org_id', orgId)
          .ilike('name', name.trim())
          .maybeSingle()

        if (existing.data?.id) {
          clientNameToId[safeLower(name)] = existing.data.id
          results.clients.skipped++
          continue
        }

        const colorRaw = cell(row, iColor) || '#0d9488'
        const color = colorRaw.startsWith('#') ? colorRaw : `#${colorRaw}`
        const statusRaw = safeLower(cell(row, iStatus) || 'active')
        const status = VALID_CLIENT_STATUS.includes(statusRaw as any)
          ? statusRaw
          : 'active'

        if (statusRaw && !VALID_CLIENT_STATUS.includes(statusRaw as any)) {
          results.clients.errors.push(
            `"${name}": invalid status "${statusRaw}" — defaulted to "active"`
          )
        }

        const { data, error } = await admin
          .from('clients')
          .insert({
            org_id: orgId,
            name: name.trim(),
            email: cell(row, iEmail) || null,
            phone_number: cell(row, iPhone) || null,
            company: cell(row, iCompany) || null,
            website: cell(row, iWebsite) || null,
            industry: cell(row, iIndustry) || null,
            color,
            status,
            notes: cell(row, iNotes) || null,
            created_by: user.id,
          })
          .select('id')
          .single()

        if (error) {
          results.clients.errors.push(`"${name}": ${error.message}`)
          results.clients.skipped++
        } else {
          clientNameToId[safeLower(name)] = data.id
          results.clients.created++
        }
      }
    }
  }

  // 3) PROJECTS
  const projectsSheet = findSheetName(sheets, [
    (n) => norm(n).includes('project'),
  ])

  if (projectsSheet) {
    const rows = sheets[projectsSheet]
    const headerIndex = rows.findIndex((r) =>
      r.some((c) => norm(c).includes('projectname') || norm(c) === 'name')
    )

    if (headerIndex !== -1) {
      const headers = rows[headerIndex]
      const iName = findCol(headers, 'projectname', 'name')
      const iColor = findCol(headers, 'color', 'colour')
      const iStatus = findCol(headers, 'status')
      const iDue = findCol(headers, 'duedate', 'due')
      const iOwner = findCol(headers, 'owneremail', 'owner')
      const iClient = findCol(headers, 'clientname', 'client')
      const iBudget = findCol(headers, 'budget')
      const iHours = findCol(headers, 'hoursbudget', 'hours')
      const iDesc = findCol(headers, 'description', 'desc')

      for (const row of dataRowsAfterHeader(rows, headerIndex)) {
        if (isSampleRow(row)) continue

        const name = cell(row, iName)
        if (!name) continue

        const existing = await admin
          .from('projects')
          .select('id')
          .eq('org_id', orgId)
          .ilike('name', name.trim())
          .maybeSingle()

        if (existing.data?.id) {
          projectNameToId[safeLower(name)] = existing.data.id
          results.projects.skipped++
          continue
        }

        const colorRaw = cell(row, iColor) || '#0d9488'
        const color = colorRaw.startsWith('#') ? colorRaw : `#${colorRaw}`
        const statusRaw = safeLower(cell(row, iStatus) || 'active')
        const status = VALID_PROJECT_STATUS.includes(statusRaw as any)
          ? statusRaw
          : 'active'

        if (statusRaw && !VALID_PROJECT_STATUS.includes(statusRaw as any)) {
          results.projects.errors.push(
            `"${name}": invalid status "${statusRaw}" — defaulted to "active"`
          )
        }

        const ownerId = cell(row, iOwner)
          ? (await resolveEmail(cell(row, iOwner))) ?? user.id
          : user.id

        const clientId = await resolveClient(cell(row, iClient))

        const { data, error } = await admin
          .from('projects')
          .insert({
            org_id: orgId,
            name: name.trim(),
            color,
            status,
            due_date: cellDate(row, iDue),
            owner_id: ownerId,
            client_id: clientId,
            budget: toNullableNumber(cell(row, iBudget)),
            hours_budget: toNullableNumber(cell(row, iHours)),
            description: cell(row, iDesc) || null,
          })
          .select('id')
          .single()

        if (error) {
          results.projects.errors.push(`"${name}": ${error.message}`)
          results.projects.skipped++
        } else {
          projectNameToId[safeLower(name)] = data.id
          results.projects.created++
        }
      }
    }
  }

  // 4) PROJECT TASKS
  const tasksSheet = findSheetName(sheets, [
    (n) => norm(n) === 'tasks',
    (n) =>
      norm(n).includes('task') &&
      !norm(n).includes('recurring') &&
      !norm(n).includes('onetime') &&
      !norm(n).includes('compliance'),
  ])

  if (tasksSheet) {
    const rows = sheets[tasksSheet]
    const headerIndex = rows.findIndex((r) =>
      r.some((c) => norm(c).includes('tasktitle') || norm(c) === 'title')
    )

    if (headerIndex !== -1) {
      const headers = rows[headerIndex]
      const iTitle = findCol(headers, 'tasktitle', 'title')
      const iProject = findCol(headers, 'projectname', 'project')
      const iAssignee = findCol(headers, 'assigneeemail', 'assignee')
      const iPriority = findCol(headers, 'priority')
      const iDue = findCol(headers, 'duedate', 'due')
      const iStatus = findCol(headers, 'status')
      const iHours = findCol(headers, 'esthours', 'estimatedhours', 'hours')
      const iDesc = findCol(headers, 'description', 'desc')
      const iClient = findCol(headers, 'clientname', 'client')

      for (const row of dataRowsAfterHeader(rows, headerIndex)) {
        if (isSampleRow(row)) continue

        const title = cell(row, iTitle)
        if (!title) continue

        const priorityRaw = safeLower(cell(row, iPriority) || 'medium')
        const priority = VALID_PRIORITY.includes(priorityRaw as any)
          ? priorityRaw
          : 'medium'

        if (priorityRaw && !VALID_PRIORITY.includes(priorityRaw as any)) {
          results.tasks.errors.push(
            `"${title}": invalid priority "${priorityRaw}" — defaulted to "medium"`
          )
        }

        const statusRaw = safeLower(cell(row, iStatus) || 'todo')
        const status = VALID_STATUS.includes(statusRaw as any) ? statusRaw : 'todo'

        if (statusRaw && !VALID_STATUS.includes(statusRaw as any)) {
          results.tasks.errors.push(
            `"${title}": invalid status "${statusRaw}" — defaulted to "todo"`
          )
        }

        const projectId = await resolveProject(cell(row, iProject))
        const clientId = await resolveClient(cell(row, iClient))
        const assigneeData = await resolveEmails(cell(row, iAssignee), resolveEmail)

        const { error } = await admin.from('tasks').insert({
          org_id: orgId,
          title: title.trim(),
          description: cell(row, iDesc) || null,
          status,
          priority,
          project_id: projectId,
          client_id: clientId,
          assignee_id: assigneeData.primary,
          due_date: cellDate(row, iDue),
          estimated_hours: toNullableNumber(cell(row, iHours)),
          created_by: user.id,
          is_recurring: false,
          approval_required: false,
          custom_fields:
            assigneeData.coAssignees.length > 0
              ? { _co_assignees: assigneeData.coAssignees }
              : null,
        })

        if (error) {
          results.tasks.errors.push(`"${title}": ${error.message}`)
          results.tasks.skipped++
        } else {
          results.tasks.created++
        }
      }
    }
  }

  // 5) ONE-TIME TASKS
  const oneTimeSheet = findSheetName(sheets, [
    (n) => norm(n).includes('onetime'),
    (n) => norm(n).includes('onetimetasks'),
    (n) => norm(n).includes('inbox'),
  ])

  if (oneTimeSheet) {
    const rows = sheets[oneTimeSheet]
    const headerIndex = rows.findIndex((r) =>
      r.some((c) => norm(c).includes('tasktitle') || norm(c) === 'title')
    )

    if (headerIndex !== -1) {
      const headers = rows[headerIndex]
      const iTitle = findCol(headers, 'tasktitle', 'title')
      const iAssignee = findCol(headers, 'assigneeemail', 'assignee')
      const iPriority = findCol(headers, 'priority')
      const iDue = findCol(headers, 'duedate', 'due')
      const iClient = findCol(headers, 'clientname', 'client')
      const iHours = findCol(headers, 'esthours', 'estimatedhours', 'hours')
      const iDesc = findCol(headers, 'description', 'desc')
      const iCompliance = findCol(
        headers,
        'compliancetasktype',
        'compliance',
        'compliancetask'
      )

      for (const row of dataRowsAfterHeader(rows, headerIndex)) {
        if (isSampleRow(row)) continue

        const originalTitle = cell(row, iTitle)
        if (!originalTitle) continue

        const complianceType = cell(row, iCompliance)
        const compTask = complianceType ? findComplianceTask(complianceType) : null

        const finalTitle = compTask ? compTask.title : originalTitle.trim()

        const priorityRaw = safeLower(
          compTask ? compTask.priority : cell(row, iPriority) || 'medium'
        )
        const priority = VALID_PRIORITY.includes(priorityRaw as any)
          ? priorityRaw
          : 'medium'

        const clientId = await resolveClient(cell(row, iClient))
        const assigneeData = await resolveEmails(cell(row, iAssignee), resolveEmail)

        const { data, error } = await admin
          .from('tasks')
          .insert({
            org_id: orgId,
            title: finalTitle,
            description: cell(row, iDesc) || null,
            status: 'todo',
            priority,
            project_id: null,
            client_id: clientId,
            assignee_id: assigneeData.primary,
            due_date: cellDate(row, iDue),
            estimated_hours: toNullableNumber(cell(row, iHours)),
            created_by: user.id,
            is_recurring: false,
            approval_required: false,
            custom_fields:
              assigneeData.coAssignees.length > 0
                ? { _co_assignees: assigneeData.coAssignees }
                : null,
          })
          .select('id')
          .single()

        if (error) {
          results.onetasks.errors.push(`"${finalTitle}": ${error.message}`)
          results.onetasks.skipped++
          continue
        }

        results.onetasks.created++

        if (compTask && data?.id && compTask.subtasks.length > 0) {
          await admin.from('tasks').insert(
            compTask.subtasks.map((s) => ({
              org_id: orgId,
              title: s.title,
              status: 'todo' as const,
              priority,
              assignee_id: assigneeData.primary || null,
              client_id: clientId || null,
              due_date: cellDate(row, iDue),
              parent_task_id: data.id,
              created_by: user.id,
              is_recurring: false,
              custom_fields: s.required
                ? { _compliance_subtask: true }
                : null,
            }))
          )
        }
      }
    }
  }

  // 6) RECURRING TASKS
  const recurringSheet = findSheetName(sheets, [
    (n) => norm(n).includes('recurring'),
  ])

  if (recurringSheet) {
    const rows = sheets[recurringSheet]
    const headerIndex = rows.findIndex((r) =>
      r.some((c) => norm(c) === 'title' || norm(c).includes('tasktitle'))
    )

    if (headerIndex !== -1) {
      const headers = rows[headerIndex]
      const iTitle = findCol(headers, 'tasktitle', 'title')
      const iFreq = findCol(headers, 'frequency', 'freq')
      const iAssignee = findCol(headers, 'assigneeemail', 'assignee')
      const iPriority = findCol(headers, 'priority')
      const iProject = findCol(headers, 'projectname', 'project')
      const iClient = findCol(headers, 'clientname', 'client')
      const iStart = findCol(headers, 'startdate', 'start')
      const iDesc = findCol(headers, 'description', 'desc')

      for (const row of dataRowsAfterHeader(rows, headerIndex)) {
        if (isSampleRow(row)) continue

        const title = cell(row, iTitle)
        if (!title) continue

        const freq = normalizeFreq(cell(row, iFreq))
        if (!freq) {
          results.recurring.errors.push(`"${title}": invalid frequency`)
          results.recurring.skipped++
          continue
        }

        const priorityRaw = safeLower(cell(row, iPriority) || 'medium')
        const priority = VALID_PRIORITY.includes(priorityRaw as any)
          ? priorityRaw
          : 'medium'

        const projectId = await resolveProject(cell(row, iProject))
        const clientId = await resolveClient(cell(row, iClient))
        const assigneeData = await resolveEmails(cell(row, iAssignee), resolveEmail)
        const startDate =
          cellDate(row, iStart) ?? new Date().toISOString().slice(0, 10)

        const { error } = await admin.from('tasks').insert({
          org_id: orgId,
          title: title.trim(),
          description: cell(row, iDesc) || null,
          priority,
          status: 'todo',
          is_recurring: true,
          frequency: freq,
          next_occurrence_date: nextOccurrence(freq, startDate),
          assignee_id: assigneeData.primary,
          project_id: projectId,
          client_id: clientId,
          created_by: user.id,
          approval_required: false,
          custom_fields:
            assigneeData.coAssignees.length > 0
              ? { _co_assignees: assigneeData.coAssignees }
              : null,
        })

        if (error) {
          results.recurring.errors.push(`"${title}": ${error.message}`)
          results.recurring.skipped++
        } else {
          results.recurring.created++
        }
      }
    }
  }

  // 7) CA COMPLIANCE TASKS
  const complianceSheet = findSheetName(sheets, [
    (n) => norm(n).includes('cacompliance'),
    (n) => norm(n) === 'compliancetasks',
  ])

  if (complianceSheet) {
    const rows = sheets[complianceSheet]
    const headerIndex = rows.findIndex((r) =>
      r.some((c) => norm(c).includes('compliance') || norm(c).includes('tasktype'))
    )

    if (headerIndex !== -1) {
      const headers = rows[headerIndex]
      const iType = findCol(headers, 'compliancetasktype', 'tasktype', 'compliance')
      const iClient = findCol(headers, 'clientname', 'client')
      const iAssignee = findCol(headers, 'assigneeemail', 'assignee')
      const iDue = findCol(headers, 'duedate', 'due')
      const iPriority = findCol(headers, 'priority')
      const iFreq = findCol(headers, 'frequency', 'freq')

      for (const row of dataRowsAfterHeader(rows, headerIndex)) {
        if (isSampleRow(row)) continue

        const typeName = cell(row, iType)
        if (!typeName) continue

        const compTask = findComplianceTask(typeName)
        if (!compTask) {
          results.compliance.errors.push(`"${typeName}": not recognised`)
          results.compliance.skipped++
          continue
        }

        const clientId = await resolveClient(cell(row, iClient))
        const assigneeData = await resolveEmails(cell(row, iAssignee), resolveEmail)
        const dueDate = cellDate(row, iDue)
        const freq = normalizeFreq(cell(row, iFreq))
        const priorityRaw = safeLower(cell(row, iPriority) || compTask.priority)
        const priority = VALID_PRIORITY.includes(priorityRaw as any)
          ? priorityRaw
          : 'medium'

        const { data, error } = await admin
          .from('tasks')
          .insert({
            org_id: orgId,
            title: compTask.title,
            status: 'todo',
            priority,
            client_id: clientId,
            assignee_id: assigneeData.primary,
            due_date: dueDate,
            is_recurring: !!freq,
            frequency: freq ?? undefined,
            next_occurrence_date: freq && dueDate ? dueDate : null,
            created_by: user.id,
            approval_required: false,
            custom_fields:
              assigneeData.coAssignees.length > 0
                ? { _co_assignees: assigneeData.coAssignees }
                : null,
          })
          .select('id')
          .single()

        if (error) {
          results.compliance.errors.push(`"${compTask.title}": ${error.message}`)
          results.compliance.skipped++
          continue
        }

        results.compliance.created++

        if (data?.id && compTask.subtasks.length > 0) {
          await admin.from('tasks').insert(
            compTask.subtasks.map((s) => ({
              org_id: orgId,
              title: s.title,
              status: 'todo' as const,
              priority,
              assignee_id: assigneeData.primary || null,
              client_id: clientId || null,
              due_date: dueDate,
              parent_task_id: data.id,
              created_by: user.id,
              is_recurring: false,
              custom_fields: s.required
                ? { _compliance_subtask: true }
                : null,
            }))
          )
        }
      }
    }
  }

  const totalCreated =
    results.members.created +
    results.clients.created +
    results.projects.created +
    results.tasks.created +
    results.onetasks.created +
    results.recurring.created +
    results.compliance.created

  return NextResponse.json({
    success: true,
    results,
    totalCreated,
  })
}