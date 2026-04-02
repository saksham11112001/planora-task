export const dynamic = 'force-dynamic'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse }       from 'next/server'
import type { NextRequest }   from 'next/server'

function isPaidPlan(planTier: string, status: string, trialEndsAt: string|null): boolean {
  if (status === 'trialing' && trialEndsAt && new Date(trialEndsAt) > new Date()) return true
  return ['starter','pro','business'].includes(planTier)
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: mb } = await supabase.from('org_members')
    .select('org_id, role').eq('user_id', user.id).eq('is_active', true).maybeSingle()
  if (!mb) return NextResponse.json({ data: [] })

  const from30 = new Date(Date.now() - 30*86400000).toISOString()
  const { data } = await supabase.from('tasks')
    .select('id, title, status, priority, due_date, deleted_at, project_id, projects(name)')
    .eq('org_id', mb.org_id)
    .eq('is_archived', true)
    .gte('deleted_at', from30)
    .order('deleted_at', { ascending: false })
    .limit(100)

  return NextResponse.json({ data: data ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: mb } = await supabase.from('org_members')
    .select('org_id, role, organisations(plan_tier, status, trial_ends_at)')
    .eq('user_id', user.id).eq('is_active', true).maybeSingle()
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })

  // Check paid plan
  const org = mb.organisations as any
  if (!isPaidPlan(org?.plan_tier, org?.status, org?.trial_ends_at)) {
    return NextResponse.json({
      error: 'Trash recovery is available on paid plans (Starter, Pro, Business). Upgrade to restore tasks.'
    }, { status: 402 })
  }

  const { task_id } = await request.json()
  if (!task_id) return NextResponse.json({ error: 'task_id required' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('tasks')
    .update({ is_archived: false, deleted_at: null, status: 'todo' })
    .eq('id', task_id)
    .eq('org_id', mb.org_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// DELETE: permanently purge tasks older than 30 days (called by cron)
export async function DELETE(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const cutoff = new Date(Date.now() - 30*86400000).toISOString()
  const { count } = await admin.from('tasks')
    .delete({ count: 'exact' })
    .eq('is_archived', true)
    .lt('deleted_at', cutoff)

  return NextResponse.json({ purged: count ?? 0 })
}
