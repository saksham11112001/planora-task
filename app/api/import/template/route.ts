import { NextResponse } from 'next/server'
import * as path from 'path'
import * as fs from 'fs'

// Serve the pre-built template from the public folder.
// In production you can also generate it on-the-fly with the
// same openpyxl script baked into a build step.
export async function GET() {
  try {
    // Try to serve from public/templates/ first (recommended for prod)
    const publicPath = path.join(process.cwd(), 'public', 'templates', 'planora_import_template.xlsx')
    if (fs.existsSync(publicPath)) {
      const buf = fs.readFileSync(publicPath)
      return new NextResponse(buf, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': 'attachment; filename="planora_import_template.xlsx"',
          'Cache-Control': 'public, max-age=86400',
        },
      })
    }

    // Fallback: generate dynamically using the xlsx package
    // This requires: npm install xlsx
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()

    // ── README sheet ─────────────────────────────────────────────
    const readmeData = [
      ['Planora Bulk Import Template'],
      ['Fill in the sheets below and upload at Settings → Import'],
      [],
      ['Sheet', 'What to fill in'],
      ['👥 Team Members', 'Invite teammates — Full Name, Email, Role'],
      ['📁 Projects',     'Create projects — Name, Color, Status, Due Date'],
      ['✅ Tasks',        'Create tasks — Title, Project Name, Assignee Email, Priority'],
      [],
      ['Rules'],
      ['• Do not rename or reorder column headers'],
      ['• Dates must be YYYY-MM-DD format (e.g. 2025-06-30)'],
      ['• Task "Project Name" must match exactly a name in the Projects sheet'],
      ['• Priority: none | low | medium | high | urgent'],
      ['• Role: manager | member | viewer'],
      ['• All sheets are optional — import only what you need'],
    ]
    const readmeWs = XLSX.utils.aoa_to_sheet(readmeData)
    readmeWs['!cols'] = [{ wch: 30 }, { wch: 60 }]
    XLSX.utils.book_append_sheet(wb, readmeWs, '📖 READ ME FIRST')

    // ── Team Members sheet ────────────────────────────────────────
    const membersData = [
      ['Full Name *', 'Email *', 'Role *', 'Notes'],
      ["Person's display name", 'Work email address', 'manager | member | viewer', 'Optional — not imported'],
      ['Alex Johnson',  'alex@company.com',   'manager', ''],
      ['Priya Sharma',  'priya@company.com',  'member',  ''],
      ['Carlos Ruiz',   'carlos@company.com', 'member',  ''],
    ]
    const membersWs = XLSX.utils.aoa_to_sheet(membersData)
    membersWs['!cols'] = [{ wch: 28 }, { wch: 30 }, { wch: 14 }, { wch: 36 }]
    XLSX.utils.book_append_sheet(wb, membersWs, '👥 Team Members')

    // ── Projects sheet ────────────────────────────────────────────
    const projectsData = [
      ['Project Name *', 'Color', 'Status', 'Due Date', 'Owner Email', 'Budget ($)', 'Hours Budget', 'Description'],
      ['Unique project name', '#hex color', 'active|on_hold|completed', 'YYYY-MM-DD', 'owner@co.com', 'Optional', 'Optional', 'Optional'],
      ['Website Redesign',    '#6366f1', 'active',    '2025-08-31', 'alex@company.com',  '',      '',    'Full redesign of company website'],
      ['Mobile App v2',       '#0d9488', 'active',    '2025-10-15', 'priya@company.com', '50000', '400', 'New features and UI refresh'],
      ['Q3 Marketing Push',   '#f59e0b', 'active',    '2025-09-30', '',                  '15000', '',    ''],
    ]
    const projectsWs = XLSX.utils.aoa_to_sheet(projectsData)
    projectsWs['!cols'] = [{ wch: 30 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 24 }, { wch: 12 }, { wch: 14 }, { wch: 40 }]
    XLSX.utils.book_append_sheet(wb, projectsWs, '📁 Projects')

    // ── Tasks sheet ───────────────────────────────────────────────
    const tasksData = [
      ['Task Title *', 'Project Name', 'Assignee Email', 'Priority', 'Due Date', 'Status', 'Est. Hours', 'Description'],
      ['Action-oriented title', 'Must match project exactly', 'Assignee email', 'none|low|medium|high|urgent', 'YYYY-MM-DD', 'todo|in_progress|completed', 'Number', 'Optional'],
      ['Design homepage wireframes',   'Website Redesign',   'alex@company.com',   'high',   '2025-07-15', 'todo', '8', 'Create lo-fi wireframes'],
      ['Set up CI/CD pipeline',        'Mobile App v2',      'priya@company.com',  'high',   '2025-07-20', 'todo', '6', ''],
      ['Write API documentation',      'Mobile App v2',      'carlos@company.com', 'medium', '2025-07-25', 'todo', '4', ''],
      ['Create social media calendar', 'Q3 Marketing Push',  '',                   'medium', '2025-08-01', 'todo', '3', ''],
      ['Competitor analysis report',   '',                   '',                   'low',    '',           'todo', '',  'One-time task — no project'],
    ]
    const tasksWs = XLSX.utils.aoa_to_sheet(tasksData)
    tasksWs['!cols'] = [{ wch: 38 }, { wch: 26 }, { wch: 26 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 38 }]
    XLSX.utils.book_append_sheet(wb, tasksWs, '✅ Tasks')

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="planora_import_template.xlsx"',
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: 'Could not generate template: ' + e?.message }, { status: 500 })
  }
}
