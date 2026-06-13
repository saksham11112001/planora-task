import { inngest }          from '../client'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendOnboardingNudgeEmail } from '@/lib/email/send'
import { acquireEmailSlot }  from '@/lib/email/gate'

/**
 * Runs daily at 9:30 AM IST.
 * Finds org owners whose account is 3–5 days old and haven't completed setup.
 * Sends a checklist nudge email showing what's done and what's left.
 * Only sent once (acquireEmailSlot with 'onboarding_nudge' as key).
 */
export const onboardingNudge = inngest.createFunction(
  { id: 'onboarding-nudge', name: 'Onboarding nudge — setup checklist', concurrency: { limit: 1 } },
  { cron: 'TZ=Asia/Kolkata 30 9 * * *' },
  async () => {
    const admin = createAdminClient()
    const now   = new Date()

    // Orgs created 3–5 days ago
    const from5d = new Date(now.getTime() - 5 * 86400000).toISOString()
    const from3d = new Date(now.getTime() - 3 * 86400000).toISOString()

    const { data: recentOrgs } = await admin
      .from('organisations')
      .select('id, name, created_at')
      .gte('created_at', from5d)
      .lt('created_at', from3d)
      .limit(200)

    if (!recentOrgs?.length) return { sent: 0 }

    let sent = 0
    for (const org of recentOrgs) {
      // Get owner
      const { data: ownerMb } = await admin.from('org_members')
        .select('user_id, users!org_members_user_id_fkey(email, name)')
        .eq('org_id', org.id).eq('role', 'owner').eq('is_active', true)
        .limit(1).maybeSingle()
      if (!ownerMb) continue

      const owner = (ownerMb as any).users
      if (!owner?.email) continue

      if (!(await acquireEmailSlot(ownerMb.user_id, 'onboarding_nudge'))) continue

      // Check setup progress
      const [clientsRes, tasksRes, teamRes, caRes] = await Promise.all([
        admin.from('clients').select('id', { count: 'exact', head: true }).eq('org_id', org.id).limit(1),
        admin.from('tasks').select('id', { count: 'exact', head: true }).eq('org_id', org.id).limit(1),
        admin.from('org_members').select('id', { count: 'exact', head: true })
          .eq('org_id', org.id).eq('is_active', true).gt('user_id', ownerMb.user_id).limit(1),
        admin.from('tasks').select('id', { count: 'exact', head: true })
          .eq('org_id', org.id).contains('custom_fields', { _ca_compliance: true }).limit(1),
      ])

      const hasClient = (clientsRes.count ?? 0) > 0
      const hasTask   = (tasksRes.count ?? 0) > 0
      const hasTeam   = (teamRes.count ?? 0) > 0
      const hasCa     = (caRes.count ?? 0) > 0

      // Skip if everything is already done
      if (hasClient && hasTask && hasTeam && hasCa) continue

      try {
        await sendOnboardingNudgeEmail({
          to:       owner.email,
          userName: owner.name ?? owner.email.split('@')[0],
          orgName:  org.name,
          hasClient, hasTask, hasTeam, hasCa,
        })
        sent++
      } catch (e) {
        console.error('[onboarding-nudge] Failed for org', org.id, e)
      }
    }

    return { sent }
  }
)
