import { createClient } from '@/lib/supabase/server'
import { NextResponse }  from 'next/server'
import type { NextRequest } from 'next/server'
import { assertCan }     from '@/lib/utils/permissionGate'
import { inngest }       from '@/lib/inngest/client'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { data: mb } = await supabase.from('org_members').select('org_id, role').eq('user_id', user.id).eq('is_active', true).single()
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })
  const projectEditDenied = await assertCan(supabase, mb.org_id, mb.role, 'projects.edit')
  if (projectEditDenied) return NextResponse.json({ error: projectEditDenied.error }, { status: projectEditDenied.status })

  // Fetch existing project first — needed for status-change notification and org verification
  const { data: existingProject } = await supabase
    .from('projects').select('id, status, name').eq('id', id).eq('org_id', mb.org_id).maybeSingle()
  if (!existingProject) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const ALLOWED = ['name','description','color','status','client_id','owner_id','due_date','start_date','budget','hours_budget','is_archived','member_ids']
  const updates: Record<string, unknown> = {}
  for (const k of ALLOWED) { if (k in body) updates[k] = body[k] }
  if (!Object.keys(updates).length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

  const { data, error } = await supabase.from('projects').update(updates).eq('id', id).eq('org_id', mb.org_id).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  // Fire project status change notification if status changed
  try {
    if (body.status && body.status !== existingProject.status) {
      const { data: mb2 } = await supabase.from('org_members')
        .select('users(name), organisations(name)').eq('user_id', user.id).maybeSingle()
      await inngest.send({
        name: 'project/status-updated',
        data: {
          project_id: id, project_name: data.name,
          old_status: existingProject.status ?? '', new_status: body.status,
          updated_by_id: user.id,
          updated_by_name: (mb2 as any)?.users?.name ?? 'Someone',
          org_id: mb.org_id,
          org_name: (mb2 as any)?.organisations?.name ?? '',
        },
      })
    }
  } catch {}
  return NextResponse.json({ data })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { data: mb } = await supabase.from('org_members').select('org_id, role').eq('user_id', user.id).eq('is_active', true).single()
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })
  const projectDeleteDenied = await assertCan(supabase, mb.org_id, mb.role, 'projects.delete')
  if (projectDeleteDenied) return NextResponse.json({ error: projectDeleteDenied.error }, { status: projectDeleteDenied.status })

  // Soft delete (archive)
  const { error } = await supabase.from('projects').update({ is_archived: true }).eq('id', id).eq('org_id', mb.org_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}