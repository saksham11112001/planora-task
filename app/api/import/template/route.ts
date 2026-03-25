import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()

    // ── README ──────────────────────────────────────────────────
    const readmeData = [
      ['Planora Bulk Import Template'],
      ['Fill in the 3 sheets below, then upload at: Settings → Import data'],
      [],
      ['Sheet',            'What to fill in'],
      ['👥 Team Members', 'Invite teammates — Name, Email, Role'],
      ['📁 Projects',     'Create projects — Name, Color, Status, Due Date, Owner'],
      ['✅ Tasks',        'Create tasks — Title, Project, Assignee, Priority, Due Date'],
      [],
      ['Rules'],
      ['• Do not rename or reorder the column headers'],
      ['• Dates must be YYYY-MM-DD format  e.g. 2025-06-30'],
      ['• Task "Project Name" must exactly match a name in the Projects sheet'],
      ['• Priority values: none | low | medium | high | urgent'],
      ['• Role values: manager | member | viewer'],
      ['• All three sheets are optional — import only what you need'],
    ]
    const readmeWs = XLSX.utils.aoa_to_sheet(readmeData)
    readmeWs['!cols'] = [{ wch: 26 }, { wch: 62 }]
    XLSX.utils.book_append_sheet(wb, readmeWs, '📖 READ ME FIRST')

    // ── TEAM MEMBERS ────────────────────────────────────────────
    const membersData = [
      ['Full Name *',           'Email *',              'Role *',                    'Notes'],
      ["Person's display name", 'Work email address',   'manager | member | viewer', 'Optional — not imported'],
      ['Alex Johnson',          'alex@company.com',     'manager',                   ''],
      ['Priya Sharma',          'priya@company.com',    'member',                    ''],
      ['Carlos Ruiz',           'carlos@company.com',   'member',                    ''],
    ]
    const membersWs = XLSX.utils.aoa_to_sheet(membersData)
    membersWs['!cols'] = [{ wch: 26 }, { wch: 30 }, { wch: 16 }, { wch: 38 }]
    XLSX.utils.book_append_sheet(wb, membersWs, '👥 Team Members')

    // ── PROJECTS ────────────────────────────────────────────────
    const projectsData = [
      ['Project Name *',    'Color',          'Status',                      'Due Date',   'Owner Email',       'Budget (₹)', 'Hours Budget', 'Description'],
      ['Unique name',       '#hex e.g #6366f1','active | on_hold | completed','YYYY-MM-DD', 'owner@company.com', 'Optional',   'Optional',     'Optional'],
      ['Website Redesign',  '#6366f1',        'active',                      '2025-08-31', 'alex@company.com',  '',           '',             'Full redesign of company website'],
      ['Mobile App v2',     '#0d9488',        'active',                      '2025-10-15', 'priya@company.com', '50000',      '400',          'New features and UI refresh'],
      ['Q3 Marketing Push', '#f59e0b',        'active',                      '2025-09-30', '',                  '15000',      '',             ''],
    ]
    const projectsWs = XLSX.utils.aoa_to_sheet(projectsData)
    projectsWs['!cols'] = [{ wch: 26 }, { wch: 14 }, { wch: 22 }, { wch: 14 }, { wch: 24 }, { wch: 14 }, { wch: 14 }, { wch: 40 }]
    XLSX.utils.book_append_sheet(wb, projectsWs, '📁 Projects')

    // ── TASKS ───────────────────────────────────────────────────
    const tasksData = [
      ['Task Title *',               'Project Name',      'Assignee Email',      'Priority',                      'Due Date',   'Status',                       'Est. Hours', 'Description'],
      ['Clear action-oriented title', 'Must match exactly','Assignee email',      'none|low|medium|high|urgent',   'YYYY-MM-DD', 'todo|in_progress|completed',   'Number',     'Optional'],
      ['Design homepage wireframes',  'Website Redesign',  'alex@company.com',   'high',                          '2025-07-15', 'todo',                         '8',          'Create lo-fi wireframes for review'],
      ['Set up CI/CD pipeline',       'Mobile App v2',     'priya@company.com',  'high',                          '2025-07-20', 'todo',                         '6',          ''],
      ['Write API documentation',     'Mobile App v2',     'carlos@company.com', 'medium',                        '2025-07-25', 'todo',                         '4',          ''],
      ['Create social media calendar','Q3 Marketing Push', '',                   'medium',                        '2025-08-01', 'todo',                         '3',          ''],
      ['Competitor analysis report',  '',                  '',                   'low',                           '',           'todo',                         '',           'One-time task — no project needed'],
    ]
    const tasksWs = XLSX.utils.aoa_to_sheet(tasksData)
    tasksWs['!cols'] = [{ wch: 34 }, { wch: 24 }, { wch: 26 }, { wch: 22 }, { wch: 14 }, { wch: 20 }, { wch: 12 }, { wch: 38 }]
    XLSX.utils.book_append_sheet(wb, tasksWs, '✅ Tasks')

    const buf: Buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="planora_import_template.xlsx"',
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: 'Could not generate template: ' + (e?.message ?? 'unknown') },
      { status: 500 }
    )
  }
}
