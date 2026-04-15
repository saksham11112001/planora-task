import { createClient }       from '@/lib/supabase/server'
import { NextResponse }        from 'next/server'
import type { NextRequest }    from 'next/server'
import { assertCan }           from '@/lib/utils/permissionGate'
import { normalizeFrequency, nextOccurrence } from '@/lib/utils/recurringSchedule'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { data: mb } = await supabase.from('org_members')
    .select('org_id, role').eq('user_id', user.id).eq('is_active', true).single()
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })
  const recurringCreateDenied = await assertCan(supabase, mb.org_id, mb.role, 'recurring.create')
  if (recurringCreateDenied) return NextResponse.json({ error: recurringCreateDenied.error }, { status: recurringCreateDenied.status })

  const body = await request.json()
  const { title, priority = 'medium', frequency, assignee_id, approver_id,
          project_id, client_id, start_date, subtasks } = body

  if (!title?.trim()) return NextResponse.json({ error: 'Title required' }, { status: 400 })
  if (!frequency)     return NextResponse.json({ error: 'Frequency required' }, { status: 400 })

  const today       = start_date || new Date().toISOString().split('T')[0]
  const dbFrequency = normalizeFrequency(frequency)
  const nextDate    = nextOccurrence(frequency, today)

  const { data: task, error } = await supabase.from('tasks').insert({
    org_id:               mb.org_id,
    title:                title.trim(),
    priority,
    status:               'todo',
    is_recurring:         true,
    approval_required:    !!(client_id),
    frequency:            dbFrequency,
    next_occurrence_date: nextDate,
    assignee_id:          assignee_id  || null,
    approver_id:          approver_id  || null,
    project_id:           project_id   || null,
    client_id:            client_id    || null,
    created_by:           user.id,
  }).select('*').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Create compliance subtasks if provided
  if (subtasks && subtasks.length > 0 && task?.id) {
    try {
      const subtaskInserts = subtasks.map((s: { title: string; required: boolean; due_date?: string; assignee_id?: string }) => ({
        org_id:         mb.org_id,
        title:          s.title,
        status:         'todo' as const,
        priority:       priority,
        assignee_id:    s.assignee_id || assignee_id || null,
        client_id:      client_id   || null,
        project_id:     project_id  || null,
        due_date:       s.due_date  || null,
        parent_task_id: task.id,
        created_by:     user.id,
        is_recurring:   false,
        custom_fields:  s.required ? { _compliance_subtask: true } : null,
      }))
      await supabase.from('tasks').insert(subtaskInserts)
    } catch (e) {
      console.error('[recurring subtasks]', e)
    }
  }

  return NextResponse.json({ data: task }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { data: mb } = await supabase.from('org_members')
    .select('org_id, role').eq('user_id', user.id).eq('is_active', true).single()
  if (!mb || !['owner','admin','manager'].includes(mb.role))
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 })

  const url = new URL(request.url)
  const id  = url.pathname.split('/').pop()
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const { title, frequency, priority, assignee_id, project_id, client_id } = await request.json()
  const today       = new Date().toISOString().split('T')[0]
  const dbFrequency = frequency ? normalizeFrequency(frequency) : undefined
  const nextDate    = frequency ? nextOccurrence(frequency, today) : undefined

  const { data, error } = await supabase.from('tasks')
    .update({
      title,
      frequency:            dbFrequency,
      next_occurrence_date: nextDate,
      priority,
      assignee_id:          assignee_id || null,
      project_id:           project_id  || null,
      client_id:            client_id   || null,
    })
    .eq('id', id).eq('org_id', mb.org_id).select('*').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
