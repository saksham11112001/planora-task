import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse }      from 'next/server'

const ADMIN_EMAIL = 'saksham.gpt2001@gmail.com'

export async function GET() {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()

  const { data: reports, error } = await admin
    .from('issue_reports')
    .select(`
      id, message, page_url, attachments, status, created_at,
      reporter:users!reporter_id(id, name, email),
      org:organisations!org_id(id, name)
    `)
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Page-level analytics: count complaints per page path
  const pageCounts: Record<string, number> = {}
  for (const r of reports ?? []) {
    if (!r.page_url) continue
    let path = r.page_url
    try { path = new URL(r.page_url).pathname } catch {}
    pageCounts[path] = (pageCounts[path] ?? 0) + 1
  }
  const topPages = Object.entries(pageCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([path, count]) => ({ path, count }))

  return NextResponse.json({ reports: reports ?? [], topPages })
}
