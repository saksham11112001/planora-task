export const dynamic = 'force-dynamic'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse }       from 'next/server'
import type { NextRequest }   from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: [] })
  const { data: mb } = await supabase.from('org_members').select('org_id').eq('user_id', user.id).eq('is_active', true).maybeSingle()
  if (!mb) return NextResponse.json({ data: [] })
  const { data: s } = await supabase.from('org_settings').select('custom_task_fields').eq('org_id', mb.org_id).maybeSingle()
  return NextResponse.json({ data: s?.custom_task_fields ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { data: mb } = await supabase.from('org_members').select('org_id, role').eq('user_id', user.id).eq('is_active', true).maybeSingle()
  if (!mb || !['owner','admin'].includes(mb.role)) return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  const { custom_task_fields } = await request.json()
  const admin = createAdminClient()
  await admin.from('org_settings').upsert({ org_id: mb.org_id, custom_task_fields }, { onConflict: 'org_id' })
  return NextResponse.json({ success: true })
}
