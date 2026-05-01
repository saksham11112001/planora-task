import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse }       from 'next/server'
import type { NextRequest }   from 'next/server'
import { COMPLIANCE_TASKS }   from '@/lib/data/complianceTasks'
import { CA_DEFAULT_TASKS }   from '@/lib/data/caDefaultTasks'
import { effectivePlan, canUseFeature } from '@/lib/utils/planGate'

export const maxDuration = 60 // seconds — Vercel Hobby plan cap
export const dynamic = 'force-dynamic'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_PLANORA_URL ?? 'https://planora.in'

const COMPLIANCE_MAP = new Map(
  COMPLIANCE_TASKS.map(t => [t.title.toLowerCase().trim(), t])
)

// Static fallback: default dates keyed by normalised name
const DEFAULT_DATES_MAP = new Map<string, Record<string, string>>(
  CA_DEFAULT_TASKS.map(t => [t.name.toLowerCase().trim(), t.dates])
)

function alphaNum(s: string) { return s.toLowerCase().replace(/[^a-z0-9]/g, '') }

/** Fuzzy lookup of dates from the static CA_DEFAULT_TASKS list */
function findDefaultDates(name: string): Record<string, string> {
  const q = name.toLowerCase().trim()
  if (!q) return {}
  const exact = DEFAULT_DATES_MAP.get(q)
  if (exact) return exact
  const qA = alphaNum(q)
  for (const [key, dates] of DEFAULT_DATES_MAP) {
    if (alphaNum(key) === qA) return dates
  }
  for (const [key, dates] of DEFAULT_DATES_MAP) {
    const kA = alphaNum(key)
    if (kA.includes(qA) || qA.includes(kA)) return dates
  }
  return {}
}

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

    // Server-side plan gate: import/export requires Pro plan or above
    const { data: orgData } = await supabase
      .from('organisations')
      .select('plan_tier, status, trial_ends_at')
      .eq('id', mb.org_id)
      .single()
    const plan = effectivePlan(orgData ?? { plan_tier: 'free', status: 'active' })
    if (!canUseFeature(plan, 'exports')) {
      return NextResponse.json(
        { error: 'Bulk import is available on the Pro plan and above. Upgrade to use this feature.' },
        { status: 402 }
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
        { error: 'Could not read the file. Please make sure it is a valid Excel (.xlsx) file.' },
        { status: 400 }
      )
    }

    const admin = createAdminClient()
    const orgId = mb.org_id

    // Pre-fetch all active CA master tasks once — shared across all sheet processors
    const { data: _allCaMasterTasks } = await admin
      .from('ca_master_tasks')
      .select('id, name, dates')
      .eq('org_id', orgId)
      .eq('is_active', true)

    type MasterEntry = { id: string; dates: Record<string, string> }
    const caMasterMap = new Map<string, MasterEntry>(
      (_allCaMasterTasks ?? []).map((t: any) => [
        t.name.toLowerCase().trim(),
        { id: t.id, dates: (t.dates ?? {}) as Record<string, string> },
      ])
    )

    // Returns the next upcoming due date from master dates JSONB (IST-aware).
    // Falls back to the latest past date if all dates have passed.
    function nextDueDateFromMaster(dates: Record<string, string>): string | null {
      const nowIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
      const today  = nowIST.toISOString().split('T')[0]
      const all    = Object.values(dates).filter(Boolean).sort()
      return all.find(d => d >= today) ?? all[all.length - 1] ?? null
    }

    // Fuzzy-match a name against caMasterMap keys (your org's actual master names).
    // Priority: exact → alphanumeric exact → containment.
    function findMasterEntry(name: string): MasterEntry | undefined {
      const q = name.toLowerCase().trim()
      if (!q) return undefined
      // 1. Exact
      const exact = caMasterMap.get(q)
      if (exact) return exact
      // 2. Alphanumeric exact (strips spaces, punctuation)
      const qA = alphaNum(q)
      for (const [key, entry] of caMasterMap) {
        if (alphaNum(key) === qA) return entry
      }
      // 3. One contains the other (handles extra suffixes / missing words)
      for (const [key, entry] of caMasterMap) {
        const kA = alphaNum(key)
        if (kA.includes(qA) || qA.includes(kA)) return entry
      }
      return undefined
    }

    type CaLink = {
      masterTaskId: string
      clientId:     string
      assigneeId:   string | null
      approverId:   string | null
    }

    async function flushCaLinks(links: { masterTaskId: string; clientId: string; assigneeId: string | null; approverId: string | null }[], createdBy: string): Promise<string | null> {
      if (links.length === 0) return null
      // Deduplicate by (master_task_id, client_id) — PostgreSQL upsert rejects duplicate keys in the same batch
      const seen = new Map<string, typeof links[0]>()
      for (const l of links) seen.set(`${l.masterTaskId}__${l.clientId}`, l)
      const unique = Array.from(seen.values())

      const { error } = await admin
        .from('ca_client_assignments')
        .upsert(
          unique.map(l => ({
            org_id:         orgId,
            master_task_id: l.masterTaskId,
            client_id:      l.clientId,
            assignee_id:    l.assigneeId,
            approver_id:    l.approverId,
            created_by:     createdBy,
            is_active:      true,
          })),
          { onConflict: 'master_task_id,client_id', ignoreDuplicates: false }
        )
      if (error) {
        console.error('[import] flushCaLinks upsert failed:', error.message)
        return 'Failed to save compliance links'
      }
      return null
    }

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

    // ── Pre-load all org lookup data (3 queries) to eliminate N+1 DB calls ──
    const [clientsPre, projectsPre, membersPre] = await Promise.all([
      admin.from('clients').select('id, name').eq('org_id', orgId),
      admin.from('projects').select('id, name').eq('org_id', orgId),
      admin.from('org_members')
        .select('user_id, role, users!inner(id, name, email)')
        .eq('org_id', orgId).eq('is_active', true),
    ])
    ;(clientsPre.data ?? []).forEach((c: any) => {
      clientNameToId[c.name.toLowerCase()] = c.id
    })
    ;(projectsPre.data ?? []).forEach((p: any) => {
      projectNameToId[p.name.toLowerCase()] = p.id
    })
    ;(membersPre.data ?? []).forEach((m: any) => {
      const u = m.users as any
      if (u?.email) emailCache[u.email.toLowerCase()] = m.user_id
      if (u?.name)  emailCache[u.name.toLowerCase()]  = m.user_id
      roleCache[m.user_id] = m.role
    })

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
            // Keep roleCache fresh so later sections (e.g. CA compliance) can resolve approver
            roleCache[uid] = role
            results.members.created++
          } else {
            const { data: invData, error: invErr } = await admin.auth.admin.inviteUserByEmail(email, {
              data: { invited_to_org: orgId, invited_role: role, full_name: name || null },
              redirectTo: `${APP_URL}/auth/callback`,
            })
            if (invErr) {
              if (invErr.message?.toLowerCase().includes('already') || invErr.message?.toLowerCase().includes('registered')) {
                const authId = await resolveAuthUser(email)
                if (authId) {
                  await admin.from('users').upsert({ id: authId, email, name: name || email.split('@')[0] }, { onConflict: 'id', ignoreDuplicates: true })
                  await admin.from('org_members').upsert({ org_id: orgId, user_id: authId, role, is_active: true }, { onConflict: 'org_id,user_id', ignoreDuplicates: false })
                  // Update caches so later sections can resolve this member as approver
                  emailCache[email.toLowerCase()] = authId
                  roleCache[authId] = role
                  results.members.created++
                } else {
                  results.members.errors.push(`${email}: user exists in auth but could not be resolved`)
                  results.members.skipped++
                }
              } else {
                results.members.errors.push(`${email}: Invitation failed. Check the email address and try again.`)
                results.members.skipped++
              }
            } else {
              // Capture the newly created auth user's ID so later sections (e.g. CA compliance)
              // can resolve this invited member as approver without hitting the poisoned null cache
              if (invData?.user?.id) {
                emailCache[email.toLowerCase()] = invData.user.id
                roleCache[invData.user.id] = role
              }
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
        const iPhone    = findCol(headers, 'phone')
        const iGstin    = findCol(headers, 'gstin')
        const iCompany  = findCol(headers, 'company')
        const iWebsite  = findCol(headers, 'website')
        const iIndustry = findCol(headers, 'industry')
        const iColor    = findCol(headers, 'color', 'colour')
        const iStatus   = findCol(headers, 'status')
        const iNotes    = findCol(headers, 'notes')

        const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/

        const toInsertClients: any[] = []
        const seenClientNames = new Set<string>()

        for (const row of dataRows(rows, hdrIdx)) {
          if (isSampleRow(row)) continue
          const name = cell(row, iName)
          if (!name) continue

          const lname = name.toLowerCase()
          if (clientNameToId[lname] || seenClientNames.has(lname)) {
            results.clients.skipped++
            continue
          }
          seenClientNames.add(lname)

          const status = cell(row, iStatus) || 'active'
          const rawColor = cell(row, iColor) || '#0d9488'
          const color = rawColor.startsWith('#') ? rawColor : `#${rawColor}`

          // GSTIN — validate format and derive PAN from it
          const rawGstin = cell(row, iGstin).toUpperCase().replace(/\s/g, '')
          const gstin    = GSTIN_RE.test(rawGstin) ? rawGstin : null
          const pan      = gstin ? gstin.slice(2, 12) : null
          const clientCustomFields = (gstin || pan)
            ? { ...(gstin ? { gstin } : {}), ...(pan ? { pan } : {}) }
            : null

          toInsertClients.push({
            _lname: lname,
            org_id: orgId,
            name: name.trim(),
            email: cell(row, iEmail) || null,
            phone: cell(row, iPhone) || null,
            company: cell(row, iCompany) || null,
            website: cell(row, iWebsite) || null,
            industry: cell(row, iIndustry) || null,
            color,
            status: ['active', 'inactive', 'lead'].includes(status) ? status : 'active',
            notes: cell(row, iNotes) || null,
            ...(clientCustomFields ? { custom_fields: clientCustomFields } : {}),
            created_by: user.id,
          })
        }

        // Bulk insert in batches of 200
        const CLIENT_BATCH = 200
        for (let bi = 0; bi < toInsertClients.length; bi += CLIENT_BATCH) {
          const batch = toInsertClients.slice(bi, bi + CLIENT_BATCH)
          const rows2insert = batch.map(({ _lname: _, ...rest }: any) => rest)
          const { data: created, error } = await admin.from('clients').insert(rows2insert).select('id, name')
          if (error) {
            results.clients.errors.push('Some clients could not be imported. Please check for duplicates or invalid data.')
            results.clients.skipped += batch.length
          } else {
            ;(created ?? []).forEach((c: any) => { clientNameToId[c.name.toLowerCase()] = c.id })
            results.clients.created += created?.length ?? 0
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
            results.projects.errors.push(`"${name}": Could not save this project. Check for duplicates and try again.`)
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

        const toInsertTasks: any[] = []
        const allTaskRows = dataRows(rows, hdrIdx).filter(r => !isSampleRow(r))
        const TASK_CHUNK = 20
        for (let ci = 0; ci < allTaskRows.length; ci += TASK_CHUNK) {
          await Promise.allSettled(allTaskRows.slice(ci, ci + TASK_CHUNK).map(async (row) => {
            const title = cell(row, iTitle)
            if (!title) return

            const priority = cell(row, iPriority) || 'medium'
            if (!['none', 'low', 'medium', 'high', 'urgent'].includes(priority)) {
              results.tasks.errors.push(`"${title}": invalid priority "${priority}"`)
              results.tasks.skipped++
              return
            }

            const status = cell(row, iStatus) || 'todo'
            const validStatus = ['todo', 'in_progress', 'completed', 'blocked'].includes(status) ? status : 'todo'

            const [assigneeData, approverId, projectId, clientId] = await Promise.all([
              resolveAssignees(cell(row, iAssignee)),
              cell(row, iApprover) ? resolveApprover(cell(row, iApprover)) : Promise.resolve(null),
              resolveProject(cell(row, iProject)),
              resolveClient(cell(row, iClient)),
            ])

            if (cell(row, iApprover) && !approverId) {
              results.tasks.errors.push(`"${title}": approver must be an active owner/admin/manager in this organisation`)
            }

            toInsertTasks.push({
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
              due_date: cellDate(row, iDue),
              estimated_hours: parseNumber(cell(row, iHours)),
              created_by: user.id,
              is_recurring: false,
              custom_fields: assigneeData.extra.length > 0 ? { _co_assignees: assigneeData.extra } : null,
            })
          }))
        }
        const TASK_INSERT_BATCH = 200
        for (let bi = 0; bi < toInsertTasks.length; bi += TASK_INSERT_BATCH) {
          const batch = toInsertTasks.slice(bi, bi + TASK_INSERT_BATCH)
          const { error } = await admin.from('tasks').insert(batch)
          if (error) {
            results.tasks.errors.push('Some rows could not be saved. Please check the data format and try again.')
            results.tasks.skipped += batch.length
          } else {
            results.tasks.created += batch.length
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
        const oneTimeCaLinks: CaLink[] = []
        const toInsertOneTasks: any[] = []

        const allOneTimeRows = dataRows(rows, hdrIdx).filter(r => !isSampleRow(r))
        const ONE_CHUNK = 20
        for (let ci = 0; ci < allOneTimeRows.length; ci += ONE_CHUNK) {
          await Promise.allSettled(allOneTimeRows.slice(ci, ci + ONE_CHUNK).map(async (row) => {
            const title = cell(row, iTitle)
            if (!title) return

            const priority = cell(row, iPriority) || 'medium'
            if (!['none', 'low', 'medium', 'high', 'urgent'].includes(priority)) {
              results.onetasks.errors.push(`"${title}": invalid priority "${priority}"`)
              results.onetasks.skipped++
              return
            }

            const [assigneeData, approverId, clientId] = await Promise.all([
              resolveAssignees(cell(row, iAssignee)),
              cell(row, iApprover) ? resolveApprover(cell(row, iApprover)) : Promise.resolve(null),
              resolveClient(cell(row, iClient)),
            ])

            const complianceType = cell(row, iCompliance)
            const compTask = complianceType ? findComplianceTask(complianceType) : null
            const oneTimeMasterEntry = complianceType
              ? (findMasterEntry(complianceType) ?? (compTask ? findMasterEntry(compTask.title) : undefined))
              : undefined
            const isComplianceRow = !!(compTask || oneTimeMasterEntry)
            const masterName = oneTimeMasterEntry
              ? ((_allCaMasterTasks ?? []).find((t: any) => t.id === oneTimeMasterEntry.id)?.name ?? complianceType)
              : null
            const finalTitle = masterName ?? (compTask ? compTask.title : title.trim())
            const finalPriority = compTask?.priority ?? priority

            const dueDate = (() => {
              if (!isComplianceRow) return cellDate(row, iDue)
              const dbDates = oneTimeMasterEntry?.dates ?? {}
              const effective = Object.keys(dbDates).length > 0
                ? dbDates
                : findDefaultDates(complianceType || finalTitle)
              return nextDueDateFromMaster(effective)
            })()

            if (cell(row, iApprover) && !approverId) {
              results.onetasks.errors.push(`"${finalTitle}": approver must be an active owner/admin/manager in this organisation`)
            }

            const customFields: Record<string, any> = {
              ...(isComplianceRow ? { _ca_compliance: true } : {}),
              ...(assigneeData.extra.length > 0 ? { _co_assignees: assigneeData.extra } : {}),
            }
            const customFieldsOrNull = Object.keys(customFields).length > 0 ? customFields : null

            if (isComplianceRow) {
              if (oneTimeMasterEntry?.id && clientId) {
                oneTimeCaLinks.push({
                  masterTaskId: oneTimeMasterEntry.id,
                  clientId,
                  assigneeId: assigneeData.primary ?? null,
                  approverId: approverId ?? null,
                })
                results.onetasks.created++
              } else if (!oneTimeMasterEntry?.id) {
                results.onetasks.errors.push(`"${finalTitle}": not found in your CA Master tasks (Step 1). Add it in Compliance Master first.`)
                results.onetasks.skipped++
              } else if (!clientId) {
                results.onetasks.errors.push(`"${finalTitle}": client not found — check the client name matches exactly.`)
                results.onetasks.skipped++
              }
            } else {
              toInsertOneTasks.push({
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
              })
            }
          }))
        }

        // Batch insert regular one-time tasks
        const ONE_INSERT_BATCH = 200
        for (let bi = 0; bi < toInsertOneTasks.length; bi += ONE_INSERT_BATCH) {
          const batch = toInsertOneTasks.slice(bi, bi + ONE_INSERT_BATCH)
          const { error } = await admin.from('tasks').insert(batch)
          if (error) {
            results.onetasks.errors.push('Some rows could not be saved. Please check the data format and try again.')
            results.onetasks.skipped += batch.length
          } else {
            results.onetasks.created += batch.length
          }
        }

        const oneTimeFlushErr = await flushCaLinks(oneTimeCaLinks, user.id)
        if (oneTimeFlushErr) {
          results.onetasks.errors.push('Some compliance assignments could not be saved. Please try again.')
          // Rollback the created count for the links that failed
          results.onetasks.created -= oneTimeCaLinks.length
          results.onetasks.skipped += oneTimeCaLinks.length
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

        const toInsertRecurring: any[] = []
        const allRecurringRows = dataRows(rows, hdrIdx).filter(r => !isSampleRow(r))
        const REC_CHUNK = 20
        for (let ci = 0; ci < allRecurringRows.length; ci += REC_CHUNK) {
          await Promise.allSettled(allRecurringRows.slice(ci, ci + REC_CHUNK).map(async (row) => {
            const title = cell(row, iTitle)
            if (!title) return

            const freq = norm(cell(row, iFreq))
            if (!VALID_FREQS.includes(freq)) {
              results.recurring.errors.push(`"${title}": invalid frequency "${freq}"`)
              results.recurring.skipped++
              return
            }

            const priority = cell(row, iPriority) || 'medium'
            if (!['none', 'low', 'medium', 'high', 'urgent'].includes(priority)) {
              results.recurring.errors.push(`"${title}": invalid priority "${priority}"`)
              results.recurring.skipped++
              return
            }

            const startDate = cellDate(row, iStart) || new Date().toISOString().split('T')[0]
            const [assigneeData, approverId, projectId, clientId] = await Promise.all([
              resolveAssignees(cell(row, iAssignee)),
              cell(row, iApprover) ? resolveApprover(cell(row, iApprover)) : Promise.resolve(null),
              resolveProject(cell(row, iProject)),
              resolveClient(cell(row, iClient)),
            ])

            if (cell(row, iApprover) && !approverId) {
              results.recurring.errors.push(`"${title}": approver must be an active owner/admin/manager in this organisation`)
            }

            toInsertRecurring.push({
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
              custom_fields: assigneeData.extra.length > 0 ? { _co_assignees: assigneeData.extra } : null,
            })
          }))
        }
        const REC_INSERT_BATCH = 200
        for (let bi = 0; bi < toInsertRecurring.length; bi += REC_INSERT_BATCH) {
          const batch = toInsertRecurring.slice(bi, bi + REC_INSERT_BATCH)
          const { error } = await admin.from('tasks').insert(batch)
          if (error) {
            results.recurring.errors.push('Some rows could not be saved. Please check the data format and try again.')
            results.recurring.skipped += batch.length
          } else {
            results.recurring.created += batch.length
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

        const caLinksToCreate: CaLink[] = []

        const allCaRows = dataRows(rows, hdrIdx).filter(r => !isSampleRow(r))
        const CA_CHUNK = 20
        for (let ci = 0; ci < allCaRows.length; ci += CA_CHUNK) {
          await Promise.allSettled(allCaRows.slice(ci, ci + CA_CHUNK).map(async (row) => {
            const typeName = cell(row, iType)
            if (!typeName) return

            const typeNorm = typeName.toLowerCase()
            if (
              typeNorm.includes('select') || typeNorm.includes('dropdown') ||
              typeNorm.includes('enter') || typeNorm.includes('type here') ||
              typeNorm.includes('e.g') || typeNorm.includes('example')
            ) {
              results.compliance.skipped++
              return
            }

            const masterEntry = findMasterEntry(typeName)
            const compTask    = findComplianceTask(typeName)

            if (!masterEntry && !compTask) {
              results.compliance.errors.push(`"${typeName}": not found in your CA Master or recognised compliance tasks`)
              results.compliance.skipped++
              return
            }

            const canonicalTitle = masterEntry
              ? (_allCaMasterTasks ?? []).find((t: any) => t.id === masterEntry.id)?.name ?? typeName
              : compTask!.title

            const [clientId, assigneeData, approverId] = await Promise.all([
              resolveClient(cell(row, iClient)),
              resolveAssignees(cell(row, iAssignee)),
              cell(row, iApprover) ? resolveApprover(cell(row, iApprover)) : Promise.resolve(null),
            ])

            if (cell(row, iApprover) && !approverId) {
              results.compliance.errors.push(`"${canonicalTitle}": approver must be an active owner/admin/manager in this organisation`)
            }

            if (masterEntry?.id && clientId) {
              caLinksToCreate.push({
                masterTaskId: masterEntry.id,
                clientId,
                assigneeId: assigneeData.primary ?? null,
                approverId: approverId ?? null,
              })
              results.compliance.created++
            } else {
              results.compliance.errors.push(`"${canonicalTitle}": ${!clientId ? 'client not found' : 'not found in CA Master — add it in Step 1 first'}`)
              results.compliance.skipped++
            }
          }))
        }

        const caFlushErr = await flushCaLinks(caLinksToCreate, user.id)
        if (caFlushErr) {
          results.compliance.errors.push('Some compliance assignments could not be saved. Please try again.')
          results.compliance.created = 0
          results.compliance.skipped += caLinksToCreate.length
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
        error: 'Import failed unexpectedly. Please try again or contact support if the problem persists.',
        detail: String(e),
      },
      { status: 500 }
    )
  }
}