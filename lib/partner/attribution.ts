/**
 * Partner-referral signup attribution — single source of truth.
 *
 * Marks exactly ONE open invite of the given type for this email as signed_up,
 * so a single partner is credited for a signup. This matters because commission
 * is derived from signed_up invites: crediting every partner who happened to
 * invite the same email would double-pay.
 *
 * Attribution order:
 *   1. the invite from `preferPartnerId` — the partner whose referral code /
 *      link the user actually arrived with, when that survived the flow; else
 *   2. the most-recently-sent open invite for this email (last-touch).
 *
 * Never throws: attribution must never break a signup. Returns true if an
 * invite was marked (i.e. this signup was a partner referral of `inviteType`).
 */
export async function attributeSignup(
  admin: any,
  email: string,
  inviteType: 'msme' | 'partner',
  preferPartnerId?: string | null,
): Promise<boolean> {
  try {
    const normalisedEmail = email.trim().toLowerCase()
    if (!normalisedEmail) return false

    const { data: openInvites } = await admin
      .from('partner_portal_invites')
      .select('id, partner_id, last_sent_at')
      .eq('email', normalisedEmail)
      .eq('invite_type', inviteType)
      .eq('signed_up', false)
      .order('last_sent_at', { ascending: false })

    if (!openInvites || openInvites.length === 0) return false

    const chosen =
      (preferPartnerId && openInvites.find((i: any) => i.partner_id === preferPartnerId)) ||
      openInvites[0]

    const { error } = await admin
      .from('partner_portal_invites')
      .update({ signed_up: true, signed_up_at: new Date().toISOString() })
      .eq('id', chosen.id)

    if (error) {
      console.error('[partner/attribution] update failed:', error.message)
      return false
    }
    return true
  } catch (err) {
    console.error('[partner/attribution] unexpected error:', err)
    return false
  }
}
