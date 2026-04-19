import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { inngest }       from '@/lib/inngest/client'
import type { NextRequest } from 'next/server'
import { dbError } from '@/lib/api-error'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { data: mb } = await supabase.from('org_members').select('org_id, role, can_view_all_tasks').eq('user_id', user.id).eq('is_active', true).single()
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })
  // Verify task access
  const canSeeAll = ['owner','admin','manager'].includes(mb.role) || mb.can_view_all_tasks
  const taskQ = supabase.from('tasks').select('id').eq('id', id).eq('org_id', mb.org_id)
  const { data: taskAccess } = await (canSeeAll ? taskQ : taskQ.or(`assignee_id.eq.${user.id},approver_id.eq.${user.id}`)).maybeSingle()
  if (!taskAccess) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const sp = req.nextUrl.searchParams
  const limit  = Math.min(parseInt(sp.get('limit') ?? '200', 10) || 200, 500)
  const offset = Math.max(parseInt(sp.get('offset') ?? '0', 10) || 0,   0)
  const { data, error } = await supabase.from('task_comments')
    .select('id, content, created_at, author:users!task_comments_author_id_fkey(id, name)')
    .eq('task_id', id).eq('org_id', mb.org_id)
    .order('created_at', { ascending: true })
    .range(offset, offset + limit - 1)
  if (error) return NextResponse.json(dbError(error, 'tasks/[id]/comments'), { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { data: mb } = await supabase.from('org_members').select('org_id, role, can_view_all_tasks').eq('user_id', user.id).eq('is_active', true).single()
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })
  // Verify task access before allowing comment
  const canSeeAll2 = ['owner','admin','manager'].includes(mb.role) || mb.can_view_all_tasks
  const taskQ2 = supabase.from('tasks').select('id').eq('id', id).eq('org_id', mb.org_id)
  const { data: taskAccess2 } = await (canSeeAll2 ? taskQ2 : taskQ2.or(`assignee_id.eq.${user.id},approver_id.eq.${user.id}`)).maybeSingle()
  if (!taskAccess2) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { content } = await req.json()
  if (!content?.trim()) return NextResponse.json({ error: 'Empty comment' }, { status: 400 })
  if (content.trim().length > 5000) return NextResponse.json({ error: 'Comment too long (max 5000 chars)' }, { status: 400 })
  const { data, error } = await supabase.from('task_comments')
    .insert({ task_id: id, org_id: mb.org_id, author_id: user.id, content: content.trim() })
    .select('*').single()
  if (error) return NextResponse.json(dbError(error, 'tasks/[id]/comments'), { status: 500 })
  // Fire comment notification
  try {
    // Get task + assignee info
    const { data: task } = await supabase.from('tasks')
      .select('title, assignee_id, project_id, assignee:users!tasks_assignee_id_fkey(name, email), org:organisations!inner(name)')
      .eq('id', id).maybeSingle()
    if (task?.assignee_id && task.assignee_id !== user.id) {
      const assignee = (task.assignee as any)
      const { data: commenter } = await supabase.from('users').select('name').eq('id', user.id).maybeSingle()
      if (assignee?.email) {
        await inngest.send({
          name: 'task/commented',
          data: {
            task_id: id, task_title: task.title,
            assignee_id: task.assignee_id, assignee_email: assignee.email, assignee_name: assignee.name,
            commenter_id: user.id, commenter_name: (commenter as any)?.name ?? 'Someone',
            comment_text: content.trim(),
            org_name: (task.org as any)?.name ?? '',
            project_id: task.project_id ?? null,
          },
        })
      }
    }
  } catch {}
  return NextResponse.json({ data }, { status: 201 })
}
