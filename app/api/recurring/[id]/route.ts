import { createClient } from '@/lib/supabase/server'
import { NextResponse }  from 'next/server'
import type { NextRequest } from 'next/server'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { data: mb } = await supabase.from('org_members').select('org_id, role').eq('user_id', user.id).eq('is_active', true).maybeSingle()
  if (!mb || !['owner','admin','manager'].includes(mb.role)) return NextResponse.json({ error: 'Permission denied' }, { status: 403 })

  const { title, frequency, priority, assignee_id, project_id, client_id } = await req.json()
  const { data, error } = await supabase.from('tasks')
    .update({ title, frequency, priority, assignee_id: assignee_id || null, project_id: project_id || null, client_id: client_id || null })
    .eq('id', id).eq('org_id', mb.org_id).select('*').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
