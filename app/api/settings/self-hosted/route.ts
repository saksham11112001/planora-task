import { createClient }   from '@/lib/supabase/server'
import { NextResponse }    from 'next/server'
import type { NextRequest } from 'next/server'
import { dbError }         from '@/lib/api-error'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: mb } = await supabase
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()
  if (!mb || !['owner', 'admin'].includes(mb.role))
    return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const { contact_name, contact_email, company_size, infrastructure, notes } = await req.json()
  if (!contact_name?.trim() || !contact_email?.trim())
    return NextResponse.json({ error: 'Name and email are required' }, { status: 400 })

  try {
    const { error: inquiryErr } = await supabase
      .from('self_hosted_inquiries')
      .insert({
        org_id:         mb.org_id,
        contact_name:   contact_name.trim(),
        contact_email:  contact_email.trim(),
        company_size:   company_size?.trim() || null,
        infrastructure: infrastructure?.trim() || null,
        notes:          notes?.trim() || null,
      })
    if (inquiryErr) throw inquiryErr

    // Mark that this org has expressed interest (best-effort; non-fatal)
    await supabase
      .from('organisations')
      .update({ self_hosted_interest: true })
      .eq('id', mb.org_id)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json(dbError(err, 'settings/self-hosted'), { status: 500 })
  }
}
