import { NextResponse }  from 'next/server'
import type { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
    const { createClient } = await import('@/lib/supabase/server')

    const supabase      = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const body = await request.json()
    const { org_name, industry, team_size } = body
    if (!org_name?.trim()) return NextResponse.json({ error: 'Organisation name required' }, { status: 400 })

    // Use admin client to bypass RLS for org creation
    const admin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false }, global: { headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}` } } }
    )

    // Ensure user profile exists
    await admin.from('users').upsert({
      id: user.id, email: user.email ?? '',
      name: user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'User',
      avatar_url: user.user_metadata?.avatar_url ?? null,
    }, { onConflict: 'id' })

    // Generate unique slug
    const base = org_name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const slug = `${base}-${Date.now().toString(36)}`

    // Create org
    const { data: org, error: orgErr } = await admin.from('organisations').insert({
      name: org_name.trim(), slug, plan_tier: 'free', status: 'active', industry: industry || null, team_size: team_size || null,
    }).select('id').single()
    if (orgErr) return NextResponse.json({ error: orgErr.message }, { status: 500 })

    // Add owner member
    await admin.from('org_members').insert({ org_id: org.id, user_id: user.id, role: 'owner', is_active: true })

    // Create default workspace
    await admin.from('workspaces').insert({ org_id: org.id, name: 'My workspace', color: '#0d9488', is_default: true, created_by: user.id })

    return NextResponse.json({ success: true, org_id: org.id }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Unexpected error' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok' })
}
