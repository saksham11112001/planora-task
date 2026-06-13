// Internal endpoint: Inngest calls this to get a fresh magic-link token for a vendor.
// Protected by a shared secret — not exposed to end users.
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient }         from '@/lib/supabase/admin'
import crypto                        from 'crypto'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-inngest-secret')
  if (!secret || secret !== process.env.INNGEST_SIGNING_KEY) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { vendor_id } = await req.json()
  if (!vendor_id) return NextResponse.json({ error: 'vendor_id required' }, { status: 400 })

  const admin = createAdminClient()
  const { data: vendor } = await admin
    .from('msme_vendors')
    .select('org_id')
    .eq('id', vendor_id)
    .maybeSingle()

  if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })

  const rawToken  = crypto.randomBytes(32).toString('hex')
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
  const expiresAt = new Date(Date.now() + 30 * 86400_000).toISOString()

  await admin.from('msme_tokens').insert({
    vendor_id,
    org_id: vendor.org_id,
    token_hash: tokenHash,
    expires_at: expiresAt,
  })

  return NextResponse.json({ token: rawToken })
}
