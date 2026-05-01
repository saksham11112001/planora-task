import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { dbError } from '@/lib/api-error'
import { normaliseCode } from '@/lib/utils/codeGen'

export async function POST(request: NextRequest) {
  try {
    const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
    const { createClient } = await import('@/lib/supabase/server')

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const body = await request.json()
    const { code: rawCode } = body
    if (!rawCode?.trim()) return NextResponse.json({ error: 'Join code required' }, { status: 400 })

    const admin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const inputCode = normaliseCode(rawCode)

    // Find org by join code — generic error to prevent enumeration
    const { data: org } = await admin
      .from('organisations')
      .select('id, name, status')
      .eq('join_code', inputCode)
      .single()

    if (!org) return NextResponse.json({ error: 'Invalid join code' }, { status: 400 })

    // Check not already a member
    const { data: existing } = await admin
      .from('org_members')
      .select('id, is_active, role')
      .eq('org_id', org.id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing?.is_active) {
      return NextResponse.json({ error: 'You are already a member of this organisation' }, { status: 400 })
    }

    if (existing) {
      // Reactivate a previously deactivated membership
      await admin.from('org_members').update({ is_active: true }).eq('id', existing.id)
    } else {
      // New member with 'member' role
      await admin.from('org_members').insert({
        org_id:    org.id,
        user_id:   user.id,
        role:      'member',
        is_active: true,
      })
    }

    // Ensure user profile exists
    await admin.from('users').upsert({
      id:    user.id,
      email: user.email ?? '',
    }, { onConflict: 'id', ignoreDuplicates: true })

    return NextResponse.json({ success: true, org_id: org.id, org_name: org.name })
  } catch (err: any) {
    return NextResponse.json(dbError(err, 'org/join'), { status: 500 })
  }
}
