import { createClient }      from '@/lib/supabase/server'
import { createAdminClient }  from '@/lib/supabase/admin'
import { NextResponse }       from 'next/server'
import type { NextRequest }   from 'next/server'
import { inferGranularFrequency, nextOccurrence } from '@/lib/utils/recurringSchedule'
import { getApiOrgMembership } from '@/lib/supabase/apiActiveOrg'

/**
 * POST /api/recurring/recalculate
 *
 * Fixes next_occurrence_date for all recurring templates in the org whose
 * stored date doesn't match what the inferred granular frequency requires.
 *
 * Safety rules:
 *  - Only updates tasks where next_occurrence_date is strictly in the FUTURE
 *    (tasks due today/overdue are left for the daily spawn job).
 *  - Computes the "correct" date as nextOccurrence(inferredGranular, dayBefore(stored))
 *    so that a correctly-stored date returns itself unchanged.
 *  - Only manager / owner / admin may call this.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, req, 'org_id, role')
  if (!mb || !['owner', 'admin', 'manager'].includes(mb.role))
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 })

  const admin = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  // Fetch all future-dated recurring templates for this org.
  const { data: tasks, error } = await admin
    .from('tasks')
    .select('id, frequency, next_occurrence_date')
    .eq('org_id', mb.org_id)
    .eq('is_recurring', true)
    .neq('is_archived', true)
    .gt('next_occurrence_date', today) // only future-dated — leave today/overdue to spawn job

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!tasks?.length) return NextResponse.json({ updated: 0 })

  let updated = 0
  const updates: Promise<unknown>[] = []

  for (const task of tasks) {
    const { frequency, next_occurrence_date: stored } = task
    if (!frequency || !stored) continue

    // Infer the granular frequency the user originally intended.
    const granular = inferGranularFrequency(frequency, stored)

    // Compute the correct date: next occurrence AFTER the day before the stored date.
    // For a correctly-stored date this returns the stored date itself (no change).
    // For a date that is off by one (old timezone bug) this returns stored + 1 day.
    const [y, m, d] = stored.split('-').map(Number)
    const prevDate = new Date(y, m - 1, d - 1) // month-boundary-safe previous day
    const dayBeforeStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-${String(prevDate.getDate()).padStart(2, '0')}`

    const correct = nextOccurrence(granular, dayBeforeStr)
    if (correct === stored) continue // already correct, skip

    updates.push(
      (async () => {
        await admin.from('tasks').update({ next_occurrence_date: correct }).eq('id', task.id)
        updated++
      })()
    )
  }

  await Promise.all(updates)
  return NextResponse.json({ updated })
}
