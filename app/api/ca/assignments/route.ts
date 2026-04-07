import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { NextRequest } from 'next/server'

async function getOrgMember(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: mb } = await supabase.from('org_members').select('org_id, role').eq('user_id', user.id).eq('is_active', true).single()
  return mb ? { ...mb, user_id: user.id } : null
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const mb = await getOrgMember(supabase)
  if (!mb) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const clientId = req.nextUrl.searchParams.get('client_id')
  let query = supabase
    .from('ca_client_assignments')
    .select(`
      *,
      master_task:ca_master_tasks(id, code, name, group_name, task_type, dates, days_before_due, attachment_count, attachment_headers, priority, financial_year),
      client:clients(id, name, color),
      assignee:users!ca_client_assignments_assignee_id_fkey(id, name),
      approver:users!ca_client_assignments_approver_id_fkey(id, name)
    `)
    .eq('org_id', mb.org_id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (clientId) query = query.eq('client_id', clientId)
  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const mb = await getOrgMember(supabase)
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
    created_by: mb.user_id,
    is_active: true,
  }))

  const { data, error } = await admin.from('ca_client_assignments')
    .upsert(rows, { onConflict: 'master_task_id,client_id', ignoreDuplicates: false })
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
