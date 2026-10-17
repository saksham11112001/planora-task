// Returns all email-log entries for this org, used by the client-side export.
import { NextRequest, NextResponse } from 'next/server'
import { createClient }             from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/authUser'
import { createAdminClient }        from '@/lib/supabase/admin'
import { getApiOrgMembership }      from '@/lib/supabase/apiActiveOrg'
import { fetchAllRows }             from '@/lib/supabase/fetchAll'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, req, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'Not a member' }, { status: 403 })

  const admin = createAdminClient()

  // Paged, not a single read. The comment here used to say "no pagination —
  // audit exports are always full datasets", but PostgREST caps every response
  // at 1000 rows and says nothing when it truncates, so a full dataset was
  // exactly what this did NOT return once an org passed that many sends. Two
  // reporting cycles a year doubles the rate at which orgs reach it.
  const { data: logs, error, truncated } = await fetchAllRows<{
    vendor_id: string; attempt_no: number; sent_at: string
    opened_at: string | null; period_end: string | null
  }>((from, to) => admin
    .from('msme_email_log')
    .select('vendor_id, attempt_no, sent_at, opened_at, period_end')
    .eq('org_id', mb.org_id)
    // sent_at alone is not unique, so paging could repeat one row and drop
    // another. id breaks the tie deterministically.
    .order('sent_at', { ascending: true })
    .order('id', { ascending: true })
    .range(from, to),
  )

  if (error) {
    return NextResponse.json({ error: (error as { message?: string }).message ?? 'Failed to load email logs' }, { status: 500 })
  }

  // Reported rather than hidden: an audit export that is silently incomplete
  // is worse than one the caller knows is incomplete.
  return NextResponse.json({ logs, truncated })
}
