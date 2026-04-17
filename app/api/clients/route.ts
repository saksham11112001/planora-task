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
  const sp = request.nextUrl.searchParams
  const parsedLimit  = parseInt(sp.get('limit')  ?? '500', 10)
  const parsedOffset = parseInt(sp.get('offset') ?? '0',   10)
  const limit  = Math.min(isNaN(parsedLimit)  ? 500 : parsedLimit,  500)
  const offset = Math.max(isNaN(parsedOffset) ? 0   : parsedOffset, 0)
  const { data, error } = await supabase.from('clients')
    .select('id, name, color, status, email, company').eq('org_id', mb.org_id)
    .order('name').range(offset, offset + limit - 1)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, {
    headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' },
  })
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
  if (body.name.trim().length > 200) return NextResponse.json({ error: 'Name too long (max 200 chars)' }, { status: 400 })
  // Validate email format if provided
  if (body.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(body.email)) return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
  }
  // Validate website URL format if provided
  if (body.website) {
    try {
      const parsed = new URL(body.website)
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('bad protocol')
    } catch {
      return NextResponse.json({ error: 'Invalid website URL (must start with http:// or https://)' }, { status: 400 })
    }
  }
  const cf = (body.custom_fields && typeof body.custom_fields === 'object') ? body.custom_fields : null
  const { data, error } = await supabase.from('clients').insert({
    org_id:        mb.org_id,
    name:          body.name.trim().slice(0, 200),
    email:         body.email?.slice(0, 255)   || null,
    phone:         body.phone?.slice(0, 50)    || null,
    company:       body.company?.slice(0, 200) || null,
    website:       body.website?.slice(0, 500) || null,
    industry:      body.industry               || null,
    notes:         body.notes                  || null,
    status:        body.status                 || 'active',
    color:         body.color                  || '#0d9488',
    custom_fields: cf,
    created_by:    user.id,
  }).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
