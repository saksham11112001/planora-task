import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/authUser'
import { createAdminClient } from '@/lib/supabase/admin'
import type { NextRequest } from 'next/server'
import { dbError } from '@/lib/api-error'
import { getApiOrgMembership } from '@/lib/supabase/apiActiveOrg'

export const maxDuration = 30

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const mb = await getApiOrgMembership(supabase, user.id, req, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const admin = createAdminClient()

  const clientId       = req.nextUrl.searchParams.get('client_id')
  // include_inactive=true is used by the CA kanban board so paused assignments
  // are still returned and can be shown in the "Paused" section with an Activate button.
  // All other callers (e.g. CAClientSetupView) omit this param and get only active ones.
  const includeInactive = req.nextUrl.searchParams.get('include_inactive') === 'true'

  let query = admin
    .from('ca_client_assignments')
    .select(`
      *,
      master_task:ca_master_tasks(id, code, name, group_name, task_type, dates, days_before_due, attachment_count, attachment_headers, priority, financial_year),
      client:clients(id, name, color),
      assignee:users!ca_client_assignments_assignee_id_fkey(id, name),
      approver:users!ca_client_assignments_approver_id_fkey(id, name)
    `)
    .eq('org_id', mb.org_id)
    .order('created_at', { ascending: false })

  if (!includeInactive) query = query.eq('is_active', true)

  if (clientId) query = query.eq('client_id', clientId)
  const { data, error } = await query

  if (error) return NextResponse.json(dbError(error, 'ca/assignments'), { status: 500 })
  return NextResponse.json({ data: data ?? [] }, {
    headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=300' },
  })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const mb = await getApiOrgMembership(supabase, user.id, req, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (!['owner','admin','manager'].includes(mb.role)) return NextResponse.json({ error: 'Permission denied' }, { status: 403 })

  const body = await req.json()
  const { assignments } = body  // array of { master_task_id, client_id, assignee_id, approver_id }
  if (!Array.isArray(assignments) || assignments.length === 0)
    return NextResponse.json({ error: 'assignments array required' }, { status: 400 })

  const admin = createAdminClient()
  const rows = assignments.map((a: { master_task_id: string; client_id: string; assignee_id?: string; approver_id?: string; start_date?: string }) => ({
    org_id: mb.org_id,
    master_task_id: a.master_task_id,
    client_id: a.client_id,
    assignee_id: a.assignee_id ?? null,
    approver_id: a.approver_id ?? null,
    start_date: a.start_date ?? null,
    created_by: user.id,
    is_active: true,
  }))

  const { data, error } = await admin.from('ca_client_assignments')
    .upsert(rows, { onConflict: 'master_task_id,client_id', ignoreDuplicates: false })
    .select()

  if (error) return NextResponse.json(dbError(error, 'ca/assignments'), { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
