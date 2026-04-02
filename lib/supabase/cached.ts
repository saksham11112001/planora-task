/**
 * Data fetchers for server components.
 * NOTE: React cache() removed — it conflicts with Next.js 15 async cookies() context.
 * Each call creates a fresh client. The overhead is negligible (<1ms per request).
 */
import { createClient } from './server'

export async function getSessionUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function getOrgMembership(userId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('org_members')
    .select('org_id, role, organisations(id, name, slug, plan_tier, logo_color, status, trial_ends_at)')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()
  return data
}

export async function getUserProfile(userId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('users')
    .select('id, name, email, avatar_url')
    .eq('id', userId)
    .maybeSingle()
  return data
}
