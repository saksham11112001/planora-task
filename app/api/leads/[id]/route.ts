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

/**
 * PATCH — edit a lead, including moving it along the pipeline.
 *
 * A stage change also writes a lead_activities row, so the pipeline keeps a
 * story rather than only a current position.
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

  // Scope the read to this org — the service role bypasses RLS, so without
  // the filter an id from another firm would resolve.
  const { data: lead } = await admin.from('leads')
    .select(SELECT).eq('id', id).eq('org_id', mb.org_id).maybeSingle()
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Editing is allowed to anyone with 'leads.edit', and additionally to the
  // lead's own owner — a member working their own pipeline should not need
  // an org-wide edit grant.
  const mayEdit = await canDo(admin, mb.org_id, user.id, mb.role, 'leads.edit')
  if (!mayEdit && lead.owner_id !== user.id) {
    return NextResponse.json({ error: 'Not allowed to edit this lead' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  // Build the update explicitly. Spreading the body would let a caller set
  // org_id, converted_client_id or created_by.
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim().slice(0, 200)
  if ('company' in body) patch.company = body.company ? String(body.company).slice(0, 200) : null
  if ('email'   in body) patch.email   = body.email   ? String(body.email).slice(0, 255)   : null
  if ('phone'   in body) patch.phone   = body.phone   ? String(body.phone).slice(0, 50)    : null
  if ('source'  in body) patch.source  = body.source  ? String(body.source).slice(0, 100)  : null
  if ('notes'   in body) patch.notes   = body.notes   ? String(body.notes).slice(0, 5000)  : null
  if ('expected_close' in body) patch.expected_close = body.expected_close ? String(body.expected_close) : null
  if ('lost_reason'    in body) patch.lost_reason    = body.lost_reason ? String(body.lost_reason).slice(0, 500) : null

  if ('value' in body) {
    const v = Number(body.value)
    patch.value = Number.isFinite(v) && v >= 0 ? v : null
  }

  if ('owner_id' in body) {
    const ownerId = body.owner_id ? String(body.owner_id) : null
    if (ownerId) {
      const { data: om } = await admin.from('org_members')
        .select('user_id').eq('org_id', mb.org_id).eq('user_id', ownerId).maybeSingle()
      if (!om) return NextResponse.json({ error: 'Owner is not a member of this organisation' }, { status: 400 })
    }
    patch.owner_id = ownerId
  }

  const stageChanged = isLeadStage(body.stage) && body.stage !== lead.stage
  if (isLeadStage(body.stage)) {
    // A converted lead is a client now; dragging it back into the pipeline
    // would leave two records describing the same relationship.
    if (lead.converted_client_id && body.stage !== 'won') {
      return NextResponse.json(
        { error: 'This lead has been converted to a client and cannot be moved back' },
        { status: 409 },
      )
    }
    patch.stage = body.stage
  }

  const { data, error } = await admin.from('leads')
    .update(patch).eq('id', id).eq('org_id', mb.org_id)
    .select(SELECT).maybeSingle()
  if (error) return NextResponse.json(dbError(error, 'leads:update'), { status: 500 })

  if (stageChanged) {
    // Best-effort history. A failure here must not fail the stage change
    // the user actually asked for.
    await admin.from('lead_activities').insert({
      org_id:     mb.org_id,
      lead_id:    id,
      kind:       'stage_change',
      body:       `Moved from ${lead.stage} to ${body.stage}`,
      created_by: user.id,
    })
  }

  return NextResponse.json({ data })
}

/** DELETE — requires 'leads.delete'. Activities and proposals cascade. */
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
  if (!await canDo(admin, mb.org_id, user.id, mb.role, 'leads.delete')) {
    return NextResponse.json({ error: 'Not allowed to delete leads' }, { status: 403 })
  }

  const { error } = await admin.from('leads').delete().eq('id', id).eq('org_id', mb.org_id)
  if (error) return NextResponse.json(dbError(error, 'leads:delete'), { status: 500 })
  return new NextResponse(null, { status: 204 })
}
