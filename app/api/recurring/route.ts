import { createClient } from '@/lib/supabase/server'
import { NextResponse }  from 'next/server'
import type { NextRequest } from 'next/server'
import { assertCan }     from '@/lib/utils/permissionGate'

// Map granular frequencies to DB-allowed values
function normalizeFrequency(freq: string): string {
  if (freq.startsWith('weekly_')) return 'weekly'
  if (freq.startsWith('monthly_')) return 'monthly'
  return freq  // daily, bi_weekly, quarterly, annual — already valid
}

function nextOccurrence(freq: string, from: string): string {
  const d = new Date(from)
  switch (freq) {
    case 'daily':      d.setDate(d.getDate() + 1);       break
    case 'weekly':
    case 'weekly_mon':
    case 'weekly_tue':
    case 'weekly_wed':
    case 'weekly_thu':
    case 'weekly_fri':
    case 'weekly_sat':
    case 'weekly_sun': d.setDate(d.getDate() + 7);       break
    case 'bi_weekly':  d.setDate(d.getDate() + 14);      break
    case 'monthly':
    case 'monthly_1':
    case 'monthly_15': d.setMonth(d.getMonth() + 1);     break
    case 'quarterly':  d.setMonth(d.getMonth() + 3);     break
    case 'annual':     d.setFullYear(d.getFullYear() + 1); break
    default:           d.setDate(d.getDate() + 7);       break
  }
  return d.toISOString().split('T')[0]
}

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
  const dbFrequency = normalizeFrequency(frequency)  // map weekly_mon → weekly etc
  const nextDate    = nextOccurrence(frequency, today)

  const { data: task, error } = await supabase.from('tasks').insert({
    org_id:               mb.org_id,
    title:                title.trim(),
    priority,
    status:               'todo',
    is_recurring:         true,
    // Recurring tasks with a client assigned require manager approval before going live
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
  const dbFrequency = frequency ? normalizeFrequency(frequency) : undefined

  const { data, error } = await supabase.from('tasks')
    .update({
      title,
      frequency:       dbFrequency,
      priority,
      assignee_id:     assignee_id || null,
      project_id:      project_id  || null,
      client_id:       client_id   || null,
    })
    .eq('id', id).eq('org_id', mb.org_id).select('*').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
