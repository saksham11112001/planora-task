import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse }       from 'next/server'

export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const admin = createAdminClient()
  const { data: mb } = await supabase.from('org_members').select('org_id, role').eq('user_id', user.id).eq('is_active', true).single()

  if (mb) {
    if (mb.role === 'owner') {
      const orgId = mb.org_id
      await admin.from('tasks').delete().eq('org_id', orgId)
      await admin.from('time_logs').delete().eq('org_id', orgId)
      await admin.from('projects').delete().eq('org_id', orgId)
      await admin.from('clients').delete().eq('org_id', orgId)
      await admin.from('org_members').delete().eq('org_id', orgId)
      await admin.from('organisations').delete().eq('id', orgId)
    } else {
      await admin.from('org_members').delete().eq('user_id', user.id)
    }
  }

  await admin.from('users').delete().eq('id', user.id)
  await admin.auth.admin.deleteUser(user.id)
  return NextResponse.json({ success: true })
}
