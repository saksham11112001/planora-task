import { redirect }     from 'next/navigation'
import { getSessionUser, getUserProfile } from '@/lib/supabase/cached'
import { getActiveOrgMembership } from '@/lib/supabase/activeOrg'
import { createAdminClient } from '@/lib/supabase/admin'
import { todayStr }     from '@/lib/utils/format'
import { DashboardClient } from './DashboardClient'
import type { Metadata }   from 'next'
export const metadata: Metadata = { title: 'Home' }

export default async function DashboardPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const [mb, profile] = await Promise.all([
    getActiveOrgMembership(user.id),
    getUserProfile(user.id),
  ])
  if (!mb) redirect('/onboarding')

  const supabase = createAdminClient()
  const orgId    = mb.org_id
  const today    = todayStr()
  const hour     = new Date().getHours()
  const name     = profile?.name?.split(' ')[0] ?? user.email?.split('@')[0]?.split('.')[0] ?? 'there'
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const from30   = new Date(Date.now() - 30 * 86400000).toISOString()
  const from7    = new Date(Date.now() - 7  * 86400000).toISOString()

  // Six of the counts this page used to make were exact counts over the SAME
  // rows — this user's tasks in this org — differing only by filter. Six
  // round-trips, six passes, for numbers that one pass can produce.
  //
  // At 55 MB the whole table is in memory, so this was never disk-bound: it
  // was CPU spent counting the same rows over and over on every dashboard
  // load, by every user, all day. One scan now feeds all six.
  //
  // The cap is a backstop against an absurd row count, not a working limit —
  // this is one person's own tasks, which is hundreds, not thousands. Above it
  // the tallies would understate, so it is set far beyond anything real.
  const MY_TASK_CAP = 20_000

  const results = await Promise.allSettled([
    supabase.from('tasks')
      .select('status, due_date, approval_status, completed_at, created_at, is_archived')
      .eq('org_id', orgId).eq('assignee_id', user.id)
      .limit(MY_TASK_CAP),
    supabase.from('tasks')
      .select('id, title, status, due_date, project_id, projects(id, name, color)')
      .eq('org_id', orgId).eq('assignee_id', user.id).in('status', ['todo'])
      .order('due_date', { ascending: true, nullsFirst: false }).limit(7),
    supabase.from('projects')
      .select('id, name, color, status, due_date, client_id, clients(id, name, color)')
      .eq('org_id', orgId).eq('status', 'active').neq('is_archived', true)
      .order('updated_at', { ascending: false }).limit(4),
    supabase.from('clients').select('id, name, color').eq('org_id', orgId).eq('status', 'active')
      .order('created_at', { ascending: false }).limit(5),
    // Additional KPIs
    supabase.from('clients').select('*', { count: 'exact', head: true })
      .eq('org_id', orgId).eq('status', 'active'),
    supabase.from('org_members').select('*', { count: 'exact', head: true })
      .eq('org_id', orgId),
  ])

  // ── The six tallies, derived from the single pass above ──────────────────
  // Each condition mirrors the filter the query it replaced used, including
  // one quirk worth naming: `.neq('is_archived', true)` in SQL also drops rows
  // where the column is NULL, because NULL <> true is NULL. `is_archived ===
  // false` reproduces that exactly. `!is_archived` would NOT — it would count
  // NULL rows the old dashboard excluded, and silently change these numbers.
  type MyTaskRow = {
    status?: string | null; due_date?: string | null; approval_status?: string | null
    completed_at?: string | null; created_at?: string | null; is_archived?: boolean | null
  }
  const myTaskRows: MyTaskRow[] =
    results[0].status === 'fulfilled' ? ((results[0].value as any).data ?? []) : []

  const openStatus = (t: MyTaskRow) =>
    t.is_archived === false && (t.status === 'todo' || t.status === 'in_review')

  const overdueCount       = myTaskRows.filter(t =>
    openStatus(t) && !!t.due_date && t.due_date < today).length
  const todayCount         = myTaskRows.filter(t =>
    openStatus(t) && t.due_date === today).length
  const pendingCount       = myTaskRows.filter(t =>
    t.approval_status === 'pending').length
  const completedThisMonth = myTaskRows.filter(t =>
    t.status === 'completed' && !!t.completed_at && t.completed_at >= from30).length
  const totalThisMonth     = myTaskRows.filter(t =>
    !!t.created_at && t.created_at >= from30).length
  const weeklyCompleted    = myTaskRows.filter(t =>
    t.status === 'completed' && !!t.completed_at && t.completed_at >= from7).length

  const myTasks            = results[1].status === 'fulfilled' ? (results[1].value as any).data ?? [] : []
  const activeProjects     = results[2].status === 'fulfilled' ? (results[2].value as any).data ?? [] : []
  const recentClients      = results[3].status === 'fulfilled' ? (results[3].value as any).data ?? [] : []
  const clientsCount       = results[4].status === 'fulfilled' ? (results[4].value as any).count ?? 0 : 0
  const teamCount          = results[5].status === 'fulfilled' ? (results[5].value as any).count ?? 1 : 1

  const completionRate = totalThisMonth
    ? Math.min(100, Math.round(((completedThisMonth ?? 0) / totalThisMonth) * 100))
    : 0

  return (
    <DashboardClient
      greeting={greeting} name={name} today={today}
      overdueCount={overdueCount ?? 0}
      todayCount={todayCount ?? 0}
      pendingCount={pendingCount ?? 0}
      completedThisMonth={completedThisMonth ?? 0}
      totalThisMonth={totalThisMonth ?? 0}
      completionRate={completionRate}
      myTasks={(myTasks ?? []) as any}
      activeProjects={(activeProjects ?? []) as any}
      recentClients={recentClients ?? []}
      isAdmin={['owner','admin'].includes(mb.role)}
      clientsCount={clientsCount ?? 0}
      weeklyCompleted={weeklyCompleted ?? 0}
      teamCount={teamCount ?? 1}
    />
  )
}
