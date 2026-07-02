// Generates a short-lived signed URL for a vendor's uploaded Udyam certificate.
// Handles both R2-stored files (r2:key) and public Supabase Storage URLs.
import { NextRequest, NextResponse } from 'next/server'
import { createClient }             from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/authUser'
import { createAdminClient }        from '@/lib/supabase/admin'
import { getApiOrgMembership }      from '@/lib/supabase/apiActiveOrg'
import { r2SignedUrl, R2_CONFIGURED } from '@/lib/storage/r2'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, req, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'Not a member' }, { status: 403 })

  const admin = createAdminClient()
  const { data: vendor } = await admin
    .from('msme_vendors')
    .select('id, vendor_name, cert_url, org_id')
    .eq('id', id)
    .eq('org_id', mb.org_id)
    .maybeSingle()

  if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
  if (!vendor.cert_url) return NextResponse.json({ error: 'No certificate uploaded' }, { status: 404 })

  const certUrl = vendor.cert_url as string

  if (certUrl.startsWith('r2:')) {
    if (!R2_CONFIGURED) {
      return NextResponse.json({ error: 'Storage not configured' }, { status: 503 })
    }
    const key       = certUrl.slice(3)  // strip "r2:" prefix
    const signedUrl = await r2SignedUrl(key, 900)  // 15-min expiry, no Content-Disposition → inline viewing
    return NextResponse.json({ url: signedUrl })
  }

  // Public Supabase URL — return directly
  return NextResponse.json({ url: certUrl })
}
