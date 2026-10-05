import { createClient }        from '@/lib/supabase/server'
import { getAuthUser }         from '@/lib/supabase/authUser'
import { createAdminClient }   from '@/lib/supabase/admin'
import { NextResponse }        from 'next/server'
import type { NextRequest }    from 'next/server'
import { canDo }               from '@/lib/utils/permissionGate'
import { getApiOrgMembership } from '@/lib/supabase/apiActiveOrg'
import { dbError }             from '@/lib/api-error'

/**
 * POST — convert a won lead into a client.
 *
 * This is the join between the CRM and the rest of upFloat: once converted,
 * the record is an ordinary client and every existing module (compliance,
 * tasks, invoices, portal) works on it unchanged.
 *
 * Requires 'leads.convert', because it creates a client — a plain member
 * working their pipeline should not be able to add rows to the client list.
 */
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

  const admin = createAdminClient()
  if (!await canDo(admin, mb.org_id, user.id, mb.role, 'leads.convert')) {
    return NextResponse.json({ error: 'Not allowed to convert leads' }, { status: 403 })
  }

  const { data: lead } = await admin.from('leads')
    .select('id, name, company, email, phone, notes, stage, converted_client_id')
    .eq('id', id).eq('org_id', mb.org_id).maybeSingle()
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Idempotent. Two clicks, or two people clicking at once, must not produce
  // two client records for one relationship — the second caller gets the
  // client the first one created.
  if (lead.converted_client_id) {
    const { data: existing } = await admin.from('clients')
      .select('*').eq('id', lead.converted_client_id).eq('org_id', mb.org_id).maybeSingle()
    return NextResponse.json({ data: existing, already: true })
  }

  const { data: client, error: clientErr } = await admin.from('clients').insert({
    org_id:     mb.org_id,
    // A firm's client list is keyed on the organisation, so prefer the
    // company name and keep the person's name only when there is no company.
    name:       (lead.company || lead.name).slice(0, 200),
    email:      lead.email?.slice(0, 255) || null,
    phone:      lead.phone?.slice(0, 50)  || null,
    company:    lead.company?.slice(0, 200) || null,
    notes:      lead.notes || null,
    status:     'active',
    color:      '#0d9488',
    created_by: user.id,
  }).select('*').maybeSingle()

  if (clientErr) return NextResponse.json(dbError(clientErr, 'leads:convert:client'), { status: 500 })
  if (!client)   return NextResponse.json({ error: 'Could not create the client' }, { status: 500 })

  const now = new Date().toISOString()

  // Mark the lead converted. The .is('converted_client_id', null) guard means
  // that if another request won the race we do not overwrite its link —
  // without it, two concurrent converts would leave one orphaned client.
  const { data: updated, error: leadErr } = await admin.from('leads')
    .update({ converted_client_id: client.id, converted_at: now, stage: 'won', updated_at: now })
    .eq('id', id).eq('org_id', mb.org_id)
    .is('converted_client_id', null)
    .select('id, converted_client_id').maybeSingle()

  if (leadErr) return NextResponse.json(dbError(leadErr, 'leads:convert:lead'), { status: 500 })

  if (!updated) {
    // Another request converted it first. Remove the client we just made so
    // the duplicate does not survive, and return theirs.
    await admin.from('clients').delete().eq('id', client.id).eq('org_id', mb.org_id)
    const { data: lead2 } = await admin.from('leads')
      .select('converted_client_id').eq('id', id).eq('org_id', mb.org_id).maybeSingle()
    const { data: winner } = await admin.from('clients')
      .select('*').eq('id', lead2?.converted_client_id ?? '').maybeSingle()
    return NextResponse.json({ data: winner, already: true })
  }

  await admin.from('lead_activities').insert({
    org_id:     mb.org_id,
    lead_id:    id,
    kind:       'stage_change',
    body:       `Converted to client "${client.name}"`,
    created_by: user.id,
  })

  return NextResponse.json({ data: client }, { status: 201 })
}
