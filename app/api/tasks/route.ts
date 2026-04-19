import { createClient }  from '@/lib/supabase/server'
import { NextResponse }   from 'next/server'
import type { NextRequest } from 'next/server'
import { inngest }        from '@/lib/inngest/client'
import { assertCan }      from '@/lib/utils/permissionGate'
import { dbError } from '@/lib/api-error'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { data: mb } = await supabase.from('org_members').select('org_id').eq('user_id', user.id).eq('is_active', true).single()
  if (!mb) return NextResponse.json({ data: [] })

  const sp  = request.nextUrl.searchParams
  let q = supabase.from('tasks')
    .select('id, title, status, priority, due_date, assignee_id, project_id, client_id, is_recurring, frequency, next_occurrence_date, parent_task_id, custom_fields, created_at, updated_at')
    .eq('org_id', mb.org_id).neq('is_archived', true)
  if (sp.get('project_id'))   q = q.eq('project_id', sp.get('project_id')!)
  if (sp.get('assignee_id'))  q = q.eq('assignee_id', sp.get('assignee_id')!)
  if (sp.get('client_id'))    q = q.eq('client_id', sp.get('client_id')!)
  if (sp.get('status'))       q = q.eq('status', sp.get('status')!)
  if (sp.get('mine') === 'true') q = q.eq('assignee_id', user.id)
  if (sp.get('parent_id'))    q = q.eq('parent_task_id', sp.get('parent_id')!)
  if (sp.get('top_level') === 'true') q = q.is('parent_task_id', null)
  // Find all tasks that are blocking a given task id (reverse lookup via JSONB @> contains)
  if (sp.get('blocks_task_id')) {
    const btid = sp.get('blocks_task_id')!
    q = (q as any).contains('custom_fields', { _blocked_by: [btid] })
  }
  const parsedLimit  = parseInt(sp.get('limit')  ?? '100', 10)
  const parsedOffset = parseInt(sp.get('offset') ?? '0',   10)
  const _limit  = Math.min(isNaN(parsedLimit)  ? 100 : parsedLimit,  500)
  const _offset = Math.max(isNaN(parsedOffset) ? 0   : parsedOffset, 0)
  q = q.order('due_date', { ascending: true, nullsFirst: false }).range(_offset, _offset + _limit - 1)

  const { data, error } = await q
  if (error) return NextResponse.json(dbError(error, 'tasks'), { status: 500 })
  return NextResponse.json({ data }, {
    headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' },
  })
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

  // Always check tasks.create permission — subtask creation is not exempt
  const denied = await assertCan(supabase, mb.org_id, mb.role, 'tasks.create')
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })

  const { title, description, status = 'todo', priority = 'medium', assignee_id, approver_id,
          client_id, project_id, due_date, estimated_hours, approval_required = false,
          parent_task_id, is_recurring = false, frequency, next_occurrence_date,
          custom_fields } = body
  if (!title?.trim()) return NextResponse.json({ error: 'Title required' }, { status: 400 })
  if (title.trim().length > 500) return NextResponse.json({ error: 'Title too long (max 500 chars)' }, { status: 400 })

  // If attaching to a parent task, verify it belongs to the same org
  if (parent_task_id) {
    const { data: parentTask } = await supabase
      .from('tasks').select('id, org_id').eq('id', parent_task_id).eq('org_id', mb.org_id).single()
    if (!parentTask) return NextResponse.json({ error: 'Parent task not found' }, { status: 404 })
  }

  const { data: task, error } = await supabase.from('tasks').insert({
    org_id: mb.org_id, title: title.trim(), description: description || null,
    status, priority, assignee_id: assignee_id || null, client_id: client_id || null,
    project_id: project_id || null, due_date: due_date || null,
    estimated_hours: estimated_hours ?? null, approval_required: !!approval_required,
    approver_id: approver_id || null, created_by: user.id, is_recurring: is_recurring ?? false,
    frequency: (is_recurring && frequency) ? frequency : null,
    next_occurrence_date: (is_recurring && next_occurrence_date) ? next_occurrence_date : null,
    parent_task_id: parent_task_id || null,
  }).select('*').single()

  if (error) return NextResponse.json(dbError(error, 'tasks'), { status: 500 })

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
  // Create compliance subtasks if provided
  const subtasks = body.subtasks as { title: string; required: boolean; due_date?: string }[] | undefined
  if (subtasks && subtasks.length > 0 && task?.id) {
    const subtaskInserts = subtasks.map(s => ({
      org_id:         mb.org_id,
      title:          String(s.title ?? '').slice(0, 500),
      status:         'todo' as const,
      priority:       body.priority ?? 'medium',
      assignee_id:    (s as any).assignee_id || body.assignee_id || null,
      client_id:      body.client_id || null,
      project_id:     body.project_id || null,
      due_date:       s.due_date || body.due_date || null,
      parent_task_id: task.id,
      created_by:     user.id,
      is_recurring:   false,
      custom_fields:  s.required ? { _compliance_subtask: true } : null,
    }))
    const { error: subErr } = await supabase.from('tasks').insert(subtaskInserts)
    if (subErr) console.error('[tasks POST] subtask insert failed:', subErr.message)
  }

  return NextResponse.json({ data: task }, { status: 201 })
}
