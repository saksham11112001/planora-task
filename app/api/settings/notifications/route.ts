import { createClient } from '@/lib/supabase/server'
import { NextResponse }  from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { data: mb } = await supabase.from('org_members').select('org_id').eq('user_id', user.id).eq('is_active', true).single()
  if (!mb) return NextResponse.json({ data: [] })
  const { data } = await supabase.from('notification_preferences').select('*').eq('user_id', user.id).eq('org_id', mb.org_id)
  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { data: mb } = await supabase.from('org_members').select('org_id').eq('user_id', user.id).eq('is_active', true).single()
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })

  const { preferences } = await request.json()
  // preferences: { [event_type]: { via_email: boolean, via_whatsapp: boolean } }

  const rows = Object.entries(preferences as Record<string, { via_email: boolean; via_whatsapp: boolean }>).map(
    ([event_type, pref]) => ({
      user_id:      user.id,
      org_id:       mb.org_id,
      event_type,
      via_email:    pref.via_email,
      via_whatsapp: pref.via_whatsapp,
    })
  )

  const { error } = await supabase
    .from('notification_preferences')
    .upsert(rows, { onConflict: 'user_id,org_id,event_type' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
