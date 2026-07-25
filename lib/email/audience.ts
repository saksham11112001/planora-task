/**
 * Product-scoped mailers.
 *
 * A user who signed up through MSME Tracker or the Partner Program must not
 * receive upFloat task-manager USAGE email — "task assigned", digests,
 * approvals, due-soon reminders, trial/onboarding nudges. Those are about a
 * product they never signed up for.
 *
 * What is NOT gated (deliberately):
 *  - promotional / engagement email — this is exactly how we cross-sell the
 *    main app to MSME and partner users (still honours marketing_opt_out);
 *  - account & legal email — magic links, OTPs, invoices — which must always
 *    reach the person regardless of product;
 *  - MSME vendor email and partner invites, which belong to those products.
 *
 * Fail-open by design: if the product can't be determined we treat the address
 * as 'app'. Every pre-existing user is 'app', so behaviour is unchanged unless
 * we positively know the recipient belongs to another product.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { resend }            from './resend'

export type SignupProduct = 'app' | 'msme' | 'partner'

type SendPayload = Parameters<typeof resend.emails.send>[0]

// Short-lived in-process cache: digest/reminder jobs email many recipients in
// one run, and without this each send would repeat the same look-up.
const CACHE_TTL_MS = 60_000
const cache = new Map<string, { product: SignupProduct; at: number }>()

export async function getSignupProduct(email: string): Promise<SignupProduct> {
  const key = email.trim().toLowerCase()
  if (!key) return 'app'

  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.product

  let product: SignupProduct = 'app'
  try {
    const admin = createAdminClient()
    const { data } = await admin
      .from('users')
      .select('signup_product')
      .eq('email', key)
      .maybeSingle()
    const value = (data as any)?.signup_product
    if (value === 'msme' || value === 'partner') product = value
  } catch (err) {
    // Fail open — never block a legitimate app email because of a lookup error.
    console.error('[email/audience] product lookup failed for', key, err)
  }

  cache.set(key, { product, at: Date.now() })
  return product
}

/**
 * Send an upFloat task-manager usage email, skipping any recipient who signed
 * up through a different product. Returns the same shape as resend.emails.send
 * so callers (which check `error`) work unchanged.
 */
export async function sendAppUsageEmail(payload: SendPayload) {
  const recipients = Array.isArray(payload.to) ? payload.to : [payload.to]

  const allowed: string[] = []
  for (const address of recipients) {
    if ((await getSignupProduct(address)) === 'app') allowed.push(address)
    else console.log('[email/audience] skipped app email to non-app user:', address, '—', payload.subject)
  }

  // Every recipient belongs to another product — nothing to send, and this is
  // a success (not an error) so callers don't treat it as a failed delivery.
  if (allowed.length === 0) return { data: null, error: null }

  return resend.emails.send({ ...payload, to: allowed })
}
