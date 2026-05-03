import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { CA_DEFAULT_TASKS } from '@/lib/data/caDefaultTasks'
import { getTasksForCountries } from '@/lib/data/caDefaultTasksByCountry'
import type { NextRequest } from 'next/server'
import { dbError } from '@/lib/api-error'

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

  const fy   = req.nextUrl.searchParams.get('fy') ?? '2026-27'
  const name = req.nextUrl.searchParams.get('name')

  let q = supabase
    .from('ca_master_tasks')
    .select(name ? 'name,attachment_count,attachment_headers' : '*')
    .eq('org_id', mb.org_id)
    .eq('is_active', true)

  if (name) {
    q = q.eq('name', name).limit(1)
  } else {
    q = q.eq('financial_year', fy).order('sort_order', { ascending: true })
  }

  const { data, error } = await q

  if (error) return NextResponse.json(dbError(error, 'ca/master'), { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const mb = await getOrgMember(supabase)
  if (!mb) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (!['owner','admin'].includes(mb.role)) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const body = await req.json()

  // Special action: load defaults (supports optional countries[] for multi-country)
  if (body.action === 'load_defaults') {
    const fy = body.financial_year ?? '2026-27'
    const countries: string[] = Array.isArray(body.countries) && body.countries.length > 0
      ? body.countries
      : ['IN']  // default to India for backward compat
    const admin = createAdminClient()
    const sourceTasks = countries.includes('IN') && countries.length === 1
      ? CA_DEFAULT_TASKS
      : getTasksForCountries(countries)
    const rows = sourceTasks.map(t => ({
      org_id: mb.org_id, financial_year: fy,
      code: t.code, name: t.name, group_name: t.group_name,
      task_type: t.task_type, dates: t.dates,
      sort_order: t.sort_order,
      days_before_due: 7,
      attachment_count: t.attachment_count ?? 0,
      attachment_headers: t.attachment_headers ?? [],
      priority: 'medium', is_active: true,
    }))
    // Upsert — always refresh defaults (attachment_count, attachment_headers, dates, sort_order)
    const { error } = await admin.from('ca_master_tasks')
      .upsert(rows, { onConflict: 'org_id,code,financial_year', ignoreDuplicates: false })
    if (error) return NextResponse.json(dbError(error, 'ca/master'), { status: 500 })
    return NextResponse.json({ success: true, count: rows.length })
  }

  // Create single task
  const { code, name, group_name, task_type, financial_year, dates, days_before_due, attachment_count, attachment_headers, priority, sort_order } = body
  if (!code || !name) return NextResponse.json({ error: 'code and name required' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin.from('ca_master_tasks').insert({
    org_id: mb.org_id, code, name, group_name: group_name ?? 'Other',
    task_type: task_type ?? '', financial_year: financial_year ?? '2026-27',
    dates: dates ?? {}, days_before_due: days_before_due ?? 7,
    attachment_count: attachment_count ?? 0,
    attachment_headers: attachment_headers ?? [],
    priority: priority ?? 'medium',
    sort_order: sort_order ?? 999,
  }).select().single()

  if (error) return NextResponse.json(dbError(error, 'ca/master'), { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
