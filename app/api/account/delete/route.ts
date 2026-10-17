import { createClient }      from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/authUser'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse }       from 'next/server'
import type { NextRequest }   from 'next/server'

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  // Require the caller to echo back the user's email as a deletion confirmation.
  // This prevents accidental deletions and provides a minimal re-intent check
  // without a full re-authentication round-trip.
  let body: Record<string, unknown> = {}
  try { body = await request.json() } catch { /* empty body is handled below */ }

  const confirmed = (body.confirm_email as string | undefined)?.toLowerCase().trim()
  if (!confirmed || confirmed !== user.email?.toLowerCase()) {
    return NextResponse.json(
      { error: 'confirm_email must match your account email to proceed with deletion.' },
      { status: 400 }
    )
  }

  const admin = createAdminClient()
  // ALL active memberships — .single() here errored for users in more than one
  // org, which made mb null and silently skipped every org cleanup while still
  // deleting the account (orphaned org data). Handle each membership instead.
  const { data: memberships } = await admin
    .from('org_members').select('org_id, role')
    .eq('user_id', user.id).eq('is_active', true)

  for (const mb of memberships ?? []) {
    if (mb.role !== 'owner') continue
    const orgId = mb.org_id
    await admin.from('tasks').delete().eq('org_id', orgId)
    await admin.from('time_logs').delete().eq('org_id', orgId)
    await admin.from('projects').delete().eq('org_id', orgId)
    // MUST come before clients. msme_vendors.client_id is ON DELETE SET NULL,
    // so deleting the clients first collapses every vendor row into the
    // firm-level group — and two clients that shared a supplier then collide
    // on the (org, client, email) unique index, which aborts the clients
    // delete and leaves the account half-removed. Declarations, tokens and
    // the email log cascade from msme_vendors, so this one delete is enough.
    await admin.from('msme_vendors').delete().eq('org_id', orgId)
    await admin.from('clients').delete().eq('org_id', orgId)
    await admin.from('org_members').delete().eq('org_id', orgId)
    await admin.from('organisations').delete().eq('id', orgId)
  }
  // Remove remaining (non-owner) memberships in other orgs
  await admin.from('org_members').delete().eq('user_id', user.id)

  await admin.from('users').delete().eq('id', user.id)
  await admin.auth.admin.deleteUser(user.id)
  return NextResponse.json({ success: true })
}
