// Internal endpoint: Inngest calls this to get a fresh magic-link token for a vendor.
// Protected by a shared secret — not exposed to end users.
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient }         from '@/lib/supabase/admin'
import { currentPeriod, isValidPeriodEnd } from '@/lib/msme/periods'
import { msmeToday }            from '@/lib/msme/today'
import { getDeclaration }            from '@/lib/msme/declarations'
import crypto                        from 'crypto'

export async function POST(req: NextRequest) {
  const secret         = req.headers.get('x-msme-internal-secret') ?? ''
  const expectedSecret = process.env.MSME_INTERNAL_SECRET ?? ''
  // Require a non-empty secret and compare with constant-time equality to prevent timing attacks
  if (
    !expectedSecret ||
    !secret ||
    secret.length !== expectedSecret.length ||
    !crypto.timingSafeEqual(Buffer.from(secret), Buffer.from(expectedSecret))
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { vendor_id, period_end: rawPeriod } = await req.json()
  if (!vendor_id) return NextResponse.json({ error: 'vendor_id required' }, { status: 400 })

  // A magic link belongs to ONE half-year. The caller names it; an older
  // caller that does not falls back to the period currently being collected.
  const periodEnd = isValidPeriodEnd(rawPeriod)
    ? rawPeriod
    : currentPeriod(msmeToday()).periodEnd

  const admin = createAdminClient()
  const { data: vendor } = await admin
    .from('msme_vendors')
    .select('org_id')
    .eq('id', vendor_id)
    .maybeSingle()

  if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })

  // Only mint tokens while THIS period's declaration is still outstanding.
  // Checking the vendor row instead would refuse to chase a vendor for March
  // because they answered for September.
  const declaration = await getDeclaration(admin, vendor_id, periodEnd)
  if (!declaration) {
    return NextResponse.json({ error: 'No declaration is open for this period' }, { status: 422 })
  }
  if (declaration.status === 'submitted' || declaration.status === 'not_msme') {
    return NextResponse.json({ error: 'Vendor has already submitted their details for this period' }, { status: 422 })
  }

  const rawToken  = crypto.randomBytes(32).toString('hex')
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
  const expiresAt = new Date(Date.now() + 30 * 86400_000).toISOString()

  await admin.from('msme_tokens').insert({
    vendor_id,
    org_id: vendor.org_id,
    token_hash: tokenHash,
    expires_at: expiresAt,
    period_end: periodEnd,
  })

  return NextResponse.json({ token: rawToken, period_end: periodEnd })
}
