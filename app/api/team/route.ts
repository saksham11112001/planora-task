import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse }      from 'next/server'
import type { NextRequest }  from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { data: mb } = await supabase.from('org_members').select('org_id').eq('user_id', user.id).eq('is_active', true).single()
  if (!mb) return NextResponse.json({ data: [] })

  const { data, error } = await supabase.from('org_members')
    .select('id, role, joined_at, user_id, users(id, name, email, avatar_url)')
    .eq('org_id', mb.org_id).eq('is_active', true).order('joined_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { data: mb } = await supabase.from('org_members').select('org_id, role').eq('user_id', user.id).eq('is_active', true).single()
  if (!mb || !['owner','admin'].includes(mb.role))
    return NextResponse.json({ error: 'Only owners/admins can invite' }, { status: 403 })

  const { email, role = 'member' } = await request.json()
  if (!email?.trim()) return NextResponse.json({ error: 'Email required' }, { status: 400 })
  if (!['admin','manager','member','viewer'].includes(role))
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })

  const admin = createAdminClient()
  // Find existing user by email
  const { data: existingUser } = await admin.from('users').select('id').eq('email', email.toLowerCase().trim()).maybeSingle()

  if (existingUser) {
    // Check not already a member
    const { data: existing } = await admin.from('org_members').select('id, is_active').eq('org_id', mb.org_id).eq('user_id', existingUser.id).maybeSingle()
    if (existing?.is_active) return NextResponse.json({ error: 'User is already a member' }, { status: 409 })

    if (existing) {
      // Reactivate
      await admin.from('org_members').update({ is_active: true, role }).eq('id', existing.id)
    } else {
      await admin.from('org_members').insert({ org_id: mb.org_id, user_id: existingUser.id, role, is_active: true })
    }
    return NextResponse.json({ success: true, message: 'Member added' })
  }

  // User doesn't exist — send invite via Supabase Auth
  const { error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email.trim(), {
    data: { invited_to_org: mb.org_id, invited_role: role },
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
  })
  if (inviteErr) return NextResponse.json({ error: inviteErr.message }, { status: 500 })
  return NextResponse.json({ success: true, message: 'Invitation sent' })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { data: mb } = await supabase.from('org_members').select('org_id, role').eq('user_id', user.id).eq('is_active', true).single()
  if (!mb || !['owner','admin'].includes(mb.role))
    return NextResponse.json({ error: 'Only owners/admins can change roles' }, { status: 403 })

  const { member_id, role } = await request.json()
  if (!['admin','manager','member','viewer'].includes(role))
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })

  const { error } = await supabase.from('org_members').update({ role }).eq('id', member_id).eq('org_id', mb.org_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
