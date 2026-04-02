import { NextResponse } from 'next/server'
import { createClient }  from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  // Auth: get the user's org members and clients to pre-fill the template
  let memberEmails: string[]  = ['alex@yourcompany.com', 'priya@yourcompany.com', 'sam@yourcompany.com']
  let memberNames:  string[]  = ['Alex Johnson', 'Priya Sharma', 'Sam Gupta']
  let clientNames:  string[]  = ['Acme Corp', 'Garg Sons', 'Mehra & Co']
  let memberRows:   any[][]   = [
    ['Alex Johnson',  'alex@yourcompany.com',   'manager', ''],
    ['Priya Sharma',  'priya@yourcompany.com',  'member',  ''],
    ['Sam Gupta',     'sam@yourcompany.com',    'member',  ''],
  ]
  let clientRows:   any[][]   = [
    ['Acme Corp',   'hello@acme.com',          '+91 9876543210', 'Acme Corp Ltd',  'Technology', 'active', '#6366f1', ''],
    ['Garg Sons',   'accounts@gargsons.com',   '+91 9988776655', 'Garg Sons Ltd',  'Retail',     'active', '#ea580c', ''],
    ['Mehra & Co',  'info@mehraandco.com',      '',              'Mehra & Co CA',  'Finance',    'active', '#0d9488', ''],
  ]

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const { data: mb } = await supabase
        .from('org_members')
        .select('org_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle()

      if (mb?.org_id) {
        // Fetch real team members
        const { data: members } = await supabase
          .from('org_members')
          .select('role, users(id, name, email)')
          .eq('org_id', mb.org_id)
          .eq('is_active', true)
          .order('role')

        if (members && members.length > 0) {
          memberRows = members
            .filter((m: any) => m.users?.email)
            .map((m: any) => [
              m.users.name  ?? m.users.email.split('@')[0],
              m.users.email ?? '',
              m.role        ?? 'member',
              '',
            ])
          memberEmails = memberRows.map((r: any) => r[1]).filter(Boolean)
          memberNames  = memberRows.map((r: any) => r[0]).filter(Boolean)
        }

        // Fetch real clients
        const { data: clients } = await supabase
          .from('clients')
          .select('name, email, phone_number, company, industry, status, color')
          .eq('org_id', mb.org_id)
          .eq('status', 'active')
          .order('name')

        if (clients && clients.length > 0) {
          clientRows = clients.map((c: any) => [
            c.name          ?? '',
            c.email         ?? '',
            c.phone_number  ?? '',
            c.company       ?? c.name ?? '',
            c.industry      ?? '',
            c.status        ?? 'active',
            c.color         ?? '#0d9488',
            '',
          ])
          clientNames = clientRows.map((r: any) => r[0]).filter(Boolean)
        }
      }
    }
  } catch {
    // Fall through to defaults if auth fails
  }

  try {
    const XLSX = await import('xlsx')
    const wb   = XLSX.utils.book_new()

    // Build comma-separated dropdown strings from real org data
    const memberEmailList = memberEmails.join(',')
    const clientNameList  = clientNames.join(',')

    // Helper: sheet with column widths
    function ws(data: any[][], cols: number[]) {
      const sheet = XLSX.utils.aoa_to_sheet(data)
      sheet['!cols'] = cols.map(w => ({ wch: w }))
      return sheet
    }

    // ── README ───────────────────────────────────────────────────────
    XLSX.utils.book_append_sheet(wb, ws([
      ['PLANORA BULK IMPORT TEMPLATE — personalised for your workspace'],
      [''],
      ['IMPORTANT: Fill sheets in this exact order:'],
      ['  Step 1 →  👥 Team Members  — add/confirm your team (emails used as assignee dropdowns)'],
      ['  Step 2 →  🏢 Clients        — add/confirm clients (names used as client dropdowns)'],
      ['  Step 3 →  📁 Projects       — reference client names from Step 2'],
      ['  Step 4 →  ✅ Tasks / 📥 One-Time Tasks / 🔁 Recurring Tasks'],
      [''],
      ['SMART DROPDOWNS: The Assignee, Approver, and Client Name columns show dropdowns'],
      ['populated from the Team Members and Clients sheets you fill in Steps 1 & 2.'],
      ['After editing those sheets, the dropdowns in task sheets will reflect your data.'],
      [''],
      ['OTHER DROPDOWN COLUMNS:'],
      ['  Role      →  owner | admin | manager | member | viewer'],
      ['  Priority  →  none | low | medium | high | urgent'],
      ['  Status    →  todo | in_progress | completed | blocked'],
      ['  Frequency →  daily | weekly | bi_weekly | monthly | quarterly | annual'],
      [''],
      ['ASSIGNEE EMAILS: comma-separate for multiple  →  alex@co.com,priya@co.com'],
      ['DATES: YYYY-MM-DD  →  2025-08-31'],
      ['Columns marked * are REQUIRED — blank rows are skipped.'],
    ], [80]), '📖 README')

    // ── Team Members ─────────────────────────────────────────────────
    const mWs = ws([
      ['Full Name *', 'Email *', 'Role *', 'Notes'],
      ...memberRows,
    ], [25, 32, 12, 25])
    ;(mWs as any)['!dataValidation'] = [
      { sqref: 'C2:C200', type: 'list', formula1: '"owner,admin,manager,member,viewer"' },
    ]
    XLSX.utils.book_append_sheet(wb, mWs, '👥 Team Members')

    // ── Clients ───────────────────────────────────────────────────────
    const cWs = ws([
      ['Client Name *', 'Contact Email', 'Phone', 'Company', 'Industry', 'Status', 'Color', 'Notes'],
      ...clientRows,
    ], [24, 28, 17, 24, 14, 10, 10, 22])
    ;(cWs as any)['!dataValidation'] = [
      { sqref: 'F2:F200', type: 'list', formula1: '"active,inactive,lead"' },
    ]
    XLSX.utils.book_append_sheet(wb, cWs, '🏢 Clients')

    // ── Projects ──────────────────────────────────────────────────────
    // Sample rows use real member/client data
    const p1email  = memberEmails[0] ?? 'owner@yourcompany.com'
    const p2email  = memberEmails[1] ?? memberEmails[0] ?? 'owner@yourcompany.com'
    const client1  = clientNames[0] ?? 'Client 1'
    const client2  = clientNames[1] ?? clientNames[0] ?? 'Client 2'
    const pWs = ws([
      ['Project Name *', 'Color', 'Status', 'Due Date', 'Owner Email', 'Client Name', 'Hours Budget', 'Description'],
      ['Project Alpha',   '#6366f1', 'active', '2025-08-31', p1email, client1, '40', ''],
      ['Project Beta',    '#ea580c', 'active', '2025-09-30', p2email, client2, '',   ''],
    ], [24, 10, 12, 14, 32, 22, 13, 28])
    ;(pWs as any)['!dataValidation'] = [
      { sqref: 'C2:C200', type: 'list', formula1: '"active,on_hold,completed,cancelled"' },
      // Owner Email dropdown from real member emails
      { sqref: 'E2:E200', type: 'list', formula1: `"${memberEmailList}"` },
      // Client Name dropdown from real client names
      { sqref: 'F2:F200', type: 'list', formula1: `"${clientNameList}"` },
    ]
    XLSX.utils.book_append_sheet(wb, pWs, '📁 Projects')

    // ── Tasks (project-linked) ─────────────────────────────────────────
    const t1email = memberEmails[0] ?? 'member@yourcompany.com'
    const t2email = memberEmails[1] ?? memberEmails[0] ?? 'member@yourcompany.com'
    const tWs = ws([
      ['Task Title *', 'Project Name', 'Assignee Email(s)', 'Approver Email', 'Priority', 'Due Date', 'Status', 'Client Name', 'Est. Hours', 'Description'],
      ['Task 1 — replace me', 'Project Alpha', t1email, p1email, 'high', '2025-07-15', 'todo', client1, '4', ''],
      ['Task 2 — replace me', 'Project Beta',  t2email, p2email, 'medium', '2025-07-20', 'todo', client2, '2', ''],
    ], [26, 20, 32, 32, 10, 14, 14, 20, 10, 28])
    ;(tWs as any)['!dataValidation'] = [
      { sqref: 'C2:C200', type: 'list', formula1: `"${memberEmailList}"` },
      { sqref: 'D2:D200', type: 'list', formula1: `"${memberEmailList}"` },
      { sqref: 'E2:E200', type: 'list', formula1: '"none,low,medium,high,urgent"' },
      { sqref: 'G2:G200', type: 'list', formula1: '"todo,in_progress,completed,blocked"' },
      { sqref: 'H2:H200', type: 'list', formula1: `"${clientNameList}"` },
    ]
    XLSX.utils.book_append_sheet(wb, tWs, '✅ Tasks')

    // ── One-Time Tasks ────────────────────────────────────────────────
    const otWs = ws([
      ['Task Title *', 'Assignee Email(s)', 'Approver Email', 'Priority', 'Due Date', 'Client Name', 'Est. Hours', 'Description'],
      ['Task — replace me', t1email, p1email, 'high', '2025-07-10', client1, '2', ''],
      ['Task — replace me', t2email, '',      'medium', '2025-07-15', client2, '1', ''],
    ], [26, 32, 32, 10, 14, 20, 10, 28])
    ;(otWs as any)['!dataValidation'] = [
      { sqref: 'B2:B200', type: 'list', formula1: `"${memberEmailList}"` },
      { sqref: 'C2:C200', type: 'list', formula1: `"${memberEmailList}"` },
      { sqref: 'D2:D200', type: 'list', formula1: '"none,low,medium,high,urgent"' },
      { sqref: 'F2:F200', type: 'list', formula1: `"${clientNameList}"` },
    ]
    XLSX.utils.book_append_sheet(wb, otWs, '📥 One-Time Tasks')

    // ── Recurring Tasks ───────────────────────────────────────────────
    const rWs = ws([
      ['Task Title *', 'Frequency *', 'Assignee Email(s)', 'Approver Email', 'Priority', 'Project Name', 'Start Date', 'Description'],
      ['Weekly standup',    'weekly',   t1email, '',      'medium', 'Project Alpha', '2025-07-07', ''],
      ['Monthly review',    'monthly',  t2email, p1email, 'high',   'Project Beta',  '2025-07-01', ''],
    ], [26, 12, 32, 32, 10, 22, 14, 28])
    ;(rWs as any)['!dataValidation'] = [
      { sqref: 'B2:B200', type: 'list', formula1: '"daily,weekly,bi_weekly,monthly,quarterly,annual"' },
      { sqref: 'C2:C200', type: 'list', formula1: `"${memberEmailList}"` },
      { sqref: 'D2:D200', type: 'list', formula1: `"${memberEmailList}"` },
      { sqref: 'E2:E200', type: 'list', formula1: '"none,low,medium,high,urgent"' },
    ]
    XLSX.utils.book_append_sheet(wb, rWs, '🔁 Recurring Tasks')

    const buf: Buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="planora_import_template.xlsx"',
        'Cache-Control': 'no-store, no-cache',
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: 'Could not generate template: ' + e?.message }, { status: 500 })
  }
}
