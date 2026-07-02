import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/authUser'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse }  from 'next/server'
import type { NextRequest } from 'next/server'
import { getApiOrgMembership } from '@/lib/supabase/apiActiveOrg'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, req, 'org_id')
  if (!mb) return NextResponse.json({ data: [] })

  const sp = req.nextUrl.searchParams
  const client_id = sp.get('client_id')

  const admin = createAdminClient()
  let q = admin.from('tasks')
    .select('id, title, billable_amount, due_date, client_id, status, client:clients(id, name, color)')
    .eq('org_id', mb.org_id)
    .eq('is_billable', true)
    .neq('is_archived', true)
    .order('due_date', { ascending: false })
    .limit(200)

  if (client_id) q = q.eq('client_id', client_id)
  // Only filter by status if explicitly requested
  const status = sp.get('status')
  if (status) q = q.eq('status', status)

  const { data, error } = await q
  if (error) return NextResponse.json({ data: [] })
  return NextResponse.json({ data })
}
