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
import { ACTIVE_ORG_COOKIE } from './activeOrg'
import type { NextRequest }   from 'next/server'

export async function getApiOrgMembership(
  supabase:  any,
  userId:    string,
  request:   NextRequest,
  select:    string = 'org_id, role',
) {
  const activeOrgId = request.cookies.get(ACTIVE_ORG_COOKIE)?.value ?? null

  // Factory avoids the supabase-js mutable-builder problem: each call returns
  // a fresh builder so adding filters on one doesn't pollute the other.
  const makeBase = () =>
    supabase.from('org_members')
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
