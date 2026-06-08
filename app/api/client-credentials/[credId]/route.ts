import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ credId: string }> }) {
  const { credId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: mb } = await admin.from('org_members').select('org_id, role').eq('user_id', user.id).eq('is_active', true).order('created_at').limit(1).maybeSingle()
  if (!mb || !['owner', 'admin', 'manager'].includes(mb.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const updates: Record<string, any> = { portal_name: body.portal_name, username: body.username, notes: body.notes, last_updated: new Date().toISOString() }
  if (body.password) updates.password_enc = Buffer.from(body.password).toString('base64')

  const { data, error } = await admin.from('client_credentials').update(updates).eq('id', credId).eq('org_id', mb.org_id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ credId: string }> }) {
  const { credId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: mb } = await admin.from('org_members').select('org_id, role').eq('user_id', user.id).eq('is_active', true).order('created_at').limit(1).maybeSingle()
  if (!mb || !['owner', 'admin', 'manager'].includes(mb.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await admin.from('client_credentials').delete().eq('id', credId).eq('org_id', mb.org_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
