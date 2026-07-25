/**
 * Cached data fetchers — use React cache() to deduplicate
 * identical queries within a single request lifecycle.
 * This means the layout + a page component can both call
 * getSessionUser() and only ONE database query fires.
 */
import { cache }        from 'react'
import { createClient } from './server'

// Deduped: returns the same result if called multiple times per request
export const getSessionUser = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
})

/**
 * Fast user-id lookup: verifies the JWT locally via getClaims() (asymmetric
 * signing key + cached JWKS — no network round-trip). The middleware has
 * already validated and refreshed the session cookie for this request.
 *
 * Use this to START parallel data fetches immediately instead of serialising
 * them behind the network getUser() call — that call alone was adding a full
 * Supabase-Auth round-trip to the critical path of EVERY page render.
 * getSessionUser() remains the source of truth for the full user object.
 */
export const getSessionUserId = cache(async (): Promise<string | null> => {
  const supabase = await createClient()
  try {
    const { data, error } = await supabase.auth.getClaims()
    const sub = (data?.claims as any)?.sub
    if (!error && typeof sub === 'string') return sub
  } catch { /* fall through */ }
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
})

export const getOrgMembership = cache(async (userId: string) => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('org_members')
    .select('org_id, role, can_view_all_tasks, can_view_monitor, organisations(id, name, slug, plan_tier, logo_color, status, trial_ends_at, trial_started_at, trial_extension_days, referral_code, join_code, subscription_id)')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()
  return data
})

export const getUserProfile = cache(async (userId: string) => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('users')
    .select('id, name, email, avatar_url, tour_completed_at')
    .eq('id', userId)
    .maybeSingle()
  return data
})
