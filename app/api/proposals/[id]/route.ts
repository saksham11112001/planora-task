import { createClient }        from '@/lib/supabase/server'
import { getAuthUser }         from '@/lib/supabase/authUser'
import { createAdminClient }   from '@/lib/supabase/admin'
import { NextResponse }        from 'next/server'
import type { NextRequest }    from 'next/server'
import { canDo }               from '@/lib/utils/permissionGate'
import { getApiOrgMembership } from '@/lib/supabase/apiActiveOrg'
import { dbError }             from '@/lib/api-error'
import { priceProposal, isProposalStatus } from '@/lib/crm'

const SELECT = `
  id, org_id, lead_id, client_id, number, title, status, items,
  subtotal, tax_rate, tax_amount, total, valid_until, sent_at, created_at
`

/**
 * PATCH — edit a proposal, or move its status.
 *
 * Content (title, items, tax, validity) can only be edited while the
 * proposal is a DRAFT. Once it has been sent, the document is a record of
 * what the client was shown; changing its figures afterwards would make the
 * stored total disagree with the quotation in their inbox. After sending,
 * only the status moves.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, request, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })

  const admin = createAdminClient()
  if (!await canDo(admin, mb.org_id, user.id, mb.role, 'proposals.manage')) {
    return NextResponse.json({ error: 'Not allowed to edit proposals' }, { status: 403 })
  }

  const { data: existing } = await admin.from('proposals')
    .select(SELECT).eq('id', id).eq('org_id', mb.org_id).maybeSingle()
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const now = new Date().toISOString()
  const patch: Record<string, unknown> = { updated_at: now }

  const isDraft = existing.status === 'draft'
  const wantsContentEdit =
    'title' in body || 'items' in body || 'tax_rate' in body || 'valid_until' in body || 'notes' in body

  if (wantsContentEdit) {
    if (!isDraft) {
      return NextResponse.json(
        { error: 'This proposal has already been sent. Only its status can change now.' },
        { status: 409 },
      )
    }
    if (typeof body.title === 'string' && body.title.trim()) patch.title = body.title.trim().slice(0, 200)
    if ('valid_until' in body) patch.valid_until = body.valid_until ? String(body.valid_until) : null
    if ('notes' in body)       patch.notes       = body.notes ? String(body.notes).slice(0, 5000) : null

    if ('items' in body || 'tax_rate' in body) {
      // Reprice the whole document from the incoming items, so a partial
      // edit can never leave the stored total disagreeing with the lines.
      const priced = priceProposal(
        'items'    in body ? body.items    : existing.items,
        'tax_rate' in body ? body.tax_rate : existing.tax_rate,
      )
      patch.items      = priced.items
      patch.subtotal   = priced.subtotal
      patch.tax_rate   = priced.taxRate
      patch.tax_amount = priced.taxAmount
      patch.total      = priced.total
    }
  }

  if ('status' in body) {
    if (!isProposalStatus(body.status)) {
      return NextResponse.json({ error: 'Unknown status' }, { status: 400 })
    }
    patch.status = body.status
    // Stamp the moments that matter, once each.
    if (body.status === 'sent' && !existing.sent_at) patch.sent_at = now
    if (body.status === 'accepted' || body.status === 'rejected') patch.decided_at = now
  }

  const { data, error } = await admin.from('proposals')
    .update(patch).eq('id', id).eq('org_id', mb.org_id)
    .select(SELECT).maybeSingle()

  if (error) return NextResponse.json(dbError(error, 'proposals:update'), { status: 500 })
  return NextResponse.json({ data })
}

/** DELETE — requires 'proposals.manage'. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, request, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })

  const admin = createAdminClient()
  if (!await canDo(admin, mb.org_id, user.id, mb.role, 'proposals.manage')) {
    return NextResponse.json({ error: 'Not allowed to delete proposals' }, { status: 403 })
  }

  const { error } = await admin.from('proposals').delete().eq('id', id).eq('org_id', mb.org_id)
  if (error) return NextResponse.json(dbError(error, 'proposals:delete'), { status: 500 })
  return new NextResponse(null, { status: 204 })
}
