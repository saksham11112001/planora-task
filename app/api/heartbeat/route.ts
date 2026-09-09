import { NextResponse }      from 'next/server'
import type { NextRequest }  from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { getAuthUser }       from '@/lib/supabase/authUser'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/heartbeat — records that the signed-in user is using the app.
 *
 * The product had no way of knowing this. activity_log only captures writes,
 * so a person who signs in daily to read their task list looked identical to
 * one who had abandoned the account. Both the weekly super-admin report and
 * the re-engagement email need the difference.
 *
 * THROTTLED, because this is called on every app load: the row is only written
 * when the stored value is more than an hour old. An active user therefore
 * costs one UPDATE per hour, not one per page view, and the accuracy lost is
 * an hour on a signal measured in days.
 *
 * Fire-and-forget by design — the caller ignores the response, and any failure
 * is swallowed. Nothing about the app should break because a usage ping did.
 */

export const dynamic = 'force-dynamic'

const THROTTLE_MS = 60 * 60 * 1000   // 1 hour

export async function POST(_req: NextRequest) {
  try {
    const supabase = await createClient()
    const user = await getAuthUser(supabase)
    // Not signed in: nothing to record, and not an error worth reporting.
    if (!user) return NextResponse.json({ ok: true, skipped: 'no-session' })

    const admin = createAdminClient()

    const { data: row } = await admin
      .from('users')
      .select('last_seen_at')
      .eq('id', user.id)
      .maybeSingle()

    const last = row?.last_seen_at ? new Date(row.last_seen_at).getTime() : 0
    if (Date.now() - last < THROTTLE_MS) {
      return NextResponse.json({ ok: true, skipped: 'throttled' })
    }

    await admin
      .from('users')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', user.id)

    return NextResponse.json({ ok: true, recorded: true })
  } catch (err) {
    // Never surface this. A usage ping is not worth an error in the console of
    // someone trying to do their actual work.
    console.error('[heartbeat]', (err as Error)?.message)
    return NextResponse.json({ ok: true, skipped: 'error' })
  }
}
