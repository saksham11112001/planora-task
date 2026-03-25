import { inngest }           from '../client'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Runs every day at 6:00 AM IST (0:30 AM UTC).
 * Finds orgs whose trial has expired and are still in 'trialing' status,
 * then downgrades them to free/active so feature gates kick in.
 *
 * Does NOT delete any data — users just lose access to paid features.
 */
export const trialExpiry = inngest.createFunction(
  {
    id:   'trial-expiry',
    name: 'Daily: expire ended trials',
    concurrency: { limit: 1 },
  },
  { cron: '30 0 * * *' }, // 6:00 AM IST

  async ({ step }) => {
    const admin = createAdminClient()
    const now   = new Date().toISOString()

    // Find all orgs whose trial has expired and are still marked 'trialing'
    const expiredOrgs = await step.run('fetch-expired-trials', async () => {
      const { data } = await admin.from('organisations')
        .select('id, name')
        .eq('status', 'trialing')
        .lte('trial_ends_at', now)
        .limit(500)
      return data ?? []
    })

    let downgraded = 0

    for (const org of expiredOrgs) {
      await step.run(`downgrade-org-${org.id}`, async () => {
        await admin.from('organisations')
          .update({ status: 'active', plan_tier: 'free' })
          .eq('id', org.id)

        // Log the event for visibility
        await admin.from('billing_events').insert({
          org_id:     org.id,
          event_type: 'trial.expired',
          status:     'expired',
        })

        downgraded++
      })
    }

    return { checked: expiredOrgs.length, downgraded }
  }
)
