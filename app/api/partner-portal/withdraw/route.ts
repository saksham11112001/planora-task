// Standalone partner withdrawal requests.
// GET  → returns withdrawals list for the logged-in partner
// POST → submits a new withdrawal request (min ₹500, no duplicate pending)
import { NextRequest, NextResponse } from 'next/server'
import { createClient }             from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/authUser'
import { createAdminClient }        from '@/lib/supabase/admin'

const MSME_COMMISSION_PAISE    = 20000   // ₹200 per MSME paid pack
const PARTNER_COMMISSION_PAISE = 0       // ₹0 — no commission for referring a partner
const MIN_WITHDRAWAL_PAISE     = 50000   // ₹500 minimum

async function getPartnerOrError(admin: ReturnType<typeof createAdminClient>, userId: string) {
  const { data: partner } = await admin
    .from('standalone_partners')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()
  return partner
}

async function computeBalance(admin: ReturnType<typeof createAdminClient>, partnerId: string) {
  // Earned = number of invited MSME emails where the user's org has made a paid pack purchase × ₹200
  // Each invited email counts as AT MOST ONE commission, even if that user belongs to multiple orgs.
  const { data: msmeInvites } = await admin
    .from('partner_portal_invites')
    .select('email')
    .eq('partner_id', partnerId)
    .eq('invite_type', 'msme')
    .eq('signed_up', true)

  let paidMsmeCount = 0
  if (msmeInvites && msmeInvites.length > 0) {
    const emails = msmeInvites.map((i: { email: string }) => i.email.toLowerCase())

    const { data: users } = await admin
      .from('users')
      .select('id, email')
      .in('email', emails)

    if (users && users.length > 0) {
      // Map email → userId for later per-email check
      const emailToUserId: Record<string, string> = {}
      users.forEach((u: { id: string; email: string }) => { emailToUserId[u.email.toLowerCase()] = u.id })

      const userIds = users.map((u: { id: string }) => u.id)

      const { data: members } = await admin
        .from('org_members')
        .select('user_id, org_id')
        .in('user_id', userIds)

      if (members && members.length > 0) {
        // Map userId → list of org_ids (one user can be in multiple orgs)
        const userToOrgIds: Record<string, string[]> = {}
        members.forEach((m: { user_id: string; org_id: string }) => {
          if (!userToOrgIds[m.user_id]) userToOrgIds[m.user_id] = []
          userToOrgIds[m.user_id].push(m.org_id)
        })

        // Fetch all paid org_ids in one query
        const allOrgIds = [...new Set(members.map((m: { org_id: string }) => m.org_id))]
        const { data: paidPacks } = await admin
          .from('msme_pack_payments')
          .select('org_id')
          .in('org_id', allOrgIds)
          .eq('status', 'paid')
        const paidOrgSet = new Set((paidPacks ?? []).map((p: { org_id: string }) => p.org_id))

        // Count each invited email exactly once if ANY of their orgs has a paid pack
        for (const email of emails) {
          const userId = emailToUserId[email]
          if (!userId) continue
          const orgIds = userToOrgIds[userId] ?? []
          if (orgIds.some(orgId => paidOrgSet.has(orgId))) paidMsmeCount++
        }
      }
    }
  }

  const earnedPaise = paidMsmeCount * MSME_COMMISSION_PAISE

  // Deduct paid + pending withdrawals
  const { data: withdrawals } = await admin
    .from('standalone_partner_withdrawals')
    .select('amount_paise, status')
    .eq('partner_id', partnerId)
    .in('status', ['requested', 'processing', 'paid'])

  const deducted = (withdrawals ?? []).reduce((sum, w) => sum + w.amount_paise, 0)

  return {
    earnedPaise,
    availablePaise: Math.max(0, earnedPaise - deducted),
    hasPending: (withdrawals ?? []).some(w => w.status === 'requested' || w.status === 'processing'),
  }
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const admin   = createAdminClient()
  const partner = await getPartnerOrError(admin, user.id)
  if (!partner) return NextResponse.json({ error: 'Partner profile not found' }, { status: 404 })

  const { data: withdrawals } = await admin
    .from('standalone_partner_withdrawals')
    .select('id, amount_paise, status, account_name, bank_account, bank_ifsc, upi_id, admin_note, created_at, processed_at')
    .eq('partner_id', partner.id)
    .order('created_at', { ascending: false })

  const { earnedPaise, availablePaise, hasPending } = await computeBalance(admin, partner.id)

  return NextResponse.json({
    withdrawals:     withdrawals ?? [],
    earned_paise:    earnedPaise,
    available_paise: availablePaise,
    has_pending:     hasPending,
  })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const admin   = createAdminClient()
  const partner = await getPartnerOrError(admin, user.id)
  if (!partner) return NextResponse.json({ error: 'Partner profile not found' }, { status: 404 })

  const body = await req.json()
  const { amount_paise, account_name, bank_account, bank_ifsc, upi_id } = body

  // ── Validate inputs ───────────────────────────────────────────────────────
  if (!amount_paise || typeof amount_paise !== 'number' || !Number.isInteger(amount_paise)) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
  }
  if (amount_paise < MIN_WITHDRAWAL_PAISE) {
    return NextResponse.json({ error: 'Minimum withdrawal amount is ₹500' }, { status: 400 })
  }
  if (!account_name?.trim()) return NextResponse.json({ error: 'Account holder name is required' }, { status: 400 })
  if (!bank_account?.trim()) return NextResponse.json({ error: 'Bank account number is required' }, { status: 400 })
  if (!bank_ifsc?.trim())    return NextResponse.json({ error: 'IFSC code is required' }, { status: 400 })

  // IFSC: 11 chars, first 4 alpha, 5th is 0, last 6 alphanumeric
  const ifscClean = bank_ifsc.trim().toUpperCase()
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscClean)) {
    return NextResponse.json({ error: 'Enter a valid IFSC code (e.g. SBIN0001234)' }, { status: 400 })
  }

  // ── Check balance ─────────────────────────────────────────────────────────
  const { availablePaise, hasPending } = await computeBalance(admin, partner.id)

  if (hasPending) {
    return NextResponse.json({ error: 'You already have a withdrawal request in progress. Please wait for it to be processed.' }, { status: 409 })
  }
  if (amount_paise > availablePaise) {
    return NextResponse.json({
      error: `Requested amount ₹${(amount_paise / 100).toFixed(0)} exceeds your available balance of ₹${(availablePaise / 100).toFixed(0)}`,
    }, { status: 400 })
  }

  // ── Insert ────────────────────────────────────────────────────────────────
  const { data: withdrawal, error: insertErr } = await admin
    .from('standalone_partner_withdrawals')
    .insert({
      partner_id:   partner.id,
      amount_paise,
      account_name: account_name.trim(),
      bank_account: bank_account.trim(),
      bank_ifsc:    ifscClean,
      upi_id:       upi_id?.trim() || null,
      status:       'requested',
    })
    .select('id, amount_paise, status, account_name, bank_account, bank_ifsc, upi_id, admin_note, created_at, processed_at')
    .single()

  if (insertErr) {
    // 23505 = the partial unique index rejected a concurrent duplicate open request.
    // This is the authoritative guard against the check-then-insert race above.
    if ((insertErr as any).code === '23505') {
      return NextResponse.json({ error: 'You already have a withdrawal request in progress. Please wait for it to be processed.' }, { status: 409 })
    }
    console.error('[partner-portal/withdraw] insert failed:', insertErr.message)
    return NextResponse.json({ error: 'Failed to submit withdrawal request' }, { status: 500 })
  }

  // Return the new entry + updated balance
  const { data: allWithdrawals } = await admin
    .from('standalone_partner_withdrawals')
    .select('id, amount_paise, status, account_name, bank_account, bank_ifsc, upi_id, admin_note, created_at, processed_at')
    .eq('partner_id', partner.id)
    .order('created_at', { ascending: false })

  const { earnedPaise, availablePaise: newAvailable } = await computeBalance(admin, partner.id)

  return NextResponse.json({
    ok:              true,
    withdrawal,
    withdrawals:     allWithdrawals ?? [],
    earned_paise:    earnedPaise,
    available_paise: newAvailable,
    has_pending:     true,
  })
}
