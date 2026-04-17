import { createServerClient } from '@supabase/ssr'
import { createAdminClient }  from '@/lib/supabase/admin'
import { cookies }            from 'next/headers'
import { NextResponse }       from 'next/server'
import type { NextRequest }   from 'next/server'

const VALID_ROLES = new Set(['member', 'manager', 'admin', 'owner'])

function safeRedirect(next: string | null, fallback = '/dashboard'): string {
  if (!next) return fallback
  // Only allow same-origin relative paths
  if (next.startsWith('/') && !next.startsWith('//')) return next
  return fallback
}

export async function GET(request: NextRequest) {
  const url  = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = safeRedirect(url.searchParams.get('next'))

  // IMPLICIT FLOW: token is in the URL hash (#access_token=...).
  // Hashes are never sent to the server, so if there's no ?code,
  // redirect to a client-side page that can read window.location.hash.
  if (!code) {
    const confirmUrl = new URL('/auth/confirm', request.url)
    confirmUrl.searchParams.set('next', next)
    return NextResponse.redirect(confirmUrl)
  }

  // PKCE FLOW (magic links, email OTP): exchange the code for a session
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

  if (error || !user) {
    console.error('[auth/callback] exchangeCodeForSession failed:', error?.message)
    return NextResponse.redirect(new URL('/login?error=auth_failed&hint=try_again', request.url))
  }

  await provisionUser(user)

  const invitedOrgId = user.user_metadata?.invited_to_org as string | undefined
  const rawRole      = user.user_metadata?.invited_role as string | undefined
  const invitedRole  = VALID_ROLES.has(rawRole ?? '') ? (rawRole as string) : 'member'

  if (invitedOrgId) {
    await provisionInvitedMember(user, invitedOrgId, invitedRole)
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.redirect(new URL(next, request.url))
}

async function provisionUser(user: any) {
  const admin = createAdminClient()
  try {
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
  } catch (err) {
    console.error('[auth/callback] provisionUser failed:', err)
  }
}

async function provisionInvitedMember(user: any, orgId: string, role: string) {
  const admin = createAdminClient()

  await provisionUser(user)

  // Use upsert to avoid check-then-insert race condition
  await admin.from('org_members').upsert(
    { org_id: orgId, user_id: user.id, role, is_active: true },
    { onConflict: 'org_id,user_id', ignoreDuplicates: false }
  )

  // Clear invite metadata so it can't be replayed
  try {
    await admin.auth.admin.updateUserById(user.id, {
      user_metadata: { ...user.user_metadata, invited_to_org: null, invited_role: null },
    })
  } catch (err) {
    console.error('[auth/callback] clearInviteMetadata failed:', err)
  }
}