import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/authUser'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse }  from 'next/server'
import type { NextRequest } from 'next/server'
import { dbError } from '@/lib/api-error'
import { getApiOrgMembership } from '@/lib/supabase/apiActiveOrg'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const user = await getAuthUser(supabase)
    if (!user) return NextResponse.json({ data: {} })

    const mb = await getApiOrgMembership(supabase, user.id, request, 'org_id')
    if (!mb) return NextResponse.json({ data: {} })

    const admin = createAdminClient()
    const { data: rows, error } = await admin
      .from('org_feature_settings')
      .select('feature_key, is_enabled')
      .eq('org_id', mb.org_id)

    if (error) {
      console.error('[features GET]', error.message)
      return NextResponse.json({ data: {} })
    }

    const features: Record<string, boolean> = {}
    for (const row of rows ?? []) {
      features[row.feature_key] = row.is_enabled
    }
    return NextResponse.json({ data: features })
  } catch (e: any) {
    console.error('[features GET crash]', e?.message)
    return NextResponse.json({ data: {} })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const user = await getAuthUser(supabase)
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const mb = await getApiOrgMembership(supabase, user.id, request, 'org_id, role')

    if (!mb) return NextResponse.json({ error: 'No membership' }, { status: 403 })
    if (!['owner', 'admin'].includes(mb.role))
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })

    const body = await request.json()
    const { feature_key, is_enabled } = body

    if (!feature_key) return NextResponse.json({ error: 'feature_key required' }, { status: 400 })

    const admin = createAdminClient()

    const { error } = await admin
      .from('org_feature_settings')
      .upsert(
        { org_id: mb.org_id, feature_key, is_enabled: !!is_enabled },
        { onConflict: 'org_id,feature_key' }
      )

    if (error) {
      console.error('[features POST]', error.message, error.code)
      return NextResponse.json(dbError(error, 'settings/features'), { status: 500 })
    }

    return NextResponse.json({ success: true, feature_key, is_enabled })
  } catch (e: any) {
    console.error('[features POST crash]', e?.message)
    return NextResponse.json(dbError(e, 'settings/features'), { status: 500 })
  }
}
