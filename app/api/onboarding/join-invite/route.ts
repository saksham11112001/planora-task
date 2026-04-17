import { NextResponse }  from 'next/server'
import type { NextRequest } from 'next/server'
import { inngest }          from '@/lib/inngest/client'

export async function POST(request: NextRequest) {
  try {
    const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
    const { createClient } = await import('@/lib/supabase/server')

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const { org_id, role } = await request.json()
    if (!org_id) return NextResponse.json({ error: 'org_id required' }, { status: 400 })

    const admin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Verify org exists
    const { data: org } = await admin.from('organisations').select('id, name').eq('id', org_id).single()
    if (!org) return NextResponse.json({ error: 'Organisation not found or invite expired' }, { status: 404 })

    // Ensure user profile exists
    await admin.from('users').upsert({
      id: user.id, email: user.email ?? '',
      name: user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'User',
      avatar_url: user.user_metadata?.avatar_url ?? null,
    }, { onConflict: 'id' })

    // Check if already a member
    const { data: existing } = await admin.from('org_members')
      .select('id, is_active').eq('org_id', org_id).eq('user_id', user.id).maybeSingle()

    if (existing) {
      // Reactivate if inactive
      await admin.from('org_members').update({ is_active: true, role: role ?? 'member' }).eq('id', existing.id)
    } else {
      // Add as new member
      await admin.from('org_members').insert({
        org_id, user_id: user.id, role: role ?? 'member', is_active: true,
      })
    }

    // Deactivate any active memberships in OTHER orgs.
    // A user must belong to exactly one active org at a time — multiple active rows
    // cause membership lookups to return the wrong org (cross-org data leakage).
    await admin.from('org_members')
      .update({ is_active: false })
      .eq('user_id', user.id)
      .neq('org_id', org_id)
      .eq('is_active', true)

    // Clear invite metadata from user
    await supabase.auth.updateUser({
      data: { invited_to_org: null, invited_role: null }
    })

    // Notify managers that a new member joined
    try {
      const { data: userInfo } = await supabase.from('users').select('name, email').eq('id', user.id).maybeSingle()
      await inngest.send({
        name: 'team/member-joined',
        data: {
          org_id: org.id, new_member_id: user.id,
          member_name:     (userInfo as any)?.name ?? 'New member',
          member_email:    (userInfo as any)?.email ?? '',
          role:            role ?? 'member',
          invited_by_name: 'Admin',
          org_name:        org.name ?? '',
        },
      })
    } catch {}
    return NextResponse.json({ success: true, org_name: org.name })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Unexpected error' }, { status: 500 })
  }
}
