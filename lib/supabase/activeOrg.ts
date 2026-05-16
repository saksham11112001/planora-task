/**
 * Multi-org support helpers.
 *
 * The active organisation is stored in a cookie (ACTIVE_ORG_COOKIE).
 * Server components and API routes read it to decide which org to operate on.
 * The client sets it via the org switcher and triggers a full page refresh.
 *
 * getActiveOrgMembership() is a drop-in replacement for getOrgMembership()
 * that respects the cookie. It returns the same shape so callers need no
 * changes beyond swapping the import.
 */
import { cache }             from 'react'
import { cookies }           from 'next/headers'
import { createClient }      from './server'
import { createAdminClient } from './admin'

export const ACTIVE_ORG_COOKIE = 'planora_active_org'

/** Read the active org id from the request cookie. Returns null if not set. */
export async function getActiveOrgId(): Promise<string | null> {
  const jar = await cookies()
  return jar.get(ACTIVE_ORG_COOKIE)?.value ?? null
}

/**
 * All active org memberships for a user — used to build the org switcher list.
 * Cached per request (React cache).
 */
export const getUserOrgs = cache(async (userId: string) => {
  // Use admin client to bypass RLS — the anon client's RLS policy may only expose
  // the currently-active org membership, causing the org switcher to see < 2 orgs.
  const admin = createAdminClient()
  const { data } = await admin
    .from('org_members')
    .select('org_id, role, organisations(id, name, slug, plan_tier, logo_color, status, trial_ends_at)')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
  return data ?? []
})

/**
 * Returns the membership for the currently active org.
 * Returns the same shape as getOrgMembership() so it is a drop-in replacement.
 *
 * Resolution order:
 *  1. Cookie org  → only if the user is an active member of that org
 *  2. First active membership ordered by created_at (oldest first)
 */
export const getActiveOrgMembership = cache(async (userId: string) => {
  const supabase    = await createClient()
  const activeOrgId = await getActiveOrgId()

  const SELECT = 'org_id, role, can_view_all_tasks, can_view_monitor, organisations(id, name, slug, plan_tier, logo_color, status, trial_ends_at, trial_started_at, trial_extension_days, referral_code, join_code, subscription_id)'

  if (activeOrgId) {
    const { data } = await supabase
      .from('org_members')
      .select(SELECT)
      .eq('user_id', userId)
      .eq('org_id', activeOrgId)
      .eq('is_active', true)
      .maybeSingle()
    if (data) return data
  }

  // Fall back to oldest membership so the default is stable
  const { data } = await supabase
    .from('org_members')
    .select(SELECT)
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  return data
})
