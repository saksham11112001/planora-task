import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()

    // ── README ──────────────────────────────────────────────────
    const readmeData = [
      ['Planora Bulk Import Template'],
      ['Fill in the sheets below, then upload at: Sidebar → Import data'],
      [],
      ['Sheet',                'What to fill in'],
      ['👥 Team Members',     'Invite teammates — Name, Email, Role'],
      ['🏢 Clients',          'Create clients — Name, Email, Company, Color'],
      ['📁 Projects',         'Create projects — Name, Color, Status, Due Date, Owner, Client'],
      ['✅ Tasks',            'Create tasks — Title, Project, Assignee, Priority, Due Date'],
      ['🔁 Recurring Tasks',  'Create recurring tasks — Title, Frequency, Assignee, Project'],
      [],
      ['Rules'],
      ['• Do not rename or reorder column headers'],
      ['• Dates must be YYYY-MM-DD  (e.g. 2025-06-30)'],
      ['• Task "Project Name" must match exactly a name in the Projects sheet'],
      ['• Priority: none | low | medium | high | urgent'],
      ['• Role: manager | member | viewer'],
      ['• Frequency: daily | weekly | bi_weekly | monthly | quarterly | annual'],
      ['• All sheets are optional — fill only what you need'],
    ]
    const readmeWs = XLSX.utils.aoa_to_sheet(readmeData)
    readmeWs['!cols'] = [{ wch: 22 }, { wch: 66 }]
    XLSX.utils.book_append_sheet(wb, readmeWs, '📖 READ ME')

    // ── TEAM MEMBERS ────────────────────────────────────────────
    const membersData = [
      ['Full Name *',           'Email *',             'Role *',                    'Notes'],
      ["Person's display name", 'Work email address',  'manager | member | viewer', 'Optional'],
      ['Alex Johnson',          'alex@company.com',    'manager',                   ''],
      ['Priya Sharma',          'priya@company.com',   'member',                    ''],
    ]
    const membersWs = XLSX.utils.aoa_to_sheet(membersData)
    membersWs['!cols'] = [{ wch: 24 }, { wch: 28 }, { wch: 16 }, { wch: 36 }]
    XLSX.utils.book_append_sheet(wb, membersWs, '👥 Team Members')

    // ── CLIENTS ─────────────────────────────────────────────────
    const clientsData = [
      ['Client Name *', 'Email',              'Phone',           'Company',       'Website',              'Industry',    'Color',    'Status',               'Notes'],
      ['Unique name',   'contact@client.com', '+91 98765 43210', 'Company Ltd',   'https://company.com',  'Technology',  '#6366f1',  'active|inactive|lead', 'Optional'],
      ['Acme Corp',     'hello@acme.com',     '',                'Acme Corp Ltd', 'https://acme.com',     'Technology',  '#6366f1',  'active',               ''],
      ['Globex Inc',    'info@globex.com',    '+1 555 0100',     'Globex',        '',                     'Finance',     '#0d9488',  'active',               'Key account'],
    ]
    const clientsWs = XLSX.utils.aoa_to_sheet(clientsData)
    clientsWs['!cols'] = [{ wch: 20 }, { wch: 24 }, { wch: 18 }, { wch: 18 }, { wch: 26 }, { wch: 16 }, { wch: 10 }, { wch: 20 }, { wch: 30 }]
    XLSX.utils.book_append_sheet(wb, clientsWs, '🏢 Clients')

    // ── PROJECTS ────────────────────────────────────────────────
    const projectsData = [
      ['Project Name *',    'Color',     'Status',                      'Due Date',   'Owner Email',       'Client Name',  'Budget (₹)', 'Hours Budget', 'Description'],
      ['Unique name',       '#hex',      'active | on_hold | completed', 'YYYY-MM-DD', 'owner@company.com', 'Must match client', 'Optional', 'Optional', 'Optional'],
      ['Website Redesign',  '#6366f1',  'active',                      '2025-08-31', 'alex@company.com',  'Acme Corp',    '',            '',             ''],
      ['Mobile App v2',     '#0d9488',  'active',                      '2025-10-15', 'priya@company.com', 'Globex Inc',   '50000',       '400',          'New UI refresh'],
    ]
    const projectsWs = XLSX.utils.aoa_to_sheet(projectsData)
    projectsWs['!cols'] = [{ wch: 24 }, { wch: 10 }, { wch: 22 }, { wch: 12 }, { wch: 22 }, { wch: 18 }, { wch: 13 }, { wch: 13 }, { wch: 36 }]
    XLSX.utils.book_append_sheet(wb, projectsWs, '📁 Projects')

    // ── TASKS ───────────────────────────────────────────────────
    const tasksData = [
      ['Task Title *',                'Project Name',     'Assignee Email',      'Priority',                    'Due Date',   'Status',                     'Client Name', 'Est. Hours', 'Description'],
      ['Clear action title',           'Must match exactly','Assignee email',    'none|low|medium|high|urgent', 'YYYY-MM-DD', 'todo|in_progress|completed',  'Optional',    'Number',     'Optional'],
      ['Design homepage wireframes',   'Website Redesign', 'alex@company.com',  'high',                        '2025-07-15', 'todo',                        'Acme Corp',   '8',          ''],
      ['Set up CI/CD pipeline',        'Mobile App v2',    'priya@company.com', 'high',                        '2025-07-20', 'todo',                        '',            '6',          ''],
      ['Competitor analysis',          '',                 '',                  'low',                         '',           'todo',                        '',            '',           'No project — one-time task'],
    ]
    const tasksWs = XLSX.utils.aoa_to_sheet(tasksData)
    tasksWs['!cols'] = [{ wch: 30 }, { wch: 22 }, { wch: 24 }, { wch: 20 }, { wch: 12 }, { wch: 20 }, { wch: 16 }, { wch: 12 }, { wch: 34 }]
    XLSX.utils.book_append_sheet(wb, tasksWs, '✅ Tasks')

    // ── RECURRING TASKS ─────────────────────────────────────────
    const recurringData = [
      ['Task Title *',          'Frequency *',                                           'Assignee Email',      'Priority',                    'Project Name',    'Start Date', 'Description'],
      ['Clear action title',    'daily|weekly|bi_weekly|monthly|quarterly|annual',        'Assignee email',      'none|low|medium|high|urgent', 'Must match exactly','YYYY-MM-DD', 'Optional'],
      ['Weekly team standup',   'weekly',                                                 'alex@company.com',   'medium',                      '',                '2025-07-07', ''],
      ['Monthly client report', 'monthly',                                                'priya@company.com',  'high',                        'Website Redesign', '2025-07-01', 'Send to client'],
      ['Daily backups check',   'daily',                                                  '',                   'low',                         '',                '',           ''],
    ]
    const recurringWs = XLSX.utils.aoa_to_sheet(recurringData)
    recurringWs['!cols'] = [{ wch: 28 }, { wch: 42 }, { wch: 24 }, { wch: 20 }, { wch: 22 }, { wch: 14 }, { wch: 34 }]
    XLSX.utils.book_append_sheet(wb, recurringWs, '🔁 Recurring Tasks')

    const buf: Buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="planora_import_template.xlsx"',
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: 'Could not generate template: ' + (e?.message ?? 'unknown') }, { status: 500 })
  }
}
