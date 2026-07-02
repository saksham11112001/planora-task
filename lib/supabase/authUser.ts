/**
 * getAuthUser — fast authenticated-user lookup for API routes.
 *
 * Replaces `supabase.auth.getUser()` (which makes a NETWORK round-trip to the
 * Supabase Auth server on EVERY call) with `supabase.auth.getClaims()`, which
 * verifies the JWT **locally** using the project's asymmetric (ECC) signing key
 * — no network call after the JWKS is cached once per serverless instance.
 *
 * Why this is safe:
 *  - The middleware already validates AND refreshes the session cookie on every
 *    request, so by the time a route runs the cookie holds a fresh, valid token.
 *  - getClaims() cryptographically verifies the token's signature + expiry, so a
 *    forged or tampered token is rejected — it's real validation, just done in
 *    the function instead of over the network.
 *  - If the project ever falls back to a symmetric (HS256) key, getClaims()
 *    itself transparently calls getUser(), so correctness is never compromised.
 *
 * Returns only { id, email } — the fields API routes actually use. Routes that
 * need richer fields (user_metadata, email_confirmed_at, created_at) still call
 * supabase.auth.getUser() directly (auth/onboarding routes).
 */

export interface AuthUser {
  id:    string
  email: string | null
}

// `supabase` is a Supabase server client (from lib/supabase/server). Typed loosely
// here so we don't have to thread the SupabaseClient generic through every caller —
// the RETURN type (AuthUser | null) is fully typed, so callers stay type-safe.
export async function getAuthUser(supabase: any): Promise<AuthUser | null> {
  // Primary path: local JWT verification (no network on the hot path).
  try {
    const { data, error } = await supabase.auth.getClaims()
    const claims = data?.claims as Record<string, unknown> | undefined
    if (!error && claims && typeof claims.sub === 'string') {
      return { id: claims.sub as string, email: (claims.email as string | undefined) ?? null }
    }
  } catch {
    // fall through to the network path below
  }

  // Fallback: network validation (also covers legacy symmetric-key projects).
  const { data: { user } } = await supabase.auth.getUser()
  return user ? { id: user.id, email: user.email ?? null } : null
}
