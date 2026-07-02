import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/authUser'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse }  from 'next/server'
import type { NextRequest } from 'next/server'
import { assertCan }     from '@/lib/utils/permissionGate'
import { dbError } from '@/lib/api-error'
import { getApiOrgMembership } from '@/lib/supabase/apiActiveOrg'

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const mb = await getApiOrgMembership(supabase, user.id, request, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })
  const admin = createAdminClient()
  const orgSettingsDenied = await assertCan(admin, mb.org_id, user.id, mb.role, 'settings.org')
  if (orgSettingsDenied) return NextResponse.json({ error: orgSettingsDenied.error }, { status: orgSettingsDenied.status })
  const { name, industry, team_size, logo_color } = await request.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })
  const { data, error } = await admin.from('organisations')
    .update({ name: name.trim(), industry: industry || null, team_size: team_size || null, logo_color: logo_color || '#0d9488' })
    .eq('id', mb.org_id).select('*').single()
  if (error) return NextResponse.json(dbError(error, 'settings/organisation'), { status: 500 })
  return NextResponse.json({ data })
}
