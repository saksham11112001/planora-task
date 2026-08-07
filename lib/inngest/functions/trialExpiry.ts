import { inngest }         from '../client'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendTrialExpiringSoonEmail, sendTrialExpiredEmail } from '@/lib/email/send'

const OWNER_SELECT = 'org_id, user_id, users!org_members_user_id_fkey(email, name)'

/**
 * Orgs that have bought an MSME pack are MSME customers. A "your upFloat trial
 * is ending" email is about a product they never signed up for.
 *
 * This is defence in depth, not the primary guard: sendAppUsageEmail already
 * filters on users.signup_product. But that flag is set per USER at signup and
 * was historically inferred from client-side state, so it can be wrong for
 * anyone who signed up before it was made reliable. This check keys off a hard
 * fact — money changed hands for MSME — and so cannot be wrong in the same way.
 *
 * The downgrade itself is NOT skipped; only the email. Billing state must stay
 * accurate regardless of which product the customer came from.
 */
async function orgsWithPaidMsmePack(
  admin: ReturnType<typeof createAdminClient>,
  orgIds: string[],
): Promise<Set<string>> {
  if (orgIds.length === 0) return new Set()
  const { data, error } = await admin
    .from('msme_pack_payments')
    .select('org_id')
    .in('org_id', orgIds)
    .eq('status', 'paid')
  if (error) {
    // Fail OPEN: on a lookup failure keep the existing behaviour (send) rather
    // than silently suppressing mail for every org in the run.
    console.error('[trial-expiry] MSME pack lookup failed, not suppressing:', error.message)
    return new Set()
  }
  return new Set((data ?? []).map(r => r.org_id as string))
}

async function fetchOrgOwner(admin: ReturnType<typeof createAdminClient>, orgId: string) {
  const { data } = await admin
    .from('org_members')
    .select(OWNER_SELECT)
    .eq('org_id', orgId)
    .eq('role', 'owner')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()
  const user = (data as any)?.users
  return user ? { email: user.email as string, name: user.name as string } : null
}

/**
 * Runs daily at 9 AM IST.
 * 1. Sends a 3-day warning email to owners of orgs expiring in ~3 days.
 * 2. Downgrades orgs whose trial has expired and emails the owner.
 */
export const trialExpiry = inngest.createFunction(
  { id: 'trial-expiry', name: 'Trial Expiry — daily check' },
  { cron: 'TZ=Asia/Kolkata 0 9 * * *' },
  async () => {
    const admin = createAdminClient()
    const now   = new Date()

    // ── 1. Trial-expiring-soon warning (fires once when exactly 3–4 days remain) ──
    const warnStart = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString()
    const warnEnd   = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000).toISOString()

    const { data: expiringSoon } = await admin
      .from('organisations')
      .select('id, name, trial_ends_at')
      .eq('status', 'trialing')
      .gte('trial_ends_at', warnStart)
      .lt('trial_ends_at', warnEnd)

    const msmeSoon = await orgsWithPaidMsmePack(admin, (expiringSoon ?? []).map(o => o.id))

    let warned = 0
    for (const org of expiringSoon ?? []) {
      if (msmeSoon.has(org.id)) {
        console.log(`[trial-expiry] skipped warning for MSME-pack org ${org.id}`)
        continue
      }
      const owner = await fetchOrgOwner(admin, org.id)
      if (!owner) continue
      try {
        await sendTrialExpiringSoonEmail({
          to:          owner.email,
          userName:    owner.name,
          orgName:     org.name,
          trialEndsAt: org.trial_ends_at,
          daysLeft:    3,
        })
        warned++
      } catch (e) {
        console.error(`[trial-expiry] Failed to send warning email for org ${org.id}:`, e)
      }
    }

    // ── 2. Expire trials and notify owners (existing downgrade logic preserved) ──
    const nowIso = now.toISOString()
    const { data: expired } = await admin
      .from('organisations')
      .select('id, name')
      .eq('status', 'trialing')
      .lt('trial_ends_at', nowIso)

    if (!expired?.length) {
      console.log(`[trial-expiry] warned=${warned} expired=0`)
      return { warned, expired: 0 }
    }

    // Downgrade them to free (unchanged from original)
    const ids = expired.map(o => o.id)
    await admin
      .from('organisations')
      .update({ status: 'active', plan_tier: 'free' })
      .in('id', ids)

    // Send trial-expired email to each org owner. The downgrade above already
    // ran for every org — only the email is suppressed for MSME customers.
    const msmeExpired = await orgsWithPaidMsmePack(admin, ids)

    let notified = 0
    for (const org of expired) {
      if (msmeExpired.has(org.id)) {
        console.log(`[trial-expiry] skipped expiry email for MSME-pack org ${org.id}`)
        continue
      }
      const owner = await fetchOrgOwner(admin, org.id)
      if (!owner) continue
      try {
        await sendTrialExpiredEmail({
          to:       owner.email,
          userName: owner.name,
          orgName:  org.name,
        })
        notified++
      } catch (e) {
        console.error(`[trial-expiry] Failed to send expired email for org ${org.id}:`, e)
      }
    }

    console.log(`[trial-expiry] warned=${warned} expired=${ids.length} notified=${notified}`)
    return { warned, expired: ids.length, notified }
  }
)
