import { NextResponse }        from 'next/server'
import { createClient }        from '@/lib/supabase/server'
import { createAdminClient }   from '@/lib/supabase/admin'
import { COMPLIANCE_TASKS }    from '@/lib/data/complianceTasks'

// Build subtask lookup once at module level
const SUBTASK_MAP = new Map(
  COMPLIANCE_TASKS.map(t => [t.title.toLowerCase().trim(), t.subtasks])
)
function findSubtasks(name: string) {
  return SUBTASK_MAP.get(name.toLowerCase().trim()) ?? []
}

/**
 * POST /api/ca/trigger
 * Admin-only: runs the CA compliance spawn logic DIRECTLY (synchronous).
 * Bypasses Inngest so tasks are created immediately and errors surface to the UI.
 */
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: mb } = await supabase
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()
  if (!mb) return NextResponse.json({ error: 'Not a member' }, { status: 403 })
  if (!['owner', 'admin'].includes(mb.role))
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const admin = createAdminClient()

  // Use IST date so "today" matches the business day
  const nowIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
  const today  = nowIST.toISOString().split('T')[0]

  // ── 1. Fetch all active assignments for this org ──────────────────
  const { data: assignments, error: asgErr } = await admin
    .from('ca_client_assignments')
    .select(`
      id, org_id, client_id, assignee_id, approver_id, created_at,
      master_task:ca_master_tasks(id, name, priority, dates, days_before_due)
    `)
    .eq('org_id', mb.org_id)
    .eq('is_active', true)

  if (asgErr) {
    console.error('[ca/trigger] fetch assignments:', asgErr.message)
    return NextResponse.json({ error: 'Failed to fetch assignments: ' + asgErr.message }, { status: 500 })
  }
  if (!assignments || assignments.length === 0) {
    return NextResponse.json({ ok: true, spawned: 0, message: 'No active assignments found. Import clients in Step 2 first.' })
  }

  // ── 2. Fetch already-spawned instances for this org ───────────────
  const { data: instances } = await admin
    .from('ca_task_instances')
    .select('assignment_id, due_date')
    .eq('org_id', mb.org_id)

  const existingKeys = new Set(
    (instances ?? []).map((r: any) => `${r.assignment_id}__${r.due_date}`)
  )

  // ── 3. Walk each assignment × each due date ───────────────────────
  // Manual trigger backfills up to 3 months of overdue tasks so admins
  // doing mid-year setup see all recent compliance tasks as overdue.
  const threeMonthsAgo = new Date(nowIST)
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
  const threeMonthsAgoStr = threeMonthsAgo.toISOString().split('T')[0]

  let spawned = 0
  let skipped = 0
  const errors: string[] = []

  for (const asgn of assignments) {
    const master = asgn.master_task as any
    if (!master) { skipped++; continue }

    const dates: Record<string, string> = master.dates ?? {}
    const daysBeforeDue: number = master.days_before_due ?? 7

    if (Object.keys(dates).length === 0) { skipped++; continue }

    for (const [monthKey, dueDateStr] of Object.entries(dates)) {
      if (!dueDateStr) continue

      // Compute trigger date
      const dueDate     = new Date(dueDateStr)
      const triggerDate = new Date(dueDate)
      triggerDate.setDate(triggerDate.getDate() - daysBeforeDue)
      const triggerStr  = triggerDate.toISOString().split('T')[0]

      // Only spawn when trigger window has arrived (future tasks not yet due)
      if (triggerStr > today) continue

      // Never backfill more than 3 months — tasks older than that are too stale
      if (dueDateStr < threeMonthsAgoStr) continue

      // Skip if already spawned
      const instanceKey = `${asgn.id}__${dueDateStr}`
      if (existingKeys.has(instanceKey)) continue

      // ── Create the parent compliance task ──
      const { data: newTask, error: taskErr } = await admin
        .from('tasks')
        .insert({
          org_id:            asgn.org_id,
          title:             master.name,
          status:            'todo',
          priority:          master.priority ?? 'medium',
          assignee_id:       asgn.assignee_id  ?? null,
          approver_id:       asgn.approver_id  ?? null,
          approval_required: !!asgn.approver_id,
          client_id:         asgn.client_id,
          due_date:          dueDateStr,
          is_recurring:      false,
          created_by:        user.id,           // use triggering admin's ID
          custom_fields:     { _ca_compliance: true, _triggered: true },
        })
        .select('id')
        .single()

      if (taskErr || !newTask?.id) {
        const msg = `${master.name} (${monthKey}): ${taskErr?.message ?? 'insert failed'}`
        errors.push(msg)
        console.error('[ca/trigger] task insert failed:', msg)
        continue
      }

      // ── Create subtasks ──
      const subtasks = findSubtasks(master.name)
      if (subtasks.length > 0) {
        const subtaskRows = subtasks.map((s: any) => ({
          org_id:            asgn.org_id,
          title:             s.title,
          status:            'todo' as const,
          priority:          master.priority ?? 'medium',
          assignee_id:       asgn.assignee_id  ?? null,
          approver_id:       asgn.approver_id  ?? null,
          approval_required: !!asgn.approver_id,
          client_id:         asgn.client_id,
          due_date:          dueDateStr,
          parent_task_id:    newTask.id,
          is_recurring:      false,
          created_by:        user.id,
          custom_fields:     s.required ? { _compliance_subtask: true } : null,
        }))
        const { error: subErr } = await admin.from('tasks').insert(subtaskRows)
        if (subErr) console.error('[ca/trigger] subtask insert failed:', subErr.message)
      }

      // ── Record instance to prevent re-spawn ──
      await admin.from('ca_task_instances').insert({
        org_id:        asgn.org_id,
        assignment_id: asgn.id,
        task_id:       newTask.id,
        due_date:      dueDateStr,
        month_key:     monthKey,
        status:        'created',
      })

      existingKeys.add(instanceKey) // prevent duplicate within same request
      spawned++
    }
  }

  const message = spawned > 0
    ? `Successfully spawned ${spawned} compliance task(s).`
    : `No tasks to spawn yet. Tasks appear N days before their due date (trigger windows haven't been reached for any assignment).`

  return NextResponse.json({
    ok: true,
    spawned,
    skipped,
    today,
    assignments_checked: assignments.length,
    errors: errors.length > 0 ? errors : undefined,
    message,
  })
}
