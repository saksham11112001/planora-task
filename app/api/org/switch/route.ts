import { NextResponse }     from 'next/server'
import type { NextRequest }  from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ACTIVE_ORG_COOKIE } from '@/lib/supabase/activeOrg'
import { isGhostAdmin }      from '@/lib/supabase/ghostAdmin'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { org_id } = await request.json() as { org_id?: string }
  if (!org_id) return NextResponse.json({ error: 'org_id required' }, { status: 400 })

  // Ghost admin can switch to any org without a real membership row
  if (!isGhostAdmin(user.id)) {
    // Verify user is an active member of the requested org.
    // Admin client bypasses RLS so we can check memberships beyond the current active org.
    const admin = createAdminClient()
    const { data: mb } = await admin
      .from('org_members')
      .select('org_id')
      .eq('user_id', user.id)
      .eq('org_id', org_id)
      .eq('is_active', true)
      .maybeSingle()

    if (!mb) return NextResponse.json({ error: 'Not a member of this organisation' }, { status: 403 })
  }

  const response = NextResponse.json({ success: true })
  const isProd = process.env.NODE_ENV === 'production'

  // Set the active-org cookie.
  // In production: domain-scoped so it works across all subdomains of sng-adwisers.com.
  response.cookies.set(ACTIVE_ORG_COOKIE, org_id, {
    path:     '/',
    maxAge:   60 * 60 * 24 * 365,
    sameSite: 'lax',
    secure:   isProd,
    httpOnly: false,
    ...(isProd ? { domain: '.sng-adwisers.com' } : {}),
  })

  // In production, also expire any stale host-only cookie left from before the domain migration.
  // response.cookies.set() is keyed by name so calling it twice would overwrite the first set
  // above — use headers.append instead to emit a separate Set-Cookie header for the expiry.
  if (isProd) {
    response.headers.append(
      'Set-Cookie',
      `${ACTIVE_ORG_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax; Secure`,
    )
  }

  return response
}
