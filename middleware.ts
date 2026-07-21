import { NextRequest, NextResponse } from 'next/server'
import { createServerClient }       from '@supabase/ssr'
import { checkRateLimit, buildRateLimitResponse } from '@/lib/utils/rateLimit'

// ── Rate-limit config ────────────────────────────────────────────────────────
const RATE_LIMITS = {
  // General API: 120 requests per minute per IP
  api:      { max: 120, windowMs: 60_000 },
  // Auth endpoints: 10 attempts per 5 minutes per IP (brute-force protection)
  auth:     { max: 10,  windowMs: 300_000 },
  // Upload endpoints: 20 uploads per minute per IP
  upload:   { max: 20,  windowMs: 60_000 },
  // Import endpoint: 5 per 5 minutes per IP (heavy workload)
  import:   { max: 5,   windowMs: 300_000 },
  // Report issue: 10 per hour per IP (prevent spam)
  report:   { max: 10,  windowMs: 3_600_000 },
  // Referral code apply: 5 per 5 minutes per IP (prevent enumeration)
  referral: { max: 5,   windowMs: 300_000 },
  // Join org via code: 10 per 5 minutes per IP
  join:     { max: 10,  windowMs: 300_000 },
} as const

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── Rate limiting on API routes ─────────────────────────────────────────
  if (pathname.startsWith('/api/')) {
    const ip = getClientIp(request)

    // Pick the right bucket for this endpoint
    let bucket: keyof typeof RATE_LIMITS = 'api'
    if (pathname.startsWith('/api/auth/'))                   bucket = 'auth'
    else if (pathname.includes('/upload'))                   bucket = 'upload'
    else if (pathname.startsWith('/api/import'))             bucket = 'import'
    else if (pathname.startsWith('/api/report-issue'))       bucket = 'report'
    else if (pathname.startsWith('/api/referral/'))          bucket = 'referral'
    else if (pathname.startsWith('/api/org/join'))           bucket = 'join'

    const cfg    = RATE_LIMITS[bucket]
    const result = await checkRateLimit(ip, bucket, cfg.max, cfg.windowMs)

    if (!result.allowed) return buildRateLimitResponse(result)

    // Pass through — add rate-limit headers to the response
    const res = NextResponse.next({ request })
    res.headers.set('X-RateLimit-Limit',     String(result.limit))
    res.headers.set('X-RateLimit-Remaining', String(result.remaining))
    res.headers.set('X-RateLimit-Reset',     String(Math.ceil(result.resetAt / 1000)))
    return res
  }

  // ── Self-heal duplicate Supabase auth cookies ───────────────────────────
  // A host-only sb-* cookie from an old release can coexist with the
  // domain-scoped (.upfloat.co) one the current release sets. The browser
  // sends BOTH; Next's cookie map keeps the last while the browser client
  // reads the first — so the server and the browser can operate on two
  // DIFFERENT sessions. Symptoms: login/dashboard redirect loops ("page
  // isn't responding") and users randomly asked to sign in again.
  // Detection must use the raw Cookie header (the parsed map dedupes).
  if (!pathname.startsWith('/_next/') && !pathname.includes('.')) {
    const rawCookie = request.headers.get('cookie') ?? ''
    const sbNames = rawCookie.split(';')
      .map(p => p.split('=')[0].trim())
      .filter(n => n.startsWith('sb-'))
    if (sbNames.length !== new Set(sbNames).size) {
      // Clear BOTH variants of every Supabase cookie, then replay the
      // request. The user signs in once more and gets a single clean set.
      const res = NextResponse.redirect(request.nextUrl.clone())
      for (const n of new Set(sbNames)) {
        res.cookies.set(n, '', { path: '/', maxAge: 0 })
        if (process.env.NODE_ENV === 'production') {
          // append() bypasses the response cookie map (also keyed by name)
          res.headers.append('Set-Cookie', `${n}=; Path=/; Max-Age=0; Domain=.upfloat.co`)
        }
      }
      return res
    }
  }

  // Static assets, auth and public paths — always let through
  if (
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/privacy') ||
    pathname.startsWith('/terms') ||
    pathname.startsWith('/professionals') ||
    pathname.startsWith('/onboarding') ||
    pathname.startsWith('/portal/') ||
    pathname.startsWith('/partners/') ||   // standalone partner portal — its own auth
    pathname.startsWith('/msme-landing') || // public MSME product page
    pathname.startsWith('/msme/form/') ||        // vendor compliance form — no login required
    pathname.startsWith('/msme/unsubscribed') ||  // unsubscribe confirmation page — public
    pathname.startsWith('/msme/privacy') ||       // DPDP privacy notice — public
    pathname.startsWith('/task-action') ||         // email action result page — public
    pathname.startsWith('/_next/') ||
    pathname.includes('.')
  ) {
    return NextResponse.next({ request })
  }

  // Create a response we can mutate cookies on
  let response = NextResponse.next({ request })

  // Create Supabase client that reads from request cookies
  // and writes refreshed tokens back to response cookies
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(toSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          const sharedDomain = process.env.NODE_ENV === 'production' ? { domain: '.upfloat.co' } : {}
          toSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, { ...(options as any), ...sharedDomain })
          )
        },
      },
    }
  )

  // Fast path: verify the JWT locally (asymmetric signing keys + JWKS cache —
  // no network round-trip to Supabase Auth). getClaims() also auto-refreshes
  // an expired session via getSession(), writing new cookies through setAll.
  // Any failure falls back to the full network getUser(), preserving the old
  // behaviour exactly for edge cases.
  let user: { id: string } | null = null
  let error: unknown = null
  try {
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims()
    if (claimsData?.claims?.sub && !claimsErr) {
      user = { id: claimsData.claims.sub }
    }
  } catch { /* fall through to getUser */ }
  if (!user) {
    const res = await supabase.auth.getUser()
    user  = res.data.user
    error = res.error
  }

  // Detect MSME subdomain (msme.upfloat.co or msme.localhost for dev)
  const host         = request.headers.get('host') ?? ''
  const isMsmeDomain = host.startsWith('msme.')
  const defaultRoute = isMsmeDomain ? '/msme' : '/dashboard'

  // Auth code landed on root (Supabase Site URL misconfigured) — forward to the callback handler
  if (pathname === '/' && request.nextUrl.searchParams.has('code')) {
    const callbackUrl = new URL('/auth/callback', request.url)
    callbackUrl.searchParams.set('code', request.nextUrl.searchParams.get('code')!)
    const next = request.nextUrl.searchParams.get('next')
    if (next) callbackUrl.searchParams.set('next', next)
    return NextResponse.redirect(callbackUrl)
  }

  if (error || !user) {
    // MSME subdomain: unauthenticated root → show product landing page (rewrite, keep URL as /)
    if (isMsmeDomain && pathname === '/') {
      return NextResponse.rewrite(new URL('/msme-landing', request.url))
    }
    if (pathname === '/') return NextResponse.next({ request })
    const loginUrl = new URL('/login', request.url)
    // On MSME subdomain, always land on /msme after login
    const redirectTarget = isMsmeDomain ? '/msme' : (
      pathname.startsWith('/') && !pathname.startsWith('//') ? pathname : '/dashboard'
    )
    loginUrl.searchParams.set('redirect', redirectTarget)
    return NextResponse.redirect(loginUrl)
  }

  if (pathname === '/') {
    return NextResponse.redirect(new URL(defaultRoute, request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|favicon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
