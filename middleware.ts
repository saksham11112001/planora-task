import { NextRequest, NextResponse } from 'next/server'
import { createServerClient }       from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Static assets, API and auth paths — always let through
  if (
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/privacy') ||
    pathname.startsWith('/terms') ||
    pathname.startsWith('/onboarding') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/') ||
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
          // Write to request so downstream server components see fresh cookies
          toSet.forEach(({ name, value }) => request.cookies.set(name, value))
          // Write to response so browser receives refreshed token cookies
          response = NextResponse.next({ request })
          toSet.forEach(({ name, value, options }) =>
            response.headers.append(
              'Set-Cookie',
              `${name}=${value}; Path=/; HttpOnly; SameSite=Lax${options?.secure ? '; Secure' : ''}${options?.maxAge ? `; Max-Age=${options.maxAge}` : ''}`
            )
          )
        },
      },
    }
  )

  // getUser() validates the JWT AND triggers a token refresh if needed
  // The refreshed token is written back via setAll above
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    // Landing page: not logged in — show it normally
    if (pathname === '/') {
      return NextResponse.next({ request })
    }
    // Protected page: not logged in — send to login
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Logged-in user hitting the landing page → straight to dashboard
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