import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/authUser'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse }  from 'next/server'
import type { NextRequest } from 'next/server'
import { assertCan }     from '@/lib/utils/permissionGate'
import { dbError } from '@/lib/api-error'
import { getApiOrgMembership } from '@/lib/supabase/apiActiveOrg'

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

  // Merge custom_fields — do not overwrite unrelated keys
  if ('custom_fields' in body && body.custom_fields && typeof body.custom_fields === 'object') {
    const { data: existing } = await admin
      .from('clients').select('custom_fields').eq('id', id).eq('org_id', mb.org_id).maybeSingle()
    updates.custom_fields = { ...(existing?.custom_fields ?? {}), ...(body.custom_fields as object) }
  }

  const { data, error } = await admin.from('clients').update(updates).eq('id', id).eq('org_id', mb.org_id).select('*').single()
  if (error) return NextResponse.json(dbError(error, 'clients/[id]'), { status: 500 })
  return NextResponse.json({ data })
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
