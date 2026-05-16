import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse }       from 'next/server'
import type { NextRequest }   from 'next/server'
import { getApiOrgMembership } from '@/lib/supabase/apiActiveOrg'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const mb = await getApiOrgMembership(supabase, user.id, request, 'org_id, role')
  if (!mb || !['owner','admin'].includes(mb.role)) return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  const { client_categories } = await request.json()
  const admin = createAdminClient()
  await admin.from('org_settings').upsert({ org_id: mb.org_id, client_categories }, { onConflict: 'org_id' })
  return NextResponse.json({ success: true })
}
