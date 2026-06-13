import { inngest }          from '../client'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendReEngagementEmail } from '@/lib/email/send'
import { acquireEmailSlot }  from '@/lib/email/gate'
import { todayStr }          from '@/lib/utils/format'

/**
 * Runs daily at 10 AM IST.
 * Finds users who have not logged in for exactly 7 days (±12 h window)
 * and have at least one active org membership. Sends a re-engagement email
 * including their overdue task and pending approval counts.
 */
export const reEngagement = inngest.createFunction(
  { id: 're-engagement', name: 'Re-engagement — 7-day inactive users', concurrency: { limit: 1 } },
  { cron: 'TZ=Asia/Kolkata 0 10 * * *' },
  async () => {
    const admin  = createAdminClient()
    const now    = new Date()
    const today  = todayStr()

    // 7-day inactivity window: last_sign_in between 7d and 8d ago
    const from8d = new Date(now.getTime() - 8 * 86400000).toISOString()
    const from7d = new Date(now.getTime() - 7 * 86400000).toISOString()

    // Supabase auth.users — use admin rpc to get last_sign_in_at
    const { data: inactiveUsers } = await admin
      .from('users')
      .select('id, email, name, last_sign_in_at')
      .gte('last_sign_in_at', from8d)
      .lt('last_sign_in_at', from7d)
      .limit(500)

    if (!inactiveUsers?.length) return { sent: 0 }

    let sent = 0
    for (const u of inactiveUsers) {
      if (!u.email) continue

      // Must be an active org member
      const { data: mb } = await admin.from('org_members')
        .select('org_id, organisations(name)')
        .eq('user_id', u.id).eq('is_active', true)
        .limit(1).maybeSingle()
      if (!mb) continue

      const orgId   = mb.org_id
      const orgName = (mb.organisations as any)?.name ?? 'your workspace'

      // Count overdue tasks assigned to user
      const { count: overdueCount } = await admin.from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId).eq('assignee_id', u.id)
        .in('status', ['todo', 'in_progress']).lt('due_date', today)

      // Count tasks pending their approval
      const { count: pendingCount } = await admin.from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId).eq('approver_id', u.id)
        .eq('approval_status', 'pending')

      if (!(await acquireEmailSlot(u.id, 're_engagement'))) continue

      try {
        await sendReEngagementEmail({
          to:           u.email,
          userName:     u.name ?? u.email.split('@')[0],
          orgName,
          daysSince:    7,
          overdueCount: overdueCount ?? 0,
          pendingCount: pendingCount ?? 0,
        })
        sent++
      } catch (e) {
        console.error('[re-engagement] Failed for user', u.id, e)
      }
    }

    return { sent }
  }
)
