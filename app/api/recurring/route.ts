import { createClient } from '@/lib/supabase/server'
import { NextResponse }  from 'next/server'
import type { NextRequest } from 'next/server'

function nextOccurrence(freq: string, from: string): string {
  const d = new Date(from)
  switch (freq) {
    case 'daily':     d.setDate(d.getDate() + 1);   break
    case 'weekly':    d.setDate(d.getDate() + 7);   break
    case 'bi_weekly': d.setDate(d.getDate() + 14);  break
    case 'monthly':   d.setMonth(d.getMonth() + 1); break
    case 'quarterly': d.setMonth(d.getMonth() + 3); break
    case 'annual':    d.setFullYear(d.getFullYear() + 1); break
  }
  return d.toISOString().split('T')[0]
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { data: mb } = await supabase.from('org_members').select('org_id, role').eq('user_id', user.id).eq('is_active', true).single()
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })
  if (!['owner','admin','manager'].includes(mb.role)) return NextResponse.json({ error: 'Permission denied' }, { status: 403 })

  const body = await request.json()
  const { title, priority = 'medium', frequency, assignee_id, project_id, start_date } = body
  if (!title?.trim()) return NextResponse.json({ error: 'Title required' }, { status: 400 })
  if (!frequency) return NextResponse.json({ error: 'Frequency required' }, { status: 400 })

  const today = start_date || new Date().toISOString().split('T')[0]
  const nextDate = nextOccurrence(frequency, today)

  const { data, error } = await supabase.from('tasks').insert({
    org_id:              mb.org_id,
    title:               title.trim(),
    priority,
    status:              'todo',
    is_recurring:        true,
    frequency,
    next_occurrence_date: nextDate,
    assignee_id:         assignee_id || null,
    project_id:          project_id  || null,
    created_by:          user.id,
  }).select('*').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
