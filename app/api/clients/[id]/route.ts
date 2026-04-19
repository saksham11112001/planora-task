import { createClient } from '@/lib/supabase/server'
import { NextResponse }  from 'next/server'
import type { NextRequest } from 'next/server'
import { assertCan }     from '@/lib/utils/permissionGate'
import { dbError } from '@/lib/api-error'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { data: mb } = await supabase.from('org_members').select('org_id, role').eq('user_id', user.id).eq('is_active', true).single()
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })
  const clientEditDenied = await assertCan(supabase, mb.org_id, mb.role, 'clients.edit')
  if (clientEditDenied) return NextResponse.json({ error: clientEditDenied.error }, { status: clientEditDenied.status })

  const body = await req.json()
  const ALLOWED = ['name','email','phone','company','website','industry','notes','status','color']
  const updates: Record<string, unknown> = {}
  for (const k of ALLOWED) { if (k in body) updates[k] = body[k] }

  // Merge custom_fields — do not overwrite unrelated keys
  if ('custom_fields' in body && body.custom_fields && typeof body.custom_fields === 'object') {
    const { data: existing } = await supabase
      .from('clients').select('custom_fields').eq('id', id).eq('org_id', mb.org_id).maybeSingle()
    updates.custom_fields = { ...(existing?.custom_fields ?? {}), ...(body.custom_fields as object) }
  }

  const { data, error } = await supabase.from('clients').update(updates).eq('id', id).eq('org_id', mb.org_id).select('*').single()
  if (error) return NextResponse.json(dbError(error, 'clients/[id]'), { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { data: mb } = await supabase.from('org_members').select('org_id, role').eq('user_id', user.id).eq('is_active', true).single()
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })
  const clientDeleteDenied = await assertCan(supabase, mb.org_id, mb.role, 'clients.delete')
  if (clientDeleteDenied) return NextResponse.json({ error: clientDeleteDenied.error }, { status: clientDeleteDenied.status })

  const { error } = await supabase.from('clients').delete().eq('id', id).eq('org_id', mb.org_id)
  if (error) return NextResponse.json(dbError(error, 'clients/[id]'), { status: 500 })
  return NextResponse.json({ success: true })
}
