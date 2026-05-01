/**
 * Server-side plan gating utilities.
 * Call these in page.tsx files to enforce plan limits.
 */

export const PLAN_LIMITS = {
  //                         members  projects   features
  free:     { members: 5,   projects: 3,   features: ['tasks','clients','recurring'] },
  starter:  { members: 15,  projects: 15,  features: ['tasks','clients','recurring','time_tracking','approvals','reports'] },
  pro:      { members: 50,  projects: 100, features: ['tasks','clients','recurring','time_tracking','approvals','reports','api','exports','ca_compliance'] },
  business: { members: -1,  projects: -1,  features: ['tasks','clients','recurring','time_tracking','approvals','reports','api','exports','ca_compliance','sso','audit'] },
} as const

export type PlanKey = keyof typeof PLAN_LIMITS

/**
 * Returns the effective plan.
 * - Active trial → 'pro' (full access during trial, consistent with planGuard)
 * - Expired trial → 'free'
 * - Cancelled / past_due → 'free'
 */
export function effectivePlan(org: {
  plan_tier:    string
  status:       string
  trial_ends_at?: string | null
}): PlanKey {
  const plan   = (org.plan_tier ?? 'free') as PlanKey
  const status = org.status ?? 'active'

  if (status === 'trialing') {
    if (!org.trial_ends_at) return 'pro'
    const expired = new Date() > new Date(org.trial_ends_at)
    return expired ? 'free' : 'pro'
  }

  // Subscription cancelled / past due → free
  if (status === 'cancelled' || status === 'past_due') return 'free'

  // New-user trial: active status but trial_ends_at is still in the future
  if (org.trial_ends_at && new Date() <= new Date(org.trial_ends_at)) return 'pro'

  return PLAN_LIMITS[plan] ? plan : 'free'
}

export function canUseFeature(plan: PlanKey, feature: string): boolean {
  return (PLAN_LIMITS[plan]?.features as readonly string[] ?? []).includes(feature)
}

export function memberLimit(plan: PlanKey): number {
  return PLAN_LIMITS[plan]?.members ?? 5
}

export function projectLimit(plan: PlanKey): number {
  return PLAN_LIMITS[plan]?.projects ?? 3
}

export function isAtMemberLimit(plan: PlanKey, currentCount: number): boolean {
  const limit = memberLimit(plan)
  return limit !== -1 && currentCount >= limit
}

export function isAtProjectLimit(plan: PlanKey, currentCount: number): boolean {
  const limit = projectLimit(plan)
  return limit !== -1 && currentCount >= limit
}
