import { NextResponse }        from 'next/server'
import type { NextRequest }    from 'next/server'
import { createClient }        from '@/lib/supabase/server'
import { getAuthUser }         from '@/lib/supabase/authUser'
import { createAdminClient }   from '@/lib/supabase/admin'
import { getApiOrgMembership } from '@/lib/supabase/apiActiveOrg'
import { fetchAllRows, chunk } from '@/lib/supabase/fetchAll'
import { dbError }             from '@/lib/api-error'
import { planRollover, fyStartDate } from '@/lib/ca/rollover'
import type { MasterRef, AssignmentRef } from '@/lib/ca/rollover'

export const maxDuration = 60

/**
 * POST /api/ca/assignments/rollover
 *
 * Carry CA compliance assignments from one financial year into the next.
 *
 * Master tasks are unique on (org_id, code, financial_year), so each new year
 * gets new rows with new ids, and an assignment is bound to one year's rows.
 * Without this, switching the calendar to a new financial year leaves the new
 * year with no assignments at all and the old year's dates in the past —
 * which means NOT ONE compliance task is created for anyone, silently.
 *
 * Body: { from_fy, to_fy, dry_run? }
 *
 * dry_run returns exactly what would happen and writes nothing. The UI always
 * calls it first, because this creates assignments across every client at
 * once and the count is the only way to know it is about to do the right
 * thing.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, request, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  // Same bar as creating assignments by hand, which is what this automates.
  if (!['owner', 'admin', 'manager'].includes(mb.role)) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const fromFy = String(body.from_fy ?? '').trim()
  const toFy   = String(body.to_fy ?? '').trim()
  const dryRun = body.dry_run === true

  if (!fyStartDate(fromFy)) return NextResponse.json({ error: 'from_fy must look like 2026-27' }, { status: 400 })
  if (!fyStartDate(toFy))   return NextResponse.json({ error: 'to_fy must look like 2027-28' },   { status: 400 })
  if (fromFy === toFy)      return NextResponse.json({ error: 'from_fy and to_fy are the same' }, { status: 400 })

  const admin = createAdminClient()

  /* ── Master tasks for both years ───────────────────────────────────────── */
  const { data: masters, error: masterErr } = await fetchAllRows<MasterRef>(
    (from, to) => admin
      .from('ca_master_tasks')
      .select('id, code, financial_year')
      .eq('org_id', mb.org_id)
      .eq('is_active', true)
      .in('financial_year', [fromFy, toFy])
      .order('id', { ascending: true })
      .range(from, to),
    { maxRows: 20_000 },
  )
  if (masterErr) return NextResponse.json(dbError(masterErr, 'ca/rollover:masters'), { status: 500 })

  const fromMasters = (masters ?? []).filter(m => m.financial_year === fromFy)
  const toMasters   = (masters ?? []).filter(m => m.financial_year === toFy)

  if (fromMasters.length === 0) {
    return NextResponse.json({ error: `No tasks found in ${fromFy}` }, { status: 400 })
  }
  if (toMasters.length === 0) {
    // Without the target year's calendar there is nothing to attach to. Say so
    // plainly rather than reporting "0 carried", which reads like a no-op.
    return NextResponse.json({
      error: `${toFy} has no tasks yet. Open the CA Calendar, switch to ${toFy} and press "Load defaults" first.`,
    }, { status: 400 })
  }

  /* ── Assignments, both years ───────────────────────────────────────────── */
  // Inactive rows are fetched too: the plan has to see them in order to skip
  // them deliberately, and a target-year row that already exists must block a
  // duplicate whether it is active or not.
  const { data: assignments, error: asgErr } = await fetchAllRows<AssignmentRef & { master_task_id: string }>(
    (from, to) => admin
      .from('ca_client_assignments')
      .select('id, master_task_id, client_id, assignee_id, approver_id, end_date, is_active')
      .eq('org_id', mb.org_id)
      .order('id', { ascending: true })
      .range(from, to),
    { maxRows: 20_000 },
  )
  if (asgErr) return NextResponse.json(dbError(asgErr, 'ca/rollover:assignments'), { status: 500 })

  const fromIds = new Set(fromMasters.map(m => m.id))
  const toIds   = new Set(toMasters.map(m => m.id))
  const all     = assignments ?? []

  const plan = planRollover(
    all.filter(a => fromIds.has(a.master_task_id)),
    fromMasters,
    toMasters,
    all.filter(a => toIds.has(a.master_task_id)),
    toFy,
  )

  const summary = {
    from_fy: fromFy,
    to_fy:   toFy,
    would_create: plan.create.length,
    skipped: {
      inactive:         plan.skipped.filter(s => s.reason === 'inactive').length,
      ended:            plan.skipped.filter(s => s.reason === 'ended').length,
      no_matching_task: plan.skipped.filter(s => s.reason === 'no_matching_task').length,
      already_assigned: plan.skipped.filter(s => s.reason === 'already_assigned').length,
    },
    // The codes with no counterpart are the ones a human needs to look at.
    unmatched_codes: [...new Set(
      plan.skipped.filter(s => s.reason === 'no_matching_task').map(s => s.code),
    )].slice(0, 50),
  }

  if (dryRun) return NextResponse.json({ ...summary, dry_run: true, created: 0 })

  if (plan.create.length === 0) {
    return NextResponse.json({ ...summary, created: 0 })
  }

  /* ── Apply ─────────────────────────────────────────────────────────────── */
  const rows = plan.create.map(c => ({
    org_id:         mb.org_id,
    master_task_id: c.to_master_id,
    client_id:      c.client_id,
    assignee_id:    c.assignee_id,
    approver_id:    c.approver_id,
    start_date:     c.start_date,
    end_date:       c.end_date,
    created_by:     user.id,
    is_active:      true,
  }))

  // ignoreDuplicates, never overwrite. If a row for (task, client) already
  // exists in the target year — because someone set it up by hand, or this
  // ran twice — it keeps whatever assignee and approver it was given. The
  // plan already excludes those, so this is belt and braces against a race.
  //
  // Chunked: a few thousand rows in one statement overruns the request the
  // same way a long `.in()` list does.
  let created = 0
  for (const part of chunk(rows)) {
    const { data, error } = await admin.from('ca_client_assignments')
      .upsert(part, { onConflict: 'master_task_id,client_id', ignoreDuplicates: true })
      .select('id')
    if (error) {
      // Report what did land rather than claiming the whole thing failed —
      // the operation is idempotent, so the remedy is simply to run it again.
      return NextResponse.json(
        { ...dbError(error, 'ca/rollover:insert'), created },
        { status: 500 },
      )
    }
    created += data?.length ?? 0
  }

  return NextResponse.json({ ...summary, created })
}
