import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse }      from 'next/server'
import { isSuperAdminEmail } from '@/lib/utils/superAdmin'


export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user || !isSuperAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const { status } = await req.json()
  const VALID = ['open', 'in_progress', 'resolved', 'dismissed']
  if (!VALID.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('issue_reports')
    .update({ status })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
