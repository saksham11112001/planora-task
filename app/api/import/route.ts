import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse }       from 'next/server'
import type { NextRequest }   from 'next/server'

// ── Parse xlsx using SheetJS (xlsx package) ───────────────────────
async function parseXlsx(buffer: ArrayBuffer): Promise<Record<string, string[][]>> {
  const XLSX = await import('xlsx')
  const wb = XLSX.read(new Uint8Array(buffer), { type: 'array', raw: false })

  const result: Record<string, string[][]> = {}
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName]
    // sheet_to_json with header:1 gives us string[][] (array of arrays)
    const rows = XLSX.utils.sheet_to_json<string[]>(ws, {
      header: 1,
      defval: '',
      raw: false, // always return formatted strings, not raw numbers
    })
    result[sheetName] = rows as string[][]
  }
  return result
}

// ── Helpers ───────────────────────────────────────────────────────
function norm(s: string) {
  return (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

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

// ── POST handler ──────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: mb } = await supabase
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!mb || !['owner', 'admin', 'manager'].includes(mb.role))
    return NextResponse.json({ error: 'Only managers and above can import' }, { status: 403 })

  // ── Parse uploaded file ─────────────────────────────────────────
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Could not read form data' }, { status: 400 })
  }

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
    return NextResponse.json(
      { error: 'Could not parse Excel file: ' + (e?.message ?? 'unknown error') },
      { status: 400 }
    )
  }

  // ── Setup ───────────────────────────────────────────────────────
  const admin  = createAdminClient()
  const orgId  = mb.org_id
  const results = {
    members:  { created: 0, skipped: 0, errors: [] as string[] },
    projects: { created: 0, skipped: 0, errors: [] as string[] },
    tasks:    { created: 0, skipped: 0, errors: [] as string[] },
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

  // ── 1. MEMBERS ─────────────────────────────────────────────────
  const memberSheet = Object.keys(sheets).find(k =>
    norm(k).includes('member') || norm(k).includes('team')
  )

  if (memberSheet) {
    const rows = sheets[memberSheet]
    // Find the actual header row (contains "email")
    const hdrIdx = rows.findIndex(r => r.some(c => norm(c).includes('email')))
    if (hdrIdx !== -1) {
      const headers = rows[hdrIdx]
      const iName  = findCol(headers, 'fullname', 'name')
      const iEmail = findCol(headers, 'email')
      const iRole  = findCol(headers, 'role')

      // Data starts 2 rows after header (header + hint row)
      const dataRows = rows.slice(hdrIdx + 2)

      for (const row of dataRows) {
        const email = cell(row, iEmail).toLowerCase()
        const name  = cell(row, iName)
        const role  = cell(row, iRole).toLowerCase() || 'member'

        if (!email || !email.includes('@')) continue
        if (!['admin', 'manager', 'member', 'viewer'].includes(role)) {
          results.members.errors.push(`${email}: invalid role "${role}"`)
          results.members.skipped++
          continue
        }

        const uid = await resolveEmail(email)

        if (uid) {
          // User exists — check membership
          const { data: existing } = await admin
            .from('org_members')
            .select('id, is_active')
            .eq('org_id', orgId)
            .eq('user_id', uid)
            .maybeSingle()

          if (existing?.is_active) {
            results.members.skipped++
            continue
          }
          if (existing) {
            await admin.from('org_members').update({ is_active: true, role }).eq('id', existing.id)
          } else {
            await admin.from('org_members').insert({ org_id: orgId, user_id: uid, role, is_active: true })
          }
          if (name) await admin.from('users').update({ name }).eq('id', uid)
          results.members.created++
        } else {
          // New user — send invite
          const { error: invErr } = await admin.auth.admin.inviteUserByEmail(email, {
            data: { invited_to_org: orgId, invited_role: role, full_name: name },
            redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
          })
          if (invErr) {
            results.members.errors.push(`${email}: ${invErr.message}`)
            results.members.skipped++
          } else {
            results.members.created++
          }
        }
      }
    }
  }

  // ── 2. PROJECTS ────────────────────────────────────────────────
  const projNameToId: Record<string, string> = {}
  const projectSheet = Object.keys(sheets).find(k => norm(k).includes('project'))

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
      const iBudget = findCol(headers, 'budget')
      const iHours  = findCol(headers, 'hourbudget', 'hours')
      const iDesc   = findCol(headers, 'description', 'desc')

      const dataRows = rows.slice(hdrIdx + 2)

      for (const row of dataRows) {
        const name = cell(row, iName)
        if (!name) continue

        const rawColor = cell(row, iColor) || '#0d9488'
        const color    = rawColor.startsWith('#') ? rawColor : `#${rawColor}`
        const status   = cell(row, iStatus) || 'active'
        const dueDate  = cell(row, iDue) || null
        const ownerEmail = cell(row, iOwner)
        const budget   = cell(row, iBudget)
        const hours    = cell(row, iHours)
        const desc     = cell(row, iDesc)

        if (!['active', 'on_hold', 'completed'].includes(status)) {
          results.projects.errors.push(`"${name}": invalid status "${status}"`)
          results.projects.skipped++
          continue
        }

        const ownerId = ownerEmail ? (await resolveEmail(ownerEmail)) ?? user.id : user.id

        const { data: proj, error: projErr } = await admin
          .from('projects')
          .insert({
            org_id:       orgId,
            name:         name.trim(),
            color,
            status,
            due_date:     dueDate || null,
            owner_id:     ownerId,
            budget:       budget  ? parseFloat(budget)  : null,
            hours_budget: hours   ? parseFloat(hours)   : null,
            description:  desc    || null,
          })
          .select('id')
          .single()

        if (projErr) {
          results.projects.errors.push(`"${name}": ${projErr.message}`)
          results.projects.skipped++
        } else {
          projNameToId[name.trim().toLowerCase()] = proj.id
          results.projects.created++
        }
      }
    }
  }

  // ── 3. TASKS ───────────────────────────────────────────────────
  const taskSheet = Object.keys(sheets).find(k => norm(k).includes('task'))

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
      const iPriority = findCol(headers, 'priority')
      const iDue      = findCol(headers, 'duedate', 'due')
      const iStatus   = findCol(headers, 'status')
      const iHours    = findCol(headers, 'esthours', 'estimatedhours', 'hours')
      const iDesc     = findCol(headers, 'description', 'desc')

      const dataRows = rows.slice(hdrIdx + 2)

      for (const row of dataRows) {
        const title = cell(row, iTitle)
        if (!title) continue

        const projectName   = cell(row, iProject).toLowerCase().trim()
        const assigneeEmail = cell(row, iAssignee)
        const priority      = cell(row, iPriority) || 'medium'
        const dueDate       = cell(row, iDue) || null
        const status        = cell(row, iStatus) || 'todo'
        const estHours      = cell(row, iHours)
        const desc          = cell(row, iDesc)

        if (!['none', 'low', 'medium', 'high', 'urgent'].includes(priority)) {
          results.tasks.errors.push(`"${title}": invalid priority "${priority}"`)
          results.tasks.skipped++
          continue
        }

        // Resolve project — first from just-imported, then from existing org projects
        let projectId: string | null = projNameToId[projectName] ?? null
        if (!projectId && projectName) {
          const { data: ep } = await admin
            .from('projects')
            .select('id')
            .eq('org_id', orgId)
            .ilike('name', projectName)
            .maybeSingle()
          projectId = ep?.id ?? null
        }

        const assigneeId = assigneeEmail ? await resolveEmail(assigneeEmail) : null
        const validStatus = ['todo', 'in_progress', 'completed', 'blocked'].includes(status)
          ? status : 'todo'

        const { error: taskErr } = await admin.from('tasks').insert({
          org_id:            orgId,
          title:             title.trim(),
          description:       desc       || null,
          status:            validStatus,
          priority,
          project_id:        projectId,
          assignee_id:       assigneeId,
          due_date:          dueDate    || null,
          estimated_hours:   estHours   ? parseFloat(estHours) : null,
          created_by:        user.id,
          is_recurring:      false,
          approval_required: false,
        })

        if (taskErr) {
          results.tasks.errors.push(`"${title}": ${taskErr.message}`)
          results.tasks.skipped++
        } else {
          results.tasks.created++
        }
      }
    }
  }

  const totalCreated = results.members.created + results.projects.created + results.tasks.created
  return NextResponse.json({ success: true, results, totalCreated })
}
