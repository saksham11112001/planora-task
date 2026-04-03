import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()

    const sheets = [
      {
        name: '📖 READ ME',
        data: [
          ['Planora Bulk Import Template'],
          ['Fill the sheets below and upload them on the Bulk Import page.'],
          ['Tasks sheets now support Assignee Email, Approver Email, and Due Date.'],
        ],
      },
      {
        name: '👥 Team Members',
        data: [
          ['Full Name *', 'Email *', 'Role *', 'Notes'],
          ["Person's display name", 'Work email', 'manager|member|viewer', 'Optional'],
          ['[SAMPLE] Alex Johnson', 'alex@yourcompany.com', 'manager', ''],
        ],
      },
      {
        name: '🏢 Clients',
        data: [
          ['Client Name *', 'Contact Email', 'Phone', 'Company', 'Website', 'Industry', 'Color', 'Status', 'Notes'],
          ['Unique name', 'contact@client.com', '+91 9876543210', 'Company Ltd', 'https://company.com', 'Technology', '#6366f1', 'active|inactive|lead', 'Optional'],
          ['[SAMPLE] Acme Corp', 'hello@acme.com', '', 'Acme Corp Ltd', '', 'Technology', '#6366f1', 'active', ''],
        ],
      },
      {
        name: '📁 Projects',
        data: [
          ['Project Name *', 'Color', 'Status', 'Due Date', 'Owner Email', 'Client Name', 'Budget', 'Hours Budget', 'Description'],
          ['Unique name', '#hex', 'active|on_hold|completed', 'YYYY-MM-DD', 'owner@yourcompany.com', 'Must match clients', 'Optional', 'Optional', 'Optional'],
          ['[SAMPLE] Website Redesign', '#6366f1', 'active', '2025-08-31', 'alex@yourcompany.com', 'Acme Corp', '', '', ''],
        ],
      },
      {
        name: '✅ Tasks',
        data: [
          ['Task Title *', 'Project Name', 'Assignee Email', 'Approver Email', 'Priority', 'Due Date', 'Status', 'Client Name', 'Est. Hours', 'Description'],
          ['Clear title', 'Must match projects', 'email', 'email', 'none|low|medium|high|urgent', 'YYYY-MM-DD', 'todo|in_progress|completed|blocked', 'Optional', 'Number', 'Optional'],
          ['[SAMPLE] Design wireframes', '[SAMPLE] Website Redesign', 'alex@yourcompany.com', 'manager@yourcompany.com', 'high', '2025-07-15', 'todo', 'Acme Corp', '8', ''],
        ],
      },
      {
        name: '📥 One-Time Tasks',
        data: [
          ['Task Title *', 'Assignee Email', 'Approver Email', 'Priority', 'Due Date', 'Client Name', 'Est. Hours', 'Description'],
          ['Clear title', 'email', 'email', 'none|low|medium|high|urgent', 'YYYY-MM-DD', 'Must match clients', 'Number', 'Optional'],
          ['[SAMPLE] Review Q3 proposals', 'alex@yourcompany.com', 'manager@yourcompany.com', 'high', '2025-07-10', 'Acme Corp', '2', ''],
        ],
      },
      {
        name: '🔁 Recurring Tasks',
        data: [
          ['Task Title *', 'Frequency *', 'Assignee Email', 'Approver Email', 'Priority', 'Project Name', 'Client Name', 'Start Date', 'Description'],
          ['Clear title', 'daily|weekly|bi_weekly|monthly|quarterly|annual', 'email', 'email', 'none|low|medium|high|urgent', 'Must match projects', 'Optional', 'YYYY-MM-DD', 'Optional'],
          ['[SAMPLE] Weekly standup', 'weekly', 'alex@yourcompany.com', 'manager@yourcompany.com', 'medium', '', '', '2025-07-07', ''],
        ],
      },
      {
        name: '🧾 CA Compliance Tasks',
        data: [
          ['Compliance Task Type *', 'Client Name', 'Assignee Email', 'Approver Email', 'Due Date', 'Priority', 'Frequency'],
          ['Must match supported compliance task title', 'Must match clients', 'email', 'email', 'YYYY-MM-DD', 'Optional', 'Optional'],
          ['[SAMPLE] GST Filing', 'Acme Corp', 'alex@yourcompany.com', 'manager@yourcompany.com', '2025-07-31', 'high', 'monthly'],
        ],
      },
    ]

    for (const { name, data } of sheets) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), name)
    }

    const buf: Buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="planora_import_template.xlsx"',
        'Cache-Control': 'no-store',
      },
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: 'Could not generate template: ' + e?.message },
      { status: 500 }
    )
  }
}