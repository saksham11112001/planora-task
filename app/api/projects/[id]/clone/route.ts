import { createClient }      from '@/lib/supabase/server'
import { createAdminClient }  from '@/lib/supabase/admin'
import { NextResponse }        from 'next/server'
import type { NextRequest }    from 'next/server'
import { dbError } from '@/lib/api-error'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: mb } = await supabase.from('org_members')
    .select('org_id, role').eq('user_id', user.id).eq('is_active', true).maybeSingle()
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })
  if (!['owner', 'admin', 'manager'].includes(mb.role))
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })

  // Fetch source project
  const { data: project } = await supabase.from('projects')
    .select('*').eq('id', id).eq('org_id', mb.org_id).single()
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const admin = createAdminClient()

  // Create the cloned project
  const { data: newProject, error: projErr } = await admin.from('projects').insert({
    org_id:       mb.org_id,
    name:         `Copy of ${project.name}`,
    color:        project.color,
    status:       'active',
    description:  project.description ?? null,
    client_id:    project.client_id ?? null,
    budget:       project.budget ?? null,
    hours_budget: project.hours_budget ?? null,
    owner_id:     user.id,
    member_ids:   project.member_ids ?? null,
  }).select('id').single()

  if (projErr || !newProject)
    return NextResponse.json(dbError(projErr, 'projects/[id]/clone'), { status: 500 })

  // Fetch top-level tasks from the source project
  const { data: tasks } = await supabase.from('tasks')
    .select('*').eq('project_id', id).is('parent_task_id', null).neq('is_archived', true)

  let taskCount = 0
  let subtaskCount = 0

  for (const task of tasks ?? []) {
    const { data: newTask } = await admin.from('tasks').insert({
      org_id:           mb.org_id,
      project_id:       newProject.id,
      title:            task.title,
      description:      task.description ?? null,
      status:           'todo',
      priority:         task.priority ?? 'medium',
      client_id:        task.client_id ?? null,
      assignee_id:      task.assignee_id ?? null,
      approver_id:      task.approver_id ?? null,
      approval_required: task.approval_required ?? false,
      estimated_hours:  task.estimated_hours ?? null,
      due_date:         task.due_date ?? null,
      created_by:       user.id,
    }).select('id').single()

    if (!newTask) continue
    taskCount++

    // Copy subtasks
    const { data: subtasks } = await supabase.from('tasks')
      .select('*').eq('parent_task_id', task.id).neq('is_archived', true)

    if (subtasks?.length) {
      await admin.from('tasks').insert(
        subtasks.map(s => ({
          org_id:          mb.org_id,
          project_id:      newProject.id,
          parent_task_id:  newTask.id,
          title:           s.title,
          description:     s.description ?? null,
          status:          'todo',
          priority:        s.priority ?? 'medium',
          created_by:      user.id,
        }))
      )
      subtaskCount += subtasks.length
    }
  }

  return NextResponse.json({ id: newProject.id, task_count: taskCount, subtask_count: subtaskCount })
}
