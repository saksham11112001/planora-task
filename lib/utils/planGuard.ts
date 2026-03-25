import { PLAN_LIMITS } from './plans'

export type OrgPlanInfo = {
  plan_tier: string
  status: string
  trial_ends_at: string | null
}

/**
 * Returns the effective plan tier for an org.
 * - If the org is 'trialing' and the trial has NOT expired → treat as 'pro'
 *   (full access during trial)
 * - If the org is 'trialing' and the trial HAS expired → treat as 'free'
 * - Otherwise return the stored plan_tier
 */
export function effectivePlan(org: OrgPlanInfo): string {
  if (org.status === 'trialing') {
    if (!org.trial_ends_at) return 'pro'
    const expired = new Date() > new Date(org.trial_ends_at)
    return expired ? 'free' : 'pro'
  }
  if (org.status === 'cancelled') return 'free'
  return org.plan_tier
}

/**
 * Returns true if the org is currently on a valid trial
 */
export function isOnTrial(org: OrgPlanInfo): boolean {
  if (org.status !== 'trialing') return false
  if (!org.trial_ends_at) return true
  return new Date() <= new Date(org.trial_ends_at)
}

/**
 * Returns true if the org can use a given feature based on their effective plan
 */
export function orgCanUseFeature(org: OrgPlanInfo, feature: string): boolean {
  const plan = effectivePlan(org)
  return (PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS]?.features ?? []).includes(feature)
}

/**
 * Returns true if the org is within the member limit for their plan.
 * Pass -1 for currentMembers to skip the check.
 */
export function orgWithinMemberLimit(org: OrgPlanInfo, currentMembers: number): boolean {
  const plan = effectivePlan(org)
  const limit = PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS]?.members ?? 5
  if (limit === -1) return true // unlimited
  return currentMembers < limit
}

/**
 * Returns true if the org is within the project limit for their plan.
 */
export function orgWithinProjectLimit(org: OrgPlanInfo, currentProjects: number): boolean {
  const plan = effectivePlan(org)
  const limit = PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS]?.projects ?? 3
  if (limit === -1) return true // unlimited
  return currentProjects < limit
}

/**
 * How many days remain in the trial (0 if expired or not trialing)
 */
export function trialDaysRemaining(org: OrgPlanInfo): number {
  if (!isOnTrial(org) || !org.trial_ends_at) return 0
  const ms = new Date(org.trial_ends_at).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)))
}
