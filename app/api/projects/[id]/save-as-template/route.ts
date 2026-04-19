import { createClient } from '@/lib/supabase/server'
import { NextResponse }  from 'next/server'
import type { NextRequest } from 'next/server'
import { dbError } from '@/lib/api-error'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: mb } = await supabase
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })

  const canManage = ['owner', 'admin', 'manager'].includes(mb.role)
  if (!canManage) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Verify the project belongs to this org
  const { data: project } = await supabase
    .from('projects')
    .select('id, name, color')
    .eq('id', projectId)
    .eq('org_id', mb.org_id)
    .maybeSingle()
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  // Fetch all non-archived, non-deleted tasks for the project
  const { data: allTasks, error: tasksErr } = await supabase
    .from('tasks')
    .select('id, title, priority, parent_task_id')
    .eq('project_id', projectId)
    .eq('org_id', mb.org_id)
    .neq('is_archived', true)
    .is('deleted_at', null)
    .order('sort_order')
    .order('created_at', { ascending: true })

  if (tasksErr) return NextResponse.json(dbError(tasksErr, 'projects/[id]/save-as-template'), { status: 500 })

  const tasks = allTasks ?? []
  const parents  = tasks.filter(t => !t.parent_task_id)
  const children = tasks.filter(t =>  t.parent_task_id)

  const templateTasks = parents.map(p => ({
    title:    p.title,
    priority: p.priority ?? 'medium',
    subtasks: children
      .filter(c => c.parent_task_id === p.id)
      .map(c => c.title),
  }))

  // Read existing org templates
  const { data: existing } = await supabase
    .from('org_feature_settings')
    .select('config')
    .eq('org_id', mb.org_id)
    .eq('feature_key', 'project_templates')
    .maybeSingle()

  const currentTemplates: any[] = (existing?.config as any) ?? []

  // Replace if already saved, otherwise append
  const alreadyIndex = currentTemplates.findIndex((t: any) => t.id === project.id)
  const newEntry = {
    id:             project.id,
    name:           project.name,
    color:          project.color,
    template_tasks: templateTasks,
  }

  const updatedTemplates =
    alreadyIndex >= 0
      ? currentTemplates.map((t: any, i: number) => (i === alreadyIndex ? newEntry : t))
      : [...currentTemplates, newEntry]

  const { error: upsertErr } = await supabase
    .from('org_feature_settings')
    .upsert({
      org_id:      mb.org_id,
      feature_key: 'project_templates',
      is_enabled:  true,
      config:      updatedTemplates,
    }, { onConflict: 'org_id,feature_key' })

  if (upsertErr) return NextResponse.json(dbError(upsertErr, 'projects/[id]/save-as-template'), { status: 500 })

  return NextResponse.json({
    message: `Saved "${project.name}" as org template with ${parents.length} tasks and ${children.length} subtasks.`,
    task_count:    parents.length,
    subtask_count: children.length,
  })
}
