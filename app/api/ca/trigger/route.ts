import { NextResponse }      from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { inngest }           from '@/lib/inngest/client'

/**
 * POST /api/ca/trigger
 * Admin-only: manually fires the caComplianceSpawn function immediately.
 * Useful for backfilling tasks after initial setup or missed cron runs.
 */
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: mb } = await supabase
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()
  if (!mb) return NextResponse.json({ error: 'Not a member' }, { status: 403 })
  if (!['owner', 'admin'].includes(mb.role))
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  await inngest.send({ name: 'ca/compliance-spawn-manual', data: { org_id: mb.org_id } })
  return NextResponse.json({ ok: true, message: 'Compliance task spawn triggered' })
}
