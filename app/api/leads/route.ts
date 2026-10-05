import { createClient }        from '@/lib/supabase/server'
import { getAuthUser }         from '@/lib/supabase/authUser'
import { createAdminClient }   from '@/lib/supabase/admin'
import { NextResponse }        from 'next/server'
import type { NextRequest }    from 'next/server'
import { canDo }               from '@/lib/utils/permissionGate'
import { getApiOrgMembership } from '@/lib/supabase/apiActiveOrg'
import { dbError }             from '@/lib/api-error'
import { isLeadStage }         from '@/lib/crm'

const SELECT = `
  id, org_id, name, company, email, phone, source, stage, value,
  expected_close, owner_id, notes, converted_client_id, converted_at,
  lost_reason, created_at
`

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * GET — leads for the org.
 *
 * Without 'leads.view_all' a member sees only the leads they own, which is
 * how the rest of the app scopes (time logs, attendance, tasks). Owners and
 * admins bypass inside canDo.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, request, 'org_id, role')
  if (!mb) return NextResponse.json({ data: [] })

  const admin = createAdminClient()
  const canSeeAll = await canDo(admin, mb.org_id, user.id, mb.role, 'leads.view_all')

  const sp = request.nextUrl.searchParams
  let q = admin.from('leads').select(SELECT).eq('org_id', mb.org_id)

  if (!canSeeAll) q = q.eq('owner_id', user.id)
  else if (sp.get('owner_id')) q = q.eq('owner_id', sp.get('owner_id')!)

  if (isLeadStage(sp.get('stage'))) q = q.eq('stage', sp.get('stage')!)

  const { data, error } = await q.order('created_at', { ascending: false }).limit(1000)
  if (error) return NextResponse.json(dbError(error, 'leads:list'), { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

/** POST — create a lead. Requires 'leads.create'. */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, request, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })

  const admin = createAdminClient()
  if (!await canDo(admin, mb.org_id, user.id, mb.role, 'leads.create')) {
    return NextResponse.json({ error: 'Not allowed to create leads' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const name = String(body.name ?? '').trim()
  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 })
  if (name.length > 200) return NextResponse.json({ error: 'Name too long (max 200)' }, { status: 400 })

  const email = body.email ? String(body.email).trim() : ''
  if (email && !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
  }

  const value = Number(body.value)

  // An owner, if given, must be a member of THIS org — otherwise a lead
  // could be assigned to any user id in the system.
  let ownerId: string | null = body.owner_id ? String(body.owner_id) : null
  if (ownerId) {
    const { data: om } = await admin.from('org_members')
      .select('user_id').eq('org_id', mb.org_id).eq('user_id', ownerId).maybeSingle()
    if (!om) return NextResponse.json({ error: 'Owner is not a member of this organisation' }, { status: 400 })
  } else {
    // Unowned leads are the ones that go cold. Default to the creator.
    ownerId = user.id
  }

  const { data, error } = await admin.from('leads').insert({
    org_id:         mb.org_id,
    name:           name.slice(0, 200),
    company:        body.company ? String(body.company).slice(0, 200) : null,
    email:          email ? email.slice(0, 255) : null,
    phone:          body.phone  ? String(body.phone).slice(0, 50)  : null,
    source:         body.source ? String(body.source).slice(0, 100) : null,
    stage:          isLeadStage(body.stage) ? body.stage : 'new',
    value:          Number.isFinite(value) && value >= 0 ? value : null,
    expected_close: body.expected_close ? String(body.expected_close) : null,
    owner_id:       ownerId,
    notes:          body.notes ? String(body.notes).slice(0, 5000) : null,
    created_by:     user.id,
  }).select(SELECT).maybeSingle()

  if (error) return NextResponse.json(dbError(error, 'leads:create'), { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
