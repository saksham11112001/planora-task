import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import ExcelJS from 'exceljs'

export const dynamic = 'force-dynamic'

// ── Styles ────────────────────────────────────────────────────────────────────
const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }
const TEAL_FILL:   ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDFA' } }
const GREY_FILL:   ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }
const RED_FILL:    ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF2F2' } }
const README_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDFA' } }

const hFont  = (bold = false, size = 10, color = 'FFFFFFFF') =>
  ({ name: 'Arial', bold, size, color: { argb: color } } as ExcelJS.Font)
const center: Partial<ExcelJS.Alignment> = { vertical: 'middle', horizontal: 'left' }

// ── Helpers ───────────────────────────────────────────────────────────────────
function addSheet(
  wb: ExcelJS.Workbook,
  name: string,
  headers: string[],
  widths: number[],
  rows: (string | number)[][],
  dropdowns: { col: number; values: string[] }[],   // col is 1-based
) {
  const ws = wb.addWorksheet(name)
  ws.views = [{ showGridLines: false }]

  // Header row
  const headerRow = ws.addRow(headers)
  headerRow.height = 22
  headerRow.eachCell(cell => {
    cell.fill   = HEADER_FILL
    cell.font   = hFont(true, 11)
    cell.alignment = center
  })

  // Data rows
  rows.forEach((rowData, i) => {
    const row = ws.addRow(rowData)
    row.height = 18
    row.eachCell({ includeEmpty: true }, cell => {
      cell.fill      = i % 2 === 0 ? TEAL_FILL : GREY_FILL
      cell.font      = hFont(false, 10, 'FF0F172A')
      cell.alignment = center
    })
  })

  // Column widths
  headers.forEach((_, i) => {
    ws.getColumn(i + 1).width = widths[i] ?? 20
  })

  // Data validations (dropdown lists)
  dropdowns.forEach(({ col, values }) => {
    const colLetter = ws.getColumn(col).letter
    ws.dataValidations.add(`${colLetter}2:${colLetter}1000`, {
      type:             'list',
      allowBlank:       true,
      formulae:         [`"${values.join(',')}"`],
      showErrorMessage: true,
      showInputMessage: true,
      promptTitle:      'Options',
      prompt:           'Select from the list',
    })
  })

  return ws
}

