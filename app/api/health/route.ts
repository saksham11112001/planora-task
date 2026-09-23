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

/**
 * A try/catch rescues a dependency that ERRORS and does nothing for one that is
 * merely slow — and slow is the case that times the probe out. Same reasoning
 * as the bounds in middleware.ts.
 */
function withTimeout<T>(p: PromiseLike<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  return Promise.race([
    Promise.resolve(p),
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`db timed out after ${ms}ms`)), ms)
    }),
  ]).finally(() => clearTimeout(timer)) as Promise<T>
}

// A probe that hangs is worse than one that fails: it holds the function open
// until the platform kills it, so the monitor records a hard timeout instead of
// a readable status. Bound it well under any uptime checker's own timeout.
const DB_TIMEOUT_MS = 3_000

export async function GET() {
  const startedAt = Date.now()
  try {
    // Reachability probe, not a census.
    //
    // This used to be `select('id', { count: 'exact', head: true })`, described
    // as the cheapest possible round-trip. It was the most expensive one
    // available: `count: 'exact'` makes Postgres run SELECT count(*) over the
    // whole table, and `.limit(1)` does not bound that — it only caps returned
    // rows, and head:true returns none anyway. At one probe every five minutes
    // that is ~288 full scans of `organisations` a day, growing with the table:
    // slow enough to occasionally exceed the monitor's request timeout (a false
    // "down" that clears on the next probe), and a standing drain on the
    // Supabase disk-IO budget.
    //
    // Reading a single row proves exactly what this endpoint claims to prove —
    // the app can reach the database and get an answer — in constant time.
    const admin = createAdminClient()
    const { error } = await withTimeout(
      admin.from('organisations').select('id').limit(1),
      DB_TIMEOUT_MS,
    )

    if (error) {
      // No `detail` in the body. This is the one route anybody on the internet
      // can call without signing in, and a raw PostgREST message names tables,
      // columns and constraints. A monitor only needs the status code.
      console.error('[health] db error:', error.message)
      return NextResponse.json(
        { status: 'degraded', db: 'error', ms: Date.now() - startedAt },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    return NextResponse.json(
      { status: 'ok', db: 'ok', ms: Date.now() - startedAt },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (err) {
    console.error('[health] unreachable:', (err as Error)?.message)
    return NextResponse.json(
      { status: 'degraded', db: 'unreachable', ms: Date.now() - startedAt },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
