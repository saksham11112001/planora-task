import { createBrowserClient } from '@supabase/ssr'

/**
 * Browser-side Supabase client for Client Components.
 *
 * Uses @supabase/ssr createBrowserClient (NOT createClient from
 * @supabase/supabase-js). This ensures auth cookies are read/written
 * consistently with the server client.
 *
 * Call this inside a Client Component — not at module level — to avoid
 * SSR issues.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
