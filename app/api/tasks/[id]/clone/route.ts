// POST /api/tasks/[id]/clone — duplicate a task INCLUDING its subtasks.
// The client-side cloneTask used to POST only the parent, so duplicated tasks
// silently lost their subtasks. Cloning server-side copies both in one call.
import { createClient }        from '@/lib/supabase/server'
import { getAuthUser }         from '@/lib/supabase/authUser'
import { createAdminClient }   from '@/lib/supabase/admin'
import { NextResponse }        from 'next/server'
import type { NextRequest }    from 'next/server'
import { assertCan }           from '@/lib/utils/permissionGate'
import { dbError }             from '@/lib/api-error'
import { getApiOrgMembership } from '@/lib/supabase/apiActiveOrg'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, req, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })

  const admin = createAdminClient()
  const denied = await assertCan(admin, mb.org_id, user.id, mb.role, 'tasks.create')
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })

  // Fetch the original (org-scoped)
  const { data: orig } = await admin.from('tasks')
    .select('id, title, description, priority, assignee_id, approver_id, approval_required, client_id, project_id, due_date, estimated_hours, custom_fields, is_billable, billable_amount')
    .eq('id', id).eq('org_id', mb.org_id).maybeSingle()
  if (!orig) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  // Create the parent copy
  const { data: newTask, error: parentErr } = await admin.from('tasks').insert({
    org_id:            mb.org_id,
    title:             `${orig.title} (copy)`,
    description:       orig.description ?? null,
    status:            'todo',
    priority:          orig.priority,
    assignee_id:       orig.assignee_id ?? null,
    approver_id:       orig.approver_id ?? null,
    approval_required: orig.approval_required ?? false,
    client_id:         orig.client_id ?? null,
    project_id:        orig.project_id ?? null,
    due_date:          orig.due_date ?? null,
    estimated_hours:   orig.estimated_hours ?? null,
    custom_fields:     orig.custom_fields ?? null,
    is_billable:       orig.is_billable ?? false,
    billable_amount:   orig.billable_amount ?? null,
    created_by:        user.id,
  }).select('*').single()
  if (parentErr || !newTask) return NextResponse.json(dbError(parentErr, 'tasks/clone'), { status: 500 })

  // Copy subtasks (fresh status, keep everything else)
  const { data: subtasks } = await admin.from('tasks')
    .select('title, description, priority, assignee_id, approver_id, approval_required, due_date, estimated_hours, custom_fields, sort_order')
    .eq('parent_task_id', id).eq('org_id', mb.org_id).neq('is_archived', true)
    .order('sort_order', { ascending: true, nullsFirst: false })

  let subtasksCloned = 0
  if (subtasks?.length) {
    const { error: subErr } = await admin.from('tasks').insert(subtasks.map(s => ({
      org_id:            mb.org_id,
      parent_task_id:    newTask.id,
      title:             s.title,
      description:       s.description ?? null,
      status:            'todo',
      priority:          s.priority,
      assignee_id:       s.assignee_id ?? null,
      approver_id:       s.approver_id ?? null,
      approval_required: s.approval_required ?? false,
      due_date:          s.due_date ?? null,
      estimated_hours:   s.estimated_hours ?? null,
      custom_fields:     s.custom_fields ?? null,
      sort_order:        s.sort_order ?? null,
      created_by:        user.id,
    })))
    if (subErr) {
      // Parent was created; surface the partial failure honestly
      console.error('[tasks/clone] subtask copy failed:', subErr.message)
      return NextResponse.json({ data: newTask, subtasks_cloned: 0, warning: 'Task cloned but subtasks could not be copied' })
    }
    subtasksCloned = subtasks.length
  }

  return NextResponse.json({ data: newTask, subtasks_cloned: subtasksCloned })
}
