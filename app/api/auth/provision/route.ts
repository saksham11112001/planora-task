import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse }      from 'next/server'
import type { NextRequest }  from 'next/server'

// Called client-side after implicit OAuth flow establishes a session.
// Creates/updates the public.users row and handles invite metadata.
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No session' }, { status: 401 })

    const body = await request.json()
    const admin = createAdminClient()

    // 1. Upsert public.users row
    await admin.from('users').upsert({
      id:         user.id,
      email:      user.email ?? '',
      name: (
        user.user_metadata?.full_name ??
        user.user_metadata?.name ??
        ((user.user_metadata?.given_name && user.user_metadata?.family_name)
          ? `${user.user_metadata.given_name} ${user.user_metadata.family_name}`
          : null) ??
        user.user_metadata?.given_name ??
        user.email?.split('@')[0]?.replace(/[._]/g, ' ')?.replace(/\b\w/g, (l: string) => l.toUpperCase()) ??
        'User'
      ),
      avatar_url: user.user_metadata?.avatar_url ?? null,
    }, { onConflict: 'id' })

    // 2. Handle invite metadata if present
    const invitedOrgId = user.user_metadata?.invited_to_org as string | undefined
    const invitedRole  = (user.user_metadata?.invited_role as string | undefined) ?? 'member'

    if (invitedOrgId) {
      const { data: existing } = await admin
        .from('org_members').select('id, is_active')
        .eq('org_id', invitedOrgId).eq('user_id', user.id).maybeSingle()

      if (existing && !existing.is_active) {
        await admin.from('org_members').update({ is_active: true, role: invitedRole }).eq('id', existing.id)
      } else if (!existing) {
        await admin.from('org_members').insert({ org_id: invitedOrgId, user_id: user.id, role: invitedRole, is_active: true })
      }

      await admin.auth.admin.updateUserById(user.id, {
        user_metadata: { ...user.user_metadata, invited_to_org: null, invited_role: null },
      })

      return NextResponse.json({ success: true, redirect: '/dashboard' })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[api/auth/provision]', err?.message)
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}