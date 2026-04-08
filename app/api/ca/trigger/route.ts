import { NextResponse }        from 'next/server'
import { createClient }        from '@/lib/supabase/server'
import { createAdminClient }   from '@/lib/supabase/admin'

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
      id, org_id, client_id, assignee_id, approver_id, created_at, start_date,
      master_task:ca_master_tasks(id, name, priority, dates, days_before_due, attachment_headers, attachment_count)
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
  let spawned = 0
  let skipped = 0
  const errors: string[] = []
  const detail: { client_id: string; task: string; month: string; due: string; action: string; reason?: string }[] = []

  for (const asgn of assignments) {
    const master = asgn.master_task as any
    if (!master) { skipped++; continue }

    const dates: Record<string, string> = master.dates ?? {}
    const daysBeforeDue: number = master.days_before_due ?? 7

    if (Object.keys(dates).length === 0) { skipped++; continue }

    // Use the assignment's start_date as the lower bound for backfill.
    // If no start_date is set, apply no lower bound — spawn all triggered tasks.
    const startDateStr: string = (asgn as any).start_date ?? '2000-01-01'

    for (const [monthKey, dueDateStr] of Object.entries(dates)) {
      if (!dueDateStr) continue

      const logBase = { client_id: asgn.client_id, task: master.name, month: monthKey, due: dueDateStr }

      // Skip dates before the client's start date
      if (dueDateStr < startDateStr) {
        detail.push({ ...logBase, action: 'skipped', reason: `before start_date (${startDateStr})` })
        continue
      }

      // Compute trigger date
      const dueDate     = new Date(dueDateStr)
      const triggerDate = new Date(dueDate)
      triggerDate.setDate(triggerDate.getDate() - daysBeforeDue)
      const triggerStr  = triggerDate.toISOString().split('T')[0]

      // Only spawn when trigger window has arrived (future tasks not yet due)
      if (triggerStr > today) {
        detail.push({ ...logBase, action: 'skipped', reason: `trigger date ${triggerStr} not reached yet (today=${today})` })
        continue
      }

      // Skip if already spawned
      const instanceKey = `${asgn.id}__${dueDateStr}`
      if (existingKeys.has(instanceKey)) {
        detail.push({ ...logBase, action: 'skipped', reason: 'already spawned' })
        continue
      }

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

      // ── Create subtasks from master task's attachment_headers ──
      // Each required attachment becomes a subtask so assignees know exactly what to upload.
      const attachmentHeaders: string[] = master.attachment_headers ?? []
      if (attachmentHeaders.length > 0) {
        const subtaskRows = attachmentHeaders.map((header: string) => ({
          org_id:            asgn.org_id,
          title:             header,
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
          custom_fields:     { _compliance_subtask: true },
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
      detail.push({ client_id: asgn.client_id, task: master.name, month: monthKey, due: dueDateStr, action: 'spawned' })
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
    detail,
    message,
  })
}
