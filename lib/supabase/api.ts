/**
 * Supabase client specifically for API Route Handlers (app/api/**).
 *
 * The standard server.ts client uses cookies() from next/headers which
 * cannot SET cookies in Route Handlers — causing silent auth failures
 * on token refresh (exactly the "401 on second request" bug).
 *
 * This version reads cookies from the incoming Request and writes
 * refreshed tokens back via a NextResponse — the correct pattern for
 * Next.js 15 Route Handlers.
 */
import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export function createApiClient(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cs) => {
          cs.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cs.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )

  return { supabase, response }
}
