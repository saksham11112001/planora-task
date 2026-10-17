import { NextRequest, NextResponse } from 'next/server'
import { createClient }             from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/authUser'
import { createAdminClient }        from '@/lib/supabase/admin'
import { getApiOrgMembership }      from '@/lib/supabase/apiActiveOrg'
import { sendMsmeVendorEmail }      from '@/lib/email/send'
import { DEFAULT_EMAIL_SCHEDULE }   from '@/lib/msme/emailSchedule'
import { resolvePackEntitlement }   from '@/lib/msme/packs'
import { currentPeriod, isValidPeriodEnd, describePeriod } from '@/lib/msme/periods'
import { ensureDeclaration, getPreviousDeclaration, syncVendorMirror } from '@/lib/msme/declarations'
import { decideSend, sendSkipText } from '@/lib/msme/sendEligibility'
import crypto                       from 'crypto'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://upfloat.co'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, req, 'org_id, role, organisations(name)')
  if (!mb) return NextResponse.json({ error: 'Not a member' }, { status: 403 })
  if (!['owner', 'admin', 'manager'].includes(mb.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const admin = createAdminClient()

  // Fetch org's email schedule to determine max emails
  const { data: scheduleRow } = await admin
    .from('org_feature_settings')
    .select('config')
    .eq('org_id', mb.org_id)
    .eq('feature_key', 'msme_email_schedule')
    .maybeSingle()
  const intervalDays: number[] = (scheduleRow?.config?.days as number[] | undefined) ?? DEFAULT_EMAIL_SCHEDULE
  // total emails = 1 (immediate) + number of scheduled intervals
  const maxEmails = intervalDays.length + 1

  const { data: vendor } = await admin
    .from('msme_vendors')
    .select('id, vendor_name, vendor_email, status, email_count, email_bounced, created_at')
    .eq('id', id)
    .eq('org_id', mb.org_id)
    .maybeSingle()

  if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })

  // Which half-year is being chased. The client may name one (the period
  // selector in the UI); otherwise the period currently being collected.
  const bodyPeriod = await req.json().then(b => b?.period_end).catch(() => undefined)
  const periodEnd  = isValidPeriodEnd(bodyPeriod)
    ? bodyPeriod
    : currentPeriod(new Date().toISOString().slice(0, 10)).periodEnd

  const period = describePeriod(periodEnd)

  // Open this period's declaration, pre-filled from the vendor's last one, so
  // the vendor sees their existing details and need only restate the balance.
  const declaration = await ensureDeclaration(admin, {
    orgId: mb.org_id, vendorId: id, periodEnd,
  })
  // Did they declare in an earlier cycle? Drives the email's "we already have
  // your details" framing.
  const previous = declaration
    ? await getPreviousDeclaration(admin, id, periodEnd)
    : null

  // ── Eligibility ───────────────────────────────────────────────────────────
  // Every gate is scoped to THIS period except the slot ledger, which is
  // lifetime. decideSend is shared with the bulk send and the reminder cron so
  // all three cannot drift. See lib/msme/sendEligibility.ts.
  //
  // Slots are only looked up when one might actually be consumed — a vendor
  // emailed in any previous cycle costs nothing to chase again.
  let slotsRemaining = Number.POSITIVE_INFINITY
  if (vendor.email_count === 0) {
    const [{ data: packRow }, { data: addonRow }, { count: emailedEver }] = await Promise.all([
      admin.from('org_feature_settings').select('config').eq('org_id', mb.org_id).eq('feature_key', 'msme_pack').maybeSingle(),
      admin.from('org_feature_settings').select('config').eq('org_id', mb.org_id).eq('feature_key', 'msme_addon_slots').maybeSingle(),
      // Vendors that have already consumed a slot (incl. soft-deleted ones).
      admin.from('msme_vendors').select('id', { count: 'exact', head: true })
        .eq('org_id', mb.org_id).gt('email_count', 0),
    ])
    // Annual term: an expired pack drops back to the free allowance, so the
    // slot gate has to ask the shared resolver rather than read the raw limit.
    const vendorLimit: number = resolvePackEntitlement(
      packRow?.config as any,
      (addonRow?.config as any)?.extra_slots ?? 0,
    ).vendorLimit
    slotsRemaining = vendorLimit - (emailedEver ?? 0)
  }

  // x-copy-only: generate link without sending email (for "share via WhatsApp" use case)
  const copyOnly = req.headers.get('x-copy-only') === '1'

  const decision = decideSend({
    emailBounced:       !!vendor.email_bounced,
    periodStatus:       declaration?.status ?? 'none',
    periodEmailCount:   declaration?.email_count ?? 0,
    lifetimeEmailCount: vendor.email_count,
    maxEmails,
    slotsRemaining,
  })

  // A bounce or an exhausted slot blocks even a copy-only link: the first is an
  // opt-out, and the second is the paywall. The per-period checks are about
  // SENDING, so copying a link for a vendor who already answered stays allowed
  // — that is how a firm re-shares a receipt.
  if (!decision.send) {
    const hardBlock = decision.reason === 'bounced' || decision.reason === 'slot_limit'
    if (!copyOnly || hardBlock) {
      return NextResponse.json(
        { error: sendSkipText(decision.reason, maxEmails) },
        { status: decision.reason === 'slot_limit' ? 403 : 422 },
      )
    }
  }

  // Generate a magic-link token (30-day expiry)
  const rawToken  = crypto.randomBytes(32).toString('hex')
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
  const expiresAt = new Date(Date.now() + 30 * 86400_000).toISOString()

  await admin.from('msme_tokens').insert({
    vendor_id: id,
    org_id: mb.org_id,
    token_hash: tokenHash,
    expires_at: expiresAt,
    // Binds the link to one half-year. Without it, a vendor who kept the
    // September email could reopen it in April and overwrite the September
    // declaration with March figures.
    period_end: periodEnd,
  })

  const formUrl        = `${APP_URL}/msme/form/${rawToken}`
  const unsubscribeUrl = `${APP_URL}/api/msme/unsubscribe/${rawToken}`

  if (copyOnly) {
    // Return link only — no email sent, no email_count increment
    return NextResponse.json({ ok: true, formUrl, period_end: periodEnd })
  }

  const orgName = (mb.organisations as any)?.name ?? 'Your business'
  // "Reminder 2 of 5" counts within THIS half-year, not the vendor's lifetime.
  // Using the lifetime count would label a returning vendor's first March
  // email as their fourth.
  const attempt = Math.min((declaration?.email_count ?? 0) + 1, 5) as 1 | 2 | 3 | 4 | 5

  // Fetch CC email + contact person setting
  let ownerEmail: string | undefined
  let contactPerson: { name?: string; email?: string; phone?: string } | null = null
  try {
    const [{ data: ccRow }, { data: contactRow }] = await Promise.all([
      admin.from('org_feature_settings').select('config').eq('org_id', mb.org_id).eq('feature_key', 'msme_cc_email').maybeSingle(),
      admin.from('org_feature_settings').select('config').eq('org_id', mb.org_id).eq('feature_key', 'msme_contact_person').maybeSingle(),
    ])
    contactPerson = (contactRow?.config as { name?: string; email?: string; phone?: string } | null) ?? null
    const customCc: string | undefined = (ccRow?.config as { email?: string } | null)?.email || undefined
    if (customCc) {
      ownerEmail = customCc
    } else {
      const { data: ownerMember } = await admin
        .from('org_members')
        .select('user_id')
        .eq('org_id', mb.org_id)
        .eq('role', 'owner')
        .limit(1)               // maybeSingle() errors if an org has 2+ owners
        .maybeSingle()
      if (ownerMember?.user_id) {
        const { data: { user: ownerUser } } = await admin.auth.admin.getUserById(ownerMember.user_id)
        ownerEmail = ownerUser?.email ?? undefined
      }
    }
  } catch (e) { console.warn('[shoot-email] CC/contact lookup failed (email will send without CC):', (e as Error)?.message) }

  // Attempt the send — on any Resend error, clean up the orphan token and surface the error
  let sendError: string | null = null
  try {
    const { error: resendErr } = await sendMsmeVendorEmail({
      to:             vendor.vendor_email,
      vendorName:     vendor.vendor_name,
      orgName,
      formUrl,
      unsubscribeUrl,
      attemptNo:      attempt,
      totalEmails:    maxEmails,
      cc:             ownerEmail,
      contactName:    contactPerson?.name,
      contactEmail:   contactPerson?.email,
      contactPhone:   contactPerson?.phone,
      // Name the half-year, and tell a returning vendor their details are
      // already pre-filled so the second cycle is a confirmation, not a re-fill.
      asOn:           period.asOn,
      periodLabel:    period.rangeLabel,
      isReturning:    !!previous?.submitted_at,
    }) ?? {}
    if (resendErr) sendError = typeof resendErr === 'string' ? resendErr : (resendErr as any)?.message ?? 'Email delivery failed'
  } catch (err) {
    sendError = err instanceof Error ? err.message : 'Email delivery failed'
  }

  if (sendError) {
    // Remove the orphan token so it doesn't accumulate
    await admin.from('msme_tokens').delete().eq('token_hash', tokenHash)
    return NextResponse.json({ error: `Failed to send email: ${sendError}` }, { status: 502 })
  }

  const sentAt = new Date().toISOString()

  // The vendor row's email_count is the LIFETIME slot ledger: incremented,
  // never set to a per-period value and never reset. Every slot gate counts
  // rows where email_count > 0, so writing this period's count here would
  // hand a consumed slot back the moment a new cycle began.
  await admin.from('msme_vendors').update({
    email_count:     vendor.email_count + 1,
    last_emailed_at: sentAt,
    // Normally the mirror sets status from the latest declaration; this keeps
    // the row correct if the declarations table is not there yet.
    ...(declaration ? {} : { status: 'emailed' }),
  }).eq('id', id)

  if (declaration) {
    await admin.from('msme_declarations').update({
      status:          'emailed',
      email_count:     attempt,
      last_emailed_at: sentAt,
    }).eq('id', declaration.id)
    await syncVendorMirror(admin, id)
  }

  await admin.from('msme_email_log').insert({
    vendor_id: id,
    org_id: mb.org_id,
    attempt_no: attempt,
    period_end: periodEnd,
  })

  return NextResponse.json({ ok: true, attempt, formUrl, period_end: periodEnd })
}
