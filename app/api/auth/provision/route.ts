import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse }      from 'next/server'
import type { NextRequest }  from 'next/server'
import { dbError }           from '@/lib/api-error'

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
    const rawName = (
      user.user_metadata?.full_name ??
      user.user_metadata?.name ??
      ((user.user_metadata?.given_name && user.user_metadata?.family_name)
        ? `${user.user_metadata.given_name} ${user.user_metadata.family_name}`
        : null) ??
      user.user_metadata?.given_name ??
      user.email?.split('@')[0]?.replace(/[._]/g, ' ')?.replace(/\b\w/g, (l: string) => l.toUpperCase()) ??
      'User'
    )
    await admin.from('users').upsert({
      id:         user.id,
      email:      (user.email ?? '').slice(0, 255),
      name:       String(rawName).slice(0, 100),
      avatar_url: user.user_metadata?.avatar_url ?? null,
    }, { onConflict: 'id' })

    // 2. Handle invite metadata if present
    const VALID_ROLES = new Set(['member', 'manager', 'admin', 'owner'])
    const invitedOrgId = user.user_metadata?.invited_to_org as string | undefined
    const rawRole      = user.user_metadata?.invited_role as string | undefined
    const invitedRole  = VALID_ROLES.has(rawRole ?? '') ? (rawRole as string) : 'member'

    if (invitedOrgId) {
      // Upsert avoids check-then-insert race condition
      await admin.from('org_members').upsert(
        { org_id: invitedOrgId, user_id: user.id, role: invitedRole, is_active: true },
        { onConflict: 'org_id,user_id', ignoreDuplicates: false }
      )

      // Deactivate any active memberships in OTHER orgs.
      // A user must belong to exactly one active org at a time — multiple active rows
      // cause membership lookups to return the wrong org (cross-org data leakage).
      await admin.from('org_members')
        .update({ is_active: false })
        .eq('user_id', user.id)
        .neq('org_id', invitedOrgId)
        .eq('is_active', true)

      try {
        await admin.auth.admin.updateUserById(user.id, {
          user_metadata: { ...user.user_metadata, invited_to_org: null, invited_role: null },
        })
      } catch (err) {
        console.error('[api/auth/provision] clearInviteMetadata failed:', err)
      }

      return NextResponse.json({ success: true, redirect: '/dashboard' })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[api/auth/provision]', err?.message)
    return NextResponse.json(dbError(err, 'auth/provision'), { status: 500 })
  }
}