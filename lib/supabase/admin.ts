import { createClient } from '@supabase/supabase-js'

/**
 * Creates an admin (service-role) Supabase client.
 *
 * The Supabase JS client communicates over HTTP (PostgREST), not directly
 * via PostgreSQL, so it always uses the standard HTTPS project URL.
 * Connection pooling is handled internally by Supabase's PostgREST layer.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    db: { schema: 'public' },
  })
}
