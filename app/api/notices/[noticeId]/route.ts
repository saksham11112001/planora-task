import { NextRequest, NextResponse } from 'next/server'
import { dbError } from '@/lib/api-error'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/authUser'
import { createAdminClient } from '@/lib/supabase/admin'
import { getApiOrgMembership } from '@/lib/supabase/apiActiveOrg'
import { stripIdentityFields } from '@/lib/utils/safeUpdate'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ noticeId: string }> }) {
  const { noticeId } = await params
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, req, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'No membership' }, { status: 403 })
  if (!['owner', 'admin', 'manager'].includes(mb.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const body = await req.json()
  // The .eq('org_id') below scopes WHICH row is written, not WHAT is written
  // to it — an org_id in the body would land in the SET clause and move this
  // notice into another organisation. Ownership comes from the session.
  const { data, error } = await admin.from('client_notices')
    .update({ ...stripIdentityFields(body), updated_at: new Date().toISOString() })
    .eq('id', noticeId).eq('org_id', mb.org_id)
    .select().maybeSingle()
  if (error) return NextResponse.json(dbError(error, 'notices/[noticeId]'), { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ noticeId: string }> }) {
  const { noticeId } = await params
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, req, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'No membership' }, { status: 403 })
  if (!['owner', 'admin', 'manager'].includes(mb.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { error } = await admin.from('client_notices').delete().eq('id', noticeId).eq('org_id', mb.org_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
