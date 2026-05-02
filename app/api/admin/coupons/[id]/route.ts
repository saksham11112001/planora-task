import { NextResponse }      from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { NextRequest }  from 'next/server'
import { dbError } from '@/lib/api-error'

async function superAdminGuard(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const superEmail = process.env.SUPER_ADMIN_EMAIL
  if (!superEmail || user.email?.toLowerCase() !== superEmail.toLowerCase()) return null
  return user
}

// PATCH /api/admin/coupons/[id] — update coupon (toggle active, edit fields)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const mb = await superAdminGuard(supabase)
  if (!mb) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json() as Record<string, unknown>
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('coupons').update(body).eq('id', id).select().single()

  if (error) return NextResponse.json(dbError(error, 'admin/coupons/[id]'), { status: 500 })
  return NextResponse.json({ data })
}

// DELETE /api/admin/coupons/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const mb = await superAdminGuard(supabase)
  if (!mb) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { error } = await admin.from('coupons').delete().eq('id', id)
  if (error) return NextResponse.json(dbError(error, 'admin/coupons/[id]'), { status: 500 })
  return NextResponse.json({ success: true })
}
