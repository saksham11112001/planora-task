import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse }      from 'next/server'
import type { NextRequest }  from 'next/server'
import { dbError }           from '@/lib/api-error'
import { notifySuperAdminsOfSignup, resolveSignupSurface } from '@/lib/email/signupAlert'

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
    // Existence check before the upsert — this endpoint runs on EVERY login,
    // and super admins should only be alerted for genuinely new signups.
    const { data: existing } = await admin.from('users')
      .select('id').eq('id', user.id).maybeSingle()

    // This route is fetched same-origin from the signup page, so the Host
    // header is the subdomain the person actually signed up on. The referer
    // supplies the path (e.g. /partners/...) that Host alone cannot show.
    // Both are hints only — a missing or odd value just falls back to 'app'.
    let refPath: string | null = null
    try { refPath = new URL(request.headers.get('referer') ?? '').pathname } catch { /* no/invalid referer */ }
    const surface = resolveSignupSurface(request.headers.get('host'), refPath)

    await admin.from('users').upsert({
      id:         user.id,
      email:      (user.email ?? '').slice(0, 255),
      name:       String(rawName).slice(0, 100),
      avatar_url: user.user_metadata?.avatar_url ?? null,
      // See the matching comment in app/auth/callback/route.ts: the product is
      // stamped at account creation from the Host header, because onboarding's
      // client-side inference silently mislabels users as 'app' whenever any of
      // its three signals is lost. New accounts only, and never back to 'app'.
      ...(!existing && surface !== 'app' ? { signup_product: surface } : {}),
    }, { onConflict: 'id' })

    if (!existing) {
      const provider = user.app_metadata?.provider ?? 'email'

      await notifySuperAdminsOfSignup(
        { email: user.email, name: String(rawName) },
        provider === 'email' ? 'email + password / magic link' : `${provider} oauth`,
        surface,
      )
    }

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