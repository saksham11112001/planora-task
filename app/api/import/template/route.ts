import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const DATA_START = 3    // row 1 = header, row 2 = hints, row 3+ = data
const DATA_END   = 202  // supports up to 200 data rows per sheet

// ── Static dropdown strings ──────────────────────────────────────────────────
const L_PRIORITY  = '"none,low,medium,high,urgent"'
const L_FREQUENCY = '"daily,weekly,bi_weekly,monthly,quarterly,annual"'
const L_TASK_ST   = '"todo,in_progress,completed,blocked"'
const L_PROJ_ST   = '"active,on_hold,completed"'
const L_CLIENT_ST = '"active,inactive,lead"'
const L_ROLE      = '"manager,member,viewer"'

// ── Dynamic ranges (reference live data entered by user) ─────────────────────
// Assignee  → every email in Team Members col B
// Approver  → manager/admin only (filtered via hidden _helpers sheet)
// Client    → every client name in Clients col A
const R_ASSIGNEE = "'👥 Team Members'!$B$3:$B$202"
const R_CLIENT   = "'🏢 Clients'!$A$3:$A$202"
const R_APPROVER = '_helpers!$A$2:$A$101'

export async function GET() {
  try {
    // Handle both default and named exports across ExcelJS versions
    const exceljs = await import('exceljs')
    const ExcelJS  = (exceljs as any).default ?? exceljs
    const wb       = new ExcelJS.Workbook()
    wb.creator     = 'Planora'
    wb.created     = new Date()

    // ── Palette ────────────────────────────────────────────────────────────
    const C = {
      headerBg : 'FF1E293B',
      hintBg   : 'FF0F172A',
      white    : 'FFFFFFFF',
      muted    : 'FF64748B',
      teal     : 'FF0D9488',
      slate    : 'FFCBD5E1',
      border   : 'FF334155',
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    /** Apply column widths and freeze the top 2 header/hint rows */
    function setup(ws: any, widths: number[]) {
      widths.forEach((w, i) => { ws.getColumn(i + 1).width = w })
      ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 2, activeCell: 'A3' }]
    }

    /** Style the header row (row 1) */
    function styleHeader(ws: any, cols: number) {
      const row = ws.getRow(1)
      row.height = 22
      for (let c = 1; c <= cols; c++) {
        Object.assign(row.getCell(c), {
          fill   : { type: 'pattern', pattern: 'solid', fgColor: { argb: C.headerBg } },
          font   : { bold: true, name: 'Arial', size: 11, color: { argb: C.white } },
          border : { bottom: { style: 'thin', color: { argb: C.border } } },
        })
      }
    }

    /** Style the hints row (row 2) */
    function styleHints(ws: any, cols: number) {
      const row = ws.getRow(2)
      row.height = 18
      for (let c = 1; c <= cols; c++) {
        Object.assign(row.getCell(c), {
          fill : { type: 'pattern', pattern: 'solid', fgColor: { argb: C.hintBg } },
          font : { italic: true, name: 'Arial', size: 10, color: { argb: C.muted } },
        })
      }
    }

    /**
     * Add a dropdown validation to an entire column (DATA_START → DATA_END).
     * formulae[0] is either a quoted CSV string  →  '"a,b,c"'
     *                     or a sheet range ref   →  "Sheet!$A$1:$A$10"
     */
    function dv(ws: any, col: string, formulae: string[]) {
      const validation = {
        type             : 'list',
        allowBlank       : true,
        formulae,
        showErrorMessage : true,
        errorStyle       : 'warning',
        errorTitle       : 'Invalid value',
        error            : 'Please choose a value from the dropdown list.',
      }
      for (let r = DATA_START; r <= DATA_END; r++) {
        ws.getCell(`${col}${r}`).dataValidation = validation
      }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Sheet 1 — READ ME
    // ══════════════════════════════════════════════════════════════════════════
    const wsRM = wb.addWorksheet('📖 READ ME')
wsRM.getColumn(1).width = 82
wsRM.views = [
  {
    showGridLines: false,
  },
]

    const instructions: [string, any][] = [
      ['Planora Bulk Import Template',
        { bold: true, size: 15, color: { argb: C.teal }, name: 'Arial' }],
      ['', {}],
      ['📋 How to use this template',
        { bold: true, size: 12, color: { argb: C.white }, name: 'Arial' }],
      ['1.  Fill "👥 Team Members" and "🏢 Clients" FIRST — all other sheets pull live dropdowns from them.',
        { size: 11, color: { argb: C.slate }, name: 'Arial' }],
      ['2.  Click any orange-highlighted cell and use the ▼ dropdown arrow to pick a value.',
        { size: 11, color: { argb: C.slate }, name: 'Arial' }],
      ['3.  Assignee Email → shows every email entered in Team Members.',
        { size: 11, color: { argb: C.slate }, name: 'Arial' }],
      ['4.  Approver Email → shows only manager / admin emails from Team Members.',
        { size: 11, color: { argb: C.slate }, name: 'Arial' }],
      ['    (Blank slots may appear at the bottom of the Approver list — just skip them.)',
        { size: 10, color: { argb: C.muted }, name: 'Arial' }],
      ['5.  Client Name     → shows every client entered in the Clients sheet.',
        { size: 11, color: { argb: C.slate }, name: 'Arial' }],
      ['6.  Priority & Frequency use fixed dropdowns — always select from the list.',
        { size: 11, color: { argb: C.slate }, name: 'Arial' }],
      ['7.  Delete all [SAMPLE] rows before uploading.',
        { size: 11, color: { argb: C.slate }, name: 'Arial' }],
    ]
    instructions.forEach(([text, font], i) => {
      wsRM.getRow(i + 1).getCell(1).value = text
      wsRM.getRow(i + 1).getCell(1).font  = font
    })

    // ══════════════════════════════════════════════════════════════════════════
    // Sheet 2 — Team Members
    // ══════════════════════════════════════════════════════════════════════════
    const wsTeam = wb.addWorksheet('👥 Team Members')
    setup(wsTeam, [28, 32, 16, 30])
    wsTeam.addRow(['Full Name *', 'Email *', 'Role *', 'Notes'])
    wsTeam.addRow(["Person's display name", 'Work email', 'manager | member | viewer', 'Optional'])
    wsTeam.addRow(['[SAMPLE] Alex Johnson',  'alex@yourcompany.com',    'manager', ''])
    wsTeam.addRow(['[SAMPLE] Sarah Lee',     'sarah@yourcompany.com',   'member',  ''])
    styleHeader(wsTeam, 4)
    styleHints(wsTeam,  4)
    dv(wsTeam, 'C', [L_ROLE])

    // ══════════════════════════════════════════════════════════════════════════
    // Sheet 3 — Clients
    // ══════════════════════════════════════════════════════════════════════════
    const wsClients = wb.addWorksheet('🏢 Clients')
    setup(wsClients, [24, 28, 18, 22, 26, 18, 10, 16, 28])
    wsClients.addRow(['Client Name *', 'Contact Email', 'Phone', 'Company', 'Website', 'Industry', 'Color', 'Status', 'Notes'])
    wsClients.addRow(['Unique name', 'contact@client.com', '+91 9876543210', 'Company Ltd', 'https://company.com', 'Technology', '#6366f1', 'active | inactive | lead', 'Optional'])
    wsClients.addRow(['[SAMPLE] Acme Corp', 'hello@acme.com', '', 'Acme Corp Ltd', '', 'Technology', '#6366f1', 'active', ''])
    styleHeader(wsClients, 9)
    styleHints(wsClients,  9)
    dv(wsClients, 'H', [L_CLIENT_ST])

    // ══════════════════════════════════════════════════════════════════════════
    // _helpers (HIDDEN) — manager-only email list via IF formulas
    //   Column A rows 2-101  →  email if role = manager OR admin, else ""
    //   This is referenced by Approver dropdowns across all task sheets.
    // ══════════════════════════════════════════════════════════════════════════
    const wsHelp = wb.addWorksheet('_helpers')
    wsHelp.state = 'hidden'
    wsHelp.getRow(1).getCell(1).value = 'Manager / Admin emails (auto-filtered from Team Members — do not edit)'

    for (let i = 0; i < 100; i++) {
      const tmRow  = i + 3  // Team Members data starts at row 3
      const hlpRow = i + 2  // _helpers data starts at row 2
      wsHelp.getRow(hlpRow).getCell(1).value = {
        formula : `IF(OR('👥 Team Members'!C${tmRow}="manager",'👥 Team Members'!C${tmRow}="admin"),'👥 Team Members'!B${tmRow},"")`,
        result  : '',
      }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Sheet 4 — Projects
    // ══════════════════════════════════════════════════════════════════════════
    const wsProj = wb.addWorksheet('📁 Projects')
    setup(wsProj, [26, 10, 18, 14, 30, 24, 12, 14, 30])
    wsProj.addRow(['Project Name *', 'Color', 'Status', 'Due Date', 'Owner Email', 'Client Name', 'Budget', 'Hours Budget', 'Description'])
    wsProj.addRow(['Unique name', '#hex', 'active | on_hold | completed', 'YYYY-MM-DD', 'select from dropdown ▼', 'select from dropdown ▼', 'Optional', 'Optional', 'Optional'])
    wsProj.addRow(['[SAMPLE] Website Redesign', '#6366f1', 'active', '2025-08-31', 'alex@yourcompany.com', 'Acme Corp', '', '', ''])
    styleHeader(wsProj, 9)
    styleHints(wsProj,  9)
    dv(wsProj, 'C', [L_PROJ_ST])
    dv(wsProj, 'E', [R_ASSIGNEE])  // Owner Email  → all team members
    dv(wsProj, 'F', [R_CLIENT])    // Client Name  → all clients

    // ══════════════════════════════════════════════════════════════════════════
    // Sheet 5 — Tasks
    // ══════════════════════════════════════════════════════════════════════════
    const wsTasks = wb.addWorksheet('✅ Tasks')
    setup(wsTasks, [28, 24, 28, 28, 14, 14, 18, 20, 12, 30])
    wsTasks.addRow(['Task Title *', 'Project Name', 'Assignee Email', 'Approver Email', 'Priority', 'Due Date', 'Status', 'Client Name', 'Est. Hours', 'Description'])
    wsTasks.addRow(['Clear title', 'Must match projects', 'select ▼', 'select ▼ (managers)', 'select ▼', 'YYYY-MM-DD', 'select ▼', 'select ▼', 'Number', 'Optional'])
    wsTasks.addRow(['[SAMPLE] Design wireframes', '[SAMPLE] Website Redesign', 'alex@yourcompany.com', 'alex@yourcompany.com', 'high', '2025-07-15', 'todo', 'Acme Corp', '8', ''])
    styleHeader(wsTasks, 10)
    styleHints(wsTasks,  10)
    dv(wsTasks, 'C', [R_ASSIGNEE])   // Assignee   → all members
    dv(wsTasks, 'D', [R_APPROVER])   // Approver   → managers/admins only
    dv(wsTasks, 'E', [L_PRIORITY])
    dv(wsTasks, 'G', [L_TASK_ST])
    dv(wsTasks, 'H', [R_CLIENT])

    // ══════════════════════════════════════════════════════════════════════════
    // Sheet 6 — One-Time Tasks
    // ══════════════════════════════════════════════════════════════════════════
    const wsInbox = wb.addWorksheet('📥 One-Time Tasks')
    setup(wsInbox, [28, 28, 28, 14, 14, 20, 12, 30])
    wsInbox.addRow(['Task Title *', 'Assignee Email', 'Approver Email', 'Priority', 'Due Date', 'Client Name', 'Est. Hours', 'Description'])
    wsInbox.addRow(['Clear title', 'select ▼', 'select ▼ (managers)', 'select ▼', 'YYYY-MM-DD', 'select ▼', 'Number', 'Optional'])
    wsInbox.addRow(['[SAMPLE] Review Q3 proposals', 'alex@yourcompany.com', 'alex@yourcompany.com', 'high', '2025-07-10', 'Acme Corp', '2', ''])
    styleHeader(wsInbox, 8)
    styleHints(wsInbox,  8)
    dv(wsInbox, 'B', [R_ASSIGNEE])
    dv(wsInbox, 'C', [R_APPROVER])
    dv(wsInbox, 'D', [L_PRIORITY])
    dv(wsInbox, 'F', [R_CLIENT])

    // ══════════════════════════════════════════════════════════════════════════
    // Sheet 7 — Recurring Tasks
    // ══════════════════════════════════════════════════════════════════════════
    const wsRec = wb.addWorksheet('🔁 Recurring Tasks')
    setup(wsRec, [28, 16, 28, 28, 14, 24, 20, 14, 30])
    wsRec.addRow(['Task Title *', 'Frequency *', 'Assignee Email', 'Approver Email', 'Priority', 'Project Name', 'Client Name', 'Start Date', 'Description'])
    wsRec.addRow(['Clear title', 'select ▼', 'select ▼', 'select ▼ (managers)', 'select ▼', 'Must match projects', 'select ▼', 'YYYY-MM-DD', 'Optional'])
    wsRec.addRow(['[SAMPLE] Weekly standup', 'weekly', 'alex@yourcompany.com', 'alex@yourcompany.com', 'medium', '', '', '2025-07-07', ''])
    styleHeader(wsRec, 9)
    styleHints(wsRec,  9)
    dv(wsRec, 'B', [L_FREQUENCY])
    dv(wsRec, 'C', [R_ASSIGNEE])
    dv(wsRec, 'D', [R_APPROVER])
    dv(wsRec, 'E', [L_PRIORITY])
    dv(wsRec, 'G', [R_CLIENT])

    // ══════════════════════════════════════════════════════════════════════════
    // Sheet 8 — CA Compliance Tasks
    // ══════════════════════════════════════════════════════════════════════════
    const wsCA = wb.addWorksheet('🧾 CA Compliance Tasks')
    setup(wsCA, [32, 24, 28, 28])
    wsCA.addRow(['Task Code *', 'Client Name', 'Assignee Email', 'Approver Email'])
    wsCA.addRow(['Task codes come from Compliance Master', 'select ▼', 'select ▼', 'select ▼ (managers)'])
    wsCA.addRow(['[SAMPLE] GSTR 1 (Monthly)', 'Acme Corp', 'alex@yourcompany.com', 'alex@yourcompany.com'])
    styleHeader(wsCA, 4)
    styleHints(wsCA,  4)
    dv(wsCA, 'B', [R_CLIENT])
    dv(wsCA, 'C', [R_ASSIGNEE])
    dv(wsCA, 'D', [R_APPROVER])

    // ── Write buffer ───────────────────────────────────────────────────────
    const buf = await wb.xlsx.writeBuffer()

    return new NextResponse(buf as Buffer, {
      headers: {
        'Content-Type'        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition' : 'attachment; filename="planora_import_template.xlsx"',
        'Cache-Control'       : 'no-store',
      },
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: 'Could not generate template: ' + e?.message },
      { status: 500 }
    )
  }
}