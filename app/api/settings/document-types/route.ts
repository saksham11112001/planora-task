import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase/server'
import { createAdminClient }         from '@/lib/supabase/admin'
import { dbError } from '@/lib/api-error'

async function getOrgAndRole(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: mb } = await supabase
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()
  return mb
}

// GET /api/settings/document-types
export async function GET() {
  const supabase = await createClient()
  const mb = await getOrgAndRole(supabase)
  if (!mb) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('client_document_types')
    .select('id, name, category, linked_task_types, sort_order, is_active')
    .eq('org_id', mb.org_id)
    .order('sort_order', { ascending: true })

  return NextResponse.json({ document_types: data ?? [] })
}

// POST /api/settings/document-types
// Body: { name, category, linked_task_types?, sort_order? }
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const mb = await getOrgAndRole(supabase)
  if (!mb) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['owner', 'admin'].includes(mb.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, category, linked_task_types, sort_order } = await req.json()
  if (!name?.trim())   return NextResponse.json({ error: 'name is required' }, { status: 400 })
  if (!category)       return NextResponse.json({ error: 'category is required' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('client_document_types')
    .insert({
      org_id:            mb.org_id,
      name:              name.trim(),
      category,
      linked_task_types: linked_task_types ?? [],
      sort_order:        sort_order ?? 0,
    })
    .select('id, name, category, linked_task_types, sort_order, is_active')
    .single()

  if (error) return NextResponse.json(dbError(error, 'settings/document-types'), { status: 500 })
  return NextResponse.json({ document_type: data })
}

// PATCH /api/settings/document-types
// Body: { id, name?, category?, linked_task_types?, sort_order?, is_active? }
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const mb = await getOrgAndRole(supabase)
  if (!mb) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['owner', 'admin'].includes(mb.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id, ...fields } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const allowed = ['name', 'category', 'linked_task_types', 'sort_order', 'is_active']
  const update: Record<string, any> = {}
  for (const k of allowed) {
    if (fields[k] !== undefined) update[k] = fields[k]
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('client_document_types')
    .update(update)
    .eq('id', id)
    .eq('org_id', mb.org_id)
    .select('id, name, category, linked_task_types, sort_order, is_active')
    .single()

  if (error) return NextResponse.json(dbError(error, 'settings/document-types'), { status: 500 })
  return NextResponse.json({ document_type: data })
}

// DELETE /api/settings/document-types?id=xxx
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const mb = await getOrgAndRole(supabase)
  if (!mb) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['owner', 'admin'].includes(mb.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('client_document_types')
    .delete()
    .eq('id', id)
    .eq('org_id', mb.org_id)

  if (error) return NextResponse.json(dbError(error, 'settings/document-types'), { status: 500 })
  return NextResponse.json({ success: true })
}
