import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse }       from 'next/server'
import type { NextRequest }   from 'next/server'
import { assertCan }          from '@/lib/utils/permissionGate'
import { getApiOrgMembership } from '@/lib/supabase/apiActiveOrg'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const mb = await getApiOrgMembership(supabase, user.id, request, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })
  const taskSettingsDenied = await assertCan(supabase, mb.org_id, mb.role, 'settings.tasks')
  if (taskSettingsDenied) return NextResponse.json({ error: taskSettingsDenied.error }, { status: taskSettingsDenied.status })
  const { task_fields } = await request.json()
  const admin = createAdminClient()
  await admin.from('org_settings').upsert({ org_id: mb.org_id, task_fields }, { onConflict: 'org_id' })
  return NextResponse.json({ success: true })
}
