import { NextResponse } from 'next/server'
import { dbError } from '@/lib/api-error'
import { generateCode } from '@/lib/utils/codeGen'

export async function POST() {
  try {
    const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
    const { createClient } = await import('@/lib/supabase/server')

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const admin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: mb } = await admin
      .from('org_members')
      .select('org_id, role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (!mb) return NextResponse.json({ error: 'No active organisation' }, { status: 400 })
    if (!['owner', 'admin'].includes(mb.role)) {
      return NextResponse.json({ error: 'Only owners and admins can rotate the join code' }, { status: 403 })
    }

    const newCode = generateCode(8)
    const { error } = await admin
      .from('organisations')
      .update({ join_code: newCode })
      .eq('id', mb.org_id)

    if (error) return NextResponse.json(dbError(error, 'rotate-join-code'), { status: 500 })

    return NextResponse.json({ success: true, join_code: newCode })
  } catch (err: any) {
    return NextResponse.json(dbError(err, 'rotate-join-code'), { status: 500 })
  }
}
