import { createClient }    from '@/lib/supabase/server'
import { NextResponse }    from 'next/server'
import type { NextRequest } from 'next/server'
import { getApiOrgMembership } from '@/lib/supabase/apiActiveOrg'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const mb = await getApiOrgMembership(supabase, user.id, request, 'org_id')
  if (!mb) return NextResponse.json({ data: [] })

  const q = request.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json({ data: [] })
  const like = `%${q}%`

  const [{ data: tasks }, { data: projects }, { data: clients }] = await Promise.all([
    supabase.from('tasks')
      .select('id, title, status, priority, project_id, projects(name, color)')
      .eq('org_id', mb.org_id).neq('is_archived', true).ilike('title', like).limit(6),
    supabase.from('projects')
      .select('id, name, status, color, clients(name)')
      .eq('org_id', mb.org_id).neq('is_archived', true).ilike('name', like).limit(5),
    supabase.from('clients')
      .select('id, name, status, color, company')
      .eq('org_id', mb.org_id).ilike('name', like).limit(4),
  ])

  const data = [
    ...(tasks ?? []).map(t => ({
      id:       t.id,
      type:     'task',
      title:    t.title,
      subtitle: (t.projects as any)?.name ?? 'No project',
      color:    (t.projects as any)?.color ?? null,
      status:   t.status,
    })),
    ...(projects ?? []).map(p => ({
      id:       p.id,
      type:     'project',
      title:    p.name,
      subtitle: (p.clients as any)?.name ?? 'No client',
      color:    p.color,
      status:   p.status,
    })),
    ...(clients ?? []).map(c => ({
      id:       c.id,
      type:     'client',
      title:    c.name,
      subtitle: c.company ?? '',
      color:    c.color,
      status:   c.status,
    })),
  ]

  return NextResponse.json({ data })
}
