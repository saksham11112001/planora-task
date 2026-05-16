import { NextResponse }      from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { NextRequest }  from 'next/server'
import { getApiOrgMembership } from '@/lib/supabase/apiActiveOrg'

const FEATURE_KEY = 'compliance_overrides'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, request, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })

  const { data } = await supabase
    .from('org_feature_settings')
    .select('config')
    .eq('org_id', mb.org_id)
    .eq('feature_key', FEATURE_KEY)
    .maybeSingle()

  return NextResponse.json({ data: (data?.config as any)?.overrides ?? {} })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, req, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })
  if (!['owner', 'admin', 'manager'].includes(mb.role))
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 })

  const body = await req.json()
  const overrides = body.overrides ?? {}

  const admin = createAdminClient()
  await admin.from('org_feature_settings').upsert(
    { org_id: mb.org_id, feature_key: FEATURE_KEY, is_enabled: true, config: { overrides } },
    { onConflict: 'org_id,feature_key' }
  )

  return NextResponse.json({ success: true })
}
