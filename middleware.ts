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
    const result = checkRateLimit(ip, bucket, cfg.max, cfg.windowMs)

    if (!result.allowed) return buildRateLimitResponse(result)

    // Pass through — add rate-limit headers to the response
    const res = NextResponse.next({ request })
    res.headers.set('X-RateLimit-Limit',     String(result.limit))
    res.headers.set('X-RateLimit-Remaining', String(result.remaining))
    res.headers.set('X-RateLimit-Reset',     String(Math.ceil(result.resetAt / 1000)))
    return res
  }

  // Static assets, auth and public paths — always let through
  if (
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/privacy') ||
    pathname.startsWith('/terms') ||
    pathname.startsWith('/onboarding') ||
    pathname.startsWith('/portal/') ||
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
        setAll(toSet) {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          toSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getUser() validates the JWT AND triggers a token refresh if needed
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    if (pathname === '/') return NextResponse.next({ request })
    const loginUrl = new URL('/login', request.url)
    // Only pass same-origin paths — never redirect to external URLs
    if (pathname.startsWith('/') && !pathname.startsWith('//')) {
      loginUrl.searchParams.set('redirect', pathname)
    }
    return NextResponse.redirect(loginUrl)
  }

  if (pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|favicon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
