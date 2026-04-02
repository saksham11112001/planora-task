import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Server-side Supabase client for:
 * - Server Components
 * - Route Handlers (API routes)
 * - Server Actions
 *
 * IMPORTANT: Uses @supabase/ssr createServerClient (NOT createClient from
 * @supabase/supabase-js). This is what properly reads/writes the auth cookie
 * in Next.js App Router. Using the wrong package is the #1 cause of login loops.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll is called from Server Components where cookies are
            // read-only. This is safe to ignore — the middleware handles
            // the actual cookie refresh.
          }
        },
      },
    }
  )
}
