import { createClient } from '@/lib/supabase/server'
import { NextResponse }  from 'next/server'
import type { NextRequest } from 'next/server'
import { getApiOrgMembership } from '@/lib/supabase/apiActiveOrg'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, request, 'org_id')
  if (!mb) return NextResponse.json({ data: [] })

  const { data, error } = await supabase
    .from('client_groups')
    .select('id, name, color, notes, created_at, updated_at')
    .eq('org_id', mb.org_id)
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, req, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'No active organisation' }, { status: 403 })
  if (!['owner', 'admin', 'manager'].includes(mb.role))
    return NextResponse.json({ error: 'Only managers and above can create groups' }, { status: 403 })

  const body = await req.json()
  const { name, color, notes } = body
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const { data, error } = await supabase
    .from('client_groups')
    .insert({
      org_id:     mb.org_id,
      name:       name.trim(),
      color:      color ?? '#0d9488',
      notes:      notes || null,
      created_by: user.id,
    })
    .select('id, name, color, notes, created_at, updated_at')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
