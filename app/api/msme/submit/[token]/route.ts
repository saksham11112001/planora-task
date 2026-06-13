// Public endpoint — no auth. Vendor submits their MSME details using their magic-link token.
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient }         from '@/lib/supabase/admin'
import crypto                        from 'crypto'

const UDYAM_REGEX = /^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token: rawToken } = await params
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
  const admin     = createAdminClient()

  const { data: tokenRow } = await admin
    .from('msme_tokens')
    .select('id, vendor_id, org_id, expires_at, used_at')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (!tokenRow) return NextResponse.json({ error: 'Invalid link' }, { status: 404 })
  if (new Date(tokenRow.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Link expired' }, { status: 410 })
  }

  const { data: vendor } = await admin
    .from('msme_vendors')
    .select('id, vendor_name, vendor_email, status, udyam_number, msme_category, nature_of_business, outstanding_amount, cert_url, is_not_msme, declarant_name, submitted_at, organisations(name)')
    .eq('id', tokenRow.vendor_id)
    .maybeSingle()

  if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })

  const isSubmitted = vendor.status === 'submitted' || vendor.status === 'not_msme'

  return NextResponse.json({
    vendor_id:   vendor.id,
    vendor_name: vendor.vendor_name,
    org_name:    (vendor.organisations as any)?.name ?? '',
    already_submitted: isSubmitted,
    already_declared:  vendor.status === 'not_msme',
    token_used: !!tokenRow.used_at,
    // Return submission details so vendor can see a receipt on re-open
    ...(isSubmitted ? {
      udyam_number:       vendor.udyam_number,
      msme_category:      vendor.msme_category,
      nature_of_business: vendor.nature_of_business,
      outstanding_amount: vendor.outstanding_amount,
      cert_url:           vendor.cert_url,
      is_not_msme:        vendor.is_not_msme,
      declarant_name:     vendor.declarant_name,
      submitted_at:       vendor.submitted_at,
    } : {}),
  })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token: rawToken } = await params
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
  const admin     = createAdminClient()

  const { data: tokenRow } = await admin
    .from('msme_tokens')
    .select('id, vendor_id, org_id, expires_at, used_at')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (!tokenRow) return NextResponse.json({ error: 'Invalid link' }, { status: 404 })
  if (new Date(tokenRow.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Link has expired. Please ask your firm to resend the email.' }, { status: 410 })
  }

  const body = await req.json()
  const {
    is_not_msme,
    declarant_name,
    udyam_number,
    msme_category,
    nature_of_business,
    outstanding_amount,
    // cert_url is set separately via file upload
    cert_url,
  } = body

  if (is_not_msme) {
    // Non-MSME declaration path
    if (!declarant_name?.trim()) {
      return NextResponse.json({ error: 'Please enter your name for the declaration' }, { status: 400 })
    }

    await admin.from('msme_vendors').update({
      status: 'not_msme',
      is_not_msme: true,
      declarant_name: declarant_name.trim(),
      declared_at: new Date().toISOString(),
      submitted_at: new Date().toISOString(),
    }).eq('id', tokenRow.vendor_id)

  } else {
    // MSME submission path
    if (!udyam_number?.trim()) {
      return NextResponse.json({ error: 'Udyam Registration Number is required' }, { status: 400 })
    }
    const udyamClean = udyam_number.trim().toUpperCase()
    if (!UDYAM_REGEX.test(udyamClean)) {
      return NextResponse.json({
        error: 'Invalid Udyam number format. Expected: UDYAM-XX-00-0000000 (e.g. UDYAM-MH-15-0012345)',
      }, { status: 400 })
    }
    if (!msme_category || !['micro', 'small', 'medium'].includes(msme_category)) {
      return NextResponse.json({ error: 'Please select an MSME category' }, { status: 400 })
    }
    if (!nature_of_business || !['manufacturer', 'service_provider', 'trader'].includes(nature_of_business)) {
      return NextResponse.json({ error: 'Please select nature of business' }, { status: 400 })
    }
    if (outstanding_amount !== undefined && outstanding_amount !== null && outstanding_amount !== '') {
      const amt = Number(outstanding_amount)
      if (isNaN(amt) || amt < 0) {
        return NextResponse.json({ error: 'Outstanding amount must be a non-negative number' }, { status: 400 })
      }
    }

    await admin.from('msme_vendors').update({
      status: 'submitted',
      udyam_number: udyamClean,
      msme_category,
      nature_of_business,
      outstanding_amount: outstanding_amount !== '' && outstanding_amount !== null ? Number(outstanding_amount) : null,
      cert_url: cert_url ?? null,
      submitted_at: new Date().toISOString(),
    }).eq('id', tokenRow.vendor_id)
  }

  // Mark token as used (don't delete — keeps audit trail)
  await admin.from('msme_tokens').update({ used_at: new Date().toISOString() }).eq('id', tokenRow.id)

  return NextResponse.json({ ok: true })
}
