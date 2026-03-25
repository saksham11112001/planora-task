import { createClient }       from '@/lib/supabase/server'
import { redirect }           from 'next/navigation'
import Link                   from 'next/link'
import { ArrowLeft, FolderOpen, ExternalLink, Pencil, Clock, CheckSquare, AlertCircle } from 'lucide-react'
import { ProjectStatusBadge } from '@/components/ui/Badge'
import { fmtDate, fmtHours }  from '@/lib/utils/format'
import type { Metadata }      from 'next'
export const metadata: Metadata = { title: 'Client' }
export const revalidate = 30

export default async function ClientDetailPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: mb } = await supabase.from('org_members').select('org_id, role').eq('user_id', user.id).eq('is_active', true).single()
  if (!mb) redirect('/onboarding')

  const { data: client } = await supabase.from('clients').select('*').eq('id', clientId).eq('org_id', mb.org_id).single()
  if (!client) redirect('/clients')

  const { data: projects } = await supabase.from('projects')
    .select('id, name, status, due_date, color').eq('client_id', clientId).neq('is_archived', true)
    .order('updated_at', { ascending: false })

  const projectIds = projects?.map(p => p.id) ?? []

  // Parallel: task counts + time logs for all projects
  const [{ data: taskData }, { data: timeLogs }] = await Promise.all([
    supabase.from('tasks').select('project_id, status').in('project_id', projectIds),
    supabase.from('time_logs').select('hours, is_billable, project_id').in('project_id', projectIds),
  ])

  // Per-project task counts
  const counts: Record<string, { total: number; done: number }> = {}
  taskData?.forEach(t => {
    if (!t.project_id) return
    if (!counts[t.project_id]) counts[t.project_id] = { total: 0, done: 0 }
    counts[t.project_id].total++
    if (t.status === 'completed') counts[t.project_id].done++
  })

  // Aggregate stats
  const totalTasks    = taskData?.length ?? 0
  const doneTasks     = taskData?.filter(t => t.status === 'completed').length ?? 0
  const totalHours    = timeLogs?.reduce((s, l) => s + (l.hours ?? 0), 0) ?? 0
  const billableHours = timeLogs?.filter(l => l.is_billable).reduce((s, l) => s + (l.hours ?? 0), 0) ?? 0
  const canManage     = ['owner', 'admin', 'manager'].includes(mb.role)

  return (
    <div className="page-container">
      <div className="content-max">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link href="/clients" className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors">
            <ArrowLeft className="h-3.5 w-3.5"/> Clients
          </Link>
          {canManage && (
            <Link href={`/clients/${client.id}/edit`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-gray-200 rounded-lg text-gray-600 hover:border-teal-300 hover:text-teal-700 transition-colors">
              <Pencil className="h-3.5 w-3.5"/> Edit
            </Link>
          )}
        </div>

        {/* Client card */}
        <div className="card-elevated p-6 mb-6">
          <div className="flex items-start gap-4 mb-5">
            <div className="h-14 w-14 rounded-2xl flex items-center justify-center text-white text-2xl font-bold flex-shrink-0"
              style={{ background: client.color }}>
              {client.name[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-gray-900">{client.name}</h1>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                  client.status === 'active'   ? 'bg-green-100 text-green-700' :
                  client.status === 'prospect' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                  {client.status}
                </span>
              </div>
              {client.company  && <p className="text-sm text-gray-500 mb-0.5">{client.company}</p>}
              {client.industry && <p className="text-xs text-gray-400">{client.industry}</p>}
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-4 py-4 border-t border-b border-gray-100 mb-4">
            {[
              { icon: FolderOpen,    label: 'Projects',     value: projects?.length ?? 0,           color: '#0d9488' },
              { icon: CheckSquare,   label: 'Tasks done',   value: `${doneTasks}/${totalTasks}`,    color: '#16a34a' },
              { icon: Clock,         label: 'Hours logged', value: fmtHours(totalHours),            color: '#7c3aed' },
              { icon: AlertCircle,   label: 'Billable hrs', value: fmtHours(billableHours),         color: '#ca8a04' },
            ].map(({ icon: Icon, label, value, color }) => (
              <div key={label} className="text-center">
                <div className="flex justify-center mb-1.5">
                  <Icon className="h-4 w-4" style={{ color }}/>
                </div>
                <div className="text-xl font-bold" style={{ color }}>{value}</div>
                <div className="text-xs text-gray-400 mt-0.5">{label}</div>
              </div>
            ))}
          </div>

          {/* Contact info */}
          <div className="grid grid-cols-2 gap-4">
            {client.email && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Email</p>
                <a href={`mailto:${client.email}`} className="text-sm text-teal-600 hover:underline">{client.email}</a>
              </div>
            )}
            {client.phone && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Phone</p>
                <a href={`tel:${client.phone}`} className="text-sm text-gray-700">{client.phone}</a>
              </div>
            )}
            {client.website && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Website</p>
                <a href={client.website} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-teal-600 hover:underline flex items-center gap-1">
                  {client.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                  <ExternalLink className="h-3 w-3"/>
                </a>
              </div>
            )}
            {client.notes && (
              <div className="col-span-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Notes</p>
                <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{client.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Projects */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900">Projects ({projects?.length ?? 0})</h2>
          {canManage && (
            <Link href={`/projects/new?client=${client.id}`}
              className="text-xs text-teal-600 hover:text-teal-700 font-medium">+ New project</Link>
          )}
        </div>

        {!projects?.length ? (
          <div className="card p-10 text-center">
            <FolderOpen className="h-10 w-10 text-gray-200 mx-auto mb-3"/>
            <p className="text-sm text-gray-400">No projects yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {projects.map(p => {
              const cnt = counts[p.id] ?? { total: 0, done: 0 }
              const pct = cnt.total > 0 ? Math.round((cnt.done / cnt.total) * 100) : 0
              return (
                <Link key={p.id} href={`/projects/${p.id}`}
                  className="card-elevated flex items-center gap-4 p-4 hover:shadow-md transition-shadow block">
                  <div className="h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: p.color + '22' }}>
                    <FolderOpen className="h-4 w-4" style={{ color: p.color }}/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-sm font-medium text-gray-900 truncate">{p.name}</span>
                      <ProjectStatusBadge status={p.status}/>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: p.color }}/>
                      </div>
                      <span className="text-xs text-gray-400 flex-shrink-0">{cnt.done}/{cnt.total}</span>
                    </div>
                  </div>
                  {p.due_date && <span className="text-xs text-gray-400 flex-shrink-0">{fmtDate(p.due_date)}</span>}
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
