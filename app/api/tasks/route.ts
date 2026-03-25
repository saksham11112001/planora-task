import { createClient }  from '@/lib/supabase/server'
import { NextResponse }   from 'next/server'
import type { NextRequest } from 'next/server'
import { inngest }        from '@/lib/inngest/client'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { data: mb } = await supabase.from('org_members').select('org_id').eq('user_id', user.id).eq('is_active', true).single()
  if (!mb) return NextResponse.json({ data: [] })

  const sp  = request.nextUrl.searchParams
  let q = supabase.from('tasks')
    .select('id, title, status, priority, due_date, assignee_id, project_id, client_id, is_recurring, frequency, next_occurrence_date, parent_task_id')
    .eq('org_id', mb.org_id).neq('is_archived', true)
  if (sp.get('project_id'))   q = q.eq('project_id', sp.get('project_id')!)
  if (sp.get('assignee_id'))  q = q.eq('assignee_id', sp.get('assignee_id')!)
  if (sp.get('status'))       q = q.eq('status', sp.get('status')!)
  if (sp.get('mine') === 'true') q = q.eq('assignee_id', user.id)
  if (sp.get('parent_id'))    q = q.eq('parent_task_id', sp.get('parent_id')!)
  if (sp.get('top_level') === 'true') q = q.is('parent_task_id', null)
  q = q.order('due_date', { ascending: true, nullsFirst: false }).limit(parseInt(sp.get('limit') ?? '100'))

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: mb } = await supabase.from('org_members')
    .select('org_id, role, organisations(name), users(name)')
    .eq('user_id', user.id).eq('is_active', true).single()
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })

  const body = await request.json()
  const { title, description, status = 'todo', priority = 'medium', assignee_id, approver_id,
          client_id, project_id, due_date, estimated_hours, approval_required = false,
          parent_task_id } = body
  if (!title?.trim()) return NextResponse.json({ error: 'Title required' }, { status: 400 })

  const { data: task, error } = await supabase.from('tasks').insert({
    org_id: mb.org_id, title: title.trim(), description: description || null,
    status, priority, assignee_id: assignee_id || null, client_id: client_id || null,
    project_id: project_id || null, due_date: due_date || null,
    estimated_hours: estimated_hours ?? null, approval_required: !!approval_required,
    approver_id: approver_id || null, created_by: user.id, is_recurring: false,
    parent_task_id: parent_task_id || null,
  }).select('*').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (assignee_id && assignee_id !== user.id) {
    try {
      const { data: assignee } = await supabase.from('users')
        .select('email, name, phone_number, whatsapp_opted_in').eq('id', assignee_id).single()
      const { data: project } = project_id
        ? await supabase.from('projects').select('name').eq('id', project_id).single()
        : { data: null }
      if (assignee?.email) {
        await inngest.send({
          name: 'task/assigned',
          data: {
            task_id: task.id, task_title: task.title,
            assignee_id, assignee_email: assignee.email,
            assignee_phone: assignee.phone_number ?? null,
            assigner_name: (mb.users as any)?.name ?? 'Someone',
            org_id: mb.org_id, org_name: (mb.organisations as any)?.name ?? '',
            due_date: due_date ?? null, project_name: (project as any)?.name ?? null,
          },
        })
      }
    } catch {}
  }
  return NextResponse.json({ data: task }, { status: 201 })
}
