import { createClient } from '@supabase/supabase-js'

/**
 * Creates an admin (service-role) Supabase client.
 *
 * Uses the SUPABASE_POOLER_URL when available so Inngest background jobs
 * and API routes that make many parallel queries don't exhaust the 40-connection
 * direct Postgres limit.
 *
 * Set SUPABASE_POOLER_URL in your environment (Supabase Dashboard →
 * Settings → Database → Connection Pooling → Transaction mode, port 6543).
 */
export function createAdminClient() {
  // Use pooler URL for all server-side admin calls if configured
  const url = process.env.SUPABASE_POOLER_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    db: { schema: 'public' },
  })
}
