import { createClient }       from '@/lib/supabase/server'
import { NextResponse }        from 'next/server'
import type { NextRequest }    from 'next/server'
import { assertCan }           from '@/lib/utils/permissionGate'
import { normalizeFrequency, nextOccurrence } from '@/lib/utils/recurringSchedule'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { data: mb } = await supabase.from('org_members').select('org_id, role').eq('user_id', user.id).eq('is_active', true).single()
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })
  const recurringEditDenied = await assertCan(supabase, mb.org_id, mb.role, 'recurring.edit')
  if (recurringEditDenied) return NextResponse.json({ error: recurringEditDenied.error }, { status: recurringEditDenied.status })

  const { title, frequency, priority, assignee_id, project_id, client_id } = await req.json()
  const today       = new Date().toISOString().split('T')[0]
  const dbFrequency = frequency ? normalizeFrequency(frequency) : undefined
  const nextDate    = frequency ? nextOccurrence(frequency, today) : undefined

  const { data, error } = await supabase.from('tasks')
    .update({ title, frequency: dbFrequency, next_occurrence_date: nextDate, priority, assignee_id: assignee_id || null, project_id: project_id || null, client_id: client_id || null })
    .eq('id', id).eq('org_id', mb.org_id).select('*').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
