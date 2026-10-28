import { NextResponse }        from 'next/server'
import type { NextRequest }    from 'next/server'
import { createClient }        from '@/lib/supabase/server'
import { getAuthUser }         from '@/lib/supabase/authUser'
import { createAdminClient }   from '@/lib/supabase/admin'
import { getApiOrgMembership } from '@/lib/supabase/apiActiveOrg'
import { fetchAllRows }        from '@/lib/supabase/fetchAll'
import { dbError }             from '@/lib/api-error'
import { todayInCountry }      from '@/lib/locale/countries'
import { classifyOccurrence, withinGraceWindow } from '@/lib/ca/spawnDecision'
import type { OccurrenceStatus } from '@/lib/ca/spawnDecision'

export const maxDuration = 60

/**
 * GET /api/ca/missed
 *
 * Which CA compliance tasks SHOULD exist by now, and which do not.
 *
 * READ ONLY. It creates nothing and changes nothing; pressing "Spawn tasks
 * now" is a separate, deliberate action.
 *
 * This exists because answering the question previously required exporting
 * everything and building a spreadsheet — and that spreadsheet reported 562
 * missing tasks when 529 of them were dates before the client had been
 * onboarded, which is correct behaviour. The real number was 33. Counting
 * the two together makes a working system look broken and buries the cases
 * that matter.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, request, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'Not a member' }, { status: 403 })
  // Same bar as the spawn trigger this report is read alongside.
  if (!['owner', 'admin', 'manager'].includes(mb.role)) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  }

  const admin = createAdminClient()

  // The ORG's today. Reading the server clock would roll Indian dates over
  // at 5:30am local and misclassify a day's worth of occurrences.
  const { data: settings } = await admin.from('org_settings')
    .select('locale').eq('org_id', mb.org_id).maybeSingle()
  const today = todayInCountry((settings?.locale as { country?: string } | null)?.country)

  /* ── Assignments, with their master task and client ────────────────────── */
  const { data: assignments, error: asgErr } = await fetchAllRows<Record<string, unknown>>(
    (from, to) => admin
      .from('ca_client_assignments')
      // Same join shape as /api/ca/trigger. No explicit FK constraint name:
      // there is exactly one FK to ca_master_tasks, so the short form is
      // unambiguous, and a guessed constraint name would 500 at runtime.
      .select(`
        id, client_id, created_at, start_date, end_date,
        master_task:ca_master_tasks(id, name, group_name, dates, days_before_due)
      `)
      .eq('org_id', mb.org_id)
      // Inactive assignments are not supposed to spawn, so reporting their
      // gaps as missing would be noise. The spawner filters the same way.
      .eq('is_active', true)
      .order('id', { ascending: true })
      .range(from, to),
    { maxRows: 20_000 },
  )
  if (asgErr) return NextResponse.json(dbError(asgErr, 'ca/missed:assignments'), { status: 500 })

  /* ── Client names, looked up separately ────────────────────────────────── */
  // A join would need the clients FK spelled out; a plain map avoids the
  // question entirely and is one small query.
  const { data: clientRows } = await admin.from('clients')
    .select('id, name').eq('org_id', mb.org_id).limit(5000)
  const clientNames = new Map((clientRows ?? []).map(c => [c.id as string, c.name as string]))

  /* ── What already exists ───────────────────────────────────────────────── */
  // Spawn records: the "this occurrence was created" marker.
  //
  // A record whose task_id is NULL no longer counts. task_id is
  // `REFERENCES tasks(id) ON DELETE SET NULL`, so deleting a compliance task
  // leaves the record behind pointing at nothing.
  //
  // This previously counted those as created, on the reasoning that a task
  // deleted on purpose should not be reported as missing. The effect was the
  // opposite of intended: the obligation vanished from the board AND from this
  // report, the nightly job skipped it as 'already_exists' for ever, and a
  // firm had no way to find out. A statutory filing disappeared in silence.
  //
  // Reporting is not recreating. This report only tells a firm the task is
  // gone; the nightly job still leaves it alone, so nothing resurrects by
  // surprise. Whoever deleted it can ignore the row, and whoever deleted it by
  // mistake can now see that they did.
  const { data: instances } = await fetchAllRows<{ assignment_id: string; due_date: string; task_id: string | null }>(
    (from, to) => admin
      .from('ca_task_instances')
      .select('assignment_id, due_date, task_id')
      .eq('org_id', mb.org_id)
      .order('assignment_id', { ascending: true })
      .range(from, to),
    { maxRows: 50_000 },
  )
  const instanceKeys = new Set(
    // Built below, once the task ids are known -- see the note there.
    [] as string[],
  )

  // Tasks too, matched the way the spawner matches them. Older rows predate
  // the instance table, so an instance-only check would report long-standing
  // tasks as missing.
  const { data: caTasks } = await fetchAllRows<Record<string, unknown>>(
    (from, to) => admin
      .from('tasks')
      .select('id, title, client_id, due_date')
      .eq('org_id', mb.org_id)
      .is('parent_task_id', null)
      .contains('custom_fields', { _ca_compliance: true })
      .order('id', { ascending: true })
      .range(from, to),
    { maxRows: 50_000 },
  )
  const taskKeys = new Set(
    (caTasks ?? []).map(t => `${t.title}__${t.client_id ?? ''}__${t.due_date ?? ''}`),
  )

  // A spawn record counts only while its task is still there. Membership is
  // tested against the ids present in `tasks`, not by checking task_id is not
  // null: the FK that is supposed to null it on delete
  // (`REFERENCES tasks(id) ON DELETE SET NULL`) is missing on at least one
  // live database, and without it a deleted task leaves task_id pointing at a
  // dead id. A null check reports that as healthy, which is precisely how a
  // deleted obligation went on counting as done.
  const liveTaskIds = new Set((caTasks ?? []).map(t => t.id as string))
  for (const r of instances ?? []) {
    if (r.task_id !== null && liveTaskIds.has(r.task_id)) {
      instanceKeys.add(`${r.assignment_id}__${r.due_date}`)
    }
  }

  /* ── Walk every assignment x every calendar date ───────────────────────── */
  interface Row {
    client: string; group: string; task: string
    due_date: string; month_key: string
    status: OccurrenceStatus
    recoverable: boolean     // will tonight's run pick it up on its own?
  }

  const rows: Row[] = []
  const counts: Record<OccurrenceStatus, number> = {
    present: 0, before_start: 0, after_end: 0, not_due_yet: 0, missed: 0,
  }

  for (const asgn of assignments ?? []) {
    const master = asgn.master_task as {
      name?: string; group_name?: string
      dates?: Record<string, string>; days_before_due?: number
    } | null
    if (!master) continue

    const clientName = clientNames.get(String(asgn.client_id ?? '')) ?? 'Unknown client'
    const dates = master.dates ?? {}

    // Mirrors the spawner: an explicit start_date wins, otherwise the date the
    // assignment was created.
    const startDate = (asgn.start_date as string | null)
      ?? String(asgn.created_at ?? '').split('T')[0]
      ?? today
    const endDate = (asgn.end_date as string | null) ?? null

    for (const [monthKey, dueDate] of Object.entries(dates)) {
      if (!dueDate) continue

      const exists =
        instanceKeys.has(`${asgn.id}__${dueDate}`) ||
        taskKeys.has(`${master.name}__${asgn.client_id ?? ''}__${dueDate}`)

      const status = classifyOccurrence({
        dueDate, startDate, endDate,
        daysBeforeDue: master.days_before_due ?? 7,
        exists, today,
      })

      counts[status]++
      if (status !== 'missed') continue

      rows.push({
        client:      clientName,
        group:       master.group_name ?? '—',
        task:        master.name ?? '—',
        due_date:    dueDate,
        month_key:   monthKey,
        status,
        // Inside the grace window the nightly job will create it without
        // anyone doing anything. Outside it, only "Spawn tasks now" will.
        recoverable: withinGraceWindow(dueDate, today),
      })
    }
  }

  rows.sort((a, b) =>
    a.due_date.localeCompare(b.due_date) || a.client.localeCompare(b.client))

  return NextResponse.json({
    today,
    counts,
    total: Object.values(counts).reduce((a, b) => a + b, 0),
    missed: rows,
  })
}
