import { createServerClient } from '@supabase/ssr'
import { createAdminClient }  from '@/lib/supabase/admin'
import { cookies }            from 'next/headers'
import { NextResponse }       from 'next/server'
import type { NextRequest }   from 'next/server'

export async function GET(request: NextRequest) {
  const url  = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next') ?? '/dashboard'

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cs) => cs.forEach(({ name, value, options }) => {
            try { cookieStore.set(name, value, options) } catch {}
          }),
        },
      }
    )

    const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && user) {
      const invitedOrgId = user.user_metadata?.invited_to_org as string | undefined
      const invitedRole  = (user.user_metadata?.invited_role as string | undefined) ?? 'member'

      // ── Invited-user flow ─────────────────────────────────────────────────
      // If this user was invited to an org (metadata set by /api/settings/members),
      // provision their profile + org_members row now.
      // Without this, the app layout sees no membership and redirects to /onboarding,
      // causing them to accidentally create a second org.
      if (invitedOrgId) {
        const admin = createAdminClient()

        // 1. Ensure user profile exists
        await admin.from('users').upsert({
          id:         user.id,
          email:      user.email ?? '',
          name:       user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'User',
          avatar_url: user.user_metadata?.avatar_url ?? null,
        }, { onConflict: 'id' })

        // 2. Check if already a member (edge case: re-clicking invite link)
        const { data: existing } = await admin
          .from('org_members')
          .select('id, is_active')
          .eq('org_id', invitedOrgId)
          .eq('user_id', user.id)
          .maybeSingle()

        if (existing && !existing.is_active) {
          // Reactivate
          await admin.from('org_members')
            .update({ is_active: true, role: invitedRole })
            .eq('id', existing.id)
        } else if (!existing) {
          // Insert fresh membership
          await admin.from('org_members').insert({
            org_id:    invitedOrgId,
            user_id:   user.id,
            role:      invitedRole,
            is_active: true,
          })
        }

        // 3. Clear invite metadata so it doesn't re-trigger on token refresh
        await admin.auth.admin.updateUserById(user.id, {
          user_metadata: {
            ...user.user_metadata,
            invited_to_org: null,
            invited_role:   null,
          },
        })

        // 4. Send them to the dashboard — they are now a real member
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
      // ── End invited-user flow ─────────────────────────────────────────────

      const redirectUrl = new URL(next, request.url)
      return NextResponse.redirect(redirectUrl)
    }
  }

  return NextResponse.redirect(new URL('/login?error=auth_failed', request.url))
}
