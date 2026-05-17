import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse }       from 'next/server'
import type { NextRequest }   from 'next/server'
import { getApiOrgMembership } from '@/lib/supabase/apiActiveOrg'

function isPaid(planTier: string, status: string, trialEndsAt: string | null): boolean {
  if (status === 'trialing' && trialEndsAt && new Date(trialEndsAt) > new Date()) return true
  return ['starter', 'pro', 'business'].includes(planTier)
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: null })
  const mb = await getApiOrgMembership(supabase, user.id, request, 'org_id')
  if (!mb) return NextResponse.json({ data: null })
  const admin = createAdminClient()

  // Fetch both the org-wide role grid and the current user's personal overrides in parallel
  const [{ data: s }, { data: m }] = await Promise.all([
    admin.from('org_settings').select('role_permissions').eq('org_id', mb.org_id).maybeSingle(),
    admin.from('org_members').select('permissions').eq('org_id', mb.org_id).eq('user_id', user.id).maybeSingle(),
  ])

  return NextResponse.json({
    data: {
      role_permissions:  s?.role_permissions  ?? null,
      user_permissions:  m?.permissions       ?? null,
    },
  })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, request, 'org_id, role, organisations(plan_tier, status, trial_ends_at)')

  if (!mb || !['owner', 'admin'].includes(mb.role))
    return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const org = mb.organisations as any
  if (!isPaid(org?.plan_tier ?? '', org?.status ?? '', org?.trial_ends_at ?? null))
    return NextResponse.json({ error: 'Role permissions require a paid plan' }, { status: 402 })

  const { role_permissions } = await request.json()
  const admin = createAdminClient()
  await admin.from('org_settings').upsert(
    { org_id: mb.org_id, role_permissions },
    { onConflict: 'org_id' }
  )
  return NextResponse.json({ success: true })
}
