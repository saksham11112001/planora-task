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

  const msmeInvites    = (invites ?? []).filter(i => i.invite_type === 'msme')
  const partnerInvites = (invites ?? []).filter(i => i.invite_type === 'partner')

  return (
    <PartnerDashboard
      partner={partner as any}
      msmeInvites={msmeInvites as any}
      partnerInvites={partnerInvites as any}
    />
  )
}
