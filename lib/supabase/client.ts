import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // Use implicit flow for OAuth (Google) so the token comes back
        // in the URL hash — no PKCE verifier cookie required.
        // The PKCE cookie gets dropped by browsers during the cross-site
        // redirect chain: Google → Supabase → your app (SameSite=Lax blocks it).
        flowType: 'implicit',
        detectSessionInUrl: true,
        persistSession: true,
      },
    }
  )
}