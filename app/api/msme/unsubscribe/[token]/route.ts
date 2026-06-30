// Public endpoint — vendor clicks "unsubscribe" from their email.
// Uses their form magic-link token to identify them.
// Does NOT check used_at — the form token may already be consumed.
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient }         from '@/lib/supabase/admin'
import crypto                        from 'crypto'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://upfloat.co'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token: rawToken } = await params
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
  const admin     = createAdminClient()

  const { data: tokenRow } = await admin
    .from('msme_tokens')
    .select('vendor_id, org_id')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (!tokenRow) {
    return NextResponse.redirect(`${APP_URL}/msme/unsubscribed?status=invalid`)
  }

  // Fetch vendor name for the confirmation page
  const { data: vendor } = await admin
    .from('msme_vendors')
    .select('vendor_name, email_bounced')
    .eq('id', tokenRow.vendor_id)
    .maybeSingle()

  if (!vendor) {
    return NextResponse.redirect(`${APP_URL}/msme/unsubscribed?status=invalid`)
  }

  // Already opted out — still show success (idempotent)
  if (!vendor.email_bounced) {
    await admin.from('msme_vendors')
      .update({ email_bounced: true, bounce_reason: 'Opted out — unsubscribed via email link' })
      .eq('id', tokenRow.vendor_id)
  }

  const name = encodeURIComponent(vendor.vendor_name ?? '')
  return NextResponse.redirect(`${APP_URL}/msme/unsubscribed?status=ok&name=${name}`)
}
