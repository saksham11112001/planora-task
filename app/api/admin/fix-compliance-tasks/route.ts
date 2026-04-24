import { createClient } from '@/lib/supabase/server'
import { NextResponse }  from 'next/server'

/**
 * POST /api/admin/fix-compliance-tasks
 *
 * Admin-only one-shot cleanup that removes stale _compliance_subtask rows that
 * were created when CA master attachment-headers were incorrectly spawned as
 * subtasks of the parent CA compliance task.
 *
 * These rows are safe to delete because:
 *   - They contain no real work — they were metadata placeholders.
 *   - Attachment headers are now surfaced as a checklist inside the task detail
 *     panel (pulled live from ca_master_tasks.attachment_headers), not as tasks.
 *   - Their presence was causing the "complete all subtasks first" gate to fire
 *     even when there were no real subtasks.
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

  if (!mb || !['owner', 'admin'].includes(mb.role))
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  // Find all compliance-subtask rows that still have a parent_task_id
  const { data: stale, error: fetchErr } = await supabase
    .from('tasks')
    .select('id, title')
    .eq('org_id', mb.org_id)
    .not('parent_task_id', 'is', null)
    .contains('custom_fields', { _compliance_subtask: true })

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })

  if (!stale || stale.length === 0)
    return NextResponse.json({ ok: true, removed: 0, message: 'Nothing to fix — no stale compliance subtasks found.' })

  const ids = stale.map((t: any) => t.id)

  const { error: delErr } = await supabase
    .from('tasks')
    .delete()
    .in('id', ids)
    .eq('org_id', mb.org_id)

  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    removed: ids.length,
    message: `Cleaned up ${ids.length} stale compliance attachment-header subtask${ids.length !== 1 ? 's' : ''}.`,
  })
}
