import { NextResponse }        from 'next/server'
import { createClient }        from '@/lib/supabase/server'
import { createAdminClient }   from '@/lib/supabase/admin'
import { nextOccurrence }      from '@/lib/utils/recurringSchedule'

// POST /api/tasks/[id]/complete-occurrence
// Body: { date: string (YYYY-MM-DD) }
//
// For recurring templates that weren't spawned by the cron yet, this endpoint
// creates an instance for the given date and marks it complete (or in_review if
// approval is required). Called from TaskDetailPanel when the user clicks
// "Complete this occurrence" on a past calendar slot showing a template.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: mb } = await supabase
    .from('org_members').select('org_id, role')
    .eq('user_id', user.id).eq('is_active', true)
    .maybeSingle()
  if (!mb) return NextResponse.json({ error: 'Not a member' }, { status: 403 })

  const body = await req.json()
  const date: string = body?.date
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'date is required (YYYY-MM-DD)' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Fetch the template
  const { data: template } = await admin.from('tasks')
    .select('id, org_id, title, priority, assignee_id, project_id, client_id, approval_required, is_recurring, parent_task_id, frequency, custom_fields, next_occurrence_date')
    .eq('id', id)
    .eq('org_id', mb.org_id)
    .maybeSingle()

  if (!template) return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  if (!template.is_recurring || template.parent_task_id) {
    return NextResponse.json({ error: 'Not a recurring template' }, { status: 422 })
  }

  // Check if an instance already exists for this template + date
  const { data: existing } = await admin.from('tasks')
    .select('id, status, approval_required')
    .eq('parent_recurring_id', template.id)
    .eq('due_date', date)
    .eq('org_id', mb.org_id)
    .maybeSingle()

  const targetStatus = template.approval_required ? 'in_review' : 'completed'
  const now = new Date().toISOString()

  let instanceId: string

  if (existing) {
    instanceId = existing.id
    // Only update if not already done
    if (existing.status !== 'completed' && existing.status !== 'in_review') {
      await admin.from('tasks')
        .update({
          status:       targetStatus,
          ...(targetStatus === 'completed' ? { completed_at: now } : {}),
        })
        .eq('id', instanceId)
    }
  } else {
    // Spawn a new instance
    const { data: inserted, error } = await admin.from('tasks')
      .insert({
        org_id:              template.org_id,
        title:               template.title,
        priority:            template.priority,
        status:              targetStatus,
        assignee_id:         template.assignee_id,
        project_id:          template.project_id,
        client_id:           template.client_id,
        approval_required:   template.approval_required,
        is_recurring:        false,
        parent_recurring_id: template.id,
        due_date:            date,
        created_by:          user.id,
        completed_at:        targetStatus === 'completed' ? now : null,
      })
      .select('id')
      .maybeSingle()

    if (error || !inserted) {
      return NextResponse.json({ error: 'Failed to spawn instance', detail: error?.message }, { status: 500 })
    }
    instanceId = inserted.id

    // Advance next_occurrence_date if we just completed the current pending occurrence
    if (date === template.next_occurrence_date) {
      const granularFreq = (template.custom_fields as any)?._granular_frequency || template.frequency
      if (granularFreq) {
        const nextDate = nextOccurrence(granularFreq, date)
        await admin.from('tasks')
          .update({ next_occurrence_date: nextDate })
          .eq('id', template.id)
      }
    }
  }

  const { data: instance } = await admin.from('tasks')
    .select('*')
    .eq('id', instanceId)
    .maybeSingle()

  return NextResponse.json({ instance, status: targetStatus })
}