// ── Route ─────────────────────────────────────────────────────────────────────
export async function GET() {
  // Default payload (fallback if not authenticated)
  let payload = {
    memberEmails: ['alex@yourcompany.com', 'priya@yourcompany.com', 'sam@yourcompany.com'],
    memberNames:  ['Alex Johnson', 'Priya Sharma', 'Sam Gupta'],
    memberRoles:  ['manager', 'member', 'member'],
    clientNames:  ['Acme Corp', 'Garg Sons', 'Mehra & Co'],
    clientRows:   [
      ['Acme Corp',  'hello@acme.com',        '+91 9876543210', 'Acme Corp Ltd',  'Technology', 'active', '#6366f1'],
      ['Garg Sons',  'accounts@gargsons.com', '+91 9988776655', 'Garg Sons Ltd',  'Retail',     'active', '#ea580c'],
      ['Mehra & Co', 'info@mehraandco.com',   '',               'Mehra & Co CA',  'Finance',    'active', '#0d9488'],
    ] as string[][],
    caMode: false,
  }

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
        const [{ data: members }, { data: clients }, { data: settings }] = await Promise.all([
          supabase.from('org_members')
            .select('role, users(name, email)')
            .eq('org_id', mb.org_id)
            .eq('is_active', true),
          supabase.from('clients')
            .select('name, email, phone_number, company, industry, status, color')
            .eq('org_id', mb.org_id)
            .eq('status', 'active')
            .order('name'),
          supabase.from('org_settings')
            .select('ca_compliance_mode')
            .eq('org_id', mb.org_id)
            .maybeSingle(),
        ])

        if (members?.length) {
          const valid = members.filter((m: any) => m.users?.email)
          payload.memberEmails = valid.map((m: any) => m.users.email)
          payload.memberNames  = valid.map((m: any) => m.users.name ?? m.users.email.split('@')[0])
          payload.memberRoles  = valid.map((m: any) => m.role ?? 'member')
        }
        if (clients?.length) {
          payload.clientNames = clients.map((c: any) => c.name)
          payload.clientRows  = clients.map((c: any) => [
            c.name ?? '', c.email ?? '', c.phone_number ?? '',
            c.company ?? '', c.industry ?? '', c.status ?? 'active', c.color ?? '#0d9488',
          ])
        }
        payload.caMode = (settings as any)?.ca_compliance_mode === true
      }
    }
  } catch { /* unauthenticated — use defaults */ }

  // ── Build workbook ──────────────────────────────────────────────────────────
  const { memberEmails, memberNames, memberRoles, clientNames, clientRows, caMode } = payload

  const ROLES   = ['owner', 'admin', 'manager', 'member', 'viewer']
  const PRIOS   = ['none', 'low', 'medium', 'high', 'urgent']
  const STATS   = ['todo', 'in_progress', 'completed', 'blocked']
  const FREQS   = ['daily', 'weekly', 'bi_weekly', 'monthly', 'quarterly', 'annual']
  const CSTATS  = ['active', 'inactive', 'lead']
  const PSTATS  = ['active', 'on_hold', 'completed', 'cancelled']

  const wb = new ExcelJS.Workbook()
  wb.creator  = 'Planora'
  wb.lastModifiedBy = 'Planora'
  wb.created  = new Date()
  wb.modified = new Date()

  // ── README sheet ────────────────────────────────────────────────────────────
  const readme = wb.addWorksheet('📖 README')
  readme.views = [{ showGridLines: false }]
  readme.getColumn(1).width = 82

  const readmeRows: { text: string; bold?: boolean; size?: number; color?: string; fill?: ExcelJS.Fill }[] = [
    { text: 'PLANORA IMPORT TEMPLATE — personalised for your workspace', bold: true, size: 14, color: 'FF0D9488', fill: README_FILL },
    { text: '' },
    { text: 'FILL IN ORDER:', bold: true, size: 11 },
    { text: '  Step 1 →  👥 Team Members  — team emails become Assignee & Approver dropdowns' },
    { text: '  Step 2 →  🏢 Clients       — client names become Client Name dropdowns' },
    { text: '  Step 3 →  📁 Projects      — reference client names from Step 2' },
    { text: '  Step 4 →  Tasks / One-Time Tasks / Recurring Tasks' },
    { text: '' },
    { text: 'DROPDOWN COLUMNS — click any cell to select from list:', bold: true, size: 11 },
    { text: `  Assignee Email  →  ${memberEmails.length} member(s) from your workspace`, color: 'FF0D9488' },
    { text: `  Approver Email  →  ${memberEmails.length} member(s) from your workspace`, color: 'FF0D9488' },
    { text: `  Client Name     →  ${clientNames.length} client(s) from your workspace`, color: 'FF0D9488' },
    { text: '  Role            →  owner | admin | manager | member | viewer' },
    { text: '  Priority        →  none | low | medium | high | urgent' },
    { text: '  Status          →  todo | in_progress | completed | blocked' },
    { text: '  Frequency       →  daily | weekly | bi_weekly | monthly | quarterly | annual' },
    { text: '' },
    { text: 'MULTI-ASSIGNEE: comma-separate emails  e.g.  alex@co.com,priya@co.com', color: 'FF64748B' },
    { text: 'DATES: YYYY-MM-DD format  e.g.  2025-08-31', color: 'FF64748B' },
    { text: 'Columns marked * are required. Blank rows are skipped on import.', bold: true, color: 'FFDC2626', fill: RED_FILL },
  ]

  readmeRows.forEach(({ text, bold, size, color, fill }, i) => {
    const row  = readme.getRow(i + 1)
    const cell = row.getCell(1)
    cell.value = text
    cell.font  = { name: 'Arial', bold: bold ?? false, size: size ?? 10, color: { argb: color ?? 'FF0F172A' } }
    if (fill) cell.fill = fill
    cell.alignment = { vertical: 'middle' }
    row.height = 20
  })

  // ── Sample data shortcuts ────────────────────────────────────────────────────
  const e0 = memberEmails[0] ?? ''
  const e1 = memberEmails[1] ?? e0
  const c0 = clientNames[0]  ?? ''
  const c1 = clientNames[1]  ?? c0

  // ── 👥 Team Members ──────────────────────────────────────────────────────────
  addSheet(wb, '👥 Team Members',
    ['Full Name *', 'Email *', 'Role *', 'Notes'],
    [25, 32, 14, 25],
    memberNames.map((name, i) => [name, memberEmails[i], memberRoles[i] ?? 'member', '']),
    [{ col: 3, values: ROLES }],
  )

  // ── 🏢 Clients ───────────────────────────────────────────────────────────────
  addSheet(wb, '🏢 Clients',
    ['Client Name *', 'Contact Email', 'Phone', 'Company', 'Industry', 'Status', 'Color', 'Notes'],
    [24, 28, 17, 24, 14, 12, 10, 22],
    clientRows.map(r => [...r.slice(0, 7), '']),
    [{ col: 6, values: CSTATS }],
  )

  // ── 📁 Projects ──────────────────────────────────────────────────────────────
  addSheet(wb, '📁 Projects',
    ['Project Name *', 'Color', 'Status', 'Due Date', 'Owner Email', 'Client Name', 'Hours Budget', 'Description'],
    [24, 10, 14, 14, 32, 22, 13, 28],
    [
      ['Project Alpha', '#6366f1', 'active', '2025-08-31', e0, c0, '40', ''],
      ['Project Beta',  '#ea580c', 'active', '2025-09-30', e1, c1, '',   ''],
    ],
    [
      { col: 3, values: PSTATS },
      { col: 5, values: memberEmails },
      { col: 6, values: clientNames },
    ],
  )

  // ── ✅ Tasks ──────────────────────────────────────────────────────────────────
  addSheet(wb, '✅ Tasks',
    ['Task Title *', 'Project Name', 'Assignee Email(s)', 'Approver Email', 'Priority', 'Due Date', 'Status', 'Client Name', 'Est. Hours', 'Description'],
    [28, 20, 32, 32, 10, 14, 14, 20, 10, 28],
    [
      ['Design wireframes', 'Project Alpha', e0, e0, 'high',   '2025-07-15', 'todo', c0, '4', ''],
      ['Review documents',  'Project Beta',  e1, e1, 'medium', '2025-07-20', 'todo', c1, '2', ''],
    ],
    [
      { col: 3, values: memberEmails },
      { col: 4, values: memberEmails },
      { col: 5, values: PRIOS },
      { col: 7, values: STATS },
      { col: 8, values: clientNames },
    ],
  )

  // ── 📥 One-Time Tasks ────────────────────────────────────────────────────────
  addSheet(wb, '📥 One-Time Tasks',
    ['Task Title *', 'Assignee Email(s)', 'Approver Email', 'Priority', 'Due Date', 'Client Name', 'Est. Hours', 'Description'],
    [28, 32, 32, 10, 14, 20, 10, 28],
    [
      ['Task - replace me', e0, e0, 'high',   '2025-07-10', c0, '2', ''],
      ['Task - replace me', e1, '',  'medium', '2025-07-15', c1, '1', ''],
    ],
    [
      { col: 2, values: memberEmails },
      { col: 3, values: memberEmails },
      { col: 4, values: PRIOS },
      { col: 6, values: clientNames },
    ],
  )

  // ── 🔁 Recurring Tasks ───────────────────────────────────────────────────────
  addSheet(wb, '🔁 Recurring Tasks',
    ['Task Title *', 'Frequency *', 'Assignee Email(s)', 'Approver Email', 'Priority', 'Project Name', 'Start Date', 'Description'],
    [28, 13, 32, 32, 10, 22, 14, 28],
    [
      ['Weekly standup', 'weekly',  e0, '',  'medium', 'Project Alpha', '2025-07-07', ''],
      ['Monthly review', 'monthly', e1, e0, 'high',   'Project Beta',  '2025-07-01', ''],
    ],
    [
      { col: 2, values: FREQS },
      { col: 3, values: memberEmails },
      { col: 4, values: memberEmails },
      { col: 5, values: PRIOS },
    ],
  )

  // ── 🏛 CA Compliance (conditional) ──────────────────────────────────────────
  if (caMode) {
    addSheet(wb, '🏛 CA Compliance',
      ['Compliance Task Type *', 'Client Name', 'Assignee Email', 'Approver Email', 'Due Date', 'Priority', 'Frequency'],
      [30, 22, 32, 32, 14, 10, 14],
      [
        ['GSTR 3B (Monthly)', c0, e0, e0, '2025-07-20', 'high',   'monthly'],
        ['TDS 26Q Return',    c1, e1, e0, '2025-07-15', 'high',   'quarterly'],
        ['ITR Filing',        c0, e0, '',  '2025-07-31', 'urgent', ''],
      ],
      [
        { col: 2, values: clientNames },
        { col: 3, values: memberEmails },
        { col: 4, values: memberEmails },
        { col: 6, values: PRIOS },
        { col: 7, values: FREQS },
      ],
    )
  }

  // ── Serialize & respond ──────────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer()

  return new NextResponse(buffer, {
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="planora_import_template.xlsx"',
      'Cache-Control':       'no-store, no-cache',
    },
  })
}