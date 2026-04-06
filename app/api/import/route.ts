import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse }       from 'next/server'
import type { NextRequest }   from 'next/server'
import { COMPLIANCE_TASKS }   from '@/lib/data/complianceTasks'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

const COMPLIANCE_MAP = new Map(
  COMPLIANCE_TASKS.map(t => [t.title.toLowerCase().trim(), t])
)

function alphaNum(s: string) { return s.toLowerCase().replace(/[^a-z0-9]/g, '') }

function findComplianceTask(title: string) {
  const q = title.toLowerCase().trim()
  if (!q) return null

  // 1. Exact match
  const exact = COMPLIANCE_MAP.get(q)
  if (exact) return exact

  // 2. Normalised alphanumeric exact match
  const qAlpha = alphaNum(q)
  for (const [key, task] of COMPLIANCE_MAP) {
    if (alphaNum(key) === qAlpha) return task
  }

  // 3. Input is contained in a task title (e.g. "GSTR 3B" matches "GSTR 3B (Monthly)")
  for (const [key, task] of COMPLIANCE_MAP) {
    if (alphaNum(key).includes(qAlpha) || qAlpha.includes(alphaNum(key))) return task
  }

  return null
}

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

async function parseXlsx(buffer: ArrayBuffer): Promise<SheetMap> {
  const XLSX = await import('xlsx')
  const wb = XLSX.read(new Uint8Array(buffer), {
    type: 'array',
    raw: false,
    cellDates: true,
  })

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

function norm(s: string) {
  return (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function cleanText(s: string) {
  return (s ?? '')
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, ' ')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

function findCol(headers: string[], ...keys: string[]): number {
  for (const key of keys) {
    const idx = headers.findIndex(h => norm(h).includes(norm(key)))
    if (idx !== -1) return idx
  }
  return -1
}

function cell(row: string[], idx: number): string {
  return idx >= 0 ? cleanText(String(row[idx] ?? '')) : ''
}

function parseNumber(value: string): number | null {
  if (!value) return null
  const n = Number(value.replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

function isLikelyInstructionRow(row: string[]): boolean {
  const joined = row.map(cleanText).join(' ').toLowerCase()
  return (
    joined.includes('yyyy-mm-dd') ||
    joined.includes('must match') ||
    joined.includes('clear title') ||
    joined.includes('clear action') ||
    joined.includes('unique name') ||
    joined.includes('optional') ||
    joined.includes('select from team') ||
    joined.includes('select client') ||
    joined.includes('select priority') ||
    joined.includes('choose frequency') ||
    joined.includes('select from dropdown') ||
    joined.includes('enter email') ||
    joined.includes('enter here') ||
    joined.includes('type here')
  )
}

function dataRows(rows: string[][], headerIndex: number) {
  const out = rows.slice(headerIndex + 1)
  if (out.length > 0 && isLikelyInstructionRow(out[0])) return out.slice(1)
  return out
}

function isSampleRow(row: string[]): boolean {
  const joined = row.map(cleanText).join(' ').toLowerCase()
  const filled = row.filter(v => cleanText(v).length > 0).length

  if (filled === 0) return true
  if (joined.includes('[sample]')) return true
  if (joined.includes('@yourcompany.com')) return true
  if (joined.includes('must match')) return true
  if (joined.includes('yyyy-mm-dd')) return true
  if (joined.includes('clear title')) return true
  if (joined.includes('clear action')) return true
  if (joined.includes('unique name')) return true
  if (joined.includes("person's display name")) return true
  if (joined.includes('manager | member | viewer')) return true
  if (joined.includes('manager|member|viewer')) return true
  // Template placeholder / dropdown instruction cells
  if (joined.includes('select from dropdown')) return true
  if (joined.includes('select compliance')) return true
  if (joined.includes('select task')) return true
  if (joined.includes('enter email')) return true
  if (joined.includes('enter here')) return true
  if (joined.includes('type here')) return true
  if (joined.includes('e.g.')) return true
  if (joined.includes('example:')) return true
  if (joined.includes('(sample)')) return true
  return false
}

function normalizeDateOutput(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function cellDate(row: string[], idx: number): string | null {
  const raw = cell(row, idx)
  if (!raw) return null
  const v = raw.trim()

  // already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v

  // dd/mm/yyyy or d/m/yyyy
  let m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) {
    const dd = m[1].padStart(2, '0')
    const mm = m[2].padStart(2, '0')
    const yyyy = m[3]
    return `${yyyy}-${mm}-${dd}`
  }

  // dd-mm-yyyy or d-m-yyyy
  m = v.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
  if (m) {
    const dd = m[1].padStart(2, '0')
    const mm = m[2].padStart(2, '0')
    const yyyy = m[3]
    return `${yyyy}-${mm}-${dd}`
  }

  // mm/dd/yyyy or mixed human-readable parse
  const d = new Date(v)
  if (!Number.isNaN(d.getTime())) return normalizeDateOutput(d)

  return null
}

function nextOccurrence(freq: string, from: string): string {
  const d = new Date((from || new Date().toISOString().split('T')[0]) + 'T00:00:00')
  switch (freq) {
    case 'daily':      d.setDate(d.getDate() + 1); break
    case 'weekly':     d.setDate(d.getDate() + 7); break
    case 'bi_weekly':  d.setDate(d.getDate() + 14); break
    case 'monthly':    d.setMonth(d.getMonth() + 1); break
    case 'quarterly':  d.setMonth(d.getMonth() + 3); break
    case 'annual':     d.setFullYear(d.getFullYear() + 1); break
  }
  return normalizeDateOutput(d)
}

function parseEmailList(raw: string): string[] {
  return raw
    .split(/[;,]/g)
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)
    .filter(v => v.includes('@'))
}

function findSheetName(sheets: SheetMap, predicates: Array<(name: string) => boolean>): string | undefined {
  return Object.keys(sheets).find(name => predicates.some(fn => fn(name)))
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const { data: mb } = await supabase
      .from('org_members')
      .select('org_id, role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (!mb || !['owner', 'admin', 'manager'].includes(mb.role)) {
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
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      return NextResponse.json({ error: 'Please upload an .xlsx file' }, { status: 400 })
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 5 MB)' }, { status: 400 })
    }

    let sheets: SheetMap
    try {
      sheets = await parseXlsx(await file.arrayBuffer())
    } catch (e: any) {
      return NextResponse.json(
        { error: 'Could not parse file: ' + (e?.message ?? 'unknown') },
        { status: 400 }
      )
    }

    const admin = createAdminClient()
    const orgId = mb.org_id

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
    const roleCache: Record<string, string | null> = {}
    let authUsersCache: { id: string; email?: string }[] | null = null

    const clientNameToId: Record<string, string> = {}
    const projectNameToId: Record<string, string> = {}

    async function loadAuthUsers() {
      if (authUsersCache) return authUsersCache
      try {
        const { data } = await admin.auth.admin.listUsers({ perPage: 1000 })
        authUsersCache = (data?.users ?? []).map(u => ({ id: u.id, email: u.email ?? undefined }))
        return authUsersCache
      } catch {
        authUsersCache = []
        return authUsersCache
      }
    }

    async function resolveEmail(emailOrName: string): Promise<string | null> {
      const raw = emailOrName.trim()
      if (!raw) return null
      const key = raw.toLowerCase()
      if (key in emailCache) return emailCache[key]

      // ── Email path ────────────────────────────────────────────
      if (raw.includes('@')) {
        const e = key

        // 1) users table
        const { data: appUser } = await admin
          .from('users')
          .select('id')
          .eq('email', e)
          .maybeSingle()

        if (appUser?.id) { emailCache[key] = appUser.id; return appUser.id }

        // 2) org_members joined with users
        const { data: memberUser } = await admin
          .from('org_members')
          .select('user_id, users!inner(email)')
          .eq('org_id', orgId)
          .eq('users.email', e)
          .maybeSingle()

        if (memberUser?.user_id) { emailCache[key] = memberUser.user_id; return memberUser.user_id }

        // 3) auth users
        const authUsers = await loadAuthUsers()
        const authUser = authUsers.find(u => u.email?.toLowerCase() === e)
        if (authUser?.id) { emailCache[key] = authUser.id; return authUser.id }

        emailCache[key] = null
        return null
      }

      // ── Name path (non-technical users who type names instead of emails) ─
      const { data: byName } = await admin
        .from('org_members')
        .select('user_id, users!inner(id, name)')
        .eq('org_id', orgId)
        .eq('is_active', true)
        .ilike('users.name', raw)
        .maybeSingle()

      if (byName?.user_id) { emailCache[key] = byName.user_id; return byName.user_id }

      // Partial name match
      const { data: allMembers } = await admin
        .from('org_members')
        .select('user_id, users!inner(id, name)')
        .eq('org_id', orgId)
        .eq('is_active', true)

      const match = (allMembers ?? []).find((m: any) =>
        (m.users?.name ?? '').toLowerCase().includes(key) ||
        key.includes((m.users?.name ?? '').toLowerCase())
      )
      const uid = match?.user_id ?? null
      emailCache[key] = uid
      return uid
    }

    async function resolveAuthUser(email: string): Promise<string | null> {
      const users = await loadAuthUsers()
      const u = users.find(x => x.email?.toLowerCase() === email.toLowerCase())
      return u?.id ?? null
    }

    async function getOrgRoleByUserId(userId: string): Promise<string | null> {
      if (userId in roleCache) return roleCache[userId]
      const { data } = await admin
        .from('org_members')
        .select('role')
        .eq('org_id', orgId)
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle()

      roleCache[userId] = data?.role ?? null
      return roleCache[userId]
    }

    async function resolveApprover(email: string): Promise<string | null> {
      if (!email) return null
      const uid = await resolveEmail(email)
      if (!uid) return null
      const role = await getOrgRoleByUserId(uid)
      if (!role) return null
      if (!['owner', 'admin', 'manager'].includes(role)) return null
      return uid
    }

    async function resolveAssignees(raw: string): Promise<{ primary: string | null; extra: string[] }> {
      // Ignore template placeholder text
      const rawLower = raw.toLowerCase().trim()
      if (!rawLower || rawLower.includes('select') || rawLower.includes('enter email') || rawLower.includes('assignee') || rawLower.includes('e.g')) {
        return { primary: null, extra: [] }
      }
      const emails = parseEmailList(raw)
      if (emails.length === 0) return { primary: null, extra: [] }

      const ids = await Promise.all(emails.map(e => resolveEmail(e)))
      const valid = ids.filter(Boolean) as string[]
      return {
        primary: valid[0] ?? null,
        extra: valid.slice(1),
      }
    }

    async function resolveClient(rawName: string): Promise<string | null> {
      const n = rawName.toLowerCase().trim()
      if (!n) return null
      // Ignore template placeholder text
      if (n.includes('select') || n.includes('enter') || n.includes('client name') || n.includes('e.g')) return null
      if (clientNameToId[n]) return clientNameToId[n]

      const { data } = await admin
        .from('clients')
        .select('id')
        .eq('org_id', orgId)
        .ilike('name', rawName.trim())
        .maybeSingle()

      if (data?.id) clientNameToId[n] = data.id
      return data?.id ?? null
    }

    async function resolveProject(rawName: string): Promise<string | null> {
      const n = rawName.toLowerCase().trim()
      if (!n) return null
      if (projectNameToId[n]) return projectNameToId[n]

      const { data } = await admin
        .from('projects')
        .select('id')
        .eq('org_id', orgId)
        .ilike('name', rawName.trim())
        .maybeSingle()

      if (data?.id) projectNameToId[n] = data.id
      return data?.id ?? null
    }

    // ─────────────────────────────────────────────────────────────
    // 1) MEMBERS
    // ─────────────────────────────────────────────────────────────
    const memberSheet = findSheetName(sheets, [
      k => norm(k).includes('member'),
      k => norm(k).startsWith('team'),
    ])

    if (memberSheet) {
      const rows = sheets[memberSheet]
      const hdrIdx = rows.findIndex(r => r.some(c => norm(c) === 'email'))

      if (hdrIdx !== -1) {
        const headers = rows[hdrIdx]
        const iName  = findCol(headers, 'fullname', 'name')
        const iEmail = findCol(headers, 'email')
        const iRole  = findCol(headers, 'role')

        // Pre-warm the auth user cache before parallel processing
        await loadAuthUsers()

        // Collect valid rows first, then process in parallel batches
        const validMemberRows = dataRows(rows, hdrIdx)
          .filter(row => !isSampleRow(row))
          .map(row => ({
            email: cell(row, iEmail).toLowerCase().trim(),
            name:  cell(row, iName),
            role:  cell(row, iRole).toLowerCase().trim() || 'member',
          }))
          .filter(({ email }) => email && email.includes('@'))

        async function processMember({ email, name, role }: { email: string; name: string; role: string }) {
          if (!['owner', 'admin', 'manager', 'member', 'viewer'].includes(role)) {
            results.members.errors.push(`${email}: invalid role "${role}"`)
            results.members.skipped++
            return
          }

          let uid = await resolveEmail(email)
          if (!uid) uid = await resolveAuthUser(email)

          if (uid) {
            await admin.from('users').upsert(
              { id: uid, email, name: name || email.split('@')[0] },
              { onConflict: 'id', ignoreDuplicates: true }
            )
            const { data: existingMember } = await admin.from('org_members')
              .select('id, is_active').eq('org_id', orgId).eq('user_id', uid).maybeSingle()

            if (existingMember?.is_active) { results.members.skipped++; return }

            if (existingMember) {
              await admin.from('org_members').update({ is_active: true, role }).eq('id', existingMember.id)
            } else {
              await admin.from('org_members').insert({ org_id: orgId, user_id: uid, role, is_active: true })
            }
            if (name) await admin.from('users').update({ name }).eq('id', uid)
            results.members.created++
          } else {
            const { error: invErr } = await admin.auth.admin.inviteUserByEmail(email, {
              data: { invited_to_org: orgId, invited_role: role, full_name: name || null },
              redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
            })
            if (invErr) {
              if (invErr.message?.toLowerCase().includes('already') || invErr.message?.toLowerCase().includes('registered')) {
                const authId = await resolveAuthUser(email)
                if (authId) {
                  await admin.from('users').upsert({ id: authId, email, name: name || email.split('@')[0] }, { onConflict: 'id', ignoreDuplicates: true })
                  await admin.from('org_members').upsert({ org_id: orgId, user_id: authId, role, is_active: true }, { onConflict: 'org_id,user_id', ignoreDuplicates: false })
                  results.members.created++
                } else {
                  results.members.errors.push(`${email}: user exists in auth but could not be resolved`)
                  results.members.skipped++
                }
              } else {
                results.members.errors.push(`${email}: ${invErr.message}`)
                results.members.skipped++
              }
            } else {
              results.members.created++
            }
          }
        }

        // Process up to 5 members concurrently to avoid overwhelming Supabase auth
        const MEMBER_BATCH = 5
        for (let i = 0; i < validMemberRows.length; i += MEMBER_BATCH) {
          await Promise.allSettled(validMemberRows.slice(i, i + MEMBER_BATCH).map(processMember))
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 2) CLIENTS
    // ─────────────────────────────────────────────────────────────
    const clientSheet = findSheetName(sheets, [
      k => norm(k).includes('client'),
    ])

    if (clientSheet) {
      const rows = sheets[clientSheet]
      const hdrIdx = rows.findIndex(r =>
        r.some(c => norm(c) === 'name' || norm(c).includes('clientname'))
      )

      if (hdrIdx !== -1) {
        const headers = rows[hdrIdx]
        const iName     = findCol(headers, 'clientname', 'name')
        const iEmail    = findCol(headers, 'email', 'contactemail')
        const iCompany  = findCol(headers, 'company')
        const iWebsite  = findCol(headers, 'website')
        const iIndustry = findCol(headers, 'industry')
        const iColor    = findCol(headers, 'color', 'colour')
        const iStatus   = findCol(headers, 'status')
        const iNotes    = findCol(headers, 'notes')

        for (const row of dataRows(rows, hdrIdx)) {
          if (isSampleRow(row)) continue
          const name = cell(row, iName)
          if (!name) continue

          const status = cell(row, iStatus) || 'active'
          const rawColor = cell(row, iColor) || '#0d9488'
          const color = rawColor.startsWith('#') ? rawColor : `#${rawColor}`

          const { data: existing } = await admin
            .from('clients')
            .select('id')
            .eq('org_id', orgId)
            .ilike('name', name)
            .maybeSingle()

          if (existing?.id) {
            clientNameToId[name.toLowerCase()] = existing.id
            results.clients.skipped++
            continue
          }

          const { data: created, error } = await admin.from('clients').insert({
            org_id: orgId,
            name: name.trim(),
            email: cell(row, iEmail) || null,
            company: cell(row, iCompany) || null,
            website: cell(row, iWebsite) || null,
            industry: cell(row, iIndustry) || null,
            color,
            status: ['active', 'inactive', 'lead'].includes(status) ? status : 'active',
            notes: cell(row, iNotes) || null,
            created_by: user.id,
          }).select('id').single()

          if (error) {
            results.clients.errors.push(`"${name}": ${error.message}`)
            results.clients.skipped++
          } else {
            clientNameToId[name.toLowerCase()] = created.id
            results.clients.created++
          }
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 3) PROJECTS
    // ─────────────────────────────────────────────────────────────
    const projectSheet = findSheetName(sheets, [
      k => norm(k).includes('project'),
    ])

    if (projectSheet) {
      const rows = sheets[projectSheet]
      const hdrIdx = rows.findIndex(r =>
        r.some(c => norm(c).includes('projectname') || norm(c) === 'name')
      )

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

        for (const row of dataRows(rows, hdrIdx)) {
          if (isSampleRow(row)) continue
          const name = cell(row, iName)
          if (!name) continue

          const status = cell(row, iStatus) || 'active'
          if (!['active', 'on_hold', 'completed'].includes(status)) {
            results.projects.errors.push(`"${name}": invalid status "${status}"`)
            results.projects.skipped++
            continue
          }

          const rawColor = cell(row, iColor) || '#0d9488'
          const color = rawColor.startsWith('#') ? rawColor : `#${rawColor}`
          const ownerId = cell(row, iOwner)
            ? (await resolveEmail(cell(row, iOwner))) ?? user.id
            : user.id
          const clientId = await resolveClient(cell(row, iClient))

          const { data: proj, error } = await admin.from('projects').insert({
            org_id: orgId,
            name: name.trim(),
            color,
            status,
            due_date: cellDate(row, iDue),
            owner_id: ownerId,
            client_id: clientId,
            budget: parseNumber(cell(row, iBudget)),
            hours_budget: parseNumber(cell(row, iHours)),
            description: cell(row, iDesc) || null,
          }).select('id').single()

          if (error) {
            results.projects.errors.push(`"${name}": ${error.message}`)
            results.projects.skipped++
          } else {
            projectNameToId[name.toLowerCase()] = proj.id
            results.projects.created++
          }
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 4) TASKS
    // ─────────────────────────────────────────────────────────────
    const taskSheet = findSheetName(sheets, [
      k => norm(k).includes('task') && !norm(k).includes('recurring') && !norm(k).includes('one') && !norm(k).includes('onetim'),
    ])

    if (taskSheet) {
      const rows = sheets[taskSheet]
      const hdrIdx = rows.findIndex(r =>
        r.some(c => norm(c).includes('tasktitle') || norm(c) === 'title')
      )

      if (hdrIdx !== -1) {
        const headers = rows[hdrIdx]
        const iTitle    = findCol(headers, 'tasktitle', 'title')
        const iProject  = findCol(headers, 'projectname', 'project')
        const iAssignee = findCol(headers, 'assigneeemail', 'assignee')
        const iApprover = findCol(headers, 'approveremail', 'approver')
        const iPriority = findCol(headers, 'priority')
        const iDue      = findCol(headers, 'duedate', 'due')
        const iStatus   = findCol(headers, 'status')
        const iHours    = findCol(headers, 'esthours', 'estimatedhours', 'hours')
        const iDesc     = findCol(headers, 'description', 'desc')
        const iClient   = findCol(headers, 'clientname', 'client')

        for (const row of dataRows(rows, hdrIdx)) {
          if (isSampleRow(row)) continue

          const title = cell(row, iTitle)
          if (!title) continue

          const priority = cell(row, iPriority) || 'medium'
          if (!['none', 'low', 'medium', 'high', 'urgent'].includes(priority)) {
            results.tasks.errors.push(`"${title}": invalid priority "${priority}"`)
            results.tasks.skipped++
            continue
          }

          const status = cell(row, iStatus) || 'todo'
          const validStatus = ['todo', 'in_progress', 'completed', 'blocked'].includes(status)
            ? status
            : 'todo'

          const assigneeData = await resolveAssignees(cell(row, iAssignee))
          const approverId = cell(row, iApprover) ? await resolveApprover(cell(row, iApprover)) : null
          const dueDate = cellDate(row, iDue)
          const projectId = await resolveProject(cell(row, iProject))
          const clientId = await resolveClient(cell(row, iClient))

          if (cell(row, iApprover) && !approverId) {
            results.tasks.errors.push(
              `"${title}": approver must be an active owner/admin/manager in this organisation`
            )
          }

          const customFields =
            assigneeData.extra.length > 0
              ? { _co_assignees: assigneeData.extra }
              : null

          const { error } = await admin.from('tasks').insert({
            org_id: orgId,
            title: title.trim(),
            description: cell(row, iDesc) || null,
            status: validStatus,
            priority,
            project_id: projectId,
            client_id: clientId,
            assignee_id: assigneeData.primary,
            approver_id: approverId,
            approval_required: !!approverId,
            due_date: dueDate,
            estimated_hours: parseNumber(cell(row, iHours)),
            created_by: user.id,
            is_recurring: false,
            custom_fields: customFields,
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

    // ─────────────────────────────────────────────────────────────
    // 5) ONE-TIME TASKS
    // ─────────────────────────────────────────────────────────────
    const oneTimeSheet = findSheetName(sheets, [
      k => norm(k).includes('onetime') || norm(k).includes('onetim') || norm(k).includes('inbox') || norm(k).includes('one'),
    ])

    if (oneTimeSheet) {
      const rows = sheets[oneTimeSheet]
      const hdrIdx = rows.findIndex(r =>
        r.some(c => norm(c).includes('tasktitle') || norm(c) === 'title')
      )

      if (hdrIdx !== -1) {
        const headers = rows[hdrIdx]
        const iTitle      = findCol(headers, 'tasktitle', 'title')
        const iAssignee   = findCol(headers, 'assigneeemail', 'assignee')
        const iApprover   = findCol(headers, 'approveremail', 'approver')
        const iPriority   = findCol(headers, 'priority')
        const iDue        = findCol(headers, 'duedate', 'due')
        const iClient     = findCol(headers, 'clientname', 'client')
        const iHours      = findCol(headers, 'esthours', 'estimatedhours', 'hours')
        const iDesc       = findCol(headers, 'description', 'desc')
        const iCompliance = findCol(headers, 'compliancetasktype', 'compliance', 'compliancetask')

        for (const row of dataRows(rows, hdrIdx)) {
          if (isSampleRow(row)) continue

          const title = cell(row, iTitle)
          if (!title) continue

          const priority = cell(row, iPriority) || 'medium'
          if (!['none', 'low', 'medium', 'high', 'urgent'].includes(priority)) {
            results.onetasks.errors.push(`"${title}": invalid priority "${priority}"`)
            results.onetasks.skipped++
            continue
          }

          const assigneeData = await resolveAssignees(cell(row, iAssignee))
          const approverId = cell(row, iApprover) ? await resolveApprover(cell(row, iApprover)) : null
          const dueDate = cellDate(row, iDue)
          const clientId = await resolveClient(cell(row, iClient))

          const complianceType = cell(row, iCompliance)
          const compTask = complianceType ? findComplianceTask(complianceType) : null
          const finalTitle = compTask ? compTask.title : title.trim()
          const finalPriority = compTask ? compTask.priority : priority

          if (cell(row, iApprover) && !approverId) {
            results.onetasks.errors.push(
              `"${finalTitle}": approver must be an active owner/admin/manager in this organisation`
            )
          }

          const customFields: Record<string, any> = {
            ...(compTask ? { _ca_compliance: true } : {}),
            ...(assigneeData.extra.length > 0 ? { _co_assignees: assigneeData.extra } : {}),
          }
          const customFieldsOrNull = Object.keys(customFields).length > 0 ? customFields : null

          const { data: newTask, error } = await admin.from('tasks').insert({
            org_id: orgId,
            title: finalTitle,
            description: cell(row, iDesc) || null,
            status: 'todo',
            priority: finalPriority,
            project_id: null,
            client_id: clientId,
            assignee_id: assigneeData.primary,
            approver_id: approverId,
            approval_required: !!approverId,
            due_date: dueDate,
            estimated_hours: parseNumber(cell(row, iHours)),
            created_by: user.id,
            is_recurring: false,
            custom_fields: customFieldsOrNull,
          }).select('id').single()

          if (error) {
            results.onetasks.errors.push(`"${finalTitle}": ${error.message}`)
            results.onetasks.skipped++
          } else {
            results.onetasks.created++

            if (compTask && newTask?.id && compTask.subtasks.length > 0) {
              const subtaskInserts = compTask.subtasks.map(s => ({
                org_id: orgId,
                title: s.title,
                status: 'todo' as const,
                priority: compTask.priority,
                assignee_id: assigneeData.primary || null,
                approver_id: approverId || null,
                approval_required: !!approverId,
                client_id: clientId || null,
                due_date: dueDate,
                parent_task_id: newTask.id,
                created_by: user.id,
                is_recurring: false,
                custom_fields: s.required
                  ? { ...(customFieldsOrNull ?? {}), _compliance_subtask: true }
                  : customFieldsOrNull,
              }))
              await admin.from('tasks').insert(subtaskInserts)
            }
          }
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 6) RECURRING TASKS
    // ─────────────────────────────────────────────────────────────
    const recurringSheet = findSheetName(sheets, [
      k => norm(k).includes('recurring'),
    ])

    if (recurringSheet) {
      const rows = sheets[recurringSheet]
      const hdrIdx = rows.findIndex(r =>
        r.some(c => norm(c) === 'title' || norm(c).includes('tasktitle'))
      )

      if (hdrIdx !== -1) {
        const headers = rows[hdrIdx]
        const iTitle    = findCol(headers, 'tasktitle', 'title')
        const iFreq     = findCol(headers, 'frequency', 'freq')
        const iAssignee = findCol(headers, 'assigneeemail', 'assignee')
        const iApprover = findCol(headers, 'approveremail', 'approver')
        const iPriority = findCol(headers, 'priority')
        const iProject  = findCol(headers, 'projectname', 'project')
        const iClient   = findCol(headers, 'clientname', 'client')
        const iStart    = findCol(headers, 'startdate', 'start')
        const iDesc     = findCol(headers, 'description', 'desc')

        const VALID_FREQS = ['daily', 'weekly', 'bi_weekly', 'monthly', 'quarterly', 'annual']

        for (const row of dataRows(rows, hdrIdx)) {
          if (isSampleRow(row)) continue

          const title = cell(row, iTitle)
          if (!title) continue

          const freq = norm(cell(row, iFreq))
          if (!VALID_FREQS.includes(freq)) {
            results.recurring.errors.push(`"${title}": invalid frequency "${freq}"`)
            results.recurring.skipped++
            continue
          }

          const priority = cell(row, iPriority) || 'medium'
          if (!['none', 'low', 'medium', 'high', 'urgent'].includes(priority)) {
            results.recurring.errors.push(`"${title}": invalid priority "${priority}"`)
            results.recurring.skipped++
            continue
          }

          const assigneeData = await resolveAssignees(cell(row, iAssignee))
          const approverId = cell(row, iApprover) ? await resolveApprover(cell(row, iApprover)) : null
          const startDate = cellDate(row, iStart) || new Date().toISOString().split('T')[0]
          const projectId = await resolveProject(cell(row, iProject))
          const clientId = await resolveClient(cell(row, iClient))

          if (cell(row, iApprover) && !approverId) {
            results.recurring.errors.push(
              `"${title}": approver must be an active owner/admin/manager in this organisation`
            )
          }

          const customFields =
            assigneeData.extra.length > 0
              ? { _co_assignees: assigneeData.extra }
              : null

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
            approver_id: approverId,
            approval_required: !!approverId,
            project_id: projectId,
            client_id: clientId,
            created_by: user.id,
            custom_fields: customFields,
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

    // ─────────────────────────────────────────────────────────────
    // 7) CA COMPLIANCE TASKS
    // ─────────────────────────────────────────────────────────────
    const caSheet = findSheetName(sheets, [
      k => norm(k).includes('cacompliance') || (norm(k).includes('compliance') && !norm(k).includes('non')),
    ])

    if (caSheet) {
      const rows = sheets[caSheet]
      const hdrIdx = rows.findIndex(r =>
        r.some(cc => norm(cc).includes('compliance') || norm(cc).includes('tasktype'))
      )

      if (hdrIdx !== -1) {
        const headers = rows[hdrIdx]
        const iType     = findCol(headers, 'compliancetasktype', 'tasktype', 'compliance')
        const iClient   = findCol(headers, 'clientname', 'client')
        const iAssignee = findCol(headers, 'assigneeemail', 'assignee')
        const iApprover = findCol(headers, 'approveremail', 'approver')
        const iDue      = findCol(headers, 'duedate', 'due')
        const iPriority = findCol(headers, 'priority')
        const iFreq     = findCol(headers, 'frequency', 'freq')

        for (const row of dataRows(rows, hdrIdx)) {
          if (isSampleRow(row)) continue

          const typeName = cell(row, iType)
          if (!typeName) continue

          // Skip obvious placeholder / instruction values silently
          const typeNorm = typeName.toLowerCase()
          if (
            typeNorm.includes('select') || typeNorm.includes('dropdown') ||
            typeNorm.includes('enter') || typeNorm.includes('type here') ||
            typeNorm.includes('e.g') || typeNorm.includes('example')
          ) {
            results.compliance.skipped++
            continue
          }

          const compTask = findComplianceTask(typeName)
          if (!compTask) {
            results.compliance.errors.push(`"${typeName}": not a recognised compliance task — check spelling or leave blank`)
            results.compliance.skipped++
            continue
          }

          const clientId = await resolveClient(cell(row, iClient))
          const assigneeData = await resolveAssignees(cell(row, iAssignee))
          const approverId = cell(row, iApprover) ? await resolveApprover(cell(row, iApprover)) : null
          const dueDate = cellDate(row, iDue)
          const priority = cell(row, iPriority) || compTask.priority

          const freqRaw = cell(row, iFreq)
          const freqMap: Record<string, string> = {
            daily: 'daily',
            weekly: 'weekly',
            monthly: 'monthly',
            quarterly: 'quarterly',
            annual: 'annual',
            yearly: 'annual',
            biweekly: 'bi_weekly',
            fortnightly: 'bi_weekly',
          }
          const frequency = freqRaw ? (freqMap[norm(freqRaw)] ?? 'monthly') : null

          if (cell(row, iApprover) && !approverId) {
            results.compliance.errors.push(
              `"${compTask.title}": approver must be an active owner/admin/manager in this organisation`
            )
          }

          const customFields: Record<string, any> = {
            _ca_compliance: true,
            ...(assigneeData.extra.length > 0 ? { _co_assignees: assigneeData.extra } : {}),
          }

          const { data: newTask, error } = await admin.from('tasks').insert({
            org_id: orgId,
            title: compTask.title,
            status: 'todo',
            priority,
            client_id: clientId,
            assignee_id: assigneeData.primary,
            approver_id: approverId,
            approval_required: !!approverId,
            due_date: dueDate,
            is_recurring: !!frequency,
            frequency: frequency ?? undefined,
            next_occurrence_date: frequency && dueDate ? dueDate : null,
            created_by: user.id,
            custom_fields: customFields,
          }).select('id').single()

          if (error) {
            results.compliance.errors.push(`"${compTask.title}": ${error.message}`)
            results.compliance.skipped++
          } else {
            results.compliance.created++

            if (newTask?.id && compTask.subtasks.length > 0) {
              await admin.from('tasks').insert(
                compTask.subtasks.map(s => ({
                  org_id: orgId,
                  title: s.title,
                  status: 'todo' as const,
                  priority,
                  assignee_id: assigneeData.primary || null,
                  approver_id: approverId || null,
                  approval_required: !!approverId,
                  client_id: clientId || null,
                  due_date: dueDate,
                  parent_task_id: newTask.id,
                  created_by: user.id,
                  is_recurring: false,
                  custom_fields: s.required
                    ? { ...(customFields ?? {}), _compliance_subtask: true }
                    : customFields,
                }))
              )
            }
          }
        }
      }
    }

    const totalCreated = Object.values(results).reduce((sum, bucket) => sum + bucket.created, 0)

    return NextResponse.json({
      success: true,
      results,
      totalCreated,
    })
  } catch (e: any) {
    console.error('[bulk-import] fatal error:', e)
    return NextResponse.json(
      {
        error: e?.message || 'Import failed unexpectedly',
        detail: String(e),
      },
      { status: 500 }
    )
  }
}