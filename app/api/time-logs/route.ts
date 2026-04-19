import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { effectivePlan, canUseFeature } from '@/lib/utils/planGate'
import { NextResponse }      from 'next/server'
import type { NextRequest }  from 'next/server'
import { assertCan }         from '@/lib/utils/permissionGate'
import { dbError } from '@/lib/api-error'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { data: mb } = await supabase.from('org_members').select('org_id, role').eq('user_id', user.id).eq('is_active', true).single()
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })
  const timeLogDenied = await assertCan(supabase, mb.org_id, mb.role, 'time.log')
  if (timeLogDenied) return NextResponse.json({ error: timeLogDenied.error }, { status: timeLogDenied.status })

  // Time tracking requires Starter+ plan
  const admin = createAdminClient()
  const { data: orgData } = await admin.from('organisations')
    .select('plan_tier, status, trial_ends_at').eq('id', mb.org_id).single()
  const plan = effectivePlan(orgData ?? { plan_tier: 'free', status: 'active' })
  if (!canUseFeature(plan, 'time_tracking')) {
    return NextResponse.json({ error: 'Time tracking requires Starter plan or above. Upgrade at Settings → Billing.' }, { status: 403 })
  }

  const body = await request.json()
  const { hours, description, logged_date, project_id, task_id, is_billable = true } = body
  if (!hours || parseFloat(hours) <= 0) return NextResponse.json({ error: 'Hours must be > 0' }, { status: 400 })

  const { data, error } = await supabase.from('time_logs').insert({
    org_id:      mb.org_id,
    user_id:     user.id,
    hours:       parseFloat(hours),
    description: description || null,
    logged_date: logged_date || new Date().toISOString().split('T')[0],
    project_id:  project_id || null,
    task_id:     task_id    || null,
    is_billable: is_billable,
  }).select('*').single()
  if (error) return NextResponse.json(dbError(error, 'time-logs'), { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { data: mb } = await supabase.from('org_members').select('org_id, role').eq('user_id', user.id).eq('is_active', true).single()
  if (!mb) return NextResponse.json({ data: [] })

  const sp = request.nextUrl.searchParams
  const canSeeAll = ['owner','admin','manager'].includes(mb.role)
  let q = supabase.from('time_logs').select('id, hours, is_billable, logged_date, description, project_id, task_id, user_id').eq('org_id', mb.org_id)
  if (!canSeeAll) q = q.eq('user_id', user.id)
  if (sp.get('project_id')) q = q.eq('project_id', sp.get('project_id')!)
  if (sp.get('from')) q = q.gte('logged_date', sp.get('from')!)
  const { data, error } = await q.order('logged_date', { ascending: false }).limit(200)
  if (error) return NextResponse.json(dbError(error, 'time-logs'), { status: 500 })
  return NextResponse.json({ data })
}
