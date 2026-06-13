import { inngest }          from '../client'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendUpgradePushEmail } from '@/lib/email/send'
import { acquireEmailSlot }  from '@/lib/email/gate'

// Plan limits (must stay in sync with any limit checks in API routes)
const PLAN_LIMITS = {
  free:    { tasks: 50,  members: 3,  clients: 10  },
  starter: { tasks: 500, members: 10, clients: 100 },
  pro:     { tasks: Infinity, members: 50, clients: Infinity },
  business:{ tasks: Infinity, members: Infinity, clients: Infinity },
} as const

type LimitedPlan = 'free' | 'starter' | 'pro'

/**
 * Runs daily at 11 AM IST.
 * Checks free and starter orgs against their plan limits.
 * If any limit is ≥ 90% used, emails the owner once (per limit type per day).
 */
export const upgradePush = inngest.createFunction(
  { id: 'upgrade-push', name: 'Upgrade push — plan limit alerts', concurrency: { limit: 1 } },
  { cron: 'TZ=Asia/Kolkata 0 11 * * *' },
  async () => {
    const admin = createAdminClient()

    const { data: orgs } = await admin
      .from('organisations')
      .select('id, name, plan_tier')
      .in('plan_tier', ['free', 'starter'])
      .eq('status', 'active')
      .limit(1000)

    if (!orgs?.length) return { sent: 0 }

    let sent = 0
    for (const org of orgs) {
      const plan  = org.plan_tier as LimitedPlan
      const limits = PLAN_LIMITS[plan]
      if (!limits) continue

      // Get owner
      const { data: ownerMb } = await admin.from('org_members')
        .select('user_id, users!org_members_user_id_fkey(email, name)')
        .eq('org_id', org.id).eq('role', 'owner').eq('is_active', true)
        .limit(1).maybeSingle()
      if (!ownerMb) continue
      const owner = (ownerMb as any).users
      if (!owner?.email) continue

      // Count active tasks, members, clients
      const [tasksRes, membersRes, clientsRes] = await Promise.all([
        admin.from('tasks').select('*', { count: 'exact', head: true })
          .eq('org_id', org.id).neq('is_archived', true).neq('status', 'completed'),
        admin.from('org_members').select('*', { count: 'exact', head: true })
          .eq('org_id', org.id).eq('is_active', true),
        admin.from('clients').select('*', { count: 'exact', head: true })
          .eq('org_id', org.id).eq('status', 'active'),
      ])

      const taskCount   = tasksRes.count   ?? 0
      const memberCount = membersRes.count ?? 0
      const clientCount = clientsRes.count ?? 0

      // Find first limit that is >= 90% used
      let limitHit: 'tasks' | 'members' | 'clients' | null = null
      if (limits.tasks   !== Infinity && taskCount   >= limits.tasks   * 0.9) limitHit = 'tasks'
      else if (limits.members !== Infinity && memberCount >= limits.members * 0.9) limitHit = 'members'
      else if (limits.clients !== Infinity && clientCount >= limits.clients * 0.9) limitHit = 'clients'

      if (!limitHit) continue

      const slotKey = `upgrade_push_${limitHit}`
      if (!(await acquireEmailSlot(ownerMb.user_id, slotKey))) continue

      try {
        await sendUpgradePushEmail({
          to:          owner.email,
          userName:    owner.name ?? owner.email.split('@')[0],
          orgName:     org.name,
          currentPlan: plan,
          limitHit,
        })
        sent++
      } catch (e) {
        console.error('[upgrade-push] Failed for org', org.id, e)
      }
    }

    return { sent }
  }
)
