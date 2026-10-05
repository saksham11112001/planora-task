import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/authUser'
import { createAdminClient } from '@/lib/supabase/admin'
import type { NextRequest } from 'next/server'
import { dbError } from '@/lib/api-error'
import { getApiOrgMembership } from '@/lib/supabase/apiActiveOrg'
import { diffDates, migrateMasterDates } from '@/lib/ca/migrateMasterDates'
import type { MigrateResult } from '@/lib/ca/migrateMasterDates'

export const maxDuration = 30

/**
 * POST /api/ca/master/bulk
 *
 * Bulk-update multiple CA master tasks in a single authenticated request.
 * Auth is paid once; all DB writes fire in parallel via Promise.all.
 *
 * Body:
 *   rows — array of { id: string, ...fields } objects to update
 *
 * Returns:
 *   { saved: N, failed: M, errors: [...] }
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, req, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'No membership' }, { status: 403 })
  if (!['owner', 'admin'].includes(mb.role))
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const body = await req.json() as { rows?: Array<{ id: string; [key: string]: unknown }> }
  const { rows } = body
  if (!Array.isArray(rows) || rows.length === 0)
    return NextResponse.json({ error: 'rows array required' }, { status: 400 })

  const admin = createAdminClient()
  const now = new Date().toISOString()

  // Snapshot the dates of every row about to change, BEFORE writing, so a
  // moved due date can carry the already-spawned tasks with it. Only rows
  // that actually carry `dates` in their patch are looked up.
  const dateRowIds = rows.filter(r => 'dates' in r).map(r => r.id)
  const beforeDates = new Map<string, Record<string, string> | null>()
  if (dateRowIds.length > 0) {
    const { data: prev } = await admin.from('ca_master_tasks')
      .select('id, dates').eq('org_id', mb.org_id).in('id', dateRowIds)
    for (const p of prev ?? []) {
      beforeDates.set(p.id as string, p.dates as Record<string, string> | null)
    }
  }

  const results = await Promise.allSettled(
    rows.map(({ id, ...fields }) =>
      admin.from('ca_master_tasks')
        .update({ ...fields, updated_at: now })
        .eq('id', id)
        .eq('org_id', mb.org_id)
        .select('id')
        .single()
    )
  )

  const errors: { id: string; error: string }[] = []
  let saved = 0
  rows.forEach(({ id }, i) => {
    const r = results[i]
    if (r.status === 'fulfilled' && !r.value.error) {
      saved++
    } else {
      const err = r.status === 'rejected'
        ? String(r.reason)
        : (r.value.error?.message ?? 'Unknown error')
      errors.push({ id, error: err })
    }
  })

  // Migrate spawned tasks for every row that SAVED and whose dates moved.
  // Rows the write rejected are skipped: propagating a change that did not
  // persist would put the client tasks ahead of the master calendar.
  //
  // Sequential, not Promise.all — each migration issues several writes against
  // the same two tables, and running forty of them at once against a small
  // Postgres instance is how a save turns into a timeout.
  const dateMigrations: Record<string, MigrateResult> = {}
  const failedIds = new Set(errors.map(e => e.id))
  for (const row of rows) {
    if (failedIds.has(row.id) || !('dates' in row)) continue
    const changes = diffDates(
      beforeDates.get(row.id) ?? null,
      row.dates as Record<string, string> | null,
    )
    if (changes.length === 0) continue
    dateMigrations[row.id] = await migrateMasterDates(admin, mb.org_id, row.id, changes)
  }

  return NextResponse.json({ saved, failed: errors.length, errors, dateMigrations })
}
