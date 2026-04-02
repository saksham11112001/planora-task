import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Public routes that never need a session
const PUBLIC_PATHS = [
  '/login',
  '/signup',
  '/onboarding',
  '/privacy',
  '/terms',
  '/api/inngest',           // Inngest webhook — no auth
  '/api/webhooks',          // Razorpay webhook — no auth
  '/api/onboarding',        // Called during onboarding before full session
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── 1. Always allow static assets and Next.js internals ──────────────────
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|webp|css|js|woff2?)$/)
  ) {
    return NextResponse.next()
  }

  // ── 2. Build a response we can mutate cookies on ─────────────────────────
  //    CRITICAL: must pass request + response into createServerClient so
  //    Supabase can refresh the session cookie. Without this the session
  //    never persists and every request looks unauthenticated.
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Write cookies to both the outgoing request and the response
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          // Re-create the response with the mutated request cookies so the
          // refreshed session is written back to the browser
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // ── 3. Refresh the session — this is what actually keeps users logged in ─
  //    getUser() validates the JWT and silently refreshes if near-expiry.
  //    NEVER use getSession() here — it trusts the local cookie without
  //    re-validating against Supabase, so an expired token looks valid.
  const { data: { user }, error } = await supabase.auth.getUser()

  const isPublicPath = PUBLIC_PATHS.some(p => pathname.startsWith(p))
  const isRootPath = pathname === '/'

  // ── 4. Not logged in ──────────────────────────────────────────────────────
  if (!user || error) {
    // Allow public pages through
    if (isPublicPath || isRootPath) return response

    // Redirect everything else to login, preserving the intended destination
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/login'
    // Only set next param for non-API routes (avoids leaking API URLs)
    if (!pathname.startsWith('/api/')) {
      redirectUrl.searchParams.set('next', pathname)
    }
    return NextResponse.redirect(redirectUrl)
  }

  // ── 5. Logged in — redirect away from auth pages ─────────────────────────
  if (pathname === '/login' || pathname === '/signup') {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/dashboard'
    redirectUrl.search = ''
    return NextResponse.redirect(redirectUrl)
  }

  // ── 6. Logged in — redirect root to dashboard ────────────────────────────
  if (isRootPath) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/dashboard'
    return NextResponse.redirect(redirectUrl)
  }

  // ── 7. Return the response with refreshed session cookies ─────────────────
  return response
}

export const config = {
  matcher: [
    /*
     * Match ALL paths EXCEPT:
     * - _next/static  (static files)
     * - _next/image   (image optimisation)
     * - favicon.ico
     * - public folder files
     *
     * This ensures the middleware runs on every route so the session cookie
     * is always refreshed. Without this, navigating to an unmatched route
     * clears the session from middleware context.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
