import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { authCookieDomain } from './cookieDomain'

/**
 * Creates a Supabase client for use in Server Components and API Routes.
 *
 * Note: the Supabase JS client uses the REST API (HTTP), not a raw Postgres
 * connection, so pgBouncer pooler URLs (postgres://...) do NOT apply here.
 * Connection pooling for this client is handled automatically by Supabase's
 * own infrastructure via the project URL.
 */
export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        // MUST carry the shared domain. Without it this writer minted HOST-ONLY
        // sb-* cookies on every token refresh, while the browser client and
        // middleware wrote domain-scoped ones — leaving two cookies with the
        // same name. The middleware reads that as a corrupted session and
        // clears it, which is what was signing people out day after day.
        setAll: (cs: { name: string; value: string; options?: Record<string, unknown> }[]) =>
          cs.forEach(({ name, value, options }) => {
            try { cookieStore.set(name, value, { ...(options as any), ...authCookieDomain() }) } catch {}
          }),
      },
    }
  )
}
