import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/authUser'
import { createAdminClient } from '@/lib/supabase/admin'
import { getApiOrgMembership } from '@/lib/supabase/apiActiveOrg'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, req, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'No membership' }, { status: 403 })

  const admin = createAdminClient()

  const sp = req.nextUrl.searchParams
  const clientId = sp.get('client_id')

  // The client join is additive — '*' still returns every column the
  // per-client section already reads, and that view simply ignores the extra
  // key. The org-wide list needs the name to be useful at all.
  let q = admin.from('client_notices')
    .select('*, clients!client_notices_client_id_fkey(id, name)')
    .eq('org_id', mb.org_id)
    .order('response_due', { ascending: true, nullsFirst: false })

  if (clientId) q = q.eq('client_id', clientId)
  if (sp.get('assigned_to')) q = q.eq('assigned_to', sp.get('assigned_to')!)

  // Cap the org-wide read. PostgREST silently truncates at 1000 rows anyway,
  // so being explicit makes the ceiling visible rather than surprising.
  const { data, error } = await q.limit(1000)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, req, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'No membership' }, { status: 403 })
  if (!['owner', 'admin', 'manager'].includes(mb.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const body = await req.json()
  const { data, error } = await admin.from('client_notices').insert({ ...body, org_id: mb.org_id, created_by: user.id }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
