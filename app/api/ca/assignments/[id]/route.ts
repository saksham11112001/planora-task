import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/authUser'
import { createAdminClient } from '@/lib/supabase/admin'
import type { NextRequest } from 'next/server'
import { dbError } from '@/lib/api-error'
import { getApiOrgMembership } from '@/lib/supabase/apiActiveOrg'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const mb = await getApiOrgMembership(supabase, user.id, req, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (!['owner','admin','manager'].includes(mb.role)) return NextResponse.json({ error: 'Permission denied' }, { status: 403 })

  const body = await req.json()
  // start_date / end_date were missing, so this route silently dropped them and
  // still answered 200 — the same "saved successfully, changed nothing" shape
  // the Step 2 form had. Step 2 itself updates via delete-then-re-add rather
  // than PATCH, but any other caller of this route deserves a working update.
  const ALLOWED = ['client_id', 'master_task_id', 'assignee_id', 'approver_id', 'is_active', 'notes', 'custom_due_date', 'frequency_override', 'start_date', 'end_date']
  const updates: Record<string, unknown> = {}
  for (const k of ALLOWED) { if (k in body) updates[k] = body[k] }
  if (!Object.keys(updates).length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  const admin = createAdminClient()
  const { data, error } = await admin.from('ca_client_assignments')
    .update(updates).eq('id', id).eq('org_id', mb.org_id).select().single()

  if (error) return NextResponse.json(dbError(error, 'ca/assignments/[id]'), { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const mb = await getApiOrgMembership(supabase, user.id, _req, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (!['owner','admin','manager'].includes(mb.role)) return NextResponse.json({ error: 'Permission denied' }, { status: 403 })

  const admin = createAdminClient()
  const { error } = await admin.from('ca_client_assignments')
    .update({ is_active: false }).eq('id', id).eq('org_id', mb.org_id)
  if (error) return NextResponse.json(dbError(error, 'ca/assignments/[id]'), { status: 500 })
  return NextResponse.json({ success: true })
}
