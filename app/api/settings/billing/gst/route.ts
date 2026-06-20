// GET  /api/settings/billing/gst — fetch saved GST billing details for this org
// POST /api/settings/billing/gst — save GST billing details
//
// Stored in org_feature_settings with feature_key = 'billing_gst'
// config = { gstin?, legal_name, address_line1?, city?, state_name?, pincode? }

import { createClient }          from '@/lib/supabase/server'
import { createAdminClient }     from '@/lib/supabase/admin'
import { NextResponse }          from 'next/server'
import type { NextRequest }      from 'next/server'
import { getApiOrgMembership }   from '@/lib/supabase/apiActiveOrg'

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, req, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'Not a member' }, { status: 403 })

  const admin = createAdminClient()
  const { data } = await admin
    .from('org_feature_settings')
    .select('config')
    .eq('org_id', mb.org_id)
    .eq('feature_key', 'billing_gst')
    .maybeSingle()

  return NextResponse.json({ gst: data?.config ?? null })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, req, 'org_id, role')
  if (!mb || !['owner', 'admin'].includes(mb.role))
    return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const { gstin, legal_name, address_line1, city, state_name, pincode } = await req.json()

  if (!legal_name?.trim())
    return NextResponse.json({ error: 'Legal / company name is required' }, { status: 400 })

  const gstinClean = gstin?.trim().toUpperCase() || null
  if (gstinClean && !GSTIN_REGEX.test(gstinClean))
    return NextResponse.json({ error: 'Invalid GSTIN format' }, { status: 400 })

  const config = {
    gstin:        gstinClean,
    legal_name:   legal_name.trim(),
    address_line1: address_line1?.trim() || null,
    city:         city?.trim() || null,
    state_name:   state_name?.trim() || null,
    pincode:      pincode?.trim() || null,
  }

  const admin = createAdminClient()
  await admin.from('org_feature_settings').upsert(
    { org_id: mb.org_id, feature_key: 'billing_gst', is_enabled: true, config },
    { onConflict: 'org_id,feature_key' }
  )

  return NextResponse.json({ ok: true, gst: config })
}
