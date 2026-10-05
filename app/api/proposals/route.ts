import { createClient }        from '@/lib/supabase/server'
import { getAuthUser }         from '@/lib/supabase/authUser'
import { createAdminClient }   from '@/lib/supabase/admin'
import { NextResponse }        from 'next/server'
import type { NextRequest }    from 'next/server'
import { canDo }               from '@/lib/utils/permissionGate'
import { getApiOrgMembership } from '@/lib/supabase/apiActiveOrg'
import { dbError }             from '@/lib/api-error'
import { priceProposal }       from '@/lib/crm'

const SELECT = `
  id, org_id, lead_id, client_id, number, title, status, items,
  subtotal, tax_rate, tax_amount, total, valid_until, sent_at, created_at
`

/** GET — proposals for the org, newest first. */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, request, 'org_id, role')
  if (!mb) return NextResponse.json({ data: [] })

  const admin = createAdminClient()
  if (!await canDo(admin, mb.org_id, user.id, mb.role, 'proposals.view')) {
    return NextResponse.json({ data: [] })
  }

  const sp = request.nextUrl.searchParams
  let q = admin.from('proposals').select(SELECT).eq('org_id', mb.org_id)
  if (sp.get('lead_id'))   q = q.eq('lead_id', sp.get('lead_id')!)
  if (sp.get('client_id')) q = q.eq('client_id', sp.get('client_id')!)

  const { data, error } = await q.order('created_at', { ascending: false }).limit(500)
  if (error) return NextResponse.json(dbError(error, 'proposals:list'), { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

/**
 * POST — create a proposal against a lead or an existing client.
 *
 * Totals are computed here and STORED. They are never recomputed on read: a
 * sent quotation is a statement of a number on a date, and re-deriving it
 * later from a changed tax rate would silently rewrite what the client was
 * told.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, request, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })

  const admin = createAdminClient()
  if (!await canDo(admin, mb.org_id, user.id, mb.role, 'proposals.manage')) {
    return NextResponse.json({ error: 'Not allowed to create proposals' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const title = String(body.title ?? '').trim()
  if (!title) return NextResponse.json({ error: 'Title required' }, { status: 400 })

  const leadId   = body.lead_id   ? String(body.lead_id)   : null
  const clientId = body.client_id ? String(body.client_id) : null

  // The table has a CHECK for this too; rejecting here gives a readable
  // message instead of a constraint violation.
  if (!leadId === !clientId) {
    return NextResponse.json({ error: 'Provide exactly one of lead_id or client_id' }, { status: 400 })
  }

  // Whichever one is given must belong to this org.
  if (leadId) {
    const { data: l } = await admin.from('leads').select('id').eq('id', leadId).eq('org_id', mb.org_id).maybeSingle()
    if (!l) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  } else {
    const { data: c } = await admin.from('clients').select('id').eq('id', clientId!).eq('org_id', mb.org_id).maybeSingle()
    if (!c) return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  const priced = priceProposal(body.items, body.tax_rate)

  // Reference number. Generated per org from the current count, and retried
  // once if two requests land on the same number — the unique index on
  // (org_id, number) is what makes that detectable rather than silent.
  const { count } = await admin.from('proposals')
    .select('id', { count: 'exact', head: true }).eq('org_id', mb.org_id)

  const year = new Date().getUTCFullYear()
  const base = {
    org_id:     mb.org_id,
    lead_id:    leadId,
    client_id:  clientId,
    title:      title.slice(0, 200),
    status:     'draft',
    items:      priced.items,
    subtotal:   priced.subtotal,
    tax_rate:   priced.taxRate,
    tax_amount: priced.taxAmount,
    total:      priced.total,
    valid_until: body.valid_until ? String(body.valid_until) : null,
    notes:      body.notes ? String(body.notes).slice(0, 5000) : null,
    created_by: user.id,
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    const n = (count ?? 0) + 1 + attempt
    const number = `Q-${year}-${String(n).padStart(4, '0')}`
    const { data, error } = await admin.from('proposals')
      .insert({ ...base, number }).select(SELECT).maybeSingle()

    if (!error) return NextResponse.json({ data }, { status: 201 })
    // 23505 = unique violation. Anything else is a real failure.
    if (error.code !== '23505') {
      return NextResponse.json(dbError(error, 'proposals:create'), { status: 500 })
    }
  }

  return NextResponse.json(
    { error: 'Could not allocate a proposal number, please try again' },
    { status: 409 },
  )
}
