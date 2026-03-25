import { effectivePlan, isAtProjectLimit, projectLimit } from '@/lib/utils/planGate'
import { createClient } from '@/lib/supabase/server'
import { NextResponse }  from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { data: mb } = await supabase.from('org_members').select('org_id').eq('user_id', user.id).eq('is_active', true).single()
  if (!mb) return NextResponse.json({ data: [] })
  const sp  = request.nextUrl.searchParams
  const lim = parseInt(sp.get('limit') ?? '100')
  const { data, error } = await supabase.from('projects')
    .select('id, name, color, status, due_date, client_id')
    .eq('org_id', mb.org_id).neq('is_archived', true)
    .order('updated_at', { ascending: false }).limit(lim)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { data: mb } = await supabase.from('org_members').select('org_id, role').eq('user_id', user.id).eq('is_active', true).single()
  if (!mb || !['owner','admin','manager'].includes(mb.role))
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 })

  // Enforce project limit based on plan
  const { data: orgData } = await supabase.from('organisations')
    .select('plan_tier, status, trial_ends_at').eq('id', mb.org_id).single()
  const { count: projectCount } = await supabase.from('projects')
    .select('*', { count: 'exact', head: true }).eq('org_id', mb.org_id).neq('is_archived', true)
  const plan = effectivePlan(orgData ?? { plan_tier: 'free', status: 'active' })
  if (isAtProjectLimit(plan, projectCount ?? 0)) {
    return NextResponse.json({
      error: `Your ${plan} plan allows up to ${projectLimit(plan)} projects. Upgrade to create more.`
    }, { status: 403 })
  }
  const body = await request.json()
  if (!body.name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })
  const { data, error } = await supabase.from('projects').insert({
    org_id:      mb.org_id,
    name:        body.name.trim(),
    description: body.description || null,
    color:       body.color       || '#0d9488',
    client_id:   body.client_id   || null,
    owner_id:    body.owner_id    || user.id,
    due_date:    body.due_date    || null,
    budget:      body.budget      ?? null,
    hours_budget:body.hours_budget ?? null,
    status:      'active',
  }).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
