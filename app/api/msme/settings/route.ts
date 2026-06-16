import { NextRequest, NextResponse } from 'next/server'
import { createClient }             from '@/lib/supabase/server'
import { createAdminClient }        from '@/lib/supabase/admin'
import { getApiOrgMembership }      from '@/lib/supabase/apiActiveOrg'

// Default: 5 emails total, at day 0 (immediate), 7, 14, 21, 30
export const DEFAULT_EMAIL_SCHEDULE = [7, 14, 21, 30]  // gaps between emails 1→2, 2→3, 3→4, 4→5

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, req, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'Not a member' }, { status: 403 })
  if (!['owner', 'admin', 'manager'].includes(mb.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data } = await admin
    .from('org_feature_settings')
    .select('config')
    .eq('org_id', mb.org_id)
    .eq('feature_key', 'msme_email_schedule')
    .maybeSingle()

  const schedule = (data?.config?.days as number[] | undefined) ?? DEFAULT_EMAIL_SCHEDULE

  const { data: packRow } = await admin
    .from('org_feature_settings')
    .select('config')
    .eq('org_id', mb.org_id)
    .eq('feature_key', 'msme_pack')
    .maybeSingle()

  const pack = (packRow?.config as { tier: string; vendor_limit: number } | null) ?? { tier: 'free', vendor_limit: 5 }

  return NextResponse.json({ schedule, pack })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, req, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'Not a member' }, { status: 403 })
  if (!['owner', 'admin'].includes(mb.role)) {
    return NextResponse.json({ error: 'Only owner or admin can change email schedule' }, { status: 403 })
  }

  const body = await req.json()
  const { schedule } = body as { schedule: number[] }

  if (!Array.isArray(schedule) || schedule.length < 1 || schedule.length > 4) {
    return NextResponse.json({ error: 'Schedule must be an array of 1–4 day intervals (for 2–5 emails)' }, { status: 400 })
  }
  if (schedule.some(d => !Number.isInteger(d) || d < 1 || d > 365)) {
    return NextResponse.json({ error: 'Each interval must be a whole number of days between 1 and 365' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('org_feature_settings')
    .upsert(
      { org_id: mb.org_id, feature_key: 'msme_email_schedule', is_enabled: true, config: { days: schedule } },
      { onConflict: 'org_id,feature_key' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, schedule })
}
