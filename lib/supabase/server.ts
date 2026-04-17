import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Creates a Supabase client for use in Server Components and API Routes.
 *
 * Connection URL strategy:
 * - API Routes (short-lived serverless functions) use the pgBouncer POOLER URL
 *   (port 6543, transaction mode) to avoid exhausting the 40-connection direct limit.
 * - Server Components / SSR pages use the direct URL (same as before).
 *
 * To enable pooler mode, add to your .env:
 *   SUPABASE_POOLER_URL=postgres://postgres.[project-ref]:[password]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
 *
 * You can find this in: Supabase Dashboard → Settings → Database → Connection Pooling.
 */
export async function createClient() {
  const cookieStore = await cookies()
  // Use the pgBouncer pooler URL in API routes to avoid exhausting the
  // 40-connection direct Postgres limit under concurrent load.
  // Set SUPABASE_POOLER_URL in .env (Supabase Dashboard → Settings → Database → Connection Pooling).
  return createServerClient(
    process.env.SUPABASE_POOLER_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cs) => cs.forEach(({ name, value, options }) => {
          try { cookieStore.set(name, value, options) } catch {}
        }),
      },
    }
  )
}
