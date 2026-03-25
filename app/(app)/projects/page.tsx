import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import Link             from 'next/link'
import { Plus, FolderOpen, CheckSquare, Clock } from 'lucide-react'
import { ProjectStatusBadge } from '@/components/ui/Badge'
import { fmtDate }            from '@/lib/utils/format'
import type { Metadata }      from 'next'
export const metadata: Metadata = { title: 'Projects' }
export const revalidate = 20

export default async function ProjectsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: mb } = await supabase.from('org_members')
    .select('org_id, role').eq('user_id', user.id).eq('is_active', true).single()
  if (!mb) redirect('/onboarding')

  const { data: projects } = await supabase.from('projects')
    .select('*, clients(id, name, color)')
    .eq('org_id', mb.org_id).neq('is_archived', true)
    .order('updated_at', { ascending: false })

  // Task counts per project
  const { data: taskCounts } = await supabase.from('tasks')
    .select('project_id, status').eq('org_id', mb.org_id).not('project_id', 'is', null)

  const counts: Record<string, { total: number; done: number }> = {}
  taskCounts?.forEach(t => {
    if (!t.project_id) return
    if (!counts[t.project_id]) counts[t.project_id] = { total: 0, done: 0 }
    counts[t.project_id].total++
    if (t.status === 'completed') counts[t.project_id].done++
  })

  const canManage = ['owner','admin','manager'].includes(mb.role)

  const active    = projects?.filter(p => p.status === 'active')     ?? []
  const onHold    = projects?.filter(p => p.status === 'on_hold')    ?? []
  const completed = projects?.filter(p => p.status === 'completed')  ?? []

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-sm text-gray-500 mt-1">{projects?.length ?? 0} projects total</p>
        </div>
        {canManage && (
          <Link href="/projects/new"
            className="btn btn-brand flex items-center gap-2">
            <Plus className="h-4 w-4"/> New project
          </Link>
        )}
      </div>

      {(!projects || projects.length === 0) && (
        <div className="card text-center py-16">
          <FolderOpen className="h-12 w-12 text-gray-200 mx-auto mb-3"/>
          <h3 className="font-semibold text-gray-900 mb-1">No projects yet</h3>
          <p className="text-sm text-gray-400 mb-4">Create your first project to organise your work</p>
          {canManage && <Link href="/projects/new" className="btn btn-brand">Create project</Link>}
        </div>
      )}

      {[{ label: 'Active', items: active }, { label: 'On hold', items: onHold }, { label: 'Completed', items: completed }].map(group => {
        if (group.items.length === 0) return null
        return (
          <div key={group.label} className="mb-8">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{group.label} ({group.items.length})</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {group.items.map(p => {
                const client   = p.clients as { id: string; name: string; color: string } | null
                const cnt      = counts[p.id] ?? { total: 0, done: 0 }
                const progress = cnt.total > 0 ? Math.round((cnt.done / cnt.total) * 100) : 0
                return (
                  <Link key={p.id} href={`/projects/${p.id}`}
                    className="card-elevated p-5 hover:shadow-md transition-shadow block">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-lg flex items-center justify-center text-white flex-shrink-0" style={{ background: p.color }}>
                          <FolderOpen className="h-4 w-4"/>
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-gray-900 truncate">{p.name}</h3>
                          {client && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <div className="h-2 w-2 rounded-sm" style={{ background: client.color }}/>
                              <span className="text-xs text-gray-400 truncate">{client.name}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <ProjectStatusBadge status={p.status as any}/>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>{cnt.done}/{cnt.total} tasks</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: p.color }}/>
                      </div>
                    </div>
                    {p.due_date && (
                      <div className="flex items-center gap-1 mt-3 text-xs text-gray-400">
                        <Clock className="h-3 w-3"/>
                        Due {fmtDate(p.due_date, { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
