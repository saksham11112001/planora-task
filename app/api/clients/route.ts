import { createClient } from '@/lib/supabase/server'
import { NextResponse }  from 'next/server'
import type { NextRequest } from 'next/server'
import { assertCan }     from '@/lib/utils/permissionGate'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { data: mb } = await supabase.from('org_members').select('org_id').eq('user_id', user.id).eq('is_active', true).single()
  if (!mb) return NextResponse.json({ data: [] })
  const sp     = request.nextUrl.searchParams
  const limit  = Math.min(parseInt(sp.get('limit')  ?? '500'), 500)
  const offset = Math.max(parseInt(sp.get('offset') ?? '0'),   0)
  const { data, error } = await supabase.from('clients')
    .select('id, name, color, status, email, company').eq('org_id', mb.org_id)
    .order('name').range(offset, offset + limit - 1)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { data: mb } = await supabase.from('org_members').select('org_id, role').eq('user_id', user.id).eq('is_active', true).single()
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })
  const clientCreateDenied = await assertCan(supabase, mb.org_id, mb.role, 'clients.create')
  if (clientCreateDenied) return NextResponse.json({ error: clientCreateDenied.error }, { status: clientCreateDenied.status })
  const body = await request.json()
  if (!body.name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })
  const cf = (body.custom_fields && typeof body.custom_fields === 'object') ? body.custom_fields : null
  const { data, error } = await supabase.from('clients').insert({
    org_id:        mb.org_id,
    name:          body.name.trim(),
    email:         body.email    || null,
    phone:         body.phone    || null,
    company:       body.company  || null,
    website:       body.website  || null,
    industry:      body.industry || null,
    notes:         body.notes    || null,
    status:        body.status   || 'active',
    color:         body.color    || '#0d9488',
    custom_fields: cf,
    created_by:    user.id,
  }).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
