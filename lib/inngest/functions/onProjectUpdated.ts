import { inngest }                 from '../client'
import { acquireEmailSlot }        from '@/lib/email/gate'
import { createAdminClient }        from '@/lib/supabase/admin'
import { sendProjectUpdatedEmail }   from '@/lib/email/send'
import { getOrgNotifMode, queueNotification } from '@/lib/email/queue'

export const onProjectUpdated = inngest.createFunction(
  { id: 'on-project-updated', name: 'Notify team on project status change' },
  { event: 'project/status-updated' },

  async ({ event }) => {
    const d     = event.data
    const admin = createAdminClient()

    // Notify all active org members about project status change
    const { data: members } = await admin.from('org_members')
      .select('user_id, users(id, name, email)')
      .eq('org_id', d.org_id).eq('is_active', true)

    if (!members?.length) return { count: 0 }

    let count = 0
    for (const m of members) {
      const user = m.users as any
      if (!user?.email || user.id === d.updated_by_id) continue // skip the updater

      const { data: prefs } = await admin.from('notification_preferences')
        .select('via_email').eq('user_id', user.id).eq('event_type', 'project_updated').maybeSingle()

      if (prefs?.via_email === false) continue

      const orgMode = await getOrgNotifMode(d.org_id)
      if (orgMode === 'digest') {
        await queueNotification({
          orgId: d.org_id, userId: user.id, userEmail: user.email,
          eventType: 'project_updated',
          subject: `Project "${d.project_name}" status changed to ${d.new_status} by ${d.updated_by_name}`,
        })
        count++
        continue
      }

      if (!(await acquireEmailSlot(user.id, 'project_updated'))) continue
      await sendProjectUpdatedEmail({
        to:           user.email,
        recipientName: user.name,
        projectName:  d.project_name,
        projectId:    d.project_id,
        oldStatus:    d.old_status,
        newStatus:    d.new_status,
        updatedBy:    d.updated_by_name,
        orgName:      d.org_name,
      })
      count++
    }

    return { notified: count }
  }
)
