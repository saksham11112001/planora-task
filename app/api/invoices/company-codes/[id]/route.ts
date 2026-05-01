import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse }      from 'next/server'
import type { NextRequest }  from 'next/server'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: mb } = await supabase.from('org_members')
    .select('org_id, role').eq('user_id', user.id).eq('is_active', true).single()
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })
  if (!['owner', 'admin'].includes(mb.role))
    return NextResponse.json({ error: 'Only owners/admins can manage company codes' }, { status: 403 })

  const body = await req.json()
  const { label, group_name, gstin, pan, cin, address, is_default } = body

  const admin = createAdminClient()

  if (is_default) {
    await admin.from('invoice_company_codes').update({ is_default: false }).eq('org_id', mb.org_id)
  }

  const updates: Record<string, any> = { updated_at: new Date().toISOString() }
  if (label     !== undefined) updates.label      = label?.trim() || null
  if (group_name !== undefined) updates.group_name = group_name?.trim() || null
  if (gstin     !== undefined) updates.gstin      = gstin?.trim().toUpperCase() || null
  if (pan       !== undefined) updates.pan        = pan?.trim().toUpperCase() || null
  if (cin       !== undefined) updates.cin        = cin?.trim().toUpperCase() || null
  if (address   !== undefined) updates.address    = address?.trim() || null
  if (is_default !== undefined) updates.is_default = !!is_default

  const { data, error } = await admin.from('invoice_company_codes')
    .update(updates).eq('id', id).eq('org_id', mb.org_id).select('*').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: mb } = await supabase.from('org_members')
    .select('org_id, role').eq('user_id', user.id).eq('is_active', true).single()
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })
  if (!['owner', 'admin'].includes(mb.role))
    return NextResponse.json({ error: 'Only owners/admins can manage company codes' }, { status: 403 })

  const admin = createAdminClient()
  const { error } = await admin.from('invoice_company_codes')
    .delete().eq('id', id).eq('org_id', mb.org_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
