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
import type { NextRequest }   from 'next/server'

export async function getApiOrgMembership(
  _supabase: any,
  userId:    string,
  request:   NextRequest,
  select:    string = 'org_id, role',
) {
  const activeOrgId = request.cookies.get(ACTIVE_ORG_COOKIE)?.value ?? null

  // Use admin client so the org_members lookup is not blocked by RLS.
  // The anon client's RLS policy may only expose the previously-active org's row,
  // causing the cookie-based lookup to silently fall back to the oldest org and
  // serve every API route with the wrong org_id after a workspace switch.
  // userId is the verified auth.uid() from supabase.auth.getUser() in each caller.
  // Cast to any — same typing as the original supabase: any parameter so callers
  // can still access .org_id, .role etc. without schema generics on the admin client.
  const admin = createAdminClient() as any

  // Factory avoids the supabase-js mutable-builder problem: each call returns
  // a fresh builder so adding filters on one doesn't pollute the other.
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
