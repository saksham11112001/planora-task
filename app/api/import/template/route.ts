import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()

    // ── README ──────────────────────────────────────────────────
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Planora Bulk Import Template — v3'],
      ['Upload at: Sidebar → Import data'],
      [],
      ['Sheet',               'What to fill in'],
      ['👥 Team Members',    'Invite teammates — Name, Email, Role'],
      ['🏢 Clients',         'Create clients — Name, Email, Company, Color'],
      ['📁 Projects',        'Create projects — Name, Color, Owner, Client'],
      ['✅ Tasks',           'Create tasks — Title, Project, Assignee, Priority'],
      ['📥 One-Time Tasks',  'Tasks with no project — Title, Assignee, Client'],
      ['🔁 Recurring Tasks', 'Title, Frequency, Assignee, Project'],
      [],
      ['Rules'],
      ['• Do NOT rename or reorder column headers'],
      ['• Dates: YYYY-MM-DD format  e.g. 2025-06-30'],
      ['• Project Name in Tasks must match exactly a name in the Projects sheet'],
      ['• Priority: none | low | medium | high | urgent'],
      ['• Role: manager | member | viewer'],
      ['• Frequency: daily | weekly | bi_weekly | monthly | quarterly | annual'],
      ['• All sheets are optional — leave any sheet blank if not needed'],
    ]), '📖 READ ME')

    // ── TEAM MEMBERS ────────────────────────────────────────────
    const mWs = XLSX.utils.aoa_to_sheet([
      ['Full Name *',          'Email *',            'Role *',                   'Notes'],
      ["Person's display name",'Work email address', 'manager|member|viewer',    'Optional — not imported'],
      ['Alex Johnson',         'alex@yourcompany.com','manager',                 ''],
      ['Priya Sharma',         'priya@yourcompany.com','member',                 ''],
      ['Carlos Ruiz',          'carlos@yourcompany.com','member',                ''],
    ])
    mWs['!cols'] = [{ wch: 24 }, { wch: 28 }, { wch: 16 }, { wch: 36 }]
    XLSX.utils.book_append_sheet(wb, mWs, '👥 Team Members')

    // ── CLIENTS ─────────────────────────────────────────────────
    const cWs = XLSX.utils.aoa_to_sheet([
      ['Client Name *','Email',             'Phone',          'Company',      'Website',           'Industry',  'Color',   'Status',             'Notes'],
      ['Unique name',  'contact@client.com','+91 9876543210', 'Company Ltd',  'https://company.com','Technology','#6366f1','active|inactive|lead','Optional'],
      ['Acme Corp',    'hello@acme.com',    '',               'Acme Corp Ltd','https://acme.com',   'Technology','#6366f1','active',              ''],
      ['Globex Inc',   'info@globex.com',   '+1 555 0100',    'Globex',       '',                   'Finance',   '#0d9488','active',              'Key account'],
    ])
    cWs['!cols'] = [{ wch: 18 }, { wch: 24 }, { wch: 16 }, { wch: 18 }, { wch: 24 }, { wch: 14 }, { wch: 10 }, { wch: 18 }, { wch: 28 }]
    XLSX.utils.book_append_sheet(wb, cWs, '🏢 Clients')

    // ── PROJECTS ────────────────────────────────────────────────
    const pWs = XLSX.utils.aoa_to_sheet([
      ['Project Name *',   'Color',   'Status',                      'Due Date',  'Owner Email',        'Client Name',      'Budget','Hours Budget','Description'],
      ['Unique name',      '#hex',    'active|on_hold|completed',    'YYYY-MM-DD','owner@yourcompany.com','Must match client','Opt.',  'Opt.',        'Optional'],
      ['Website Redesign', '#6366f1', 'active',                      '2025-08-31','alex@yourcompany.com','Acme Corp',        '',      '',             ''],
      ['Mobile App v2',    '#0d9488', 'active',                      '2025-10-15','priya@yourcompany.com','Globex Inc',      '50000', '400',          'New UI'],
    ])
    pWs['!cols'] = [{ wch: 22 }, { wch: 10 }, { wch: 20 }, { wch: 12 }, { wch: 24 }, { wch: 16 }, { wch: 8 }, { wch: 12 }, { wch: 32 }]
    XLSX.utils.book_append_sheet(wb, pWs, '📁 Projects')

    // ── TASKS ───────────────────────────────────────────────────
    const tWs = XLSX.utils.aoa_to_sheet([
      ['Task Title *',              'Project Name',    'Assignee Email',       'Priority',                   'Due Date',  'Status',                    'Client Name','Est. Hours','Description'],
      ['Clear action title',        'Must match exactly','Assignee email',     'none|low|medium|high|urgent','YYYY-MM-DD','todo|in_progress|completed', 'Optional',  'Number',    'Optional'],
      ['Design homepage wireframes','Website Redesign','alex@yourcompany.com', 'high',                       '2025-07-15','todo',                      'Acme Corp',  '8',         ''],
      ['Set up CI/CD pipeline',     'Mobile App v2',  'priya@yourcompany.com','high',                       '2025-07-20','todo',                      '',           '6',         ''],
    ])
    tWs['!cols'] = [{ wch: 30 }, { wch: 20 }, { wch: 24 }, { wch: 20 }, { wch: 12 }, { wch: 20 }, { wch: 14 }, { wch: 11 }, { wch: 32 }]
    XLSX.utils.book_append_sheet(wb, tWs, '✅ Tasks')

    // ── ONE-TIME TASKS ───────────────────────────────────────────
    const otWs = XLSX.utils.aoa_to_sheet([
      ['Task Title *',          'Assignee Email',       'Priority',                   'Due Date',  'Client Name','Est. Hours','Description'],
      ['Clear action title',    'Assignee email',       'none|low|medium|high|urgent','YYYY-MM-DD','Optional',  'Number',    'Optional'],
      ['Review Q3 proposals',   'alex@yourcompany.com', 'high',                       '2025-07-10','Acme Corp',  '2',         ''],
      ['Update contractor list','',                     'medium',                     '',          '',           '',          'No client needed'],
      ['Renew domain names',    'priya@yourcompany.com','urgent',                     '2025-07-01','',           '1',         ''],
    ])
    otWs['!cols'] = [{ wch: 30 }, { wch: 24 }, { wch: 20 }, { wch: 12 }, { wch: 16 }, { wch: 11 }, { wch: 34 }]
    XLSX.utils.book_append_sheet(wb, otWs, '📥 One-Time Tasks')

    // ── RECURRING TASKS ─────────────────────────────────────────
    const rWs = XLSX.utils.aoa_to_sheet([
      ['Task Title *',         'Frequency *',                                     'Assignee Email',       'Priority',                   'Project Name',    'Start Date','Description'],
      ['Clear action title',   'daily|weekly|bi_weekly|monthly|quarterly|annual', 'Assignee email',       'none|low|medium|high|urgent','Must match exactly','YYYY-MM-DD','Optional'],
      ['Weekly team standup',  'weekly',                                          'alex@yourcompany.com', 'medium',                     '',                '2025-07-07',''],
      ['Monthly client report','monthly',                                         'priya@yourcompany.com','high',                       'Website Redesign', '2025-07-01','Send to client'],
      ['Daily backup check',   'daily',                                           '',                     'low',                        '',                '',          ''],
    ])
    rWs['!cols'] = [{ wch: 26 }, { wch: 42 }, { wch: 24 }, { wch: 20 }, { wch: 20 }, { wch: 12 }, { wch: 32 }]
    XLSX.utils.book_append_sheet(wb, rWs, '🔁 Recurring Tasks')

    const buf: Buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="planora_import_template.xlsx"',
        // no-store: never cache — always generate fresh so users always get latest version
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
      },
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: 'Could not generate template: ' + (e?.message ?? 'unknown') },
      { status: 500 }
    )
  }
}
