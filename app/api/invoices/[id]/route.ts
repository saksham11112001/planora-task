import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, getOrgMembership } from '@/lib/supabase/cached'

export const dynamic = 'force-dynamic'

// ── GET /api/invoices/[id] ────────────────────────────────────────────────────
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const mb = await getOrgMembership(user.id)
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('invoices')
    .select('*, clients(id,name,color,email,phone)')
    .eq('id', id)
    .eq('org_id', mb.org_id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data })
}

// ── PATCH /api/invoices/[id] ──────────────────────────────────────────────────
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const mb = await getOrgMembership(user.id)
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })
  if (!['owner','admin','manager'].includes(mb.role))
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })

  const body    = await req.json()
  const updates: Record<string, unknown> = {}

  const allowed = ['client_id','status','issue_date','due_date','items','tax_rate','discount','notes']
  allowed.forEach(k => { if (k in body) updates[k] = body[k] })

  // Recompute totals if items/tax/discount changed
  if ('items' in body || 'tax_rate' in body || 'discount' in body) {
    const supabase2 = await createClient()
    const { data: existing } = await supabase2.from('invoices').select('items,tax_rate,discount').eq('id', id).single()
    const items    = Array.isArray(body.items)    ? body.items    : (existing?.items    ?? [])
    const taxRate  = 'tax_rate'  in body ? Number(body.tax_rate)  : Number(existing?.tax_rate  ?? 0)
    const discount = 'discount'  in body ? Number(body.discount)  : Number(existing?.discount  ?? 0)
    const subtotal = items.reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0)
    updates.subtotal   = subtotal
    updates.tax_rate   = taxRate
    updates.tax_amount = Math.round((subtotal - discount) * (taxRate / 100) * 100) / 100
    updates.discount   = discount
    updates.total      = Math.round((subtotal - discount + (updates.tax_amount as number)) * 100) / 100
  }

  // Set paid_at when marking as paid
  if (body.status === 'paid')       updates.paid_at = new Date().toISOString()
  if (body.status && body.status !== 'paid') updates.paid_at = null

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('invoices')
    .update(updates)
    .eq('id', id)
    .eq('org_id', mb.org_id)
    .select('*, clients(id,name,color)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// ── DELETE /api/invoices/[id] ─────────────────────────────────────────────────
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const mb = await getOrgMembership(user.id)
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })
  if (!['owner','admin','manager'].includes(mb.role))
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })

  const supabase = await createClient()
  const { error } = await supabase.from('invoices').delete().eq('id', id).eq('org_id', mb.org_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
