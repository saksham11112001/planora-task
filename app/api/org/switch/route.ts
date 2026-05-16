import { NextResponse }    from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient }     from '@/lib/supabase/server'
import { ACTIVE_ORG_COOKIE } from '@/lib/supabase/activeOrg'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { org_id } = await request.json() as { org_id?: string }
  if (!org_id) return NextResponse.json({ error: 'org_id required' }, { status: 400 })

  // Verify user is an active member of the requested org
  const { data: mb } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .eq('org_id', org_id)
    .eq('is_active', true)
    .maybeSingle()

  if (!mb) return NextResponse.json({ error: 'Not a member of this organisation' }, { status: 403 })

  const response = NextResponse.json({ success: true })
  response.cookies.set(ACTIVE_ORG_COOKIE, org_id, {
    path:     '/',
    maxAge:   60 * 60 * 24 * 365,
    sameSite: 'lax',
    secure:   process.env.NODE_ENV === 'production',
    httpOnly: false,
  })
  return response
}
