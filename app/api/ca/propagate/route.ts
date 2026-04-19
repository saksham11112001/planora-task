import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { NextRequest } from 'next/server'
import { dbError } from '@/lib/api-error'

export const maxDuration = 30

/**
 * POST /api/ca/propagate
 *
 * Propagates CA master task / assignment changes to all incomplete
 * spawned task instances matching the given master task name.
 *
 * Body:
 *   old_name   — current task title to match against (required)
 *   client_id  — optional: restrict to a single client
 *   fields     — object with any of:
 *     title              — new task title
 *     priority           — new priority
 *     assignee_id        — new assignee (or null)
 *     approver_id        — new approver (or null)
 *     attachment_headers — { old: string[], new: string[] } to rename subtasks
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: mb } = await supabase
    .from('org_members').select('org_id, role')
    .eq('user_id', user.id).eq('is_active', true).single()
  if (!mb) return NextResponse.json({ error: 'No membership' }, { status: 403 })
  if (!['owner', 'admin', 'manager'].includes(mb.role))
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 })

  const body = await req.json()
  const { old_name, client_id, fields } = body as {
    old_name: string
    client_id?: string | null
    fields: {
      title?: string
      priority?: string
      assignee_id?: string | null
      approver_id?: string | null
      client_id?: string | null
      attachment_headers?: { old: string[]; new: string[] }
    }
  }

  if (!old_name?.trim()) return NextResponse.json({ error: 'old_name required' }, { status: 400 })
  if (!fields || Object.keys(fields).length === 0)
    return NextResponse.json({ error: 'fields required' }, { status: 400 })

  const admin = createAdminClient()

  // Find all incomplete top-level CA compliance tasks matching the name in this org
  let query = admin.from('tasks')
    .select('id')
    .eq('org_id', mb.org_id)
    .eq('title', old_name.trim())
    .not('status', 'eq', 'completed')
    .or('is_archived.is.null,is_archived.eq.false')
    .is('parent_task_id', null)
    .contains('custom_fields', { _ca_compliance: true })

  if (client_id) query = query.eq('client_id', client_id)

  const { data: matchingTasks, error: fetchErr } = await query
  if (fetchErr) return NextResponse.json(dbError(fetchErr, 'ca/propagate'), { status: 500 })
  if (!matchingTasks?.length) return NextResponse.json({ updated: 0 })

  const taskIds = matchingTasks.map(t => t.id)

  // Build the parent task update payload
  const taskUpdate: Record<string, unknown> = {}
  if (fields.title)     taskUpdate.title    = fields.title
  if (fields.priority)  taskUpdate.priority = fields.priority
  if ('assignee_id' in fields) taskUpdate.assignee_id = fields.assignee_id ?? null
  if ('approver_id' in fields) taskUpdate.approver_id = fields.approver_id ?? null
  if ('client_id'   in fields) taskUpdate.client_id   = fields.client_id   ?? null

  let updated = 0

  if (Object.keys(taskUpdate).length > 0) {
    const { error: updateErr } = await admin.from('tasks')
      .update(taskUpdate)
      .in('id', taskIds)
    if (updateErr) return NextResponse.json(dbError(updateErr, 'ca/propagate'), { status: 500 })
    updated += taskIds.length

    // Also cascade assignee / approver changes to compliance subtasks
    if ('assignee_id' in fields || 'approver_id' in fields) {
      const subtaskUpdate: Record<string, unknown> = {}
      if ('assignee_id' in fields) subtaskUpdate.assignee_id = fields.assignee_id ?? null
      if ('approver_id' in fields) subtaskUpdate.approver_id = fields.approver_id ?? null
      const { error: subtaskErr } = await admin.from('tasks')
        .update(subtaskUpdate)
        .in('parent_task_id', taskIds)
        .not('status', 'eq', 'completed')
        .contains('custom_fields', { _compliance_subtask: true })
      if (subtaskErr) console.error('[ca/propagate] subtask cascade error:', subtaskErr.message)
    }
  }

  // Rename subtasks whose titles match old attachment headers — run all pairs in parallel
  if (fields.attachment_headers) {
    const { old: oldH, new: newH } = fields.attachment_headers
    const renameOps = Array.from(
      { length: Math.min(oldH.length, newH.length) },
      (_, i) => {
        if (!oldH[i] || !newH[i] || oldH[i] === newH[i]) return null
        return admin.from('tasks')
          .update({ title: newH[i] })
          .in('parent_task_id', taskIds)
          .eq('title', oldH[i])
          .not('status', 'eq', 'completed')
      },
    ).filter(Boolean) as Promise<any>[]
    if (renameOps.length > 0) await Promise.all(renameOps)
  }

  return NextResponse.json({ updated })
}
