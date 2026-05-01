import { createClient } from '@/lib/supabase/server'
import { NextResponse }  from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: mb } = await supabase
    .from('org_members').select('org_id').eq('user_id', user.id).eq('is_active', true).single()
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

  const { data: mb } = await supabase
    .from('org_members').select('org_id, role').eq('user_id', user.id).eq('is_active', true).single()
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
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
