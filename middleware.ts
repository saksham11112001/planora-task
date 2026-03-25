import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const COOKIE_DOMAIN = process.env.NEXT_PUBLIC_COOKIE_DOMAIN ?? 'localhost'
const SNG_LOGIN_URL = process.env.NEXT_PUBLIC_SNG_LOGIN_URL ?? 'http://localhost:3000/login'
const PLANORA_URL   = process.env.NEXT_PUBLIC_PLANORA_URL   ?? 'http://localhost:3001'

// Paths that don't need auth
const PUBLIC = ['/', '/login', '/auth', '/onboarding', '/not-found']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public paths through immediately — no auth check
  if (
    pathname === '/' ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/onboarding') ||
    pathname.startsWith('/_next/') ||
    pathname.includes('.')
  ) {
    return NextResponse.next({ request })
  }

  const response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        domain:   COOKIE_DOMAIN,
        secure:   process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge:   60 * 60 * 24 * 7,
      },
      cookies: {
        getAll()      { return request.cookies.getAll() },
        setAll(toSet) {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value))
          toSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, {
              ...options,
              domain:   COOKIE_DOMAIN,
              secure:   process.env.NODE_ENV === 'production',
              sameSite: 'lax',
            })
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const loginUrl = new URL(SNG_LOGIN_URL)
    loginUrl.searchParams.set('redirect', `${PLANORA_URL}${pathname}`)
    return NextResponse.redirect(loginUrl)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|favicon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
