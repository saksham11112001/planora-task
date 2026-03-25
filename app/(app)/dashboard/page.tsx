import { redirect }     from 'next/navigation'
import Link             from 'next/link'
import { AlertCircle, Clock, CheckSquare, TrendingUp, ArrowRight, FolderOpen } from 'lucide-react'
import { fmtDate, todayStr } from '@/lib/utils/format'
import { getSessionUser, getOrgMembership, getUserProfile } from '@/lib/supabase/cached'
import { createClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'Home' }

// Revalidate this page every 30 seconds — serves cached HTML between revalidations
export const revalidate = 30

export default async function DashboardPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const [mb, profile] = await Promise.all([
    getOrgMembership(user.id),
    getUserProfile(user.id),
  ])
  if (!mb) redirect('/onboarding')

  const supabase  = await createClient()
  const orgId     = mb.org_id
  const today     = todayStr()
  const hour      = new Date().getHours()
  const name      = profile?.name?.split(' ')[0] ?? user.email?.split('@')[0]?.split('.')[0] ?? 'there'
  const greeting  = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const from30    = new Date(Date.now() - 30 * 86400000).toISOString()

  // All 8 queries fire in parallel — not sequentially
  const [
    { count: overdueCount },
    { count: todayCount },
    { count: pendingCount },
    { data: myTasks },
    { data: activeProjects },
    { count: completedThisMonth },
    { count: totalThisMonth },
    { data: recentClients },
  ] = await Promise.all([
    supabase.from('tasks').select('*', { count: 'exact', head: true })
      .eq('org_id', orgId).eq('assignee_id', user.id).in('status', ['todo','in_progress']).lt('due_date', today),
    supabase.from('tasks').select('*', { count: 'exact', head: true })
      .eq('org_id', orgId).eq('assignee_id', user.id).in('status', ['todo','in_progress']).eq('due_date', today),
    supabase.from('tasks').select('*', { count: 'exact', head: true })
      .eq('org_id', orgId).eq('assignee_id', user.id).eq('approval_status', 'pending'),
    supabase.from('tasks')
      .select('id, title, status, due_date, project_id, projects(id, name, color)')
      .eq('org_id', orgId).eq('assignee_id', user.id).in('status', ['todo','in_progress'])
      .order('due_date', { ascending: true, nullsFirst: false }).limit(7),
    supabase.from('projects')
      .select('id, name, color, status, due_date, client_id, clients(id, name, color)')
      .eq('org_id', orgId).eq('status', 'active').neq('is_archived', true)
      .order('updated_at', { ascending: false }).limit(4),
    supabase.from('tasks').select('*', { count: 'exact', head: true })
      .eq('org_id', orgId).eq('status', 'completed').gte('completed_at', from30),
    supabase.from('tasks').select('*', { count: 'exact', head: true })
      .eq('org_id', orgId).gte('created_at', from30),
    supabase.from('clients').select('id, name, color').eq('org_id', orgId).eq('status', 'active')
      .order('created_at', { ascending: false }).limit(5),
  ])

  const completionRate = totalThisMonth
    ? Math.round(((completedThisMonth ?? 0) / totalThisMonth) * 100)
    : 0

  return (
    <div className="page-container">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{greeting}, {name}!</h1>
        <p className="text-sm text-gray-500 mt-1">Here&apos;s your work for today</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { n: overdueCount ?? 0, label: 'Overdue',          href: '/tasks', urgent: true },
          { n: todayCount   ?? 0, label: 'Due today',         href: '/tasks', brand:  true },
          { n: pendingCount ?? 0, label: 'Awaiting approval', href: '/tasks'               },
        ].map(({ n, label, href, urgent, brand }) => (
          <Link key={label} href={href}
            className="card-elevated p-4 block hover:shadow-md transition-shadow"
            style={n > 0 && urgent ? { background: '#fef2f2', borderColor: '#fecaca' }
              : n > 0 && brand  ? { background: 'var(--brand-light)', borderColor: 'var(--brand-border)' } : {}}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              {urgent ? <AlertCircle className="h-4 w-4" style={{ color: n > 0 ? '#dc2626' : '#cbd5e1' }}/> :
               brand  ? <Clock       className="h-4 w-4" style={{ color: n > 0 ? 'var(--brand)' : '#cbd5e1' }}/> :
                         <CheckSquare className="h-4 w-4" style={{ color:'var(--text-muted)' }}/>}
              <span className="text-xs font-medium" style={{ color: n > 0 && urgent ? '#dc2626' : n > 0 && brand ? 'var(--brand)' : '#94a3b8' }}>{label}</span>
            </div>
            <p className="text-3xl font-bold" style={{ color: n > 0 && urgent ? '#dc2626' : n > 0 && brand ? 'var(--brand)' : '#cbd5e1' }}>{n}</p>
          </Link>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1.2fr 0.8fr",gap:20}}>
        {/* My tasks */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">My tasks</h2>
            <Link href="/tasks" className="text-xs flex items-center gap-1 text-teal-600 hover:text-teal-700">View all <ArrowRight className="h-3 w-3"/></Link>
          </div>
          <div className="card-elevated overflow-hidden">
            {myTasks && myTasks.length > 0 ? myTasks.map(task => {
              const isOv = task.due_date && task.due_date < today
              const proj = task.projects as unknown as { id: string; name: string; color: string } | null
              return (
                <Link key={task.id} href="/tasks"
                  className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                  <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ background: 'var(--brand)' }}/>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate text-gray-900">{task.title}</p>
                    {proj && <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1"><span style={{ width: 6, height: 6, borderRadius: 2, background: proj.color, display: 'inline-block' }}/>{proj.name}</p>}
                  </div>
                  {task.due_date && <span className="text-xs flex-shrink-0" style={{ color: isOv ? '#dc2626' : '#94a3b8' }}>{fmtDate(task.due_date)}</span>}
                </Link>
              )
            }) : (
              <div className="py-8 text-center">
                <p className="text-sm text-gray-400">No tasks assigned to you</p>
                <Link href="/inbox" className="text-xs text-teal-600 mt-1 block">Create a task →</Link>
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-900">Active projects</h2>
              <Link href="/projects" className="text-xs flex items-center gap-1 text-teal-600 hover:text-teal-700">View all <ArrowRight className="h-3 w-3"/></Link>
            </div>
            <div className="card-elevated overflow-hidden">
              {activeProjects && activeProjects.length > 0 ? activeProjects.map(p => {
                const client = p.clients as unknown as { id: string; name: string; color: string } | null
                return (
                  <Link key={p.id} href={`/projects/${p.id}`}
                    className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                    <div className="h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: p.color + '20' }}>
                      <FolderOpen className="h-3.5 w-3.5" style={{ color: p.color }}/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate text-gray-900">{p.name}</p>
                      {client && <div className="flex items-center gap-1 mt-0.5"><div className="h-2 w-2 rounded-sm" style={{ background: client.color }}/><span className="text-xs text-gray-400">{client.name}</span></div>}
                    </div>
                    {p.due_date && <span className="text-xs text-gray-400 flex-shrink-0">{fmtDate(p.due_date)}</span>}
                  </Link>
                )
              }) : (
                <div className="py-6 text-center">
                  <p className="text-sm text-gray-400">No active projects</p>
                  <Link href="/projects/new" className="text-xs text-teal-600 mt-1 block">Create project →</Link>
                </div>
              )}
            </div>
          </div>

          {/* 30-day stats */}
          <div className="card-elevated p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4" style={{ color: 'var(--brand)' }}/>
              <span className="text-sm font-semibold text-gray-900">Last 30 days</span>
            </div>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-gray-500">Completion rate</span>
                  <span className="font-semibold text-gray-900">{completionRate}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden bg-gray-100">
                  <div className="h-full rounded-full" style={{ width: `${completionRate}%`, background: completionRate >= 70 ? '#16a34a' : 'var(--brand)', transition: 'width 0.7s' }}/>
                </div>
              </div>
              <div className="flex justify-between text-xs"><span className="text-gray-500">Completed</span><span className="font-semibold text-green-600">{completedThisMonth ?? 0}</span></div>
              <div className="flex justify-between text-xs"><span className="text-gray-500">Total created</span><span className="font-semibold text-gray-700">{totalThisMonth ?? 0}</span></div>
            </div>
          </div>

          {recentClients && recentClients.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-gray-900">Clients</h2>
                <Link href="/clients" className="text-xs text-teal-600">View all</Link>
              </div>
              <div className="flex flex-wrap gap-2">
                {recentClients.map(c => (
                  <Link key={c.id} href={`/clients/${c.id}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 card text-xs font-medium hover:shadow-sm transition-shadow text-gray-700">
                    <div className="h-2.5 w-2.5 rounded-sm" style={{ background: c.color }}/>{c.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
