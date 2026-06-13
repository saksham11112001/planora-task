import { createClient }      from '@/lib/supabase/server'
import { createAdminClient }  from '@/lib/supabase/admin'
import { NextResponse }       from 'next/server'
import type { NextRequest }   from 'next/server'
import { getApiOrgMembership } from '@/lib/supabase/apiActiveOrg'
import { todayStr }            from '@/lib/utils/format'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, req, 'org_id, role, organisations(name), users(name)')
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })
  if (!['owner', 'admin'].includes(mb.role))
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
  if (!ANTHROPIC_API_KEY) return NextResponse.json({ error: 'AI not configured' }, { status: 503 })

  const admin  = createAdminClient()
  const orgId  = mb.org_id
  const today  = todayStr()
  const from7  = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]

  const [overdueRes, todayRes, inReviewRes, completedRes, riskRes] = await Promise.all([
    admin.from('tasks').select('*', { count: 'exact', head: true })
      .eq('org_id', orgId).neq('is_archived', true)
      .in('status', ['todo','in_progress']).lt('due_date', today),
    admin.from('tasks').select('*', { count: 'exact', head: true })
      .eq('org_id', orgId).neq('is_archived', true)
      .in('status', ['todo','in_progress']).eq('due_date', today),
    admin.from('tasks').select('*', { count: 'exact', head: true })
      .eq('org_id', orgId).eq('status', 'in_review').eq('approval_status', 'pending'),
    admin.from('tasks').select('*', { count: 'exact', head: true })
      .eq('org_id', orgId).eq('status', 'completed').gte('completed_at', from7),
    // clients with tasks due in next 7 days not yet started
    admin.from('tasks')
      .select('client_id, clients(name)', { count: 'exact' })
      .eq('org_id', orgId).eq('status', 'todo')
      .not('client_id', 'is', null)
      .gte('due_date', today)
      .lte('due_date', new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0])
      .limit(5),
  ])

  const overdueCount    = overdueRes.count ?? 0
  const todayCount      = todayRes.count ?? 0
  const pendingApproval = inReviewRes.count ?? 0
  const completedWeek   = completedRes.count ?? 0
  const riskClients     = [...new Set((riskRes.data ?? []).map((t: any) => (t as any).clients?.name).filter(Boolean))].slice(0, 3)

  const orgName  = (mb.organisations as any)?.name ?? 'your org'
  const userName = (mb.users as any)?.name?.split(' ')[0] ?? 'there'

  const prompt = `You are a smart assistant for an Indian CA firm called "${orgName}". Write a 2-3 sentence daily briefing for ${userName} based on these stats:
- Overdue tasks: ${overdueCount}
- Due today: ${todayCount}
- Pending approvals: ${pendingApproval}
- Completed this week: ${completedWeek}
- Clients with tasks due in next 7 days (not started): ${riskClients.length > 0 ? riskClients.join(', ') : 'none'}

Be concise, warm, and actionable. Don't repeat the numbers verbatim — turn them into insight. No bullet points.`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const data    = await res.json()
  const summary = data.content?.[0]?.text?.trim() ?? ''
  return NextResponse.json({ summary })
}
