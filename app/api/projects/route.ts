import { effectivePlan, isAtProjectLimit, projectLimit } from '@/lib/utils/planGate'
import { createClient } from '@/lib/supabase/server'
import { NextResponse }  from 'next/server'
import type { NextRequest } from 'next/server'
import { assertCan }     from '@/lib/utils/permissionGate'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { data: mb } = await supabase.from('org_members').select('org_id, role').eq('user_id', user.id).eq('is_active', true).single()
  if (!mb) return NextResponse.json({ data: [] })
  const sp  = request.nextUrl.searchParams
  const lim = Math.min(parseInt(sp.get('limit') ?? '100'), 500)
  // Strict project visibility: everyone only sees org-wide projects OR projects they're in
  // Only the org owner sees all projects (safety net)
  const isOwner = mb.role === 'owner'
  let projectQuery = supabase.from('projects')
    .select('id, name, color, status, due_date, client_id, member_ids')
    .eq('org_id', mb.org_id).neq('is_archived', true)
    .order('updated_at', { ascending: false }).limit(lim)
  if (!isOwner) {
    projectQuery = projectQuery.or(`member_ids.is.null,member_ids.cs.{${user.id}}`)
  }
  // templates are stored in org_feature_settings, not in projects table
  const { data, error } = await projectQuery
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, {
    headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' },
  })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { data: mb } = await supabase.from('org_members').select('org_id, role').eq('user_id', user.id).eq('is_active', true).single()
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })
  const projectCreateDenied = await assertCan(supabase, mb.org_id, mb.role, 'projects.create')
  if (projectCreateDenied) return NextResponse.json({ error: projectCreateDenied.error }, { status: projectCreateDenied.status })

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
  const isTemplate = body.is_template === true
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
    member_ids:  Array.isArray(body.member_ids) && body.member_ids.length > 0 ? body.member_ids : null,
  }).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Create template tasks (with subtasks) if provided
  const templateTasks: { title: string; priority: string; subtasks?: string[] }[] = body.template_tasks ?? []
  if (templateTasks.length > 0 && data?.id) {
    try {
      for (const t of templateTasks) {
        const validPriority = ['low','medium','high','urgent'].includes(t.priority) ? t.priority : 'medium'
        const { data: newTask, error: taskErr } = await supabase.from('tasks').insert({
          org_id:      mb.org_id,
          project_id:  data.id,
          title:       t.title,
          priority:    validPriority,
          status:      'todo' as const,
          created_by:  user.id,
          is_recurring: false,
          approval_required: false,
        }).select('id').single()

        if (taskErr) { console.error('[project template task insert]', taskErr.message, t.title); continue }

        // Create subtasks if any
        if (newTask?.id && t.subtasks && t.subtasks.length > 0) {
          const subtaskInserts = t.subtasks.map(st => ({
            org_id:         mb.org_id,
            project_id:     data.id,
            parent_task_id: newTask.id,
            title:          st,
            priority:       validPriority,
            status:         'todo' as const,
            created_by:     user.id,
            is_recurring:   false,
            approval_required: false,
          }))
          const { error: subErr } = await supabase.from('tasks').insert(subtaskInserts)
          if (subErr) console.error('[project template subtask insert]', subErr.message)
        }
      }
    } catch (e) {
      console.error('[project template tasks]', e)
    }
  }

  // If flagged as org template, save to org_feature_settings
  // Use the tasks actually inserted rather than body.template_tasks (which is empty for blank projects)
  if (isTemplate && data?.id) {
    try {
      const { data: existing } = await supabase
        .from('org_feature_settings')
        .select('config')
        .eq('org_id', mb.org_id)
        .eq('feature_key', 'project_templates')
        .maybeSingle()
      const currentTemplates: any[] = (existing?.config as any) ?? []

      // Read back the tasks we just created so template_tasks is always accurate
      const { data: insertedTasks } = await supabase
        .from('tasks')
        .select('id, title, priority, parent_task_id')
        .eq('project_id', data.id)
        .eq('org_id', mb.org_id)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })

      const allInserted = insertedTasks ?? []
      const insertedParents  = allInserted.filter(t => !t.parent_task_id)
      const insertedChildren = allInserted.filter(t =>  t.parent_task_id)
      const savedTemplateTasks = insertedParents.map(p => ({
        title:    p.title,
        priority: p.priority ?? 'medium',
        subtasks: insertedChildren
          .filter(c => c.parent_task_id === p.id)
          .map(c => c.title),
      }))

      const newTemplate = {
        id:             data.id,
        name:           data.name,
        color:          data.color,
        template_tasks: savedTemplateTasks,
      }
      await supabase.from('org_feature_settings').upsert({
        org_id:      mb.org_id,
        feature_key: 'project_templates',
        is_enabled:  true,
        config:      [...currentTemplates, newTemplate],
      }, { onConflict: 'org_id,feature_key' })
    } catch (e) {
      console.error('[save project template]', e)
    }
  }

  return NextResponse.json({ data }, { status: 201 })
}