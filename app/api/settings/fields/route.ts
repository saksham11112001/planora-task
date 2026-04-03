import { createClient } from '@/lib/supabase/server'
import { NextResponse }  from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: null })
  const { data: mb } = await supabase.from('org_members').select('org_id').eq('user_id', user.id).eq('is_active', true).single()
  if (!mb) return NextResponse.json({ data: null })
  const { data: s } = await supabase.from('org_settings').select('task_fields').eq('org_id', mb.org_id).maybeSingle()
  return NextResponse.json({ data: s?.task_fields ?? null })
}
