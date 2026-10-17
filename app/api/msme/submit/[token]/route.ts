// Public endpoint — no auth. Vendor submits their MSME details using their magic-link token.
//
// HALF-YEARLY: a token belongs to one reporting period (31 March or
// 30 September). The submission is written to that period's row in
// msme_declarations, and the vendor row is then re-synced as a mirror of the
// vendor's latest declaration. See lib/msme/declarations.ts.
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient }         from '@/lib/supabase/admin'
import { currentPeriod, isValidPeriodEnd, describePeriod } from '@/lib/msme/periods'
import {
  ensureDeclaration, getDeclaration, getPreviousDeclaration, syncVendorMirror,
} from '@/lib/msme/declarations'
import crypto                        from 'crypto'

const UDYAM_REGEX = /^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/

const TOKEN_COLS = 'id, vendor_id, org_id, expires_at, used_at, period_end, created_at'

/**
 * Which half-year is this link for?
 *
 * Tokens minted before the half-yearly migration carry no period. For those,
 * the period that was current WHEN THE TOKEN WAS CREATED is the right answer —
 * not the one current now. A link emailed in September and opened in April
 * was asking for September figures, and resolving it to "now" would file them
 * against the wrong half-year.
 */
function tokenPeriod(tokenRow: { period_end?: string | null; created_at?: string | null }): string {
  if (isValidPeriodEnd(tokenRow.period_end)) return tokenRow.period_end
  const createdOn = (tokenRow.created_at ?? new Date().toISOString()).slice(0, 10)
  return currentPeriod(createdOn).periodEnd
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token: rawToken } = await params
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
  const admin     = createAdminClient()

  const { data: tokenRow } = await admin
    .from('msme_tokens')
    .select(TOKEN_COLS)
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

  const periodEnd = tokenPeriod(tokenRow)
  const period    = describePeriod(periodEnd)

  // Create the row on first open if it is somehow missing (a legacy token, or
  // a link shared before this period's declaration was opened). Pre-fills
  // itself from the vendor's previous declaration.
  const declaration =
    (await ensureDeclaration(admin, { orgId: tokenRow.org_id, vendorId: vendor.id, periodEnd }))
    ?? (await getDeclaration(admin, vendor.id, periodEnd))

  // Fall back to the vendor row when the declarations table is unavailable,
  // so the form still works if the code is deployed before the migration runs.
  const d = declaration ?? vendor
  const isSubmitted = d.status === 'submitted' || d.status === 'not_msme'

  // Last half-year's figure, shown as READ-ONLY context ("you last declared
  // ₹50,000 as on 31 Mar 2026"). Deliberately not pre-filled into the input:
  // the balance is the one thing that must be re-stated, not confirmed.
  const prev = declaration
    ? await getPreviousDeclaration(admin, vendor.id, periodEnd)
    : null

  return NextResponse.json({
    vendor_id:   vendor.id,
    vendor_name: vendor.vendor_name,
    org_name:    (vendor.organisations as any)?.name ?? '',
    already_submitted: isSubmitted,
    already_declared:  d.status === 'not_msme',
    token_used: !!tokenRow.used_at,

    // Which half-year this form is asking about.
    period_end:   periodEnd,
    period_label: period.label,
    period_due:   period.dueDate,

    // Carried forward from the previous cycle so a returning vendor confirms
    // rather than re-keys. outstanding_amount is NOT among these.
    prefill: {
      udyam_number:        declaration?.udyam_number        ?? null,
      pan:                 declaration?.pan                 ?? null,
      udyam_registered_on: declaration?.udyam_registered_on ?? null,
      msme_category:       declaration?.msme_category       ?? null,
      nature_of_business:  declaration?.nature_of_business  ?? null,
      cert_url:            declaration?.cert_url            ?? null,
      is_not_msme:         declaration?.is_not_msme         ?? false,
    },
    is_returning: !!prev?.submitted_at,
    previous: prev?.submitted_at ? {
      period_label:       describePeriod(prev.period_end).label,
      outstanding_amount: prev.outstanding_amount,
      is_not_msme:        prev.is_not_msme,
    } : null,

    // Submission receipt on re-open — for THIS period.
    ...(isSubmitted ? {
      udyam_number:       d.udyam_number,
      msme_category:      d.msme_category,
      nature_of_business: d.nature_of_business,
      outstanding_amount: d.outstanding_amount,
      cert_url:           d.cert_url,
      is_not_msme:        d.is_not_msme,
      declarant_name:     d.declarant_name,
      submitted_at:       d.submitted_at,
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
    .select(TOKEN_COLS)
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (!tokenRow) return NextResponse.json({ error: 'Invalid link' }, { status: 404 })
  if (new Date(tokenRow.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Link has expired. Please ask the sender to resend the email.' }, { status: 410 })
  }
  if (tokenRow.used_at) {
    return NextResponse.json({ error: 'This link has already been used. Contact the sender if you need to make changes.' }, { status: 410 })
  }

  const body = await req.json()

  // DPDP Act, 2023: processing is consent-based — refuse submissions without
  // the explicit consent flag set by the form's consent checkbox. Consent is
  // taken afresh each half-year; it is never carried forward.
  if (body.consent !== true) {
    return NextResponse.json({ error: 'Consent is required to submit this form (Digital Personal Data Protection Act, 2023).' }, { status: 400 })
  }

  const {
    is_not_msme,
    declarant_name,
    udyam_number,
    msme_category,
    nature_of_business,
    outstanding_amount,
    // cert_url and proof_url come from /api/msme/upload — validate they are internal storage URLs
    cert_url:  rawCertUrl,
    proof_url: rawProofUrl,
  } = body

  // Only accept URLs generated by the upload endpoint (r2: paths or Supabase storage URLs)
  const isInternalUrl = (u: unknown) =>
    u == null ||
    (typeof u === 'string' && (u.startsWith('r2:msme/') || u.includes('/storage/v1/object/public/attachments/msme/')))
  if (!isInternalUrl(rawCertUrl) || !isInternalUrl(rawProofUrl)) {
    return NextResponse.json({ error: 'Invalid file URL' }, { status: 400 })
  }
  const cert_url  = rawCertUrl  as string | undefined
  const proof_url = rawProofUrl as string | undefined

  const now       = new Date().toISOString()
  const periodEnd = tokenPeriod(tokenRow)

  // The patch is identical whichever table it lands in, so the two write
  // paths below cannot drift in what they store.
  let patch: Record<string, unknown>

  if (is_not_msme) {
    // Non-MSME declaration path
    if (!declarant_name?.trim()) {
      return NextResponse.json({ error: 'Please enter your name for the declaration' }, { status: 400 })
    }
    patch = {
      status: 'not_msme',
      is_not_msme: true,
      declarant_name: declarant_name.trim(),
      declared_at: now,
      submitted_at: now,
      consent_at: now,
      // Clear the MSME-only details that carry-forward pre-filled.
      //
      // A vendor who declared as an MSME last half-year arrives with their
      // Udyam number, category and certificate already copied in. If they now
      // declare they are NOT an MSME, leaving those behind would store — and
      // export — a non-MSME declaration carrying a Udyam registration, which
      // is a contradiction an auditor would rightly question.
      //
      // Nothing is lost: the previous period's declaration still holds them.
      udyam_number:        null,
      pan:                 null,
      udyam_registered_on: null,
      msme_category:       null,
      nature_of_business:  null,
      outstanding_amount:  null,
      cert_url:            null,
      proof_url:           null,
    }
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
    patch = {
      status: 'submitted',
      is_not_msme: false,
      udyam_number: udyamClean,
      msme_category,
      nature_of_business,
      outstanding_amount: outstanding_amount !== '' && outstanding_amount !== null && outstanding_amount !== undefined
        ? Number(outstanding_amount) : null,
      cert_url:  cert_url  ?? null,
      proof_url: proof_url ?? null,
      submitted_at: now,
      consent_at: now,
    }
  }

  // Write the period's declaration, then re-sync the vendor row from it.
  const declaration = await ensureDeclaration(admin, {
    orgId: tokenRow.org_id, vendorId: tokenRow.vendor_id, periodEnd,
  })

  if (declaration) {
    const { error: declErr } = await admin
      .from('msme_declarations')
      .update(patch)
      .eq('id', declaration.id)
    if (declErr) {
      console.error('[msme/submit] declaration update failed:', declErr.message)
      return NextResponse.json({ error: 'Failed to save your submission. Please try again.' }, { status: 500 })
    }
    // Best-effort: the declaration is already saved, and failing a vendor's
    // submission because a derived copy did not update would be worse than a
    // stale copy, which running syncVendorMirror again repairs.
    await syncVendorMirror(admin, tokenRow.vendor_id)
  } else {
    // No declaration could be created — the usual cause is this code being
    // live before add_msme_declarations.sql has been applied. Degrade to the
    // pre-period behaviour rather than refusing the vendor's submission.
    console.warn('[msme/submit] no declaration row; falling back to vendor-row write (run add_msme_declarations migration)')
    const { error: legacyErr } = await admin
      .from('msme_vendors')
      .update(patch)
      .eq('id', tokenRow.vendor_id)
      .eq('org_id', tokenRow.org_id)
    if (legacyErr) {
      console.error('[msme/submit] vendor update failed:', legacyErr.message)
      return NextResponse.json({ error: 'Failed to save your submission. Please try again.' }, { status: 500 })
    }
  }

  // Mark token as used (don't delete — keeps audit trail)
  await admin.from('msme_tokens').update({ used_at: now }).eq('id', tokenRow.id)

  return NextResponse.json({ ok: true, period_end: periodEnd })
}
