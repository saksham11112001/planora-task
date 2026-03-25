import { createClient }    from '@/lib/supabase/server'
import { NextResponse }    from 'next/server'
import type { NextRequest } from 'next/server'

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { name, phone_number, timezone, whatsapp_opted_in } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const { error } = await supabase.from('users').update({
    name:              name.trim(),
    phone_number:      phone_number || null,
    timezone:          timezone || 'Asia/Kolkata',
    whatsapp_opted_in: !!whatsapp_opted_in,
    updated_at:        new Date().toISOString(),
  }).eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { data } = await supabase.from('users')
    .select('id, name, email, avatar_url, phone_number, timezone, whatsapp_opted_in')
    .eq('id', user.id).single()
  return NextResponse.json({ data })
}
