import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/authUser'
import { createAdminClient } from '@/lib/supabase/admin'

// Helper: only owner/admin/manager can read credentials; viewer cannot
function canRead(role: string) { return ['owner', 'admin', 'manager'].includes(role) }
function canWrite(role: string) { return ['owner', 'admin', 'manager'].includes(role) }

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: mb } = await admin.from('org_members').select('org_id, role').eq('user_id', user.id).eq('is_active', true).order('created_at').limit(1).maybeSingle()
  if (!mb) return NextResponse.json({ error: 'No membership' }, { status: 403 })
  if (!canRead(mb.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const clientId = req.nextUrl.searchParams.get('client_id')
  if (!clientId) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

  const { data, error } = await admin.from('client_credentials').select('id, portal_name, username, password_enc, notes, last_updated, created_at').eq('org_id', mb.org_id).eq('client_id', clientId).order('portal_name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: mb } = await admin.from('org_members').select('org_id, role').eq('user_id', user.id).eq('is_active', true).order('created_at').limit(1).maybeSingle()
  if (!mb || !canWrite(mb.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  // Encode password before storing
  const password_enc = Buffer.from(body.password ?? '').toString('base64')
  const { data, error } = await admin.from('client_credentials').insert({ portal_name: body.portal_name, username: body.username, password_enc, notes: body.notes ?? null, client_id: body.client_id, org_id: mb.org_id, created_by: user.id }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
