export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: self } = await supabase
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!self) return NextResponse.json({ error: 'Not in org' }, { status: 403 })

  const { data, error } = await supabase
    .from('org_members')
    .select('id, user_id, role, joined_at, users(id, email, name, avatar_url, phone_number)')
    .eq('org_id', self.org_id)
    .order('joined_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { user_id, role, org_id } = await req.json()

  // Verify requester is admin of this org
  const { data: self } = await supabase
    .from('org_members')
    .select('role, org_id')
    .eq('user_id', user.id)
    .eq('org_id', org_id)
    .maybeSingle()

  if (!self || self.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Prevent demoting yourself
  if (user_id === user.id) {
    return NextResponse.json({ error: 'Cannot change your own role' }, { status: 400 })
  }

  const { error } = await supabase
    .from('org_members')
    .update({ role })
    .eq('user_id', user_id)
    .eq('org_id', org_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { user_id, org_id } = await req.json()

  // Verify requester is admin
  const { data: self } = await supabase
    .from('org_members')
    .select('role, org_id')
    .eq('user_id', user.id)
    .eq('org_id', org_id)
    .maybeSingle()

  if (!self || self.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Cannot remove yourself
  if (user_id === user.id) {
    return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 400 })
  }

  // Check if target is also an admin — only allow if multiple admins exist
  const { data: targetMember } = await supabase
    .from('org_members')
    .select('role')
    .eq('user_id', user_id)
    .eq('org_id', org_id)
    .maybeSingle()

  if (targetMember?.role === 'admin') {
    const { count } = await supabase
      .from('org_members')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', org_id)
      .eq('role', 'admin')

    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { error: 'Cannot remove the last admin. Promote another admin first.' },
        { status: 400 }
      )
    }
  }

  // Remove the member
  const { error } = await supabase
    .from('org_members')
    .delete()
    .eq('user_id', user_id)
    .eq('org_id', org_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Unassign their tasks within this org (set to null)
  await supabase
    .from('tasks')
    .update({ assignee_id: null })
    .eq('org_id', org_id)
    .eq('assignee_id', user_id)

  return NextResponse.json({ success: true })
}
