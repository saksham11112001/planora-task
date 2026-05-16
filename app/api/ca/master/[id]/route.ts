import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { NextRequest } from 'next/server'
import { dbError } from '@/lib/api-error'
import { getApiOrgMembership } from '@/lib/supabase/apiActiveOrg'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const mb = await getApiOrgMembership(supabase, user.id, req, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (!['owner','admin'].includes(mb.role)) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const body = await req.json()
  const admin = createAdminClient()
  const { data, error } = await admin.from('ca_master_tasks')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id).eq('org_id', mb.org_id)
    .select().single()

  if (error) return NextResponse.json(dbError(error, 'ca/master/[id]'), { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const mb = await getApiOrgMembership(supabase, user.id, _req, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (!['owner','admin'].includes(mb.role)) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const admin = createAdminClient()
  const { error } = await admin.from('ca_master_tasks')
    .delete().eq('id', id).eq('org_id', mb.org_id)
  if (error) return NextResponse.json(dbError(error, 'ca/master/[id]'), { status: 500 })
  return NextResponse.json({ success: true })
}
