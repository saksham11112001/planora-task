import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/authUser'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse }  from 'next/server'
import type { NextRequest } from 'next/server'
import { dbError } from '@/lib/api-error'
import { getApiOrgMembership } from '@/lib/supabase/apiActiveOrg'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const mb = await getApiOrgMembership(supabase, user.id, req, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })

  const admin = createAdminClient()
  // Users can delete their own logs; managers can delete any
  const { data: log } = await admin.from('time_logs').select('user_id').eq('id', id).eq('org_id', mb.org_id).single()
  if (!log) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (log.user_id !== user.id && !['owner','admin','manager'].includes(mb.role))
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 })

  const { error } = await admin.from('time_logs').delete().eq('id', id)
  if (error) return NextResponse.json(dbError(error, 'time-logs/[id]'), { status: 500 })
  return NextResponse.json({ success: true })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const mb = await getApiOrgMembership(supabase, user.id, req, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })

  const admin = createAdminClient()
  const { data: log } = await admin.from('time_logs').select('user_id').eq('id', id).eq('org_id', mb.org_id).single()
  if (!log) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (log.user_id !== user.id && !['owner','admin','manager'].includes(mb.role))
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 })

  const body = await req.json()
  const ALLOWED = ['hours','description','logged_date','is_billable','project_id','task_id']
  const updates: Record<string, unknown> = {}
  for (const k of ALLOWED) { if (k in body) updates[k] = body[k] }

  const { data, error } = await admin.from('time_logs').update(updates).eq('id', id).select('*').single()
  if (error) return NextResponse.json(dbError(error, 'time-logs/[id]'), { status: 500 })
  return NextResponse.json({ data })
}
