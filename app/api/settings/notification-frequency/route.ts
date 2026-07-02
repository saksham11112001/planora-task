import { createClient }   from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/authUser'
import { NextResponse }    from 'next/server'
import type { NextRequest } from 'next/server'
import { dbError } from '@/lib/api-error'
import { getApiOrgMembership } from '@/lib/supabase/apiActiveOrg'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, request, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })

  const { data } = await supabase
    .from('org_feature_settings')
    .select('config')
    .eq('org_id', mb.org_id)
    .eq('feature_key', 'notification_frequency')
    .maybeSingle()

  const config = (data?.config as any) ?? { mode: 'digest' }
  return NextResponse.json({ config })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, request, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })

  // Only owner/admin can change org-wide notification frequency
  if (!['owner', 'admin'].includes(mb.role))
    return NextResponse.json({ error: 'Only owner or admin can change notification frequency' }, { status: 403 })

  const body = await request.json()
  const mode = body.mode === 'digest' ? 'digest' : 'immediate'

  const { error } = await supabase
    .from('org_feature_settings')
    .upsert({
      org_id:      mb.org_id,
      feature_key: 'notification_frequency',
      is_enabled:  true,
      config:      { mode },
    }, { onConflict: 'org_id,feature_key' })

  if (error) return NextResponse.json(dbError(error, 'settings/notification-frequency'), { status: 500 })
  return NextResponse.json({ mode })
}
