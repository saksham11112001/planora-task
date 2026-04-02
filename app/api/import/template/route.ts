import { NextResponse } from 'next/server'


export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()

    // README
    const readmeData = [
      ['Planora Bulk Import Template'],
      ['Fill the sheets you need, then upload from Settings → Import data'],
      [],
      ['Sheet', 'Purpose'],
      ['👥 Team Members', 'Invite teammates'],
      ['🏢 Clients', 'Create clients'],
      ['📁 Projects', 'Create projects'],
      ['✅ Tasks', 'Project-linked tasks'],
      ['📥 One-Time Tasks', 'Standalone tasks without project'],
      ['🔁 Recurring Tasks', 'Repeated tasks'],
      ['🧾 CA Compliance Tasks', 'Compliance templates with optional recurrence'],
      [],
      ['Rules'],
      ['• Do not rename the column headers'],
      ['• Dates should be YYYY-MM-DD'],
      ['• Project Name in task sheets should match a project in the Projects sheet'],
      ['• Client Name should match a client in the Clients sheet'],
      ['• Team member emails should exist or be invited through the Team Members sheet'],
      ['• Priority: none | low | medium | high | urgent'],
      ['• Task status: todo | in_progress | completed | blocked | cancelled'],
      ['• Project status: active | on_hold | completed'],
      ['• Client status: active | inactive | lead'],
      ['• Recurring frequency: daily | weekly | bi_weekly | monthly | quarterly | annual'],
    ]
    const readmeWs = XLSX.utils.aoa_to_sheet(readmeData)
    readmeWs['!cols'] = [{ wch: 28 }, { wch: 72 }]
    XLSX.utils.book_append_sheet(wb, readmeWs, '📖 READ ME FIRST')

    // TEAM MEMBERS
    const membersData = [
      ['Full Name *', 'Email *', 'Role *', 'Notes'],
      ["Person's display name", 'Work email address', 'manager | member | viewer', 'Optional'],
      ['Alex Johnson', 'alex@company.com', 'manager', ''],
      ['Priya Sharma', 'priya@company.com', 'member', ''],
      ['Carlos Ruiz', 'carlos@company.com', 'member', ''],
    ]
    const membersWs = XLSX.utils.aoa_to_sheet(membersData)
    membersWs['!cols'] = [{ wch: 24 }, { wch: 28 }, { wch: 18 }, { wch: 32 }]
    XLSX.utils.book_append_sheet(wb, membersWs, '👥 Team Members')

    // CLIENTS
    const clientsData = [
      ['Client Name *', 'Email', 'Phone Number', 'Company', 'Website', 'Industry', 'Color', 'Status', 'Notes'],
      ['Display name', 'Optional', 'Optional', 'Optional', 'Optional', 'Optional', '#hex optional', 'active | inactive | lead', 'Optional'],
      ['Acme Corp', 'hello@acme.com', '', 'Acme Corp', 'https://acme.com', 'SaaS', '#0d9488', 'active', ''],
      ['Garg Sons', 'ops@gargsons.com', '', 'Garg Sons', '', 'Finance', '#6366f1', 'active', ''],
      ['Mehra & Co', 'admin@mehraandco.com', '', 'Mehra & Co', '', 'Consulting', '#f59e0b', 'lead', ''],
    ]
    const clientsWs = XLSX.utils.aoa_to_sheet(clientsData)
    clientsWs['!cols'] = [
      { wch: 24 }, { wch: 26 }, { wch: 18 }, { wch: 22 }, { wch: 28 },
      { wch: 18 }, { wch: 14 }, { wch: 20 }, { wch: 30 },
    ]
    XLSX.utils.book_append_sheet(wb, clientsWs, '🏢 Clients')

    // PROJECTS
    const projectsData = [
      ['Project Name *', 'Color', 'Status', 'Due Date', 'Owner Email', 'Client Name', 'Budget', 'Hours Budget', 'Description'],
      ['Unique name', '#hex optional', 'active | on_hold | completed', 'YYYY-MM-DD', 'owner@company.com', 'Must match Clients sheet', 'Optional', 'Optional', 'Optional'],
      ['Website Redesign', '#6366f1', 'active', '2026-06-30', 'alex@company.com', 'Acme Corp', '50000', '220', 'Full redesign of website'],
      ['Mobile App v2', '#0d9488', 'active', '2026-08-15', 'priya@company.com', 'Garg Sons', '120000', '400', 'Second major release'],
      ['Q3 Marketing Push', '#f59e0b', 'on_hold', '2026-09-30', '', 'Mehra & Co', '15000', '', ''],
    ]
    const projectsWs = XLSX.utils.aoa_to_sheet(projectsData)
    projectsWs['!cols'] = [
      { wch: 24 }, { wch: 14 }, { wch: 24 }, { wch: 14 }, { wch: 26 },
      { wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 36 },
    ]
    XLSX.utils.book_append_sheet(wb, projectsWs, '📁 Projects')

    // TASKS
    const tasksData = [
      ['Task Title *', 'Project Name', 'Client Name', 'Assignee Email', 'Priority', 'Due Date', 'Status', 'Est. Hours', 'Description'],
      ['Clear action title', 'Must match Projects', 'Optional but recommended', 'Single email or comma-separated', 'none|low|medium|high|urgent', 'YYYY-MM-DD', 'todo|in_progress|completed|blocked|cancelled', 'Number', 'Optional'],
      ['Design homepage wireframes', 'Website Redesign', 'Acme Corp', 'alex@company.com', 'high', '2026-05-15', 'todo', '8', 'Create low-fi wireframes'],
      ['Set up CI/CD pipeline', 'Mobile App v2', 'Garg Sons', 'priya@company.com', 'high', '2026-05-20', 'todo', '6', ''],
      ['Write API documentation', 'Mobile App v2', 'Garg Sons', 'carlos@company.com', 'medium', '2026-05-25', 'todo', '4', ''],
    ]
    const tasksWs = XLSX.utils.aoa_to_sheet(tasksData)
    tasksWs['!cols'] = [
      { wch: 32 }, { wch: 22 }, { wch: 20 }, { wch: 28 }, { wch: 18 },
      { wch: 14 }, { wch: 30 }, { wch: 12 }, { wch: 36 },
    ]
    XLSX.utils.book_append_sheet(wb, tasksWs, '✅ Tasks')

    // ONE-TIME TASKS
    const oneTimeData = [
      ['Task Title *', 'Client Name', 'Assignee Email', 'Priority', 'Due Date', 'Est. Hours', 'Description', 'Compliance Task Type'],
      ['Standalone task', 'Optional', 'Single email or comma-separated', 'none|low|medium|high|urgent', 'YYYY-MM-DD', 'Number', 'Optional', 'Optional'],
      ['Competitor analysis report', 'Acme Corp', 'alex@company.com', 'medium', '2026-05-28', '3', 'Standalone task without project', ''],
      ['GST filing', 'Garg Sons', 'priya@company.com', 'high', '2026-05-31', '', 'Will create mapped compliance subtasks if supported', 'GST Filing'],
    ]
    const oneTimeWs = XLSX.utils.aoa_to_sheet(oneTimeData)
    oneTimeWs['!cols'] = [
      { wch: 30 }, { wch: 20 }, { wch: 28 }, { wch: 18 },
      { wch: 14 }, { wch: 12 }, { wch: 38 }, { wch: 24 },
    ]
    XLSX.utils.book_append_sheet(wb, oneTimeWs, '📥 One-Time Tasks')

    // RECURRING TASKS
    const recurringData = [
      ['Task Title *', 'Frequency *', 'Project Name', 'Client Name', 'Assignee Email', 'Priority', 'Start Date', 'Description'],
      ['Repeated task name', 'daily|weekly|bi_weekly|monthly|quarterly|annual', 'Optional', 'Optional', 'Single email or comma-separated', 'none|low|medium|high|urgent', 'YYYY-MM-DD', 'Optional'],
      ['Weekly standup', 'weekly', 'Website Redesign', 'Acme Corp', 'alex@company.com', 'medium', '2026-05-01', ''],
      ['Monthly GST filing', 'monthly', '', 'Garg Sons', 'priya@company.com', 'high', '2026-05-05', ''],
    ]
    const recurringWs = XLSX.utils.aoa_to_sheet(recurringData)
    recurringWs['!cols'] = [
      { wch: 28 }, { wch: 24 }, { wch: 22 }, { wch: 20 },
      { wch: 28 }, { wch: 18 }, { wch: 14 }, { wch: 32 },
    ]
    XLSX.utils.book_append_sheet(wb, recurringWs, '🔁 Recurring Tasks')

    // CA COMPLIANCE TASKS
    const complianceData = [
      ['Compliance Task Type *', 'Client Name', 'Assignee Email', 'Due Date', 'Priority', 'Frequency'],
      ['Must match supported compliance task title', 'Must match Clients sheet', 'Single email or comma-separated', 'YYYY-MM-DD', 'Optional', 'Optional recurring frequency'],
      ['GST Filing', 'Garg Sons', 'priya@company.com', '2026-05-31', 'high', 'monthly'],
      ['Quarterly TDS Review', 'Mehra & Co', 'alex@company.com', '2026-06-30', 'high', 'quarterly'],
    ]
    const complianceWs = XLSX.utils.aoa_to_sheet(complianceData)
    complianceWs['!cols'] = [
      { wch: 32 }, { wch: 20 }, { wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 18 },
    ]
    XLSX.utils.book_append_sheet(wb, complianceWs, '🧾 CA Compliance Tasks')

    const buf: Buffer = XLSX.write(wb, {
      type: 'buffer',
      bookType: 'xlsx',
    })

    return new NextResponse(buf, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition':
          'attachment; filename="planora_import_template_v2.xlsx"',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
         Pragma: 'no-cache',
         Expires: '0',
      },
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: `Could not generate template: ${e?.message ?? 'unknown'}` },
      { status: 500 }
    )
  }
}