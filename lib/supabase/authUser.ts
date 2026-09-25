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
  //
  // The error is checked, not discarded. Destructuring `data.user` alone made
  // an Auth OUTAGE look identical to being signed out: getUser() returns
  // { user: null, error } on a 500, a rate limit or a network failure, and the
  // caller's `if (!user) return 401` then told the browser the session was
  // invalid. AuthErrorBoundary acted on that and signed people out mid-task.
  //
  // The signature still has to be `AuthUser | null` — 130-odd routes depend on
  // it — so a failure cannot be reported upward here. One retry is what can be
  // done at this level: these outages are brief, and a second attempt a moment
  // later usually succeeds. What survives both attempts is logged, so an Auth
  // problem shows up as itself instead of as a wave of mystery logouts.
  const { data, error } = await supabase.auth.getUser()
  if (data?.user) return { id: data.user.id, email: data.user.email ?? null }

  if (error) {
    // Distinguish "Auth says no" from "Auth did not say". 401/403 is a real
    // rejection — an expired or revoked token — and retrying cannot change it.
    const status = (error as { status?: number }).status
    const isRejection = status === 401 || status === 403
    if (!isRejection) {
      try {
        const retry = await supabase.auth.getUser()
        if (retry.data?.user) {
          return { id: retry.data.user.id, email: retry.data.user.email ?? null }
        }
        console.error('[getAuthUser] auth unavailable after retry:',
          retry.error?.message ?? error.message)
      } catch (e) {
        console.error('[getAuthUser] auth retry threw:', (e as Error)?.message)
      }
    }
  }

  return null
}
