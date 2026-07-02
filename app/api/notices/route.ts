import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/authUser'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: mb } = await admin.from('org_members').select('org_id, role').eq('user_id', user.id).eq('is_active', true).order('created_at').limit(1).maybeSingle()
  if (!mb) return NextResponse.json({ error: 'No membership' }, { status: 403 })

  const clientId = req.nextUrl.searchParams.get('client_id')
  let q = admin.from('client_notices').select('*').eq('org_id', mb.org_id).order('response_due', { ascending: true, nullsFirst: false })
  if (clientId) q = q.eq('client_id', clientId)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: mb } = await admin.from('org_members').select('org_id, role').eq('user_id', user.id).eq('is_active', true).order('created_at').limit(1).maybeSingle()
  if (!mb) return NextResponse.json({ error: 'No membership' }, { status: 403 })
  if (!['owner', 'admin', 'manager'].includes(mb.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { data, error } = await admin.from('client_notices').insert({ ...body, org_id: mb.org_id, created_by: user.id }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
