export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('projects')
    .select('*, clients(id, name), tasks(count)')
    .eq('id', id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  // Whitelist updatable fields
  const allowed = [
    'name', 'description', 'status', 'due_date', 'client_id',
    'priority', 'custom_fields', 'owner_id',
  ]
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  // For custom_fields: merge with existing rather than replace
  if ('custom_fields' in updates) {
    const { data: existing } = await supabase
      .from('projects')
      .select('custom_fields')
      .eq('id', id)
      .maybeSingle()

    if (existing?.custom_fields && typeof existing.custom_fields === 'object') {
      updates.custom_fields = {
        ...(existing.custom_fields as object),
        ...(updates.custom_fields as object),
      }
    }
  }

  const { data, error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', id)
    .select()
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify ownership or admin
  const { data: project } = await supabase
    .from('projects')
    .select('owner_id, org_id')
    .eq('id', id)
    .maybeSingle()

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: member } = await supabase
    .from('org_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('org_id', project.org_id)
    .maybeSingle()

  const canDelete = project.owner_id === user.id || member?.role === 'admin'
  if (!canDelete) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await supabase.from('projects').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
