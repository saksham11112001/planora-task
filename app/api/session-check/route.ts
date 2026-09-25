// Server-side auth truth for the login page.
//
// The browser and the server can disagree about whether you're signed in:
// the browser client reads its own copy of the auth cookie, while middleware
// and server layouts read the cookie the browser actually SENDS. A stale or
// duplicate sb-* cookie makes those two views diverge — and browsers differ
// here, which is why the same account can work in Chrome but not Edge.
//
// When the login page redirected based on the BROWSER's view, a mismatch
// produced an endless bounce: /login -> /dashboard -> (server says no) ->
// /login -> ... freezing the tab. This endpoint reports the SERVER's view, so
// the redirect decision is made by the same authority that gates the
// destination. Deliberately NOT under /api/auth/, whose rate-limit bucket
// (10 requests / 5 min per IP) would throttle everyone behind one office IP.
import { NextResponse }  from 'next/server'
import { createClient }  from '@/lib/supabase/server'
import { getAuthUser }   from '@/lib/supabase/authUser'

// Never cache: a cached "authenticated: true" would redirect signed-out users.
export const dynamic = 'force-dynamic'

// `conclusive` says whether this answer is worth acting on destructively.
//
// The login page wants to fail closed — if we cannot tell, show the form.
// AuthErrorBoundary wants the opposite: it evicts a signed-in person to
// /login, and doing that because Auth was briefly unreachable is the bug it
// was added to prevent. One boolean cannot serve both, so the answer carries
// its own confidence and each caller decides.
export async function GET() {
  try {
    const supabase = await createClient()
    const user = await getAuthUser(supabase)
    return NextResponse.json(
      { authenticated: !!user, conclusive: true },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    )
  } catch (err) {
    console.error('[session-check] auth lookup failed:', (err as Error)?.message)
    // Still false, so the login page behaves exactly as before — but flagged
    // inconclusive so nothing signs a working session out over it.
    return NextResponse.json(
      { authenticated: false, conclusive: false },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    )
  }
}
