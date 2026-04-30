import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, getOrgMembership } from '@/lib/supabase/cached'

export const dynamic = 'force-dynamic'

// ── GET /api/invoices ─────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const mb = await getOrgMembership(user.id)
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })

  const supabase = await createClient()
  const sp       = req.nextUrl.searchParams
  const status   = sp.get('status')
  const clientId = sp.get('client_id')

  let q = supabase
    .from('invoices')
    .select('*, clients(id,name,color)')
    .eq('org_id', mb.org_id)
    .order('created_at', { ascending: false })

  if (status)   q = q.eq('status', status)
  if (clientId) q = q.eq('client_id', clientId)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// ── POST /api/invoices ────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const mb = await getOrgMembership(user.id)
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })
  if (!['owner','admin','manager'].includes(mb.role))
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })

  const body = await req.json()
  const { client_id, issue_date, due_date, items, tax_rate, discount, notes, status } = body

  // Auto-generate invoice number
  const supabase = await createClient()
  const { count } = await supabase
    .from('invoices')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', mb.org_id)
  const num = (count ?? 0) + 1
  const invoice_number = `INV-${String(num).padStart(4, '0')}`

  // Compute totals
  const parsedItems: { description: string; quantity: number; rate: number; amount: number }[] =
    Array.isArray(items) ? items : []
  const subtotal    = parsedItems.reduce((s, i) => s + (Number(i.amount) || 0), 0)
  const taxRate     = Number(tax_rate) || 0
  const discountAmt = Number(discount) || 0
  const taxAmount   = Math.round((subtotal - discountAmt) * (taxRate / 100) * 100) / 100
  const total       = Math.round((subtotal - discountAmt + taxAmount) * 100) / 100

  const { data, error } = await supabase
    .from('invoices')
    .insert({
      org_id: mb.org_id,
      client_id: client_id || null,
      invoice_number,
      status: status || 'draft',
      issue_date: issue_date || new Date().toISOString().slice(0, 10),
      due_date:   due_date   || null,
      items:      parsedItems,
      subtotal,
      tax_rate:   taxRate,
      tax_amount: taxAmount,
      discount:   discountAmt,
      total,
      notes:      notes || null,
      created_by: user.id,
    })
    .select('*, clients(id,name,color)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
