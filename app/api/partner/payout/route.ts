// Partner payout request — owner submits bank details + withdrawal request.
import { NextRequest, NextResponse } from 'next/server'
import { createClient }             from '@/lib/supabase/server'
import { createAdminClient }        from '@/lib/supabase/admin'
import { getApiOrgMembership }      from '@/lib/supabase/apiActiveOrg'

const MIN_PAYOUT_PAISE = 50000  // ₹500 minimum payout

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, req, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'Not a member' }, { status: 403 })
  if (!['owner', 'admin'].includes(mb.role)) {
    return NextResponse.json({ error: 'Only the org owner or admin can request payouts' }, { status: 403 })
  }

  const { account_no, ifsc, account_name } = await req.json()
  if (!account_no?.trim() || !ifsc?.trim() || !account_name?.trim()) {
    return NextResponse.json({ error: 'Account number, IFSC, and account holder name are required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Sum approved commissions not yet in a payout
  const { data: approved } = await admin
    .from('partner_commissions')
    .select('id, commission_paise')
    .eq('partner_org_id', mb.org_id)
    .eq('status', 'approved')
    .is('payout_id', null)

  const totalPaise = (approved ?? []).reduce((s, c) => s + c.commission_paise, 0)

  if (totalPaise < MIN_PAYOUT_PAISE) {
    return NextResponse.json({
      error: `Minimum payout is ₹${MIN_PAYOUT_PAISE / 100}. You currently have ₹${(totalPaise / 100).toFixed(2)} approved.`,
    }, { status: 400 })
  }

  // Check no pending payout already exists
  const { data: existing } = await admin
    .from('partner_payouts')
    .select('id')
    .eq('partner_org_id', mb.org_id)
    .in('status', ['requested', 'processing'])
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'A payout request is already in progress' }, { status: 409 })
  }

  const { data: payout, error } = await admin
    .from('partner_payouts')
    .insert({
      partner_org_id: mb.org_id,
      amount_paise:   totalPaise,
      bank_details:   { account_no: account_no.trim(), ifsc: ifsc.trim().toUpperCase(), account_name: account_name.trim() },
      status: 'requested',
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Link commissions to this payout
  await admin
    .from('partner_commissions')
    .update({ payout_id: payout.id, status: 'paid' })
    .in('id', (approved ?? []).map(c => c.id))

  return NextResponse.json({ ok: true, payout_id: payout.id, amount_paise: totalPaise })
}
