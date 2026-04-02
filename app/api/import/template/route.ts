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

function addDateFormatting(
  ws: ExcelJS.Worksheet,
  colLetter: string,
  fromRow = 2,
  toRow = 500
) {
  for (let r = fromRow; r <= toRow; r++) {
    ws.getCell(`${colLetter}${r}`).numFmt = 'yyyy-mm-dd'
  }
}

function addBlankRows(ws: ExcelJS.Worksheet, cols: number, count = 40) {
  for (let i = 0; i < count; i++) {
    ws.addRow(new Array(cols).fill(''))
  }
}

export async function GET() {
  try {
    const wb = new ExcelJS.Workbook()
    wb.creator = 'Planora'
    wb.created = new Date()

    const readme = wb.addWorksheet('READ ME')
    const team = wb.addWorksheet('Team Members')
    const clients = wb.addWorksheet('Clients')
    const projects = wb.addWorksheet('Projects')
    const tasks = wb.addWorksheet('Tasks')
    const oneTime = wb.addWorksheet('One-Time Tasks')
    const recurring = wb.addWorksheet('Recurring Tasks')
    const compliance = wb.addWorksheet('CA Compliance Tasks')
    const lists = wb.addWorksheet('Lists')

    lists.state = 'veryHidden'

    // READ ME
    readme.addRows([
      ['Planora Smart Bulk Import Template'],
      ['1. Fill Team Members first.'],
      ['2. Then fill Clients and Projects.'],
      ['3. Then fill Tasks / One-Time Tasks / Recurring Tasks / Compliance Tasks.'],
      ['4. Assignee dropdown comes from Team Members.'],
      ['5. Approver dropdown comes only from owner/admin/manager in Team Members.'],
      ['6. Client dropdown comes from Clients sheet.'],
      ['7. Project dropdown comes from Projects sheet.'],
      ['8. Dates are displayed as YYYY-MM-DD.'],
      ['9. Upload this file in Planora Bulk Import.'],
    ])
    readme.columns = [{ width: 90 }]

    // TEAM MEMBERS
    team.addRow(['Full Name *', 'Email *', 'Role *', 'Notes'])
    setHeader(team.getRow(1))
    addBlankRows(team, 4, 40)
    team.columns = [
      { width: 24 },
      { width: 30 },
      { width: 18 },
      { width: 28 },
    ]
    team.views = [{ state: 'frozen', ySplit: 1 }]

    addListValidation(
      team,
      'C2:C500',
      '"owner,admin,manager,member,viewer"',
      'Role',
      'Choose a role'
    )

    // CLIENTS
    clients.addRow([
      'Client Name *',
      'Contact Email',
      'Phone',
      'Company',
      'Website',
      'Industry',
      'Color',
      'Status',
      'Notes',
    ])
    setHeader(clients.getRow(1))
    addBlankRows(clients, 9, 40)
    clients.columns = [
      { width: 24 },
      { width: 28 },
      { width: 18 },
      { width: 22 },
      { width: 28 },
      { width: 18 },
      { width: 14 },
      { width: 16 },
      { width: 24 },
    ]
    clients.views = [{ state: 'frozen', ySplit: 1 }]

    addListValidation(
      clients,
      'H2:H500',
      '"active,inactive,lead"',
      'Client status',
      'Choose client status'
    )

    // PROJECTS
    projects.addRow([
      'Project Name *',
      'Color',
      'Status',
      'Due Date',
      'Owner Email',
      'Client Name',
      'Budget',
      'Hours Budget',
      'Description',
    ])
    setHeader(projects.getRow(1))
    addBlankRows(projects, 9, 40)
    projects.columns = [
      { width: 24 },
      { width: 14 },
      { width: 18 },
      { width: 16 },
      { width: 28 },
      { width: 22 },
      { width: 14 },
      { width: 14 },
      { width: 30 },
    ]
    projects.views = [{ state: 'frozen', ySplit: 1 }]

    addListValidation(
      projects,
      'C2:C500',
      '"active,on_hold,completed"',
      'Project status',
      'Choose project status'
    )
    addDateFormatting(projects, 'D', 2, 500)

    // TASKS
    tasks.addRow([
      'Task Title *',
      'Project Name',
      'Assignee Email',
      'Approver Email',
      'Priority',
      'Due Date',
      'Status',
      'Client Name',
      'Est. Hours',
      'Description',
    ])
    setHeader(tasks.getRow(1))
    addBlankRows(tasks, 10, 60)
    tasks.columns = [
      { width: 28 },
      { width: 24 },
      { width: 28 },
      { width: 28 },
      { width: 16 },
      { width: 16 },
      { width: 18 },
      { width: 22 },
      { width: 12 },
      { width: 28 },
    ]
    tasks.views = [{ state: 'frozen', ySplit: 1 }]

    // ONE-TIME TASKS
    oneTime.addRow([
      'Task Title *',
      'Assignee Email',
      'Approver Email',
      'Priority',
      'Due Date',
      'Client Name',
      'Est. Hours',
      'Description',
    ])
    setHeader(oneTime.getRow(1))
    addBlankRows(oneTime, 8, 60)
    oneTime.columns = [
      { width: 28 },
      { width: 28 },
      { width: 28 },
      { width: 16 },
      { width: 16 },
      { width: 22 },
      { width: 12 },
      { width: 28 },
    ]
    oneTime.views = [{ state: 'frozen', ySplit: 1 }]

    // RECURRING TASKS
    recurring.addRow([
      'Task Title *',
      'Frequency *',
      'Assignee Email',
      'Approver Email',
      'Priority',
      'Project Name',
      'Client Name',
      'Start Date',
      'Description',
    ])
    setHeader(recurring.getRow(1))
    addBlankRows(recurring, 9, 60)
    recurring.columns = [
      { width: 28 },
      { width: 18 },
      { width: 28 },
      { width: 28 },
      { width: 16 },
      { width: 24 },
      { width: 22 },
      { width: 16 },
      { width: 28 },
    ]
    recurring.views = [{ state: 'frozen', ySplit: 1 }]

    // CA COMPLIANCE TASKS
    compliance.addRow([
      'Compliance Task Type *',
      'Client Name',
      'Assignee Email',
      'Approver Email',
      'Due Date',
      'Priority',
      'Frequency',
    ])
    setHeader(compliance.getRow(1))
    addBlankRows(compliance, 7, 60)
    compliance.columns = [
      { width: 28 },
      { width: 22 },
      { width: 28 },
      { width: 28 },
      { width: 16 },
      { width: 16 },
      { width: 18 },
    ]
    compliance.views = [{ state: 'frozen', ySplit: 1 }]

    // Hidden helper list formulas
    lists.getCell('A1').value = 'TeamEmails'
    lists.getCell('B1').value = 'ApproverEmails'
    lists.getCell('C1').value = 'ClientNames'
    lists.getCell('D1').value = 'ProjectNames'
    lists.getCell('E1').value = 'ComplianceTypes'

    lists.getCell('A2').value = {
      formula: `FILTER('Team Members'!B2:B500,'Team Members'!B2:B500<>"","")`,
    }

    lists.getCell('B2').value = {
      formula: `FILTER('Team Members'!B2:B500,ISNUMBER(MATCH(LOWER('Team Members'!C2:C500),{"owner","admin","manager"},0)),"")`,
    }

    lists.getCell('C2').value = {
      formula: `FILTER('Clients'!A2:A500,'Clients'!A2:A500<>"","")`,
    }

    lists.getCell('D2').value = {
      formula: `FILTER('Projects'!A2:A500,'Projects'!A2:A500<>"","")`,
    }

    lists.getCell('E2').value = {
      formula: `{"GST Filing";"TDS Return";"ROC Filing";"Audit Review"}`,
    }

    // Project owner dropdown from team
    addListValidation(
      projects,
      'E2:E500',
      '=Lists!$A$2#',
      'Owner Email',
      'Choose from Team Members'
    )

    addListValidation(
      projects,
      'F2:F500',
      '=Lists!$C$2#',
      'Client Name',
      'Choose from Clients'
    )

    // TASKS dropdowns
    addListValidation(tasks, 'B2:B500', '=Lists!$D$2#', 'Project', 'Choose from Projects')
    addListValidation(tasks, 'C2:C500', '=Lists!$A$2#', 'Assignee', 'Choose from Team Members')
    addListValidation(tasks, 'D2:D500', '=Lists!$B$2#', 'Approver', 'Choose owner/admin/manager')
    addListValidation(tasks, 'E2:E500', '"none,low,medium,high,urgent"', 'Priority', 'Choose priority')
    addListValidation(tasks, 'G2:G500', '"todo,in_progress,completed,blocked"', 'Status', 'Choose status')
    addListValidation(tasks, 'H2:H500', '=Lists!$C$2#', 'Client', 'Choose from Clients')
    addDateFormatting(tasks, 'F', 2, 500)

    // ONE-TIME TASKS dropdowns
    addListValidation(oneTime, 'B2:B500', '=Lists!$A$2#', 'Assignee', 'Choose from Team Members')
    addListValidation(oneTime, 'C2:C500', '=Lists!$B$2#', 'Approver', 'Choose owner/admin/manager')
    addListValidation(oneTime, 'D2:D500', '"none,low,medium,high,urgent"', 'Priority', 'Choose priority')
    addListValidation(oneTime, 'F2:F500', '=Lists!$C$2#', 'Client', 'Choose from Clients')
    addDateFormatting(oneTime, 'E', 2, 500)

    // RECURRING TASKS dropdowns
    addListValidation(recurring, 'B2:B500', '"daily,weekly,bi_weekly,monthly,quarterly,annual"', 'Frequency', 'Choose frequency')
    addListValidation(recurring, 'C2:C500', '=Lists!$A$2#', 'Assignee', 'Choose from Team Members')
    addListValidation(recurring, 'D2:D500', '=Lists!$B$2#', 'Approver', 'Choose owner/admin/manager')
    addListValidation(recurring, 'E2:E500', '"none,low,medium,high,urgent"', 'Priority', 'Choose priority')
    addListValidation(recurring, 'F2:F500', '=Lists!$D$2#', 'Project', 'Choose from Projects')
    addListValidation(recurring, 'G2:G500', '=Lists!$C$2#', 'Client', 'Choose from Clients')
    addDateFormatting(recurring, 'H', 2, 500)

    // COMPLIANCE dropdowns
    addListValidation(compliance, 'A2:A500', '=Lists!$E$2#', 'Compliance Type', 'Choose compliance type')
    addListValidation(compliance, 'B2:B500', '=Lists!$C$2#', 'Client', 'Choose from Clients')
    addListValidation(compliance, 'C2:C500', '=Lists!$A$2#', 'Assignee', 'Choose from Team Members')
    addListValidation(compliance, 'D2:D500', '=Lists!$B$2#', 'Approver', 'Choose owner/admin/manager')
    addListValidation(compliance, 'F2:F500', '"none,low,medium,high,urgent"', 'Priority', 'Choose priority')
    addListValidation(compliance, 'G2:G500', '"daily,weekly,bi_weekly,monthly,quarterly,annual"', 'Frequency', 'Choose frequency')
    addDateFormatting(compliance, 'E', 2, 500)

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