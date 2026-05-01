import { createClient } from '@/lib/supabase/server'
import { NextResponse }  from 'next/server'
import type { NextRequest } from 'next/server'
import { dbError } from '@/lib/api-error'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: mb } = await supabase.from('org_members')
    .select('org_id').eq('user_id', user.id).eq('is_active', true).single()
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })

  const { data, error } = await supabase.from('invoices')
    .select('*, client:clients(id, name, color), items:invoice_items(*, task:tasks(id, title))')
    .eq('id', id).eq('org_id', mb.org_id).single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: mb } = await supabase.from('org_members')
    .select('org_id, role').eq('user_id', user.id).eq('is_active', true).single()
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })

  if (!['owner', 'admin', 'manager'].includes(mb.role))
    return NextResponse.json({ error: 'Only managers can edit invoices' }, { status: 403 })

  const body = await req.json()
  const ALLOWED = ['client_id','title','issue_date','due_date','status','notes','gstin','gst_rate','discount_amount','subtotal','gst_amount','total']
  const updates: Record<string, unknown> = {}
  for (const k of ALLOWED) { if (k in body) updates[k] = body[k] }

  if (!Object.keys(updates).length)
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

  const { data, error } = await supabase.from('invoices')
    .update(updates).eq('id', id).eq('org_id', mb.org_id).select('*').maybeSingle()
  if (error) return NextResponse.json(dbError(error, 'invoices/[id]'), { status: 500 })
  return NextResponse.json({ data: data ?? { id } })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: mb } = await supabase.from('org_members')
    .select('org_id, role').eq('user_id', user.id).eq('is_active', true).single()
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })

  if (!['owner', 'admin'].includes(mb.role))
    return NextResponse.json({ error: 'Only owners/admins can delete invoices' }, { status: 403 })

  const { error } = await supabase.from('invoices')
    .delete().eq('id', id).eq('org_id', mb.org_id)
  if (error) return NextResponse.json(dbError(error, 'invoices/[id] delete'), { status: 500 })
  return NextResponse.json({ success: true })
}
