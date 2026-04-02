import { NextResponse } from 'next/server'
import { createClient }  from '@/lib/supabase/server'
import { execSync }      from 'child_process'
import { join }          from 'path'

export const dynamic = 'force-dynamic'

export async function GET() {
  // Fetch real org data to personalise the template
  let payload = {
    memberEmails: ['alex@yourcompany.com', 'priya@yourcompany.com', 'sam@yourcompany.com'],
    memberNames:  ['Alex Johnson', 'Priya Sharma', 'Sam Gupta'],
    memberRoles:  ['manager', 'member', 'member'],
    clientNames:  ['Acme Corp', 'Garg Sons', 'Mehra & Co'],
    clientRows:   [
      ['Acme Corp',   'hello@acme.com',        '+91 9876543210', 'Acme Corp Ltd', 'Technology', 'active', '#6366f1'],
      ['Garg Sons',   'accounts@gargsons.com', '+91 9988776655', 'Garg Sons Ltd', 'Retail',     'active', '#ea580c'],
      ['Mehra & Co',  'info@mehraandco.com',   '',               'Mehra & Co CA', 'Finance',    'active', '#0d9488'],
    ],
    caMode: false,
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: mb } = await supabase.from('org_members')
        .select('org_id').eq('user_id', user.id).eq('is_active', true).maybeSingle()
      if (mb?.org_id) {
        const [{ data: members }, { data: clients }, { data: settings }] = await Promise.all([
          supabase.from('org_members').select('role, users(name, email)').eq('org_id', mb.org_id).eq('is_active', true),
          supabase.from('clients').select('name, email, phone_number, company, industry, status, color').eq('org_id', mb.org_id).eq('status', 'active').order('name'),
          supabase.from('org_settings').select('ca_compliance_mode').eq('org_id', mb.org_id).maybeSingle(),
        ])
        if (members?.length) {
          const valid = members.filter((m: any) => m.users?.email)
          payload.memberEmails = valid.map((m: any) => m.users.email)
          payload.memberNames  = valid.map((m: any) => m.users.name ?? m.users.email.split('@')[0])
          payload.memberRoles  = valid.map((m: any) => m.role ?? 'member')
        }
        if (clients?.length) {
          payload.clientNames = clients.map((c: any) => c.name)
          payload.clientRows  = clients.map((c: any) => [
            c.name ?? '', c.email ?? '', c.phone_number ?? '',
            c.company ?? '', c.industry ?? '', c.status ?? 'active', c.color ?? '#0d9488',
          ])
        }
        payload.caMode = (settings as any)?.ca_compliance_mode === true
      }
    }
  } catch {}

  try {
    // Call Python script which uses openpyxl — the only reliable way to get Excel dropdowns
    const scriptPath = join(process.cwd(), 'scripts', 'generate_template.py')
    const jsonArg    = JSON.stringify(payload).replace(/'/g, "\\'")
    const b64        = execSync(`python3 '${scriptPath}' '${jsonArg}'`, {
      maxBuffer: 10 * 1024 * 1024,
      timeout:   30000,
    })
    const xlsxBuf = Buffer.from(b64.toString(), 'base64')
    return new NextResponse(xlsxBuf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="planora_import_template.xlsx"',
        'Cache-Control': 'no-store, no-cache',
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: 'Template generation failed: ' + (e?.message ?? String(e)) }, { status: 500 })
  }
}
