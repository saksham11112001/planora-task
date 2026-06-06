/**
 * Ghost admin support.
 *
 * A single privileged user (identified by GHOST_ADMIN_USER_ID env var) can
 * access every organisation in the system without appearing in any member list.
 * They get a synthetic 'admin' membership so all role checks pass normally.
 *
 * Set GHOST_ADMIN_USER_ID in .env.local (or deployment env vars) to your
 * Supabase auth user UUID.
 */

const GHOST_ID = process.env.GHOST_ADMIN_USER_ID ?? ''

/** Returns true when the userId matches the configured ghost admin. */
export function isGhostAdmin(userId: string): boolean {
  return !!GHOST_ID && userId === GHOST_ID
}

/**
 * Builds a synthetic org membership object that satisfies the same shape
 * returned by getActiveOrgMembership(). The ghost admin is treated as an
 * admin — enough to see everything, but not the org owner.
 */
export function ghostMembership(org: {
  id: string; name: string; slug: string; plan_tier: string
  logo_color: string; status: string; trial_ends_at: string | null
  trial_started_at?: string | null; trial_extension_days?: number
  referral_code?: string | null; join_code?: string | null
  subscription_id?: string | null
}) {
  return {
    org_id:             org.id,
    role:               'admin' as const,
    can_view_all_tasks: true,
    can_view_monitor:   true,
    organisations:      org,
  }
}
