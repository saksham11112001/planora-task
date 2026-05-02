import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

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
        setAll: (cs: { name: string; value: string; options?: Record<string, unknown> }[]) =>
          cs.forEach(({ name, value, options }) => {
            try { cookieStore.set(name, value, options as any) } catch {}
          }),
      },
    }
  )
}
