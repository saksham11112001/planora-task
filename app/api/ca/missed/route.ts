import { NextResponse }        from 'next/server'
import type { NextRequest }    from 'next/server'
import { createClient }        from '@/lib/supabase/server'
import { getAuthUser }         from '@/lib/supabase/authUser'
import { createAdminClient }   from '@/lib/supabase/admin'
import { getApiOrgMembership } from '@/lib/supabase/apiActiveOrg'
import { fetchAllRows }        from '@/lib/supabase/fetchAll'
import { dbError }             from '@/lib/api-error'
import { todayInCountry }      from '@/lib/locale/countries'
import { classifyOccurrence, withinGraceWindow } from '@/lib/ca/missedTasks'
import type { OccurrenceStatus } from '@/lib/ca/missedTasks'

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
  // Spawn records: the authoritative "this occurrence was created" marker.
  // It survives the task being deleted, which is deliberate — a task someone
  // deleted on purpose must not be reported as missing and re-created.
  const { data: instances } = await fetchAllRows<{ assignment_id: string; due_date: string }>(
    (from, to) => admin
      .from('ca_task_instances')
      .select('assignment_id, due_date')
      .eq('org_id', mb.org_id)
      .order('assignment_id', { ascending: true })
      .range(from, to),
    { maxRows: 50_000 },
  )
  const instanceKeys = new Set((instances ?? []).map(r => `${r.assignment_id}__${r.due_date}`))

  // Tasks too, matched the way the spawner matches them. Older rows predate
  // the instance table, so an instance-only check would report long-standing
  // tasks as missing.
  const { data: caTasks } = await fetchAllRows<Record<string, unknown>>(
    (from, to) => admin
      .from('tasks')
      .select('title, client_id, due_date')
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
