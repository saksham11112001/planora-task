import { redirect }          from 'next/navigation'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateCode }      from '@/lib/utils/codeGen'
import { attributeSignup }   from '@/lib/partner/attribution'
import { computeMsmeEarnings } from '@/lib/partner/commission'
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
    .limit(1).maybeSingle()

  // If not found by user_id, try by email (first magic-link login after join)
  // and link the user_id automatically
  if (!partner && user.email) {
    const { data: byEmail } = await admin
      .from('standalone_partners')
      .select('id, name, email, referral_code, status, created_at')
      .eq('email', user.email.toLowerCase())
      .is('user_id', null)
      .limit(1).maybeSingle()

    if (byEmail) {
      await admin
        .from('standalone_partners')
        .update({ user_id: user.id })
        .eq('id', byEmail.id)
      partner = byEmail
    }
  }

  // No standalone_partners record — auto-register this authenticated user so
  // org members and existing Planora users can access the partner portal without
  // having to create a separate password-based account.
  if (!partner && user.email) {
    // Get display name from users table (org profile) or fall back to email prefix
    const { data: userProfile } = await admin
      .from('users')
      .select('name, phone_number')
      .eq('id', user.id)
      .maybeSingle()

    const displayName = (userProfile as any)?.name?.trim() || user.email.split('@')[0]
    const phone       = (userProfile as any)?.phone_number ?? null

    // Generate a unique referral code — retry up to 5 times to handle collision
    let refCode = generateCode(8)
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data: clash } = await admin.from('standalone_partners').select('id').eq('referral_code', refCode).limit(1).maybeSingle()
      if (!clash) break
      refCode = generateCode(8)
    }

    const { data: created } = await admin
      .from('standalone_partners')
      .insert({
        user_id:       user.id,
        name:          displayName,
        email:         user.email.toLowerCase(),
        phone:         phone,
        referral_code: refCode,
        status:        'active',
      })
      .select('id, name, email, referral_code, status, created_at')
      .maybeSingle()

    if (created) {
      partner = created
      // This user became a partner without going through /partners/join (e.g. an
      // existing upFloat user landing here directly), so referred_by was never
      // captured. Still credit whoever invited them to the partner program, by
      // email — exactly one partner, matching the join-form path.
      await attributeSignup(admin, user.email.toLowerCase(), 'partner')
    } else {
      // Fallback: if insert failed (e.g. email unique conflict from a race), try fetching again
      const { data: retry } = await admin
        .from('standalone_partners')
        .select('id, name, email, referral_code, status, created_at')
        .eq('email', user.email.toLowerCase())
        .limit(1).maybeSingle()
      if (retry) {
        // Link user_id if missing
        if (!(retry as any).user_id) {
          await admin.from('standalone_partners').update({ user_id: user.id }).eq('id', (retry as any).id)
        }
        partner = retry
      }
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

  // Pack purchases + tier-based earnings via the SHARED calculator — the same
  // code the withdrawal route uses, so displayed and withdrawable amounts match.
  const { packByEmail } = await computeMsmeEarnings(admin, partner.id)

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
