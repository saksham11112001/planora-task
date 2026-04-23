import { NextResponse }      from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { dbError }           from '@/lib/api-error'

/**
 * POST /api/ca/cleanup-subtasks
 *
 * Admin-only: deletes all tasks that were incorrectly created as subtasks
 * of CA compliance tasks (i.e. rows where custom_fields._compliance_subtask = true).
 *
 * Attachment headers are now shown as a UI checklist inside the task detail
 * panel — not as subtasks. This endpoint removes the legacy subtask rows so
 * existing compliance tasks are clean.
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

  // Find all compliance subtask IDs in this org before deleting (for the count)
  const { data: rows, error: fetchErr } = await admin
    .from('tasks')
    .select('id')
    .eq('org_id', mb.org_id)
    .not('parent_task_id', 'is', null)
    .contains('custom_fields', { _compliance_subtask: true })

  if (fetchErr) return NextResponse.json(dbError(fetchErr, 'ca/cleanup-subtasks'), { status: 500 })

  const ids = (rows ?? []).map(r => r.id)
  if (ids.length === 0) {
    return NextResponse.json({ ok: true, deleted: 0, message: 'No compliance subtasks found — already clean.' })
  }

  const { error: delErr } = await admin
    .from('tasks')
    .delete()
    .in('id', ids)

  if (delErr) return NextResponse.json(dbError(delErr, 'ca/cleanup-subtasks'), { status: 500 })

  return NextResponse.json({
    ok: true,
    deleted: ids.length,
    message: `Removed ${ids.length} compliance subtask(s). Attachment headers now appear only as the document checklist inside each task.`,
  })
}
