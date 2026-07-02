// Lightweight health check for uptime monitors (UptimeRobot, Better Uptime,
// Vercel checks). Verifies the process is up AND the database is reachable.
//
//   200 { status: 'ok' }        — app + DB healthy
//   503 { status: 'degraded' }  — DB unreachable (page a human)
//
// Public by design (allow-listed in middleware would be ideal; it lives under
// /api so it passes the rate limiter — fine, it's cheap and read-only).
import { NextResponse }       from 'next/server'
import { createAdminClient }  from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'   // never cache a health check

export async function GET() {
  const startedAt = Date.now()
  try {
    // Cheapest possible DB round-trip: HEAD count on a tiny always-present table.
    const admin = createAdminClient()
    const { error } = await admin
      .from('organisations')
      .select('id', { count: 'exact', head: true })
      .limit(1)

    if (error) {
      return NextResponse.json(
        { status: 'degraded', db: 'error', detail: error.message, ms: Date.now() - startedAt },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    return NextResponse.json(
      { status: 'ok', db: 'ok', ms: Date.now() - startedAt },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (err) {
    return NextResponse.json(
      { status: 'degraded', db: 'unreachable', detail: (err as Error)?.message, ms: Date.now() - startedAt },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
