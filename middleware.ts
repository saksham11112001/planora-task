import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = [
  '/login',
  '/signup',
  '/onboarding',
  '/privacy',
  '/terms',
  '/auth',          // covers /auth/callback
  '/api/inngest',
  '/api/webhooks',
  '/api/onboarding',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip static assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|webp|css|js|woff2?)$/)
  ) {
    return NextResponse.next()
  }

  // Always allow public paths through — no Supabase call needed
  const isPublicPath = PUBLIC_PATHS.some(p => pathname.startsWith(p))
  const isRootPath   = pathname === '/'
  if (isPublicPath || isRootPath) {
    return NextResponse.next()
  }

  // Build a mutable response for cookie refreshing
  let response = NextResponse.next({ request })

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
            response = NextResponse.next({ request })
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, {
                ...options,
                path: '/',
                sameSite: 'lax',
                secure: process.env.NODE_ENV === 'production',
              })
            )
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      // Not logged in — redirect to login preserving destination
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      if (!pathname.startsWith('/api/')) url.searchParams.set('next', pathname)
      return NextResponse.redirect(url)
    }

    // Logged-in user hitting login/signup — send to dashboard
    if (pathname === '/login' || pathname === '/signup') {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      url.search = ''
      return NextResponse.redirect(url)
    }

    return response
  } catch {
    // If Supabase call fails entirely, let the request through.
    // The page/layout will handle missing auth gracefully.
    // NEVER redirect here — that causes infinite loops.
    return NextResponse.next()
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
