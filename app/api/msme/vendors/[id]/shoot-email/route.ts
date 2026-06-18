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
    .select('id, vendor_name, vendor_email, status, email_count')
    .eq('id', id)
    .eq('org_id', mb.org_id)
    .maybeSingle()

  if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })

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
  const attempt = (vendor.email_count + 1) as 1 | 2 | 3 | 4 | 5

  // Fetch org owner's email for CC
  let ownerEmail: string | undefined
  try {
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
  } catch {}

  await sendMsmeVendorEmail({
    to: vendor.vendor_email,
    vendorName: vendor.vendor_name,
    orgName,
    formUrl,
    attemptNo: attempt,
    totalEmails: maxEmails,
    cc: ownerEmail,
  })

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
