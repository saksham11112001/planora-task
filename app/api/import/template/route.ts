import { NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'

export async function GET() {
  // Always serve the pre-built static file from public/templates/
  // This is committed to git so it deploys with the app — no caching issues.
  try {
    const filePath = path.join(process.cwd(), 'public', 'templates', 'planora_import_template.xlsx')
    if (fs.existsSync(filePath)) {
      const buf = fs.readFileSync(filePath)
      return new NextResponse(buf, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': 'attachment; filename="planora_import_template.xlsx"',
          'Cache-Control': 'no-store',
        },
      })
    }
  } catch (e) {
    // fall through to dynamic generation below
  }

  // Fallback: generate dynamically if static file not found
  try {
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()

    const sheets = [
      { name: '📖 READ ME',       data: [['Planora Bulk Import Template'],['See other sheets to fill in data']] },
      { name: '👥 Team Members',  data: [['Full Name *','Email *','Role *','Notes'],["Person's display name",'Work email','manager|member|viewer','Optional'],['Alex Johnson','alex@yourcompany.com','manager','']] },
      { name: '🏢 Clients',       data: [['Client Name *','Email','Phone','Company','Website','Industry','Color','Status','Notes'],['Unique name','contact@client.com','+91 9876543210','Company Ltd','https://company.com','Technology','#6366f1','active|inactive|lead','Optional'],['Acme Corp','hello@acme.com','','Acme Corp Ltd','','Technology','#6366f1','active','']] },
      { name: '📁 Projects',      data: [['Project Name *','Color','Status','Due Date','Owner Email','Client Name','Budget','Hours Budget','Description'],['Unique name','#hex','active|on_hold|completed','YYYY-MM-DD','owner@yourcompany.com','Must match clients','Optional','Optional','Optional'],['Website Redesign','#6366f1','active','2025-08-31','alex@yourcompany.com','Acme Corp','','','']] },
      { name: '✅ Tasks',         data: [['Task Title *','Project Name','Assignee Email(s)','Priority','Due Date','Status','Client Name','Est. Hours','Description'],['Clear title','Must match projects','email or email1,email2 for multiple','none|low|medium|high|urgent','YYYY-MM-DD','todo|in_progress|completed','Optional','Number','Optional'],['Design wireframes','Website Redesign','alex@yourcompany.com','high','2025-07-15','todo','Acme Corp','8','']] },
      { name: '📥 One-Time Tasks',data: [['Task Title *','Assignee Email(s)','Priority','Due Date','Client Name','Est. Hours','Description'],['Clear title','email or email1,email2 for multiple assignees','none|low|medium|high|urgent','YYYY-MM-DD','Must match clients','Number','Optional'],['Review Q3 proposals','alex@yourcompany.com','high','2025-07-10','Acme Corp','2','']] },
      { name: '🔁 Recurring Tasks',data: [['Task Title *','Frequency *','Assignee Email','Priority','Project Name','Start Date','Description'],['Clear title','daily|weekly|bi_weekly|monthly|quarterly|annual','email','none|low|medium|high|urgent','Must match projects','YYYY-MM-DD','Optional'],['Weekly standup','weekly','alex@yourcompany.com','medium','','2025-07-07','']] },
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
    return NextResponse.json({ error: 'Could not generate template: ' + e?.message }, { status: 500 })
  }
}
