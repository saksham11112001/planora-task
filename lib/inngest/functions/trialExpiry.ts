import { inngest }         from '../client'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Runs daily at 9 AM IST — downgrades organisations whose trial has expired.
 * Fired by the same daily cron as reminders.
 */
export const trialExpiry = inngest.createFunction(
  { id: 'trial-expiry', name: 'Trial Expiry — daily check' },
  { cron: 'TZ=Asia/Kolkata 0 9 * * *' },
  async () => {
    const admin = createAdminClient()
    const now   = new Date().toISOString()

    // Find orgs that are trialing but trial has expired
    const { data: expired } = await admin
      .from('organisations')
      .select('id, name')
      .eq('status', 'trialing')
      .lt('trial_ends_at', now)

    if (!expired?.length) return { expired: 0 }

    // Downgrade them to free
    const ids = expired.map(o => o.id)
    await admin
      .from('organisations')
      .update({ status: 'active', plan_tier: 'free' })
      .in('id', ids)

    console.log(`[trial-expiry] Expired ${ids.length} trial orgs:`, ids)
    return { expired: ids.length }
  }
)
