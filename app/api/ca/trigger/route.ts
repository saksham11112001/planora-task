import { NextResponse }        from 'next/server'
import { createClient }        from '@/lib/supabase/server'
import { createAdminClient }   from '@/lib/supabase/admin'
import { dbError } from '@/lib/api-error'
import type { NextRequest }    from 'next/server'
import { getApiOrgMembership } from '@/lib/supabase/apiActiveOrg'
import { shiftDays }           from '@/lib/utils/recurringSchedule'

/**
 * POST /api/ca/trigger
 * Admin-only: runs the CA compliance spawn logic DIRECTLY (synchronous).
 * Bypasses Inngest so tasks are created immediately and errors surface to the UI.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, request, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'Not a member' }, { status: 403 })
  if (!['owner', 'admin'].includes(mb.role))
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const admin = createAdminClient()

  // Use IST date so "today" matches the business day
  const nowIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
  const today  = nowIST.toISOString().split('T')[0]

  // ── 0. Clean up any legacy compliance subtasks (attachment headers that were
  //       incorrectly created as subtask rows). Attachment headers are now shown
  //       only as a UI checklist — not as subtasks.
  const { data: legacyRows } = await admin
    .from('tasks')
    .select('id')
    .eq('org_id', mb.org_id)
    .not('parent_task_id', 'is', null)
    .contains('custom_fields', { _compliance_subtask: true })

  if (legacyRows && legacyRows.length > 0) {
    const legacyIds = legacyRows.map(r => r.id)
    const { error: cleanErr } = await admin.from('tasks').delete().in('id', legacyIds)
    if (cleanErr) console.error('[ca/trigger] legacy subtask cleanup failed:', cleanErr.message)
    else console.log(`[ca/trigger] cleaned up ${legacyIds.length} legacy compliance subtask(s)`)
  }

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
    return NextResponse.json(dbError(asgErr, 'ca/trigger'), { status: 500 })
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

  // Also check actual tasks table — guards against ca_task_instances being out of sync
  // (e.g. if a previous spawn wrote the task but the instance insert failed).
  const { data: existingCATasks } = await admin
    .from('tasks')
    .select('title, client_id, due_date')
    .eq('org_id', mb.org_id)
    .contains('custom_fields', { _ca_compliance: true })
    .neq('is_archived', true)

  const existingTaskKeys = new Set(
    (existingCATasks ?? []).map((t: any) => `${t.title}__${t.client_id ?? ''}__${t.due_date ?? ''}`)
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
    // If no start_date is set, default to today so we never accidentally spawn
    // past-due tasks for newly onboarded clients (same guard as the daily cron).
    // Admins who need to backfill past months must set start_date on the assignment first.
    const startDateStr: string = (asgn as any).start_date ?? today

    for (const [monthKey, dueDateStr] of Object.entries(dates)) {
      if (!dueDateStr) continue

      const logBase = { client_id: asgn.client_id, task: master.name, month: monthKey, due: dueDateStr }

      // Skip dates before the client's start date
      if (dueDateStr < startDateStr) {
        detail.push({ ...logBase, action: 'skipped', reason: `before start_date (${startDateStr})` })
        continue
      }

      // Compute trigger date (timezone-safe: no UTC round-trip)
      const triggerStr = shiftDays(dueDateStr, -daysBeforeDue)

      // Only spawn when trigger window has arrived (future tasks not yet due)
      if (triggerStr > today) {
        detail.push({ ...logBase, action: 'skipped', reason: `trigger date ${triggerStr} not reached yet (today=${today})` })
        continue
      }

      // Skip if already spawned (check both instance table and actual tasks)
      const instanceKey = `${asgn.id}__${dueDateStr}`
      const taskKey     = `${master.name}__${asgn.client_id ?? ''}__${dueDateStr}`
      if (existingKeys.has(instanceKey) || existingTaskKeys.has(taskKey)) {
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
          custom_fields:     { _ca_compliance: true, _triggered: true, _assignment_id: asgn.id },
        })
        .select('id')
        .single()

      if (taskErr || !newTask?.id) {
        const msg = `${master.name} (${monthKey}): ${taskErr?.message ?? 'insert failed'}`
        errors.push(msg)
        console.error('[ca/trigger] task insert failed:', msg)
        continue
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

      existingKeys.add(instanceKey)   // prevent duplicate within same request
      existingTaskKeys.add(taskKey)   // same
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
    legacy_subtasks_removed: legacyRows?.length ?? 0,
    errors: errors.length > 0 ? errors : undefined,
    detail,
    message,
  })
}
