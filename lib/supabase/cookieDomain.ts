/**
 * Cookie scope for Supabase auth cookies — ONE definition, used by every
 * writer.
 *
 * Every place that writes `sb-*` cookies must agree on the Domain attribute.
 * A host-only cookie (no Domain) and a domain-scoped one (.upfloat.co) are
 * DIFFERENT cookies that share a name: the browser stores both and sends both,
 * so the server sees a duplicate `sb-…-auth-token` in one Cookie header.
 *
 * That is not cosmetic. The middleware treats duplicate sb-* names as a
 * corrupted session and clears them — which signs the person out. Because the
 * session refreshes roughly hourly, a writer missing the Domain kept minting
 * fresh host-only duplicates, so people were signed out again and again.
 *
 * The domain is also what lets one sign-in work across msme.upfloat.co and the
 * apex domain, so it cannot simply be dropped everywhere instead.
 *
 * Left empty outside production: localhost cannot set a .upfloat.co cookie,
 * and the browser silently discards the whole Set-Cookie if it tries.
 */
export function authCookieDomain(): { domain?: string } {
  return process.env.NODE_ENV === 'production' ? { domain: '.upfloat.co' } : {}
}
