// Bulk email sender — fires all vendor emails in parallel server-side.
// Auth + pack-limit check happens once, then all eligible vendors are emailed concurrently.
// Returns immediately with { sent, failed, errors[] } — no sequential blocking.
import { NextRequest, NextResponse } from 'next/server'
import { createClient }             from '@/lib/supabase/server'
import { createAdminClient }        from '@/lib/supabase/admin'
import { getApiOrgMembership }      from '@/lib/supabase/apiActiveOrg'
import { sendMsmeVendorEmail }      from '@/lib/email/send'
import { DEFAULT_EMAIL_SCHEDULE }   from '@/app/api/msme/settings/route'
import crypto                       from 'crypto'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://upfloat.co'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, req, 'org_id, role, organisations(name)')
  if (!mb) return NextResponse.json({ error: 'Not a member' }, { status: 403 })
  if (!['owner', 'admin', 'manager'].includes(mb.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const body = await req.json()
  const { vendor_ids } = body as { vendor_ids?: string[] }
  if (!Array.isArray(vendor_ids) || vendor_ids.length === 0) {
    return NextResponse.json({ error: 'vendor_ids array required' }, { status: 400 })
  }
  if (vendor_ids.length > 500) {
    return NextResponse.json({ error: 'Maximum 500 vendors per bulk send' }, { status: 400 })
  }

  const admin   = createAdminClient()
  const orgName = (mb.organisations as any)?.name ?? 'Your firm'

  // Fetch all settings in parallel — one DB round-trip for the whole batch
  const [
    { data: scheduleRow },
    { data: packRow },
    { data: addonRow },
    { data: ccRow },
    { data: contactRow },
    { count: emailedEver },
  ] = await Promise.all([
    admin.from('org_feature_settings').select('config').eq('org_id', mb.org_id).eq('feature_key', 'msme_email_schedule').maybeSingle(),
    admin.from('org_feature_settings').select('config').eq('org_id', mb.org_id).eq('feature_key', 'msme_pack').maybeSingle(),
    admin.from('org_feature_settings').select('config').eq('org_id', mb.org_id).eq('feature_key', 'msme_addon_slots').maybeSingle(),
    admin.from('org_feature_settings').select('config').eq('org_id', mb.org_id).eq('feature_key', 'msme_cc_email').maybeSingle(),
    admin.from('org_feature_settings').select('config').eq('org_id', mb.org_id).eq('feature_key', 'msme_contact_person').maybeSingle(),
    admin.from('msme_vendors').select('id', { count: 'exact', head: true }).eq('org_id', mb.org_id).gt('email_count', 0),
  ])

  const intervalDays: number[] = (scheduleRow?.config?.days as number[] | undefined) ?? DEFAULT_EMAIL_SCHEDULE
  const maxEmails               = intervalDays.length + 1
  const vendorLimit: number     = ((packRow?.config as any)?.vendor_limit ?? 5) + ((addonRow?.config as any)?.extra_slots ?? 0)
  const slotsUsed               = emailedEver ?? 0
  const slotsRemaining          = Math.max(0, vendorLimit - slotsUsed)
  const cc                      = (ccRow?.config as { email?: string } | null)?.email || undefined
  const contactPerson           = (contactRow?.config as { name?: string; email?: string; phone?: string } | null) ?? null

  // Fetch all requested vendors in one query (scoped to this org)
  const { data: vendors } = await admin
    .from('msme_vendors')
    .select('id, vendor_name, vendor_email, status, email_count')
    .eq('org_id', mb.org_id)
    .eq('is_deleted', false)
    .in('id', vendor_ids)

  if (!vendors?.length) return NextResponse.json({ sent: 0, failed: 0, errors: [] })

  // Split into new (never emailed) vs re-shoots
  const newVendors    = vendors.filter(v => v.email_count === 0)
  const reshootVendors = vendors.filter(v => v.email_count > 0 && v.email_count < maxEmails && v.status !== 'submitted' && v.status !== 'not_msme')

  // Only allow up to slotsRemaining new vendors
  const eligibleNew    = newVendors.slice(0, slotsRemaining)
  const skippedSlot    = newVendors.length - eligibleNew.length
  const eligible       = [...eligibleNew, ...reshootVendors]

  if (eligible.length === 0) {
    return NextResponse.json({
      sent: 0, failed: 0, skipped_slot_limit: skippedSlot, errors: [],
    })
  }

  // Send all emails in parallel
  const results = await Promise.allSettled(
    eligible.map(async vendor => {
      const rawToken  = crypto.randomBytes(32).toString('hex')
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
      const expiresAt = new Date(Date.now() + 30 * 86400_000).toISOString()
      const attempt   = Math.min(vendor.email_count + 1, 5) as 1 | 2 | 3 | 4 | 5

      await admin.from('msme_tokens').insert({
        vendor_id: vendor.id,
        org_id:    mb.org_id,
        token_hash: tokenHash,
        expires_at: expiresAt,
      })

      const formUrl = `${APP_URL}/msme/form/${rawToken}`

      const { error: sendErr } = await sendMsmeVendorEmail({
        to:           vendor.vendor_email,
        vendorName:   vendor.vendor_name,
        orgName,
        formUrl,
        attemptNo:    attempt,
        totalEmails:  maxEmails,
        cc,
        contactName:  contactPerson?.name,
        contactEmail: contactPerson?.email,
        contactPhone: contactPerson?.phone,
      }) ?? {}

      if (sendErr) {
        // Clean up orphan token on failure
        await admin.from('msme_tokens').delete().eq('token_hash', tokenHash)
        throw new Error((sendErr as any)?.message ?? 'Email delivery failed')
      }

      // Update vendor record
      await Promise.all([
        admin.from('msme_vendors').update({
          status:          'emailed',
          email_count:     attempt,
          last_emailed_at: new Date().toISOString(),
        }).eq('id', vendor.id),
        admin.from('msme_email_log').insert({
          vendor_id:  vendor.id,
          org_id:     mb.org_id,
          attempt_no: attempt,
        }),
      ])

      return vendor.id
    })
  )

  const sent   = results.filter(r => r.status === 'fulfilled').length
  const errors = results
    .map((r, i) => r.status === 'rejected' ? { vendor_id: eligible[i].id, vendor_name: eligible[i].vendor_name, reason: (r.reason as Error)?.message ?? 'Unknown error' } : null)
    .filter(Boolean) as { vendor_id: string; vendor_name: string; reason: string }[]

  return NextResponse.json({
    sent,
    failed:            errors.length,
    skipped_slot_limit: skippedSlot,
    errors,
  })
}
