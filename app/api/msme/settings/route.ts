import { NextRequest, NextResponse } from 'next/server'
import { createClient }             from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/authUser'
import { createAdminClient }        from '@/lib/supabase/admin'
import { getApiOrgMembership }      from '@/lib/supabase/apiActiveOrg'
import { DEFAULT_EMAIL_SCHEDULE }   from '@/lib/msme/emailSchedule'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
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

  const [{ data: ccRow }, { data: contactRow }] = await Promise.all([
    admin.from('org_feature_settings').select('config').eq('org_id', mb.org_id).eq('feature_key', 'msme_cc_email').maybeSingle(),
    admin.from('org_feature_settings').select('config').eq('org_id', mb.org_id).eq('feature_key', 'msme_contact_person').maybeSingle(),
  ])

  const cc_email: string | null = (ccRow?.config as { email?: string } | null)?.email ?? null
  const contact_person = (contactRow?.config as { name?: string; email?: string; phone?: string } | null) ?? null

  return NextResponse.json({ schedule, pack, cc_email, contact_person })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, req, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'Not a member' }, { status: 403 })
  if (!['owner', 'admin'].includes(mb.role)) {
    return NextResponse.json({ error: 'Only owner or admin can change email schedule' }, { status: 403 })
  }

  const body = await req.json()
  const { schedule, cc_email, contact_person } = body as {
    schedule?: number[]
    cc_email?: string | null
    contact_person?: { name: string; email: string; phone?: string } | null
  }

  const admin = createAdminClient()

  if (schedule !== undefined) {
    if (!Array.isArray(schedule) || schedule.length < 1 || schedule.length > 4) {
      return NextResponse.json({ error: 'Schedule must be an array of 1–4 day intervals (for 2–5 emails)' }, { status: 400 })
    }
    if (schedule.some(d => !Number.isInteger(d) || d < 1 || d > 365)) {
      return NextResponse.json({ error: 'Each interval must be a whole number of days between 1 and 365' }, { status: 400 })
    }
    const { error } = await admin
      .from('org_feature_settings')
      .upsert(
        { org_id: mb.org_id, feature_key: 'msme_email_schedule', is_enabled: true, config: { days: schedule } },
        { onConflict: 'org_id,feature_key' }
      )
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (cc_email !== undefined) {
    if (cc_email !== null && cc_email !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cc_email)) {
      return NextResponse.json({ error: 'Invalid CC email address' }, { status: 400 })
    }
    const { error } = await admin
      .from('org_feature_settings')
      .upsert(
        { org_id: mb.org_id, feature_key: 'msme_cc_email', is_enabled: true, config: { email: cc_email ?? '' } },
        { onConflict: 'org_id,feature_key' }
      )
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (contact_person !== undefined) {
    if (contact_person !== null) {
      if (!contact_person.name?.trim()) return NextResponse.json({ error: 'Contact name is required' }, { status: 400 })
      if (!contact_person.email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact_person.email))
        return NextResponse.json({ error: 'Valid contact email is required' }, { status: 400 })
    }
    const { error } = await admin
      .from('org_feature_settings')
      .upsert(
        { org_id: mb.org_id, feature_key: 'msme_contact_person', is_enabled: true, config: contact_person ?? {} },
        { onConflict: 'org_id,feature_key' }
      )
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
