import { createServerClient } from '@supabase/ssr'
import { createAdminClient }  from '@/lib/supabase/admin'
import { cookies }            from 'next/headers'
import { NextResponse }       from 'next/server'
import type { NextRequest }   from 'next/server'

const VALID_ROLES = new Set(['member', 'manager', 'admin', 'owner', 'viewer'])

function safeRedirect(next: string | null, fallback = '/dashboard'): string {
  if (!next) return fallback
  // Only allow same-origin relative paths
  if (next.startsWith('/') && !next.startsWith('//')) return next
  return fallback
}

export async function GET(request: NextRequest) {
  const url  = new URL(request.url)
  const code = url.searchParams.get('code')
  const host = request.headers.get('host') ?? ''
  const isMsmeDomain = host.startsWith('msme.')
  const next = safeRedirect(url.searchParams.get('next'), isMsmeDomain ? '/msme' : '/dashboard')

  // Provider/OTP errors arrive as query params (?error=access_denied,
  // ?error_code=otp_expired). Surface a specific message on the login page
  // instead of bouncing through /auth/confirm to a generic failure.
  const errParam = url.searchParams.get('error')
  const errCode  = url.searchParams.get('error_code')
  if (!code && (errParam || errCode)) {
    const mapped =
      errCode === 'otp_expired'      ? 'otp_expired' :
      errParam === 'access_denied'   ? 'cancelled'   : 'auth_failed'
    return NextResponse.redirect(new URL(`/login?error=${mapped}`, request.url))
  }

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
        setAll: (cs: { name: string; value: string; options?: Record<string, unknown> }[]) => {
          const sharedDomain = process.env.NODE_ENV === 'production' ? { domain: '.upfloat.co' } : {}
          cs.forEach(({ name, value, options }) => {
            try { cookieStore.set(name, value, { ...(options as any), ...sharedDomain }) } catch {}
          })
        },
      },
    }
  )

  const isRecovery = url.searchParams.get('recovery') === '1'

  let { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !user) {
    // Auth codes are single-use. The exchange commonly fails on REPLAY:
    // email security scanners pre-fetching the magic link, double-clicks, or
    // the user refreshing the callback URL. In those cases the FIRST exchange
    // already established a session cookie — so before failing, check whether
    // the browser is in fact already signed in and continue if so.
    const { data: { user: existingUser } } = await supabase.auth.getUser()
    if (existingUser) {
      console.warn('[auth/callback] code exchange failed but session exists — continuing (replayed link):', error?.message)
      user = existingUser
    } else {
      console.error('[auth/callback] exchangeCodeForSession failed:', error?.message)
      return NextResponse.redirect(new URL('/login?error=auth_failed&hint=try_again', request.url))
    }
  }

  // Password-reset flow: user is now authenticated; send them to set their new password.
  if (isRecovery) {
    return NextResponse.redirect(new URL('/auth/reset-password', request.url))
  }

  await provisionUser(user)

  const invitedOrgId = user.user_metadata?.invited_to_org as string | undefined
  const rawRole      = user.user_metadata?.invited_role as string | undefined
  const invitedRole  = VALID_ROLES.has(rawRole ?? '') ? (rawRole as string) : 'member'

  if (invitedOrgId) {
    await provisionInvitedMember(user, invitedOrgId, invitedRole)
    return NextResponse.redirect(new URL(isMsmeDomain ? '/msme' : '/dashboard', request.url))
  }

  // Cross-subdomain redirect: if next=/msme but we're on the main domain,
  // send the user to msme.upfloat.co/msme where the MSME dashboard lives.
  const MSME_ORIGIN = process.env.NEXT_PUBLIC_MSME_URL ?? 'https://msme.upfloat.co'
  if (next === '/msme' && !isMsmeDomain) {
    return NextResponse.redirect(`${MSME_ORIGIN}/msme`)
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