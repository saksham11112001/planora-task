import { createClient }      from '@/lib/supabase/server'
import { createAdminClient }  from '@/lib/supabase/admin'
import { NextResponse }       from 'next/server'
import type { NextRequest }   from 'next/server'
import { getApiOrgMembership } from '@/lib/supabase/apiActiveOrg'
import { todayStr }            from '@/lib/utils/format'

/** Returns a map of clientId → number of at-risk tasks (due ≤7 days, status = todo) */
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: {} })

  const mb = await getApiOrgMembership(supabase, user.id, req, 'org_id, role')
  if (!mb) return NextResponse.json({ data: {} })

  const admin   = createAdminClient()
  const today   = todayStr()
  const in7days = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]

  const { data: tasks } = await admin.from('tasks')
    .select('client_id')
    .eq('org_id', mb.org_id)
    .eq('status', 'todo')
    .neq('is_archived', true)
    .not('client_id', 'is', null)
    .gte('due_date', today)
    .lte('due_date', in7days)

  const counts: Record<string, number> = {}
  for (const t of tasks ?? []) {
    if (t.client_id) counts[t.client_id] = (counts[t.client_id] ?? 0) + 1
  }

  return NextResponse.json({ data: counts })
}
