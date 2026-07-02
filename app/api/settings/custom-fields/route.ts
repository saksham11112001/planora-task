import { createClient }      from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/authUser'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse }       from 'next/server'
import type { NextRequest }   from 'next/server'
import { getApiOrgMembership } from '@/lib/supabase/apiActiveOrg'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ data: [] })
  const mb = await getApiOrgMembership(supabase, user.id, request, 'org_id')
  if (!mb) return NextResponse.json({ data: [] })
  const admin = createAdminClient()
  const { data: s } = await admin.from('org_settings').select('custom_task_fields').eq('org_id', mb.org_id).maybeSingle()
  return NextResponse.json({ data: s?.custom_task_fields ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const mb = await getApiOrgMembership(supabase, user.id, request, 'org_id, role')
  if (!mb || !['owner','admin'].includes(mb.role)) return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  const { custom_task_fields } = await request.json()
  const admin = createAdminClient()
  await admin.from('org_settings').upsert({ org_id: mb.org_id, custom_task_fields }, { onConflict: 'org_id' })
  return NextResponse.json({ success: true })
}
