import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function setHeader(row: ExcelJS.Row) {
  row.font = { bold: true }
}

function addListValidation(
  ws: ExcelJS.Worksheet,
  range: string,
  formula: string,
  promptTitle: string,
  prompt: string
) {
  const [start, end] = range.split(':')
  const startRow = Number(start.match(/\d+/)?.[0] || 2)
  const endRow = Number(end.match(/\d+/)?.[0] || startRow)
  const col = start.replace(/\d+/g, '')

  for (let r = startRow; r <= endRow; r++) {
    ws.getCell(`${col}${r}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [formula],
      showErrorMessage: true,
      errorStyle: 'error',
      errorTitle: 'Invalid value',
      error: 'Please select a value from the dropdown.',
      showInputMessage: true,
      promptTitle,
      prompt,
    }
  }
}

function addDateFormatting(ws: ExcelJS.Worksheet, colLetter: string, fromRow = 3, toRow = 500) {
  for (let r = fromRow; r <= toRow; r++) {
    ws.getCell(`${colLetter}${r}`).numFmt = 'yyyy-mm-dd'
  }
}

export async function GET() {
  try {
    const wb = new ExcelJS.Workbook()
    wb.creator = 'Planora'
    wb.created = new Date()

    const readme = wb.addWorksheet('📖 READ ME')
    const team = wb.addWorksheet('👥 Team Members')
    const clients = wb.addWorksheet('🏢 Clients')
    const projects = wb.addWorksheet('📁 Projects')
    const tasks = wb.addWorksheet('✅ Tasks')
    const oneTime = wb.addWorksheet('📥 One-Time Tasks')
    const recurring = wb.addWorksheet('🔁 Recurring Tasks')
    const compliance = wb.addWorksheet('🧾 CA Compliance Tasks')
    const lists = wb.addWorksheet('Lists')

    // Hide helper sheet
    lists.state = 'veryHidden'

    // README
    readme.addRows([
      ['Planora Smart Bulk Import Template'],
      ['Fill the sheets and upload them in Bulk Import.'],
      ['Dropdowns are linked across sheets.'],
      ['Assignee comes from Team Members.'],
      ['Approver comes from Team Members with role admin/manager/owner.'],
      ['Client comes from Clients sheet.'],
      ['Dates are displayed as YYYY-MM-DD, but importer accepts common date formats.'],
    ])
    readme.columns = [{ width: 90 }]

    // TEAM MEMBERS
    team.addRow(['Full Name *', 'Email *', 'Role *', 'Notes'])
    team.addRow(["Person's display name", 'Work email', 'manager | member | viewer | admin | owner', 'Optional'])
    team.addRow(['Alex Johnson', 'alex@yourcompany.com', 'manager', ''])
    team.addRow(['Priya Sharma', 'priya@yourcompany.com', 'member', ''])
    setHeader(team.getRow(1))
    team.columns = [
      { width: 24 },
      { width: 30 },
      { width: 20 },
      { width: 26 },
    ]

    // Team role dropdown
    addListValidation(
      team,
      'C3:C500',
      '"owner,admin,manager,member,viewer"',
      'Role',
      'Choose a role'
    )

    // CLIENTS
    clients.addRow(['Client Name *', 'Contact Email', 'Phone', 'Company', 'Website', 'Industry', 'Color', 'Status', 'Notes'])
    clients.addRow(['Unique name', 'contact@client.com', '+91 9876543210', 'Company Ltd', 'https://company.com', 'Technology', '#6366f1', 'active', 'Optional'])
    clients.addRow(['Acme Corp', 'hello@acme.com', '', 'Acme Corp Ltd', '', 'Technology', '#6366f1', 'active', ''])
    setHeader(clients.getRow(1))
    clients.columns = [
      { width: 24 }, { width: 28 }, { width: 18 }, { width: 24 },
      { width: 28 }, { width: 18 }, { width: 14 }, { width: 16 }, { width: 24 },
    ]

    addListValidation(
      clients,
      'H3:H500',
      '"active,inactive,lead"',
      'Client status',
      'Choose client status'
    )

    // PROJECTS
    projects.addRow(['Project Name *', 'Color', 'Status', 'Due Date', 'Owner Email', 'Client Name', 'Budget', 'Hours Budget', 'Description'])
    projects.addRow(['Unique name', '#hex', 'active', 'YYYY-MM-DD', 'owner@yourcompany.com', 'Must match Clients', 'Optional', 'Optional', 'Optional'])
    projects.addRow(['Website Redesign', '#6366f1', 'active', '2025-08-31', 'alex@yourcompany.com', 'Acme Corp', '', '', ''])
    setHeader(projects.getRow(1))
    projects.columns = [
      { width: 24 }, { width: 14 }, { width: 18 }, { width: 16 }, { width: 28 },
      { width: 22 }, { width: 14 }, { width: 14 }, { width: 30 },
    ]

    addListValidation(
      projects,
      'C3:C500',
      '"active,on_hold,completed"',
      'Project status',
      'Choose project status'
    )

    addDateFormatting(projects, 'D')

    // TASKS
    tasks.addRow(['Task Title *', 'Project Name', 'Assignee Email', 'Approver Email', 'Priority', 'Due Date', 'Status', 'Client Name', 'Est. Hours', 'Description'])
    tasks.addRow(['Clear title', 'Must match projects', 'Select from team', 'Admin/Manager only', 'Select priority', 'YYYY-MM-DD', 'Select status', 'Select client', 'Number', 'Optional'])
    tasks.addRow(['Design wireframes', 'Website Redesign', 'alex@yourcompany.com', 'alex@yourcompany.com', 'high', '2025-07-15', 'todo', 'Acme Corp', '8', ''])
    setHeader(tasks.getRow(1))
    tasks.columns = [
      { width: 28 }, { width: 24 }, { width: 28 }, { width: 28 }, { width: 16 },
      { width: 16 }, { width: 18 }, { width: 22 }, { width: 12 }, { width: 28 },
    ]

    // ONE-TIME TASKS
    oneTime.addRow(['Task Title *', 'Assignee Email', 'Approver Email', 'Priority', 'Due Date', 'Client Name', 'Est. Hours', 'Description'])
    oneTime.addRow(['Clear title', 'Select from team', 'Admin/Manager only', 'Select priority', 'YYYY-MM-DD', 'Select client', 'Number', 'Optional'])
    oneTime.addRow(['Review Q3 proposals', 'alex@yourcompany.com', 'alex@yourcompany.com', 'high', '2025-07-10', 'Acme Corp', '2', ''])
    setHeader(oneTime.getRow(1))
    oneTime.columns = [
      { width: 28 }, { width: 28 }, { width: 28 }, { width: 16 },
      { width: 16 }, { width: 22 }, { width: 12 }, { width: 28 },
    ]

    // RECURRING TASKS
    recurring.addRow(['Task Title *', 'Frequency *', 'Assignee Email', 'Approver Email', 'Priority', 'Project Name', 'Client Name', 'Start Date', 'Description'])
    recurring.addRow(['Clear title', 'Choose frequency', 'Select from team', 'Admin/Manager only', 'Select priority', 'Must match projects', 'Select client', 'YYYY-MM-DD', 'Optional'])
    recurring.addRow(['Weekly standup', 'weekly', 'alex@yourcompany.com', 'alex@yourcompany.com', 'medium', 'Website Redesign', 'Acme Corp', '2025-07-07', ''])
    setHeader(recurring.getRow(1))
    recurring.columns = [
      { width: 28 }, { width: 18 }, { width: 28 }, { width: 28 }, { width: 16 },
      { width: 24 }, { width: 22 }, { width: 16 }, { width: 28 },
    ]

    // COMPLIANCE
    compliance.addRow(['Compliance Task Type *', 'Client Name', 'Assignee Email', 'Approver Email', 'Due Date', 'Priority', 'Frequency'])
    compliance.addRow(['Choose type', 'Select client', 'Select from team', 'Admin/Manager only', 'YYYY-MM-DD', 'Select priority', 'Optional'])
    compliance.addRow(['GST Filing', 'Acme Corp', 'alex@yourcompany.com', 'alex@yourcompany.com', '2025-07-31', 'high', 'monthly'])
    setHeader(compliance.getRow(1))
    compliance.columns = [
      { width: 28 }, { width: 22 }, { width: 28 }, { width: 28 },
      { width: 16 }, { width: 16 }, { width: 18 },
    ]

    // Helper lists sheet
    // A: all team emails
    // B: approver emails filtered from team roles
    // C: client names
    // D: project names
    // E: compliance types
    lists.getCell('A1').value = 'TeamEmails'
    lists.getCell('B1').value = 'ApproverEmails'
    lists.getCell('C1').value = 'ClientNames'
    lists.getCell('D1').value = 'ProjectNames'
    lists.getCell('E1').value = 'ComplianceTypes'

    // Spill formulas for modern Excel
    lists.getCell('A2').value = {
      formula: `FILTER('👥 Team Members'!B3:B500,'👥 Team Members'!B3:B500<>"","")`,
    }

    lists.getCell('B2').value = {
      formula: `FILTER('👥 Team Members'!B3:B500,ISNUMBER(MATCH(LOWER('👥 Team Members'!C3:C500),{"admin","manager","owner"},0)),"")`,
    }

    lists.getCell('C2').value = {
      formula: `FILTER('🏢 Clients'!A3:A500,'🏢 Clients'!A3:A500<>"","")`,
    }

    lists.getCell('D2').value = {
      formula: `FILTER('📁 Projects'!A3:A500,'📁 Projects'!A3:A500<>"","")`,
    }

    lists.getCell('E2').value = {
      formula: `{"GST Filing";"TDS Return";"ROC Filing";"Audit Review"}`,
    }

    // Dropdowns
    addListValidation(tasks, 'C3:C500', '=Lists!$A$2#', 'Assignee', 'Choose from Team Members')
    addListValidation(tasks, 'D3:D500', '=Lists!$B$2#', 'Approver', 'Choose admin/manager/owner from Team Members')
    addListValidation(tasks, 'E3:E500', '"none,low,medium,high,urgent"', 'Priority', 'Choose priority')
    addListValidation(tasks, 'G3:G500', '"todo,in_progress,completed,blocked"', 'Status', 'Choose status')
    addListValidation(tasks, 'H3:H500', '=Lists!$C$2#', 'Client', 'Choose from Clients')
    addDateFormatting(tasks, 'F')

    addListValidation(oneTime, 'B3:B500', '=Lists!$A$2#', 'Assignee', 'Choose from Team Members')
    addListValidation(oneTime, 'C3:C500', '=Lists!$B$2#', 'Approver', 'Choose admin/manager/owner from Team Members')
    addListValidation(oneTime, 'D3:D500', '"none,low,medium,high,urgent"', 'Priority', 'Choose priority')
    addListValidation(oneTime, 'F3:F500', '=Lists!$C$2#', 'Client', 'Choose from Clients')
    addDateFormatting(oneTime, 'E')

    addListValidation(recurring, 'B3:B500', '"daily,weekly,bi_weekly,monthly,quarterly,annual"', 'Frequency', 'Choose frequency')
    addListValidation(recurring, 'C3:C500', '=Lists!$A$2#', 'Assignee', 'Choose from Team Members')
    addListValidation(recurring, 'D3:D500', '=Lists!$B$2#', 'Approver', 'Choose admin/manager/owner from Team Members')
    addListValidation(recurring, 'E3:E500', '"none,low,medium,high,urgent"', 'Priority', 'Choose priority')
    addListValidation(recurring, 'F3:F500', '=Lists!$D$2#', 'Project', 'Choose from Projects')
    addListValidation(recurring, 'G3:G500', '=Lists!$C$2#', 'Client', 'Choose from Clients')
    addDateFormatting(recurring, 'H')

    addListValidation(compliance, 'A3:A500', '=Lists!$E$2#', 'Compliance task', 'Choose compliance task type')
    addListValidation(compliance, 'B3:B500', '=Lists!$C$2#', 'Client', 'Choose from Clients')
    addListValidation(compliance, 'C3:C500', '=Lists!$A$2#', 'Assignee', 'Choose from Team Members')
    addListValidation(compliance, 'D3:D500', '=Lists!$B$2#', 'Approver', 'Choose admin/manager/owner from Team Members')
    addListValidation(compliance, 'F3:F500', '"none,low,medium,high,urgent"', 'Priority', 'Choose priority')
    addListValidation(compliance, 'G3:G500', '"daily,weekly,bi_weekly,monthly,quarterly,annual"', 'Frequency', 'Choose frequency')
    addDateFormatting(compliance, 'E')

    // Freeze header rows
    for (const ws of [team, clients, projects, tasks, oneTime, recurring, compliance]) {
      ws.views = [{ state: 'frozen', ySplit: 1 }]
      ws.autoFilter = {
        from: 'A1',
        to: String.fromCharCode(64 + ws.columnCount) + '1',
      }
    }

    const buf = await wb.xlsx.writeBuffer()

    return new NextResponse(Buffer.from(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="planora_import_template.xlsx"',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: 'Could not generate template: ' + (e?.message ?? 'unknown') },
      { status: 500 }
    )
  }
}