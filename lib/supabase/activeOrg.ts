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
import { cookies, headers }  from 'next/headers'
import { createClient }      from './server'
import { createAdminClient } from './admin'
import { isGhostAdmin, ghostMembership } from './ghostAdmin'

export const ACTIVE_ORG_COOKIE = 'upfloat_active_org'

/**
 * Extract EVERY value of the active-org cookie from a raw Cookie header.
 *
 * Why raw parsing: Next's parsed cookie APIs (cookies().getAll(name),
 * request.cookies.getAll(name)) are backed by a Map KEYED BY NAME, so when a
 * browser sends duplicate cookies with the same name — a host-only
 * upfloat_active_org from before the domain migration PLUS the current
 * domain-scoped one — they silently collapse to a single value. Which one
 * survives depends on header order, which differs between browsers.
 *
 * When the stale duplicate won, org resolution landed on an org the user
 * isn't in (→ fallback to their oldest membership): pages "couldn't load",
 * client mapping writes went to a different org than reads, and signing out
 * didn't help because sign-out clears only sb-* auth cookies. Parsing the raw
 * header restores the "try every candidate until one has a real membership"
 * behaviour both resolvers were designed around.
 */
export function parseActiveOrgIds(rawCookieHeader: string | null | undefined): string[] {
  if (!rawCookieHeader) return []
  const prefix = `${ACTIVE_ORG_COOKIE}=`
  const values: string[] = []
  for (const part of rawCookieHeader.split(';')) {
    const p = part.trim()
    if (!p.startsWith(prefix)) continue
    let v = p.slice(prefix.length)
    try { v = decodeURIComponent(v) } catch { /* keep raw */ }
    if (v) values.push(v)
  }
  return [...new Set(values)]
}

/** Read the active org id from the request cookie. Returns null if not set. */
export async function getActiveOrgId(): Promise<string | null> {
  // Same duplicate-aware parsing as getAllActiveOrgIds so every reader of
  // this cookie sees the SAME candidate order regardless of browser quirks.
  const all = await getAllActiveOrgIds()
  return all[0] ?? null
}

/** Read ALL active org cookie values (handles duplicate cookies from domain migration). */
async function getAllActiveOrgIds(): Promise<string[]> {
  // Raw Cookie header first — the parsed jar dedupes by name and silently
  // drops duplicates (see parseActiveOrgIds). Fall back to the jar if the
  // header is unavailable for any reason.
  try {
    const h = await headers()
    const fromRaw = parseActiveOrgIds(h.get('cookie'))
    if (fromRaw.length > 0) return fromRaw
  } catch { /* fall through */ }
  const jar = await cookies()
  return jar.getAll(ACTIVE_ORG_COOKIE).map(c => c.value).filter(Boolean)
}

/**
 * All active org memberships for a user — used to build the org switcher list.
 * Cached per request (React cache).
 */
export const getUserOrgs = cache(async (userId: string) => {
  const admin = createAdminClient()

  // Ghost admin: return ALL organisations as synthetic memberships
  if (isGhostAdmin(userId)) {
    const { data: orgs } = await admin
      .from('organisations')
      .select('id, name, slug, plan_tier, logo_color, status, trial_ends_at')
      .order('name', { ascending: true })
    return (orgs ?? []).map((org: any) => ({
      org_id: org.id,
      role: 'admin' as const,
      organisations: org,
    }))
  }

  // Use admin client to bypass RLS — the anon client's RLS policy may only expose
  // the currently-active org membership, causing the org switcher to see < 2 orgs.
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
  const admin       = createAdminClient()
  const activeOrgId = await getActiveOrgId()

  // Ghost admin: build a synthetic membership for any org without needing a real row
  if (isGhostAdmin(userId)) {
    const orgId = activeOrgId ?? null
    if (orgId) {
      const { data: org } = await admin
        .from('organisations')
        .select('id, name, slug, plan_tier, logo_color, status, trial_ends_at, trial_started_at, trial_extension_days, referral_code, join_code, subscription_id')
        .eq('id', orgId)
        .maybeSingle()
      if (org) return ghostMembership(org)
    }
    // Fall back to first org alphabetically
    const { data: firstOrg } = await admin
      .from('organisations')
      .select('id, name, slug, plan_tier, logo_color, status, trial_ends_at, trial_started_at, trial_extension_days, referral_code, join_code, subscription_id')
      .order('name', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (firstOrg) return ghostMembership(firstOrg)
    return null
  }

  // Use admin client to bypass RLS — same reason as getUserOrgs.
  const SELECT = 'org_id, role, can_view_all_tasks, can_view_monitor, organisations(id, name, slug, plan_tier, logo_color, status, trial_ends_at, trial_started_at, trial_extension_days, referral_code, join_code, subscription_id)'

  // Try every cookie value — duplicate cookies with the same name can exist after
  // the domain migration (host-only cookie shadows domain-scoped one in Cookie header).
  const allOrgIds = await getAllActiveOrgIds()
  for (const orgId of allOrgIds) {
    const { data } = await admin
      .from('org_members')
      .select(SELECT)
      .eq('user_id', userId)
      .eq('org_id', orgId)
      .eq('is_active', true)
      .maybeSingle()
    if (data) return data
  }

  // Fall back to oldest membership so the default is stable
  const { data } = await admin
    .from('org_members')
    .select(SELECT)
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  return data
})
