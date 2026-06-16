import { NextRequest, NextResponse } from 'next/server'
import { createClient }             from '@/lib/supabase/server'
import { createAdminClient }        from '@/lib/supabase/admin'
import { getApiOrgMembership }      from '@/lib/supabase/apiActiveOrg'
import { FREE_VENDOR_LIMIT }        from '@/lib/msme/packs'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, req, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'Not a member' }, { status: 403 })

  const admin = createAdminClient()
  const { data: vendors, error } = await admin
    .from('msme_vendors')
    .select('id, vendor_name, vendor_email, gstin, pan, status, payment_status, udyam_number, udyam_registered_on, msme_category, nature_of_business, outstanding_amount, cert_url, is_not_msme, declarant_name, declared_at, submitted_at, email_count, last_emailed_at, is_paid, created_at')
    .eq('org_id', mb.org_id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: packRow } = await admin
    .from('org_feature_settings')
    .select('config')
    .eq('org_id', mb.org_id)
    .eq('feature_key', 'msme_pack')
    .maybeSingle()
  const vendorLimit: number = (packRow?.config?.vendor_limit as number | undefined) ?? FREE_VENDOR_LIMIT

  const total = vendors?.length ?? 0
  return NextResponse.json({ vendors: vendors ?? [], total, vendorLimit })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, req, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'Not a member' }, { status: 403 })

  if (!['owner', 'admin', 'manager'].includes(mb.role)) {
    return NextResponse.json({ error: 'Only managers and above can add vendors' }, { status: 403 })
  }

  const body = await req.json()
  const { vendor_name, vendor_email, gstin } = body

  if (!vendor_name?.trim() || !vendor_email?.trim()) {
    return NextResponse.json({ error: 'vendor_name and vendor_email are required' }, { status: 400 })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(vendor_email)) {
    return NextResponse.json({ error: 'Invalid vendor email address' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Fetch pack-based vendor limit
  const { data: packRow } = await admin
    .from('org_feature_settings')
    .select('config')
    .eq('org_id', mb.org_id)
    .eq('feature_key', 'msme_pack')
    .maybeSingle()
  const vendorLimit: number = (packRow?.config?.vendor_limit as number | undefined) ?? FREE_VENDOR_LIMIT

  // Check current vendor count against pack limit
  const { count } = await admin
    .from('msme_vendors')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', mb.org_id)

  const currentCount = count ?? 0

  if (currentCount >= vendorLimit) {
    return NextResponse.json({
      error: 'Vendor limit reached. Upgrade your pack to add more vendors.',
      code: 'LIMIT_REACHED',
    }, { status: 402 })
  }

  const { data: vendor, error } = await admin
    .from('msme_vendors')
    .insert({
      org_id: mb.org_id,
      vendor_name: vendor_name.trim(),
      vendor_email: vendor_email.trim().toLowerCase(),
      gstin: gstin?.trim() || null,
      is_paid: true,
      payment_status: 'free',
      created_by: user.id,
    })
    .select()
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ vendor }, { status: 201 })
}
