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
  // Read ALL cookies with this name — a domain migration in a previous release can leave
  // both a host-only cookie and a domain-scoped cookie with the same name. Browsers send
  // the more-specific (host-only) one first, so .get() returns the stale value.
  // We try every value until we find one the user actually has an active membership for.
  const allOrgIds = request.cookies.getAll(ACTIVE_ORG_COOKIE)
    .map(c => c.value).filter(Boolean)
  const activeOrgId = allOrgIds[0] ?? null
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

  // Try each cookie value in order — the first one where the user has an active
  // membership in the CORRECT org wins. This handles duplicate cookies gracefully.
  for (const orgId of allOrgIds) {
    const { data } = await makeBase().eq('org_id', orgId).maybeSingle()
    if (data) return data
  }

  // Fallback: oldest membership — stable default for single-org users
  const { data } = await makeBase()
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  return data ?? null
}
