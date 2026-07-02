import { createClient }      from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/authUser'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse }      from 'next/server'
import type { NextRequest }  from 'next/server'
import { getApiOrgMembership } from '@/lib/supabase/apiActiveOrg'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const mb = await getApiOrgMembership(supabase, user.id, request, 'org_id')
  if (!mb) return NextResponse.json({ data: [] })
  const admin = createAdminClient()
  const { data } = await admin.from('invoice_company_codes')
    .select('*').eq('org_id', mb.org_id)
    .order('group_name', { nullsFirst: true }).order('label')
  return NextResponse.json({ data: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const mb = await getApiOrgMembership(supabase, user.id, req, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })
  if (!['owner', 'admin'].includes(mb.role))
    return NextResponse.json({ error: 'Only owners/admins can manage company codes' }, { status: 403 })
  const body = await req.json()
  const { label, group_name, gstin, pan, cin, address, is_default } = body
  if (!label?.trim()) return NextResponse.json({ error: 'Label is required' }, { status: 400 })
  const admin = createAdminClient()
  if (is_default) {
    await admin.from('invoice_company_codes').update({ is_default: false }).eq('org_id', mb.org_id)
  }
  const { data, error } = await admin.from('invoice_company_codes').insert({
    org_id:     mb.org_id,
    label:      label.trim(),
    group_name: group_name?.trim() || null,
    gstin:      gstin?.trim().toUpperCase() || null,
    pan:        pan?.trim().toUpperCase() || null,
    cin:        cin?.trim().toUpperCase() || null,
    address:    address?.trim() || null,
    is_default: !!is_default,
  }).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
