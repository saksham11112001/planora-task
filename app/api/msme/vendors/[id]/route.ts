import { NextRequest, NextResponse } from 'next/server'
import { createClient }             from '@/lib/supabase/server'
import { createAdminClient }        from '@/lib/supabase/admin'
import { getApiOrgMembership }      from '@/lib/supabase/apiActiveOrg'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, req, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'Not a member' }, { status: 403 })
  if (!['owner', 'admin', 'manager'].includes(mb.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const admin = createAdminClient()

  // Guard: only allow email edit if no emails have been sent yet
  const { data: vendor } = await admin
    .from('msme_vendors')
    .select('email_count')
    .eq('id', id)
    .eq('org_id', mb.org_id)
    .maybeSingle()

  if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })

  const body = await req.json()

  if (body.vendor_email !== undefined) {
    if (vendor.email_count > 0) {
      return NextResponse.json({ error: 'Email cannot be changed after the first email has been sent' }, { status: 422 })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.vendor_email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }
  }

  const allowed: Record<string, unknown> = {}
  if (body.vendor_email) allowed.vendor_email = body.vendor_email.trim().toLowerCase()
  if (body.vendor_name)  allowed.vendor_name  = body.vendor_name.trim()
  if (body.gstin !== undefined) allowed.gstin = body.gstin?.trim() || null
  if (body.pan !== undefined) allowed.pan = body.pan?.trim().toUpperCase() || null
  if (body.udyam_registered_on !== undefined) allowed.udyam_registered_on = body.udyam_registered_on || null

  if (Object.keys(allowed).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { error } = await admin
    .from('msme_vendors')
    .update(allowed)
    .eq('id', id)
    .eq('org_id', mb.org_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, req, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'Not a member' }, { status: 403 })
  if (!['owner', 'admin'].includes(mb.role)) {
    return NextResponse.json({ error: 'Only owner/admin can remove vendors' }, { status: 403 })
  }

  const admin = createAdminClient()
  // Soft-delete: slot remains permanently consumed to prevent gaming the free tier
  const { error } = await admin
    .from('msme_vendors')
    .update({ is_deleted: true })
    .eq('id', id)
    .eq('org_id', mb.org_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
