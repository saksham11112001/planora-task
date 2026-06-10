import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse }  from 'next/server'
import type { NextRequest } from 'next/server'
import { dbError } from '@/lib/api-error'
import { getApiOrgMembership } from '@/lib/supabase/apiActiveOrg'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, _req, 'org_id')
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin.from('invoice_items')
    .select('*, task:tasks(id, title)')
    .eq('invoice_id', id).eq('org_id', mb.org_id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json(dbError(error, 'invoice_items'), { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, req, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })

  if (!['owner', 'admin', 'manager'].includes(mb.role))
    return NextResponse.json({ error: 'Only managers can add invoice items' }, { status: 403 })

  const admin = createAdminClient()

  // Verify invoice belongs to org
  const { data: invoice } = await admin.from('invoices')
    .select('id, gst_rate, discount_amount').eq('id', id).eq('org_id', mb.org_id).single()
  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  const body = await req.json()
  const qty   = Number(body.quantity  ?? 1)
  const price = Number(body.unit_price ?? 0)
  if (isNaN(qty)   || qty   <= 0)   return NextResponse.json({ error: 'Quantity must be a positive number' }, { status: 400 })
  if (isNaN(price) || price <  0)   return NextResponse.json({ error: 'Unit price must be a non-negative number' }, { status: 400 })
  if (qty   > 1_000_000)            return NextResponse.json({ error: 'Quantity is unreasonably large' }, { status: 400 })
  if (price > 100_000_000)          return NextResponse.json({ error: 'Unit price is unreasonably large' }, { status: 400 })
  const amount = Math.round(qty * price * 100) / 100

  const { data: item, error } = await admin.from('invoice_items').insert({
    invoice_id:  id,
    org_id:      mb.org_id,
    task_id:     body.task_id || null,
    description: String(body.description ?? '').trim() || 'Service',
    quantity:    qty,
    unit_price:  price,
    amount,
  }).select('*').single()

  if (error) return NextResponse.json(dbError(error, 'invoice_items'), { status: 500 })

  // Recalculate invoice totals
  const { data: allItems } = await admin.from('invoice_items')
    .select('amount').eq('invoice_id', id)
  const subtotal    = (allItems ?? []).reduce((s: number, it: any) => s + Number(it.amount), 0)
  const gst_amount  = Math.round(subtotal * Number(invoice.gst_rate) / 100 * 100) / 100
  const total       = Math.round((subtotal + gst_amount - Number(invoice.discount_amount)) * 100) / 100
  await admin.from('invoices').update({ subtotal, gst_amount, total }).eq('id', id)

  return NextResponse.json({ data: item }, { status: 201 })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, req, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })

  const body = await req.json()
  const { item_id } = body
  if (!item_id) return NextResponse.json({ error: 'item_id required' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('invoice_items')
    .delete().eq('id', item_id).eq('invoice_id', id).eq('org_id', mb.org_id)
  if (error) return NextResponse.json(dbError(error, 'invoice_items delete'), { status: 500 })

  // Recalculate invoice totals after deletion
  const { data: invoice } = await admin.from('invoices')
    .select('gst_rate, discount_amount').eq('id', id).eq('org_id', mb.org_id).single()
  if (invoice) {
    const { data: allItems } = await admin.from('invoice_items').select('amount').eq('invoice_id', id)
    const subtotal   = (allItems ?? []).reduce((s: number, it: any) => s + Number(it.amount), 0)
    const gst_amount = Math.round(subtotal * Number(invoice.gst_rate) / 100 * 100) / 100
    const total      = Math.round((subtotal + gst_amount - Number(invoice.discount_amount)) * 100) / 100
    await admin.from('invoices').update({ subtotal, gst_amount, total }).eq('id', id)
  }

  return NextResponse.json({ success: true })
}
