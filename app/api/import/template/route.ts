import { NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'

export async function GET() {
  // Serve pre-built static file if it exists
  try {
    const filePath = path.join(process.cwd(), 'public', 'templates', 'planora_import_template.xlsx')
    if (fs.existsSync(filePath)) {
      const buf = fs.readFileSync(filePath)
      return new NextResponse(buf, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': 'attachment; filename="planora_import_template.xlsx"',
          'Cache-Control': 'no-store',
        },
      })
    }
  } catch {}

  try {
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()

    // Helper: sheet from rows + col widths
    function ws(data: any[][], cols: number[]) {
      const sheet = XLSX.utils.aoa_to_sheet(data)
      sheet['!cols'] = cols.map(w => ({ wch: w }))
      return sheet
    }

    // ── README ──────────────────────────────────────────────────────
    XLSX.utils.book_append_sheet(wb, ws([
      ['PLANORA BULK IMPORT TEMPLATE — v2'],
      [''],
      ['FILL IN THIS ORDER (names must match exactly across sheets):'],
      ['  Step 1 →  👥 Team Members   — emails used as assignee references'],
      ['  Step 2 →  🏢 Clients         — names used in Projects/Tasks'],
      ['  Step 3 →  📁 Projects        — names used in Tasks'],
      ['  Step 4 →  ✅ Tasks / 📥 One-Time Tasks / 🔁 Recurring Tasks'],
      [''],
      ['DROPDOWN COLUMNS (click cell to see options):'],
      ['  Role        →  owner | admin | manager | member | viewer'],
      ['  Priority    →  none  | low   | medium  | high   | urgent'],
      ['  Status      →  todo  | in_progress | completed | blocked'],
      ['  Frequency   →  daily | weekly | bi_weekly | monthly | quarterly | annual'],
      ['  Cl. Status  →  active | inactive | lead'],
      [''],
      ['ASSIGNEE EMAILS: comma-separate for multiple  →  alex@co.com,priya@co.com'],
      ['DATES: YYYY-MM-DD format  →  2025-08-31'],
      ['COLORS: hex code  →  #6366f1'],
      ['Columns marked * are REQUIRED — blank rows are skipped.'],
    ], [75]), '📖 README')

    // ── Team Members ────────────────────────────────────────────────
    const mWs = ws([
      ['Full Name *',    'Email *',                    'Role *',  'Notes'],
      ['Alex Johnson',   'alex@yourcompany.com',        'manager', ''],
      ['Priya Sharma',   'priya@yourcompany.com',       'member',  ''],
      ['Sam Gupta',      'sam@yourcompany.com',         'member',  ''],
      ['Riya Nair',      'riya@yourcompany.com',        'viewer',  ''],
    ], [25, 32, 12, 25])
    // Role dropdown C2:C200
    if (!mWs['!dataValidation']) (mWs as any)['!dataValidation'] = []
    ;(mWs as any)['!dataValidation'].push({ sqref: 'C2:C200', type: 'list', formula1: '"owner,admin,manager,member,viewer"' })
    XLSX.utils.book_append_sheet(wb, mWs, '👥 Team Members')

    // ── Clients ──────────────────────────────────────────────────────
    const cWs = ws([
      ['Client Name *',  'Contact Email',             'Phone',           'Company',        'Industry',    'Status',   'Color',    'Notes'],
      ['Acme Corp',      'hello@acme.com',             '+91 9876543210',  'Acme Corp Ltd',  'Technology',  'active',   '#6366f1',  ''],
      ['Garg Sons',      'accounts@gargsons.com',      '+91 9988776655',  'Garg Sons Ltd',  'Retail',      'active',   '#ea580c',  ''],
      ['Mehra & Co',     'info@mehraandco.com',        '',                'Mehra & Co CA',  'Finance',     'active',   '#0d9488',  ''],
    ], [22, 28, 17, 22, 14, 10, 10, 22])
    ;(cWs as any)['!dataValidation'] = [
      { sqref: 'F2:F200', type: 'list', formula1: '"active,inactive,lead"' }
    ]
    XLSX.utils.book_append_sheet(wb, cWs, '🏢 Clients')

    // ── Projects ─────────────────────────────────────────────────────
    const pWs = ws([
      ['Project Name *',    'Color',    'Status',   'Due Date',    'Owner Email',               'Client Name',  'Hours Budget',  'Description'],
      ['Website Redesign',  '#6366f1',  'active',   '2025-08-31',  'alex@yourcompany.com',      'Acme Corp',    '40',            ''],
      ['Q2 Tax Filing',     '#ea580c',  'active',   '2025-06-30',  'priya@yourcompany.com',     'Garg Sons',    '',              ''],
      ['Annual Audit FY25', '#0d9488',  'active',   '2025-09-30',  'priya@yourcompany.com',     'Mehra & Co',   '',              'Statutory audit'],
    ], [24, 10, 12, 14, 28, 18, 14, 28])
    ;(pWs as any)['!dataValidation'] = [
      { sqref: 'C2:C200', type: 'list', formula1: '"active,on_hold,completed,cancelled"' }
    ]
    XLSX.utils.book_append_sheet(wb, pWs, '📁 Projects')

    // ── Tasks (project-linked) ────────────────────────────────────────
    const tWs = ws([
      ['Task Title *',           'Project Name',       'Assignee Email(s)',                              'Priority',  'Due Date',    'Status',  'Client Name',  'Est. Hours',  'Description'],
      ['Design wireframes',      'Website Redesign',   'alex@yourcompany.com',                          'high',      '2025-07-15',  'todo',    'Acme Corp',    '8',           ''],
      ['Review balance sheet',   'Q2 Tax Filing',      'priya@yourcompany.com,alex@yourcompany.com',    'medium',    '2025-06-20',  'todo',    'Garg Sons',    '4',           'Multi-assignee: comma-separated'],
      ['Audit fieldwork',        'Annual Audit FY25',  'priya@yourcompany.com',                         'high',      '2025-08-15',  'todo',    'Mehra & Co',   '16',          ''],
    ], [26, 22, 40, 10, 14, 14, 16, 11, 28])
    ;(tWs as any)['!dataValidation'] = [
      { sqref: 'D2:D200', type: 'list', formula1: '"none,low,medium,high,urgent"' },
      { sqref: 'F2:F200', type: 'list', formula1: '"todo,in_progress,completed,blocked"' },
    ]
    XLSX.utils.book_append_sheet(wb, tWs, '✅ Tasks')

    // ── One-Time Tasks ───────────────────────────────────────────────
    const otWs = ws([
      ['Task Title *',              'Assignee Email(s)',                           'Priority',  'Due Date',    'Client Name',  'Est. Hours',  'Description'],
      ['Review Q3 proposals',       'alex@yourcompany.com',                       'high',      '2025-07-10',  'Acme Corp',    '2',           ''],
      ['Team budget meeting',       'alex@yourcompany.com,priya@yourcompany.com', 'medium',    '2025-07-15',  'Garg Sons',    '1',           'Multi-assignee'],
      ['Client onboarding call',    'sam@yourcompany.com',                        'medium',    '2025-07-08',  'Mehra & Co',   '1',           ''],
    ], [26, 40, 10, 14, 16, 11, 28])
    ;(otWs as any)['!dataValidation'] = [
      { sqref: 'C2:C200', type: 'list', formula1: '"none,low,medium,high,urgent"' },
    ]
    XLSX.utils.book_append_sheet(wb, otWs, '📥 One-Time Tasks')

    // ── Recurring Tasks ──────────────────────────────────────────────
    const rWs = ws([
      ['Task Title *',         'Frequency *',  'Assignee Email(s)',            'Priority',  'Project Name',    'Start Date',  'Description'],
      ['Weekly team standup',  'weekly',        'alex@yourcompany.com',        'medium',    '',                '2025-07-07',  ''],
      ['Monthly GST filing',   'monthly',       'priya@yourcompany.com',       'high',      'Q2 Tax Filing',   '2025-07-01',  ''],
      ['Quarterly review',     'quarterly',     'alex@yourcompany.com',        'medium',    '',                '2025-07-01',  ''],
    ], [26, 12, 32, 10, 22, 14, 28])
    ;(rWs as any)['!dataValidation'] = [
      { sqref: 'B2:B200', type: 'list', formula1: '"daily,weekly,bi_weekly,monthly,quarterly,annual"' },
      { sqref: 'D2:D200', type: 'list', formula1: '"none,low,medium,high,urgent"' },
    ]
    XLSX.utils.book_append_sheet(wb, rWs, '🔁 Recurring Tasks')

    const buf: Buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="planora_import_template.xlsx"',
        'Cache-Control': 'no-store',
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: 'Could not generate template: ' + e?.message }, { status: 500 })
  }
}
