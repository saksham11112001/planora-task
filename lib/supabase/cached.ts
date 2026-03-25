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

export const getOrgMembership = cache(async (userId: string) => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('org_members')
    .select('org_id, role, organisations(id, name, slug, plan_tier, logo_color)')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()
  return data
})

export const getUserProfile = cache(async (userId: string) => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('users')
    .select('id, name, email, avatar_url')
    .eq('id', userId)
    .single()
  return data
})
