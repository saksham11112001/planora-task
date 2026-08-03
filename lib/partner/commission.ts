/**
 * Server-side MSME earnings calculation — shared by the partner dashboard
 * page and the withdrawal route so the displayed balance and the withdrawable
 * balance are computed by the SAME code and can never diverge.
 *
 * Per invited email: at most one commission-bearing pack (the latest paid
 * pack of the first of their orgs that has one), valued at the partner's
 * current tier rate (see lib/partner/tiers.ts).
 */
import { tierForSignups, msmeCommissionPaise, type PartnerTier } from './tiers'

export interface PackInfo { packTier: string; amountPaise: number; paidAt: string }

export interface MsmeEarnings {
  packByEmail:     Record<string, PackInfo>
  signedUpTotal:   number     // msme + partner signed-up referrals (drives tier)
  paidMsmeCount:   number
  tier:            PartnerTier
  earnedPaise:     number
}

export async function computeMsmeEarnings(admin: any, partnerId: string): Promise<MsmeEarnings> {
  // All signed-up invites in one query — msme rows drive commission,
  // the combined count drives the tier.
  const { data: signedInvites } = await admin
    .from('partner_portal_invites')
    .select('email, invite_type')
    .eq('partner_id', partnerId)
    .eq('signed_up', true)

  const signedUpTotal = (signedInvites ?? []).length
  const tier          = tierForSignups(signedUpTotal)
  const msmeEmails    = [...new Set(
    (signedInvites ?? [])
      .filter((i: any) => i.invite_type === 'msme')
      .map((i: any) => (i.email as string).toLowerCase()),
  )] as string[]

  const packByEmail: Record<string, PackInfo> = {}

  if (msmeEmails.length > 0) {
    const { data: users } = await admin
      .from('users')
      .select('id, email')
      .in('email', msmeEmails)

    if (users && users.length > 0) {
      const emailToUserId: Record<string, string> = {}
      users.forEach((u: { id: string; email: string }) => { emailToUserId[u.email.toLowerCase()] = u.id })

      const userIds = users.map((u: { id: string }) => u.id)
      const { data: members } = await admin
        .from('org_members')
        .select('user_id, org_id')
        .in('user_id', userIds)

      if (members && members.length > 0) {
        const userToOrgIds: Record<string, string[]> = {}
        members.forEach((m: { user_id: string; org_id: string }) => {
          if (!userToOrgIds[m.user_id]) userToOrgIds[m.user_id] = []
          userToOrgIds[m.user_id].push(m.org_id)
        })

        const allOrgIds = [...new Set(members.map((m: { org_id: string }) => m.org_id))]
        const { data: payments } = await admin
          .from('msme_pack_payments')
          .select('org_id, pack_tier, amount_paise, paid_at')
          .in('org_id', allOrgIds)
          .eq('status', 'paid')
          .order('paid_at', { ascending: false })

        // Latest paid pack per org (payments are ordered newest-first)
        const latestByOrg: Record<string, PackInfo> = {}
        ;(payments ?? []).forEach((p: { org_id: string; pack_tier: string; amount_paise: number; paid_at: string }) => {
          if (!latestByOrg[p.org_id]) {
            latestByOrg[p.org_id] = { packTier: p.pack_tier, amountPaise: p.amount_paise, paidAt: p.paid_at }
          }
        })

        // One pack per email: first of the user's orgs that has a paid pack
        for (const email of msmeEmails) {
          const userId = emailToUserId[email]
          if (!userId) continue
          for (const orgId of userToOrgIds[userId] ?? []) {
            const pack = latestByOrg[orgId]
            if (pack) { packByEmail[email] = pack; break }
          }
        }
      }
    }
  }

  const paidPacks   = Object.values(packByEmail)
  const earnedPaise = paidPacks.reduce((sum, p) => sum + msmeCommissionPaise(p.amountPaise, tier.ratePct), 0)

  return { packByEmail, signedUpTotal, paidMsmeCount: paidPacks.length, tier, earnedPaise }
}
