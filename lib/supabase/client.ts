import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  // NOTE: @supabase/ssr force-overrides flowType to 'pkce' (and
  // detectSessionInUrl / persistSession) AFTER merging caller options, so
  // passing auth options here is a silent no-op. Every OAuth / magic-link
  // flow therefore comes back as ?code= and MUST be exchanged server-side
  // at /auth/callback, which reads the code-verifier cookie written here.
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Share auth cookies across subdomains (msme.upfloat.co etc.)
      cookieOptions: {
        domain: process.env.NODE_ENV === 'production' ? '.upfloat.co' : undefined,
      },
    }
  )
}