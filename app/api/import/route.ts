export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import * as XLSX from 'xlsx'

export const maxDuration = 60

// ─── Sample/placeholder row detection ────────────────────────────────────────

const SAMPLE_PATTERNS = [
  /yourcompany\.com/i,
  /sample/i,
  /example/i,
  /placeholder/i,
  /replace\s*me/i,
  /test\s*client/i,
  /demo/i,
  /^\s*$/,           // blank
  /^[_\-*#]+$/,      // decoration rows
  /task\s*[-–]\s*replace/i,
  /client\s*[-–]\s*replace/i,
  /john\s*doe/i,
  /jane\s*doe/i,
  /user@example/i,
]

function isSampleRow(values: (string | number | null | undefined)[]): boolean {
  const joined = values
    .filter(v => v !== null && v !== undefined)
    .map(v => String(v).trim())
    .join(' ')

  if (!joined.trim()) return true  // all empty

  for (const pattern of SAMPLE_PATTERNS) {
    if (pattern.test(joined)) return true
  }

  return false
}

function cellStr(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

function parseExcelDate(v: unknown): string | null {
  if (!v) return null
  if (typeof v === 'number') {
    // Excel serial date
    const date = XLSX.SSF.parse_date_code(v)
    if (!date) return null
    const y = date.y
    const m = String(date.m).padStart(2, '0')
    const d = String(date.d).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  const s = String(v).trim()
  // Strip time portion: "2023-02-17 00:00:00" → "2023-02-17"
  return s.split(' ')[0].split('T')[0] || null
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get org
  const { data: member } = await supabase
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member) return NextResponse.json({ error: 'No org found' }, { status: 403 })
  const { org_id } = member

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false })

  const results = {
    members_imported: 0,
    clients_imported: 0,
    projects_imported: 0,
    tasks_imported: 0,
    one_time_tasks_imported: 0,
    recurring_tasks_imported: 0,
    skipped: 0,
    errors: [] as string[],
  }

  // ─── Pre-build email → userId cache (1 batch, not per row) ───────────────
  const { data: authUsers } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const emailToUserId = new Map<string, string>()
  authUsers?.users?.forEach(u => {
    if (u.email) emailToUserId.set(u.email.toLowerCase(), u.id)
  })

  // Also cache existing org members by email
  const { data: orgMembersRaw } = await supabase
    .from('org_members')
    .select('user_id, users(email)')
    .eq('org_id', org_id)

  const existingMemberEmails = new Set<string>()
  orgMembersRaw?.forEach((m: any) => {
    if (m.users?.email) existingMemberEmails.add(m.users.email.toLowerCase())
  })

  // Cache existing clients by name
  const { data: existingClients } = await supabase
    .from('clients')
    .select('id, name')
    .eq('org_id', org_id)
  const clientNameToId = new Map<string, string>()
  existingClients?.forEach(c => clientNameToId.set(c.name.toLowerCase(), c.id))

  // Cache existing projects by name
  const { data: existingProjects } = await supabase
    .from('projects')
    .select('id, name')
    .eq('org_id', org_id)
  const projectNameToId = new Map<string, string>()
  existingProjects?.forEach(p => projectNameToId.set(p.name.toLowerCase(), p.id))

  // ─── Sheet: Team Members ──────────────────────────────────────────────────
  const membersSheet = workbook.Sheets['Team Members'] ?? workbook.Sheets['Members']
  if (membersSheet) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(membersSheet, { defval: '' })
    for (const row of rows) {
      const values = Object.values(row)
      if (isSampleRow(values)) { results.skipped++; continue }

      const email = cellStr(row['Email'] ?? row['email'])
      const name = cellStr(row['Name'] ?? row['name'] ?? row['Full Name'])
      const role = cellStr(row['Role'] ?? row['role']) || 'member'

      if (!email || !email.includes('@')) { results.skipped++; continue }

      try {
        const userId = emailToUserId.get(email.toLowerCase())
        if (!userId) {
          // Invite new user
          const { data: invited } = await admin.auth.admin.inviteUserByEmail(email, {
            data: { full_name: name, org_id }
          })
          if (invited?.user) {
            emailToUserId.set(email.toLowerCase(), invited.user.id)
            await supabase.from('org_members').upsert({
              org_id, user_id: invited.user.id, role
            })
            results.members_imported++
          }
        } else if (!existingMemberEmails.has(email.toLowerCase())) {
          await supabase.from('org_members').upsert({ org_id, user_id: userId, role })
          results.members_imported++
        }
      } catch (e: any) {
        results.errors.push(`Member ${email}: ${e.message}`)
      }
    }
  }

  // ─── Sheet: Clients ───────────────────────────────────────────────────────
  const clientsSheet = workbook.Sheets['Clients'] ?? workbook.Sheets['clients']
  if (clientsSheet) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(clientsSheet, { defval: '' })
    for (const row of rows) {
      if (isSampleRow(Object.values(row))) { results.skipped++; continue }

      const name = cellStr(row['Client Name'] ?? row['Name'] ?? row['name'])
      if (!name) { results.skipped++; continue }

      const email = cellStr(row['Email'] ?? row['email'])
      const phone = cellStr(row['Phone'] ?? row['phone'])
      const gstin = cellStr(row['GSTIN'] ?? row['gstin'])
      const pan = cellStr(row['PAN'] ?? row['pan'])

      if (clientNameToId.has(name.toLowerCase())) { results.skipped++; continue }

      try {
        const { data: c } = await supabase.from('clients').insert({
          org_id, name, email: email || null, phone: phone || null,
          gstin: gstin || null, pan: pan || null,
        }).select('id').maybeSingle()

        if (c) {
          clientNameToId.set(name.toLowerCase(), c.id)
          results.clients_imported++
        }
      } catch (e: any) {
        results.errors.push(`Client ${name}: ${e.message}`)
      }
    }
  }

  // ─── Sheet: Projects ──────────────────────────────────────────────────────
  const projectsSheet = workbook.Sheets['Projects'] ?? workbook.Sheets['projects']
  if (projectsSheet) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(projectsSheet, { defval: '' })
    for (const row of rows) {
      if (isSampleRow(Object.values(row))) { results.skipped++; continue }

      const name = cellStr(row['Project Name'] ?? row['Name'] ?? row['name'])
      if (!name) { results.skipped++; continue }
      if (projectNameToId.has(name.toLowerCase())) { results.skipped++; continue }

      const clientName = cellStr(row['Client'] ?? row['client'])
      const clientId = clientName ? clientNameToId.get(clientName.toLowerCase()) : null
      const dueDate = parseExcelDate(row['Due Date'] ?? row['due_date'])
      const status = cellStr(row['Status'] ?? row['status']) || 'active'

      try {
        const { data: p } = await supabase.from('projects').insert({
          org_id,
          name,
          client_id: clientId ?? null,
          due_date: dueDate,
          status,
          owner_id: user.id,
        }).select('id').maybeSingle()

        if (p) {
          projectNameToId.set(name.toLowerCase(), p.id)
          results.projects_imported++
        }
      } catch (e: any) {
        results.errors.push(`Project ${name}: ${e.message}`)
      }
    }
  }

  // ─── Helper: import tasks from a sheet ────────────────────────────────────
  async function importTaskSheet(sheetName: string, isRecurring: boolean) {
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) return

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
    for (const row of rows) {
      if (isSampleRow(Object.values(row))) { results.skipped++; continue }

      const title = cellStr(row['Task Title'] ?? row['Title'] ?? row['title'] ?? row['Task'])
      if (!title) { results.skipped++; continue }

      const clientName = cellStr(row['Client'] ?? row['client'])
      const projectName = cellStr(row['Project'] ?? row['project'])
      const assigneeEmail = cellStr(row['Assignee Email'] ?? row['Assigned To'] ?? row['assignee'])
      const dueDate = parseExcelDate(row['Due Date'] ?? row['due_date'])
      const priority = cellStr(row['Priority'] ?? row['priority']) || 'medium'
      const frequency = cellStr(row['Frequency'] ?? row['frequency'])
      const status = cellStr(row['Status'] ?? row['status']) || 'todo'
      const description = cellStr(row['Description'] ?? row['description'])

      const clientId = clientName ? clientNameToId.get(clientName.toLowerCase()) : null
      const projectId = projectName ? projectNameToId.get(projectName.toLowerCase()) : null
      const assigneeId = assigneeEmail ? emailToUserId.get(assigneeEmail.toLowerCase()) : null

      try {
        await supabase.from('tasks').insert({
          org_id,
          title,
          description: description || null,
          client_id: clientId ?? null,
          project_id: projectId ?? null,
          assignee_id: assigneeId ?? null,
          due_date: dueDate,
          priority: ['low', 'medium', 'high', 'urgent'].includes(priority) ? priority : 'medium',
          status: ['todo', 'in_progress', 'in_review', 'completed'].includes(status) ? status : 'todo',
          is_recurring: isRecurring,
          frequency: isRecurring && frequency ? frequency : null,
          created_by: user.id,
        })

        if (isRecurring) results.recurring_tasks_imported++
        else results.tasks_imported++
      } catch (e: any) {
        results.errors.push(`Task "${title}": ${e.message}`)
      }
    }
  }

  await importTaskSheet('Tasks', false)
  await importTaskSheet('One-Time Tasks', false)
  await importTaskSheet('Recurring Tasks', true)

  return NextResponse.json({
    success: true,
    ...results,
    total_imported: results.members_imported + results.clients_imported +
      results.projects_imported + results.tasks_imported +
      results.one_time_tasks_imported + results.recurring_tasks_imported,
  })
}
