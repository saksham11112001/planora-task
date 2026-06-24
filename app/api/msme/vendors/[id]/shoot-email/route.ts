import { NextRequest, NextResponse } from 'next/server'
import { createClient }             from '@/lib/supabase/server'
import { createAdminClient }        from '@/lib/supabase/admin'
import { getApiOrgMembership }      from '@/lib/supabase/apiActiveOrg'
import { sendMsmeVendorEmail }      from '@/lib/email/send'
import { DEFAULT_EMAIL_SCHEDULE }   from '@/app/api/msme/settings/route'
import crypto                       from 'crypto'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://upfloat.co'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
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
    .select('id, vendor_name, vendor_email, status, email_count, created_at')
    .eq('id', id)
    .eq('org_id', mb.org_id)
    .maybeSingle()

  if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })

  // ── Lock check: enforce email-slot limit server-side ──────────────────────
  // A slot is consumed when the first email is sent to a vendor (email_count 0→1).
  // Slots are permanent even if the vendor is later deleted — this prevents gaming.
  // If the vendor has already been emailed (email_count > 0), allow re-shoots regardless.
  if (vendor.email_count === 0) {
    const [{ data: packRow }, { data: addonRow }] = await Promise.all([
      admin.from('org_feature_settings').select('config').eq('org_id', mb.org_id).eq('feature_key', 'msme_pack').maybeSingle(),
      admin.from('org_feature_settings').select('config').eq('org_id', mb.org_id).eq('feature_key', 'msme_addon_slots').maybeSingle(),
    ])
    const vendorLimit: number = ((packRow?.config as any)?.vendor_limit ?? 5) + ((addonRow?.config as any)?.extra_slots ?? 0)

    // Count vendors that have already consumed an email slot (incl. soft-deleted)
    const { count: emailedEver } = await admin
      .from('msme_vendors')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', mb.org_id)
      .gt('email_count', 0)

    if ((emailedEver ?? 0) >= vendorLimit) {
      return NextResponse.json(
        { error: 'Email slot limit reached. Upgrade your pack to contact more vendors.' },
        { status: 403 }
      )
    }
  }

  // x-copy-only: generate link without sending email (for "share via WhatsApp" use case)
  const copyOnly = req.headers.get('x-copy-only') === '1'

  if (!copyOnly) {
    if (vendor.status === 'submitted' || vendor.status === 'not_msme') {
      return NextResponse.json({ error: 'Vendor has already submitted their details' }, { status: 422 })
    }
    if (vendor.email_count >= maxEmails) {
      return NextResponse.json({ error: `Maximum ${maxEmails} emails already sent to this vendor` }, { status: 422 })
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
  })

  const formUrl = `${APP_URL}/msme/form/${rawToken}`

  if (copyOnly) {
    // Return link only — no email sent, no email_count increment
    return NextResponse.json({ ok: true, formUrl })
  }

  const orgName = (mb.organisations as any)?.name ?? 'Your business'
  const attempt = Math.min(vendor.email_count + 1, 5) as 1 | 2 | 3 | 4 | 5

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
      to:           vendor.vendor_email,
      vendorName:   vendor.vendor_name,
      orgName,
      formUrl,
      attemptNo:    attempt,
      totalEmails:  maxEmails,
      cc:           ownerEmail,
      contactName:  contactPerson?.name,
      contactEmail: contactPerson?.email,
      contactPhone: contactPerson?.phone,
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

  await admin.from('msme_vendors').update({
    status: 'emailed',
    email_count: attempt,
    last_emailed_at: new Date().toISOString(),
  }).eq('id', id)

  await admin.from('msme_email_log').insert({
    vendor_id: id,
    org_id: mb.org_id,
    attempt_no: attempt,
  })

  return NextResponse.json({ ok: true, attempt, formUrl })
}
