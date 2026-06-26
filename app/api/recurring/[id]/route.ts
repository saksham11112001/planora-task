import { createClient }       from '@/lib/supabase/server'
import { createAdminClient }   from '@/lib/supabase/admin'
import { NextResponse }        from 'next/server'
import type { NextRequest }    from 'next/server'
import { assertCan }           from '@/lib/utils/permissionGate'
import { normalizeFrequency, nextOccurrence, shiftDays, isValidGranularFrequency } from '@/lib/utils/recurringSchedule'

const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent']
import { dbError } from '@/lib/api-error'
import { getApiOrgMembership } from '@/lib/supabase/apiActiveOrg'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const mb = await getApiOrgMembership(supabase, user.id, req, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })
  const admin = createAdminClient()
  const recurringEditDenied = await assertCan(admin, mb.org_id, user.id, mb.role, 'recurring.edit')
  if (recurringEditDenied) return NextResponse.json({ error: recurringEditDenied.error }, { status: recurringEditDenied.status })

  const { title, frequency, priority, assignee_id, project_id, client_id } = await req.json()
  if (frequency && !isValidGranularFrequency(frequency)) return NextResponse.json({ error: `Invalid frequency "${frequency}". Use a valid frequency like daily, weekly_mon, monthly_15, etc.` }, { status: 400 })
  if (priority && !VALID_PRIORITIES.includes(priority)) return NextResponse.json({ error: `Invalid priority "${priority}". Must be one of: low, medium, high, urgent` }, { status: 400 })
  const today       = new Date().toISOString().split('T')[0]
  const dbFrequency = frequency ? normalizeFrequency(frequency) : undefined
  const nextDate    = frequency ? nextOccurrence(frequency, shiftDays(today, -1)) : undefined

  // Merge _granular_frequency into existing custom_fields so the display label stays in sync.
  let customFieldsUpdate: Record<string, unknown> | undefined
  if (frequency) {
    const { data: existing } = await admin.from('tasks').select('custom_fields').eq('id', id).eq('org_id', mb.org_id).maybeSingle()
    customFieldsUpdate = { ...((existing as any)?.custom_fields ?? {}), _granular_frequency: frequency }
  }

  const { data, error } = await admin.from('tasks')
    .update({
      title, frequency: dbFrequency, next_occurrence_date: nextDate, priority,
      assignee_id: assignee_id || null, project_id: project_id || null, client_id: client_id || null,
      ...(customFieldsUpdate ? { custom_fields: customFieldsUpdate } : {}),
    })
    .eq('id', id).eq('org_id', mb.org_id).select('*').single()

  if (error) return NextResponse.json(dbError(error, 'recurring/[id]'), { status: 500 })
  return NextResponse.json({ data })
}
