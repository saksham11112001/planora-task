import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse }  from 'next/server'
import type { NextRequest } from 'next/server'
import { dbError } from '@/lib/api-error'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: mb } = await supabase.from('org_members')
    .select('org_id, role').eq('user_id', user.id).eq('is_active', true).single()
  if (!mb) return NextResponse.json({ data: [] })

  const sp = req.nextUrl.searchParams
  const admin = createAdminClient()
  let q = admin.from('invoices')
    .select('*, client:clients(id, name, color)')
    .eq('org_id', mb.org_id)
    .order('created_at', { ascending: false })

  if (sp.get('client_id')) q = q.eq('client_id', sp.get('client_id')!)
  if (sp.get('status'))    q = q.eq('status', sp.get('status')!)

  const limit = Math.min(parseInt(sp.get('limit') ?? '100', 10), 500)
  q = q.limit(limit)

  const { data, error } = await q
  if (error) return NextResponse.json(dbError(error, 'invoices'), { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const { data: mb } = await supabase.from('org_members')
      .select('org_id, role').eq('user_id', user.id).eq('is_active', true).single()
    if (!mb) return NextResponse.json({ error: 'No active organisation' }, { status: 403 })

    if (!['owner', 'admin', 'manager'].includes(mb.role))
      return NextResponse.json({ error: 'Only managers can create invoices' }, { status: 403 })

    const body = await req.json()
    const { client_id, group_id, title, issue_date, due_date, notes, gstin, gst_rate = 0, discount_amount = 0, items = [] } = body

    if (!title?.trim()) return NextResponse.json({ error: 'Title required' }, { status: 400 })

    // Use admin client to bypass RLS — role check already done above
    const admin = createAdminClient()

    // Auto-generate invoice number: INV-{year}-{4-digit sequence}
    const { count } = await admin.from('invoices')
      .select('id', { count: 'exact', head: true }).eq('org_id', mb.org_id)
    const seq = String((count ?? 0) + 1).padStart(4, '0')
    const invoice_number = `INV-${new Date().getFullYear()}-${seq}`

    // Calculate totals from items
    const subtotal = (items as any[]).reduce((sum: number, it: any) => {
      const qty   = Number(it.quantity  ?? it.qty   ?? 1)
      const price = Number(it.unit_price ?? it.price ?? 0)
      return sum + qty * price
    }, 0)
    const gst_amount = Math.round(subtotal * Number(gst_rate) / 100 * 100) / 100
    const total      = Math.round((subtotal + gst_amount - Number(discount_amount)) * 100) / 100

    const { data: invoice, error } = await admin.from('invoices').insert({
      org_id:          mb.org_id,
      client_id:       client_id || null,
      group_id:        group_id  || null,
      invoice_number,
      title:           title.trim(),
      issue_date:      issue_date || new Date().toISOString().slice(0, 10),
      due_date:        due_date || null,
      status:          'draft',
      notes:           notes || null,
      gstin:           gstin || null,
      gst_rate:        Number(gst_rate),
      discount_amount: Number(discount_amount),
      subtotal,
      gst_amount,
      total,
      created_by:      user.id,
    }).select('*').single()

    if (error) {
      console.error('[invoices/POST] insert error:', JSON.stringify({ message: error.message, details: error.details, hint: error.hint, code: error.code }))
      return NextResponse.json(dbError(error, 'invoices/POST'), { status: 500 })
    }

    // ── Activity log (non-blocking) ─────────────────────────────────────────
    try {
      const { data: actor } = await supabase.from('users').select('name').eq('id', user.id).maybeSingle()
      await admin.from('activity_log').insert({
        org_id:      mb.org_id,
        user_id:     user.id,
        user_name:   (actor as any)?.name ?? null,
        action:      'invoice.created',
        entity_type: 'invoice',
        entity_id:   invoice!.id,
        entity_name: invoice!.title,
        meta:        { invoice_number: invoice_number, total },
      })
    } catch {}

    // Insert line items if provided
    if ((items as any[]).length > 0 && invoice?.id) {
      const itemRows = (items as any[]).map((it: any) => {
        const qty   = Number(it.quantity  ?? it.qty   ?? 1)
        const price = Number(it.unit_price ?? it.price ?? 0)
        return {
          invoice_id:  invoice.id,
          org_id:      mb.org_id,
          task_id:     it.task_id || null,
          description: String(it.description ?? it.desc ?? '').trim() || 'Service',
          quantity:    qty,
          unit_price:  price,
          amount:      Math.round(qty * price * 100) / 100,
        }
      })
      const { error: itemsErr } = await admin.from('invoice_items').insert(itemRows)
      if (itemsErr) console.error('[invoices/POST] items insert error:', itemsErr.message)
    }

    return NextResponse.json({ data: invoice }, { status: 201 })
  } catch (err: any) {
    console.error('[invoices/POST] unexpected error:', err?.message ?? err)
    return NextResponse.json(dbError(err, 'invoices/POST'), { status: 500 })
  }
}
