import { createClient } from '@/lib/supabase/server'
import { NextResponse }  from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: mb } = await supabase.from('org_members')
    .select('org_id').eq('user_id', user.id).eq('is_active', true).single()
  if (!mb) return NextResponse.json({ data: [] })

  const sp = req.nextUrl.searchParams
  const client_id = sp.get('client_id')

  let q = supabase.from('tasks')
    .select('id, title, billable_amount, due_date, client_id, client:clients(id, name, color)')
    .eq('org_id', mb.org_id)
    .eq('is_billable', true)
    .eq('status', 'completed')
    .neq('is_archived', true)
    .order('due_date', { ascending: false })
    .limit(200)

  if (client_id) q = q.eq('client_id', client_id)

  const { data, error } = await q
  if (error) return NextResponse.json({ data: [] })
  return NextResponse.json({ data })
}
