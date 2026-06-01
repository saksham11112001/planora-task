import { inngest }         from '../client'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendTrialExpiringSoonEmail, sendTrialExpiredEmail } from '@/lib/email/send'

const OWNER_SELECT = 'org_id, user_id, users!org_members_user_id_fkey(email, name)'

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

    let warned = 0
    for (const org of expiringSoon ?? []) {
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

    // Send trial-expired email to each org owner
    let notified = 0
    for (const org of expired) {
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
