import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse }  from 'next/server'
import type { NextRequest } from 'next/server'
import { getApiOrgMembership } from '@/lib/supabase/apiActiveOrg'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, req, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })
  if (!['owner', 'admin', 'manager'].includes(mb.role))
    return NextResponse.json({ error: 'Only managers and above can edit groups' }, { status: 403 })

  const admin = createAdminClient()
  const body = await req.json()
  const ALLOWED = ['name', 'color', 'notes']
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const k of ALLOWED) { if (k in body) updates[k] = body[k] }

  const { data, error } = await admin
    .from('client_groups')
    .update(updates)
    .eq('id', id).eq('org_id', mb.org_id)
    .select('id, name, color, notes, created_at, updated_at')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, _req, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })
  if (!['owner', 'admin', 'manager'].includes(mb.role))
    return NextResponse.json({ error: 'Only managers and above can delete groups' }, { status: 403 })

  const admin = createAdminClient()
  // Ungroup all clients first (ON DELETE SET NULL handles this in DB, but be explicit)
  await admin.from('clients').update({ group_id: null }).eq('group_id', id).eq('org_id', mb.org_id)

  const { error } = await admin
    .from('client_groups').delete().eq('id', id).eq('org_id', mb.org_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
