import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/authUser'
import { createAdminClient } from '@/lib/supabase/admin'
import { dbError } from '@/lib/api-error'
import { getApiOrgMembership } from '@/lib/supabase/apiActiveOrg'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, _req, 'org_id')
  if (!mb) return NextResponse.json({ error: 'Not a member' }, { status: 403 })

  const admin = createAdminClient()
  // Verify task belongs to this org
  const { data: task } = await admin
    .from('tasks').select('id').eq('id', id).eq('org_id', mb.org_id).maybeSingle()
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data, error } = await admin
    .from('task_activity')
    .select('id, task_id, actor_id, action, old_value, new_value, created_at')
    .eq('task_id', id)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json(dbError(error, 'tasks/[id]/activity'), { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}
