import { inngest }               from '../client'
import { acquireEmailSlot }       from '@/lib/email/gate'
import { createAdminClient }       from '@/lib/supabase/admin'
import { sendMemberInvitedEmail }   from '@/lib/email/send'

export const onMemberInvited = inngest.createFunction(
  { id: 'on-member-invited', name: 'Notify team on new member join' },
  { event: 'team/member-joined' },

  async ({ event }) => {
    const d     = event.data
    const admin = createAdminClient()

    // Notify all managers/owners that a new member joined
    const { data: managers } = await admin.from('org_members')
      .select('user_id, users(id, name, email)')
      .eq('org_id', d.org_id)
      .in('role', ['owner', 'admin', 'manager'])
      .eq('is_active', true)

    if (!managers?.length) return { count: 0 }

    let count = 0
    for (const m of managers) {
      const user = m.users as any
      if (!user?.email || user.id === d.new_member_id) continue

      const { data: prefs } = await admin.from('notification_preferences')
        .select('via_email').eq('user_id', user.id).eq('event_type', 'member_invited').maybeSingle()

      if (prefs?.via_email === false) continue
      if (!(await acquireEmailSlot(user.id, 'member_invited'))) continue
      await sendMemberInvitedEmail({
        to:           user.email,
        recipientName: user.name,
        memberName:   d.member_name,
        memberEmail:  d.member_email,
        role:         d.role,
        invitedBy:    d.invited_by_name,
        orgName:      d.org_name,
      })
      count++
    }

    return { notified: count }
  }
)
