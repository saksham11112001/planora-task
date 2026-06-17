import { redirect }          from 'next/navigation'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { PartnerDashboard }  from './PartnerDashboard'

export const metadata = { title: 'Partner Dashboard' }

export default async function PartnerDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/partners/login')

  const admin = createAdminClient()

  // Try to find partner by user_id first
  let { data: partner } = await admin
    .from('standalone_partners')
    .select('id, name, email, referral_code, status, created_at')
    .eq('user_id', user.id)
    .maybeSingle()

  // If not found by user_id, try by email (first magic-link login after join)
  // and link the user_id automatically
  if (!partner && user.email) {
    const { data: byEmail } = await admin
      .from('standalone_partners')
      .select('id, name, email, referral_code, status, created_at')
      .eq('email', user.email.toLowerCase())
      .is('user_id', null)
      .maybeSingle()

    if (byEmail) {
      await admin
        .from('standalone_partners')
        .update({ user_id: user.id })
        .eq('id', byEmail.id)
      partner = byEmail
    }
  }

  if (!partner) redirect('/partners/join')

  const { data: invites } = await admin
    .from('partner_portal_invites')
    .select('id, email, invite_type, invite_count, last_sent_at, signed_up')
    .eq('partner_id', partner.id)
    .order('last_sent_at', { ascending: false })

  // Fetch withdrawal history
  const { data: withdrawals } = await admin
    .from('standalone_partner_withdrawals')
    .select('id, amount_paise, status, account_name, bank_account, bank_ifsc, upi_id, admin_note, created_at, processed_at')
    .eq('partner_id', partner.id)
    .order('created_at', { ascending: false })

  // Enrich signed-up MSME invites with pack purchase data
  const signedUpMsmeEmails = (invites ?? [])
    .filter(i => i.invite_type === 'msme' && i.signed_up)
    .map(i => i.email.toLowerCase())

  let packByEmail: Record<string, { packTier: string; amountPaise: number; paidAt: string }> = {}

  if (signedUpMsmeEmails.length > 0) {
    const { data: usersData } = await admin
      .from('users')
      .select('id, email')
      .in('email', signedUpMsmeEmails)

    if (usersData && usersData.length > 0) {
      const userIds = usersData.map((u: { id: string; email: string }) => u.id)

      const { data: members } = await admin
        .from('org_members')
        .select('user_id, org_id')
        .in('user_id', userIds)

      if (members && members.length > 0) {
        const orgIds = members.map((m: { user_id: string; org_id: string }) => m.org_id)

        const { data: payments } = await admin
          .from('msme_pack_payments')
          .select('org_id, pack_tier, amount_paise, paid_at')
          .in('org_id', orgIds)
          .eq('status', 'paid')
          .order('paid_at', { ascending: false })

        const emailToUserId: Record<string, string> = {}
        usersData.forEach((u: { id: string; email: string }) => {
          emailToUserId[u.email.toLowerCase()] = u.id
        })

        const userToOrg: Record<string, string> = {}
        members.forEach((m: { user_id: string; org_id: string }) => {
          if (!userToOrg[m.user_id]) userToOrg[m.user_id] = m.org_id
        })

        const latestByOrg: Record<string, { packTier: string; amountPaise: number; paidAt: string }> = {}
        ;(payments ?? []).forEach((p: { org_id: string; pack_tier: string; amount_paise: number; paid_at: string }) => {
          if (!latestByOrg[p.org_id]) {
            latestByOrg[p.org_id] = { packTier: p.pack_tier, amountPaise: p.amount_paise, paidAt: p.paid_at }
          }
        })

        signedUpMsmeEmails.forEach(email => {
          const userId = emailToUserId[email]
          if (!userId) return
          const orgId = userToOrg[userId]
          if (!orgId) return
          const payment = latestByOrg[orgId]
          if (payment) packByEmail[email] = payment
        })
      }
    }
  }

  const msmeInvites    = (invites ?? []).filter(i => i.invite_type === 'msme')
  const partnerInvites = (invites ?? []).filter(i => i.invite_type === 'partner')

  return (
    <PartnerDashboard
      partner={partner as any}
      msmeInvites={msmeInvites as any}
      partnerInvites={partnerInvites as any}
      withdrawals={(withdrawals ?? []) as any}
      packByEmail={packByEmail}
    />
  )
}
