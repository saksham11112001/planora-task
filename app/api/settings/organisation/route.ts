import { createClient } from '@/lib/supabase/server'
import { NextResponse }  from 'next/server'
import type { NextRequest } from 'next/server'
import { assertCan }     from '@/lib/utils/permissionGate'
import { dbError } from '@/lib/api-error'

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { data: mb } = await supabase.from('org_members').select('org_id, role').eq('user_id', user.id).eq('is_active', true).single()
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })
  const orgSettingsDenied = await assertCan(supabase, mb.org_id, mb.role, 'settings.org')
  if (orgSettingsDenied) return NextResponse.json({ error: orgSettingsDenied.error }, { status: orgSettingsDenied.status })
  const { name, industry, team_size, logo_color } = await request.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })
  const { data, error } = await supabase.from('organisations')
    .update({ name: name.trim(), industry: industry || null, team_size: team_size || null, logo_color: logo_color || '#0d9488' })
    .eq('id', mb.org_id).select('*').single()
  if (error) return NextResponse.json(dbError(error, 'settings/organisation'), { status: 500 })
  return NextResponse.json({ data })
}
