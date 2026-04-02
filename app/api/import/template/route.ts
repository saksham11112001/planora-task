import { NextResponse } from 'next/server'

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()

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
    ]
    const readmeWs = XLSX.utils.aoa_to_sheet(readmeData)
    XLSX.utils.book_append_sheet(wb, readmeWs, '📖 READ ME FIRST')

    const membersData = [
      ['Full Name *', 'Email *', 'Role *', 'Notes'],
      ["Person's display name", 'Work email address', 'manager | member | viewer', 'Optional'],
      ['Alex Johnson', 'alex@company.com', 'manager', ''],
      ['Priya Sharma', 'priya@company.com', 'member', ''],
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(membersData), '👥 Team Members')

    const clientsData = [
      ['Client Name *', 'Email', 'Phone Number', 'Company', 'Website', 'Industry', 'Color', 'Status', 'Notes'],
      ['Display name', 'Optional', 'Optional', 'Optional', 'Optional', 'Optional', '#hex optional', 'active | inactive | lead', 'Optional'],
      ['Acme Corp', 'hello@acme.com', '', 'Acme Corp', 'https://acme.com', 'SaaS', '#0d9488', 'active', ''],
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(clientsData), '🏢 Clients')

    const projectsData = [
      ['Project Name *', 'Color', 'Status', 'Due Date', 'Owner Email', 'Client Name', 'Budget', 'Hours Budget', 'Description'],
      ['Unique name', '#hex optional', 'active | on_hold | completed', 'YYYY-MM-DD', 'owner@company.com', 'Must match Clients sheet', 'Optional', 'Optional', 'Optional'],
      ['Website Redesign', '#6366f1', 'active', '2026-06-30', 'alex@company.com', 'Acme Corp', '50000', '220', 'Full redesign of website'],
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(projectsData), '📁 Projects')

    const tasksData = [
      ['Task Title *', 'Project Name', 'Client Name', 'Assignee Email', 'Priority', 'Due Date', 'Status', 'Est. Hours', 'Description'],
      ['Clear action title', 'Must match Projects', 'Optional', 'Single email or comma-separated', 'none|low|medium|high|urgent', 'YYYY-MM-DD', 'todo|in_progress|completed|blocked|cancelled', 'Number', 'Optional'],
      ['Design homepage wireframes', 'Website Redesign', 'Acme Corp', 'alex@company.com', 'high', '2026-05-15', 'todo', '8', 'Create low-fi wireframes'],
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(tasksData), '✅ Tasks')

    const oneTimeData = [
      ['Task Title *', 'Client Name', 'Assignee Email', 'Priority', 'Due Date', 'Est. Hours', 'Description', 'Compliance Task Type'],
      ['Standalone task', 'Optional', 'Single email or comma-separated', 'none|low|medium|high|urgent', 'YYYY-MM-DD', 'Number', 'Optional', 'Optional'],
      ['Competitor analysis report', 'Acme Corp', 'alex@company.com', 'medium', '2026-05-28', '3', 'Standalone task without project', ''],
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(oneTimeData), '📥 One-Time Tasks')

    const recurringData = [
      ['Task Title *', 'Frequency *', 'Project Name', 'Client Name', 'Assignee Email', 'Priority', 'Start Date', 'Description'],
      ['Repeated task name', 'daily|weekly|bi_weekly|monthly|quarterly|annual', 'Optional', 'Optional', 'Single email or comma-separated', 'none|low|medium|high|urgent', 'YYYY-MM-DD', 'Optional'],
      ['Weekly standup', 'weekly', 'Website Redesign', 'Acme Corp', 'alex@company.com', 'medium', '2026-05-01', ''],
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(recurringData), '🔁 Recurring Tasks')

    const complianceData = [
      ['Compliance Task Type *', 'Client Name', 'Assignee Email', 'Due Date', 'Priority', 'Frequency'],
      ['Must match supported compliance task title', 'Must match Clients sheet', 'Single email or comma-separated', 'YYYY-MM-DD', 'Optional', 'Optional recurring frequency'],
      ['GST Filing', 'Acme Corp', 'alex@company.com', '2026-05-31', 'high', 'monthly'],
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(complianceData), '🧾 CA Compliance Tasks')

    const buf: Buffer = XLSX.write(wb, {
      type: 'buffer',
      bookType: 'xlsx',
    })

    return new NextResponse(buf, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition':
          'attachment; filename="planora_import_template.xlsx"',
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