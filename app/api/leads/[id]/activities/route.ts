import { createClient }        from '@/lib/supabase/server'
import { getAuthUser }         from '@/lib/supabase/authUser'
import { createAdminClient }   from '@/lib/supabase/admin'
import { NextResponse }        from 'next/server'
import type { NextRequest }    from 'next/server'
import { canDo }               from '@/lib/utils/permissionGate'
import { getApiOrgMembership } from '@/lib/supabase/apiActiveOrg'
import { dbError }             from '@/lib/api-error'
import { ACTIVITY_KINDS }      from '@/lib/crm'

const SELECT = 'id, lead_id, kind, body, created_by, created_at'

/** Confirm the lead is in this org and the caller may see it. */
async function reachable(
  admin: ReturnType<typeof createAdminClient>,
  orgId: string, userId: string, role: string, leadId: string,
) {
  const { data: lead } = await admin.from('leads')
    .select('id, owner_id').eq('id', leadId).eq('org_id', orgId).maybeSingle()
  if (!lead) return null
  const canSeeAll = await canDo(admin, orgId, userId, role, 'leads.view_all')
  if (!canSeeAll && lead.owner_id !== userId) return null
  return lead
}

/** GET — the activity trail for one lead, newest first. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, request, 'org_id, role')
  if (!mb) return NextResponse.json({ data: [] })

  const admin = createAdminClient()
  if (!await reachable(admin, mb.org_id, user.id, mb.role, id)) {
    // Same response whether the lead is missing or simply not visible, so
    // the endpoint cannot be used to probe which lead ids exist.
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data, error } = await admin.from('lead_activities')
    .select(SELECT).eq('lead_id', id).eq('org_id', mb.org_id)
    .order('created_at', { ascending: false }).limit(200)

  if (error) return NextResponse.json(dbError(error, 'leads:activities'), { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

/** POST — log a call, email, meeting or note against a lead. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, request, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })
  if (mb.role === 'viewer') return NextResponse.json({ error: 'Viewers cannot log activity' }, { status: 403 })

  const admin = createAdminClient()
  if (!await reachable(admin, mb.org_id, user.id, mb.role, id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const text = String(body.body ?? '').trim()
  if (!text) return NextResponse.json({ error: 'Nothing to log' }, { status: 400 })

  // 'stage_change' is written by the system when a lead moves; accepting it
  // here would let a user forge pipeline history.
  const requested = String(body.kind ?? 'note')
  const kind = (ACTIVITY_KINDS as readonly string[]).includes(requested) && requested !== 'stage_change'
    ? requested
    : 'note'

  const { data, error } = await admin.from('lead_activities').insert({
    org_id:     mb.org_id,
    lead_id:    id,
    kind,
    body:       text.slice(0, 5000),
    created_by: user.id,
  }).select(SELECT).maybeSingle()

  if (error) return NextResponse.json(dbError(error, 'leads:activity:create'), { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
