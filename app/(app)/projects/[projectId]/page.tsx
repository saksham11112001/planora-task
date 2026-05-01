import { createClient }      from '@/lib/supabase/server'
import { getSessionUser, getOrgMembership } from '@/lib/supabase/cached'
import { redirect }           from 'next/navigation'
import Link                   from 'next/link'
import { ArrowLeft }          from 'lucide-react'
import { ProjectView }        from './ProjectView'
import type { Metadata }      from 'next'
export const metadata: Metadata = { title: 'Project' }
export const dynamic = 'force-dynamic'

export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const user = await getSessionUser()
  if (!user) redirect('/login')
  const mb = await getOrgMembership(user.id)
  if (!mb) redirect('/onboarding')

  const supabase = await createClient()

  // All queries fire in parallel — was sequential before (500ms+ saved)
  const [
    { data: project },
    { data: tasks },
    { data: timeLogs },
    { data: members },
    { data: allClients },
  ] = await Promise.all([
    supabase.from('projects')
      .select('*, owner_id, clients(id, name, color)')
      .eq('id', projectId).eq('org_id', mb.org_id).single(),
    (() => {
      const isAdminOwner = ['owner', 'admin'].includes(mb.role)
      const tq = supabase.from('tasks')
        .select('id, title, description, status, priority, due_date, assignee_id, approver_id, client_id, project_id, approval_status, approval_required, estimated_hours, is_recurring, created_at, updated_at, is_billable, billable_amount, assignee:users!tasks_assignee_id_fkey(id, name, avatar_url), approver:users!tasks_approver_id_fkey(id, name)')
        .eq('project_id', projectId).neq('is_archived', true)
        .is('parent_task_id', null)
        .order('sort_order').order('created_at', { ascending: true })
        .limit(500)
      // Non-admin/owner only see project tasks they are involved in
      return isAdminOwner
        ? tq
        : tq.or(`assignee_id.eq.${user.id},approver_id.eq.${user.id},created_by.eq.${user.id}`)
    })(),
    supabase.from('time_logs').select('hours, is_billable').eq('project_id', projectId),
    supabase.from('org_members').select('user_id, users(id, name)').eq('org_id', mb.org_id).eq('is_active', true),
    supabase.from('clients').select('id, name, color').eq('org_id', mb.org_id).eq('status', 'active').order('name'),
  ])

  if (!project) redirect('/projects')

  const totalHours    = timeLogs?.reduce((s, l) => s + l.hours, 0) ?? 0
  const billableHours = timeLogs?.filter(l => l.is_billable).reduce((s, l) => s + l.hours, 0) ?? 0
  const memberList    = (members ?? []).map(m => ({ id: (m.users as any)?.id ?? m.user_id, name: (m.users as any)?.name ?? 'Unknown' }))
  const clientList    = (allClients ?? []).map(c => ({ id: c.id, name: c.name, color: c.color }))
  const clientMap     = Object.fromEntries(clientList.map(c => [c.id, c]))
  const canManage     = ['owner','admin','manager'].includes(mb.role)
  const projectClient = project.clients as { id: string; name: string; color: string } | null

  const taskList = (tasks ?? []).map(t => ({
    ...t,
    description: t.description ?? null, due_date: t.due_date ?? null,
    assignee_id: t.assignee_id ?? null, client_id: t.client_id ?? null,
    project_id: t.project_id ?? null, approval_status: t.approval_status ?? null,
    approval_required: t.approval_required ?? false, estimated_hours: t.estimated_hours ?? null,
    is_recurring: t.is_recurring ?? false, is_archived: false, completed_at: null, created_at: (t as any).created_at ?? '', updated_at: (t as any).updated_at ?? null,
    assignee: (t.assignee as any) ?? null,
    approver: (t.approver as any) ?? null,
    client: t.client_id ? (clientMap[t.client_id] ?? null) : null,
    project: { id: project.id, name: project.name, color: project.color },
  }))

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-5 pb-0" style={{ background: 'var(--surface)' }}>
        <div className="flex items-center justify-between mb-2">
          <Link href="/projects" className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors">
            <ArrowLeft className="h-3.5 w-3.5"/> Projects
          </Link>
          {canManage && (
            <Link href={`/projects/${projectId}/edit`}
              className="text-xs px-3 py-1.5 rounded-lg border font-medium text-gray-600 hover:text-teal-700 hover:border-teal-300 transition-colors"
              style={{ borderColor: 'var(--border)' }}>Edit project</Link>
          )}
        </div>
        <div className="flex items-center gap-3 mb-1">
          <div className="h-8 w-8 rounded-lg flex-shrink-0" style={{ background: project.color }}/>
          <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
        </div>
        {projectClient && (
          <Link href={`/clients/${projectClient.id}`}
            className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-teal-600 mb-2 transition-colors">
            <div className="h-2.5 w-2.5 rounded-sm" style={{ background: projectClient.color }}/>{projectClient.name}
          </Link>
        )}
      </div>
      <ProjectView
        project={project as any} tasks={taskList as any}
        members={memberList} clients={clientList}
        defaultClientId={projectClient?.id ?? ''}
        projectOwnerId={project.owner_id ?? undefined}
        canManage={canManage} currentUserId={user.id} userRole={mb.role}
        totalHours={totalHours} billableHours={billableHours}/>
    </div>
  )
}
