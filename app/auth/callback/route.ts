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
      const admin = createAdminClient()

      // Always ensure public.users row exists — Google OAuth creates auth.users
      // but not public.users. Without this, getUserProfile throws for new users.
      try {
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
            user.email?.split('@')[0] ?? 'User'
          ),
          avatar_url: user.user_metadata?.avatar_url ?? null,
        }, { onConflict: 'id' })
      } catch (_) {}

      const invitedOrgId = user.user_metadata?.invited_to_org as string | undefined
      const invitedRole  = (user.user_metadata?.invited_role as string | undefined) ?? 'member'

      // ── Invited-user flow ─────────────────────────────────────────────────
      // If this user was invited to an org (metadata set by /api/team POST),
      // provision their org_members row now.
      // Without this, the app layout sees no membership and redirects to /onboarding,
      // causing them to accidentally create a second org.
      if (invitedOrgId) {
        // 1. Ensure user profile exists (with nicer name formatting)
        await admin.from('users').upsert({
          id:         user.id,
          email:      user.email ?? '',
          name:       (
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
        // If existing && is_active — they're already in, just continue to dashboard

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

      // ── FIX: Fallback membership check for existing invited users ─────────
      // Edge case: user was previously invited (metadata set) but the callback
      // was visited in a different browser/device so metadata was already cleared
      // by a prior session. The user has a valid session but no org_members row.
      // Check the auth.users record directly for a pending invite org id.
      // This covers the redirect loop: logged in → no membership → /onboarding → loop.
      const { data: authUser } = await admin.auth.admin.getUserById(user.id)
      const pendingOrgId = authUser?.user?.user_metadata?.invited_to_org as string | undefined
      const pendingRole  = (authUser?.user?.user_metadata?.invited_role as string | undefined) ?? 'member'

      if (pendingOrgId) {
        const { data: existing } = await admin
          .from('org_members')
          .select('id, is_active')
          .eq('org_id', pendingOrgId)
          .eq('user_id', user.id)
          .maybeSingle()

        if (!existing) {
          await admin.from('org_members').insert({
            org_id: pendingOrgId, user_id: user.id, role: pendingRole, is_active: true,
          })
        } else if (!existing.is_active) {
          await admin.from('org_members').update({ is_active: true, role: pendingRole }).eq('id', existing.id)
        }

        await admin.auth.admin.updateUserById(user.id, {
          user_metadata: { ...authUser?.user?.user_metadata, invited_to_org: null, invited_role: null },
        })

        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
      // ── End fallback ──────────────────────────────────────────────────────

      const redirectUrl = new URL(next, request.url)
      return NextResponse.redirect(redirectUrl)
    }
  }

  // Auth failed - code missing or session exchange failed
  // Most common cause: browser cleared cookies between Google login and callback
  return NextResponse.redirect(new URL('/login?error=auth_failed&hint=try_again', request.url))
}