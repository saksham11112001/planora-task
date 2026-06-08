/**
 * API-route equivalent of getActiveOrgMembership.
 * API routes don't use React cache() or next/headers cookies() —
 * they read cookies from the NextRequest object instead.
 *
 * Usage (replaces the direct org_members query in every API route):
 *
 *   const mb = await getApiOrgMembership(supabase, user.id, request, 'org_id, role')
 *   if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })
 */
import { createAdminClient } from './admin'
import { ACTIVE_ORG_COOKIE } from './activeOrg'
import { isGhostAdmin, ghostMembership } from './ghostAdmin'
import type { NextRequest }   from 'next/server'

export async function getApiOrgMembership(
  _supabase: any,
  userId:    string,
  request:   NextRequest,
  select:    string = 'org_id, role',
) {
  const activeOrgId = request.cookies.get(ACTIVE_ORG_COOKIE)?.value ?? null
  const admin = createAdminClient() as any

  // Ghost admin: synthesise a membership for the cookie org without needing a real row.
  // Without this, the fallback below would query org_members, find no row, and
  // return the ghost admin's oldest real membership — serving the wrong org's data.
  if (isGhostAdmin(userId)) {
    const orgId = activeOrgId
    if (orgId) {
      const { data: org } = await admin
        .from('organisations')
        .select('id, name, slug, plan_tier, logo_color, status, trial_ends_at, trial_started_at, trial_extension_days, referral_code, join_code, subscription_id')
        .eq('id', orgId)
        .maybeSingle()
      if (org) return ghostMembership(org)
    }
    // No cookie — fall back to first org alphabetically (same as server-side)
    const { data: firstOrg } = await admin
      .from('organisations')
      .select('id, name, slug, plan_tier, logo_color, status, trial_ends_at, trial_started_at, trial_extension_days, referral_code, join_code, subscription_id')
      .order('name', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (firstOrg) return ghostMembership(firstOrg)
    return null
  }

  // Use admin client so the org_members lookup is not blocked by RLS.
  const makeBase = () =>
    admin.from('org_members')
      .select(select)
      .eq('user_id', userId)
      .eq('is_active', true)

  if (activeOrgId) {
    const { data } = await makeBase().eq('org_id', activeOrgId).maybeSingle()
    if (data) return data
  }

  // Fallback: oldest membership — stable default for single-org users
  const { data } = await makeBase()
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  return data ?? null
}
