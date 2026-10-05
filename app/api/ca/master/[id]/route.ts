import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/authUser'
import { createAdminClient } from '@/lib/supabase/admin'
import type { NextRequest } from 'next/server'
import { dbError } from '@/lib/api-error'
import { getApiOrgMembership } from '@/lib/supabase/apiActiveOrg'
import { stripIdentityFields } from '@/lib/utils/safeUpdate'
import { diffDates, migrateMasterDates } from '@/lib/ca/migrateMasterDates'
import type { MigrateResult } from '@/lib/ca/migrateMasterDates'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const mb = await getApiOrgMembership(supabase, user.id, req, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (!['owner','admin'].includes(mb.role)) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const body = await req.json()
  const admin = createAdminClient()

  // Read the dates BEFORE the write. A master task's `dates` map defines an
  // obligation, so moving a date has to move the work already spawned from it.
  // Leaving that to a confirmation modal in the UI is what let the master and
  // the live tasks drift apart until the nightly spawner turned the gap into
  // duplicates — see lib/ca/migrateMasterDates.ts.
  const { data: before } = await admin.from('ca_master_tasks')
    .select('dates').eq('id', id).eq('org_id', mb.org_id).maybeSingle()

  const { data, error } = await admin.from('ca_master_tasks')
    // org_id in the body would land in the SET clause and move this master
    // task into another organisation; the .eq below only scopes the WHERE.
    .update({ ...stripIdentityFields(body), updated_at: new Date().toISOString() })
    .eq('id', id).eq('org_id', mb.org_id)
    .select().maybeSingle()

  if (error) return NextResponse.json(dbError(error, 'ca/master/[id]'), { status: 500 })

  // Migrate after the master row is safely saved, so a failure here can never
  // roll back or block the edit the user asked for. Warnings are returned, not
  // swallowed into a server log the user will never read.
  let dateMigration: MigrateResult | null = null
  if (data && 'dates' in body) {
    const changes = diffDates(
      before?.dates as Record<string, string> | null,
      data.dates   as Record<string, string> | null,
    )
    if (changes.length > 0) {
      dateMigration = await migrateMasterDates(admin, mb.org_id, id, changes)
    }
  }

  return NextResponse.json({ data, dateMigration })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const mb = await getApiOrgMembership(supabase, user.id, _req, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (!['owner','admin'].includes(mb.role)) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const admin = createAdminClient()
  const { error } = await admin.from('ca_master_tasks')
    .delete().eq('id', id).eq('org_id', mb.org_id)
  if (error) return NextResponse.json(dbError(error, 'ca/master/[id]'), { status: 500 })
  return NextResponse.json({ success: true })
}
