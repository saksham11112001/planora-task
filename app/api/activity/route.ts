import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse }      from 'next/server'
import type { NextRequest }  from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: mb } = await supabase.from('org_members')
    .select('org_id, role').eq('user_id', user.id).eq('is_active', true).single()
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })

  if (!['owner', 'admin'].includes(mb.role))
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })

  const sp     = req.nextUrl.searchParams
  const limit  = Math.min(parseInt(sp.get('limit') ?? '100', 10), 500)
  const offset = Math.max(parseInt(sp.get('offset') ?? '0', 10), 0)

  const admin = createAdminClient()
  const { data, error } = await admin.from('activity_log')
    .select('*')
    .eq('org_id', mb.org_id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}
