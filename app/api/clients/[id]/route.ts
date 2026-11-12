import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/authUser'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse }  from 'next/server'
import type { NextRequest } from 'next/server'
import { assertCan }     from '@/lib/utils/permissionGate'
import { dbError } from '@/lib/api-error'
import { getApiOrgMembership } from '@/lib/supabase/apiActiveOrg'
import {
  statusChange, deactivateClient, reactivateClient, previewDeactivation,
} from '@/lib/clients/deactivation'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const mb = await getApiOrgMembership(supabase, user.id, req, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })
  const admin = createAdminClient()
  const clientEditDenied = await assertCan(admin, mb.org_id, user.id, mb.role, 'clients.edit')
  if (clientEditDenied) return NextResponse.json({ error: clientEditDenied.error }, { status: clientEditDenied.status })

  const VALID_CLIENT_STATUSES = ['active', 'inactive', 'prospect']
  const body = await req.json()
  if (body.status && !VALID_CLIENT_STATUSES.includes(body.status)) return NextResponse.json({ error: `Invalid status "${body.status}". Must be one of: active, inactive, prospect` }, { status: 400 })
  const ALLOWED = ['name','email','phone','company','website','industry','notes','status','color','group_id','dsc_expiry_date','dsc_holder_name','gstin','pan']
  const updates: Record<string, unknown> = {}
  for (const k of ALLOWED) { if (k in body) updates[k] = body[k] }

  // Only `status` is read here. An earlier version also selected
  // custom_fields, which does NOT exist on clients -- the select failed, the
  // null result was reported as "Client not found", and every client save
  // broke. The error is surfaced now instead of being collapsed into a
  // misleading 404.
  const { data: before, error: readErr } = await admin
    .from('clients').select('status').eq('id', id).eq('org_id', mb.org_id).maybeSingle()
  if (readErr) return NextResponse.json(dbError(readErr, 'clients/[id]'), { status: 500 })
  if (!before) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const transition = 'status' in body ? statusChange(before.status, body.status) : null

  // ?preview=1 answers "what would this do?" and writes nothing, so the UI can
  // say "this will archive 14 open tasks" BEFORE anyone commits to it. Doing
  // it silently is how work disappears.
  if (transition === 'deactivate' && req.nextUrl.searchParams.get('preview') === '1') {
    return NextResponse.json({ preview: await previewDeactivation(admin, mb.org_id, id) })
  }

  let effect: Record<string, number> | null = null

  if (transition === 'deactivate') {
    // Archive the open work and stop compliance spawning. Each archived task
    // is flagged on its own custom_fields so reactivating undoes this and
    // nothing else.
    const r = await deactivateClient(admin, mb.org_id, id)
    effect = { tasksArchived: r.tasksArchived, assignmentsDeactivated: r.assignmentsDeactivated }
  } else if (transition === 'reactivate') {
    const r = await reactivateClient(admin, mb.org_id, id)
    effect = { tasksRestored: r.tasksRestored, assignmentsReactivated: r.assignmentsReactivated }
  }

  const { data, error } = await admin.from('clients').update(updates).eq('id', id).eq('org_id', mb.org_id).select('*').single()
  if (error) return NextResponse.json(dbError(error, 'clients/[id]'), { status: 500 })
  return NextResponse.json({ data, effect })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const mb = await getApiOrgMembership(supabase, user.id, req, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })
  const admin = createAdminClient()
  const clientDeleteDenied = await assertCan(admin, mb.org_id, user.id, mb.role, 'clients.delete')
  if (clientDeleteDenied) return NextResponse.json({ error: clientDeleteDenied.error }, { status: clientDeleteDenied.status })

  // Soft-delete: mark is_archived + deleted_at so data is recoverable from trash
  const { error } = await admin.from('clients')
    .update({ is_archived: true, deleted_at: new Date().toISOString() })
    .eq('id', id).eq('org_id', mb.org_id)
  if (error) return NextResponse.json(dbError(error, 'clients/[id]'), { status: 500 })
  return NextResponse.json({ success: true })
}
